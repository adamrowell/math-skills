/**
 * Story Problems points (docs/UX-V3.md §7.1): base 20 + difficulty round(prior × 5), × speed
 * (fast ≤ 15 s 1.5, ok ≤ 30 s 1.2) × combo. Right after the hint = half the base value.
 * Worked answer = 0. A perfect story (8/8 first try) pays +40.
 */
import { comboMultiplier } from '../../drill';

export const BASE = 20;
export const FAST_MS = 15_000;
export const OK_MS = 30_000;
export const PERFECT_BONUS = 40;
export const FIRST_ROUND_BONUS = 50;

export type Tier = 'fast' | 'ok' | 'slow';

export function tierFor(ms: number): Tier {
  return ms <= FAST_MS ? 'fast' : ms <= OK_MS ? 'ok' : 'slow';
}

const SPEED: Record<Tier, number> = { fast: 1.5, ok: 1.2, slow: 1 };

export function valueOf(prior: number): number {
  return BASE + Math.round(prior * 5);
}

/** First try right; `combo` counts this answer. */
export function firstTryPoints(prior: number, ms: number, combo: number): { points: number; tier: Tier; mult: number } {
  const tier = tierFor(ms);
  const mult = comboMultiplier(combo);
  return { points: Math.round(valueOf(prior) * SPEED[tier] * mult), tier, mult };
}

export function secondTryPoints(prior: number): number {
  return Math.round(valueOf(prior) / 2);
}

/** Stars for a finished round of 8: 3 = all first try, 2 = ≥ 6 first try, 1 = finished. */
export function starsFor(firstTry: number, answered: number, total: number): 0 | 1 | 2 | 3 {
  if (answered < total) return 0;
  if (firstTry >= total) return 3;
  if (firstTry >= total - 2) return 2;
  return 1;
}
