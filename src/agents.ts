import path from 'node:path';
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

const SIGNATURES: AgentSignature[] = [
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

function basename(value: string): string {
  const normalized = String(value || '').replaceAll('\\', '/');
  return path.posix.basename(normalized).toLowerCase().replace(/\.exe$/i, '');
}

function commandParts(value: string): string[] {
  return String(value || '')
    .match(/"[^"]*"|'[^']*'|\S+/g)
    ?.map((part) => part.replace(/^(?:"|')|(?:"|')$/g, '')) ?? [];
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

function classifyProcess(entry: ProcessEntry): AgentEvidence | null {
  const processName = basename(entry.name ?? '');
  const command = String(entry.cmd ?? '');
  const parts = commandParts(command);
  const firstCommandToken = parts[0] ?? '';
  const executable = basename(firstCommandToken || processName) || 'unknown';
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

function confidenceRank(confidence: Confidence): number {
  return confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
}

export function detectAgentProducts(processes: ProcessEntry[]): CensusAgent[] {
  const grouped = new Map<string, AgentEvidence[]>();
  for (const process of processes) {
    const evidence = classifyProcess(process);
    if (!evidence) continue;
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
  const processes = await list();
  return processes.map((process) => ({
    pid: process.pid,
    ppid: process.ppid,
    name: process.name,
    ...(process.cmd !== undefined ? { cmd: process.cmd } : {}),
    ...(Number.isFinite(process.cpu) ? { cpu_percent: Number(process.cpu) } : {}),
    ...(Number.isFinite(process.memory) ? { memory_percent: Number(process.memory) } : {}),
  }));
}
