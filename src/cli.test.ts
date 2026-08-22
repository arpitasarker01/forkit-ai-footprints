import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { clipboardCommands, parseArgs } from './cli';

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
    raw_commands_retained: false,
    model_file_contents_read: false,
    config_values_emitted: false,
    sensitive_content_retained: false,
    remote_endpoints_allowed: false,
    external_requests_made: 0,
    backend_contacted: false,
    account_read: false,
    local_state_written: false,
  });
});

test('argument parser accepts guess, verbose, copy, and separately consented aggregate preview', () => {
  const parsed = parseArgs(['scan', '--guess', '7', '--verbose', '--copy', '--anonymous-payload', '--consent-share']);
  assert.equal(parsed.guess, 7);
  assert.equal(parsed.verbose, true);
  assert.equal(parsed.copy, true);
  assert.equal(parsed.anonymousPayload, true);
  assert.equal(parsed.shareConsent, true);
});

test('argument parser accepts a local macOS truth file for evaluation', () => {
  const parsed = parseArgs(['evaluate', '--truth', '/tmp/local-truth.json']);
  assert.equal(parsed.command, 'evaluate');
  assert.equal(parsed.truth, '/tmp/local-truth.json');
});

test('argument parser accepts a local evaluation-results directory for aggregation', () => {
  const parsed = parseArgs(['aggregate', '--results', '/tmp/results']);
  assert.equal(parsed.command, 'aggregate');
  assert.equal(parsed.results, '/tmp/results');
});

test('argument parser accepts the local aggregate share page command', () => {
  const parsed = parseArgs(['share-page', '--output', '/tmp/ai-footprint.html']);
  assert.equal(parsed.command, 'share-page');
  assert.equal(parsed.output, '/tmp/ai-footprint.html');
});

test('CLI evaluation emits aggregate metrics without labelled item names', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-census-evaluate-'));
  const truthPath = path.join(directory, 'truth.json');
  const sentinel = 'PRIVATE_TESTER_LABEL_DO_NOT_EMIT';
  fs.writeFileSync(truthPath, JSON.stringify({
    schema_version: '1.0',
    expected: {
      agent_signatures: [sentinel],
      tool_names: [sentinel],
      online_runtime_names: [sentinel],
      model_keys: [sentinel],
      mcp_clients: [sentinel],
    },
  }));
  try {
    const result = runCli(['evaluate', '--truth', truthPath]);
    assert.equal(result.status, 0, result.stderr);
    const evaluation = JSON.parse(result.stdout);
    assert.equal(evaluation.evaluation, 'macos-local-labelled-device');
    assert.equal(evaluation.uploaded, false);
    assert.equal(evaluation.field_accuracy_claim_allowed, false);
    assert.doesNotMatch(result.stdout, new RegExp(sentinel));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('CLI evaluation requires an explicit truth file', () => {
  const result = runCli(['evaluate']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires --truth/i);
});

test('CLI aggregation requires an explicit results directory', () => {
  const result = runCli(['aggregate']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires --results/i);
});

test('CLI share page requires an explicit output path', () => {
  const result = runCli(['share-page']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires --output/i);
});

test('CLI help states the non-writing privacy boundary', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /does not read model bytes/i);
  assert.match(result.stdout, /write to\s+any passport/i);
});

test('CLI rejects unknown arguments', () => {
  const result = runCli(['scan', '--publish']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown argument: --publish/);
});

test('anonymous payload is withheld without separate consent after local result', () => {
  const result = runCli([
    'scan', '--json', '--anonymous-payload', '--no-runtimes', '--no-model-files', '--no-agents', '--no-tools', '--no-mcp',
  ]);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).product, 'forkit-census');
  assert.match(result.stderr, /separate --consent-share is required/i);
});

test('consented anonymous payload is an explicit preview and remains not uploaded', () => {
  const result = runCli([
    'scan', '--json', '--anonymous-payload', '--consent-share', '--no-runtimes', '--no-model-files', '--no-agents', '--no-tools', '--no-mcp',
  ]);
  assert.equal(result.status, 0, result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.uploaded, false);
  assert.equal(envelope.local_report.product, 'forkit-census');
  assert.equal(envelope.anonymous_contribution.schema_version, '1.0');
});

test('clipboard integration maps to native commands without a shell', () => {
  assert.deepEqual(clipboardCommands('darwin'), [{ command: 'pbcopy', args: [] }]);
  assert.deepEqual(clipboardCommands('win32'), [{ command: 'clip', args: [] }]);
  assert.deepEqual(clipboardCommands('linux').map((entry) => entry.command), ['wl-copy', 'xclip']);
});
