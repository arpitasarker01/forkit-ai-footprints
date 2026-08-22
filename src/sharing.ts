import type { CensusReport } from './types';

export interface AnonymousCensusContribution {
  schema_version: '1.0';
  system: {
    platform: NodeJS.Platform;
    architecture: string;
  };
  counts: {
    runtimes_online: number;
    models_discovered: number;
    models_confirmed_running: number;
    ai_tools: number;
    mcp_configs: number;
  };
  storage_bucket: string;
  guess: number | null;
  detector_types: string[];
  versions: {
    census: string;
    node_major: number;
  };
}

/** Builds an allowlisted aggregate only after a distinct, explicit consent. It never uploads. */
export function buildAnonymousCensusContribution(
  report: CensusReport,
  consent: boolean,
): AnonymousCensusContribution {
  if (!consent) throw new Error('ANONYMOUS_CENSUS_CONSENT_REQUIRED');
  const detectorTypes = new Set<string>();
  if (report.runtimes.some((runtime) => runtime.evidence_status === 'online')) detectorTypes.add('runtime-api');
  if (report.models.some((model) => model.source === 'filesystem')) detectorTypes.add('filesystem-metadata');
  if (report.agents.length > 0) detectorTypes.add('process-signature');
  for (const tool of report.tools) {
    for (const type of tool.detector_types) detectorTypes.add(`tool-${type}`);
  }
  if (report.mcp_configs.length > 0) detectorTypes.add('mcp-config-count');
  return {
    schema_version: '1.0',
    system: {
      platform: report.system.platform,
      architecture: report.system.architecture,
    },
    counts: {
      runtimes_online: report.summary.available_runtime_count,
      models_discovered: report.summary.model_count,
      models_confirmed_running: report.summary.confirmed_running_model_count,
      ai_tools: report.summary.tool_count,
      mcp_configs: report.summary.mcp_config_count,
    },
    storage_bucket: report.summary.storage_bucket,
    guess: report.guess.provided,
    detector_types: [...detectorTypes].sort(),
    versions: {
      census: report.product_version,
      node_major: report.system.node_major,
    },
  };
}
