import assert from 'node:assert/strict';
import test from 'node:test';
import { LMStudioProvider } from './lmstudio';
import { OllamaProvider } from './ollama';
import { configuredOpenAICompatibleProviders, OpenAICompatibleProvider } from './openai-compatible';

test('Ollama census prefers a content-addressed weights digest', async () => {
  const weights = 'a'.repeat(64);
  const manifest = 'b'.repeat(64);
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({
        models: [{
          name: 'llama-test:latest',
          digest: `sha256:${manifest}`,
          size: 1024,
          modified_at: '2026-08-22T00:00:00.000Z',
        }],
      }), { status: 200 });
    }
    if (url.endsWith('/api/ps')) {
      return new Response(JSON.stringify({
        models: [{ name: 'llama-test:latest', digest: `sha256:${manifest}` }],
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      layers: [{
        mediaType: 'application/vnd.ollama.image.model',
        digest: `sha256:${weights}`,
      }],
      details: {
        family: 'llama',
        parameter_size: '3B',
        quantization_level: 'Q4_K_M',
      },
    }), { status: 200 });
  };
  const result = await new OllamaProvider('http://localhost:11434', fetchImpl)
    .scan('2026-08-22T00:00:00.000Z');
  assert.equal(result.runtime.status, 'available');
  assert.equal(result.models[0]?.identity, weights);
  assert.equal(result.models[0]?.identity_kind, 'content-sha256');
  assert.equal(result.models[0]?.confidence, 'high');
  assert.equal(result.models[0]?.architecture, 'llama');
  assert.equal(result.models[0]?.evidence_status, 'confirmed-running');
});

test('Ollama inventory remains useful when api/ps is unavailable', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'model-a', digest: `sha256:${'a'.repeat(64)}` }] }), { status: 200 });
    }
    if (url.endsWith('/api/ps')) return new Response('{}', { status: 404 });
    return new Response('{}', { status: 200 });
  };
  const result = await new OllamaProvider('http://localhost:11434', fetchImpl)
    .scan('2026-08-22T00:00:00.000Z');
  assert.equal(result.runtime.evidence_status, 'online');
  assert.equal(result.models[0]?.evidence_status, 'discovered');
  assert.equal(result.warnings[0]?.code, 'ollama_running_state_unavailable');
});

test('LM Studio census uses provider identity without retaining model paths', async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    data: [{
      id: 'local/model-one',
      path: '/private/models/model-one.gguf',
      arch: 'llama',
      quantization: 'Q5',
    }],
  }), { status: 200 });
  const result = await new LMStudioProvider('http://localhost:1234', fetchImpl)
    .scan('2026-08-22T00:00:00.000Z');
  assert.equal(result.models[0]?.identity_kind, 'provider-id');
  assert.equal(result.models[0]?.confidence, 'medium');
  assert.equal(JSON.stringify(result).includes('/private/models'), false);
});

test('OpenAI-compatible census only accepts loopback endpoints', async () => {
  assert.throws(
    () => new OpenAICompatibleProvider('https://api.example.com'),
    /loopback/i,
  );
  const providers = configuredOpenAICompatibleProviders([
    'http://localhost:8000',
    'http://127.0.0.1:9000',
    'https://api.example.com',
  ].join(','));
  assert.equal(providers.length, 2);
});

test('OpenAI-compatible provider failure is an unavailable runtime, not an exception', async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error('private connection detail');
  };
  const result = await new OpenAICompatibleProvider('http://localhost:8000', fetchImpl)
    .scan('2026-08-22T00:00:00.000Z');
  assert.equal(result.runtime.status, 'unavailable');
  assert.equal(result.runtime.error_code, 'connection_unavailable');
  assert.equal(JSON.stringify(result).includes('private connection detail'), false);
});
