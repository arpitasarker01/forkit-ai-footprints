import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-census-smoke-'));

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

function capture(command, args) {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command;
  const executableArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', command, ...args]
    : args;
  const result = spawnSync(executable, executableArgs, { cwd: root, encoding: 'utf8' });
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
  fs.mkdirSync(install, { recursive: true });
  run('npm', ['init', '-y'], { cwd: install });
  run('npm', ['install', tarball], { cwd: install });
  const environment = {
    ...process.env,
    FORKIT_CENSUS_DISABLE_DEFAULT_RUNTIMES: '1',
  };
  run('npx', ['forkit-census', '--help'], { cwd: install, env: environment });
  run('npx', ['forkit-census', 'scan', '--json', '--no-runtimes', '--no-model-files', '--no-agents'], {
    cwd: install,
    env: environment,
  });
  fs.rmSync(tarball, { force: true });
  process.stdout.write('Forkit Census package smoke passed.\n');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
