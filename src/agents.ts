import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sha256, stableId } from './hash';
import type { AgentKind, CensusAgent, Confidence, ProcessEntry } from './types';

interface AgentSignature {
  signature: string;
  name: string;
  kind: AgentKind;
  terms: string[];
  executables: string[];
}

interface AgentEvidence {
  signature: AgentSignature;
  confidence: Confidence;
  executable: string;
  evidenceHash: string;
  reason: string;
  cpuPercent: number | null;
  memoryPercent: number | null;
}

export interface ClassifiedAgentProcess {
  pid: number;
  ppid: number | null;
  signature: string;
  name: string;
  kind: string;
  confidence: Confidence;
  relationship: 'direct' | 'descendant';
  cpu_percent: number | null;
  memory_percent: number | null;
  memory_bytes: number | null;
  cpu_time_ms: number | null;
  activity_signal?: boolean;
}

const execFileAsync = promisify(execFile);

const SIGNATURES: AgentSignature[] = [
  { signature: 'chatgpt', name: 'ChatGPT', kind: 'ai-app', terms: ['chatgpt'], executables: ['chatgpt'] },
  { signature: 'jan', name: 'Jan', kind: 'ai-app', terms: ['jan'], executables: ['jan'] },
  { signature: 'lm-studio', name: 'LM Studio', kind: 'ai-app', terms: ['lm-studio', 'lmstudio', 'lm studio'], executables: ['lm-studio', 'lmstudio', 'lm studio'] },
  { signature: 'open-webui', name: 'Open WebUI', kind: 'ai-app', terms: ['open-webui', 'open_webui'], executables: ['open-webui', 'open_webui'] },
  { signature: 'codex', name: 'Codex', kind: 'coding-agent', terms: ['codex'], executables: ['codex'] },
  { signature: 'claude', name: 'Claude Code', kind: 'coding-agent', terms: ['claude', 'claude-code'], executables: ['claude'] },
  { signature: 'aider', name: 'Aider', kind: 'coding-agent', terms: ['aider'], executables: ['aider'] },
  { signature: 'openhands', name: 'OpenHands', kind: 'coding-agent', terms: ['openhands'], executables: ['openhands'] },
  { signature: 'goose', name: 'Goose', kind: 'coding-agent', terms: ['goose'], executables: ['goose'] },
  { signature: 'cursor', name: 'Cursor', kind: 'ide-agent', terms: ['cursor'], executables: ['cursor'] },
  { signature: 'windsurf', name: 'Windsurf', kind: 'ide-agent', terms: ['windsurf'], executables: ['windsurf'] },
  { signature: 'gemini-cli', name: 'Gemini CLI', kind: 'coding-agent', terms: ['gemini', 'gemini-cli'], executables: ['gemini'] },
  { signature: 'opencode', name: 'OpenCode', kind: 'coding-agent', terms: ['opencode'], executables: ['opencode'] },
  { signature: 'openclaw', name: 'OpenClaw', kind: 'coding-agent', terms: ['openclaw'], executables: ['openclaw'] },
  { signature: 'cline', name: 'Cline', kind: 'ide-agent', terms: ['cline'], executables: ['cline'] },
  { signature: 'roo-code', name: 'Roo Code', kind: 'ide-agent', terms: ['roo-code', 'roo_code'], executables: ['roo-code', 'roo_code'] },
  { signature: 'mcp-server', name: 'MCP Server', kind: 'mcp-server', terms: ['mcp-server', 'modelcontextprotocol'], executables: ['mcp-server'] },
  { signature: 'langchain', name: 'LangChain', kind: 'agent-framework', terms: ['langchain'], executables: ['langchain'] },
  { signature: 'langgraph', name: 'LangGraph', kind: 'agent-framework', terms: ['langgraph'], executables: ['langgraph'] },
  { signature: 'crewai', name: 'CrewAI', kind: 'agent-framework', terms: ['crewai'], executables: ['crewai'] },
  { signature: 'autogen', name: 'AutoGen', kind: 'agent-framework', terms: ['autogen'], executables: ['autogen'] },
  { signature: 'llamaindex', name: 'LlamaIndex', kind: 'agent-framework', terms: ['llamaindex'], executables: ['llamaindex'] },
  { signature: 'agno', name: 'Agno', kind: 'agent-framework', terms: ['agno'], executables: ['agno'] },
  { signature: 'pydantic-ai', name: 'PydanticAI', kind: 'agent-framework', terms: ['pydantic-ai', 'pydantic_ai'], executables: ['pydantic-ai', 'pydantic_ai'] },
  { signature: 'smolagents', name: 'smolagents', kind: 'agent-framework', terms: ['smolagents'], executables: ['smolagents'] },
];

const CHATGPT_CODEX_SIGNATURE: AgentSignature = {
  signature: 'chatgpt-codex',
  name: 'ChatGPT · Codex',
  kind: 'ai-app',
  terms: ['chatgpt-codex'],
  executables: ['chatgpt', 'codex'],
};

function basename(value: string): string {
  const normalized = String(value || '').replaceAll('\\', '/');
  return path.posix.basename(normalized).toLowerCase().replace(/\.exe$/i, '');
}

function commandParts(value: string): string[] {
  return String(value || '')
    .match(/"[^"]*"|'[^']*'|\S+/g)
    ?.map((part) => part.replace(/^(?:"|')|(?:"|')$/g, '')) ?? [];
}

function macosAppExecutableName(command: string): string | null {
  const marker = '.app/Contents/MacOS/';
  const markerIndex = command.indexOf(marker);
  if (markerIndex < 0) return null;
  const tail = command.slice(markerIndex + marker.length);
  const executable = tail.split(/\s--/)[0]?.trim();
  return executable ? basename(executable) : null;
}

function moduleName(parts: string[]): string | null {
  const moduleFlag = parts.findIndex((part) => part === '-m');
  if (moduleFlag < 0) return null;
  const raw = parts[moduleFlag + 1]?.toLowerCase();
  return raw?.split('.')[0] ?? null;
}

function packageRunnerName(parts: string[]): string | null {
  const runner = basename(parts[0] ?? '');
  let candidates: string[] = [];
  if (runner === 'npx' || runner === 'bunx') candidates = parts.slice(1);
  else if (runner === 'npm' && (parts[1] === 'exec' || parts[1] === 'x')) candidates = parts.slice(2);
  else if (runner === 'pnpm' && (parts[1] === 'dlx' || parts[1] === 'exec')) candidates = parts.slice(2);
  else if (runner === 'yarn' && (parts[1] === 'dlx' || parts[1] === 'exec')) candidates = parts.slice(2);
  const candidate = candidates.find((part) => part !== '--' && !part.startsWith('-'));
  if (!candidate) return null;
  const packageName = candidate.replace(/@(?:latest|next|beta|alpha|canary|\d[^/]*)$/i, '');
  return basename(packageName);
}

function nodeBinName(parts: string[]): string | null {
  const runner = basename(parts[0] ?? '');
  if (runner !== 'node' && runner !== 'bun' && runner !== 'deno') return null;
  const script = String(parts[1] ?? '').replaceAll('\\', '/').toLowerCase();
  if (!script.includes('/.bin/')) return null;
  return basename(script);
}

function isNonAiSupportProcess(processName: string, executable: string, command: string): boolean {
  const supportText = `${processName} ${executable} ${command}`.toLowerCase();
  return supportText.includes('browser_crashpad_handler')
    || supportText.includes('crashpad_handler')
    || processName === 'autoupdate'
    || processName === 'updater'
    || executable === 'autoupdate'
    || executable === 'updater';
}

function isPassiveAppHelperProcess(entry: ProcessEntry): boolean {
  const processText = `${entry.name ?? ''} ${entry.cmd ?? ''}`.toLowerCase();
  return processText.includes('codex (renderer)')
    || processText.includes('codex (service)')
    || processText.includes('--type=renderer')
    || processText.includes('--type=utility')
    || processText.includes('--type=gpu-process')
    || processText.includes('browser_crashpad_handler')
    || processText.includes('crashpad_handler')
    || processText.includes('/sparkle.framework/')
    || /\bautoupdate\b/.test(processText)
    || /\bupdater\b/.test(processText);
}

function classifyProcess(entry: ProcessEntry): AgentEvidence | null {
  const processName = basename(entry.name ?? '');
  const command = String(entry.cmd ?? '');
  const parts = commandParts(command);
  const firstCommandToken = parts[0] ?? '';
  const executable = macosAppExecutableName(command) ?? (basename(firstCommandToken || processName) || 'unknown');
  if (isNonAiSupportProcess(processName, executable, command)) return null;
  const invokedModule = moduleName(parts);
  const invokedPackage = packageRunnerName(parts) ?? nodeBinName(parts);

  for (const signature of SIGNATURES) {
    const executableMatch = signature.executables.includes(processName)
      || signature.executables.includes(executable);
    const moduleMatch = invokedModule !== null && signature.terms.includes(invokedModule);
    const packageRunnerMatch = invokedPackage !== null
      && [...signature.terms, ...signature.executables].includes(invokedPackage);
    if (!executableMatch && !moduleMatch && !packageRunnerMatch) continue;
    const confidence: Confidence = executableMatch ? 'high' : 'medium';
    const reason = executableMatch
      ? 'exact_executable_match'
      : moduleMatch
        ? 'explicit_module_invocation'
        : 'explicit_package_runner_invocation';
    return {
      signature,
      confidence,
      executable,
      evidenceHash: sha256(`${signature.signature}:${processName}:${executable}:${reason}`),
      reason,
      cpuPercent: Number.isFinite(entry.cpu_percent) ? Math.max(0, Number(entry.cpu_percent)) : null,
      memoryPercent: Number.isFinite(entry.memory_percent) ? Math.max(0, Number(entry.memory_percent)) : null,
    };
  }
  return null;
}

function descendantsOf(processes: ProcessEntry[], rootPid: number): Set<number> {
  const excluded = new Set<number>([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of processes) {
      if (excluded.has(entry.pid) || entry.ppid === undefined || !excluded.has(entry.ppid)) continue;
      excluded.add(entry.pid);
      changed = true;
    }
  }
  return excluded;
}

function nearestDirectAncestor(
  byPid: Map<number, ProcessEntry>,
  direct: Map<number, AgentEvidence>,
  start: ProcessEntry,
  signature: string,
): number | null {
  const visited = new Set<number>();
  let parentPid = start.ppid;
  for (let depth = 0; parentPid !== undefined && parentPid > 0 && depth < 24; depth += 1) {
    if (visited.has(parentPid)) break;
    visited.add(parentPid);
    const owner = direct.get(parentPid);
    if (owner?.signature.signature === signature) return parentPid;
    parentPid = byPid.get(parentPid)?.ppid;
  }
  return null;
}

function asEmbeddedChatGptCodex(evidence: AgentEvidence): AgentEvidence {
  return {
    ...evidence,
    signature: CHATGPT_CODEX_SIGNATURE,
    confidence: 'high',
    reason: 'embedded_chatgpt_codex_process_tree',
    evidenceHash: sha256(`${CHATGPT_CODEX_SIGNATURE.signature}:${evidence.executable}:${evidence.reason}`),
  };
}

function collapseEmbeddedOpenAiAppStack(
  processes: ProcessEntry[],
  direct: Map<number, AgentEvidence>,
): Map<number, AgentEvidence> {
  const byPid = new Map(processes.map((entry) => [entry.pid, entry]));
  const chatGptRootsWithCodex = new Set<number>();
  const embeddedCodexPids = new Set<number>();
  for (const entry of processes) {
    const owner = direct.get(entry.pid);
    if (owner?.signature.signature !== 'codex') continue;
    const chatGptRoot = nearestDirectAncestor(byPid, direct, entry, 'chatgpt');
    if (chatGptRoot === null) continue;
    chatGptRootsWithCodex.add(chatGptRoot);
    embeddedCodexPids.add(entry.pid);
  }
  if (chatGptRootsWithCodex.size === 0) return direct;
  const collapsed = new Map<number, AgentEvidence>();
  for (const [pid, evidence] of direct) {
    if ((evidence.signature.signature === 'chatgpt' && chatGptRootsWithCodex.has(pid))
      || (evidence.signature.signature === 'codex' && embeddedCodexPids.has(pid))) {
      collapsed.set(pid, asEmbeddedChatGptCodex(evidence));
    } else {
      collapsed.set(pid, evidence);
    }
  }
  return collapsed;
}

/**
 * Builds private process-tree evidence for the activity monitor. PIDs and raw
 * commands remain internal and are deliberately absent from public reports.
 */
export function classifyAgentProcessTrees(
  processes: ProcessEntry[],
  excludedRootPid: number | null = process.pid,
): ClassifiedAgentProcess[] {
  const excluded = excludedRootPid === null ? new Set<number>() : descendantsOf(processes, excludedRootPid);
  const byPid = new Map(processes.map((entry) => [entry.pid, entry]));
  const direct = new Map<number, AgentEvidence>();
  for (const entry of processes) {
    if (excluded.has(entry.pid)) continue;
    const evidence = classifyProcess(entry);
    if (evidence) direct.set(entry.pid, evidence);
  }
  const collapsedDirect = collapseEmbeddedOpenAiAppStack(processes, direct);

  const result: ClassifiedAgentProcess[] = [];
  for (const entry of processes) {
    if (excluded.has(entry.pid)) continue;
    let owner = collapsedDirect.get(entry.pid) ?? null;
    let relationship: ClassifiedAgentProcess['relationship'] = 'direct';
    if (!owner) {
      const visited = new Set<number>();
      let parentPid = entry.ppid;
      for (let depth = 0; parentPid !== undefined && parentPid > 0 && depth < 24; depth += 1) {
        if (visited.has(parentPid) || excluded.has(parentPid)) break;
        visited.add(parentPid);
        owner = collapsedDirect.get(parentPid) ?? null;
        if (owner) { relationship = 'descendant'; break; }
        parentPid = byPid.get(parentPid)?.ppid;
      }
    }
    if (!owner) continue;
    result.push({
      pid: entry.pid,
      ppid: entry.ppid ?? null,
      signature: owner.signature.signature,
      name: owner.signature.name,
      kind: owner.signature.kind,
      confidence: owner.confidence,
      relationship,
      cpu_percent: Number.isFinite(entry.cpu_percent) ? Math.max(0, Number(entry.cpu_percent)) : null,
      memory_percent: Number.isFinite(entry.memory_percent) ? Math.max(0, Number(entry.memory_percent)) : null,
      memory_bytes: Number.isFinite(entry.rss_bytes) ? Math.max(0, Number(entry.rss_bytes)) : null,
      cpu_time_ms: Number.isFinite(entry.cpu_time_ms) ? Math.max(0, Number(entry.cpu_time_ms)) : null,
      activity_signal: !isPassiveAppHelperProcess(entry),
    });
  }
  return result.sort((left, right) => left.signature.localeCompare(right.signature) || left.pid - right.pid);
}

export function parseMacosCpuTime(value: string): number | null {
  const match = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(value.trim());
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  if (![days, hours, minutes, seconds].every(Number.isFinite)) return null;
  return Math.round((((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000);
}

interface MacosProcessMetrics {
  cpuTimeMs: number;
  rssBytes: number;
}

async function macosProcessMetrics(): Promise<Map<number, MacosProcessMetrics>> {
  if (process.platform !== 'darwin') return new Map();
  try {
    const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,time=,rss='], {
      encoding: 'utf8',
      maxBuffer: 16_000_000,
      env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
    });
    const result = new Map<number, MacosProcessMetrics>();
    for (const line of stdout.split('\n')) {
      const match = /^\s*(\d+)\s+(\S+)\s+(\d+)\s*$/.exec(line);
      if (!match) continue;
      const value = parseMacosCpuTime(match[2]!);
      const rssKilobytes = Number(match[3]);
      if (value !== null && Number.isFinite(rssKilobytes)) {
        result.set(Number(match[1]), { cpuTimeMs: value, rssBytes: Math.max(0, rssKilobytes) * 1024 });
      }
    }
    return result;
  } catch {
    return new Map();
  }
}

function confidenceRank(confidence: Confidence): number {
  return confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
}

export function detectAgentProducts(processes: ProcessEntry[]): CensusAgent[] {
  const direct = new Map<number, AgentEvidence>();
  for (const process of processes) {
    const evidence = classifyProcess(process);
    if (evidence) direct.set(process.pid, evidence);
  }
  const collapsedDirect = collapseEmbeddedOpenAiAppStack(processes, direct);
  const grouped = new Map<string, AgentEvidence[]>();
  for (const evidence of collapsedDirect.values()) {
    grouped.set(evidence.signature.signature, [
      ...(grouped.get(evidence.signature.signature) ?? []),
      evidence,
    ]);
  }

  return [...grouped.entries()].map(([signature, evidence]) => {
    const definition = evidence[0]!.signature;
    const strongestEvidence = [...evidence]
      .sort((left, right) => confidenceRank(right.confidence) - confidenceRank(left.confidence))[0]!;
    const strongest = strongestEvidence.confidence;
    return {
      agent_id: stableId('agent', signature),
      name: definition.name,
      signature,
      kind: definition.kind,
      confidence: strongest,
      instance_count: evidence.length,
      executable_names: [...new Set(evidence.map((entry) => entry.executable))].sort(),
      evidence_hashes: [...new Set(evidence.map((entry) => entry.evidenceHash))].sort(),
      detection_reason: strongestEvidence.reason,
      evidence_status: 'online' as const,
      resource_snapshot: {
        cpu_percent: aggregateMetric(evidence.map((entry) => entry.cpuPercent)),
        memory_percent: aggregateMetric(evidence.map((entry) => entry.memoryPercent)),
        measurement: 'point-in-time-process-metadata' as const,
      },
    };
  }).sort((left, right) => left.name.localeCompare(right.name));
}

function aggregateMetric(values: Array<number | null>): number | null {
  const measured = values.filter((value): value is number => value !== null);
  if (measured.length === 0) return null;
  return Math.round(measured.reduce((total, value) => total + value, 0) * 10) / 10;
}

export async function listSystemProcesses(): Promise<ProcessEntry[]> {
  const dynamicImport = new Function('specifier', 'return import(specifier);') as (
    specifier: string,
  ) => Promise<{ default: () => Promise<Array<{ pid: number; ppid: number; name: string; cmd?: string; cpu?: number; memory?: number }>> }>;
  const imported = await dynamicImport('ps-list');
  const list = imported.default;
  const [processes, macosMetrics] = await Promise.all([list(), macosProcessMetrics()]);
  return processes.map((process) => ({
    pid: process.pid,
    ppid: process.ppid,
    name: process.name,
    ...(process.cmd !== undefined ? { cmd: process.cmd } : {}),
    ...(Number.isFinite(process.cpu) ? { cpu_percent: Number(process.cpu) } : {}),
    ...(Number.isFinite(process.memory) ? { memory_percent: Number(process.memory) } : {}),
    ...(macosMetrics.has(process.pid) ? {
      cpu_time_ms: macosMetrics.get(process.pid)!.cpuTimeMs,
      rss_bytes: macosMetrics.get(process.pid)!.rssBytes,
    } : {}),
  }));
}
