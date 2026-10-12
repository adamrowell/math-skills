import { createPersistedStore } from '../../core';
import type { LevelId } from './levels';
import { isLevelId } from './levels';
import { pictureById } from './pictures';

export interface GalleryEntry {
  /** Times completed (any level). */
  count: number;
  firstAt: number;
  lastAt: number;
  /** Fewest misses in one drawing. */
  bestMisses: number;
  /** Fastest completion (ms). */
  bestMs: number;
  levels: LevelId[];
}

export interface GalleryState {
  version: 1;
  entries: Record<string, GalleryEntry>;
  /** Last level chosen on the home screen. */
  level: LevelId;
  /** Last picture played (so "Draw!" doesn't repeat it). */
  lastPic: string | null;
}

const INITIAL: GalleryState = { version: 1, entries: {}, level: 'medium', lastPic: null };

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function sanitize(s: GalleryState): GalleryState {
  const entries: Record<string, GalleryEntry> = {};
  const raw = typeof s.entries === 'object' && s.entries ? s.entries : {};
  for (const [id, e] of Object.entries(raw)) {
    if (!pictureById(id) || typeof e !== 'object' || !e) continue;
    const r = e as Partial<GalleryEntry>;
    const count = Math.max(0, Math.round(num(r.count, 0)));
    if (count === 0) continue;
    entries[id] = {
      count,
      firstAt: num(r.firstAt, Date.now()),
      lastAt: num(r.lastAt, Date.now()),
      bestMisses: Math.max(0, num(r.bestMisses, 0)),
      bestMs: Math.max(0, num(r.bestMs, 0)),
      levels: Array.isArray(r.levels) ? r.levels.filter((l): l is LevelId => typeof l === 'string' && isLevelId(l)) : [],
    };
  }
  return {
    version: 1,
    entries,
    level: typeof s.level === 'string' && isLevelId(s.level) ? s.level : 'medium',
    lastPic: typeof s.lastPic === 'string' ? s.lastPic : null,
  };
}

export const galleryStore = createPersistedStore<GalleryState>({
  key: 'ms2:gallery:coordinates:v1',
  version: 1,
  initial: INITIAL,
  sanitize,
});

export function recordDrawing(picId: string, level: LevelId, misses: number, ms: number): { firstTime: boolean } {
  const prev = galleryStore.get().entries[picId];
  const now = Date.now();
  galleryStore.update((s) => ({
    ...s,
    lastPic: picId,
    entries: {
      ...s.entries,
      [picId]: prev
        ? {
            count: prev.count + 1,
            firstAt: prev.firstAt,
            lastAt: now,
            bestMisses: Math.min(prev.bestMisses, misses),
            bestMs: prev.bestMs > 0 ? Math.min(prev.bestMs, ms) : ms,
            levels: prev.levels.includes(level) ? prev.levels : [...prev.levels, level],
          }
        : { count: 1, firstAt: now, lastAt: now, bestMisses: misses, bestMs: ms, levels: [level] },
    },
  }));
  galleryStore.flush();
  return { firstTime: !prev };
}

export function drawnCount(s: GalleryState = galleryStore.get()): number {
  return Object.keys(s.entries).length;
}

export function totalDrawings(s: GalleryState = galleryStore.get()): number {
  return Object.values(s.entries).reduce((n, e) => n + e.count, 0);
}
