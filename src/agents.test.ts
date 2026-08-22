import assert from 'node:assert/strict';
import test from 'node:test';
import { detectAgentProducts } from './agents';

test('agent census requires exact tokens and rejects the known Agno false positive', () => {
  const agents = detectAgentProducts([
    { pid: 1, name: 'diagnostics_agent', cmd: '/usr/bin/diagnostics_agent --collect' },
    { pid: 2, name: 'python', cmd: 'python -m agno serve' },
  ]);
  assert.deepEqual(agents.map((agent) => agent.signature), ['agno']);
  assert.equal(agents[0]?.instance_count, 1);
  assert.equal(agents[0]?.confidence, 'medium');
});

test('agent census deduplicates process instances into one product', () => {
  const agents = detectAgentProducts([
    { pid: 10, name: 'codex', cmd: '/usr/local/bin/codex app-server' },
    { pid: 11, name: 'node', cmd: '/Applications/Codex.app/node codex worker' },
    { pid: 12, name: 'node', cmd: '/Applications/Codex.app/node codex diagnostics' },
  ]);
  assert.equal(agents.length, 1);
  assert.equal(agents[0]?.name, 'Codex');
  assert.equal(agents[0]?.instance_count, 3);
  assert.equal(agents[0]?.confidence, 'high');
});

test('agent census never exposes raw process commands', () => {
  const secret = 'sk-secret-value';
  const agents = detectAgentProducts([
    { pid: 21, name: 'python', cmd: `python -m langgraph --token ${secret}` },
  ]);
  const serialized = JSON.stringify(agents);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('--token'), false);
  assert.equal(agents[0]?.evidence_hashes[0]?.length, 64);
});
