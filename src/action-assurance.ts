import type { AiActivityProduct, MonitorSnapshot } from './monitor';

export type ActionEvidenceState = 'DIRECT' | 'SUPPORTED' | 'INFERRED' | 'CONFLICTING' | 'MISSING';
export type ActionAssuranceState = 'VERIFIED' | 'PARTIAL' | 'CONFLICT';

export interface ActionEvidenceItem {
  id: string;
  claim: string;
  source: string;
  state: ActionEvidenceState;
  basis: string;
}

export interface LocalActionRecord {
  action_id: string;
  mode: 'local';
  actor: string;
  agent: string;
  model: string | null;
  identity: string;
  tools: string[];
  systems: string[];
  business_object: string | null;
  project: string | null;
  result: string;
  confidence: 'direct' | 'supported' | 'partial';
  assurance: ActionAssuranceState;
  evidence: ActionEvidenceItem[];
}

export interface LocalActionAssuranceView {
  schema_version: '0.1';
  mode: 'local';
  observation_id: number;
  actions: LocalActionRecord[];
  evidence_states: ActionEvidenceState[];
  privacy: {
    local_only: true;
    metadata_only: true;
    raw_commands: false;
    process_ids: false;
    prompts_or_responses: false;
    payload_contents: false;
  };
  limitation: string;
}

function projectBasename(value: string | null | undefined): string | null {
  const normalized = value?.trim().replaceAll('\\', '/');
  if (!normalized) return null;
  const basename = normalized.split('/').filter(Boolean).at(-1)?.trim() ?? '';
  if (!basename || basename === '.' || basename === '..') return null;
  return basename.slice(0, 120);
}

function safeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'unknown';
}

function actionResult(product: AiActivityProduct): string {
  if (product.state === 'working-now') return 'Measured AI activity is happening now';
  if (product.active_seconds > 0) return 'Measured AI activity was observed in this session';
  return 'Supported AI tool is open, with no measured active interval';
}

function buildEvidence(product: AiActivityProduct, project: string | null): ActionEvidenceItem[] {
  const active = product.state === 'working-now' || product.active_seconds > 0;
  return [
    {
      id: 'agent-presence',
      claim: 'Agent/tool identity',
      source: 'Local process classification',
      state: 'DIRECT',
      basis: 'Supported product signature observed in the local process tree.',
    },
    {
      id: 'activity',
      claim: 'AI activity',
      source: 'Repeated process-tree CPU-time deltas',
      state: active ? 'DIRECT' : 'MISSING',
      basis: active
        ? 'Sustained cumulative CPU-time change was measured for the supported process tree.'
        : 'Process presence alone is not treated as proof of active AI work.',
    },
    {
      id: 'project-context',
      claim: 'Project/workspace context',
      source: product.context.source === 'codex-local-metadata' ? 'Codex local metadata' : 'Cooperating-app metadata',
      state: project ? 'SUPPORTED' : 'MISSING',
      basis: project
        ? 'Only the final project folder name is retained for protected local display.'
        : 'No supported local project/workspace context was available.',
    },
    {
      id: 'model',
      claim: 'Exact model used for this action',
      source: 'Local evidence',
      state: 'MISSING',
      basis: 'Current Footprints measurement does not attribute a specific model to an individual action.',
    },
    {
      id: 'downstream-effect',
      claim: 'Independent downstream effect',
      source: 'Local evidence',
      state: 'MISSING',
      basis: 'Current Footprints measurement does not inspect remote systems or payload contents.',
    },
  ];
}

function assuranceFromEvidence(evidence: ActionEvidenceItem[]): ActionAssuranceState {
  if (evidence.some((item) => item.state === 'CONFLICTING')) return 'CONFLICT';
  if (evidence.some((item) => item.state === 'MISSING' || item.state === 'INFERRED')) return 'PARTIAL';
  return 'VERIFIED';
}

export function buildLocalActionAssurance(snapshot: MonitorSnapshot): LocalActionAssuranceView {
  const actions = snapshot.products
    .filter((product) => product.state !== 'not-running' || product.active_seconds > 0)
    .sort((left, right) => right.active_seconds - left.active_seconds || left.name.localeCompare(right.name))
    .map((product): LocalActionRecord => {
      const project = projectBasename(product.context.workspace);
      const evidence = buildEvidence(product, project);
      const activityMeasured = product.state === 'working-now' || product.active_seconds > 0;
      return {
        action_id: `local-${snapshot.observation_id}-${safeToken(product.signature)}`,
        mode: 'local',
        actor: 'Local device user',
        agent: product.name,
        model: null,
        identity: 'Local supported process tree',
        tools: [product.name],
        systems: ['Local macOS process evidence'],
        business_object: project,
        project,
        result: actionResult(product),
        confidence: project && activityMeasured ? 'supported' : activityMeasured ? 'direct' : 'partial',
        assurance: assuranceFromEvidence(evidence),
        evidence,
      };
    });

  return {
    schema_version: '0.1',
    mode: 'local',
    observation_id: snapshot.observation_id,
    actions,
    evidence_states: ['DIRECT', 'SUPPORTED', 'INFERRED', 'CONFLICTING', 'MISSING'],
    privacy: {
      local_only: true,
      metadata_only: true,
      raw_commands: false,
      process_ids: false,
      prompts_or_responses: false,
      payload_contents: false,
    },
    limitation: 'This is a reviewable local reconstruction from measured Footprints metadata. It does not prove prompt intent, exact model use, tool arguments, or downstream business effects.',
  };
}
