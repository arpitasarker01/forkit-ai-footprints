import path from 'node:path';
import type { ClassifiedAgentProcess } from './agents';
import type { ProcessEntry, RuntimeProvider } from './types';

function basename(value: string): string {
  return path.basename(String(value || '').replaceAll('\\', '/')).toLowerCase().replace(/\.exe$/i, '');
}

export async function loadedRuntimeSignatures(providers: RuntimeProvider[], observedAt: string): Promise<Set<string>> {
  const loaded = new Set<string>();
  const results = await Promise.all(providers.map(async (provider) => {
    try { return await provider.scan(observedAt); } catch { return null; }
  }));
  for (const result of results) {
    if (!result) continue;
    if (result.models.some((model) => model.evidence_status === 'confirmed-running')) loaded.add(result.runtime.name);
  }
  return loaded;
}

export function classifyLoadedRuntimeProcesses(
  processes: ProcessEntry[],
  loaded: Set<string>,
  excludedRootPid: number | null = process.pid,
): ClassifiedAgentProcess[] {
  const definitions = [
    { signature: 'runtime:ollama', runtime: 'ollama', name: 'Ollama', executables: ['ollama'] },
    { signature: 'runtime:lmstudio', runtime: 'lmstudio', name: 'LM Studio', executables: ['lm studio', 'lmstudio'] },
  ];
  const excluded = new Set<number>();
  if (excludedRootPid !== null) {
    excluded.add(excludedRootPid);
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of processes) if (!excluded.has(entry.pid) && entry.ppid !== undefined && excluded.has(entry.ppid)) { excluded.add(entry.pid); changed = true; }
    }
  }
  const result: ClassifiedAgentProcess[] = [];
  for (const entry of processes) {
    if (excluded.has(entry.pid)) continue;
    const executable = basename(entry.name || String(entry.cmd || '').split(/\s+/)[0] || '');
    const definition = definitions.find((candidate) => loaded.has(candidate.runtime) && candidate.executables.includes(executable));
    if (!definition) continue;
    result.push({
      pid: entry.pid, ppid: entry.ppid ?? null, signature: definition.signature, name: definition.name,
      kind: 'local-model-runtime', confidence: 'high', relationship: 'direct',
      cpu_percent: Number.isFinite(entry.cpu_percent) ? Number(entry.cpu_percent) : null,
      memory_percent: Number.isFinite(entry.memory_percent) ? Number(entry.memory_percent) : null,
      memory_bytes: Number.isFinite(entry.rss_bytes) ? Number(entry.rss_bytes) : null,
      cpu_time_ms: Number.isFinite(entry.cpu_time_ms) ? Number(entry.cpu_time_ms) : null,
    });
  }
  return result;
}
