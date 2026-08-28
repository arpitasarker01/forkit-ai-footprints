import fs from 'node:fs';
import path from 'node:path';
import { renderActivityApplicationPage } from './activity-page';
import type { CensusReport } from './types';
import type { UiLocale } from './localization';

export interface CensusShareSnapshot {
  generated_date: string;
  architecture_label: string;
  model_record_count: number;
  verified_runtime_count: number;
  detected_agent_product_count: number;
  detected_agent_process_count: number;
  confirmed_running_model_count: number;
  model_storage_bytes: number;
  model_storage_decimal_display: string;
  model_storage_binary_display: string;
  model_storage_display: string;
  model_storage_file_count: number;
  model_storage_complete: boolean;
  model_storage_measurement: 'recognized-logical-file-bytes';
  external_request_count: 0;
  product_version: string;
  node_major: number;
}

export interface CensusLocalDetails {
  agents: Array<{ name: string; kind: string; process_count: number }>;
  runtimes: Array<{ name: string; model_count: number; loaded_model_count: number }>;
  models: Array<{ name: string; source: string; loaded: boolean }>;
  tools: Array<{ name: string; status: 'configured' | 'online' }>;
  technical: {
    runtime_probes: Array<{ name: string; state: string; error_code: string | null }>;
    warnings: Array<{ code: string; message: string }>;
  };
}

export interface LocalScanView extends CensusShareSnapshot { local_details: CensusLocalDetails }

export interface LocalRescanOptions {
  endpoint: string;
  monitor_start_endpoint: string;
  monitor_stop_endpoint: string;
  monitor_stream_endpoint: string;
  monitor_clear_endpoint: string;
  contribution_preview_endpoint: string;
  locale_endpoint: string;
  session_token: string;
  global_permission?: 'granted' | 'declined' | 'unset';
}

export interface AiFootprintPageOptions { rescan?: LocalRescanOptions; localDeviceLabel?: string; locale?: UiLocale }

function formatDecimalStorage(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes; let unit = 0;
  while (unit < units.length - 1 && value >= 1000) { value /= 1000; unit += 1; }
  return `${value.toFixed(value < 10 && unit > 1 ? 2 : value < 100 ? 1 : 0)} ${units[unit]}`;
}

function formatBinaryStorage(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let value = bytes; let unit = 0;
  while (unit < units.length - 1 && value >= 1024) { value /= 1024; unit += 1; }
  return `${value.toFixed(value < 10 && unit > 1 ? 2 : value < 100 ? 1 : 0)} ${units[unit]}`;
}

function validateRescanOptions(rescan: LocalRescanOptions): void {
  for (const value of [rescan.endpoint, rescan.monitor_start_endpoint, rescan.monitor_stop_endpoint, rescan.monitor_stream_endpoint, rescan.monitor_clear_endpoint, rescan.contribution_preview_endpoint, rescan.locale_endpoint]) {
    if (!value.startsWith('/') || value.startsWith('//')) throw new Error('INVALID_LOCAL_RESCAN_OPTIONS');
  }
  if (!/^[a-f0-9]{48}$/.test(rescan.session_token)) throw new Error('INVALID_LOCAL_RESCAN_OPTIONS');
}

function runtimeLabel(name: string): string {
  if (name === 'ollama') return 'Ollama';
  if (name === 'lmstudio') return 'LM Studio';
  if (name === 'openai-compatible') return 'OpenAI-compatible';
  return name;
}

function sourceLabel(model: CensusReport['models'][number]): string {
  if (model.runtime === 'ollama') return 'Ollama';
  if (model.runtime === 'lmstudio') return 'LM Studio';
  if (model.location_hint === 'huggingface-cache') return 'Hugging Face cache';
  return model.source === 'filesystem' ? 'Local model files' : runtimeLabel(model.runtime);
}

function iconDataUrl(file: string): string | null {
  try { return `data:image/png;base64,${fs.readFileSync(path.join(__dirname, 'assets', file)).toString('base64')}`; }
  catch { return null; }
}

export function buildCensusShareSnapshot(report: CensusReport): CensusShareSnapshot {
  const decimal = formatDecimalStorage(report.summary.storage_bytes);
  const binary = formatBinaryStorage(report.summary.storage_bytes);
  return {
    generated_date: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(report.generated_at)),
    architecture_label: report.system.architecture === 'arm64' ? 'Apple Silicon' : report.system.architecture === 'x64' ? 'Intel Mac' : report.system.architecture,
    model_record_count: report.summary.model_count,
    verified_runtime_count: report.summary.available_runtime_count,
    detected_agent_product_count: report.summary.agent_product_count,
    detected_agent_process_count: report.summary.agent_process_count,
    confirmed_running_model_count: report.summary.confirmed_running_model_count,
    model_storage_bytes: report.summary.storage_bytes,
    model_storage_decimal_display: decimal,
    model_storage_binary_display: binary,
    model_storage_display: decimal === binary ? decimal : `${decimal} · ${binary}`,
    model_storage_file_count: report.summary.storage_file_count,
    model_storage_complete: report.summary.storage_complete,
    model_storage_measurement: report.summary.storage_measurement,
    external_request_count: report.privacy.external_requests_made,
    product_version: report.product_version,
    node_major: report.system.node_major,
  };
}

export function buildLocalScanView(report: CensusReport): LocalScanView {
  return {
    ...buildCensusShareSnapshot(report),
    local_details: {
      agents: report.agents.map((agent) => ({ name: agent.name, kind: agent.kind, process_count: agent.instance_count })),
      runtimes: report.runtimes.filter((runtime) => runtime.name !== 'filesystem' && runtime.status === 'available').map((runtime) => ({
        name: runtimeLabel(runtime.name), model_count: runtime.model_count,
        loaded_model_count: report.models.filter((model) => model.runtime === runtime.name && model.evidence_status === 'confirmed-running').length,
      })),
      models: report.models.map((model) => ({ name: model.name, source: sourceLabel(model), loaded: model.evidence_status === 'confirmed-running' })),
      tools: report.tools.map((tool) => ({ name: tool.name, status: tool.evidence_status })),
      technical: {
        runtime_probes: report.runtimes.filter((runtime) => runtime.name !== 'filesystem').map((runtime) => ({ name: runtimeLabel(runtime.name), state: runtime.evidence_status, error_code: runtime.error_code })),
        warnings: report.warnings.map((warning) => ({ code: warning.code, message: warning.message })),
      },
    },
  };
}

export function renderCensusSharePage(report: CensusReport, options: AiFootprintPageOptions = {}): string {
  const snapshot = buildCensusShareSnapshot(report);
  if (options.rescan) validateRescanOptions(options.rescan);
  const locale = options.locale ?? 'en';
  const lightIcon = iconDataUrl('forkit-icon-light.png');
  const darkIcon = iconDataUrl('forkit-icon-dark.png');
  const brand = lightIcon
    ? `<picture><source media="(prefers-color-scheme:dark)" srcset="${darkIcon ?? lightIcon}"><img class="brand-icon" src="${lightIcon}" alt=""></picture>`
    : '<span class="brand-fallback">F</span>';
  return renderActivityApplicationPage({
    locale,
    snapshot,
    view: options.rescan ? buildLocalScanView(report) : null,
    rescan: options.rescan,
    device: options.localDeviceLabel ?? (locale === 'de' ? 'Dieses Gerät' : 'This device'),
    brand,
    shareLogo: lightIcon,
  });
}
