import { createPersistedStore } from '../core';
import type { AppId, PersistedStore } from '../core';
import type { FactMastery, MasteryState } from './types';
import { EMPTY_MASTERY } from './mastery';

const stores = new Map<AppId, PersistedStore<MasteryState>>();

/** Persisted mastery per app: key ms2:mastery:<appId>:v1. */
export function masteryStore(appId: AppId): PersistedStore<MasteryState> {
  let s = stores.get(appId);
  if (!s) {
    s = createPersistedStore<MasteryState>({
      key: `ms2:mastery:${appId}:v1`,
      version: 1,
      initial: EMPTY_MASTERY,
      sanitize: sanitizeMastery,
    });
    stores.set(appId, s);
  }
  return s;
}

export function readMastery(appId: AppId): MasteryState | null {
  const s = masteryStore(appId).get();
  return Object.keys(s.facts).length ? s : null;
}

export function resetMastery(appId: AppId): void {
  masteryStore(appId).set(EMPTY_MASTERY);
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Drop malformed fact entries (imported/old files) instead of crashing the grid. */
export function sanitizeMastery(m: MasteryState): MasteryState {
  const facts: Record<string, FactMastery> = {};
  for (const [id, raw] of Object.entries(m.facts ?? {})) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as unknown as Record<string, unknown>;
    const box = Math.max(0, Math.min(5, Math.round(num(r.box)))) as FactMastery['box'];
    facts[id] = {
      box,
      attempts: num(r.attempts),
      correct: num(r.correct),
      avgMs: num(r.avgMs),
      bestMs: num(r.bestMs),
      lastSeen: num(r.lastSeen),
      lastWrong: num(r.lastWrong),
    };
  }
  return { ...m, version: 1, facts };
}
