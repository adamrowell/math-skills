/**
 * Every registered puzzle family: builder 3's number/logic families + builder 4's visual families.
 * The visual barrel is picked up with an eager glob so this file builds before (and without) it.
 */
import type { FamilyId, PuzzleFamily } from './types';
import { FAMILY_IDS } from './types';
import { numberFamilies } from '../families';

const visualMods = import.meta.glob<{ visualFamilies?: PuzzleFamily[] }>('../families/visual/index.ts', { eager: true });
const visual: PuzzleFamily[] = Object.values(visualMods).flatMap((m) => m.visualFamilies ?? []);

/** In FAMILY_IDS order. */
export const FAMILIES: PuzzleFamily[] = FAMILY_IDS.map((id) => [...numberFamilies, ...visual].find((f) => f.id === id)).filter(
  (f): f is PuzzleFamily => Boolean(f),
);

const BY_ID = new Map<FamilyId, PuzzleFamily>(FAMILIES.map((f) => [f.id, f]));

export function byId(id: FamilyId): PuzzleFamily | undefined {
  return BY_ID.get(id);
}

export function isFamilyId(v: unknown): v is FamilyId {
  return typeof v === 'string' && (FAMILY_IDS as readonly string[]).includes(v);
}
