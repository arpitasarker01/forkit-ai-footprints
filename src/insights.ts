import type { ActivityTimelineSegment, MonitorSnapshot } from './monitor';
import { type UiLocale, uiText } from './localization';

export type LocalInsightKind = 'activity-share' | 'longest-block' | 'workflow' | 'local-models-unused' | 'mostly-idle';

export interface LocalInsight {
  kind: LocalInsightKind;
  text: string;
}

export interface LocalInsightFootprint {
  model_record_count: number;
  confirmed_running_model_count: number;
}

const MINIMUM_INSIGHT_SECONDS = 60;

function durationLabel(value: number, locale: UiLocale): string {
  const seconds = Math.max(0, Math.round(value));
  if (seconds < 60) return locale === 'de' ? `${seconds} Sek` : `${seconds}s`;
  if (seconds < 3600) return locale === 'de' ? `${Math.floor(seconds / 60)} Min ${seconds % 60} Sek` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return locale === 'de' ? `${Math.floor(seconds / 3600)} Std ${Math.floor((seconds % 3600) / 60)} Min` : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function longestActiveSeconds(timeline: ActivityTimelineSegment[], gapToleranceMs: number): number {
  let longest = 0;
  let blockStart: number | null = null;
  let blockEnd: number | null = null;
  let observationId: number | undefined;
  for (const segment of timeline) {
    if (segment.state !== 'working-now') {
      if (blockStart !== null && blockEnd !== null) longest = Math.max(longest, blockEnd - blockStart);
      blockStart = null; blockEnd = null; observationId = undefined;
      continue;
    }
    const started = Date.parse(segment.started_at);
    const ended = Date.parse(segment.ended_at);
    if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) continue;
    const sessionChanged = observationId !== undefined && segment.observation_id !== undefined && segment.observation_id !== observationId;
    if (blockStart === null || blockEnd === null || sessionChanged || started - blockEnd > gapToleranceMs) {
      if (blockStart !== null && blockEnd !== null) longest = Math.max(longest, blockEnd - blockStart);
      blockStart = started; blockEnd = ended; observationId = segment.observation_id;
    } else blockEnd = Math.max(blockEnd, ended);
  }
  if (blockStart !== null && blockEnd !== null) longest = Math.max(longest, blockEnd - blockStart);
  return longest / 1000;
}

export function buildLocalInsights(
  monitor: MonitorSnapshot,
  footprint: LocalInsightFootprint,
  minimumSeconds = MINIMUM_INSIGHT_SECONDS,
  locale: UiLocale = 'en',
): LocalInsight[] {
  if (monitor.observed_seconds < minimumSeconds || monitor.activity_ratio === null) return [];
  const insights: LocalInsight[] = [];
  const activeProducts = monitor.products.filter((product) => product.active_seconds > 0);
  const activityPercent = Math.round(monitor.activity_ratio * 100);

  if (monitor.activity_ratio <= 0.2) {
    insights.push({ kind: 'mostly-idle', text: uiText(locale, 'insightMostlyIdle') });
  } else if (activeProducts.length === 1) {
    insights.push({ kind: 'activity-share', text: uiText(locale, 'insightActivityProduct', { product: activeProducts[0]!.name, percent: activityPercent }) });
  } else {
    insights.push({ kind: 'activity-share', text: uiText(locale, 'insightActivityGeneric', { percent: activityPercent }) });
  }

  const longest = longestActiveSeconds(monitor.timeline, monitor.sample_interval_ms * 3);
  if (longest >= 10) insights.push({ kind: 'longest-block', text: uiText(locale, 'insightLongest', { duration: durationLabel(longest, locale) }) });

  if (activeProducts.length > 1) {
    insights.push({ kind: 'workflow', text: uiText(locale, 'insightMulti', { count: activeProducts.length }) });
  } else if (footprint.model_record_count > 0 && footprint.confirmed_running_model_count === 0) {
    insights.push({ kind: 'local-models-unused', text: uiText(locale, 'insightModelsUnused', { count: footprint.model_record_count }) });
  } else if (activeProducts.length === 1 && insights[0]?.kind !== 'activity-share') {
    insights.push({ kind: 'workflow', text: uiText(locale, 'insightFocused', { product: activeProducts[0]!.name }) });
  }

  return insights.slice(0, 3);
}
