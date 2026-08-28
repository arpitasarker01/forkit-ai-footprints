import type { ActivityTimelineSegment, AiActivityProduct, MonitorSnapshot, ResourceHistoryBucket } from './monitor';
import type { LocalInsight, LocalInsightKind } from './insights';

export type ActivityVisualState = 'active' | 'idle' | 'excluded';

export interface ActivityVisualSegment {
  id: string;
  start_ms: number;
  end_ms: number;
  duration_seconds: number;
  state: ActivityVisualState;
  valid: boolean;
  system_signatures: string[];
  observation_id: number | null;
  excluded_reason: null;
  is_longest_active: boolean;
}

export interface SystemContribution {
  signature: string;
  name: string;
  kind: string;
  active_seconds: number;
  share: number;
}

export interface SystemActivitySummary extends SystemContribution {
  state: AiActivityProduct['state'];
  period_count: number;
  longest_active_seconds: number;
  first_observed_ms: number | null;
  last_observed_ms: number | null;
  current_cpu_percent: number | null;
  current_memory_bytes: number | null;
  current_process_count: number;
  resource_observed_seconds: number;
  resource_active_seconds: number;
  avg_cpu_percent: number | null;
  peak_cpu_percent: number | null;
  avg_memory_bytes: number | null;
  peak_memory_bytes: number | null;
  peak_process_count: number;
  resource_sample_count: number;
}

export interface CurrentAiResources {
  cpu_percent: number | null;
  memory_bytes: number | null;
  process_count: number;
  contributing_system_count: number;
  measurement: 'current-detected-process-trees';
}

export type ResourceHistoryState = 'retained-local-buckets' | 'collecting' | 'not-retained';

export interface ResourceHistoryBucketView {
  start_ms: number;
  end_ms: number;
  system_signature: string;
  system_name: string;
  kind: string;
  observed_seconds: number;
  active_seconds: number;
  avg_cpu_percent: number | null;
  peak_cpu_percent: number | null;
  avg_memory_bytes: number | null;
  peak_memory_bytes: number | null;
  peak_process_count: number;
  sample_count: number;
}

export interface SystemResourceHistorySummary {
  signature: string;
  name: string;
  kind: string;
  observed_seconds: number;
  active_seconds: number;
  avg_cpu_percent: number | null;
  peak_cpu_percent: number | null;
  avg_memory_bytes: number | null;
  peak_memory_bytes: number | null;
  peak_process_count: number;
  sample_count: number;
}

export interface ResourceHistoryView {
  buckets: ResourceHistoryBucketView[];
  systems: SystemResourceHistorySummary[];
}

export type InsightEvidenceTarget =
  | { type: 'segment'; segment_id: string }
  | { type: 'range'; start_ms: number; end_ms: number }
  | { type: 'system'; signature: string }
  | { type: 'observation' };

export interface ActivityInsightView extends LocalInsight {
  evidence: InsightEvidenceTarget;
}

export interface ActivityExplorerViewModel {
  segments: ActivityVisualSegment[];
  contributions: SystemContribution[];
  insights: ActivityInsightView[];
  extent: { start_ms: number; end_ms: number } | null;
  active_block_count: number;
  longest_active_seconds: number;
  longest_active_range: { start_ms: number; end_ms: number } | null;
  idle_seconds: number;
  excluded_seconds: number;
  simultaneous_systems_max: number;
  active_tool_count: number;
  observation_ids: number[];
  available_date_keys: string[];
  systems: SystemActivitySummary[];
  current_resources: CurrentAiResources;
  resource_history: ResourceHistoryView;
  resource_history_state: ResourceHistoryState;
}

interface NormalizedSegment {
  start_ms: number;
  end_ms: number;
  state: ActivityVisualState;
  valid: boolean;
  system_signatures: string[];
  observation_id: number | null;
  excluded_reason: null;
}

function finiteTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function canMerge(left: NormalizedSegment, right: NormalizedSegment, toleranceMs: number): boolean {
  return left.state === right.state
    && left.valid === right.valid
    && left.observation_id === right.observation_id
    && left.excluded_reason === right.excluded_reason
    && sameStrings(left.system_signatures, right.system_signatures)
    && right.start_ms - left.end_ms <= toleranceMs;
}

export function mergeActivitySegments(segments: NormalizedSegment[], toleranceMs: number): NormalizedSegment[] {
  const merged: NormalizedSegment[] = [];
  for (const segment of segments) {
    const previous = merged.at(-1);
    if (previous && canMerge(previous, segment, toleranceMs)) previous.end_ms = Math.max(previous.end_ms, segment.end_ms);
    else merged.push({ ...segment, system_signatures: [...segment.system_signatures] });
  }
  return merged;
}

export function normalizeActivitySegments(
  timeline: ActivityTimelineSegment[],
  sampleIntervalMs: number,
): ActivityVisualSegment[] {
  const safeInterval = Math.max(1, sampleIntervalMs);
  const source: NormalizedSegment[] = timeline.flatMap((segment) => {
    const start = finiteTimestamp(segment.started_at);
    const end = finiteTimestamp(segment.ended_at);
    if (start === null || end === null || end < start) return [];
    return [{
      start_ms: start,
      end_ms: end,
      state: segment.state === 'working-now' ? 'active' as const : 'idle' as const,
      valid: true,
      system_signatures: [...new Set(segment.product_signatures)].sort(),
      observation_id: segment.observation_id ?? null,
      excluded_reason: null,
    }];
  }).sort((left, right) => left.start_ms - right.start_ms || left.end_ms - right.end_ms);

  const withExcluded: NormalizedSegment[] = [];
  for (const segment of source) {
    const previous = withExcluded.at(-1);
    if (previous) {
      const gap = segment.start_ms - previous.end_ms;
      const sessionChanged = previous.observation_id !== null
        && segment.observation_id !== null
        && previous.observation_id !== segment.observation_id;
      if (gap > safeInterval * 3 || (sessionChanged && gap > safeInterval * 1.5)) {
        withExcluded.push({
          start_ms: previous.end_ms,
          end_ms: segment.start_ms,
          state: 'excluded',
          valid: false,
          system_signatures: [],
          observation_id: null,
          excluded_reason: null,
        });
      }
    }
    withExcluded.push(segment);
  }

  const merged = mergeActivitySegments(withExcluded, safeInterval * 1.5);
  const activeBlocks: Array<{ start_ms: number; end_ms: number; indexes: number[]; observation_id: number | null }> = [];
  merged.forEach((segment, index) => {
    if (segment.state !== 'active') return;
    const previous = activeBlocks.at(-1);
    const continues = previous
      && previous.observation_id === segment.observation_id
      && segment.start_ms - previous.end_ms <= safeInterval * 3
      && merged.slice(previous.indexes.at(-1)! + 1, index).every((between) => between.state === 'active');
    if (continues) {
      previous.end_ms = Math.max(previous.end_ms, segment.end_ms);
      previous.indexes.push(index);
    } else activeBlocks.push({ start_ms: segment.start_ms, end_ms: segment.end_ms, indexes: [index], observation_id: segment.observation_id });
  });
  const longestBlock = activeBlocks.sort((left, right) => (right.end_ms - right.start_ms) - (left.end_ms - left.start_ms))[0] ?? null;
  const longestIndexes = new Set(longestBlock?.indexes ?? []);
  return merged.map((segment, index) => ({
    id: `segment-${index}-${segment.start_ms}`,
    ...segment,
    duration_seconds: Math.max(0, segment.end_ms - segment.start_ms) / 1000,
    is_longest_active: longestIndexes.has(index),
  }));
}

export function calculateSystemContributions(products: AiActivityProduct[]): SystemContribution[] {
  const hasEmbeddedCodex = products.some((product) => product.signature === 'chatgpt-codex');
  const active = products
    .filter((product) => !(hasEmbeddedCodex && product.signature === 'chatgpt'))
    .filter((product) => Number.isFinite(product.active_seconds) && product.active_seconds > 0)
    .map((product) => ({
      signature: product.signature,
      name: product.name,
      kind: product.kind,
      active_seconds: Math.max(0, product.active_seconds),
    }));
  const total = active.reduce((sum, product) => sum + product.active_seconds, 0);
  return active
    .map((product) => ({ ...product, share: total > 0 ? product.active_seconds / total : 0 }))
    .sort((left, right) => right.active_seconds - left.active_seconds || left.name.localeCompare(right.name));
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function weightedAverage<T>(
  values: T[],
  value: (item: T) => number | null,
  weight: (item: T) => number,
): number | null {
  let total = 0;
  let measured = 0;
  for (const item of values) {
    const next = value(item);
    if (next === null) continue;
    const nextWeight = Math.max(0, weight(item));
    if (nextWeight <= 0) continue;
    total += next * nextWeight;
    measured += nextWeight;
  }
  return measured > 0 ? total / measured : null;
}

function rounded(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildResourceHistoryView(history: ResourceHistoryBucket[] = []): ResourceHistoryView {
  const buckets = history.flatMap((bucket): ResourceHistoryBucketView[] => {
    const start = finiteTimestamp(bucket.started_at);
    const end = finiteTimestamp(bucket.ended_at);
    if (start === null || end === null || end < start) return [];
    return [{
      start_ms: start,
      end_ms: end,
      system_signature: bucket.system_signature,
      system_name: bucket.system_name,
      kind: bucket.kind,
      observed_seconds: Math.max(0, Number(bucket.observed_seconds) || 0),
      active_seconds: Math.max(0, Number(bucket.active_seconds) || 0),
      avg_cpu_percent: finiteNumber(bucket.avg_cpu_percent),
      peak_cpu_percent: finiteNumber(bucket.peak_cpu_percent),
      avg_memory_bytes: finiteNumber(bucket.avg_memory_bytes),
      peak_memory_bytes: finiteNumber(bucket.peak_memory_bytes),
      peak_process_count: Math.max(0, Math.trunc(Number(bucket.peak_process_count) || 0)),
      sample_count: Math.max(0, Math.trunc(Number(bucket.sample_count) || 0)),
    }];
  }).sort((left, right) => left.start_ms - right.start_ms || left.system_name.localeCompare(right.system_name));
  const bySystem = new Map<string, ResourceHistoryBucketView[]>();
  for (const bucket of buckets) bySystem.set(bucket.system_signature, [...(bySystem.get(bucket.system_signature) ?? []), bucket]);
  const systems = [...bySystem.entries()].map(([signature, entries]) => ({
    signature,
    name: entries.at(-1)?.system_name ?? signature,
    kind: entries.at(-1)?.kind ?? 'unknown',
    observed_seconds: rounded(entries.reduce((sum, bucket) => sum + bucket.observed_seconds, 0)),
    active_seconds: rounded(entries.reduce((sum, bucket) => sum + bucket.active_seconds, 0)),
    avg_cpu_percent: (() => {
      const value = weightedAverage(entries, (bucket) => bucket.avg_cpu_percent, (bucket) => bucket.observed_seconds);
      return value === null ? null : rounded(value);
    })(),
    peak_cpu_percent: entries.reduce<number | null>((maximum, bucket) => {
      const value = finiteNumber(bucket.peak_cpu_percent);
      return value === null ? maximum : maximum === null ? value : Math.max(maximum, value);
    }, null),
    avg_memory_bytes: (() => {
      const value = weightedAverage(entries, (bucket) => bucket.avg_memory_bytes, (bucket) => bucket.observed_seconds);
      return value === null ? null : Math.round(value);
    })(),
    peak_memory_bytes: entries.reduce<number | null>((maximum, bucket) => {
      const value = finiteNumber(bucket.peak_memory_bytes);
      return value === null ? maximum : maximum === null ? value : Math.max(maximum, value);
    }, null),
    peak_process_count: entries.reduce((maximum, bucket) => Math.max(maximum, bucket.peak_process_count), 0),
    sample_count: entries.reduce((sum, bucket) => sum + bucket.sample_count, 0),
  })).sort((left, right) => right.active_seconds - left.active_seconds || right.observed_seconds - left.observed_seconds || left.name.localeCompare(right.name));
  return { buckets, systems };
}

export function aggregateCurrentAiResources(products: AiActivityProduct[]): CurrentAiResources {
  const cpu = products.map((product) => finiteNumber(product.cpu_percent)).filter((value): value is number => value !== null);
  const memory = products.map((product) => finiteNumber(product.memory_bytes)).filter((value): value is number => value !== null);
  return {
    cpu_percent: cpu.length ? cpu.reduce((sum, value) => sum + Math.max(0, value), 0) : null,
    memory_bytes: memory.length ? memory.reduce((sum, value) => sum + Math.max(0, value), 0) : null,
    process_count: products.reduce((sum, product) => sum + Math.max(0, Math.trunc(product.process_count || 0)), 0),
    contributing_system_count: products.filter((product) => finiteNumber(product.cpu_percent) !== null || finiteNumber(product.memory_bytes) !== null).length,
    measurement: 'current-detected-process-trees',
  };
}

function dateKeyFormatter(timeZone?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function dateKeyParts(timestampMs: number, formatter: Intl.DateTimeFormat): string {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(timestampMs)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function availableLocalDateKeys(
  segments: ActivityVisualSegment[],
  timeZone?: string,
): string[] {
  const keys = new Set<string>();
  const formatter = dateKeyFormatter(timeZone);
  for (const segment of segments) {
    if (segment.state === 'excluded') continue;
    const end = Math.max(segment.start_ms, segment.end_ms - 1);
    for (let cursor = segment.start_ms; cursor < end; cursor += 6 * 60 * 60 * 1000) keys.add(dateKeyParts(cursor, formatter));
    keys.add(dateKeyParts(end, formatter));
  }
  return [...keys].sort();
}

export function formatObservationDateRange(
  extent: { start_ms: number; end_ms: number } | null,
  locale: 'en' | 'de',
  timeZone?: string,
): string | null {
  if (!extent) return null;
  const keyFormatter = dateKeyFormatter(timeZone);
  const startKey = dateKeyParts(extent.start_ms, keyFormatter);
  const endKey = dateKeyParts(Math.max(extent.start_ms, extent.end_ms - 1), keyFormatter);
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const start = formatter.format(new Date(extent.start_ms));
  if (startKey === endKey) return start;
  return `${start} – ${formatter.format(new Date(Math.max(extent.start_ms, extent.end_ms - 1)))}`;
}

function systemActivitySummaries(
  products: AiActivityProduct[],
  segments: ActivityVisualSegment[],
  contributions: SystemContribution[],
  sampleIntervalMs: number,
  resourceHistory: ResourceHistoryView,
): SystemActivitySummary[] {
  const contributionMap = new Map(contributions.map((item) => [item.signature, item]));
  const resourceMap = new Map(resourceHistory.systems.map((item) => [item.signature, item]));
  return products
    .filter((product) => !(product.signature === 'chatgpt' && products.some((candidate) => candidate.signature === 'chatgpt-codex')))
    .map((product) => {
      const active = segments.filter((segment) => segment.state === 'active' && segment.system_signatures.includes(product.signature));
      const periods: Array<{ start_ms: number; end_ms: number; observation_id: number | null }> = [];
      for (const segment of active) {
        const previous = periods.at(-1);
        if (previous
          && previous.observation_id === segment.observation_id
          && segment.start_ms - previous.end_ms <= Math.max(1_500, sampleIntervalMs * 3)) {
          previous.end_ms = Math.max(previous.end_ms, segment.end_ms);
        } else periods.push({ start_ms: segment.start_ms, end_ms: segment.end_ms, observation_id: segment.observation_id });
      }
      const contribution = contributionMap.get(product.signature) ?? {
        signature: product.signature,
        name: product.name,
        kind: product.kind,
        active_seconds: Math.max(0, product.active_seconds || 0),
        share: 0,
      };
      const resources = resourceMap.get(product.signature);
      return {
        ...contribution,
        state: product.state,
        period_count: periods.length,
        longest_active_seconds: periods.reduce((maximum, period) => Math.max(maximum, (period.end_ms - period.start_ms) / 1000), 0),
        first_observed_ms: periods[0]?.start_ms ?? null,
        last_observed_ms: periods.at(-1)?.end_ms ?? null,
        current_cpu_percent: finiteNumber(product.cpu_percent),
        current_memory_bytes: finiteNumber(product.memory_bytes),
        current_process_count: Math.max(0, Math.trunc(product.process_count || 0)),
        resource_observed_seconds: resources?.observed_seconds ?? 0,
        resource_active_seconds: resources?.active_seconds ?? 0,
        avg_cpu_percent: resources?.avg_cpu_percent ?? null,
        peak_cpu_percent: resources?.peak_cpu_percent ?? null,
        avg_memory_bytes: resources?.avg_memory_bytes ?? null,
        peak_memory_bytes: resources?.peak_memory_bytes ?? null,
        peak_process_count: resources?.peak_process_count ?? 0,
        resource_sample_count: resources?.sample_count ?? 0,
      };
    })
    .sort((left, right) => right.active_seconds - left.active_seconds || left.name.localeCompare(right.name));
}

export function selectedTimeRange(segment: ActivityVisualSegment): { start_ms: number; end_ms: number; duration_seconds: number } {
  return { start_ms: segment.start_ms, end_ms: segment.end_ms, duration_seconds: segment.duration_seconds };
}

export function resolveSelectedSystemSignature(
  view: Pick<ActivityExplorerViewModel, 'systems'>,
  selectedSignature: string | null,
): string | null {
  return selectedSignature && view.systems.some((system) => system.signature === selectedSignature)
    ? selectedSignature
    : null;
}

export function insightEvidenceTarget(
  kind: LocalInsightKind,
  segments: ActivityVisualSegment[],
  contributions: SystemContribution[],
): InsightEvidenceTarget {
  if (kind === 'longest-block') {
    const longest = segments.filter((segment) => segment.is_longest_active);
    if (longest.length) return { type: 'range', start_ms: longest[0]!.start_ms, end_ms: longest.at(-1)!.end_ms };
  }
  if (kind === 'workflow' || kind === 'hosted-local') {
    const dominant = contributions[0];
    if (dominant) return { type: 'system', signature: dominant.signature };
  }
  return { type: 'observation' };
}

export function buildActivityExplorerViewModel(
  snapshot: MonitorSnapshot,
  insights: LocalInsight[] = [],
): ActivityExplorerViewModel {
  const segments = normalizeActivitySegments(snapshot.timeline, snapshot.sample_interval_ms);
  const resourceHistory = buildResourceHistoryView(snapshot.resource_history ?? []);
  const contributions = calculateSystemContributions(snapshot.products);
  const activeSegments = segments.filter((segment) => segment.state === 'active');
  const longestSegments = activeSegments.filter((segment) => segment.is_longest_active);
  const longestRange = longestSegments.length
    ? { start_ms: longestSegments[0]!.start_ms, end_ms: longestSegments.at(-1)!.end_ms }
    : null;
  const excludedSeconds = segments
    .filter((segment) => segment.state === 'excluded')
    .reduce((sum, segment) => sum + segment.duration_seconds, 0);
  const extent = segments.length > 0
    ? { start_ms: segments[0]!.start_ms, end_ms: segments.at(-1)!.end_ms }
    : null;
  const systems = systemActivitySummaries(snapshot.products, segments, contributions, snapshot.sample_interval_ms, resourceHistory);
  return {
    segments,
    contributions,
    insights: insights.map((insight) => ({
      ...insight,
      evidence: insightEvidenceTarget(insight.kind, segments, contributions),
    })),
    extent,
    active_block_count: activeSegments.length,
    longest_active_seconds: longestRange ? Math.max(0, longestRange.end_ms - longestRange.start_ms) / 1000 : 0,
    longest_active_range: longestRange,
    idle_seconds: Math.max(0, snapshot.observed_seconds - snapshot.active_seconds),
    excluded_seconds: excludedSeconds,
    simultaneous_systems_max: activeSegments.reduce((maximum, segment) => Math.max(maximum, segment.system_signatures.length), 0),
    active_tool_count: systems.filter((system) => system.active_seconds > 0 || system.state === 'working-now').length,
    observation_ids: [...new Set(segments.flatMap((segment) => segment.observation_id === null ? [] : [segment.observation_id]))].sort((left, right) => left - right),
    available_date_keys: availableLocalDateKeys(segments),
    systems,
    current_resources: aggregateCurrentAiResources(snapshot.products),
    resource_history: resourceHistory,
    resource_history_state: resourceHistory.buckets.length > 0
      ? 'retained-local-buckets'
      : snapshot.lifecycle === 'monitoring' ? 'collecting' : 'not-retained',
  };
}
