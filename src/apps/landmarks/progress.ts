/**
 * Landmarks progress + Explorer passport (docs/GEO-LOGIC.md §D.7) — `ms2:landmarks:progress:v1`.
 * A stamp is earned the first time a landmark is found first try; a country page is complete when
 * every landmark of that country is stamped.
 */
import { createPersistedStore } from '../../core';
import { LANDMARKS, LANDMARK_BY_ID } from './data/landmarks';
import { LEVELS, UNLOCK_STARS, levelById } from './levels';
import type { LevelDef, LevelId } from './levels';

export interface LandmarksProgress {
  version: 1;
  /** level → best stars (0–3). */
  stars: Record<string, number>;
  /** level → rounds finished. */
  plays: Record<string, number>;
  /** Last level played. */
  level: LevelId;
  /** landmark id → time stamped. */
  stamps: Record<string, number>;
  /** ISO alpha-2 → time its page was completed. */
  countries: Record<string, number>;
  /** level → best round score. */
  best: Record<string, number>;
  /** level → the previous round's last targets (so the next round opens differently). */
  recent: Record<string, string[]>;
}

const INITIAL: LandmarksProgress = { version: 1, stars: {}, plays: {}, level: 'famous', stamps: {}, countries: {}, best: {}, recent: {} };

const numMap = (o: unknown, keep: (k: string) => boolean = () => true): Record<string, number> => {
  const out: Record<string, number> = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) if (keep(k) && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
};

const listMap = (o: unknown): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string').slice(-8);
  }
  return out;
};

export const progressStore = createPersistedStore<LandmarksProgress>({
  key: 'ms2:landmarks:progress:v1',
  version: 1,
  initial: INITIAL,
  sanitize: (p) => ({
    version: 1,
    stars: numMap(p.stars, (k) => Boolean(levelById(k))),
    plays: numMap(p.plays, (k) => Boolean(levelById(k))),
    level: levelById(String(p.level))?.id ?? 'famous',
    stamps: numMap(p.stamps, (k) => LANDMARK_BY_ID.has(k)),
    countries: numMap(p.countries),
    best: numMap(p.best),
    recent: listMap(p.recent),
  }),
});

export function starsOf(p: LandmarksProgress, level: LevelId): number {
  return Math.max(0, Math.min(3, p.stars[level] ?? 0));
}

export function isUnlocked(p: LandmarksProgress, level: LevelDef): boolean {
  return !level.after || starsOf(p, level.after) >= UNLOCK_STARS;
}

/** The level PLAY starts: the last one played if still open and not perfect, else the first open one without 3 stars. */
export function recommendedLevel(p: LandmarksProgress): LevelDef {
  const open = LEVELS.filter((l) => isUnlocked(p, l));
  const last = open.find((l) => l.id === p.level);
  if (last && starsOf(p, last.id) < 3) return last;
  return open.find((l) => starsOf(p, l.id) < 3) ?? last ?? open[0];
}

/** Every landmark of a country is stamped. */
export function countryComplete(stamps: Record<string, number>, cc: string): boolean {
  return LANDMARKS.filter((l) => l.cc === cc).every((l) => stamps[l.id]);
}

/** Stamp a landmark. Returns whether it is new and whether its country page just filled up. */
export function stamp(id: string): { isNew: boolean; countryDone: string | null } {
  const l = LANDMARK_BY_ID.get(id);
  const p = progressStore.get();
  if (!l || p.stamps[id]) return { isNew: false, countryDone: null };
  const now = Date.now();
  const stamps = { ...p.stamps, [id]: now };
  const done = countryComplete(stamps, l.cc) && !p.countries[l.cc] ? l.cc : null;
  progressStore.update((s) => ({ ...s, stamps, countries: done ? { ...s.countries, [done]: now } : s.countries }));
  return { isNew: true, countryDone: done };
}

/** Record a finished round. Returns the level newly unlocked by it, if any. */
export function recordRound(level: LevelId, stars: number, points: number, lastTargets: string[]): { unlocked: LevelDef | null } {
  const before = progressStore.get();
  const lockedBefore = LEVELS.filter((l) => !isUnlocked(before, l)).map((l) => l.id);
  progressStore.update((p) => ({
    ...p,
    level,
    stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) },
    plays: { ...p.plays, [level]: (p.plays[level] ?? 0) + 1 },
    best: { ...p.best, [level]: Math.max(p.best[level] ?? 0, points) },
    recent: { ...p.recent, [level]: lastTargets.slice(-4) },
  }));
  const after = progressStore.get();
  return { unlocked: LEVELS.find((l) => lockedBefore.includes(l.id) && isUnlocked(after, l)) ?? null };
}
