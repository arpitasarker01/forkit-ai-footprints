import { execFileSync } from 'node:child_process';
import type { MonitorSnapshot } from './monitor';
import type { CensusReport } from './types';

export const MINIMUM_COMPARISON_SECONDS = 600;

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
  observation: { valid_seconds: number; ai_active_seconds: number; activity_ratio: number };
  counts: {
    supported_apps_observed_working: number;
    supported_app_categories: string[];
    local_models_discovered: number;
    local_models_loaded: number;
    verified_local_runtimes_available: number;
  };
  model_storage_bytes: number;
  system: { platform: 'darwin'; architecture: string; os_major: number };
  versions: { scanner: string; node_major: number; monitor_schema: '1.0' };
}

export function buildAnonymousAiFootprintPreview(
  report: CensusReport,
  monitor: MonitorSnapshot,
  options: { osMajor?: number } = {},
): AnonymousAiFootprintContribution {
  if (report.system.platform !== 'darwin') throw new Error('ANONYMOUS_FOOTPRINT_MACOS_REQUIRED');
  if (!report.summary.storage_complete) throw new Error('ANONYMOUS_FOOTPRINT_STORAGE_INCOMPLETE');
  if (monitor.observed_seconds < MINIMUM_COMPARISON_SECONDS) throw new Error('ANONYMOUS_FOOTPRINT_MINIMUM_OBSERVATION_REQUIRED');
  if (monitor.active_seconds < 0 || monitor.active_seconds > monitor.observed_seconds) throw new Error('ANONYMOUS_FOOTPRINT_INVALID_ACTIVITY_DURATION');
  const validSeconds = Math.floor(monitor.observed_seconds);
  const activeSeconds = Math.min(validSeconds, Math.floor(monitor.active_seconds));
  const workingProducts = monitor.products.filter((product) => product.active_seconds > 0);
  return {
    schema_version: '2.0',
    observation: {
      valid_seconds: validSeconds,
      ai_active_seconds: activeSeconds,
      activity_ratio: validSeconds === 0 ? 0 : Math.round((activeSeconds / validSeconds) * 1000) / 1000,
    },
    counts: {
      supported_apps_observed_working: workingProducts.length,
      supported_app_categories: [...new Set(workingProducts.map((product) => product.kind))].sort(),
      local_models_discovered: report.summary.model_count,
      local_models_loaded: report.summary.confirmed_running_model_count,
      verified_local_runtimes_available: report.summary.available_runtime_count,
    },
    model_storage_bytes: report.summary.storage_bytes,
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
