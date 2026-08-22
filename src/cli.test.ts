import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { parseArgs } from './cli';

function runCli(args: string[]) {
  const result = spawnSync(process.execPath, [path.join(process.cwd(), 'dist', 'cli.js'), ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      FORKIT_CENSUS_DISABLE_DEFAULT_RUNTIMES: '1',
    },
  });
  return result;
}

test('argument parser makes scan unified by default', () => {
  const parsed = parseArgs(['scan', '--json']);
  assert.equal(parsed.command, 'scan');
  assert.equal(parsed.includeRuntimes, true);
  assert.equal(parsed.includeFilesystem, true);
  assert.equal(parsed.includeAgents, true);
});

test('CLI emits a valid empty metadata-only JSON census', () => {
  const result = runCli(['scan', '--json', '--no-runtimes', '--no-model-files', '--no-agents']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(report.product, 'forkit-census');
  assert.deepEqual(report.privacy, {
    mode: 'metadata-only',
    raw_commands_collected: false,
    file_contents_collected: false,
    credentials_collected: false,
    remote_endpoints_allowed: false,
  });
});

test('CLI help states the non-writing privacy boundary', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /does not read model bytes/i);
  assert.match(result.stdout, /write to any\s+passport/i);
});

test('CLI rejects unknown arguments', () => {
  const result = runCli(['scan', '--publish']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown argument: --publish/);
});
