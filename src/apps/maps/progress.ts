import { createPersistedStore } from '../../core';
import { STAGES, stagesOf } from './stages';
import { UNLOCK_STARS } from './logic';
import type { Mode } from './logic';
import type { PackId, StageDef } from './types';

export interface MapsProgress {
  version: 1;
  /** `${mode}:${stageId}` → best stars (0–3). */
  stars: Record<string, number>;
  /** `${mode}:${stageId}` → rounds finished. */
  plays: Record<string, number>;
  /** Last pack tab shown on the home screen. */
  pack: PackId;
}

const INITIAL: MapsProgress = { version: 1, stars: {}, plays: {}, pack: 'us' };

const numMap = (o: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
};

export const progressStore = createPersistedStore<MapsProgress>({
  key: 'ms2:maps:progress:v1',
  version: 1,
  initial: INITIAL,
  sanitize: (p) => ({
    version: 1,
    stars: numMap(p.stars),
    plays: numMap(p.plays),
    pack: p.pack === 'world' || p.pack === 'countries' ? p.pack : 'us',
  }),
});

export const starKey = (mode: Mode, stageId: string) => `${mode}:${stageId}`;

export function starsOf(p: MapsProgress, mode: Mode, stageId: string): number {
  return Math.max(0, Math.min(3, p.stars[starKey(mode, stageId)] ?? 0));
}

export function isStageUnlocked(p: MapsProgress, stage: StageDef): boolean {
  const list = stagesOf(stage.pack);
  const i = list.findIndex((s) => s.id === stage.id);
  if (i <= 0) return true;
  return starsOf(p, 'find', list[i - 1].id) >= UNLOCK_STARS;
}

export function isNameUnlocked(p: MapsProgress, stage: StageDef): boolean {
  return starsOf(p, 'find', stage.id) >= UNLOCK_STARS;
}

/** Record a finished round. Returns the stage newly unlocked by it, if any. */
export function recordRound(mode: Mode, stageId: string, stars: number): { improved: boolean; unlocked: StageDef | null } {
  const before = progressStore.get();
  const key = starKey(mode, stageId);
  const prev = before.stars[key] ?? 0;
  const lockedBefore = STAGES.filter((s) => !isStageUnlocked(before, s)).map((s) => s.id);
  progressStore.update((p) => ({
    ...p,
    stars: { ...p.stars, [key]: Math.max(prev, stars) },
    plays: { ...p.plays, [key]: (p.plays[key] ?? 0) + 1 },
  }));
  const after = progressStore.get();
  const unlocked = STAGES.find((s) => lockedBefore.includes(s.id) && isStageUnlocked(after, s)) ?? null;
  return { improved: stars > prev, unlocked };
}

/** The stage the big Play button starts: the first unlocked stage without 3 stars. */
export function recommendedStage(p: MapsProgress, pack: PackId): StageDef {
  const list = stagesOf(pack);
  const open = list.filter((s) => isStageUnlocked(p, s));
  return open.find((s) => starsOf(p, 'find', s.id) < 3) ?? open[open.length - 1] ?? list[0];
}
