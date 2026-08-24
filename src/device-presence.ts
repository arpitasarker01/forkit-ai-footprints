import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type DevicePresenceState = 'active' | 'idle' | 'locked' | 'unavailable';

export interface DevicePresence {
  state: DevicePresenceState;
  idle_seconds: number | null;
  observation_eligible: boolean;
}

export interface MacosDevicePresenceOptions {
  idleThresholdSeconds?: number;
  cacheMs?: number;
  now?: () => number;
  readConsole?: () => Promise<string>;
  readHid?: () => Promise<string>;
}

const execFileAsync = promisify(execFile);

export function parseMacosConsoleLocked(value: string): boolean | null {
  const match = /"IOConsoleLocked"\s*=\s*(Yes|No)/i.exec(value);
  if (!match) return null;
  return match[1]!.toLowerCase() === 'yes';
}

export function parseMacosIdleSeconds(value: string): number | null {
  const match = /"HIDIdleTime"\s*=\s*(\d+)/.exec(value);
  if (!match) return null;
  const nanoseconds = Number(match[1]);
  return Number.isFinite(nanoseconds) && nanoseconds >= 0 ? nanoseconds / 1_000_000_000 : null;
}

async function readIoreg(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('/usr/sbin/ioreg', args, {
    encoding: 'utf8', maxBuffer: 2_000_000, env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
  });
  return stdout;
}

export function createMacosDevicePresenceProvider(options: MacosDevicePresenceOptions = {}): () => Promise<DevicePresence> {
  const idleThresholdSeconds = Math.max(15, options.idleThresholdSeconds ?? 60);
  const cacheMs = Math.max(500, options.cacheMs ?? 2_000);
  const now = options.now ?? Date.now;
  const readConsole = options.readConsole ?? (() => readIoreg(['-n', 'Root', '-d1']));
  const readHid = options.readHid ?? (() => readIoreg(['-c', 'IOHIDSystem', '-r', '-d1']));
  let cachedAt = 0;
  let cached: DevicePresence = { state: 'unavailable', idle_seconds: null, observation_eligible: false };

  return async () => {
    const current = now();
    if (cachedAt > 0 && current - cachedAt < cacheMs) return cached;
    cachedAt = current;
    try {
      const [consoleOutput, hidOutput] = await Promise.all([readConsole(), readHid()]);
      const locked = parseMacosConsoleLocked(consoleOutput);
      const idleSeconds = parseMacosIdleSeconds(hidOutput);
      if (locked === null || idleSeconds === null) {
        cached = { state: 'unavailable', idle_seconds: idleSeconds, observation_eligible: false };
      } else if (locked) {
        cached = { state: 'locked', idle_seconds: idleSeconds, observation_eligible: false };
      } else if (idleSeconds >= idleThresholdSeconds) {
        cached = { state: 'idle', idle_seconds: idleSeconds, observation_eligible: false };
      } else {
        cached = { state: 'active', idle_seconds: idleSeconds, observation_eligible: true };
      }
    } catch {
      cached = { state: 'unavailable', idle_seconds: null, observation_eligible: false };
    }
    return cached;
  };
}
