import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-ai-footprints-smoke-'));

function run(command, args, options = {}) {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command;
  const executableArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', command, ...args]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) throw new Error(`Command failed: ${command}`);
}

function capture(command, args, options = {}) {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command;
  const executableArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', command, ...args]
    : args;
  const result = spawnSync(executable, executableArgs, { cwd: root, encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(result.stderr || `Command failed: ${command}`);
  return result.stdout;
}

try {
  run('npm', ['run', 'prepack']);
  const packed = JSON.parse(capture('npm', ['pack', '--ignore-scripts', '--json']));
  const filename = packed[0]?.filename;
  if (!filename) throw new Error('npm pack did not return a filename.');
  const tarball = path.join(root, filename);
  const install = path.join(work, 'install');
  const home = path.join(work, 'home');
  fs.mkdirSync(install, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  run('npm', ['init', '-y'], { cwd: install });
  run('npm', ['install', tarball], { cwd: install });
  const environment = {
    ...process.env,
    APPDATA: path.join(home, 'AppData', 'Roaming'),
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    FORKIT_CENSUS_DISABLE_DEFAULT_RUNTIMES: '1',
    FORKIT_AI_FOOTPRINTS_APPLICATIONS_DIR: path.join(home, 'Applications'),
    FORKIT_AI_FOOTPRINTS_NO_OPEN: '1',
  };
  fs.mkdirSync(environment.APPDATA, { recursive: true });
  fs.mkdirSync(environment.XDG_CONFIG_HOME, { recursive: true });
  run('npx', ['forkit-ai-footprints', '--help'], { cwd: install, env: environment });
  run('npx', ['forkit-ai-footprints'], { cwd: install, env: environment });
  const installedApp = path.join(environment.FORKIT_AI_FOOTPRINTS_APPLICATIONS_DIR, 'Forkit AI Footprint.app');
  const installedInfo = fs.readFileSync(path.join(installedApp, 'Contents', 'Info.plist'), 'utf8');
  if (!installedInfo.includes('dev.forkit.ai-footprints') || !fs.existsSync(path.join(installedApp, 'Contents', 'Resources', 'ForkitAIFootprint.icns'))) {
    throw new Error('One-time package bootstrap did not install a persistent branded app.');
  }
  run('npx', ['forkit-census', '--version'], { cwd: install, env: environment });
  const apiSmoke = path.join(install, 'api-smoke.cjs');
  fs.writeFileSync(apiSmoke, [
    "const assert = require('node:assert/strict');",
    "const api = require('forkit-ai-footprints');",
    "assert.equal(typeof api.runCensus, 'function');",
    "assert.equal(typeof api.detectAgentProducts, 'function');",
    "assert.equal(typeof api.evaluateMacosFieldTruth, 'function');",
    "assert.equal(typeof api.aggregateMacosFieldEvaluations, 'function');",
    "assert.equal(typeof api.renderCensusSharePage, 'function');",
    "api.runCensus({ includeRuntimes: false, includeFilesystem: false, includeAgents: false, includeTools: false, includeMcp: false })",
    "  .then((report) => {",
    "    assert.equal(report.schema_version, '1.3');",
    "    assert.equal(report.privacy.external_requests_made, 0);",
    "    assert.equal(report.privacy.local_state_written, false);",
    "  })",
    "  .catch((error) => { console.error(error); process.exitCode = 1; });",
  ].join('\n'));
  run(process.execPath, [apiSmoke], { cwd: install, env: environment });
  const output = capture('npx', [
    'forkit-ai-footprints', 'scan', '--json', '--no-runtimes', '--no-model-files', '--no-agents', '--no-tools', '--no-mcp',
  ], { cwd: install, env: environment });
  const report = JSON.parse(output);
  if (report.schema_version !== '1.3' || report.privacy?.external_requests_made !== 0 || report.privacy?.backend_contacted !== false || report.privacy?.local_state_scope !== 'device-journal-only') {
    throw new Error('Installed Census privacy contract failed.');
  }
  const truthPath = path.join(work, 'local-truth.json');
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
  const evaluationOutput = capture('npx', [
    'forkit-ai-footprints', 'evaluate', '--truth', truthPath,
  ], { cwd: install, env: environment });
  const evaluation = JSON.parse(evaluationOutput);
  if (evaluation.uploaded !== false || evaluation.field_accuracy_claim_allowed !== false || evaluationOutput.includes(sentinel)) {
    throw new Error('Installed Census field-evaluation privacy contract failed.');
  }
  const resultsDirectory = path.join(work, 'macos-field-results');
  fs.mkdirSync(resultsDirectory);
  fs.writeFileSync(path.join(resultsDirectory, 'result-1.json'), evaluationOutput);
  const aggregateOutput = capture('npx', [
    'forkit-ai-footprints', 'aggregate', '--results', resultsDirectory,
  ], { cwd: install, env: environment });
  const aggregate = JSON.parse(aggregateOutput);
  if (aggregate.evaluation_count !== 1 || aggregate.uploaded !== false || aggregate.field_accuracy_claim_allowed !== false) {
    throw new Error('Installed Census field-aggregation contract failed.');
  }
  const sharePagePath = path.join(work, 'ai-footprint.html');
  run('npx', [
    'forkit-ai-footprints', 'share-page', '--output', sharePagePath,
    '--no-runtimes', '--no-model-files', '--no-agents', '--no-tools', '--no-mcp',
  ], { cwd: install, env: environment });
  const sharePage = fs.readFileSync(sharePagePath, 'utf8');
  if (!sharePage.includes('Forkit AI Footprint') || /https?:\/\//i.test(sharePage)) {
    throw new Error('Installed AI Footprint aggregate share-page contract failed.');
  }
  const journalPath = path.join(home, 'Library', 'Application Support', 'Forkit AI Footprints', 'device-journal.json');
  if (!fs.existsSync(journalPath) || (fs.statSync(journalPath).mode & 0o777) !== 0o600) {
    throw new Error('Installed AI Footprints did not keep its declared owner-only device journal.');
  }
  if (fs.existsSync(path.join(home, '.forkit-connect')) || fs.existsSync(path.join(home, '.forkit-census'))) {
    throw new Error('Installed AI Footprints wrote undeclared persistent local state.');
  }
  fs.rmSync(tarball, { force: true });
  process.stdout.write('Forkit AI Footprints package smoke passed.\n');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
