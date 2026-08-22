import os from 'node:os';
import { detectAgentProducts, listSystemProcesses } from './agents';
import { scanFilesystemModels } from './filesystem';
import { stableId } from './hash';
import { createDefaultProviders } from './providers';
import type {
  CensusAgent,
  CensusModel,
  CensusOptions,
  CensusReport,
  CensusRuntime,
  CensusWarning,
  RuntimeScanResult,
} from './types';
import { PRODUCT_NAME, PRODUCT_VERSION, SCHEMA_VERSION } from './version';

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) seen.set(key(item), item);
  return [...seen.values()];
}

function safeProviderFailure(name: string, observedAt: string): RuntimeScanResult {
  return {
    runtime: {
      runtime_id: stableId('runtime', `provider-failure:${name}`),
      name: name === 'ollama' || name === 'lmstudio' || name === 'filesystem'
        ? name
        : 'openai-compatible',
      status: 'unavailable',
      endpoint: null,
      model_count: 0,
      observed_at: observedAt,
      error_code: 'provider_scan_failed',
    },
    models: [],
    warnings: [{
      code: 'provider_scan_failed',
      message: `${name} could not be inspected. No raw provider error was retained.`,
      scope: 'runtime',
    }],
  };
}

function sortRuntimes(runtimes: CensusRuntime[]): CensusRuntime[] {
  return [...runtimes].sort((left, right) => {
    const name = left.name.localeCompare(right.name);
    return name !== 0 ? name : String(left.endpoint).localeCompare(String(right.endpoint));
  });
}

function sortModels(models: CensusModel[]): CensusModel[] {
  return [...models].sort((left, right) => {
    const runtime = left.runtime.localeCompare(right.runtime);
    return runtime !== 0 ? runtime : left.name.localeCompare(right.name);
  });
}

function buildCensusId(
  generatedAt: string,
  runtimes: CensusRuntime[],
  models: CensusModel[],
  agents: CensusAgent[],
): string {
  const evidence = [
    generatedAt,
    ...runtimes.map((runtime) => runtime.runtime_id),
    ...models.map((model) => model.model_id),
    ...agents.map((agent) => agent.agent_id),
  ].join('|');
  return stableId('census', evidence);
}

export async function runCensus(options: CensusOptions = {}): Promise<CensusReport> {
  const generatedAt = (options.now ?? (() => new Date()))().toISOString();
  const includeRuntimes = options.includeRuntimes !== false;
  const includeFilesystem = options.includeFilesystem !== false;
  const includeAgents = options.includeAgents !== false;
  const providers = options.providers ?? createDefaultProviders();
  const providerResults = includeRuntimes
    ? await Promise.all(providers.map(async (provider) => {
      try {
        return await provider.scan(generatedAt);
      } catch {
        return safeProviderFailure(provider.name, generatedAt);
      }
    }))
    : [];

  const filesystemResult = includeFilesystem
    ? await scanFilesystemModels(generatedAt, options.filesystemRoots
      ? { roots: options.filesystemRoots }
      : {})
    : null;

  const warnings: CensusWarning[] = [
    ...providerResults.flatMap((result) => result.warnings),
    ...(filesystemResult?.warnings ?? []),
  ];
  let agents: CensusAgent[] = [];
  if (includeAgents) {
    try {
      const processes = options.processEntries ?? await listSystemProcesses();
      agents = detectAgentProducts(processes);
    } catch {
      warnings.push({
        code: 'process_inventory_unavailable',
        message: 'Local process inventory was unavailable. No raw process error was retained.',
        scope: 'agent',
      });
    }
  }

  const runtimes = sortRuntimes(uniqueBy([
    ...providerResults.map((result) => result.runtime),
    ...(filesystemResult ? [filesystemResult.runtime] : []),
  ], (runtime) => runtime.runtime_id));
  const models = sortModels(uniqueBy([
    ...providerResults.flatMap((result) => result.models),
    ...(filesystemResult?.models ?? []),
  ], (model) => model.model_id));
  const processCount = agents.reduce((total, agent) => total + agent.instance_count, 0);

  return {
    schema_version: SCHEMA_VERSION,
    product: PRODUCT_NAME,
    product_version: PRODUCT_VERSION,
    census_id: buildCensusId(generatedAt, runtimes, models, agents),
    generated_at: generatedAt,
    system: {
      platform: process.platform,
      architecture: os.arch(),
      node_major: Number(process.versions.node.split('.')[0] ?? 0),
    },
    privacy: {
      mode: 'metadata-only',
      raw_commands_collected: false,
      file_contents_collected: false,
      credentials_collected: false,
      remote_endpoints_allowed: false,
    },
    summary: {
      runtime_count: runtimes.length,
      available_runtime_count: runtimes.filter((runtime) => runtime.status !== 'unavailable').length,
      model_count: models.length,
      agent_product_count: agents.length,
      agent_process_count: processCount,
      warning_count: warnings.length,
    },
    runtimes,
    models,
    agents,
    warnings,
  };
}
