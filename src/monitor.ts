import { classifyAgentProcessTrees, listSystemProcesses, type ClassifiedAgentProcess } from './agents';
import type { ProcessEntry } from './types';

export type AiActivityState = 'working-now' | 'open-idle' | 'not-running';
export type MonitorLifecycle = 'stopped' | 'monitoring';

export interface ActivityContext {
  chat: string | null;
  workspace: string | null;
  source: 'cooperating-app-metadata' | 'codex-local-metadata' | null;
}

export interface AiActivityProduct {
  signature: string;
  name: string;
  kind: string;
  state: AiActivityState;
  process_count: number;
  cpu_percent: number | null;
  memory_percent: number | null;
  recent_cpu_time_delta_ms: number | null;
  active_seconds: number;
  context: ActivityContext;
}

export interface ActivityTimelineSegment {
  started_at: string;
  ended_at: string;
  state: 'working-now' | 'open-idle' | 'not-running';
  product_signatures: string[];
  observation_id?: number;
}

export interface MonitorOverhead {
  current_cpu_percent: number | null;
  current_memory_bytes: number;
  history_bytes: number;
  sample_count: number;
  median_cpu_percent: number | null;
  p95_cpu_percent: number | null;
  max_memory_bytes: number;
  measurement: 'forkit-process-tree';
}

export interface MonitorSnapshot {
  schema_version: '1.0';
  lifecycle: MonitorLifecycle;
  started_at: string | null;
  stopped_at: string | null;
  observed_seconds: number;
  active_seconds: number;
  activity_ratio: number | null;
  products: AiActivityProduct[];
  timeline: ActivityTimelineSegment[];
  overhead: MonitorOverhead;
  sample_interval_ms: number;
  history_limit: number;
  evidence: 'repeated-process-tree-cpu-time-deltas';
  limitation: string;
}

interface ProductTracker {
  signature: string;
  name: string;
  kind: string;
  state: AiActivityState;
  signals: boolean[];
  activeMs: number;
  processCount: number;
  cpuPercent: number | null;
  memoryPercent: number | null;
  cpuDeltaMs: number | null;
  context: ActivityContext;
}

export interface ActivityMonitorOptions {
  sampleProcesses?: () => Promise<ProcessEntry[]>;
  now?: () => number;
  intervalMs?: number;
  historyLimit?: number;
  excludedRootPid?: number | null;
  context?: (signature: string) => ActivityContext | Promise<ActivityContext>;
  classifyProcesses?: (processes: ProcessEntry[]) => ClassifiedAgentProcess[] | Promise<ClassifiedAgentProcess[]>;
}

const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_HISTORY_LIMIT = 900;

function rounded(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sum(values: Array<number | null>): number | null {
  const measured = values.filter((value): value is number => value !== null);
  return measured.length === 0 ? null : rounded(measured.reduce((total, value) => total + value, 0));
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return rounded(sorted[index]!);
}

function localContextFromEnvironment(): ActivityContext {
  const chat = process.env.FORKIT_AI_FOOTPRINTS_CONTEXT_CHAT?.trim() || null;
  const workspace = process.env.FORKIT_AI_FOOTPRINTS_CONTEXT_WORKSPACE?.trim() || null;
  return {
    chat,
    workspace,
    source: chat || workspace ? 'cooperating-app-metadata' : null,
  };
}

function groupProcesses(processes: ClassifiedAgentProcess[]): Map<string, ClassifiedAgentProcess[]> {
  const result = new Map<string, ClassifiedAgentProcess[]>();
  for (const entry of processes) result.set(entry.signature, [...(result.get(entry.signature) ?? []), entry]);
  return result;
}

function historyByteSize(snapshot: Omit<MonitorSnapshot, 'overhead'>): number {
  return Buffer.byteLength(JSON.stringify({
    started_at: snapshot.started_at,
    observed_seconds: snapshot.observed_seconds,
    active_seconds: snapshot.active_seconds,
    products: snapshot.products,
    timeline: snapshot.timeline,
  }));
}

export class ActivityMonitor {
  private readonly sampleProcesses: () => Promise<ProcessEntry[]>;
  private readonly now: () => number;
  private readonly intervalMs: number;
  private readonly historyLimit: number;
  private readonly excludedRootPid: number | null;
  private readonly context: (signature: string) => ActivityContext | Promise<ActivityContext>;
  private readonly classifyProcesses: (processes: ProcessEntry[]) => ClassifiedAgentProcess[] | Promise<ClassifiedAgentProcess[]>;
  private lifecycle: MonitorLifecycle = 'stopped';
  private startedAt: number | null = null;
  private stoppedAt: number | null = null;
  private previousAt: number | null = null;
  private observationId = 0;
  private previousCpuTimes = new Map<number, number>();
  private observedMs = 0;
  private activeMs = 0;
  private products = new Map<string, ProductTracker>();
  private timeline: ActivityTimelineSegment[] = [];
  private timer: NodeJS.Timeout | null = null;
  private sampling = false;
  private nodeCpuUsage: NodeJS.CpuUsage | null = null;
  private nodeCpuAt: number | null = null;
  private overheadCpuSamples: number[] = [];
  private overheadMemorySamples: number[] = [];

  constructor(options: ActivityMonitorOptions = {}) {
    this.sampleProcesses = options.sampleProcesses ?? listSystemProcesses;
    this.now = options.now ?? Date.now;
    this.intervalMs = Math.max(500, options.intervalMs ?? DEFAULT_INTERVAL_MS);
    this.historyLimit = Math.max(10, options.historyLimit ?? DEFAULT_HISTORY_LIMIT);
    this.excludedRootPid = options.excludedRootPid === undefined ? process.pid : options.excludedRootPid;
    this.context = options.context ?? (() => localContextFromEnvironment());
    this.classifyProcesses = options.classifyProcesses ?? ((entries) => classifyAgentProcessTrees(entries, this.excludedRootPid));
  }

  async start(options: { schedule?: boolean } = {}): Promise<MonitorSnapshot> {
    if (this.lifecycle === 'monitoring') return this.snapshot();
    const now = this.now();
    this.lifecycle = 'monitoring';
    this.observationId += 1;
    this.startedAt = now;
    this.stoppedAt = null;
    this.previousAt = null;
    this.previousCpuTimes.clear();
    this.nodeCpuUsage = process.cpuUsage();
    this.nodeCpuAt = now;
    await this.sampleNow();
    if (options.schedule !== false) {
      this.timer = setInterval(() => { void this.sampleNow(); }, this.intervalMs);
      this.timer.unref();
    }
    return this.snapshot();
  }

  async sampleNow(): Promise<MonitorSnapshot> {
    if (this.lifecycle !== 'monitoring' || this.sampling) return this.snapshot();
    this.sampling = true;
    try {
      const entries = await this.sampleProcesses();
      const now = this.now();
      const elapsed = this.previousAt === null ? 0 : Math.max(0, now - this.previousAt);
      const validElapsed = elapsed > 0 && elapsed <= this.intervalMs * 3 ? elapsed : 0;
      const grouped = groupProcesses(await this.classifyProcesses(entries));
      const signatures = new Set([...this.products.keys(), ...grouped.keys()]);

      for (const signature of signatures) {
        const current = grouped.get(signature) ?? [];
        const previous = this.products.get(signature);
        let cpuDeltaMs = 0;
        let deltaCount = 0;
        for (const entry of current) {
          const currentTime = entry.cpu_time_ms;
          const previousTime = this.previousCpuTimes.get(entry.pid);
          if (currentTime === null || previousTime === undefined || currentTime < previousTime) continue;
          cpuDeltaMs += currentTime - previousTime;
          deltaCount += 1;
        }
        const measuredDelta = deltaCount > 0 ? cpuDeltaMs : null;
        const strongSignal = current.length > 0
          && validElapsed > 0
          && measuredDelta !== null
          && measuredDelta >= Math.max(20, validElapsed * 0.02);
        const signals = [...(previous?.signals ?? []), strongSignal].slice(-3);
        let state: AiActivityState;
        if (current.length === 0) state = 'not-running';
        else if (previous?.state === 'working-now') state = signals.every((value) => !value) ? 'open-idle' : 'working-now';
        else state = signals.slice(-2).length === 2 && signals.slice(-2).every(Boolean) ? 'working-now' : 'open-idle';
        const activeMs = (previous?.activeMs ?? 0) + (validElapsed > 0 && state === 'working-now' ? validElapsed : 0);
        const first = current[0];
        this.products.set(signature, {
          signature,
          name: first?.name ?? previous?.name ?? signature,
          kind: first?.kind ?? previous?.kind ?? 'unknown',
          state,
          signals,
          activeMs,
          processCount: current.length,
          cpuPercent: sum(current.map((entry) => entry.cpu_percent)),
          memoryPercent: sum(current.map((entry) => entry.memory_percent)),
          cpuDeltaMs: measuredDelta,
          context: await this.context(signature),
        });
      }

      if (validElapsed > 0) {
        this.observedMs += validElapsed;
        if ([...this.products.values()].some((product) => product.state === 'working-now')) this.activeMs += validElapsed;
      }
      this.updateTimeline(now);
      this.previousCpuTimes = new Map(entries.flatMap((entry) => Number.isFinite(entry.cpu_time_ms)
        ? [[entry.pid, Number(entry.cpu_time_ms)] as const]
        : []));
      this.previousAt = now;
      this.sampleOverhead(now, entries);
      return this.snapshot();
    } finally {
      this.sampling = false;
    }
  }

  stop(): MonitorSnapshot {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.lifecycle === 'monitoring') this.stoppedAt = this.now();
    this.lifecycle = 'stopped';
    return this.snapshot();
  }

  clearHistory(): MonitorSnapshot {
    const now = this.now();
    this.startedAt = this.lifecycle === 'monitoring' ? now : null;
    this.stoppedAt = null;
    this.previousAt = null;
    this.previousCpuTimes.clear();
    this.observedMs = 0;
    this.activeMs = 0;
    this.products.clear();
    this.timeline = [];
    this.overheadCpuSamples = [];
    this.overheadMemorySamples = [];
    this.nodeCpuUsage = process.cpuUsage();
    this.nodeCpuAt = now;
    return this.snapshot();
  }

  private updateTimeline(now: number): void {
    const working = [...this.products.values()].filter((product) => product.state === 'working-now');
    const running = [...this.products.values()].filter((product) => product.state !== 'not-running');
    const state: ActivityTimelineSegment['state'] = working.length > 0
      ? 'working-now'
      : running.length > 0 ? 'open-idle' : 'not-running';
    const signatures = (working.length > 0 ? working : running).map((product) => product.signature).sort();
    const at = new Date(now).toISOString();
    const latest = this.timeline.at(-1);
    if (latest && latest.observation_id === this.observationId && latest.state === state && latest.product_signatures.join('|') === signatures.join('|')) latest.ended_at = at;
    else this.timeline.push({ started_at: at, ended_at: at, state, product_signatures: signatures, observation_id: this.observationId });
    if (this.timeline.length > this.historyLimit) this.timeline.splice(0, this.timeline.length - this.historyLimit);
  }

  private sampleOverhead(now: number, entries: ProcessEntry[]): void {
    const included = new Set<number>([process.pid]);
    if (process.env.FORKIT_AI_FOOTPRINTS_APP_BUNDLE === '1' && process.ppid > 1) included.add(process.ppid);
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of entries) {
        if (included.has(entry.pid) || entry.ppid === undefined || !included.has(entry.ppid)) continue;
        included.add(entry.pid);
        changed = true;
      }
    }
    const ownEntries = entries.filter((entry) => included.has(entry.pid));
    const measuredMemory = ownEntries.reduce((total, entry) => total + (Number.isFinite(entry.rss_bytes) ? Number(entry.rss_bytes) : 0), 0);
    const memory = measuredMemory > 0 ? measuredMemory : process.memoryUsage().rss;
    this.overheadMemorySamples.push(memory);
    if (this.overheadMemorySamples.length > this.historyLimit) this.overheadMemorySamples.shift();
    if (this.nodeCpuUsage && this.nodeCpuAt !== null && now - this.nodeCpuAt >= this.intervalMs * 0.5) {
      const usage = process.cpuUsage(this.nodeCpuUsage);
      const nodeCpu = ((usage.user + usage.system) / ((now - this.nodeCpuAt) * 1000)) * 100;
      const measuredTreeCpu = ownEntries.reduce((total, entry) => total + (Number.isFinite(entry.cpu_percent) ? Number(entry.cpu_percent) : 0), 0);
      const cpu = process.env.FORKIT_AI_FOOTPRINTS_APP_BUNDLE === '1' && measuredTreeCpu > 0 ? measuredTreeCpu : nodeCpu;
      this.overheadCpuSamples.push(rounded(Math.max(0, cpu)));
      if (this.overheadCpuSamples.length > this.historyLimit) this.overheadCpuSamples.shift();
    }
    this.nodeCpuUsage = process.cpuUsage();
    this.nodeCpuAt = now;
  }

  snapshot(): MonitorSnapshot {
    const products: AiActivityProduct[] = [...this.products.values()].map((product) => ({
      signature: product.signature,
      name: product.name,
      kind: product.kind,
      state: product.state,
      process_count: product.processCount,
      cpu_percent: product.cpuPercent,
      memory_percent: product.memoryPercent,
      recent_cpu_time_delta_ms: product.cpuDeltaMs,
      active_seconds: rounded(product.activeMs / 1000),
      context: product.context,
    })).sort((left, right) => left.name.localeCompare(right.name));
    const base = {
      schema_version: '1.0' as const,
      lifecycle: this.lifecycle,
      started_at: this.startedAt === null ? null : new Date(this.startedAt).toISOString(),
      stopped_at: this.stoppedAt === null ? null : new Date(this.stoppedAt).toISOString(),
      observed_seconds: rounded(this.observedMs / 1000),
      active_seconds: rounded(this.activeMs / 1000),
      activity_ratio: this.observedMs > 0 ? rounded(this.activeMs / this.observedMs, 3) : null,
      products,
      timeline: this.timeline.map((segment) => ({ ...segment, product_signatures: [...segment.product_signatures] })),
      sample_interval_ms: this.intervalMs,
      history_limit: this.historyLimit,
      evidence: 'repeated-process-tree-cpu-time-deltas' as const,
      limitation: 'Working now means sustained recent work in a supported app process tree; it is not prompt, task, token, energy, or cost attribution.',
    };
    const memory = this.overheadMemorySamples.at(-1) ?? process.memoryUsage().rss;
    return {
      ...base,
      overhead: {
        current_cpu_percent: this.overheadCpuSamples.at(-1) ?? null,
        current_memory_bytes: memory,
        history_bytes: historyByteSize(base),
        sample_count: this.overheadCpuSamples.length,
        median_cpu_percent: percentile(this.overheadCpuSamples, 0.5),
        p95_cpu_percent: percentile(this.overheadCpuSamples, 0.95),
        max_memory_bytes: Math.max(memory, ...this.overheadMemorySamples),
        measurement: 'forkit-process-tree',
      },
    };
  }
}
