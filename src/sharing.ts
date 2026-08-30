import { execFileSync } from 'node:child_process';
import type { MonitorSnapshot } from './monitor';
import type { CensusReport } from './types';

/** A consented installation joins the community Preview after ten valid minutes. */
export const MINIMUM_GLOBAL_CONTRIBUTION_SECONDS = 10 * 60;
/** @deprecated Use MINIMUM_GLOBAL_CONTRIBUTION_SECONDS for Preview eligibility. */
export const MINIMUM_COMPARISON_SECONDS = MINIMUM_GLOBAL_CONTRIBUTION_SECONDS;

function macosMajorVersion(): number {
  try {
    const productVersion = execFileSync('/usr/bin/sw_vers', ['-productVersion'], {
      encoding: 'utf8',
      timeout: 2_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const major = Number(productVersion.split('.')[0]);
    return Number.isInteger(major) && major > 0 ? major : 0;
  } catch {
    return 0;
  }
}

export interface AnonymousAiFootprintContribution {
  schema_version: '2.0';
  observation: { valid_seconds: number; ai_active_seconds: number; activity_ratio: number; longest_active_block_seconds: number };
  counts: {
    supported_apps_observed_working: number;
    supported_app_categories: string[];
    local_models_discovered: number;
    local_models_loaded: number;
    verified_local_runtimes_available: number;
  };
  model_storage_bytes: number;
  hosted_active_seconds: number;
  local_active_seconds: number;
  system_active_seconds: Record<string, number>;
  privacy: {
    consent_version: 'ai-footprints-global-preview-v3';
    location_mode: 'none';
    country_code: null;
    region_code: null;
    map_cell: null;
  };
  system: { platform: 'darwin'; architecture: string; os_major: number };
  versions: { scanner: string; node_major: number; monitor_schema: '1.0' };
}

function longestActiveBlockSeconds(monitor: MonitorSnapshot): number {
  const toleranceMs = Math.max(1, monitor.sample_interval_ms) * 3;
  let currentStart: number | null = null;
  let currentEnd: number | null = null;
  let currentObservation: number | null = null;
  let longestMs = 0;
  for (const segment of [...monitor.timeline].sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at))) {
    const start = Date.parse(segment.started_at);
    const end = Date.parse(segment.ended_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const observationId = segment.observation_id ?? monitor.observation_id;
    if (segment.state !== 'working-now') {
      if (currentStart !== null && currentEnd !== null) longestMs = Math.max(longestMs, currentEnd - currentStart);
      currentStart = null;
      currentEnd = null;
      currentObservation = null;
      continue;
    }
    const continues = currentStart !== null
      && currentEnd !== null
      && currentObservation === observationId
      && start - currentEnd <= toleranceMs;
    if (continues && currentEnd !== null) currentEnd = Math.max(currentEnd, end);
    else {
      if (currentStart !== null && currentEnd !== null) longestMs = Math.max(longestMs, currentEnd - currentStart);
      currentStart = start;
      currentEnd = end;
      currentObservation = observationId;
    }
  }
  if (currentStart !== null && currentEnd !== null) longestMs = Math.max(longestMs, currentEnd - currentStart);
  return Math.floor(longestMs / 1000);
}

export function buildAnonymousAiFootprintPreview(
  report: CensusReport,
  monitor: MonitorSnapshot,
  options: { osMajor?: number } = {},
): AnonymousAiFootprintContribution {
  if (report.system.platform !== 'darwin') throw new Error('ANONYMOUS_FOOTPRINT_MACOS_REQUIRED');
  if (!report.summary.storage_complete) throw new Error('ANONYMOUS_FOOTPRINT_STORAGE_INCOMPLETE');
  if (monitor.observed_seconds < MINIMUM_GLOBAL_CONTRIBUTION_SECONDS) throw new Error('ANONYMOUS_FOOTPRINT_MINIMUM_OBSERVATION_REQUIRED');
  if (monitor.active_seconds < 0 || monitor.active_seconds > monitor.observed_seconds) throw new Error('ANONYMOUS_FOOTPRINT_INVALID_ACTIVITY_DURATION');
  const validSeconds = Math.floor(monitor.observed_seconds);
  const activeSeconds = Math.min(validSeconds, Math.floor(monitor.active_seconds));
  const workingProducts = monitor.products.filter((product) => product.active_seconds > 0);
  const systemActiveSeconds: Record<string, number> = {};
  for (const product of workingProducts) {
    const key = product.kind;
    systemActiveSeconds[key] = (systemActiveSeconds[key] ?? 0) + Math.floor(product.active_seconds);
  }
  const localActiveSeconds = workingProducts
    .filter((product) => product.kind === 'local-model-runtime')
    .reduce((sum, product) => sum + Math.floor(product.active_seconds), 0);
  const hostedActiveSeconds = Math.max(0, activeSeconds - localActiveSeconds);
  return {
    schema_version: '2.0',
    observation: {
      valid_seconds: validSeconds,
      ai_active_seconds: activeSeconds,
      activity_ratio: validSeconds === 0 ? 0 : Math.round((activeSeconds / validSeconds) * 1000) / 1000,
      longest_active_block_seconds: longestActiveBlockSeconds(monitor),
    },
    counts: {
      supported_apps_observed_working: workingProducts.length,
      supported_app_categories: [...new Set(workingProducts.map((product) => product.kind))].sort(),
      local_models_discovered: report.summary.model_count,
      local_models_loaded: report.summary.confirmed_running_model_count,
      verified_local_runtimes_available: report.summary.available_runtime_count,
    },
    model_storage_bytes: report.summary.storage_bytes,
    hosted_active_seconds: hostedActiveSeconds,
    local_active_seconds: Math.min(activeSeconds, localActiveSeconds),
    system_active_seconds: systemActiveSeconds,
    privacy: {
      consent_version: 'ai-footprints-global-preview-v3',
      location_mode: 'none',
      country_code: null,
      region_code: null,
      map_cell: null,
    },
    system: {
      platform: 'darwin',
      architecture: report.system.architecture,
      os_major: options.osMajor ?? macosMajorVersion(),
    },
    versions: {
      scanner: report.product_version,
      node_major: report.system.node_major,
      monitor_schema: monitor.schema_version,
    },
  };
}

/** Consent is separate from local preview construction. This never uploads. */
export function authorizeAnonymousAiFootprintContribution(
  payload: AnonymousAiFootprintContribution,
  consent: boolean,
): AnonymousAiFootprintContribution {
  if (!consent) throw new Error('ANONYMOUS_FOOTPRINT_CONSENT_REQUIRED');
  return payload;
}
