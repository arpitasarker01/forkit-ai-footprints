import assert from 'node:assert/strict';
import test from 'node:test';
import { runCensus } from './census';
import { buildAnonymousCensusContribution } from './sharing';

test('anonymous contribution requires separate consent and contains only aggregate allowlisted fields', async () => {
  const report = await runCensus({
    includeRuntimes: false,
    includeFilesystem: false,
    includeAgents: false,
    includeTools: false,
    includeMcp: false,
    guess: 9,
    now: () => new Date('2026-08-22T00:00:00.000Z'),
  });
  assert.throws(() => buildAnonymousCensusContribution(report, false), /CONSENT_REQUIRED/);
  const payload = buildAnonymousCensusContribution(report, true);
  assert.deepEqual(Object.keys(payload).sort(), [
    'counts', 'detector_types', 'model_storage_bytes', 'schema_version', 'system', 'versions',
  ]);
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(report.census_id), false);
  assert.equal(serialized.includes(report.generated_at), false);
  for (const forbidden of ['census_id', 'generated_at', 'tool_id', 'model_id', 'endpoint', 'identity', 'name']) {
    assert.equal(serialized.includes(forbidden), false, `unexpected field ${forbidden}`);
  }
  assert.equal(payload.counts.agent_products_active, 0);
  assert.equal(payload.counts.agent_processes_active, 0);
  assert.equal(payload.model_storage_bytes, 0);
  assert.equal(JSON.stringify(payload).includes('guess'), false);
});

test('anonymous contribution refuses an incomplete storage ledger', async () => {
  const report = await runCensus({
    includeRuntimes: false,
    includeFilesystem: false,
    includeAgents: false,
    includeTools: false,
    includeMcp: false,
  });
  report.summary.storage_complete = false;
  assert.throws(() => buildAnonymousCensusContribution(report, true), /STORAGE_INCOMPLETE/);
});
