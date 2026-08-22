import fs from 'node:fs/promises';
import path from 'node:path';
import type { CensusMcpConfig } from './types';

interface McpConfigCandidate {
  client: string;
  filePath: string;
  format: 'json' | 'toml';
}

export interface McpDetectionOptions {
  homeDir: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
}

function configRoot(options: McpDetectionOptions): string {
  if (options.platform === 'win32') {
    return options.env.APPDATA || path.join(options.homeDir, 'AppData', 'Roaming');
  }
  if (options.platform === 'darwin') return path.join(options.homeDir, 'Library', 'Application Support');
  return options.env.XDG_CONFIG_HOME || path.join(options.homeDir, '.config');
}

function candidates(options: McpDetectionOptions): McpConfigCandidate[] {
  const root = configRoot(options);
  return [
    { client: 'Claude Desktop', filePath: path.join(root, 'Claude', 'claude_desktop_config.json'), format: 'json' },
    { client: 'Claude Code', filePath: path.join(options.homeDir, '.claude.json'), format: 'json' },
    { client: 'Codex', filePath: path.join(options.homeDir, '.codex', 'config.toml'), format: 'toml' },
    { client: 'Cursor', filePath: path.join(options.homeDir, '.cursor', 'mcp.json'), format: 'json' },
    { client: 'Cursor (workspace)', filePath: path.join(options.cwd, '.cursor', 'mcp.json'), format: 'json' },
    { client: 'Windsurf', filePath: path.join(options.homeDir, '.codeium', 'windsurf', 'mcp_config.json'), format: 'json' },
    { client: 'VS Code', filePath: path.join(root, 'Code', 'User', 'mcp.json'), format: 'json' },
    { client: 'Gemini CLI', filePath: path.join(options.homeDir, '.gemini', 'settings.json'), format: 'json' },
    { client: 'OpenCode', filePath: path.join(options.homeDir, '.config', 'opencode', 'opencode.json'), format: 'json' },
  ];
}

function jsonServerCount(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  const record = value as Record<string, unknown>;
  if (record.mcpServers && typeof record.mcpServers === 'object' && !Array.isArray(record.mcpServers)) {
    return Object.keys(record.mcpServers as Record<string, unknown>).length;
  }
  if (record.mcp && typeof record.mcp === 'object' && !Array.isArray(record.mcp)) {
    const servers = (record.mcp as Record<string, unknown>).servers;
    if (servers && typeof servers === 'object' && !Array.isArray(servers)) {
      return Object.keys(servers as Record<string, unknown>).length;
    }
  }
  return 0;
}

async function inspect(candidate: McpConfigCandidate): Promise<CensusMcpConfig | null> {
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    handle = await fs.open(candidate.filePath, 'r');
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > 1024 * 1024) return null;
    const content = await handle.readFile({ encoding: 'utf8' });
    const serverCount = candidate.format === 'json'
      ? jsonServerCount(JSON.parse(content) as unknown)
      : [...content.matchAll(/^\s*\[mcp_servers\.[^\]]+\]\s*$/gm)].length;
    if (serverCount === 0) return null;
    return {
      client: candidate.client,
      evidence_status: 'configured',
      confidence: 'high',
      server_count: serverCount,
    };
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export async function detectMcpConfigs(options: McpDetectionOptions): Promise<CensusMcpConfig[]> {
  const findings = await Promise.all(candidates(options).map((candidate) => inspect(candidate)));
  return findings
    .filter((finding): finding is CensusMcpConfig => finding !== null)
    .sort((left, right) => left.client.localeCompare(right.client));
}
