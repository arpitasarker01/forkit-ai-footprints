import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyLoadedRuntimeProcesses } from './runtime-activity';

test('runtime process is monitored only while provider reports a loaded model', () => {
  const processes = [{ pid: 10, ppid: 1, name: 'ollama', cmd: '/opt/ollama serve', cpu_time_ms: 100 }];
  assert.deepEqual(classifyLoadedRuntimeProcesses(processes, new Set(), null), []);
  const loaded = classifyLoadedRuntimeProcesses(processes, new Set(['ollama']), null);
  assert.equal(loaded[0]?.signature, 'runtime:ollama');
  assert.equal(loaded[0]?.name, 'Ollama');
});
