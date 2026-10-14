/**
 * Deterministic randomness for puzzle generation (docs/GEO-LOGIC.md §E.1).
 * mulberry32 is tiny, fast and good enough for games; every generator takes an `Rng` so tests can
 * replay any puzzle from its seed.
 */
import type { Difficulty, FamilyId, Rng } from './types';

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit FNV-1a of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A seed for the n-th draw of a family at a difficulty (tests + gallery). */
export function hashSeed(family: FamilyId, difficulty: Difficulty, n: number): number {
  return hashString(`${family}|${difficulty}|${n}`);
}

/**
 * Puzzle id = family, difficulty and a hash of the puzzle's CONTENT (not of the seed), so the same
 * puzzle drawn from two different seeds has the same id and the "never repeat" rule really means
 * "never show him the same puzzle twice".
 */
export function puzzleId(family: FamilyId, difficulty: Difficulty, content: string): string {
  return `${family}:${difficulty}:${hashString(content).toString(16).padStart(8, '0')}`;
}

/** Integer in [lo, hi] inclusive. */
export function randInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick<T>(rng: Rng, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

/** Fisher–Yates; returns a new array. */
export function shuffled<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** k distinct items. */
export function sample<T>(rng: Rng, xs: readonly T[], k: number): T[] {
  return shuffled(rng, xs).slice(0, k);
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}
