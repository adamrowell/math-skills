import type { FamilyId } from '../engine/types';
import { byId } from '../engine/registry';
import { FAMILY_META } from '../tips';

export const familyTitle = (f: FamilyId) => byId(f)?.title ?? FAMILY_META[f].title;
export const familyEmoji = (f: FamilyId) => byId(f)?.emoji ?? FAMILY_META[f].emoji;
