import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function findTests(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return findTests(target);
    return entry.name.endsWith('.test.js') ? [target] : [];
  });
}

const tests = findTests(path.join(root, 'dist')).sort();
if (tests.length === 0) throw new Error('No compiled tests found.');
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...tests], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
