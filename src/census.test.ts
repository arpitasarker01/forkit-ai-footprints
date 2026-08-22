import assert from 'node:assert/strict';
import test from 'node:test';
import { runCensus } from './census';
import { createModel, createRuntime } from './providers/base';
import type { RuntimeProvider } from './types';

const provider: RuntimeProvider = {
  name: 'ollama',
  async scan(observedAt) {
    const model = createModel({
      name: 'llama-test',
      runtime: 'ollama',
      identityKind: 'content-sha256',
      identity: 'a'.repeat(64),
      source: 'runtime-api',
      confidence: 'high',
    });
    return {
      runtime: createRuntime({
        name: 'ollama',
        endpoint: 'http://localhost:11434',
        status: 'available',
        modelCount: 1,
        observedAt,
      }),
      models: [model],
      warnings: [],
    };
  },
};

test('unified census includes runtimes, models, and product-level agents', async () => {
  const report = await runCensus({
    providers: [provider],
    includeFilesystem: false,
    processEntries: [
      { pid: 1, name: 'codex', cmd: 'codex app-server' },
      { pid: 2, name: 'node', cmd: 'node codex worker' },
    ],
    now: () => new Date('2026-08-22T00:00:00.000Z'),
  });
  assert.equal(report.summary.runtime_count, 1);
  assert.equal(report.summary.model_count, 1);
  assert.equal(report.summary.agent_product_count, 1);
  assert.equal(report.summary.agent_process_count, 2);
  assert.equal(report.agents[0]?.instance_count, 2);
  assert.equal(report.privacy.remote_endpoints_allowed, false);
});

test('census report contains no auth, mint, credential, or raw-command surface', async () => {
  const report = await runCensus({
    providers: [provider],
    includeFilesystem: false,
    processEntries: [{ pid: 1, name: 'claude', cmd: 'claude --api-key raw-secret' }],
    now: () => new Date('2026-08-22T00:00:00.000Z'),
  });
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ['raw-secret', 'api-key', 'passport', 'mint', 'session_token']) {
    assert.equal(serialized.includes(forbidden), false, `unexpected ${forbidden}`);
  }
});

test('provider failures stay non-fatal and redact raw errors', async () => {
  const failingProvider: RuntimeProvider = {
    name: 'lmstudio',
    async scan() {
      throw new Error('/private/path with secret');
    },
  };
  const report = await runCensus({
    providers: [failingProvider],
    includeFilesystem: false,
    includeAgents: false,
    now: () => new Date('2026-08-22T00:00:00.000Z'),
  });
  assert.equal(report.runtimes[0]?.error_code, 'provider_scan_failed');
  assert.equal(JSON.stringify(report).includes('/private/path'), false);
});
