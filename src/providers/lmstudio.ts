import { parseLoopbackEndpoint, type SafeEndpoint } from '../endpoints';
import { sha256 } from '../hash';
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

export class LMStudioProvider implements RuntimeProvider {
  readonly name = 'lmstudio' as const;
  private readonly endpoint: SafeEndpoint;

  constructor(
    endpoint = 'http://localhost:1234',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    const safeEndpoint = parseLoopbackEndpoint(endpoint);
    if (!safeEndpoint) throw new Error('LM Studio endpoint must be loopback HTTP(S).');
    this.endpoint = safeEndpoint;
  }

  async scan(observedAt: string): Promise<RuntimeScanResult> {
    const v0 = await fetchJson(
      `${this.endpoint.url}/api/v0/models`,
      { method: 'GET' },
      this.fetchImpl,
    );
    const result = v0.ok
      ? v0
      : await fetchJson(`${this.endpoint.url}/v1/models`, { method: 'GET' }, this.fetchImpl);
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
        identity: sha256(`lmstudio:${name}`),
        source: 'runtime-api',
        confidence: 'medium',
        quantization: readString(entry?.quantization),
        architecture: readString(entry?.arch),
        parameterSize: readNumber(entry?.parameter_size) === null
          ? readString(entry?.parameter_size)
          : String(readNumber(entry?.parameter_size)),
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
