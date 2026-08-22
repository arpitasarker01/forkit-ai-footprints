import { parseLoopbackEndpoint, parseLoopbackEndpointList, type SafeEndpoint } from '../endpoints';
import { sha256 } from '../hash';
import type { RuntimeProvider, RuntimeScanResult } from '../types';
import {
  createModel,
  createRuntime,
  fetchJson,
  readArray,
  readRecord,
  readString,
} from './base';

export class OpenAICompatibleProvider implements RuntimeProvider {
  readonly name = 'openai-compatible' as const;
  private readonly endpoint: SafeEndpoint;

  constructor(
    endpoint = 'http://localhost:8000',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    const safeEndpoint = parseLoopbackEndpoint(endpoint);
    if (!safeEndpoint) throw new Error('OpenAI-compatible endpoint must be loopback HTTP(S).');
    this.endpoint = safeEndpoint;
  }

  async scan(observedAt: string): Promise<RuntimeScanResult> {
    const result = await fetchJson(
      `${this.endpoint.url}/v1/models`,
      { method: 'GET' },
      this.fetchImpl,
    );
    if (!result.ok) {
      return {
        runtime: createRuntime({
          name: this.name,
          endpoint: this.endpoint.display,
          status: 'unavailable',
          modelCount: 0,
          observedAt,
          errorCode: result.error,
        }),
        models: [],
        warnings: [],
      };
    }

    const body = readRecord(result.body);
    const models = readArray(body?.data).flatMap((value) => {
      const entry = readRecord(value);
      const name = readString(entry?.id);
      if (!name) return [];
      return [createModel({
        name,
        runtime: this.name,
        identityKind: 'provider-id',
        identity: sha256(`openai-compatible:${this.endpoint.id}:${name}`),
        source: 'runtime-api',
        confidence: 'medium',
      })];
    });
    return {
      runtime: createRuntime({
        name: this.name,
        endpoint: this.endpoint.display,
        status: 'available',
        modelCount: models.length,
        observedAt,
      }),
      models,
      warnings: [],
    };
  }
}

export function configuredOpenAICompatibleProviders(
  raw = process.env.FORKIT_CENSUS_OPENAI_ENDPOINTS ?? 'http://localhost:8000',
  fetchImpl: typeof fetch = fetch,
): OpenAICompatibleProvider[] {
  return parseLoopbackEndpointList(raw)
    .map((endpoint) => new OpenAICompatibleProvider(endpoint.url, fetchImpl));
}
