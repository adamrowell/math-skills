/**
 * Logic Puzzles points (docs/GEO-LOGIC.md §E.2). Pure functions.
 *
 *  first try   BASE_POINTS[d] (15 / 25 / 40) × combo multiplier, + a speed bonus ONLY for answers
 *              that cannot be guessed (keypad, tap-the-cells, sudoku)
 *  second try  SECOND_TRY_POINTS (5) flat
 *  missed out  0
 *  every miss  −MISS_PENALTY (5)
 *
 * Why no speed bonus on multiple choice: a blind tapper is always "fast". With the bonus off,
 * blind guessing is worth ≤ 0 at every difficulty (see guessExpectation) — he has to think.
 */
import type { AnswerSpec, Difficulty } from './types';
import { BASE_POINTS, FAST_MS, MISS_PENALTY, OK_MS, OPTION_COUNT, SECOND_TRY_POINTS } from './types';

export function comboMultiplier(combo: number): number {
  return combo >= 20 ? 1.5 : combo >= 10 ? 1.3 : combo >= 5 ? 1.15 : 1;
}

export const PRACTICE_FACTOR = 0.5;

export interface PointsInput {
  difficulty: Difficulty;
  ms: number;
  misses: 0 | 1 | 2;
  /** First-try streak INCLUDING this answer (only used when misses = 0). */
  combo: number;
  answerKind: AnswerSpec['kind'];
  /** Single-family practice pays half. */
  practice?: boolean;
}

export function speedBonus(difficulty: Difficulty, ms: number, answerKind: AnswerSpec['kind']): number {
  if (answerKind === 'choice') return 0;
  const base = BASE_POINTS[difficulty];
  if (ms <= FAST_MS[difficulty]) return Math.round(base * 0.3);
  if (ms <= OK_MS[difficulty]) return Math.round(base * 0.15);
  return 0;
}

export function pointsFor(i: PointsInput): number {
  const f = i.practice ? PRACTICE_FACTOR : 1;
  if (i.misses >= 2) return 0;
  if (i.misses === 1) return Math.round(SECOND_TRY_POINTS * f);
  const raw = (BASE_POINTS[i.difficulty] + speedBonus(i.difficulty, i.ms, i.answerKind)) * comboMultiplier(i.combo);
  return Math.round(raw * f);
}

/**
 * Exact expected points of blind guessing on one multiple-choice item at combo 0:
 * P(first) · base + P(miss first) · (−5 + P(second | missed) · 5 + P(miss second | missed) · (−5)).
 */
export function guessExpectation(d: Difficulty): number {
  const n = OPTION_COUNT[d];
  const p1 = 1 / n;
  const p2 = 1 / (n - 1);
  return p1 * BASE_POINTS[d] + (1 - p1) * (-MISS_PENALTY + p2 * SECOND_TRY_POINTS + (1 - p2) * -MISS_PENALTY);
}

/** Round stars from first-try answers (same thresholds as Maps). */
export function starsFor(firstTry: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const f = firstTry / total;
  return f >= 1 ? 3 : f >= 0.75 ? 2 : f >= 0.5 ? 1 : 0;
}
