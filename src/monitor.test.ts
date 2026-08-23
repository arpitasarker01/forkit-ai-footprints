import assert from 'node:assert/strict';
import test from 'node:test';
import { ActivityMonitor } from './monitor';
import type { ProcessEntry } from './types';

function codex(pid: number, cpuTime: number, cpu = 0): ProcessEntry {
  return { pid, ppid: 1, name: 'codex', cmd: '/opt/codex app-server', cpu_time_ms: cpuTime, cpu_percent: cpu, memory_percent: 1 };
}

test('monitor requires repeated CPU-time deltas before working-now and uses hysteresis', async () => {
  let now = 0;
  const frames: ProcessEntry[][] = [
    [codex(10, 100)],
    [codex(10, 140, 4)],
    [codex(10, 180, 4)],
    [codex(10, 180)],
    [codex(10, 180)],
    [codex(10, 180)],
  ];
  const monitor = new ActivityMonitor({
    now: () => now,
    intervalMs: 1000,
    excludedRootPid: null,
    sampleProcesses: async () => frames.shift() ?? [],
  });
  await monitor.start({ schedule: false });
  assert.equal(monitor.snapshot().products[0]?.state, 'open-idle');
  now += 1000; await monitor.sampleNow();
  assert.equal(monitor.snapshot().products[0]?.state, 'open-idle');
  now += 1000; await monitor.sampleNow();
  assert.equal(monitor.snapshot().products[0]?.state, 'working-now');
  now += 1000; await monitor.sampleNow();
  assert.equal(monitor.snapshot().products[0]?.state, 'working-now');
  now += 1000; await monitor.sampleNow();
  assert.equal(monitor.snapshot().products[0]?.state, 'working-now');
  now += 1000; await monitor.sampleNow();
  const stopped = monitor.stop();
  assert.equal(stopped.products[0]?.state, 'open-idle');
  assert.equal(stopped.observed_seconds, 5);
  assert.equal(stopped.active_seconds, 3);
  assert.equal(stopped.activity_ratio, 0.6);
});

test('process existence alone never becomes working and sleep gaps are excluded', async () => {
  let now = 0;
  let cpuTime = 10;
  const monitor = new ActivityMonitor({
    now: () => now,
    intervalMs: 1000,
    excludedRootPid: null,
    sampleProcesses: async () => [codex(10, cpuTime)],
  });
  await monitor.start({ schedule: false });
  now += 1000; await monitor.sampleNow();
  now += 10_000; cpuTime += 500; await monitor.sampleNow();
  const snapshot = monitor.stop();
  assert.equal(snapshot.products[0]?.state, 'open-idle');
  assert.equal(snapshot.observed_seconds, 1);
  assert.equal(snapshot.active_seconds, 0);
});

test('monitor includes supported descendants but excludes its own process tree', async () => {
  let now = 0;
  const frame = (rootTime: number, childTime: number): ProcessEntry[] => [
    { pid: 100, ppid: 1, name: 'codex', cmd: '/opt/codex', cpu_time_ms: rootTime },
    { pid: 101, ppid: 100, name: 'helper', cmd: '/opt/helper', cpu_time_ms: childTime },
    { pid: 200, ppid: 1, name: 'node', cmd: '/opt/forkit', cpu_time_ms: 100 },
    { pid: 201, ppid: 200, name: 'codex', cmd: '/opt/codex diagnostics', cpu_time_ms: 1000 },
  ];
  let current = frame(10, 10);
  const monitor = new ActivityMonitor({
    now: () => now,
    intervalMs: 1000,
    excludedRootPid: 200,
    sampleProcesses: async () => current,
  });
  await monitor.start({ schedule: false });
  now += 1000; current = frame(30, 30); await monitor.sampleNow();
  now += 1000; current = frame(50, 50); await monitor.sampleNow();
  const product = monitor.stop().products[0];
  assert.equal(product?.process_count, 2);
  assert.equal(product?.recent_cpu_time_delta_ms, 40);
  assert.equal(product?.state, 'working-now');
});

test('clearHistory removes durations and bounded timeline data', async () => {
  let now = 0;
  let frame: ProcessEntry[] = [codex(10, 0)];
  const monitor = new ActivityMonitor({ now: () => now, excludedRootPid: null, sampleProcesses: async () => frame });
  await monitor.start({ schedule: false });
  now += 1000; frame = []; await monitor.sampleNow();
  const cleared = monitor.clearHistory();
  assert.equal(cleared.observed_seconds, 0);
  assert.equal(cleared.active_seconds, 0);
  assert.deepEqual(cleared.products, []);
  assert.deepEqual(cleared.timeline, []);
});
