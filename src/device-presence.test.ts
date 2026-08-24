import assert from 'node:assert/strict';
import test from 'node:test';
import { createMacosDevicePresenceProvider, parseMacosConsoleLocked, parseMacosIdleSeconds } from './device-presence';

test('macOS presence parsers read lock and HID idle evidence', () => {
  assert.equal(parseMacosConsoleLocked('"IOConsoleLocked" = Yes'), true);
  assert.equal(parseMacosConsoleLocked('"IOConsoleLocked" = No'), false);
  assert.equal(parseMacosConsoleLocked('missing'), null);
  assert.equal(parseMacosIdleSeconds('"HIDIdleTime" = 12500000000'), 12.5);
  assert.equal(parseMacosIdleSeconds('missing'), null);
});

test('macOS presence pauses locked and inactive sessions', async () => {
  let consoleOutput = '"IOConsoleLocked" = No';
  let idleOutput = '"HIDIdleTime" = 5000000000';
  let now = 1_000;
  const presence = createMacosDevicePresenceProvider({
    now: () => now, cacheMs: 500, idleThresholdSeconds: 60,
    readConsole: async () => consoleOutput, readHid: async () => idleOutput,
  });
  assert.deepEqual(await presence(), { state: 'active', idle_seconds: 5, observation_eligible: true });
  now += 600; idleOutput = '"HIDIdleTime" = 61000000000';
  assert.deepEqual(await presence(), { state: 'idle', idle_seconds: 61, observation_eligible: false });
  now += 600; consoleOutput = '"IOConsoleLocked" = Yes'; idleOutput = '"HIDIdleTime" = 1000000000';
  assert.deepEqual(await presence(), { state: 'locked', idle_seconds: 1, observation_eligible: false });
});
