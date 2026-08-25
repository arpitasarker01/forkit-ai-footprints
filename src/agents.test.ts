import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAgentProcessTrees, detectAgentProducts } from './agents';

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

test('agent census detects common local AI apps without making Codex special', () => {
  const agents = detectAgentProducts([
    { pid: 40, name: 'ChatGPT', cmd: '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT', cpu_percent: 2, memory_percent: 1 },
    { pid: 41, name: 'Jan', cmd: '/Applications/Jan.app/Contents/MacOS/Jan', cpu_percent: 3, memory_percent: 1 },
    { pid: 42, name: 'LM Studio', cmd: '/Applications/LM Studio.app/Contents/MacOS/LM Studio', cpu_percent: 4, memory_percent: 1 },
    { pid: 43, name: 'open-webui', cmd: 'open-webui serve', cpu_percent: 5, memory_percent: 1 },
  ]);
  assert.deepEqual(agents.map((agent) => agent.signature).sort(), ['chatgpt', 'jan', 'lm-studio', 'open-webui']);
  assert.deepEqual([...new Set(agents.map((agent) => agent.kind))], ['ai-app']);
});

test('agent census collapses Codex embedded inside ChatGPT into one local app stack', () => {
  const processes = [
    { pid: 100, ppid: 1, name: 'ChatGPT', cmd: '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT', cpu_percent: 2, memory_percent: 1, rss_bytes: 100_000_000 },
    { pid: 101, ppid: 100, name: 'codex', cmd: '/Applications/ChatGPT.app/Contents/Resources/codex app-server', cpu_percent: 3, memory_percent: 1, rss_bytes: 50_000_000 },
    { pid: 102, ppid: 101, name: 'node', cmd: '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node worker.js', cpu_percent: 4, memory_percent: 1, rss_bytes: 25_000_000 },
  ];
  const agents = detectAgentProducts(processes);
  assert.equal(agents.length, 1);
  assert.equal(agents[0]?.signature, 'chatgpt-codex');
  assert.equal(agents[0]?.name, 'ChatGPT · Codex');
  assert.equal(agents[0]?.instance_count, 2);
  const trees = classifyAgentProcessTrees(processes, null);
  assert.deepEqual([...new Set(trees.map((entry) => entry.signature))], ['chatgpt-codex']);
  assert.equal(trees.length, 3);
});

test('agent census keeps standalone ChatGPT and standalone Codex separate', () => {
  const agents = detectAgentProducts([
    { pid: 110, ppid: 1, name: 'ChatGPT', cmd: '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT' },
    { pid: 120, ppid: 1, name: 'codex', cmd: '/opt/homebrew/bin/codex app-server' },
  ]);
  assert.deepEqual(agents.map((agent) => agent.signature).sort(), ['chatgpt', 'codex']);
});

test('agent census rejects orphaned ChatGPT Codex crash and update helpers', () => {
  const processes = [
    {
      pid: 130,
      ppid: 1,
      name: '/Applications/ChatGPT.app/Contents/Frameworks/Codex Framework.framework/Versions/150.0.7871.124/Helpers/browser_crashpad_handler',
      cmd: '/Applications/ChatGPT.app/Contents/Frameworks/Codex Framework.framework/Versions/150.0.7871.124/Helpers/browser_crashpad_handler --monitor-self --annotation=prod=ChatGPT_Mac',
    },
    {
      pid: 131,
      ppid: 1,
      name: 'browser_crashpad_handler',
      cmd: '/Applications/ChatGPT.app/Contents/Frameworks/Codex Framework.framework/Versions/151.0.7922.170/Helpers/browser_crashpad_handler --no-periodic-tasks',
    },
    {
      pid: 132,
      ppid: 1,
      name: 'Autoupdate',
      cmd: '/Applications/ChatGPT.app/Contents/Frameworks/Sparkle.framework/Versions/B/Autoupdate com.openai.codex /Users/example',
    },
    {
      pid: 133,
      ppid: 1,
      name: 'Updater',
      cmd: '/Users/example/Library/Caches/com.openai.codex/org.sparkle-project.Sparkle/Launcher/Updater.app/Contents/MacOS/Updater /Applications/ChatGPT.app 0',
    },
  ];
  assert.deepEqual(detectAgentProducts(processes), []);
  assert.deepEqual(classifyAgentProcessTrees(processes, null), []);
});

test('agent census treats ChatGPT Codex renderer and service helpers as descendants, not direct agents', () => {
  const processes = [
    { pid: 140, ppid: 1, name: 'ChatGPT', cmd: '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT' },
    { pid: 141, ppid: 140, name: 'codex', cmd: '/Applications/ChatGPT.app/Contents/Resources/codex app-server' },
    {
      pid: 142,
      ppid: 140,
      name: 'Codex (Renderer)',
      cmd: '/Applications/ChatGPT.app/Contents/Frameworks/Codex Framework.framework/Versions/151.0.7922.170/Helpers/Codex (Renderer).app/Contents/MacOS/Codex (Renderer) --type=renderer',
    },
    {
      pid: 143,
      ppid: 140,
      name: 'Codex (Service)',
      cmd: '/Applications/ChatGPT.app/Contents/Frameworks/Codex Framework.framework/Versions/151.0.7922.170/Helpers/Codex (Service).app/Contents/MacOS/Codex (Service) --type=utility',
    },
  ];
  const agents = detectAgentProducts(processes);
  assert.equal(agents.length, 1);
  assert.equal(agents[0]?.signature, 'chatgpt-codex');
  assert.equal(agents[0]?.instance_count, 2);
  const trees = classifyAgentProcessTrees(processes, null);
  assert.equal(trees.find((entry) => entry.pid === 142)?.relationship, 'descendant');
  assert.equal(trees.find((entry) => entry.pid === 142)?.activity_signal, false);
  assert.equal(trees.find((entry) => entry.pid === 143)?.activity_signal, false);
});

test('agent census rejects product words in unrelated arguments and paths', () => {
  const agents = detectAgentProducts([
    { pid: 30, name: 'grep', cmd: 'grep codex README.md' },
    { pid: 31, name: 'python3', cmd: 'python3 /tmp/claude report.py' },
    { pid: 32, name: 'node', cmd: 'node docs.js langchain' },
    { pid: 33, name: 'bash', cmd: 'bash -c "echo cursor"' },
    { pid: 34, name: 'node', cmd: 'node chatgpt-notes.js' },
    { pid: 35, name: 'python', cmd: 'python lm-studio-report.py' },
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
