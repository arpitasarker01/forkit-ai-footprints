import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export interface LocalDeviceJournal {
  schema_version: '1.0';
  device_label: string;
  device_label_source: 'macos-computer-name' | 'local-hostname' | 'generic-mac';
  first_scan_at: string;
  last_scan_at: string;
  scan_count: number;
}

interface RecordLocalScanOptions {
  stateDirectory?: string;
  deviceLabel?: string;
  now?: () => Date;
  platform?: NodeJS.Platform;
}

function safeDeviceLabel(value: string): string | null {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized.slice(0, 80) : null;
}

export function defaultLocalStateDirectory(): string {
  return path.join(os.homedir(), 'Library', 'Application Support', 'Forkit AI Footprints');
}

export function detectLocalDeviceLabel(platform = process.platform): Pick<LocalDeviceJournal, 'device_label' | 'device_label_source'> {
  if (platform === 'darwin') {
    const result = spawnSync('/usr/sbin/scutil', ['--get', 'ComputerName'], {
      encoding: 'utf8',
      shell: false,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const computerName = result.status === 0 ? safeDeviceLabel(result.stdout) : null;
    if (computerName) return { device_label: computerName, device_label_source: 'macos-computer-name' };
  }
  const hostname = safeDeviceLabel(os.hostname());
  if (hostname) return { device_label: hostname, device_label_source: 'local-hostname' };
  return { device_label: 'This Mac', device_label_source: 'generic-mac' };
}

function validExisting(value: unknown): value is LocalDeviceJournal {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LocalDeviceJournal>;
  return candidate.schema_version === '1.0'
    && typeof candidate.device_label === 'string'
    && candidate.device_label.length > 0
    && typeof candidate.first_scan_at === 'string'
    && typeof candidate.last_scan_at === 'string'
    && Number.isSafeInteger(candidate.scan_count)
    && Number(candidate.scan_count) >= 1;
}

export async function recordLocalScan(options: RecordLocalScanOptions = {}): Promise<LocalDeviceJournal> {
  const stateDirectory = options.stateDirectory ?? defaultLocalStateDirectory();
  const journalPath = path.join(stateDirectory, 'device-journal.json');
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const detected = options.deviceLabel
    ? { device_label: safeDeviceLabel(options.deviceLabel) ?? 'This Mac', device_label_source: 'generic-mac' as const }
    : detectLocalDeviceLabel(options.platform);
  let existing: LocalDeviceJournal | null = null;
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(journalPath, 'utf8'));
    if (validExisting(parsed)) existing = parsed;
  } catch {
    // Missing or invalid local state starts a new private journal.
  }
  const journal: LocalDeviceJournal = {
    schema_version: '1.0',
    device_label: detected.device_label,
    device_label_source: detected.device_label_source,
    first_scan_at: existing?.first_scan_at ?? observedAt,
    last_scan_at: observedAt,
    scan_count: (existing?.scan_count ?? 0) + 1,
  };
  await fs.mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  await fs.chmod(stateDirectory, 0o700);
  const temporaryPath = path.join(stateDirectory, `.device-journal-${process.pid}.tmp`);
  await fs.writeFile(temporaryPath, `${JSON.stringify(journal, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'w' });
  await fs.chmod(temporaryPath, 0o600);
  await fs.rename(temporaryPath, journalPath);
  await fs.chmod(journalPath, 0o600);
  return journal;
}
