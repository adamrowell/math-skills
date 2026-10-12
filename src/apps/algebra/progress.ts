/**
 * Quick Algebra per-device progress: unlocked levels, selected level, seen explainers.
 * Mastery itself lives in the shared drill mastery store (ms2:mastery:algebra:v1).
 */
import { createPersistedStore } from '../../core';
import { isLevelId } from './problems';
import type { LevelId } from './problems';

export interface AlgebraProgress {
  version: 1;
  /** Highest unlocked level. */
  unlocked: LevelId;
  /** Level the hero "Play" button starts. */
  level: LevelId;
  /** Explainers already shown ('x', 'pics', 'paper'). */
  seen: string[];
  /** Rounds with ≥ 8/10 first-try right, per level (two of them unlock the next level). */
  goodRounds: Partial<Record<LevelId, number>>;
  /** Sets finished per level. */
  played: Partial<Record<LevelId, number>>;
}

export const INITIAL_PROGRESS: AlgebraProgress = {
  version: 1,
  unlocked: 1,
  level: 1,
  seen: [],
  goodRounds: {},
  played: {},
};

/** Keep only level keys with finite, non-negative whole-number counts (old/corrupt storage). */
function levelCounts(raw: unknown): Partial<Record<LevelId, number>> {
  const out: Partial<Record<LevelId, number>> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, n] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(k);
    if (isLevelId(id) && typeof n === 'number' && Number.isFinite(n) && n >= 0) out[id] = Math.floor(n);
  }
  return out;
}

export const progressStore = createPersistedStore<AlgebraProgress>({
  key: 'ms2:algebra:progress:v1',
  version: 1,
  initial: INITIAL_PROGRESS,
  sanitize: (v) => {
    const unlocked = isLevelId(v.unlocked) ? v.unlocked : 1;
    const level = isLevelId(v.level) && v.level <= unlocked ? v.level : unlocked;
    return {
      version: 1,
      unlocked,
      level,
      seen: Array.isArray(v.seen) ? v.seen.filter((s) => typeof s === 'string') : [],
      goodRounds: levelCounts(v.goodRounds),
      played: levelCounts(v.played),
    };
  },
});

/** First-try right needed in one set to unlock the next level straight away. */
export const UNLOCK_NOW = 9;
/** …or this many in two different sets. */
export const UNLOCK_GOOD = 8;

/**
 * Record a finished set; returns the newly unlocked level (and selects it) or null.
 */
export function recordSet(level: LevelId, firstTry: number): LevelId | null {
  let unlockedNow: LevelId | null = null;
  progressStore.update((p) => {
    const good = (p.goodRounds[level] ?? 0) + (firstTry >= UNLOCK_GOOD ? 1 : 0);
    const played = (p.played[level] ?? 0) + 1;
    let { unlocked, level: sel } = p;
    if (level === unlocked && level < 5 && (firstTry >= UNLOCK_NOW || good >= 2)) {
      unlocked = (level + 1) as LevelId;
      sel = unlocked;
      unlockedNow = unlocked;
    }
    return { ...p, unlocked, level: sel, goodRounds: { ...p.goodRounds, [level]: good }, played: { ...p.played, [level]: played } };
  });
  progressStore.flush();
  return unlockedNow;
}

export function markSeen(key: string): void {
  progressStore.update((p) => (p.seen.includes(key) ? p : { ...p, seen: [...p.seen, key] }));
}

export function selectLevel(level: LevelId): void {
  progressStore.update((p) => (level <= p.unlocked ? { ...p, level } : p));
}
