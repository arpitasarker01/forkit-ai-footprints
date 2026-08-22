import { stableId } from '../hash';
import type {
  CensusModel,
  CensusRuntime,
  Confidence,
  RuntimeKind,
  RuntimeStatus,
} from '../types';

export async function fetchJson(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  timeoutMs = 3000,
): Promise<{ ok: boolean; status: number; body: unknown; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      error: response.ok ? null : `http_${response.status}`,
    };
  } catch (error) {
    const code = error instanceof Error && error.name === 'AbortError'
      ? 'timeout'
      : 'connection_unavailable';
    return { ok: false, status: 0, body: null, error: code };
  } finally {
    clearTimeout(timer);
  }
}

export function createRuntime(input: {
  name: RuntimeKind;
  endpoint: string | null;
  status: RuntimeStatus;
  modelCount: number;
  observedAt: string;
  errorCode?: string | null;
}): CensusRuntime {
  return {
    runtime_id: stableId('runtime', `${input.name}:${input.endpoint ?? 'local-inventory'}`),
    name: input.name,
    status: input.status,
    endpoint: input.endpoint,
    model_count: input.modelCount,
    observed_at: input.observedAt,
    error_code: input.errorCode ?? null,
  };
}

export function createModel(input: {
  name: string;
  runtime: RuntimeKind;
  identityKind: CensusModel['identity_kind'];
  identity: string;
  source: CensusModel['source'];
  confidence: Confidence;
  sizeBytes?: number | null;
  modifiedAt?: string | null;
  quantization?: string | null;
  architecture?: string | null;
  parameterSize?: string | null;
  locationHint?: string | null;
}): CensusModel {
  return {
    model_id: stableId('model', `${input.runtime}:${input.name}:${input.identity}`),
    name: input.name,
    runtime: input.runtime,
    identity_kind: input.identityKind,
    identity: input.identity,
    size_bytes: input.sizeBytes ?? null,
    modified_at: input.modifiedAt ?? null,
    quantization: input.quantization ?? null,
    architecture: input.architecture ?? null,
    parameter_size: input.parameterSize ?? null,
    source: input.source,
    location_hint: input.locationHint ?? null,
    confidence: input.confidence,
  };
}

export function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
