import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { GlobalPreviewContributor } from './global-preview';
import type { AnonymousAiFootprintContribution } from './sharing';

function contribution(): AnonymousAiFootprintContribution {
  return {
    schema_version: '2.0',
    observation: { valid_seconds: 3600, ai_active_seconds: 1800, activity_ratio: 0.5, longest_active_block_seconds: 900 },
    counts: {
      supported_apps_observed_working: 1,
      supported_app_categories: ['coding-agent'],
      local_models_discovered: 5,
      local_models_loaded: 0,
      verified_local_runtimes_available: 1,
    },
    model_storage_bytes: 2_600_071_742,
    hosted_active_seconds: 1800,
    local_active_seconds: 0,
    system_active_seconds: { 'coding-agent': 1800 },
    privacy: {
      consent_version: 'ai-footprints-global-preview-v2',
      location_mode: 'none',
      country_code: null,
      region_code: null,
      map_cell: null,
    },
    system: { platform: 'darwin', architecture: 'arm64', os_major: 26 },
    versions: { scanner: '0.2.2', node_major: 24, monitor_schema: '1.0' },
  };
}

test('consented preview signs one allowlisted aggregate with a stable local key', async () => {
  const stateDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'forkit-preview-sync-'));
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const challengeId = 'c'.repeat(64);
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    requests.push({ url, body });
    if (url.endsWith('/challenges')) return new Response(JSON.stringify({ challengeId }), { status: 201, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ accepted: true, includedInPulse: true, trustState: 'preview' }), { status: 202, headers: { 'content-type': 'application/json' } });
  };
  const contributor = new GlobalPreviewContributor({ stateDirectory, fetchFn, minimumSyncIntervalMs: 0 });
  const first = await contributor.sync(contribution(), 'granted');
  assert.equal(first.state, 'contributed');
  assert.equal(requests.length, 2);
  const envelope = requests[1]!.body as {
    consent: boolean;
    contribution: AnonymousAiFootprintContribution;
    proof: { public_key: string; signature: string; client_data_hash: string };
  };
  assert.equal(envelope.consent, true);
  assert.deepEqual(envelope.contribution, contribution());
  const publicKey = crypto.createPublicKey({ key: Buffer.from(envelope.proof.public_key, 'base64url'), type: 'spki', format: 'der' });
  assert.equal(crypto.verify(null, Buffer.from(envelope.proof.client_data_hash, 'hex'), publicKey, Buffer.from(envelope.proof.signature, 'base64url')), true);
  const keyFile = JSON.parse(await fs.readFile(path.join(stateDirectory, 'global-preview-key.json'), 'utf8')) as { public_key: string; private_key: string };
  assert.equal(keyFile.public_key, envelope.proof.public_key);
  assert.ok(keyFile.private_key.length > 40);
  assert.equal((await fs.stat(path.join(stateDirectory, 'global-preview-key.json'))).mode & 0o777, 0o600);
  const serialized = JSON.stringify(envelope);
  for (const forbidden of ['prompt', 'workspace', 'account', 'device_name', 'process_id', 'cpu_percent', 'memory_bytes']) assert.equal(serialized.includes(forbidden), false);
});

test('preview transport makes no request without explicit permission', async () => {
  let requests = 0;
  const contributor = new GlobalPreviewContributor({
    stateDirectory: await fs.mkdtemp(path.join(os.tmpdir(), 'forkit-preview-no-consent-')),
    fetchFn: async () => { requests += 1; throw new Error('unexpected request'); },
  });
  assert.equal((await contributor.sync(contribution(), 'declined')).state, 'disabled');
  assert.equal((await contributor.sync(contribution(), 'unset')).state, 'disabled');
  assert.equal(requests, 0);
});

test('preview transport retries safely and keeps the last aggregate receipt local', async () => {
  const stateDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'forkit-preview-receipt-'));
  const contributor = new GlobalPreviewContributor({
    stateDirectory,
    fetchFn: async () => new Response('{}', { status: 503 }),
    minimumSyncIntervalMs: 0,
  });
  const status = await contributor.sync(contribution(), 'granted');
  assert.equal(status.state, 'unavailable');
  assert.equal(status.last_error, 'CHALLENGE_503');
  const receipt = JSON.parse(await fs.readFile(path.join(stateDirectory, 'global-preview-receipt.json'), 'utf8')) as { state: string; last_error: string };
  assert.equal(receipt.state, 'unavailable');
  assert.equal(receipt.last_error, 'CHALLENGE_503');
});
