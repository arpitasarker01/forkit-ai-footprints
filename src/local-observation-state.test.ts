import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadLocalObservationState, saveLocalObservationState } from './local-observation-state';
import type { MonitorSnapshot } from './monitor';

function snapshot(observedSeconds: number, lifecycle: MonitorSnapshot['lifecycle'] = 'monitoring'): MonitorSnapshot {
  return {
    schema_version: '1.0',
    observation_id: 9,
    lifecycle,
    started_at: '2026-08-28T10:00:00.000Z',
    stopped_at: null,
    observed_seconds: observedSeconds,
    active_seconds: Math.floor(observedSeconds / 2),
    activity_ratio: observedSeconds ? Math.floor(observedSeconds / 2) / observedSeconds : null,
    products: [],
    timeline: observedSeconds ? [{
      started_at: '2026-08-28T10:00:00.000Z',
      ended_at: new Date(Date.parse('2026-08-28T10:00:00.000Z') + observedSeconds * 1000).toISOString(),
      state: 'open-idle',
      product_signatures: [],
      observation_id: 9,
      continuity_id: 12,
    }] : [],
    resource_history: [],
    overhead: {
      current_cpu_percent: null, current_memory_bytes: 0, history_bytes: 0, sample_count: 0,
      median_cpu_percent: null, p95_cpu_percent: null, max_memory_bytes: 0,
      measurement: 'forkit-process-tree',
    },
    sample_interval_ms: 1000,
    history_limit: 900,
    evidence: 'repeated-process-tree-cpu-time-deltas',
    presence: { state: 'active', idle_seconds: 0, observation_eligible: true },
    limitation: 'Measured process-tree activity.',
  };
}

test('local observation state is atomically replaced with the latest complete snapshot', async (t) => {
  const stateDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'forkit-observation-state-'));
  t.after(() => fs.rm(stateDirectory, { recursive: true, force: true }));
  await saveLocalObservationState(snapshot(10), {
    latestInsights: ['first'], localModelsFound: 2, localModelsRunning: 0, stateDirectory,
  });
  await saveLocalObservationState(snapshot(20), {
    latestInsights: ['second'], localModelsFound: 3, localModelsRunning: 1, stateDirectory,
  });
  const loaded = await loadLocalObservationState(stateDirectory);
  assert.equal(loaded?.observed_seconds, 20);
  assert.equal(loaded?.snapshot.observed_seconds, 20);
  assert.equal(loaded?.timeline_blocks[0]?.continuity_id, 12);
  assert.deepEqual(loaded?.latest_insights, ['second']);
  assert.deepEqual(await fs.readdir(stateDirectory), ['observation-state.json']);
});

test('a fresh or active observation cannot erase the last completed useful result', async (t) => {
  const stateDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'forkit-observation-last-result-'));
  t.after(() => fs.rm(stateDirectory, { recursive: true, force: true }));
  await saveLocalObservationState(snapshot(20, 'stopped'), {
    latestInsights: ['complete'], localModelsFound: 5, localModelsRunning: 0, stateDirectory,
  });
  await saveLocalObservationState(snapshot(0, 'monitoring'), {
    latestInsights: [], localModelsFound: 5, localModelsRunning: 0, stateDirectory,
  });
  const loaded = await loadLocalObservationState(stateDirectory);
  assert.equal(loaded?.snapshot.observed_seconds, 0);
  assert.equal(loaded?.last_stopped_summary?.observed_seconds, 20);
  assert.equal(loaded?.last_stopped_summary?.active_seconds, 10);
});
