export type ResourceEvidenceState = 'measured' | 'hardware-fact' | 'not-available';
export type AttributionStrength = 'detected-process-window' | 'device' | 'none';

export interface ResourceEvidenceCapability {
  metric: 'cpu' | 'memory' | 'gpu' | 'hardware' | 'network_traffic';
  state: ResourceEvidenceState;
  attribution: AttributionStrength;
  source: string;
  exclusive_task_proof: false;
  limitation: string;
}

export interface ResourceEvidenceManifest {
  schema_version: '1.0';
  platform: 'macos';
  capabilities: ResourceEvidenceCapability[];
}

export function macosResourceEvidenceManifest(): ResourceEvidenceManifest {
  return {
    schema_version: '1.0',
    platform: 'macos',
    capabilities: [
      {
        metric: 'cpu',
        state: 'measured',
        attribution: 'detected-process-window',
        source: 'operating-system-process-sample',
        exclusive_task_proof: false,
        limitation: 'Detected process work is measured; concurrent background work inside the same process can be included.',
      },
      {
        metric: 'memory',
        state: 'measured',
        attribution: 'detected-process-window',
        source: 'operating-system-process-sample',
        exclusive_task_proof: false,
        limitation: 'Memory is shared and may persist across tasks; the window cannot prove which task owns every byte.',
      },
      {
        metric: 'gpu',
        state: 'not-available',
        attribution: 'none',
        source: 'no-supported-cross-process-proof-source',
        exclusive_task_proof: false,
        limitation: 'Metal counters can measure work submitted by an instrumented app, not arbitrary third-party AI process work as exclusive task proof.',
      },
      {
        metric: 'hardware',
        state: 'hardware-fact',
        attribution: 'device',
        source: 'operating-system-hardware-metadata',
        exclusive_task_proof: false,
        limitation: 'Hardware inventory identifies device capability; it does not prove task-specific utilization.',
      },
      {
        metric: 'network_traffic',
        state: 'not-available',
        attribution: 'none',
        source: 'no-supported-per-process-proof-source-integrated',
        exclusive_task_proof: false,
        limitation: 'The current release does not use privileged packet inspection or unsupported per-process network APIs.',
      },
    ],
  };
}
