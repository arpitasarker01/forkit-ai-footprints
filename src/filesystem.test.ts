import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDefaultModelRoots, scanFilesystemModels } from './filesystem';

test('filesystem census reports model metadata without absolute paths or file content', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-census-models-'));
  const modelDir = path.join(root, 'models--acme--tiny-model', 'snapshots', 'one');
  fs.mkdirSync(modelDir, { recursive: true });
  fs.writeFileSync(path.join(modelDir, 'model.safetensors'), Buffer.alloc(32));
  fs.writeFileSync(path.join(root, 'ignore.txt'), 'not a model');
  try {
    const result = await scanFilesystemModels('2026-08-22T00:00:00.000Z', {
      roots: [root],
      minBytes: 1,
    });
    assert.equal(result.models.length, 1);
    assert.equal(result.models[0]?.name, 'acme/tiny-model');
    assert.equal(result.models[0]?.identity_kind, 'metadata-sha256');
    assert.equal(result.models[0]?.location_hint, 'huggingface-cache');
    assert.equal(JSON.stringify(result).includes(root), false);
    assert.equal(JSON.stringify(result).includes('model.safetensors'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('filesystem census ignores small and unsupported files', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-census-models-'));
  fs.writeFileSync(path.join(root, 'small.gguf'), Buffer.alloc(4));
  fs.writeFileSync(path.join(root, 'large.txt'), Buffer.alloc(64));
  try {
    const result = await scanFilesystemModels('2026-08-22T00:00:00.000Z', {
      roots: [root],
      minBytes: 8,
    });
    assert.equal(result.models.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('macOS default roots include current Jan llama.cpp and MLX model stores', () => {
  const roots = getDefaultModelRoots();
  assert.equal(roots.some((root) => root.endsWith(path.join('Jan', 'data', 'llamacpp', 'models'))), true);
  assert.equal(roots.some((root) => root.endsWith(path.join('Jan', 'data', 'mlx', 'models'))), true);
});
