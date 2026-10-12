/**
 * Dot Drawing rules (docs/DESIGN.md §1.5). Pure functions — the screen calls these.
 *
 * Economy: only a first-try hit earns real points (20 + speed, × combo, × level). A hit after
 * one miss earns a token +5, after two misses 0. Every miss costs 5. So random tapping is
 * always net-negative: a guess hits ~1 in 100 dots, and each guessed point costs ~10.
 */
import type { Level } from './levels';
import type { P } from './pictures';

/** A tap counts for the nearest intersection only when it is this close (in cells). */
export const SNAP_RADIUS = 0.42;
export const MISS_PENALTY = 5;
/** A single picture never costs more than this in penalties (a meltdown is not a bankruptcy). */
export const PENALTY_CAP = 50;
export const MAX_MISSES = 3;
export const TAP_DEBOUNCE_MS = 300;
export const COOLDOWN_MS = [0, 450, 1500] as const;
export const CLEAN_DRAW_BONUS = 50;
export const CLEAN_DRAW_MAX_MISSES = 2;
export const RECORD_BONUS = 30;

export type TapVerdict =
  | { kind: 'hit'; at: P }
  | { kind: 'miss'; at: P; swapped: boolean }
  /** Not near any intersection (between lines) or off the grid: no penalty. */
  | { kind: 'between' };

export function judgeTap(gx: number, gy: number, target: P, level: Pick<Level, 'min' | 'max'>): TapVerdict {
  const nx = Math.round(gx);
  const ny = Math.round(gy);
  if (nx < level.min || nx > level.max || ny < level.min || ny > level.max) return { kind: 'between' };
  if (Math.hypot(gx - nx, gy - ny) > SNAP_RADIUS) return { kind: 'between' };
  if (nx === target[0] && ny === target[1]) return { kind: 'hit', at: [nx, ny] };
  return { kind: 'miss', at: [nx, ny], swapped: nx === target[1] && ny === target[0] };
}

export function comboMult(combo: number): number {
  return combo >= 20 ? 1.5 : combo >= 10 ? 1.3 : combo >= 5 ? 1.15 : 1;
}

export type SpeedTier = 'fast' | 'ok' | 'slow';

export function speedTier(ms: number, level: Pick<Level, 'fastMs' | 'okMs'>): SpeedTier {
  return ms <= level.fastMs ? 'fast' : ms <= level.okMs ? 'ok' : 'slow';
}

/**
 * Points for placing a point.
 * @param misses misses on this point before the hit (0 = first try)
 * @param combo combo count including this hit (first-try hits only)
 */
export function pointsForHit(misses: number, ms: number, combo: number, level: Pick<Level, 'fastMs' | 'okMs' | 'mult'>): number {
  if (misses >= 2) return 0;
  if (misses === 1) return 5;
  const tier = speedTier(ms, level);
  const speed = tier === 'fast' ? 10 : tier === 'ok' ? 5 : 0;
  return Math.max(1, Math.round((20 + speed) * comboMult(combo) * level.mult));
}

/** Penalty for a miss given what this picture has already cost. */
export function missPenalty(penaltiesSoFar: number): number {
  return Math.max(0, Math.min(MISS_PENALTY, PENALTY_CAP - penaltiesSoFar));
}

export function formatPoint(p: P): string {
  return `(${fmtNum(p[0])}, ${fmtNum(p[1])})`;
}

/** Negative numbers with a real minus sign. */
export function fmtNum(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}
