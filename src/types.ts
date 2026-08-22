export type Confidence = 'high' | 'medium' | 'low';

export type RuntimeKind = 'ollama' | 'lmstudio' | 'openai-compatible' | 'filesystem';

export type RuntimeStatus = 'available' | 'unavailable' | 'inventory-only';

export interface CensusRuntime {
  runtime_id: string;
  name: RuntimeKind;
  status: RuntimeStatus;
  endpoint: string | null;
  model_count: number;
  observed_at: string;
  error_code: string | null;
}

export interface CensusModel {
  model_id: string;
  name: string;
  runtime: RuntimeKind;
  identity_kind: 'content-sha256' | 'provider-id' | 'metadata-sha256';
  identity: string;
  size_bytes: number | null;
  modified_at: string | null;
  quantization: string | null;
  architecture: string | null;
  parameter_size: string | null;
  source: 'runtime-api' | 'filesystem';
  location_hint: string | null;
  confidence: Confidence;
}

export type AgentKind =
  | 'coding-agent'
  | 'ide-agent'
  | 'agent-framework'
  | 'mcp-server';

export interface CensusAgent {
  agent_id: string;
  name: string;
  signature: string;
  kind: AgentKind;
  confidence: Confidence;
  instance_count: number;
  executable_names: string[];
  evidence_hashes: string[];
  detection_reason: string;
}

export interface CensusWarning {
  code: string;
  message: string;
  scope: 'runtime' | 'model' | 'agent' | 'privacy' | 'system';
}

export interface CensusSummary {
  runtime_count: number;
  available_runtime_count: number;
  model_count: number;
  agent_product_count: number;
  agent_process_count: number;
  warning_count: number;
}

export interface CensusReport {
  schema_version: '1.0';
  product: 'forkit-census';
  product_version: string;
  census_id: string;
  generated_at: string;
  system: {
    platform: NodeJS.Platform;
    architecture: string;
    node_major: number;
  };
  privacy: {
    mode: 'metadata-only';
    raw_commands_collected: false;
    file_contents_collected: false;
    credentials_collected: false;
    remote_endpoints_allowed: false;
  };
  summary: CensusSummary;
  runtimes: CensusRuntime[];
  models: CensusModel[];
  agents: CensusAgent[];
  warnings: CensusWarning[];
}

export interface RuntimeScanResult {
  runtime: CensusRuntime;
  models: CensusModel[];
  warnings: CensusWarning[];
}

export interface RuntimeProvider {
  readonly name: RuntimeKind;
  scan(observedAt: string): Promise<RuntimeScanResult>;
}

export interface ProcessEntry {
  pid: number;
  ppid?: number;
  name?: string;
  cmd?: string;
}

export interface CensusOptions {
  includeRuntimes?: boolean;
  includeFilesystem?: boolean;
  includeAgents?: boolean;
  filesystemRoots?: string[];
  processEntries?: ProcessEntry[];
  providers?: RuntimeProvider[];
  now?: () => Date;
}
