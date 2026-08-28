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

test('compiled runtime contains only the approved Forkit Global AI Preview write client', () => {
  const files = runtimeFiles(path.join(process.cwd(), 'dist'));
  const runtime = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  for (const forbidden of [
    'api.forkit.dev',
    '/api/v1/passport',
    'publishPassportDraft',
    'Authorization: Bearer',
    'runtime-signals-c2',
  ]) {
    assert.equal(runtime.includes(forbidden), false, `unexpected production surface: ${forbidden}`);
  }
  assert.match(runtime, /https:\/\/www\.forkit\.dev\/api\/v1\/ai-footprints/);
  assert.match(runtime, /ai-footprint#global-vision/);
  assert.match(runtime, /preview-contribution/);
  assert.match(runtime, /community-ed25519/);
  assert.doesNotMatch(runtime, /https:\/\/www\.forkit\.dev\/api\/(?!v1\/ai-footprints)/);
});

test('native global action opens only the fixed public benchmark route', () => {
  const launcher = fs.readFileSync(path.join(process.cwd(), 'native/macos/ForkitAiFootprintsLauncher.swift'), 'utf8');
  assert.match(launcher, /action == "open-global"/);
  assert.match(launcher, /let globalPath = uiLocale == "de" \? "de\/ai-footprint" : "ai-footprint"/);
  assert.match(launcher, /URL\(string: "https:\/\/www\.forkit\.dev\/\\\(globalPath\)#global-vision"\)/);
  assert.match(launcher, /NSWorkspace\.shared\.open\(url\)/);
  assert.doesNotMatch(launcher, /body\["url"\]/);
  assert.match(launcher, /globalPermissionVersion = "ai-footprints-global-preview-v2"/);
  assert.match(launcher, /api\/native\/global-permission\/grant/);
});
