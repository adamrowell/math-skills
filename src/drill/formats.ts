import type { RoundFormat, RoundFormatId } from './types';

export const SPRINT_60: RoundFormat = {
  id: 'sprint60',
  title: 'Sprint 60',
  emoji: '⚡',
  description: 'How many in 60 seconds?',
  durationMs: 60_000,
  bestMetric: 'correctCount',
  showTimer: true,
};

export const CHALLENGE_20: RoundFormat = {
  id: 'challenge20',
  title: 'Race 20',
  emoji: '⏱️',
  description: '20 questions, beat your time',
  questionCount: 20,
  bestMetric: 'elapsedMs',
  showTimer: true,
};

export const PRACTICE: RoundFormat = {
  id: 'practice',
  title: 'Practice',
  emoji: '🧘',
  description: '20 calm questions, no clock',
  questionCount: 20,
  bestMetric: 'none',
  showTimer: false,
};

export const FORMATS: RoundFormat[] = [SPRINT_60, CHALLENGE_20, PRACTICE];

export function formatById(id: string): RoundFormat | undefined {
  return FORMATS.find((f) => f.id === (id as RoundFormatId));
}

export function bestKey(appId: string, formatId: string, setId: string): string {
  return `${appId}:${formatId}:${setId}`;
}

/** Display a best value for a format: count for sprint, seconds for challenge. */
export function formatBest(format: RoundFormat, v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (format.bestMetric === 'elapsedMs') return `${(v / 1000).toFixed(1)}s`;
  return String(v);
}
