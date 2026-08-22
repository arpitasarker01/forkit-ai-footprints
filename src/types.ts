export type Confidence = 'high' | 'medium' | 'low';
export type EvidenceStatus = 'discovered' | 'configured' | 'online' | 'confirmed-running';

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
  evidence_status: 'configured' | 'online' | 'unavailable';
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
  evidence_status: 'discovered' | 'confirmed-running';
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
  evidence_status: 'online';
  resource_snapshot: {
    cpu_percent: number | null;
    memory_percent: number | null;
    measurement: 'point-in-time-process-metadata';
  };
}

export interface CensusTool {
  tool_id: string;
  name: string;
  evidence_status: 'configured' | 'online';
  confidence: Confidence;
  detector_types: Array<'config' | 'executable' | 'process'>;
  instance_count: number;
}

export interface CensusMcpConfig {
  client: string;
  evidence_status: 'configured';
  confidence: Confidence;
  server_count: number;
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
  agent_cpu_percent: number | null;
  agent_memory_percent: number | null;
  tool_count: number;
  mcp_config_count: number;
  confirmed_running_model_count: number;
  storage_bytes: number;
  storage_bucket: string;
  warning_count: number;
}

export interface CensusReport {
  schema_version: '1.2';
  product: 'forkit-ai-footprints';
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
    raw_commands_retained: false;
    model_file_contents_read: false;
    config_values_emitted: false;
    sensitive_content_retained: false;
    remote_endpoints_allowed: false;
    external_requests_made: 0;
    backend_contacted: false;
    account_read: false;
    local_state_written: false;
  };
  summary: CensusSummary;
  runtimes: CensusRuntime[];
  models: CensusModel[];
  agents: CensusAgent[];
  tools: CensusTool[];
  mcp_configs: CensusMcpConfig[];
  guess: {
    provided: number | null;
    discovered: number;
    difference: number | null;
  };
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
  cpu_percent?: number;
  memory_percent?: number;
}

export interface CensusOptions {
  includeRuntimes?: boolean;
  includeFilesystem?: boolean;
  includeAgents?: boolean;
  includeTools?: boolean;
  includeMcp?: boolean;
  filesystemRoots?: string[];
  processEntries?: ProcessEntry[];
  providers?: RuntimeProvider[];
  now?: () => Date;
  guess?: number | null;
  homeDir?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  architecture?: string;
}
