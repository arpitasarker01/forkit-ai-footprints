import type { MonitorSnapshot } from './monitor';

export type SessionReceipt = {
  receipt_id: string;
  started_at: string;
  duration_bucket: '<15m' | '15–30m' | '30–60m' | '1–2h' | '2–3h' | '3–4h' | '4h+';
  ai_tools: Array<'Claude Code' | 'Codex' | 'Gemini CLI' | 'ChatGPT' | 'Cursor' | 'Windsurf' | 'Other AI tool'>;
  provider_categories: Array<'Anthropic' | 'OpenAI' | 'Google' | 'Local model' | 'Other provider'>;
  action_count: number;
  evidence_sources_count: number;
  evidence_coverage: number;
  missing_evidence_count: number;
  conflict_count: number;
  action_categories: Array<'coding' | 'analysis' | 'repository-change' | 'tool-use' | 'browser-use' | 'api-use' | 'local-model-use' | 'other'>;
  tool_categories: Array<'terminal' | 'git' | 'github' | 'mcp' | 'browser' | 'api' | 'local-runtime' | 'other'>;
};

export type SessionReceiptPreview = {
  receipt: SessionReceipt;
  exact_json: string;
  share_ready: boolean;
  note: string;
};

const TOOL_MAP: Record<string, SessionReceipt['ai_tools'][number]> = {
  'claude-code': 'Claude Code', claude: 'Claude Code', codex: 'Codex', 'chatgpt-codex': 'Codex',
  gemini: 'Gemini CLI', 'gemini-cli': 'Gemini CLI', chatgpt: 'ChatGPT', cursor: 'Cursor', windsurf: 'Windsurf',
};

const PROVIDER_BY_TOOL: Record<SessionReceipt['ai_tools'][number], SessionReceipt['provider_categories'][number] | null> = {
  'Claude Code': 'Anthropic', Codex: 'OpenAI', 'Gemini CLI': 'Google', ChatGPT: 'OpenAI', Cursor: null, Windsurf: null, 'Other AI tool': null,
};

function bucket(seconds: number): SessionReceipt['duration_bucket'] {
  if (seconds < 900) return '<15m';
  if (seconds < 1800) return '15–30m';
  if (seconds < 3600) return '30–60m';
  if (seconds < 7200) return '1–2h';
  if (seconds < 10800) return '2–3h';
  if (seconds < 14400) return '3–4h';
  return '4h+';
}

function roundedHour(value: string | null): string {
  const date = value ? new Date(value) : new Date(0);
  if (!Number.isFinite(date.valueOf())) return new Date(0).toISOString();
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function stableUnique<T>(values: T[]): T[] { return [...new Set(values)]; }

function toolName(signature: string, displayName: string): SessionReceipt['ai_tools'][number] {
  const normalized = signature.toLowerCase();
  for (const [key, value] of Object.entries(TOOL_MAP)) if (normalized.includes(key)) return value;
  if (/claude/i.test(displayName)) return 'Claude Code';
  if (/codex/i.test(displayName)) return 'Codex';
  if (/gemini/i.test(displayName)) return 'Gemini CLI';
  if (/chatgpt/i.test(displayName)) return 'ChatGPT';
  if (/cursor/i.test(displayName)) return 'Cursor';
  if (/windsurf/i.test(displayName)) return 'Windsurf';
  return 'Other AI tool';
}

export function buildSessionReceiptPreview(snapshot: MonitorSnapshot, receiptId: string): SessionReceiptPreview {
  if (!/^fr_[A-Za-z0-9_-]{8,80}$/.test(receiptId)) throw new Error('Invalid receipt id.');
  const activeProducts = snapshot.products.filter((product) => product.active_seconds > 0 || product.state === 'working-now');
  const aiTools = stableUnique(activeProducts.map((product) => toolName(product.signature, product.name)));
  const providers = stableUnique(aiTools.map((tool) => PROVIDER_BY_TOOL[tool]).filter((value): value is SessionReceipt['provider_categories'][number] => value !== null));
  const actionCount = snapshot.timeline.filter((segment) => segment.state === 'working-now').length;
  const evidenceSourcesCount = stableUnique([
    'process-tree-cpu',
    ...(activeProducts.some((product) => product.context.source === 'codex-local-metadata') ? ['codex-local-metadata'] : []),
    ...(activeProducts.some((product) => product.context.source === 'cooperating-app-metadata') ? ['cooperating-app-metadata'] : []),
  ]).length;
  const supportedClaims = activeProducts.length + actionCount;
  const missingEvidenceCount = activeProducts.length > 0 ? activeProducts.length * 2 : 0; // exact model + downstream effect remain unproven per active tool
  const totalClaims = supportedClaims + missingEvidenceCount;
  const coverage = totalClaims === 0 ? 0 : Math.round((supportedClaims / totalClaims) * 100);
  const actionCategories: SessionReceipt['action_categories'] = actionCount > 0 ? ['tool-use'] : [];
  const toolCategories: SessionReceipt['tool_categories'] = activeProducts.some((product) => product.kind === 'local-model-runtime') ? ['local-runtime'] : [];

  const receipt: SessionReceipt = {
    receipt_id: receiptId,
    started_at: roundedHour(snapshot.started_at),
    duration_bucket: bucket(snapshot.active_seconds),
    ai_tools: aiTools,
    provider_categories: providers,
    action_count: actionCount,
    evidence_sources_count: evidenceSourcesCount,
    evidence_coverage: coverage,
    missing_evidence_count: missingEvidenceCount,
    conflict_count: 0,
    action_categories: actionCategories,
    tool_categories: toolCategories,
  };

  return {
    receipt,
    exact_json: JSON.stringify(receipt, null, 2),
    share_ready: true,
    note: 'Preview only. This module performs no network request; upload must require a separate explicit user action.',
  };
}
