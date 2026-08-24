import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ActivityContext } from './monitor';

type SqliteReader = (databasePath: string, query: string) => Promise<string>;

interface ContextCandidate {
  chat: string;
  workspace: string;
  recency_ms: number;
}

export interface CodexWorkflowContextOptions {
  homeDir?: string;
  now?: () => number;
  maxAgeMs?: number;
  cacheMs?: number;
  readSqlite?: SqliteReader;
}

const execFileAsync = promisify(execFile);
const EMPTY_CONTEXT: ActivityContext = { chat: null, workspace: null, source: null };

function cleanLabel(value: unknown, maxLength = 120): string | null {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function parseCandidates(value: string): ContextCandidate[] {
  try {
    const rows = JSON.parse(value) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
      const chat = cleanLabel(row.chat);
      const cwd = cleanLabel(row.cwd, 2048);
      const recency = Number(row.recency_ms);
      if (!chat || !cwd || !Number.isFinite(recency) || recency <= 0) return [];
      const workspace = cleanLabel(path.basename(cwd));
      return workspace ? [{ chat, workspace, recency_ms: recency }] : [];
    });
  } catch {
    return [];
  }
}

async function systemSqliteReader(databasePath: string, query: string): Promise<string> {
  const { stdout } = await execFileAsync('/usr/bin/sqlite3', ['-readonly', '-json', databasePath, query], {
    encoding: 'utf8',
    maxBuffer: 1_000_000,
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
  });
  return stdout;
}

async function readIfAvailable(readSqlite: SqliteReader, databasePath: string, query: string): Promise<ContextCandidate[]> {
  try {
    return parseCandidates(await readSqlite(databasePath, query));
  } catch {
    return [];
  }
}

export function createLocalWorkflowContextProvider(options: CodexWorkflowContextOptions = {}): (signature: string) => Promise<ActivityContext> {
  const homeDir = options.homeDir ?? process.env.HOME ?? '';
  const now = options.now ?? Date.now;
  const maxAgeMs = Math.max(60_000, options.maxAgeMs ?? 15 * 60_000);
  const cacheMs = Math.max(1_000, options.cacheMs ?? 5_000);
  const readSqlite = options.readSqlite ?? systemSqliteReader;
  let cachedAt = 0;
  let cachedContext: ActivityContext = EMPTY_CONTEXT;

  return async (signature: string): Promise<ActivityContext> => {
    const explicitChat = cleanLabel(process.env.FORKIT_AI_FOOTPRINTS_CONTEXT_CHAT);
    const explicitWorkspace = cleanLabel(process.env.FORKIT_AI_FOOTPRINTS_CONTEXT_WORKSPACE);
    if (explicitChat || explicitWorkspace) {
      return { chat: explicitChat, workspace: explicitWorkspace, source: 'cooperating-app-metadata' };
    }
    if (signature !== 'codex' || !homeDir) return EMPTY_CONTEXT;
    const currentTime = now();
    if (cachedAt > 0 && currentTime - cachedAt < cacheMs) return cachedContext;
    cachedAt = currentTime;

    const catalog = path.join(homeDir, '.codex', 'sqlite', 'codex-dev.db');
    const state = path.join(homeDir, '.codex', 'state_5.sqlite');
    const [catalogCandidates, stateCandidates] = await Promise.all([
      readIfAvailable(readSqlite, catalog, `
        SELECT display_title AS chat, cwd, CAST(source_recency_at * 1000 AS INTEGER) AS recency_ms
        FROM local_thread_catalog
        WHERE missing_candidate = 0 AND display_title <> '' AND cwd IS NOT NULL AND cwd <> ''
        ORDER BY source_recency_at DESC LIMIT 1;
      `),
      readIfAvailable(readSqlite, state, `
        SELECT name AS chat, cwd, recency_at_ms AS recency_ms
        FROM threads
        WHERE archived = 0 AND name IS NOT NULL AND name <> '' AND cwd <> ''
        ORDER BY recency_at_ms DESC LIMIT 1;
      `),
    ]);
    const latest = [...catalogCandidates, ...stateCandidates]
      .sort((left, right) => right.recency_ms - left.recency_ms)[0];
    cachedContext = latest && currentTime - latest.recency_ms <= maxAgeMs
      ? { chat: latest.chat, workspace: latest.workspace, source: 'codex-local-metadata' }
      : EMPTY_CONTEXT;
    return cachedContext;
  };
}

