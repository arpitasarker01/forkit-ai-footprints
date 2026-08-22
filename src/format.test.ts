import assert from 'node:assert/strict';
import test from 'node:test';
import { runCensus } from './census';
import { formatCensusReport } from './format';

test('human report is readable and repeats no raw process command', async () => {
  const report = await runCensus({
    providers: [],
    includeFilesystem: false,
    processEntries: [{ pid: 1, name: 'codex', cmd: 'codex --token do-not-print' }],
    now: () => new Date('2026-08-22T00:00:00.000Z'),
  });
  const output = formatCensusReport(report);
  assert.match(output, /Forkit Census/);
  assert.match(output, /Codex/);
  assert.match(output, /metadata only/);
  assert.equal(output.includes('do-not-print'), false);
});
