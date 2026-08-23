import { parseLoopbackEndpoint, type SafeEndpoint } from '../endpoints';
import { sha256 } from '../hash';
import { verifyMacosLoopbackRuntimeIdentity, type RuntimeIdentityVerifier } from '../runtime-identity';
import type { RuntimeProvider, RuntimeScanResult } from '../types';
import {
  createModel,
  createRuntime,
  fetchJson,
  readArray,
  readNumber,
  readRecord,
  readString,
} from './base';

function parseSha256(value: string | null): string | null {
  if (!value) return null;
  const match = /^(?:sha256:)?([0-9a-f]{64})$/i.exec(value);
  return match?.[1]?.toLowerCase() ?? null;
}

function validOllamaVersion(value: unknown): boolean {
  const body = readRecord(value);
  const version = readString(body?.version);
  return version !== null && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);
}

function validModelArray(value: unknown): unknown[] | null {
  const body = readRecord(value);
  return body !== null && Array.isArray(body.models) ? body.models : null;
}

export class OllamaProvider implements RuntimeProvider {
  readonly name = 'ollama' as const;
  private readonly endpoint: SafeEndpoint;
  private readonly detailsCache = new Map<string, unknown>();

  constructor(
    endpoint = 'http://localhost:11434',
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly verifyIdentity: RuntimeIdentityVerifier = verifyMacosLoopbackRuntimeIdentity,
  ) {
    const safeEndpoint = parseLoopbackEndpoint(endpoint);
    if (!safeEndpoint) throw new Error('Ollama endpoint must be loopback HTTP(S).');
    this.endpoint = safeEndpoint;
  }

  async scan(observedAt: string): Promise<RuntimeScanResult> {
    if (!await this.verifyIdentity(this.endpoint.url, 'ollama')) {
      return {
        runtime: createRuntime({
          name: this.name,
          endpoint: this.endpoint.display,
          status: 'unavailable',
          modelCount: 0,
          observedAt,
          errorCode: 'runtime_identity_unverified',
        }),
        models: [],
        warnings: [{
          code: 'runtime_identity_unverified',
          message: 'A loopback response could not be tied to the supported Ollama executable.',
          scope: 'runtime',
        }],
      };
    }
    const [version, tags, running] = await Promise.all([
      fetchJson(`${this.endpoint.url}/api/version`, { method: 'GET' }, this.fetchImpl),
      fetchJson(`${this.endpoint.url}/api/tags`, { method: 'GET' }, this.fetchImpl),
      fetchJson(`${this.endpoint.url}/api/ps`, { method: 'GET' }, this.fetchImpl),
    ]);
    const tagEntries = tags.ok ? validModelArray(tags.body) : null;
    if (!version.ok || !validOllamaVersion(version.body) || tagEntries === null) {
      return {
        runtime: createRuntime({
          name: this.name,
          endpoint: this.endpoint.display,
          status: 'unavailable',
          modelCount: 0,
          observedAt,
          errorCode: !version.ok ? version.error : !tags.ok ? tags.error : 'invalid_ollama_api_shape',
        }),
        models: [],
        warnings: [{
          code: 'ollama_api_unverified',
          message: 'The listener owner matched Ollama, but its version or inventory response was not valid.',
          scope: 'runtime',
        }],
      };
    }

    const validatedRunning = running.ok ? validModelArray(running.body) : null;
    const runningEntries = validatedRunning ?? [];
    const runningNames = new Set(runningEntries.flatMap((value) => {
      const entry = readRecord(value);
      const name = readString(entry?.name) ?? readString(entry?.model);
      return name ? [name.toLowerCase()] : [];
    }));
    const entries = tagEntries;
    const models = await Promise.all(entries.map(async (entryValue) => {
      const entry = readRecord(entryValue);
      const name = readString(entry?.name) ?? readString(entry?.model);
      if (!name) return null;
      const manifestDigest = parseSha256(readString(entry?.digest));
      const cacheKey = manifestDigest ?? name.toLowerCase();
      let detailsValue = this.detailsCache.get(cacheKey);
      if (detailsValue === undefined) {
        const detailsResult = await fetchJson(
          `${this.endpoint.url}/api/show`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: name, verbose: false }),
          },
          this.fetchImpl,
          4000,
        );
        if (detailsResult.ok) {
          detailsValue = detailsResult.body;
          this.detailsCache.set(cacheKey, detailsValue);
        }
      }
      const detailsBody = readRecord(detailsValue);
      const layers = readArray(detailsBody?.layers);
      const modelLayer = layers
        .map((layer) => readRecord(layer))
        .find((layer) => readString(layer?.mediaType) === 'application/vnd.ollama.image.model');
      const weightsDigest = parseSha256(readString(modelLayer?.digest));
      const details = readRecord(detailsBody?.details);
      const contentIdentity = weightsDigest ?? manifestDigest;
      const identity = contentIdentity ?? sha256(`ollama:${name}`);
      const model = createModel({
        name,
        runtime: this.name,
        identityKind: contentIdentity ? 'content-sha256' : 'provider-id',
        identity,
        source: 'runtime-api',
        confidence: contentIdentity ? 'high' : 'medium',
        sizeBytes: readNumber(entry?.size),
        modifiedAt: readString(entry?.modified_at),
        quantization: readString(details?.quantization_level),
        architecture: readString(details?.family),
        parameterSize: readString(details?.parameter_size),
      });
      return {
        ...model,
        evidence_status: runningNames.has(name.toLowerCase()) ? 'confirmed-running' as const : 'discovered' as const,
      };
    }));

    const detectedModels = models.filter((model) => model !== null);
    const detectedNames = new Set(detectedModels.map((model) => model.name.toLowerCase()));
    for (const value of runningEntries) {
      const entry = readRecord(value);
      const name = readString(entry?.name) ?? readString(entry?.model);
      if (!name || detectedNames.has(name.toLowerCase())) continue;
      const digest = parseSha256(readString(entry?.digest));
      const model = createModel({
        name,
        runtime: this.name,
        identityKind: digest ? 'content-sha256' : 'provider-id',
        identity: digest ?? sha256(`ollama:${name}`),
        source: 'runtime-api',
        confidence: digest ? 'high' : 'medium',
        sizeBytes: readNumber(entry?.size),
      });
      detectedModels.push({ ...model, evidence_status: 'confirmed-running' });
    }
    return {
      runtime: createRuntime({
        name: this.name,
        endpoint: this.endpoint.display,
        status: 'available',
        modelCount: detectedModels.length,
        observedAt,
      }),
      models: detectedModels,
      warnings: validatedRunning !== null ? [] : [{
        code: 'ollama_running_state_unavailable',
        message: 'Ollama inventory was available, but confirmed loaded-model state could not be read.',
        scope: 'runtime',
      }],
    };
  }
}
