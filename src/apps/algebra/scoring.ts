/**
 * Quick Algebra points. Harder levels pay more; timed levels (1–3) reward speed and combo,
 * paper levels (4–5) reward correctness only, with a growing streak bonus.
 */
import type { LevelDef } from './problems';
import type { SpeedThresholds, SpeedTier } from '../../drill';

// Same curve as the fast-facts drills (src/drill/scoring.ts), kept local so this module stays pure.
const SPEED_MULT_FOR: Record<SpeedTier, number> = { fast: 1.5, ok: 1.2, slow: 1, none: 1 };

export function tierFor(ms: number, s: SpeedThresholds): SpeedTier {
  if (ms <= s.fastMs) return 'fast';
  if (ms <= s.okMs) return 'ok';
  if (ms <= s.okMs * 2) return 'slow';
  return 'none';
}

/** Combo multiplier (1 / 1.15 / 1.3 / 1.5 at 5 / 10 / 20 in a row), as in the drills. */
export function comboMultiplierFor(combo: number): number {
  return combo >= 20 ? 1.5 : combo >= 10 ? 1.3 : combo >= 5 ? 1.15 : 1;
}

/** Paper mode: +10 % per answer in a row, up to double. */
export function streakMultiplier(streak: number): number {
  return Math.min(2, 1 + 0.1 * Math.max(0, streak - 1));
}

export interface AlgebraScore {
  points: number;
  tier: SpeedTier;
  /** Multiplier shown to the kid (combo or streak). */
  mult: number;
}

/** First-try correct. `combo` is the streak after counting this answer. */
export function pointsFor({ level, ms, combo }: { level: LevelDef; ms: number; combo: number }): AlgebraScore {
  if (level.paper) {
    const mult = streakMultiplier(combo);
    return { points: Math.round(level.base * mult), tier: 'fast', mult };
  }
  const tier = tierFor(ms, level.speed);
  const mult = comboMultiplierFor(combo);
  return { points: Math.max(1, Math.round(level.base * SPEED_MULT_FOR[tier] * mult)), tier, mult };
}

/** Right on the second try (after the hint). */
export function secondTryPoints(level: LevelDef): number {
  return Math.round(level.base * 0.4);
}

export const PERFECT_BONUS = 40;
export const RECORD_BONUS = 50;
