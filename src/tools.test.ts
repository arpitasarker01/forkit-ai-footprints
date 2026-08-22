import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { detectAiTools } from './tools';
import type { CensusAgent } from './types';

function agent(signature: string, name: string): CensusAgent {
  return {
    agent_id: `agent_${signature}`,
    name,
    signature,
    kind: 'coding-agent',
    confidence: 'high',
    instance_count: 3,
    executable_names: [signature],
    evidence_hashes: ['safe-hash'],
    detection_reason: 'exact_executable_match',
    evidence_status: 'online',
    resource_snapshot: {
      cpu_percent: 0.5,
      memory_percent: 0.2,
      measurement: 'point-in-time-process-metadata',
    },
  };
}

test('tool detection merges executable, config, and process evidence into one product', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'census-tools-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  await fs.mkdir(path.join(root, '.codex'), { recursive: true });
  await fs.mkdir(bin, { recursive: true });
  await fs.writeFile(path.join(bin, 'codex'), 'placeholder');
  const tools = await detectAiTools({
    homeDir: root,
    env: { PATH: bin },
    platform: 'linux',
    agents: [agent('codex', 'Codex')],
  });
  const codex = tools.find((tool) => tool.name === 'Codex');
  assert.deepEqual(codex?.detector_types, ['config', 'executable', 'process']);
  assert.equal(codex?.evidence_status, 'online');
  assert.equal(codex?.instance_count, 3);
  assert.equal(tools.filter((tool) => tool.name === 'Codex').length, 1);
});

test('generic VS Code install is not mislabeled as GitHub Copilot', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'census-tools-negative-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, '.vscode', 'extensions', 'some.publisher-1.0.0'), { recursive: true });
  const tools = await detectAiTools({ homeDir: root, env: { PATH: '' }, platform: 'linux', agents: [] });
  assert.equal(tools.some((tool) => tool.name === 'GitHub Copilot'), false);
});

test('macOS application bundles provide installation evidence without claiming online state', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'census-tools-macos-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'Applications', 'Codex.app'), { recursive: true });
  await fs.mkdir(path.join(root, 'Applications', 'Jan.app'), { recursive: true });
  const tools = await detectAiTools({ homeDir: root, env: { PATH: '' }, platform: 'darwin', agents: [] });
  for (const name of ['Codex', 'Jan']) {
    const finding = tools.find((tool) => tool.name === name);
    assert.equal(finding?.evidence_status, 'configured');
    assert.equal(finding?.confidence, 'medium');
    assert.deepEqual(finding?.detector_types, ['executable']);
  }
});
