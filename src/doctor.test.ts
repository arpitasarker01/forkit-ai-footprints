import assert from 'node:assert/strict';
import test from 'node:test';
import { runDoctor } from './doctor';

test('doctor reports the macOS-only release boundary', async () => {
  const report = await runDoctor();
  const operatingSystem = report.checks.find((check) => check.name === 'operating-system');
  assert.equal(operatingSystem?.ok, process.platform === 'darwin');
  assert.match(operatingSystem?.detail ?? '', /macOS/);
});
