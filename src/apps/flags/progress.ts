import { createPersistedStore } from '../../core';
import { FLAG_BY_CC } from './data/flags';
import { LEVELS, UNLOCK_STARS } from './logic';
import type { FlagMode, LevelDef, LevelId } from './logic';

/** `ms2:flags:progress:v1` (docs/GEO-LOGIC.md §C.6). */
export interface FlagsProgress {
  version: 1;
  /** `${mode}:${level}` → best stars (0–3). */
  stars: Record<string, number>;
  /** `${mode}:${level}` → rounds finished. */
  plays: Record<string, number>;
  /** cc → when the sticker was collected (ms). */
  collected: Record<string, number>;
  /** cc → when its frame turned gold (Find mastery box ≥ 4). */
  gold: Record<string, number>;
  /** cc → first-try answers in Which flag? (2 collects the sticker). */
  whichHits: Record<string, number>;
  /** Last level shown on the home. */
  level: LevelId;
  /** `${mode}:${level}` → the previous round's last targets (no-repeat across rounds). */
  recent: Record<string, string[]>;
}

const INITIAL: FlagsProgress = { version: 1, stars: {}, plays: {}, collected: {}, gold: {}, whichHits: {}, level: 'famous', recent: {} };

const numMap = (o: unknown, keyOk: (k: string) => boolean = () => true): Record<string, number> => {
  const out: Record<string, number> = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) if (keyOk(k) && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
};
const isFlag = (k: string) => FLAG_BY_CC.has(k);

export const progressStore = createPersistedStore<FlagsProgress>({
  key: 'ms2:flags:progress:v1',
  version: 1,
  initial: INITIAL,
  sanitize: (p) => {
    const recent: Record<string, string[]> = {};
    if (p.recent && typeof p.recent === 'object') {
      for (const [k, v] of Object.entries(p.recent)) if (Array.isArray(v)) recent[k] = v.filter((x): x is string => typeof x === 'string').slice(-6);
    }
    return {
      version: 1,
      stars: numMap(p.stars),
      plays: numMap(p.plays),
      collected: numMap(p.collected, isFlag),
      gold: numMap(p.gold, isFlag),
      whichHits: numMap(p.whichHits, isFlag),
      level: LEVELS.some((l) => l.id === p.level) ? (p.level as LevelId) : 'famous',
      recent,
    };
  },
});

export const starKey = (mode: FlagMode, level: LevelId) => `${mode}:${level}`;

export function starsOf(p: FlagsProgress, mode: FlagMode, level: LevelId): number {
  return Math.max(0, Math.min(3, p.stars[starKey(mode, level)] ?? 0));
}

export function isLevelUnlocked(p: FlagsProgress, level: LevelDef | LevelId): boolean {
  const id = typeof level === 'string' ? level : level.id;
  const i = LEVELS.findIndex((l) => l.id === id);
  if (i <= 0) return true;
  return starsOf(p, 'find', LEVELS[i - 1].id) >= UNLOCK_STARS;
}

export function isWhichUnlocked(p: FlagsProgress, level: LevelId): boolean {
  return starsOf(p, 'find', level) >= UNLOCK_STARS;
}

/** Flag spotter opens with 2★ in Which flag? on Famous flags. */
export function isSpotterUnlocked(p: FlagsProgress): boolean {
  return starsOf(p, 'which', 'famous') >= UNLOCK_STARS;
}

/** The level PLAY starts: the first unlocked level without 3★ in Find it. */
export function recommendedLevel(p: FlagsProgress): LevelDef {
  const open = LEVELS.filter((l) => isLevelUnlocked(p, l));
  return open.find((l) => starsOf(p, 'find', l.id) < 3) ?? open[open.length - 1] ?? LEVELS[0];
}

/** Record a finished round; returns what it newly opened. */
export function recordRound(
  mode: FlagMode,
  level: LevelId,
  stars: number,
): { unlockedLevel: LevelDef | null; whichOpened: boolean; spotterOpened: boolean } {
  const before = progressStore.get();
  const key = starKey(mode, level);
  progressStore.update((p) => ({
    ...p,
    stars: { ...p.stars, [key]: Math.max(p.stars[key] ?? 0, stars) },
    plays: { ...p.plays, [key]: (p.plays[key] ?? 0) + 1 },
  }));
  const after = progressStore.get();
  return {
    unlockedLevel: LEVELS.find((l) => !isLevelUnlocked(before, l) && isLevelUnlocked(after, l)) ?? null,
    whichOpened: !isWhichUnlocked(before, level) && isWhichUnlocked(after, level),
    spotterOpened: !isSpotterUnlocked(before) && isSpotterUnlocked(after),
  };
}
