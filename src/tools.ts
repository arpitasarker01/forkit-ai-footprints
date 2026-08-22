import fs from 'node:fs/promises';
import path from 'node:path';
import { stableId } from './hash';
import type { CensusAgent, CensusTool } from './types';

interface ToolDefinition {
  name: string;
  signatures: string[];
  commands: string[];
  configPaths: string[];
  appPaths?: string[];
}

export interface ToolDetectionOptions {
  homeDir: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  agents: CensusAgent[];
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function executableCandidates(command: string, platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  if (platform !== 'win32') return [command];
  const extensions = String(env.PATHEXT || '.EXE;.CMD;.BAT')
    .split(';')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return [command, ...extensions.map((extension) => `${command}${extension}`)];
}

async function commandExists(command: string, platform: NodeJS.Platform, env: NodeJS.ProcessEnv): Promise<boolean> {
  const directories = String(env.PATH || env.Path || env.path || '')
    .split(path.delimiter)
    .filter(Boolean)
    .slice(0, 256);
  const candidates = executableCandidates(command, platform, env);
  for (const directory of directories) {
    for (const candidate of candidates) {
      if (await exists(path.join(directory, candidate))) return true;
    }
  }
  return false;
}

function definitions(homeDir: string): ToolDefinition[] {
  return [
    { name: 'Claude Code', signatures: ['claude'], commands: ['claude'], configPaths: [path.join(homeDir, '.claude')] },
    { name: 'Codex', signatures: ['codex'], commands: ['codex'], configPaths: [path.join(homeDir, '.codex')], appPaths: ['/Applications/Codex.app', path.join(homeDir, 'Applications', 'Codex.app')] },
    { name: 'Cursor', signatures: ['cursor'], commands: ['cursor'], configPaths: [path.join(homeDir, '.cursor')], appPaths: ['/Applications/Cursor.app', path.join(homeDir, 'Applications', 'Cursor.app')] },
    { name: 'Windsurf', signatures: ['windsurf'], commands: ['windsurf'], configPaths: [path.join(homeDir, '.codeium', 'windsurf')], appPaths: ['/Applications/Windsurf.app', path.join(homeDir, 'Applications', 'Windsurf.app')] },
    { name: 'Gemini CLI', signatures: ['gemini-cli'], commands: ['gemini'], configPaths: [path.join(homeDir, '.gemini')] },
    { name: 'GitHub Copilot', signatures: ['github-copilot'], commands: [], configPaths: [] },
    { name: 'OpenCode', signatures: ['opencode'], commands: ['opencode'], configPaths: [path.join(homeDir, '.config', 'opencode')] },
    { name: 'OpenClaw', signatures: ['openclaw'], commands: ['openclaw'], configPaths: [path.join(homeDir, '.openclaw')] },
    { name: 'Jan', signatures: [], commands: ['jan'], configPaths: [path.join(homeDir, 'Library', 'Application Support', 'Jan')], appPaths: ['/Applications/Jan.app', path.join(homeDir, 'Applications', 'Jan.app')] },
    { name: 'LM Studio', signatures: [], commands: ['lms'], configPaths: [path.join(homeDir, '.lmstudio')], appPaths: ['/Applications/LM Studio.app', path.join(homeDir, 'Applications', 'LM Studio.app')] },
    { name: 'Zed', signatures: [], commands: ['zed'], configPaths: [path.join(homeDir, '.zed')], appPaths: ['/Applications/Zed.app', path.join(homeDir, 'Applications', 'Zed.app')] },
  ];
}

async function hasCopilotExtension(homeDir: string): Promise<boolean> {
  const roots = [
    path.join(homeDir, '.vscode', 'extensions'),
    path.join(homeDir, '.vscode-insiders', 'extensions'),
  ];
  for (const root of roots) {
    try {
      const names = await fs.readdir(root);
      if (names.some((name) => /^github\.copilot(?:-chat)?(?:-|$)/i.test(name))) return true;
    } catch {
      // Missing or unreadable extension roots are normal.
    }
  }
  return false;
}

export async function detectAiTools(options: ToolDetectionOptions): Promise<CensusTool[]> {
  const tools: CensusTool[] = [];
  for (const definition of definitions(options.homeDir)) {
    const detectorTypes = new Set<'config' | 'executable' | 'process'>();
    const matchingAgents = options.agents.filter((agent) => definition.signatures.includes(agent.signature));
    if (matchingAgents.length > 0) detectorTypes.add('process');
    const commandInstalled = (await Promise.all(definition.commands.map((command) => commandExists(command, options.platform, options.env)))).some(Boolean);
    const appInstalled = options.platform === 'darwin'
      && (await Promise.all((definition.appPaths ?? []).map((targetPath) => exists(targetPath)))).some(Boolean);
    if (commandInstalled || appInstalled) {
      detectorTypes.add('executable');
    }
    const configured = definition.name === 'GitHub Copilot'
      ? await hasCopilotExtension(options.homeDir)
      : (await Promise.all(definition.configPaths.map((targetPath) => exists(targetPath)))).some(Boolean);
    if (configured) detectorTypes.add('config');
    if (detectorTypes.size === 0) continue;
    const instanceCount = matchingAgents.reduce((total, agent) => total + agent.instance_count, 0);
    tools.push({
      tool_id: stableId('tool', definition.name),
      name: definition.name,
      evidence_status: detectorTypes.has('process') ? 'online' : 'configured',
      confidence: detectorTypes.has('process') || detectorTypes.size >= 2 ? 'high' : 'medium',
      detector_types: [...detectorTypes].sort(),
      instance_count: instanceCount,
    });
  }
  return tools.sort((left, right) => left.name.localeCompare(right.name));
}
