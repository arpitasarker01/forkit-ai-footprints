import { classifyAgentProcessTrees, listSystemProcesses, type ClassifiedAgentProcess } from './agents';
import type { DevicePresence } from './device-presence';
import type { ProcessEntry } from './types';

export type AiActivityState = 'working-now' | 'open-idle' | 'not-running';
export type MonitorLifecycle = 'stopped' | 'monitoring';

export interface ActivityContext {
  chat: string | null;
  workspace: string | null;
  branch?: string | null;
  changes_added?: number | null;
  changes_removed?: number | null;
  checks?: string | null;
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
  memory_bytes: number | null;
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
  continuity_id?: number;
}

export interface ResourceHistoryBucket {
  started_at: string;
  ended_at: string;
  system_signature: string;
  system_name: string;
  kind: string;
  observed_seconds: number;
  active_seconds: number;
  avg_cpu_percent: number | null;
  peak_cpu_percent: number | null;
  avg_memory_bytes: number | null;
  peak_memory_bytes: number | null;
  peak_process_count: number;
  sample_count: number;
  measurement: 'bounded-local-process-tree-resource-bucket';
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
  observation_id: number;
  lifecycle: MonitorLifecycle;
  started_at: string | null;
  stopped_at: string | null;
  observed_seconds: number;
  active_seconds: number;
  activity_ratio: number | null;
  products: AiActivityProduct[];
  timeline: ActivityTimelineSegment[];
  resource_history?: ResourceHistoryBucket[];
  overhead: MonitorOverhead;
  sample_interval_ms: number;
  history_limit: number;
  evidence: 'repeated-process-tree-cpu-time-deltas';
  presence: DevicePresence;
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
  memoryBytes: number | null;
  cpuDeltaMs: number | null;
  context: ActivityContext;
}

interface ResourceBucketTracker {
  startedAt: number;
  endedAt: number;
  signature: string;
  name: string;
  kind: string;
  observedMs: number;
  activeMs: number;
  cpuWeightedMs: number;
  cpuMeasuredMs: number;
  peakCpuPercent: number | null;
  memoryWeightedMs: number;
  memoryMeasuredMs: number;
  peakMemoryBytes: number | null;
  peakProcessCount: number;
  sampleCount: number;
}

export interface ActivityMonitorOptions {
  sampleProcesses?: () => Promise<ProcessEntry[]>;
  now?: () => number;
  intervalMs?: number;
  historyLimit?: number;
  excludedRootPid?: number | null;
  context?: (signature: string) => ActivityContext | Promise<ActivityContext>;
  classifyProcesses?: (processes: ProcessEntry[]) => ClassifiedAgentProcess[] | Promise<ClassifiedAgentProcess[]>;
  devicePresence?: () => DevicePresence | Promise<DevicePresence>;
}

const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_HISTORY_LIMIT = 900;
const RESOURCE_BUCKET_MS = 60_000;

function rounded(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
  private readonly devicePresence: () => DevicePresence | Promise<DevicePresence>;
  private lifecycle: MonitorLifecycle = 'stopped';
  private startedAt: number | null = null;
  private stoppedAt: number | null = null;
  private previousAt: number | null = null;
  private observationId = 0;
  private continuityId = 0;
  private previousCpuTimes = new Map<number, number>();
  private observedMs = 0;
  private activeMs = 0;
  private products = new Map<string, ProductTracker>();
  private timeline: ActivityTimelineSegment[] = [];
  private resourceBuckets: ResourceBucketTracker[] = [];
  private timer: NodeJS.Timeout | null = null;
  private sampling = false;
  private nodeCpuUsage: NodeJS.CpuUsage | null = null;
  private nodeCpuAt: number | null = null;
  private overheadCpuSamples: number[] = [];
  private overheadMemorySamples: number[] = [];
  private presence: DevicePresence = { state: 'active', idle_seconds: 0, observation_eligible: true };

  constructor(options: ActivityMonitorOptions = {}) {
    this.sampleProcesses = options.sampleProcesses ?? listSystemProcesses;
    this.now = options.now ?? Date.now;
    this.intervalMs = Math.max(500, options.intervalMs ?? DEFAULT_INTERVAL_MS);
    this.historyLimit = Math.max(10, options.historyLimit ?? DEFAULT_HISTORY_LIMIT);
    this.excludedRootPid = options.excludedRootPid === undefined ? process.pid : options.excludedRootPid;
    this.context = options.context ?? (() => localContextFromEnvironment());
    this.classifyProcesses = options.classifyProcesses ?? ((entries) => classifyAgentProcessTrees(entries, this.excludedRootPid));
    this.devicePresence = options.devicePresence ?? (() => ({ state: 'active', idle_seconds: 0, observation_eligible: true }));
  }

  async start(options: { schedule?: boolean } = {}): Promise<MonitorSnapshot> {
    if (this.lifecycle === 'monitoring') return this.snapshot();
    const now = this.now();
    this.lifecycle = 'monitoring';
    this.observationId += 1;
    this.continuityId += 1;
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
      const [entries, sampledPresence] = await Promise.all([this.sampleProcesses(), this.devicePresence()]);
      const now = this.now();
      const previousPresenceEligible = this.presence.observation_eligible;
      this.presence = sampledPresence;
      const elapsed = this.previousAt === null ? 0 : Math.max(0, now - this.previousAt);
      const elapsedContinuous = elapsed > 0 && elapsed <= this.intervalMs * 3;
      const continuityBroken = this.previousAt !== null
        && (!elapsedContinuous || !previousPresenceEligible || !sampledPresence.observation_eligible);
      if (continuityBroken && previousPresenceEligible) this.continuityId += 1;
      const validElapsed = elapsedContinuous && previousPresenceEligible && sampledPresence.observation_eligible ? elapsed : 0;
      const grouped = groupProcesses(await this.classifyProcesses(entries));
      const signatures = new Set([...this.products.keys(), ...grouped.keys()]);

      for (const signature of signatures) {
        const current = grouped.get(signature) ?? [];
        const previous = this.products.get(signature);
        const signalEntries = current.filter((entry) => entry.activity_signal !== false);
        let cpuDeltaMs = 0;
        let deltaCount = 0;
        for (const entry of signalEntries) {
          const currentTime = entry.cpu_time_ms;
          const previousTime = this.previousCpuTimes.get(entry.pid);
          if (currentTime === null || previousTime === undefined || currentTime < previousTime) continue;
          cpuDeltaMs += currentTime - previousTime;
          deltaCount += 1;
        }
        const measuredDelta = deltaCount > 0 ? cpuDeltaMs : null;
        const strongSignal = sampledPresence.observation_eligible
          && signalEntries.length > 0
          && validElapsed > 0
          && measuredDelta !== null
          && measuredDelta >= Math.max(20, validElapsed * 0.02);
        const signals = [...(continuityBroken ? [] : previous?.signals ?? []), strongSignal].slice(-3);
        let state: AiActivityState;
        if (!sampledPresence.observation_eligible) state = current.length === 0 ? 'not-running' : 'open-idle';
        else if (current.length === 0) state = 'not-running';
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
          cpuPercent: measuredDelta !== null && validElapsed > 0
            ? rounded((measuredDelta / validElapsed) * 100)
            : sum(current.map((entry) => entry.cpu_percent)),
          memoryPercent: sum(current.map((entry) => entry.memory_percent)),
          memoryBytes: sum(current.map((entry) => entry.memory_bytes)),
          cpuDeltaMs: measuredDelta,
          context: await this.context(signature),
        });
      }

      if (validElapsed > 0) {
        this.observedMs += validElapsed;
        if ([...this.products.values()].some((product) => product.state === 'working-now')) this.activeMs += validElapsed;
        this.recordResourceHistory(now, validElapsed);
      }
      if (validElapsed > 0) this.updateTimeline(now, validElapsed);
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
    this.resourceBuckets = [];
    this.overheadCpuSamples = [];
    this.overheadMemorySamples = [];
    this.nodeCpuUsage = process.cpuUsage();
    this.nodeCpuAt = now;
    if (this.lifecycle === 'monitoring') {
      this.observationId += 1;
      this.continuityId += 1;
    }
    return this.snapshot();
  }

  restoreStoppedSnapshot(snapshot: MonitorSnapshot): MonitorSnapshot {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.lifecycle = 'stopped';
    this.observationId = Math.max(0, Math.floor(snapshot.observation_id ?? 0));
    this.continuityId = Math.max(
      this.observationId,
      ...(snapshot.timeline ?? []).map((segment) => Math.max(0, Math.floor(segment.continuity_id ?? segment.observation_id ?? 0))),
    );
    this.startedAt = snapshot.started_at ? Date.parse(snapshot.started_at) : null;
    this.stoppedAt = snapshot.stopped_at ? Date.parse(snapshot.stopped_at) : this.startedAt;
    this.previousAt = null;
    this.previousCpuTimes.clear();
    this.observedMs = Math.max(0, Number(snapshot.observed_seconds) || 0) * 1000;
    this.activeMs = Math.max(0, Number(snapshot.active_seconds) || 0) * 1000;
    this.products.clear();
    for (const product of snapshot.products ?? []) {
      this.products.set(product.signature, {
        signature: product.signature,
        name: product.name,
        kind: product.kind,
        state: product.state,
        signals: [],
        activeMs: Math.max(0, Number(product.active_seconds) || 0) * 1000,
        processCount: 0,
        cpuPercent: null,
        memoryPercent: null,
        memoryBytes: null,
        cpuDeltaMs: null,
        context: { chat: null, workspace: null, source: null },
      });
    }
    this.timeline = (snapshot.timeline ?? []).slice(-this.historyLimit).map((segment) => ({
      started_at: segment.started_at,
      ended_at: segment.ended_at,
      state: segment.state,
      product_signatures: [...segment.product_signatures],
      ...(segment.observation_id === undefined ? {} : { observation_id: segment.observation_id }),
      ...(segment.continuity_id === undefined ? {} : { continuity_id: segment.continuity_id }),
    }));
    this.resourceBuckets = (snapshot.resource_history ?? []).slice(-this.historyLimit).map((bucket) => {
      const observedMs = Math.max(0, Number(bucket.observed_seconds) || 0) * 1000;
      const activeMs = Math.max(0, Number(bucket.active_seconds) || 0) * 1000;
      const cpuMeasuredMs = bucket.avg_cpu_percent === null ? 0 : observedMs;
      const memoryMeasuredMs = bucket.avg_memory_bytes === null ? 0 : observedMs;
      return {
        startedAt: Date.parse(bucket.started_at),
        endedAt: Date.parse(bucket.ended_at),
        signature: bucket.system_signature,
        name: bucket.system_name,
        kind: bucket.kind,
        observedMs,
        activeMs,
        cpuWeightedMs: bucket.avg_cpu_percent === null ? 0 : bucket.avg_cpu_percent * cpuMeasuredMs,
        cpuMeasuredMs,
        peakCpuPercent: finiteOrNull(bucket.peak_cpu_percent),
        memoryWeightedMs: bucket.avg_memory_bytes === null ? 0 : bucket.avg_memory_bytes * memoryMeasuredMs,
        memoryMeasuredMs,
        peakMemoryBytes: finiteOrNull(bucket.peak_memory_bytes),
        peakProcessCount: Math.max(0, Math.trunc(Number(bucket.peak_process_count) || 0)),
        sampleCount: Math.max(0, Math.trunc(Number(bucket.sample_count) || 0)),
      };
    }).filter((bucket) => Number.isFinite(bucket.startedAt) && Number.isFinite(bucket.endedAt) && bucket.endedAt >= bucket.startedAt);
    this.presence = snapshot.presence ?? { state: 'active', idle_seconds: 0, observation_eligible: true };
    this.overheadCpuSamples = [];
    this.overheadMemorySamples = [];
    this.nodeCpuUsage = process.cpuUsage();
    this.nodeCpuAt = this.now();
    return this.snapshot();
  }

  private updateTimeline(now: number, elapsedMs: number): void {
    const working = [...this.products.values()].filter((product) => product.state === 'working-now');
    const running = [...this.products.values()].filter((product) => product.state !== 'not-running');
    const state: ActivityTimelineSegment['state'] = working.length > 0
      ? 'working-now'
      : running.length > 0 ? 'open-idle' : 'not-running';
    const signatures = (working.length > 0 ? working : running).map((product) => product.signature).sort();
    const startedAt = new Date(Math.max(0, now - elapsedMs)).toISOString();
    const endedAt = new Date(now).toISOString();
    const latest = this.timeline.at(-1);
    if (latest
      && (latest.continuity_id ?? latest.observation_id) === this.continuityId
      && latest.state === state
      && latest.product_signatures.join('|') === signatures.join('|')) latest.ended_at = endedAt;
    else this.timeline.push({
      started_at: startedAt,
      ended_at: endedAt,
      state,
      product_signatures: signatures,
      observation_id: this.observationId,
      continuity_id: this.continuityId,
    });
    if (this.timeline.length > this.historyLimit) this.timeline.splice(0, this.timeline.length - this.historyLimit);
  }

  private recordResourceHistory(now: number, elapsedMs: number): void {
    if (elapsedMs <= 0) return;
    const products = [...this.products.values()].filter((product) => product.processCount > 0 && product.state !== 'not-running');
    if (products.length === 0) return;
    const intervalStart = now - elapsedMs;
    for (const product of products) {
      for (let cursor = intervalStart; cursor < now;) {
        const bucketStart = Math.floor(cursor / RESOURCE_BUCKET_MS) * RESOURCE_BUCKET_MS;
        const bucketEnd = Math.min(now, bucketStart + RESOURCE_BUCKET_MS);
        const sliceMs = Math.max(0, bucketEnd - cursor);
        cursor = bucketEnd;
        if (sliceMs <= 0) continue;
        let bucket = this.resourceBuckets.find((item) => item.signature === product.signature && item.startedAt === bucketStart);
        if (!bucket) {
          bucket = {
            startedAt: bucketStart,
            endedAt: bucketStart,
            signature: product.signature,
            name: product.name,
            kind: product.kind,
            observedMs: 0,
            activeMs: 0,
            cpuWeightedMs: 0,
            cpuMeasuredMs: 0,
            peakCpuPercent: null,
            memoryWeightedMs: 0,
            memoryMeasuredMs: 0,
            peakMemoryBytes: null,
            peakProcessCount: 0,
            sampleCount: 0,
          };
          this.resourceBuckets.push(bucket);
        }
        bucket.name = product.name;
        bucket.kind = product.kind;
        bucket.endedAt = Math.max(bucket.endedAt, bucketEnd);
        bucket.observedMs += sliceMs;
        if (product.state === 'working-now') bucket.activeMs += sliceMs;
        if (product.cpuPercent !== null && Number.isFinite(product.cpuPercent)) {
          const cpu = Math.max(0, product.cpuPercent);
          bucket.cpuWeightedMs += cpu * sliceMs;
          bucket.cpuMeasuredMs += sliceMs;
          bucket.peakCpuPercent = bucket.peakCpuPercent === null ? cpu : Math.max(bucket.peakCpuPercent, cpu);
        }
        if (product.memoryBytes !== null && Number.isFinite(product.memoryBytes)) {
          const memory = Math.max(0, product.memoryBytes);
          bucket.memoryWeightedMs += memory * sliceMs;
          bucket.memoryMeasuredMs += sliceMs;
          bucket.peakMemoryBytes = bucket.peakMemoryBytes === null ? memory : Math.max(bucket.peakMemoryBytes, memory);
        }
        bucket.peakProcessCount = Math.max(bucket.peakProcessCount, Math.max(0, Math.trunc(product.processCount || 0)));
        bucket.sampleCount += 1;
      }
    }
    if (this.resourceBuckets.length > this.historyLimit) this.resourceBuckets.splice(0, this.resourceBuckets.length - this.historyLimit);
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
      memory_bytes: product.memoryBytes,
      recent_cpu_time_delta_ms: product.cpuDeltaMs,
      active_seconds: rounded(product.activeMs / 1000),
      context: product.context,
    })).sort((left, right) => left.name.localeCompare(right.name));
    const base = {
      schema_version: '1.0' as const,
      observation_id: this.observationId,
      lifecycle: this.lifecycle,
      started_at: this.startedAt === null ? null : new Date(this.startedAt).toISOString(),
      stopped_at: this.stoppedAt === null ? null : new Date(this.stoppedAt).toISOString(),
      observed_seconds: rounded(this.observedMs / 1000),
      active_seconds: rounded(this.activeMs / 1000),
      activity_ratio: this.observedMs > 0 ? rounded(this.activeMs / this.observedMs, 3) : null,
      products,
      timeline: this.timeline.map((segment) => ({ ...segment, product_signatures: [...segment.product_signatures] })),
      resource_history: this.resourceBuckets.map((bucket) => ({
        started_at: new Date(bucket.startedAt).toISOString(),
        ended_at: new Date(bucket.endedAt).toISOString(),
        system_signature: bucket.signature,
        system_name: bucket.name,
        kind: bucket.kind,
        observed_seconds: rounded(bucket.observedMs / 1000),
        active_seconds: rounded(bucket.activeMs / 1000),
        avg_cpu_percent: bucket.cpuMeasuredMs > 0 ? rounded(bucket.cpuWeightedMs / bucket.cpuMeasuredMs) : null,
        peak_cpu_percent: bucket.peakCpuPercent === null ? null : rounded(bucket.peakCpuPercent),
        avg_memory_bytes: bucket.memoryMeasuredMs > 0 ? Math.round(bucket.memoryWeightedMs / bucket.memoryMeasuredMs) : null,
        peak_memory_bytes: bucket.peakMemoryBytes === null ? null : Math.round(bucket.peakMemoryBytes),
        peak_process_count: bucket.peakProcessCount,
        sample_count: bucket.sampleCount,
        measurement: 'bounded-local-process-tree-resource-bucket' as const,
      })),
      sample_interval_ms: this.intervalMs,
      history_limit: this.historyLimit,
      evidence: 'repeated-process-tree-cpu-time-deltas' as const,
      presence: { ...this.presence },
      limitation: 'Active now means sustained recent CPU time in a supported local AI-app process tree while this Mac is awake, unlocked, and recently used; it is not prompt, task, token, energy, or cost attribution.',
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
