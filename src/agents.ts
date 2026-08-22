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
}

const SIGNATURES: AgentSignature[] = [
  { signature: 'codex', name: 'Codex', kind: 'coding-agent', terms: ['codex'], executables: ['codex'] },
  { signature: 'claude', name: 'Claude Code', kind: 'coding-agent', terms: ['claude', 'claude-code'], executables: ['claude'] },
  { signature: 'aider', name: 'Aider', kind: 'coding-agent', terms: ['aider'], executables: ['aider'] },
  { signature: 'openhands', name: 'OpenHands', kind: 'coding-agent', terms: ['openhands'], executables: ['openhands'] },
  { signature: 'goose', name: 'Goose', kind: 'coding-agent', terms: ['goose'], executables: ['goose'] },
  { signature: 'cursor', name: 'Cursor', kind: 'ide-agent', terms: ['cursor'], executables: ['cursor'] },
  { signature: 'windsurf', name: 'Windsurf', kind: 'ide-agent', terms: ['windsurf'], executables: ['windsurf'] },
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

function tokens(value: string): Set<string> {
  const normalized = String(value || '').toLowerCase();
  const result = new Set(normalized.split(/[^a-z0-9_-]+/).filter(Boolean));
  for (const token of [...result]) {
    for (const part of token.split(/[._-]+/)) {
      if (part) result.add(part);
    }
  }
  return result;
}

function classifyProcess(entry: ProcessEntry): AgentEvidence | null {
  const processName = basename(entry.name ?? '');
  const command = String(entry.cmd ?? '');
  const firstCommandToken = command.trim().split(/\s+/)[0] ?? '';
  const executable = basename(firstCommandToken || processName) || 'unknown';
  const processTokens = tokens(processName);
  const commandTokens = tokens(command);

  for (const signature of SIGNATURES) {
    const executableMatch = signature.executables.includes(processName)
      || signature.executables.includes(executable);
    const termMatch = signature.terms.some((term) => commandTokens.has(term) || processTokens.has(term));
    if (!executableMatch && !termMatch) continue;
    const confidence: Confidence = executableMatch ? 'high' : 'medium';
    return {
      signature,
      confidence,
      executable,
      evidenceHash: sha256(`${signature.signature}:${processName}:${command}`),
      reason: executableMatch ? 'exact_executable_match' : 'exact_command_token_match',
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
    const strongest = evidence
      .map((entry) => entry.confidence)
      .sort((left, right) => confidenceRank(right) - confidenceRank(left))[0] ?? 'low';
    return {
      agent_id: stableId('agent', signature),
      name: definition.name,
      signature,
      kind: definition.kind,
      confidence: strongest,
      instance_count: evidence.length,
      executable_names: [...new Set(evidence.map((entry) => entry.executable))].sort(),
      evidence_hashes: [...new Set(evidence.map((entry) => entry.evidenceHash))].sort(),
      detection_reason: strongest === 'high' ? 'exact_executable_match' : 'exact_command_token_match',
    };
  }).sort((left, right) => left.name.localeCompare(right.name));
}

export async function listSystemProcesses(): Promise<ProcessEntry[]> {
  const dynamicImport = new Function('specifier', 'return import(specifier);') as (
    specifier: string,
  ) => Promise<{ default: () => Promise<Array<{ pid: number; ppid: number; name: string; cmd?: string }>> }>;
  const imported = await dynamicImport('ps-list');
  const list = imported.default;
  const processes = await list();
  return processes.map((process) => ({
    pid: process.pid,
    ppid: process.ppid,
    name: process.name,
    ...(process.cmd !== undefined ? { cmd: process.cmd } : {}),
  }));
}
