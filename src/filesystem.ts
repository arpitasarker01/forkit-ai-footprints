import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stableId } from './hash';
import { createModel, createRuntime } from './providers/base';
import type { CensusModel, RuntimeScanResult } from './types';

const MODEL_EXTENSIONS = new Set([
  '.bin',
  '.ggml',
  '.gguf',
  '.onnx',
  '.pt',
  '.pth',
  '.safetensors',
]);
const DEFAULT_MIN_BYTES = 1;
const DEFAULT_MAX_DEPTH = 32;
const DEFAULT_MAX_FILES = 100_000;

interface ModelFile {
  root: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  extension: string;
  modelName: string;
  sourceKind: 'huggingface-cache' | 'configured-model-root' | 'ollama-store';
  fileIdentity: string;
  inventoryModel: boolean;
}

interface CollectionState {
  files: ModelFile[];
  seenFileIdentities: Set<string>;
  limitReached: boolean;
}

export interface FilesystemScanOptions {
  roots?: string[];
  minBytes?: number;
  maxDepth?: number;
  maxFiles?: number;
}

function configuredRootsFromEnvironment(): string[] {
  return String(process.env.FORKIT_CENSUS_MODEL_DIRS ?? '')
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getDefaultModelRoots(): string[] {
  const home = os.homedir();
  const janData = path.join(home, 'Library', 'Application Support', 'Jan', 'data');
  const candidates = [
    ...configuredRootsFromEnvironment(),
    path.join(home, '.cache', 'huggingface', 'hub'),
    path.join(home, '.ollama', 'models'),
    process.env.HF_HOME ? path.join(process.env.HF_HOME, 'hub') : '',
    process.env.HF_HUB_CACHE ?? '',
    path.join(home, '.cache', 'lm-studio', 'models'),
    path.join(home, '.lmstudio', 'models'),
    path.join(janData, 'llamacpp', 'models'),
    path.join(janData, 'mlx', 'models'),
    path.join(home, 'models'),
    path.join(home, 'model'),
    path.join(home, 'ai', 'models'),
    path.join(home, '.cache', 'mlx-models'),
  ];
  return [...new Set(candidates.filter(Boolean).map((entry) => path.resolve(entry)))];
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    return (await fs.stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

function huggingFaceName(relativePath: string): string | null {
  const marker = relativePath
    .split(/[\\/]/)
    .find((part) => part.startsWith('models--'));
  return marker?.replace(/^models--/, '').replaceAll('--', '/') || null;
}

function genericModelName(relativePath: string): string {
  const parsed = path.parse(relativePath);
  const base = parsed.name;
  if (!['model', 'pytorch_model', 'consolidated', 'weights', 'adapter_model'].includes(base.toLowerCase())) {
    return base.replace(/[-_.]?\d{1,5}-of-\d{1,5}$/i, '') || base;
  }
  return path.basename(parsed.dir) || base;
}

function ollamaStorageFile(root: string, relativePath: string): boolean {
  if (!root.replaceAll('\\', '/').endsWith('/.ollama/models')) return false;
  const normalized = relativePath.replaceAll('\\', '/');
  return normalized.startsWith('blobs/sha256-') || normalized.startsWith('manifests/');
}

async function collectFiles(
  root: string,
  directory: string,
  depth: number,
  options: Required<Pick<FilesystemScanOptions, 'minBytes' | 'maxDepth' | 'maxFiles'>>,
  state: CollectionState,
): Promise<void> {
  if (depth > options.maxDepth || state.files.length >= options.maxFiles) {
    state.limitReached = true;
    return;
  }
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (state.files.length >= options.maxFiles) {
      state.limitReached = true;
      return;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(root, absolutePath, depth + 1, options, state);
      continue;
    }
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    try {
      const stat = await fs.stat(absolutePath);
      if (!stat.isFile()) continue;
      const relativePath = path.relative(root, absolutePath);
      const isOllamaStorage = ollamaStorageFile(root, relativePath);
      const extension = path.extname(entry.name).toLowerCase();
      if (!isOllamaStorage && !MODEL_EXTENSIONS.has(extension)) continue;
      if (!isOllamaStorage && stat.size < options.minBytes) continue;
      const fileIdentity = `${stat.dev}:${stat.ino}`;
      if (state.seenFileIdentities.has(fileIdentity)) continue;
      state.seenFileIdentities.add(fileIdentity);
      const hfName = huggingFaceName(relativePath);
      state.files.push({
        root,
        relativePath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        extension,
        modelName: isOllamaStorage ? 'ollama-storage' : hfName ?? genericModelName(relativePath),
        sourceKind: isOllamaStorage ? 'ollama-store' : hfName ? 'huggingface-cache' : 'configured-model-root',
        fileIdentity,
        inventoryModel: !isOllamaStorage,
      });
    } catch {
      // A file can disappear between directory enumeration and stat.
    }
  }
}

function collapseFiles(files: ModelFile[]): CensusModel[] {
  const groups = new Map<string, ModelFile[]>();
  for (const file of files.filter((entry) => entry.inventoryModel)) {
    const key = `${file.root}:${file.sourceKind}:${file.modelName}`;
    groups.set(key, [...(groups.get(key) ?? []), file]);
  }

  return [...groups.values()].map((group) => {
    const first = group[0]!;
    const evidence = group
      .map((file) => `${file.relativePath}:${file.size}:${file.modifiedAt}`)
      .sort()
      .join('|');
    const identity = createHash('sha256').update(evidence, 'utf8').digest('hex');
    const modifiedAt = group.map((file) => file.modifiedAt).sort().at(-1) ?? null;
    return createModel({
      name: first.modelName,
      runtime: 'filesystem',
      identityKind: 'metadata-sha256',
      identity,
      source: 'filesystem',
      confidence: 'low',
      sizeBytes: group.reduce((total, file) => total + file.size, 0),
      modifiedAt,
      locationHint: first.sourceKind,
    });
  }).sort((left, right) => left.name.localeCompare(right.name));
}

export async function scanFilesystemModels(
  observedAt: string,
  input: FilesystemScanOptions = {},
): Promise<RuntimeScanResult> {
  const roots = [...new Set((input.roots ?? getDefaultModelRoots()).map((entry) => path.resolve(entry)))];
  const existingRoots = (await Promise.all(roots.map(async (root) => ({
    root,
    exists: await directoryExists(root),
  })))).filter((entry) => entry.exists).map((entry) => entry.root);
  const state: CollectionState = { files: [], seenFileIdentities: new Set(), limitReached: false };
  const options = {
    minBytes: input.minBytes ?? DEFAULT_MIN_BYTES,
    maxDepth: input.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxFiles: input.maxFiles ?? DEFAULT_MAX_FILES,
  };
  for (const root of existingRoots) {
    await collectFiles(root, root, 0, options, state);
  }
  const models = collapseFiles(state.files);
  const logicalBytes = state.files.reduce((total, file) => total + file.size, 0);
  return {
    runtime: createRuntime({
      name: 'filesystem',
      endpoint: null,
      status: existingRoots.length > 0 ? 'inventory-only' : 'unavailable',
      modelCount: models.length,
      observedAt,
      errorCode: existingRoots.length > 0 ? null : 'no_model_directories_found',
    }),
    models,
    storage: {
      logical_bytes: logicalBytes,
      recognized_file_count: state.files.length,
      complete: !state.limitReached,
      measurement: 'recognized-logical-file-bytes',
    },
    warnings: models.length > 0 ? [
      {
        code: 'filesystem_identity_is_metadata_only',
        message: 'Filesystem identities use names, sizes, and modification times; model bytes were not read.',
        scope: 'model',
      },
      {
        code: 'filesystem_detection_is_best_effort',
        message: 'Filesystem findings are best-effort suggestions and may include unrelated weight-like files or miss unsupported locations.',
        scope: 'model',
      },
      ...(state.limitReached ? [{
        code: 'filesystem_scan_limit_reached',
        message: 'The recognized model-file total is incomplete because the local safety limit was reached.',
        scope: 'model' as const,
      }] : []),
    ] : [],
  };
}

export function filesystemRootFingerprint(root: string): string {
  return stableId('root', path.resolve(root));
}
