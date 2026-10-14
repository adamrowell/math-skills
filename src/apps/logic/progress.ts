/**
 * Logic Puzzles progress (ms2:logic:progress:v1, `LogicProgress` in engine/types.ts).
 * Per-family mastery lives in the shared drill mastery store: masteryStore('logic'), facts `${family}:${d}`.
 */
import { createPersistedStore } from '../../core';
import type { Difficulty, FamilyId, LogicMode, LogicProgress } from './engine/types';
import { FAMILY_IDS } from './engine/types';
import { SEEN_CAP } from './engine/session';

export const INITIAL_PROGRESS: LogicProgress = { version: 1, mode: 'adaptive', level: {}, streak: {}, seen: [], rounds: 0, best: {} };

const MODES: LogicMode[] = ['adaptive', 'easy', 'medium', 'hard'];
export const isMode = (v: unknown): v is LogicMode => typeof v === 'string' && (MODES as string[]).includes(v);

export function sanitizeProgress(v: LogicProgress): LogicProgress {
  const level: Partial<Record<FamilyId, Difficulty>> = {};
  const streak: Partial<Record<FamilyId, number>> = {};
  const lv = (v.level ?? {}) as Record<string, unknown>;
  const st = (v.streak ?? {}) as Record<string, unknown>;
  for (const f of FAMILY_IDS) {
    const l = lv[f];
    if (l === 1 || l === 2 || l === 3) level[f] = l;
    const s = st[f];
    if (typeof s === 'number' && Number.isFinite(s) && s >= 0) streak[f] = Math.min(10, Math.floor(s));
  }
  const best: Record<string, number> = {};
  for (const [k, n] of Object.entries((v.best ?? {}) as Record<string, unknown>)) if (isMode(k) && typeof n === 'number' && Number.isFinite(n)) best[k] = Math.max(0, Math.min(10, Math.floor(n)));
  return {
    version: 1,
    mode: isMode(v.mode) ? v.mode : 'adaptive',
    level,
    streak,
    seen: Array.isArray(v.seen) ? v.seen.filter((s): s is string => typeof s === 'string').slice(-SEEN_CAP) : [],
    rounds: typeof v.rounds === 'number' && Number.isFinite(v.rounds) && v.rounds >= 0 ? Math.floor(v.rounds) : 0,
    best,
  };
}

export const progressStore = createPersistedStore<LogicProgress>({
  key: 'ms2:logic:progress:v1',
  version: 1,
  initial: INITIAL_PROGRESS,
  sanitize: sanitizeProgress,
});

export function setMode(mode: LogicMode): void {
  progressStore.update((p) => ({ ...p, mode }));
}

export const MODE_LABEL: Record<LogicMode, string> = { adaptive: 'Adaptive', easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const MODE_EMOJI: Record<LogicMode, string> = { adaptive: '🧠', easy: '🌱', medium: '🌟', hard: '🔥' };
