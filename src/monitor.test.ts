import assert from 'node:assert/strict';
import test from 'node:test';
import { ActivityMonitor } from './monitor';
import type { ProcessEntry } from './types';

function codex(pid: number, cpuTime: number, cpu = 0): ProcessEntry {
  return { pid, ppid: 1, name: 'codex', cmd: '/opt/codex app-server', cpu_time_ms: cpuTime, cpu_percent: cpu, memory_percent: 1, rss_bytes: 50_000_000 };
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
  assert.equal(monitor.snapshot().products[0]?.cpu_percent, 4);
  assert.equal(monitor.snapshot().products[0]?.memory_bytes, 50_000_000);
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
  assert.equal(snapshot.timeline.length, 2);
  assert.notEqual(snapshot.timeline[0]?.observation_id, snapshot.timeline[1]?.observation_id);
});

test('locked or inactive device time is paused and breaks activity continuity', async () => {
  let now = 0;
  let cpuTime = 10;
  let eligible = true;
  const monitor = new ActivityMonitor({
    now: () => now,
    intervalMs: 1000,
    excludedRootPid: null,
    devicePresence: async () => ({ state: eligible ? 'active' : 'idle', idle_seconds: eligible ? 2 : 61, observation_eligible: eligible }),
    sampleProcesses: async () => [codex(10, cpuTime)],
  });
  await monitor.start({ schedule: false });
  now += 1000; cpuTime += 40; await monitor.sampleNow();
  now += 1000; cpuTime += 40; await monitor.sampleNow();
  const beforePause = monitor.snapshot();
  assert.equal(beforePause.observed_seconds, 2);
  assert.equal(beforePause.active_seconds, 1);
  eligible = false;
  now += 1000; cpuTime += 400; await monitor.sampleNow();
  now += 1000; cpuTime += 400; await monitor.sampleNow();
  const paused = monitor.snapshot();
  assert.equal(paused.observed_seconds, 2);
  assert.equal(paused.active_seconds, 1);
  assert.equal(paused.presence.state, 'idle');
  assert.equal(paused.products[0]?.state, 'open-idle');
  eligible = true;
  now += 1000; cpuTime += 400; await monitor.sampleNow();
  assert.equal(monitor.snapshot().observed_seconds, 2);
  now += 1000; cpuTime += 40; await monitor.sampleNow();
  const resumed = monitor.stop();
  assert.equal(resumed.observed_seconds, 3);
  assert.notEqual(resumed.timeline[0]?.observation_id, resumed.timeline.at(-1)?.observation_id);
});

test('monitor includes supported descendants but excludes its own process tree', async () => {
  let now = 0;
  const frame = (rootTime: number, childTime: number): ProcessEntry[] => [
    { pid: 100, ppid: 1, name: 'codex', cmd: '/opt/codex', cpu_time_ms: rootTime, rss_bytes: 20_000_000 },
    { pid: 101, ppid: 100, name: 'helper', cmd: '/opt/helper', cpu_time_ms: childTime, rss_bytes: 30_000_000 },
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
  assert.equal(product?.cpu_percent, 4);
  assert.equal(product?.memory_bytes, 50_000_000);
  assert.equal(product?.state, 'working-now');
});

test('signal-ineligible helper CPU stays in resources but cannot mark AI working', async () => {
  let now = 0;
  const monitor = new ActivityMonitor({
    now: () => now,
    intervalMs: 1000,
    excludedRootPid: null,
    sampleProcesses: async () => [],
    classifyProcesses: async () => [
      {
        pid: 310, ppid: 300, signature: 'chatgpt-codex', name: 'ChatGPT · Codex', kind: 'ai-app',
        confidence: 'high', relationship: 'descendant', cpu_percent: 80, memory_percent: 1,
        memory_bytes: 120_000_000, cpu_time_ms: now, activity_signal: false,
      },
    ],
  });
  await monitor.start({ schedule: false });
  now += 1000; await monitor.sampleNow();
  now += 1000; await monitor.sampleNow();
  const product = monitor.stop().products[0];
  assert.equal(product?.state, 'open-idle');
  assert.equal(product?.process_count, 1);
  assert.equal(product?.memory_bytes, 120_000_000);
  assert.equal(product?.cpu_percent, 80);
  assert.equal(product?.recent_cpu_time_delta_ms, null);
  assert.equal(monitor.snapshot().active_seconds, 0);
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

test('start attaches to an existing active observation instead of creating a new one', async () => {
  let now = 0;
  const monitor = new ActivityMonitor({ now: () => now, excludedRootPid: null, sampleProcesses: async () => [codex(10, 10)] });
  const first = await monitor.start({ schedule: false });
  now += 1000; await monitor.sampleNow();
  const beforeReconnect = monitor.snapshot();
  const reconnected = await monitor.start({ schedule: false });
  assert.equal(reconnected.lifecycle, 'monitoring');
  assert.equal(reconnected.observation_id, beforeReconnect.observation_id);
  assert.equal(reconnected.started_at, first.started_at);
  assert.equal(reconnected.observed_seconds, beforeReconnect.observed_seconds);
});

test('restoreStoppedSnapshot keeps previous summary without silently restarting monitoring', async () => {
  let now = 0;
  let frame: ProcessEntry[] = [codex(10, 10)];
  const monitor = new ActivityMonitor({ now: () => now, excludedRootPid: null, sampleProcesses: async () => frame });
  await monitor.start({ schedule: false });
  now += 1000; frame = [codex(10, 60)]; await monitor.sampleNow();
  const saved = monitor.stop();
  const restored = new ActivityMonitor({ now: () => now, excludedRootPid: null, sampleProcesses: async () => [] }).restoreStoppedSnapshot(saved);
  assert.equal(restored.lifecycle, 'stopped');
  assert.equal(restored.observation_id, saved.observation_id);
  assert.equal(restored.observed_seconds, saved.observed_seconds);
  assert.deepEqual(restored.timeline, saved.timeline);
});

test('monitor retains bounded aggregate CPU and memory history per AI app', async () => {
  let now = Date.parse('2026-08-26T08:00:00.000Z');
  let frame: ProcessEntry[] = [codex(10, 100, 1)];
  const monitor = new ActivityMonitor({
    now: () => now,
    intervalMs: 1000,
    excludedRootPid: null,
    sampleProcesses: async () => frame,
  });
  await monitor.start({ schedule: false });
  now += 1000; frame = [codex(10, 150, 5)]; await monitor.sampleNow();
  now += 1000; frame = [codex(10, 210, 6)]; await monitor.sampleNow();
  const snapshot = monitor.stop();
  assert.equal(snapshot.resource_history?.length, 1);
  const bucket = snapshot.resource_history?.[0];
  assert.equal(bucket?.system_signature, 'codex');
  assert.equal(bucket?.observed_seconds, 2);
  assert.equal(bucket?.active_seconds, 1);
  assert.equal(bucket?.avg_cpu_percent, 5.5);
  assert.equal(bucket?.peak_cpu_percent, 6);
  assert.equal(bucket?.avg_memory_bytes, 50_000_000);
  assert.equal(bucket?.peak_memory_bytes, 50_000_000);
  assert.equal(bucket?.peak_process_count, 1);
  assert.equal(bucket?.measurement, 'bounded-local-process-tree-resource-bucket');

  const restored = new ActivityMonitor({ now: () => now, excludedRootPid: null, sampleProcesses: async () => [] }).restoreStoppedSnapshot(snapshot);
  assert.deepEqual(restored.resource_history, snapshot.resource_history);
});

test('clearHistory removes retained resource buckets', async () => {
  let now = Date.parse('2026-08-26T08:00:00.000Z');
  let frame: ProcessEntry[] = [codex(10, 100, 4)];
  const monitor = new ActivityMonitor({ now: () => now, excludedRootPid: null, sampleProcesses: async () => frame });
  await monitor.start({ schedule: false });
  now += 1000; frame = [codex(10, 150, 5)]; await monitor.sampleNow();
  assert.ok((monitor.snapshot().resource_history?.length ?? 0) > 0);
  assert.deepEqual(monitor.clearHistory().resource_history, []);
});
