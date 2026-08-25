import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalWorkflowContextProvider } from './workflow-context';

test('Codex context uses the freshest local title and only the project folder name', async () => {
  const now = 1_800_000_000_000;
  const provider = createLocalWorkflowContextProvider({
    homeDir: '/Users/example', now: () => now, cacheMs: 1_000,
    readSqlite: async (database) => database.endsWith('codex-dev.db')
      ? JSON.stringify([{ chat: 'German Version', cwd: '/Users/example/work/Forkit_Dev_OS_worktree', recency_ms: now - 4_000 }])
      : JSON.stringify([{ chat: 'Forkit Census', cwd: '/Users/example/work/Forkit_Dev_OS_worktree', recency_ms: now - 2_000 }]),
    runGit: async (_cwd, args) => args[0] === 'status'
      ? '## syedofc/harden-macos-accuracy...origin/syedofc/harden-macos-accuracy [ahead 7]\n M src/server.ts\n'
      : '10\t4\tsrc/server.ts\n2\t1\tsrc/share-page.ts\n',
  });
  assert.deepEqual(await provider('codex'), {
    chat: 'Forkit Census', workspace: 'Forkit_Dev_OS_worktree', branch: 'syedofc/harden-macos-accuracy',
    changes_added: 12, changes_removed: 5, checks: null, source: 'codex-local-metadata',
  });
});

test('embedded ChatGPT Codex context uses the same local Codex metadata boundary', async () => {
  const now = 1_800_000_000_000;
  const provider = createLocalWorkflowContextProvider({
    homeDir: '/Users/example', now: () => now, cacheMs: 1_000,
    readSqlite: async () => JSON.stringify([{ chat: 'Forkit Census', cwd: '/Users/example/work/Forkit_Dev_OS_worktree', recency_ms: now - 2_000 }]),
    runGit: async (_cwd, args) => args[0] === 'status'
      ? '## syedofc/harden-macos-accuracy\n'
      : '',
  });
  assert.deepEqual(await provider('chatgpt-codex'), {
    chat: 'Forkit Census', workspace: 'Forkit_Dev_OS_worktree', branch: 'syedofc/harden-macos-accuracy',
    changes_added: 0, changes_removed: 0, checks: null, source: 'codex-local-metadata',
  });
});

test('Codex context rejects stale titles and ignores unrelated products', async () => {
  const now = 1_800_000_000_000;
  let reads = 0;
  const provider = createLocalWorkflowContextProvider({
    homeDir: '/Users/example', now: () => now, maxAgeMs: 60_000,
    readSqlite: async () => { reads += 1; return JSON.stringify([{ chat: 'Old task', cwd: '/tmp/project', recency_ms: now - 61_000 }]); },
  });
  assert.deepEqual(await provider('cursor'), { chat: null, workspace: null, source: null });
  assert.equal(reads, 0);
  assert.deepEqual(await provider('codex'), { chat: null, workspace: null, source: null });
  assert.equal(reads, 2);
});

test('Codex context is defensive when local databases are unavailable', async () => {
  const provider = createLocalWorkflowContextProvider({
    homeDir: '/Users/example', readSqlite: async () => { throw new Error('missing'); },
  });
  assert.deepEqual(await provider('codex'), { chat: null, workspace: null, source: null });
});
