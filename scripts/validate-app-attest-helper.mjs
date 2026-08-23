import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-app-attest-'));
const executable = path.join(temporaryRoot, 'Forkit AI Footprints');

function run(command, args, expectedStatus = 0) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== expectedStatus) throw new Error(`${command} returned ${result.status}: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

try {
  if (process.platform !== 'darwin') throw new Error('App Attest helper validation requires macOS.');
  run('xcrun', ['swiftc', '-parse-as-library', 'native/macos/ForkitAiFootprintsLauncher.swift', '-framework', 'DeviceCheck', '-framework', 'CryptoKit', '-framework', 'Security', '-o', executable]);
  const status = JSON.parse(run(executable, ['--app-attest', 'status']));
  if (status.platform !== 'darwin' || status.schema_version !== '1.0' || status.network_request_made !== false) throw new Error('Unexpected App Attest status boundary.');
  if (status.os_major < 27 && (status.app_attest_supported !== false || status.ready_for_verified_global !== false)) throw new Error('Unsupported macOS version was marked ready for global contribution.');
  if (!status.app_attest_supported) {
    const unavailable = JSON.parse(run(executable, ['--app-attest', 'generate-key'], 2));
    if (unavailable.code !== 'APP_ATTEST_UNAVAILABLE' || unavailable.network_request_made !== false) throw new Error('Unsupported device did not fail closed.');
  }
  process.stdout.write(`${JSON.stringify({ validation: 'native-app-attest-capability', ...status }, null, 2)}\n`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
