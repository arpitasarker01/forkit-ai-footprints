import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { recordLocalScan } from './local-device';

test('device journal stays local, owner-only, and ties the device label to scan time', async () => {
  const stateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-device-journal-'));
  try {
    const first = await recordLocalScan({
      stateDirectory,
      deviceLabel: '  Studio\nMac  ',
      now: () => new Date('2026-08-23T10:00:00.000Z'),
    });
    const second = await recordLocalScan({
      stateDirectory,
      deviceLabel: 'Studio Mac',
      now: () => new Date('2026-08-23T10:01:00.000Z'),
    });
    assert.equal(first.device_label, 'Studio Mac');
    assert.equal(second.first_scan_at, '2026-08-23T10:00:00.000Z');
    assert.equal(second.last_scan_at, '2026-08-23T10:01:00.000Z');
    assert.equal(second.scan_count, 2);
    const journalPath = path.join(stateDirectory, 'device-journal.json');
    assert.equal(fs.statSync(stateDirectory).mode & 0o777, 0o700);
    assert.equal(fs.statSync(journalPath).mode & 0o777, 0o600);
    const serialized = fs.readFileSync(journalPath, 'utf8');
    assert.doesNotMatch(serialized, /username|email|account|path/i);
  } finally {
    fs.rmSync(stateDirectory, { recursive: true, force: true });
  }
});
