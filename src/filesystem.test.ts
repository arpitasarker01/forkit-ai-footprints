import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDefaultModelRoots, scanFilesystemModels } from './filesystem';

test('filesystem census reports model metadata without absolute paths or file content', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-ai-footprints-models-'));
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-ai-footprints-models-'));
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
  assert.equal(roots.some((root) => root.endsWith(path.join('.ollama', 'models'))), true);
  assert.equal(roots.some((root) => root.endsWith(path.join('Jan', 'data', 'llamacpp', 'models'))), true);
  assert.equal(roots.some((root) => root.endsWith(path.join('Jan', 'data', 'mlx', 'models'))), true);
});

test('Hugging Face environment roots follow HF_HOME, HF_HUB_CACHE, and XDG cache locations', () => {
  const previous = {
    hfHome: process.env.HF_HOME,
    hfHubCache: process.env.HF_HUB_CACHE,
    xdgCacheHome: process.env.XDG_CACHE_HOME,
  };
  process.env.HF_HOME = path.join(os.tmpdir(), 'forkit-hf-home');
  process.env.HF_HUB_CACHE = path.join(os.tmpdir(), 'forkit-hf-hub');
  process.env.XDG_CACHE_HOME = path.join(os.tmpdir(), 'forkit-xdg-cache');
  try {
    const roots = getDefaultModelRoots();
    assert.equal(roots.includes(path.resolve(process.env.HF_HOME, 'hub')), true);
    assert.equal(roots.includes(path.resolve(process.env.HF_HUB_CACHE)), true);
    assert.equal(roots.includes(path.resolve(process.env.XDG_CACHE_HOME, 'huggingface', 'hub')), true);
  } finally {
    if (previous.hfHome === undefined) delete process.env.HF_HOME;
    else process.env.HF_HOME = previous.hfHome;
    if (previous.hfHubCache === undefined) delete process.env.HF_HUB_CACHE;
    else process.env.HF_HUB_CACHE = previous.hfHubCache;
    if (previous.xdgCacheHome === undefined) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = previous.xdgCacheHome;
  }
});

test('Hugging Face snapshots count a shared blob once across revisions', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-ai-footprints-hf-cache-'));
  const repo = path.join(root, 'models--acme--shared-model');
  const blob = path.join(repo, 'blobs', 'content-hash');
  const firstSnapshot = path.join(repo, 'snapshots', 'revision-a');
  const secondSnapshot = path.join(repo, 'snapshots', 'revision-b');
  fs.mkdirSync(path.dirname(blob), { recursive: true });
  fs.mkdirSync(firstSnapshot, { recursive: true });
  fs.mkdirSync(secondSnapshot, { recursive: true });
  fs.writeFileSync(blob, Buffer.alloc(53));
  fs.symlinkSync(path.relative(firstSnapshot, blob), path.join(firstSnapshot, 'model.safetensors'));
  fs.symlinkSync(path.relative(secondSnapshot, blob), path.join(secondSnapshot, 'model.safetensors'));
  try {
    const result = await scanFilesystemModels('2026-08-23T00:00:00.000Z', { roots: [root] });
    assert.equal(result.models.length, 1);
    assert.equal(result.models[0]?.name, 'acme/shared-model');
    assert.equal(result.models[0]?.size_bytes, 53);
    assert.equal(result.storage?.logical_bytes, 53);
    assert.equal(result.storage?.recognized_file_count, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Ollama content-addressed files contribute exact storage without creating a fake model record', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-ai-footprints-ollama-'));
  const root = path.join(home, '.ollama', 'models');
  const blobs = path.join(root, 'blobs');
  const manifests = path.join(root, 'manifests', 'registry.ollama.ai', 'library', 'tiny');
  fs.mkdirSync(blobs, { recursive: true });
  fs.mkdirSync(manifests, { recursive: true });
  fs.writeFileSync(path.join(blobs, `sha256-${'a'.repeat(64)}`), Buffer.alloc(40));
  fs.writeFileSync(path.join(manifests, 'latest'), Buffer.alloc(7));
  try {
    const result = await scanFilesystemModels('2026-08-23T00:00:00.000Z', { roots: [root] });
    assert.equal(result.models.length, 0);
    assert.equal(result.storage?.logical_bytes, 47);
    assert.equal(result.storage?.recognized_file_count, 2);
    assert.equal(result.storage?.complete, true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('storage ledger counts one physical file once across hard links and overlapping roots', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forkit-ai-footprints-storage-'));
  const nested = path.join(root, 'models');
  fs.mkdirSync(nested);
  const original = path.join(nested, 'weights.safetensors');
  fs.writeFileSync(original, Buffer.alloc(32));
  fs.linkSync(original, path.join(nested, 'weights-copy.safetensors'));
  try {
    const result = await scanFilesystemModels('2026-08-23T00:00:00.000Z', {
      roots: [root, nested],
    });
    assert.equal(result.storage?.logical_bytes, 32);
    assert.equal(result.storage?.recognized_file_count, 1);
    assert.equal(result.storage?.complete, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
