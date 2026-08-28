import fs from 'node:fs/promises';
import path from 'node:path';
import { defaultLocalStateDirectory } from './local-device';
import type { MonitorSnapshot } from './monitor';

export interface LastStoppedSummary {
  saved_at: string;
  observed_seconds: number;
  active_seconds: number;
  activity_ratio: number | null;
  active_tool: string | null;
  local_models_found: number;
  local_models_running: number;
  share_card_data?: {
    ratio: number | null;
    active_tool: string | null;
    local_models_found: number;
    local_models_running: number;
  };
}

export interface LocalObservationState {
  schema_version: '1.0';
  current_observation_id: number;
  started_at: string | null;
  observed_seconds: number;
  active_seconds: number;
  timeline_blocks: MonitorSnapshot['timeline'];
  detected_systems: Array<Pick<MonitorSnapshot['products'][number], 'signature' | 'name' | 'kind' | 'state' | 'active_seconds'>>;
  app_color_mapping: Record<string, string>;
  latest_insights: string[];
  last_stopped_summary: LastStoppedSummary | null;
  user_stopped: boolean;
  snapshot: MonitorSnapshot;
}

export function localObservationStatePath(stateDirectory = defaultLocalStateDirectory()): string {
  return path.join(stateDirectory, 'observation-state.json');
}

function stripSnapshot(snapshot: MonitorSnapshot): MonitorSnapshot {
  return {
    ...snapshot,
    lifecycle: 'stopped',
    stopped_at: snapshot.stopped_at ?? new Date().toISOString(),
    products: snapshot.products.map((product) => ({
      signature: product.signature,
      name: product.name,
      kind: product.kind,
      state: product.state,
      process_count: 0,
      cpu_percent: null,
      memory_percent: null,
      memory_bytes: null,
      recent_cpu_time_delta_ms: null,
      active_seconds: product.active_seconds,
      context: { chat: null, workspace: null, source: null },
    })),
    overhead: {
      current_cpu_percent: null,
      current_memory_bytes: 0,
      history_bytes: 0,
      sample_count: 0,
      median_cpu_percent: null,
      p95_cpu_percent: null,
      max_memory_bytes: 0,
      measurement: 'forkit-process-tree',
    },
  };
}

export async function loadLocalObservationState(stateDirectory?: string): Promise<LocalObservationState | null> {
  try {
    const value = JSON.parse(await fs.readFile(localObservationStatePath(stateDirectory), 'utf8')) as Partial<LocalObservationState>;
    if (value.schema_version !== '1.0' || !value.snapshot || value.snapshot.schema_version !== '1.0') return null;
    return value as LocalObservationState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return null;
  }
}

export async function saveLocalObservationState(
  snapshot: MonitorSnapshot,
  options: {
    latestInsights: string[];
    localModelsFound: number;
    localModelsRunning: number;
    appColorMapping?: Record<string, string>;
    userStopped?: boolean;
    lastStoppedSummary?: LastStoppedSummary | null;
    stateDirectory?: string;
  },
): Promise<LocalObservationState> {
  const previousLastStoppedSummary = options.lastStoppedSummary !== undefined
    ? options.lastStoppedSummary
    : (await loadLocalObservationState(options.stateDirectory))?.last_stopped_summary ?? null;
  const activeTool = snapshot.products
    .filter((product) => product.kind !== 'local-model-runtime' && (product.active_seconds > 0 || product.state === 'working-now'))
    .sort((left, right) => right.active_seconds - left.active_seconds || left.name.localeCompare(right.name))[0]?.name ?? null;
  const completedSummary: LastStoppedSummary | null = snapshot.lifecycle === 'stopped' && snapshot.observed_seconds > 0 ? {
    saved_at: new Date().toISOString(),
    observed_seconds: snapshot.observed_seconds,
    active_seconds: snapshot.active_seconds,
    activity_ratio: snapshot.activity_ratio,
    active_tool: activeTool,
    local_models_found: options.localModelsFound,
    local_models_running: options.localModelsRunning,
    share_card_data: {
      ratio: snapshot.activity_ratio,
      active_tool: activeTool,
      local_models_found: options.localModelsFound,
      local_models_running: options.localModelsRunning,
    },
  } : null;
  const lastStoppedSummary = completedSummary ?? previousLastStoppedSummary;
  const persistedSnapshot = stripSnapshot(snapshot);
  const state: LocalObservationState = {
    schema_version: '1.0',
    current_observation_id: snapshot.observation_id,
    started_at: snapshot.started_at,
    observed_seconds: snapshot.observed_seconds,
    active_seconds: snapshot.active_seconds,
    timeline_blocks: snapshot.timeline,
    detected_systems: snapshot.products.map((product) => ({
      signature: product.signature,
      name: product.name,
      kind: product.kind,
      state: product.state,
      active_seconds: product.active_seconds,
    })),
    app_color_mapping: options.appColorMapping ?? {},
    latest_insights: options.latestInsights,
    last_stopped_summary: lastStoppedSummary,
    user_stopped: options.userStopped ?? false,
    snapshot: persistedSnapshot,
  };
  const targetPath = localObservationStatePath(options.stateDirectory);
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporaryPath, targetPath);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
  return state;
}

export async function clearLocalObservationState(stateDirectory?: string): Promise<void> {
  try { await fs.unlink(localObservationStatePath(stateDirectory)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
