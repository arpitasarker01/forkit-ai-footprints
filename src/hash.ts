import { createHash } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function stableId(prefix: string, input: string): string {
  return `${prefix}_${sha256(input).slice(0, 24)}`;
}

export function normalizeLabel(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}
