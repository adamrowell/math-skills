/** Small per-device UI memory for Brain Puzzles: which families' "how to think" tips were shown. */
import { createPersistedStore } from '../../core';
import type { FamilyId } from './engine/types';
import { FAMILY_IDS } from './engine/types';

export interface LogicUi {
  version: 1;
  tipsSeen: FamilyId[];
  /** Gallery difficulty chip. */
  galleryLevel: 1 | 2 | 3;
}

export const uiStore = createPersistedStore<LogicUi>({
  key: 'ms2:logic:ui:v1',
  version: 1,
  initial: { version: 1, tipsSeen: [], galleryLevel: 1 },
  sanitize: (v) => ({
    version: 1,
    tipsSeen: Array.isArray(v.tipsSeen) ? v.tipsSeen.filter((f): f is FamilyId => (FAMILY_IDS as readonly string[]).includes(f as string)) : [],
    galleryLevel: v.galleryLevel === 2 || v.galleryLevel === 3 ? v.galleryLevel : 1,
  }),
});

export function markTipSeen(f: FamilyId): void {
  uiStore.update((u) => (u.tipsSeen.includes(f) ? u : { ...u, tipsSeen: [...u.tipsSeen, f] }));
}
