/**
 * Story Problems per-device progress (ms2:stories:progress:v1): unlocked level, selected level,
 * best stars per level, rounds played and the "always read it to me" preference.
 * Mastery per template lives in the shared drill mastery store (ms2:mastery:stories:v1).
 */
import { createPersistedStore } from '../../core';
import { isLevelId } from './problems';
import type { LevelId } from './problems';

export interface StoriesProgress {
  version: 1;
  unlocked: LevelId;
  level: LevelId;
  stars: Partial<Record<LevelId, number>>;
  played: Partial<Record<LevelId, number>>;
  /** Read every story aloud automatically. */
  autoRead: boolean;
}

export const INITIAL_PROGRESS: StoriesProgress = { version: 1, unlocked: 1, level: 1, stars: {}, played: {}, autoRead: false };

function counts(raw: unknown, max: number): Partial<Record<LevelId, number>> {
  const out: Partial<Record<LevelId, number>> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, n] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(k);
    if (isLevelId(id) && typeof n === 'number' && Number.isFinite(n) && n >= 0) out[id] = Math.min(max, Math.floor(n));
  }
  return out;
}

export const progressStore = createPersistedStore<StoriesProgress>({
  key: 'ms2:stories:progress:v1',
  version: 1,
  initial: INITIAL_PROGRESS,
  sanitize: (v) => {
    const unlocked = isLevelId(v.unlocked) ? v.unlocked : 1;
    const level = isLevelId(v.level) && v.level <= unlocked ? v.level : unlocked;
    return {
      version: 1,
      unlocked,
      level,
      stars: counts(v.stars, 3),
      played: counts(v.played, 1e6),
      autoRead: v.autoRead === true,
    };
  },
});

/** Stars needed on a level to open the next one. */
export const UNLOCK_STARS = 2;

/** Record a finished round; returns the newly unlocked level (and selects it) or null. */
export function recordRound(level: LevelId, stars: number): LevelId | null {
  let unlockedNow: LevelId | null = null;
  progressStore.update((p) => {
    let { unlocked, level: sel } = p;
    if (level === unlocked && level < 5 && stars >= UNLOCK_STARS) {
      unlocked = (level + 1) as LevelId;
      sel = unlocked;
      unlockedNow = unlocked;
    }
    return {
      ...p,
      unlocked,
      level: sel,
      stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) },
      played: { ...p.played, [level]: (p.played[level] ?? 0) + 1 },
    };
  });
  progressStore.flush();
  return unlockedNow;
}

export function selectLevel(level: LevelId): void {
  progressStore.update((p) => (level <= p.unlocked ? { ...p, level } : p));
}

export function setAutoRead(on: boolean): void {
  progressStore.update((p) => ({ ...p, autoRead: on }));
}
