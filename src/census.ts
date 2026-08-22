import os from 'node:os';
import path from 'node:path';
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
import { detectAiTools } from './tools';
import { detectMcpConfigs } from './mcp';

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
      evidence_status: 'unavailable',
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

function storageBucket(bytes: number): string {
  const gib = bytes / (1024 ** 3);
  if (gib === 0) return '0 GB';
  if (gib < 1) return '<1 GB';
  if (gib < 10) return '1-10 GB';
  if (gib < 50) return '10-50 GB';
  if (gib < 100) return '50-100 GB';
  if (gib < 500) return '100-500 GB';
  return '500+ GB';
}

export async function runCensus(options: CensusOptions = {}): Promise<CensusReport> {
  const generatedAt = (options.now ?? (() => new Date()))().toISOString();
  const includeRuntimes = options.includeRuntimes !== false;
  const includeFilesystem = options.includeFilesystem !== false;
  const includeAgents = options.includeAgents !== false;
  const includeTools = options.includeTools !== false;
  const includeMcp = options.includeMcp !== false;
  const homeDir = options.homeDir ?? os.homedir();
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
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
  const agentCpuMeasurements = agents.flatMap((agent) => agent.resource_snapshot.cpu_percent === null
    ? []
    : [agent.resource_snapshot.cpu_percent]);
  const agentMemoryMeasurements = agents.flatMap((agent) => agent.resource_snapshot.memory_percent === null
    ? []
    : [agent.resource_snapshot.memory_percent]);
  const [tools, mcpConfigs] = await Promise.all([
    includeTools ? detectAiTools({ homeDir, env, platform, agents }) : Promise.resolve([]),
    includeMcp ? detectMcpConfigs({ homeDir, cwd: path.resolve(cwd), env, platform }) : Promise.resolve([]),
  ]);
  const storageBytes = models.reduce((total, model) => total + Number(model.size_bytes ?? 0), 0);
  const guessed = options.guess === undefined || options.guess === null
    ? null
    : Math.max(0, Math.floor(options.guess));

  return {
    schema_version: SCHEMA_VERSION,
    product: PRODUCT_NAME,
    product_version: PRODUCT_VERSION,
    census_id: buildCensusId(generatedAt, runtimes, models, agents),
    generated_at: generatedAt,
    system: {
      platform,
      architecture: options.architecture ?? os.arch(),
      node_major: Number(process.versions.node.split('.')[0] ?? 0),
    },
    privacy: {
      mode: 'metadata-only',
      raw_commands_retained: false,
      model_file_contents_read: false,
      config_values_emitted: false,
      sensitive_content_retained: false,
      remote_endpoints_allowed: false,
      external_requests_made: 0,
      backend_contacted: false,
      account_read: false,
      local_state_written: false,
    },
    summary: {
      runtime_count: runtimes.length,
      available_runtime_count: runtimes.filter((runtime) => runtime.status === 'available').length,
      model_count: models.length,
      agent_product_count: agents.length,
      agent_process_count: processCount,
      agent_cpu_percent: agentCpuMeasurements.length === 0
        ? null
        : Math.round(agentCpuMeasurements.reduce((total, value) => total + value, 0) * 10) / 10,
      agent_memory_percent: agentMemoryMeasurements.length === 0
        ? null
        : Math.round(agentMemoryMeasurements.reduce((total, value) => total + value, 0) * 10) / 10,
      tool_count: tools.length,
      mcp_config_count: mcpConfigs.length,
      confirmed_running_model_count: models.filter((model) => model.evidence_status === 'confirmed-running').length,
      storage_bytes: storageBytes,
      storage_bucket: storageBucket(storageBytes),
      warning_count: warnings.length,
    },
    runtimes,
    models,
    agents,
    tools,
    mcp_configs: mcpConfigs,
    guess: {
      provided: guessed,
      discovered: models.length,
      difference: guessed === null ? null : models.length - guessed,
    },
    warnings,
  };
}
