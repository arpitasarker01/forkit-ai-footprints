import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { defaultLocalStateDirectory } from './local-device';
import type { AnonymousAiFootprintContribution } from './sharing';

export const GLOBAL_PREVIEW_ENDPOINT = 'https://www.forkit.dev/api/v1/ai-footprints';
/** The first eligible aggregate syncs immediately; later refreshes are hourly. */
export const GLOBAL_PREVIEW_SYNC_INTERVAL_MS = 60 * 60 * 1000;

interface PreviewKeyFile {
  schema_version: '1.0';
  algorithm: 'Ed25519';
  public_key: string;
  private_key: string;
}

interface PreviewReceipt {
  schema_version: '1.0';
  state: GlobalPreviewStatus['state'];
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_observed_seconds: number;
  last_error: string | null;
}

export interface GlobalPreviewStatus {
  state: 'disabled' | 'waiting' | 'syncing' | 'contributed' | 'unavailable';
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_observed_seconds: number;
  last_error: string | null;
}

export interface GlobalPreviewContributorOptions {
  stateDirectory?: string;
  endpoint?: string;
  fetchFn?: typeof fetch;
  now?: () => Date;
  minimumSyncIntervalMs?: number;
}

function base64url(value: Buffer): string {
  return value.toString('base64url');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function previewKeyPath(stateDirectory: string): string {
  return path.join(stateDirectory, 'global-preview-key.json');
}

function previewReceiptPath(stateDirectory: string): string {
  return path.join(stateDirectory, 'global-preview-receipt.json');
}

async function writePrivateJson(target: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await fs.chmod(path.dirname(target), 0o700);
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(temporary, 0o600);
  await fs.rename(temporary, target);
  await fs.chmod(target, 0o600);
}

function validKeyFile(value: unknown): value is PreviewKeyFile {
  if (!value || typeof value !== 'object') return false;
  const key = value as Partial<PreviewKeyFile>;
  return key.schema_version === '1.0'
    && key.algorithm === 'Ed25519'
    && typeof key.public_key === 'string'
    && /^[A-Za-z0-9_-]{40,256}$/.test(key.public_key)
    && typeof key.private_key === 'string'
    && /^[A-Za-z0-9_-]{40,256}$/.test(key.private_key);
}

async function loadOrCreateKey(stateDirectory: string): Promise<PreviewKeyFile> {
  const target = previewKeyPath(stateDirectory);
  try {
    const value: unknown = JSON.parse(await fs.readFile(target, 'utf8'));
    if (validKeyFile(value)) return value;
  } catch {
    // Missing or invalid local preview identity is replaced before contribution.
  }
  const pair = crypto.generateKeyPairSync('ed25519');
  const value: PreviewKeyFile = {
    schema_version: '1.0',
    algorithm: 'Ed25519',
    public_key: base64url(pair.publicKey.export({ type: 'spki', format: 'der' })),
    private_key: base64url(pair.privateKey.export({ type: 'pkcs8', format: 'der' })),
  };
  await writePrivateJson(target, value);
  return value;
}

function emptyStatus(): GlobalPreviewStatus {
  return {
    state: 'waiting',
    last_attempt_at: null,
    last_success_at: null,
    last_observed_seconds: 0,
    last_error: null,
  };
}

function validReceipt(value: unknown): value is PreviewReceipt {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Partial<PreviewReceipt>;
  return receipt.schema_version === '1.0'
    && ['disabled', 'waiting', 'syncing', 'contributed', 'unavailable'].includes(String(receipt.state))
    && (receipt.last_attempt_at === null || typeof receipt.last_attempt_at === 'string')
    && (receipt.last_success_at === null || typeof receipt.last_success_at === 'string')
    && Number.isSafeInteger(receipt.last_observed_seconds)
    && Number(receipt.last_observed_seconds) >= 0
    && (receipt.last_error === null || typeof receipt.last_error === 'string');
}

export class GlobalPreviewContributor {
  private readonly stateDirectory: string;
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;
  private readonly minimumSyncIntervalMs: number;
  private currentStatus: GlobalPreviewStatus = emptyStatus();
  private loaded = false;
  private syncing: Promise<GlobalPreviewStatus> | null = null;

  constructor(options: GlobalPreviewContributorOptions = {}) {
    this.stateDirectory = options.stateDirectory ?? defaultLocalStateDirectory();
    this.endpoint = options.endpoint ?? GLOBAL_PREVIEW_ENDPOINT;
    this.fetchFn = options.fetchFn ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.minimumSyncIntervalMs = options.minimumSyncIntervalMs ?? GLOBAL_PREVIEW_SYNC_INTERVAL_MS;
    const endpointUrl = new URL(this.endpoint);
    if (endpointUrl.protocol !== 'https:' || endpointUrl.origin !== 'https://www.forkit.dev' || endpointUrl.pathname !== '/api/v1/ai-footprints') {
      throw new Error('GLOBAL_PREVIEW_ENDPOINT_NOT_ALLOWED');
    }
  }

  status(permission: 'granted' | 'declined' | 'unset'): GlobalPreviewStatus {
    return permission === 'granted' ? { ...this.currentStatus } : { ...this.currentStatus, state: 'disabled', last_error: null };
  }

  private async loadReceipt(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const value: unknown = JSON.parse(await fs.readFile(previewReceiptPath(this.stateDirectory), 'utf8'));
      if (validReceipt(value)) this.currentStatus = { ...value };
    } catch {
      this.currentStatus = emptyStatus();
    }
  }

  private async saveStatus(): Promise<void> {
    await writePrivateJson(previewReceiptPath(this.stateDirectory), {
      schema_version: '1.0',
      ...this.currentStatus,
    } satisfies PreviewReceipt);
  }

  async sync(contribution: AnonymousAiFootprintContribution, permission: 'granted' | 'declined' | 'unset'): Promise<GlobalPreviewStatus> {
    if (permission !== 'granted') return this.status(permission);
    if (this.syncing) return this.syncing;
    this.syncing = this.performSync(contribution).finally(() => { this.syncing = null; });
    return this.syncing;
  }

  private async performSync(contribution: AnonymousAiFootprintContribution): Promise<GlobalPreviewStatus> {
    await this.loadReceipt();
    const now = this.now();
    const lastAttempt = this.currentStatus.last_attempt_at ? Date.parse(this.currentStatus.last_attempt_at) : 0;
    const observedSeconds = contribution.observation.valid_seconds;
    // A new contributor is sent immediately. Once an attempt has been made,
    // persist the hourly cadence across reconnects and browser restarts.
    if (lastAttempt && now.getTime() - lastAttempt < this.minimumSyncIntervalMs) {
      return { ...this.currentStatus };
    }
    this.currentStatus = { ...this.currentStatus, state: 'syncing', last_attempt_at: now.toISOString(), last_error: null };
    await this.saveStatus();
    try {
      const challengeResponse = await this.fetchFn(`${this.endpoint}/challenges`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ purpose: 'preview-contribution' }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!challengeResponse.ok) throw new Error(`CHALLENGE_${challengeResponse.status}`);
      const challenge = await challengeResponse.json() as { challengeId?: unknown };
      if (typeof challenge.challengeId !== 'string' || !/^[a-f0-9]{64}$/.test(challenge.challengeId)) throw new Error('CHALLENGE_INVALID');
      const key = await loadOrCreateKey(this.stateDirectory);
      const clientDataHash = crypto.createHash('sha256').update(`${challenge.challengeId}.${stableJson(contribution)}`).digest();
      const privateKey = crypto.createPrivateKey({ key: Buffer.from(key.private_key, 'base64url'), type: 'pkcs8', format: 'der' });
      const signature = crypto.sign(null, clientDataHash, privateKey);
      const contributionResponse = await this.fetchFn(`${this.endpoint}/contributions`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          contribution,
          proof: {
            type: 'community-ed25519',
            challenge_id: challenge.challengeId,
            public_key: key.public_key,
            signature: base64url(signature),
            client_data_hash: clientDataHash.toString('hex'),
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!contributionResponse.ok) throw new Error(`CONTRIBUTION_${contributionResponse.status}`);
      const accepted = await contributionResponse.json() as { accepted?: unknown; trustState?: unknown };
      if (accepted.accepted !== true || accepted.trustState !== 'preview') throw new Error('CONTRIBUTION_NOT_ACCEPTED');
      this.currentStatus = {
        state: 'contributed',
        last_attempt_at: now.toISOString(),
        last_success_at: now.toISOString(),
        last_observed_seconds: observedSeconds,
        last_error: null,
      };
    } catch (error) {
      this.currentStatus = {
        ...this.currentStatus,
        state: 'unavailable',
        last_error: error instanceof Error ? error.message.slice(0, 96) : 'GLOBAL_PREVIEW_UNAVAILABLE',
      };
    }
    await this.saveStatus();
    return { ...this.currentStatus };
  }
}
