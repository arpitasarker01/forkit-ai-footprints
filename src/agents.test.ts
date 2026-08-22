import assert from 'node:assert/strict';
import test from 'node:test';
import { detectAgentProducts } from './agents';

test('agent census requires executable or explicit invocation evidence', () => {
  const agents = detectAgentProducts([
    { pid: 1, name: 'diagnostics_agent', cmd: '/usr/bin/diagnostics_agent --collect' },
    { pid: 3, name: 'node', cmd: 'node agno-tooling diagnostics' },
    { pid: 4, name: 'cursor-helper', cmd: '/usr/bin/cursor-helper --type utility' },
    { pid: 5, name: 'grep', cmd: 'grep codex README.md' },
    { pid: 6, name: 'python3', cmd: 'python3 /tmp/claude report.py' },
    { pid: 2, name: 'python', cmd: 'python -m agno serve' },
  ]);
  assert.deepEqual(agents.map((agent) => agent.signature), ['agno']);
  assert.equal(agents[0]?.instance_count, 1);
  assert.equal(agents[0]?.confidence, 'medium');
});

test('agent census deduplicates process instances into one product', () => {
  const agents = detectAgentProducts([
    { pid: 10, name: 'codex', cmd: '/usr/local/bin/codex app-server', cpu_percent: 1.2, memory_percent: 0.5 },
    { pid: 11, name: 'node', cmd: 'node /usr/local/bin/.bin/codex worker', cpu_percent: 0.4, memory_percent: 0.2 },
    { pid: 12, name: 'npx', cmd: 'npx codex diagnostics', cpu_percent: 0, memory_percent: 0.1 },
  ]);
  assert.equal(agents.length, 1);
  assert.equal(agents[0]?.name, 'Codex');
  assert.equal(agents[0]?.instance_count, 3);
  assert.equal(agents[0]?.confidence, 'high');
  assert.equal(agents[0]?.detection_reason, 'exact_executable_match');
  assert.equal(agents[0]?.resource_snapshot.cpu_percent, 1.6);
  assert.equal(agents[0]?.resource_snapshot.memory_percent, 0.8);
  assert.equal(agents[0]?.resource_snapshot.measurement, 'point-in-time-process-metadata');
});

test('agent census rejects product words in unrelated arguments and paths', () => {
  const agents = detectAgentProducts([
    { pid: 30, name: 'grep', cmd: 'grep codex README.md' },
    { pid: 31, name: 'python3', cmd: 'python3 /tmp/claude report.py' },
    { pid: 32, name: 'node', cmd: 'node docs.js langchain' },
    { pid: 33, name: 'bash', cmd: 'bash -c "echo cursor"' },
  ]);
  assert.deepEqual(agents, []);
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
