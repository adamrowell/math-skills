/**
 * Points per answer and round bonuses (docs/DESIGN.md §1.0.4). Pure functions.
 *
 * Tuned so points work as a parent's reward currency:
 *  - difficulty dominates: points ∝ (2 + 8·prior), so 7×8 is worth ~3× a 2×3 and ~6× a 0×5;
 *  - speed and combo are multipliers with modest ceilings (fast 1.5×, combo up to 1.5×);
 *  - facts he already owns (Leitner box 4–5) pay less than facts he is still learning;
 *  - a per-set multiplier keeps "farm the easy table" below "practise the hard ones" per minute.
 * Targets: a good 60 s sprint ≈ 300–600, a learning kid ≈ 100–200.
 */
import type { RoundBonuses, ScoreAnswer } from './types';
import { speedTier } from './mastery';

export function comboMultiplier(combo: number): number {
  return combo >= 20 ? 1.5 : combo >= 10 ? 1.3 : combo >= 5 ? 1.15 : 1;
}

/** Re-grinding facts that are already gold pays less than learning new ones. */
export function masteryFactor(box: number | undefined): number {
  return box === undefined ? 1 : box >= 5 ? 0.6 : box >= 4 ? 0.8 : 1;
}

/** Combo milestone → kid-friendly copy (no decimals). */
export function comboMilestone(combo: number): string | null {
  if (combo === 5) return '5 in a row!';
  if (combo === 10) return '10 in a row! More points!';
  if (combo === 20) return '20 in a row! Super points!';
  if (combo > 20 && combo % 10 === 0) return `${combo} in a row!`;
  return null;
}

export const SPEED_MULT = { fast: 1.5, ok: 1.2, slow: 1, none: 1 } as const;

/** Raw value of a fact before speed/combo/set multipliers. */
export function factValue(prior: number): number {
  return 2 + 8 * prior;
}

/** Bonus for the first real round of the day (replaces the old round-wide Daily Double). */
export const FIRST_ROUND_BONUS = 50;

export const scoreAnswer: ScoreAnswer = ({ fact, ms, combo, attempt, speed, pointsMult = 1, box }) => {
  const s = fact.speed ?? speed;
  const tier = speedTier(ms, s);
  const comboMult = comboMultiplier(combo);
  const value = factValue(fact.prior) * masteryFactor(box);
  const breakdown = {
    base: Math.round(value),
    speed: Math.round(value * (SPEED_MULT[tier] - 1)),
    difficulty: Math.round(fact.prior * 8),
    comboMultiplier: comboMult,
    setMultiplier: pointsMult,
  };
  const points = attempt > 1 ? 0 : Math.max(1, Math.round(value * SPEED_MULT[tier] * comboMult * pointsMult));
  return { points, tier, breakdown };
};

/** Minimum for a "real" round (bonuses, records): enough answers, mostly right. */
export function isRealRound(answered: number, correct: number): boolean {
  return answered >= 10 && correct / Math.max(1, answered) >= 0.8;
}

export function roundBonuses(opts: { newBest: boolean; answered: number; correct: number; firstRound?: boolean }): RoundBonuses {
  const { newBest, answered, correct, firstRound = false } = opts;
  const acc = answered > 0 ? correct / answered : 0;
  const b = {
    newBest: newBest ? 50 : 0,
    sharpShooter: answered >= 15 && acc >= 0.95 ? 25 : 0,
    perfect: answered >= 10 && acc === 1 ? 40 : 0,
    firstRound: firstRound ? FIRST_ROUND_BONUS : 0,
    total: 0,
  };
  b.total = b.newBest + b.sharpShooter + b.perfect + b.firstRound;
  return b;
}
