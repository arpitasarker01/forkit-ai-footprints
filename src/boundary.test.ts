import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function runtimeFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return runtimeFiles(target);
    if (!entry.name.endsWith('.js') || entry.name.endsWith('.test.js')) return [];
    return [target];
  });
}

test('compiled runtime contains no Forkit production write client', () => {
  const files = runtimeFiles(path.join(process.cwd(), 'dist'));
  const runtime = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  for (const forbidden of [
    'https://www.forkit.dev',
    'api.forkit.dev',
    '/api/v1/passport',
    'publishPassportDraft',
    'Authorization: Bearer',
    'runtime-signals-c2',
  ]) {
    assert.equal(runtime.includes(forbidden), false, `unexpected production surface: ${forbidden}`);
  }
});
