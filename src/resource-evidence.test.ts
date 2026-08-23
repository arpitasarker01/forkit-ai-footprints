import assert from 'node:assert/strict';
import test from 'node:test';
import { macosResourceEvidenceManifest } from './resource-evidence';

test('resource evidence manifest never overclaims exclusive task proof', () => {
  const manifest = macosResourceEvidenceManifest();
  assert.deepEqual(manifest.capabilities.map((entry) => entry.metric), [
    'cpu', 'memory', 'gpu', 'hardware', 'network_traffic',
  ]);
  assert.equal(manifest.capabilities.every((entry) => entry.exclusive_task_proof === false), true);
  assert.equal(manifest.capabilities.find((entry) => entry.metric === 'gpu')?.state, 'not-available');
  assert.equal(manifest.capabilities.find((entry) => entry.metric === 'network_traffic')?.state, 'not-available');
});
