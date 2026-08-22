import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { detectMcpConfigs } from './mcp';

test('MCP census reports only client and aggregate count, never names or values', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'census-mcp-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const cursor = path.join(root, '.cursor');
  await fs.mkdir(cursor, { recursive: true });
  await fs.writeFile(path.join(cursor, 'mcp.json'), JSON.stringify({
    mcpServers: {
      private_repository: { command: '/private/server', env: { TOKEN: 'secret-value' } },
      customer_database: { url: 'https://internal.invalid' },
    },
  }));
  const result = await detectMcpConfigs({ homeDir: root, cwd: root, env: {}, platform: 'linux' });
  assert.equal(result.find((entry) => entry.client === 'Cursor')?.server_count, 2);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /private_repository|customer_database|secret-value|private\/server|internal\.invalid/);
});

test('invalid, empty, and oversized MCP configs are ignored safely', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'census-mcp-negative-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, '.cursor'), { recursive: true });
  await fs.writeFile(path.join(root, '.cursor', 'mcp.json'), '{invalid');
  const result = await detectMcpConfigs({ homeDir: root, cwd: root, env: {}, platform: 'linux' });
  assert.deepEqual(result, []);
});
