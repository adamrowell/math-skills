/**
 * Reading progress (Read Words / Read Sentences), one persisted store per app:
 * key ms2:reading:<app>:v1. Per level: best score + stars (unlocks the next level).
 * Per item (word / sentence): a Leitner box 0–5 that drives selection.
 */
import { createPersistedStore } from '../../../core';
import type { PersistedStore } from '../../../core';

export type ReadingAppId = 'words' | 'sentences';

export interface ItemProgress {
  box: number;
  seen: number;
  correct: number;
  lastSeen: number;
  /** Needed help / skipped last time (shown on the summary). */
  tricky: boolean;
}

export interface LevelProgress {
  /** Best first-try score in a round (words read / round size). */
  best: number;
  stars: 0 | 1 | 2 | 3;
  plays: number;
}

export interface ReadingProgress {
  version: 1;
  levels: Record<string, LevelProgress>;
  items: Record<string, ItemProgress>;
  lastLevel: string | null;
  /** A grown-up opened every level (placement for a child who already reads well). */
  unlockAll?: boolean;
}

const INITIAL: ReadingProgress = { version: 1, levels: {}, items: {}, lastLevel: null };

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function sanitize(p: ReadingProgress): ReadingProgress {
  const levels: Record<string, LevelProgress> = {};
  for (const [k, raw] of Object.entries(p.levels ?? {})) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as unknown as Record<string, unknown>;
    levels[k] = { best: num(r.best), stars: Math.max(0, Math.min(3, Math.round(num(r.stars)))) as LevelProgress['stars'], plays: num(r.plays) };
  }
  const items: Record<string, ItemProgress> = {};
  for (const [k, raw] of Object.entries(p.items ?? {})) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as unknown as Record<string, unknown>;
    items[k] = {
      box: Math.max(0, Math.min(5, Math.round(num(r.box)))),
      seen: num(r.seen),
      correct: num(r.correct),
      lastSeen: num(r.lastSeen),
      tricky: r.tricky === true,
    };
  }
  return { version: 1, levels, items, lastLevel: typeof p.lastLevel === 'string' ? p.lastLevel : null, unlockAll: p.unlockAll === true };
}

const stores = new Map<ReadingAppId, PersistedStore<ReadingProgress>>();

export function readingStore(app: ReadingAppId): PersistedStore<ReadingProgress> {
  let s = stores.get(app);
  if (!s) {
    s = createPersistedStore<ReadingProgress>({ key: `ms2:reading:${app}:v1`, version: 1, initial: INITIAL, sanitize });
    stores.set(app, s);
  }
  return s;
}

/** Stars for a round: share of items read right on the first try (with the mic). */
export function starsFor(firstTry: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const r = firstTry / total;
  if (r >= 0.99) return 3;
  if (r >= 0.85) return 2;
  if (r >= 0.65) return 1;
  return 0;
}

/** Level index is unlocked when it is the first, or the previous level has at least one star. */
export function isUnlocked(levelIds: string[], idx: number, p: ReadingProgress): boolean {
  if (idx <= 0 || p.unlockAll) return true;
  return (p.levels[levelIds[idx - 1]]?.stars ?? 0) >= 1;
}

/** The level to suggest: the last one played if still open, else the first without stars. */
export function suggestedLevel(levelIds: string[], p: ReadingProgress): string {
  const firstOpen = levelIds.find((id, i) => isUnlocked(levelIds, i, p) && (p.levels[id]?.stars ?? 0) === 0);
  if (p.lastLevel && levelIds.includes(p.lastLevel)) {
    const i = levelIds.indexOf(p.lastLevel);
    // Moved on: once the last level has 3 stars, suggest the next open one.
    if ((p.levels[p.lastLevel]?.stars ?? 0) < 3 || !firstOpen) return p.lastLevel;
    if (isUnlocked(levelIds, i, p)) return firstOpen;
  }
  return firstOpen ?? levelIds[levelIds.length - 1];
}

/** Update one item's Leitner box after an attempt. */
export function bumpItem(prev: ItemProgress | undefined, outcome: 'first' | 'second' | 'helped' | 'missed', now: number): ItemProgress {
  const p = prev ?? { box: 0, seen: 0, correct: 0, lastSeen: 0, tricky: false };
  let box = p.box;
  if (outcome === 'first') box = Math.min(5, box + 1);
  else if (outcome === 'second') box = Math.max(0, Math.min(box, 2));
  else box = Math.max(0, box - 2);
  return {
    box,
    seen: p.seen + 1,
    correct: p.correct + (outcome === 'first' || outcome === 'second' ? 1 : 0),
    lastSeen: now,
    tricky: outcome === 'helped' || outcome === 'missed',
  };
}

/**
 * Pick `n` distinct items for a round, weighted toward low boxes and not-recently-seen items.
 * Deterministic order is avoided so a replay feels fresh.
 */
export function pickRound<T>(items: T[], idOf: (t: T) => string, p: ReadingProgress, n: number, rng: () => number = Math.random): T[] {
  const pool = items.map((it) => {
    const m = p.items[idOf(it)];
    const box = m?.box ?? 0;
    const fresh = m ? 1 : 1.6; // never-seen items come up early
    const w = (1 + 3 * (1 - box / 5)) * fresh * (m?.tricky ? 1.8 : 1);
    return { it, w };
  });
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, x) => a + x.w, 0);
    let r = rng() * total;
    let k = 0;
    for (; k < pool.length - 1; k++) {
      r -= pool[k].w;
      if (r <= 0) break;
    }
    out.push(pool[k].it);
    pool.splice(k, 1);
  }
  return out;
}
