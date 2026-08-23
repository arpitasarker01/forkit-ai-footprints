import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type RuntimeIdentityVerifier = (endpoint: string, expectedExecutable: string) => Promise<boolean>;

function exactBasename(value: string): string {
  return path.basename(value.trim()).toLowerCase();
}

/**
 * Correlates a loopback listener with an exact executable name. Only the
 * boolean result leaves this adapter; PID and executable path stay ephemeral.
 */
export const verifyMacosLoopbackRuntimeIdentity: RuntimeIdentityVerifier = async (
  endpoint,
  expectedExecutable,
) => {
  if (process.platform !== 'darwin') return false;
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { return false; }
  const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) return false;
  try {
    const { stdout } = await execFileAsync('lsof', [
      '-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc',
    ], {
      encoding: 'utf8',
      maxBuffer: 1_000_000,
      env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
    });
    let currentPid: number | null = null;
    const candidates: number[] = [];
    for (const line of stdout.split('\n')) {
      if (line.startsWith('p')) currentPid = Number(line.slice(1));
      else if (line.startsWith('c') && currentPid !== null
        && exactBasename(line.slice(1)) === expectedExecutable.toLowerCase()) candidates.push(currentPid);
    }
    for (const pid of candidates) {
      if (!Number.isSafeInteger(pid) || pid < 1) continue;
      const { stdout: command } = await execFileAsync('ps', ['-p', String(pid), '-o', 'comm='], {
        encoding: 'utf8',
        maxBuffer: 64_000,
        env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
      });
      if (exactBasename(command) === expectedExecutable.toLowerCase()) return true;
    }
    return false;
  } catch {
    return false;
  }
};
