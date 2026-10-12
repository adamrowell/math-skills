/** Leitner-box mastery per fact (docs/DESIGN.md §1.1). Pure functions. */
import type {
  ApplyMasteryFn,
  FactMastery,
  LeitnerBox,
  MasteryScoreFn,
  MasteryState,
  SpeedThresholds,
  SpeedTier,
} from './types';

export const EMPTY_MASTERY: MasteryState = { version: 1, facts: {} };

const clampBox = (n: number): LeitnerBox => Math.max(0, Math.min(5, Math.round(n))) as LeitnerBox;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function speedTier(ms: number, speed: SpeedThresholds): SpeedTier {
  if (ms <= speed.fastMs) return 'fast';
  if (ms <= speed.okMs) return 'ok';
  if (ms <= speed.okMs * 2) return 'slow';
  return 'none';
}

export function freshMastery(): FactMastery {
  return { box: 0, attempts: 0, correct: 0, avgMs: 0, bestMs: 0, lastSeen: 0, lastWrong: 0 };
}

/** 0..1: 0.7·box/5 + 0.3·speedScore. Unseen facts → 0. */
export const masteryScore: MasteryScoreFn = (m, speed) => {
  if (!m) return 0;
  const speedScore = m.avgMs > 0 ? clamp01(1 - (m.avgMs - speed.fastMs) / (speed.okMs * 2)) : 0;
  return 0.7 * (m.box / 5) + 0.3 * speedScore;
};

export const applyMastery: ApplyMasteryFn = (state, update, now) => {
  const prev = state.facts[update.factId] ?? freshMastery();
  let next: FactMastery;
  if (update.mirror) {
    // Half strength: box moves only on a fast correct (capped so the mirror must be asked
    // itself to reach mastery) or on a wrong (−1). Counters stay with the asked fact.
    let box = prev.box;
    if (update.correct && update.tier === 'fast' && prev.box < 3) box = clampBox(prev.box + 1);
    if (!update.correct) box = clampBox(prev.box - 1);
    if (box === prev.box) return state;
    next = { ...prev, box };
  } else if (update.correct) {
    let box = prev.box;
    if (update.tier === 'fast') box = clampBox(prev.box + 1);
    else if (update.tier === 'ok' && prev.box < 2) box = clampBox(prev.box + 1);
    const avgMs = prev.avgMs > 0 ? Math.round(prev.avgMs * 0.7 + update.ms * 0.3) : Math.round(update.ms);
    next = {
      ...prev,
      box,
      attempts: prev.attempts + 1,
      correct: prev.correct + 1,
      avgMs,
      bestMs: prev.bestMs > 0 ? Math.min(prev.bestMs, Math.round(update.ms)) : Math.round(update.ms),
      lastSeen: now,
    };
  } else {
    next = {
      ...prev,
      box: clampBox(prev.box - 2),
      attempts: prev.attempts + 1,
      lastSeen: now,
      lastWrong: now,
    };
  }
  return { ...state, facts: { ...state.facts, [update.factId]: next } };
};
