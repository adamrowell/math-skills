/**
 * Landmarks levels and cameras (docs/GEO-LOGIC.md §D.5). Pure data + pure helpers (unit-tested).
 */
import type { InsetSpec, MapKind, ViewBox } from '../maps/types';
import { LANDMARKS, acceptedRegions, acceptedStates } from './data/landmarks';
import type { LandmarkDef } from './data/landmarks';

export type LevelId = 'famous' | 'world' | 'usa' | 'explorer' | 'grand-tour';

export interface LevelDef {
  id: LevelId;
  title: string;
  emoji: string;
  map: MapKind;
  /** Level that needs UNLOCK_STARS first (none = open). */
  after?: LevelId;
  blurb: string;
  pick: (l: LandmarkDef) => boolean;
}

export const LEVELS: LevelDef[] = [
  { id: 'famous', title: 'Super Famous', emoji: '🗼', map: 'countries', blurb: 'The ones everybody knows', pick: (l) => l.tier === 1 },
  { id: 'world', title: 'World Famous', emoji: '🌍', map: 'countries', after: 'famous', blurb: 'Wonders all around the world', pick: (l) => l.tier <= 2 },
  { id: 'usa', title: 'Across the USA', emoji: '🇺🇸', map: 'us', after: 'famous', blurb: 'Tap the state!', pick: (l) => Boolean(l.state) },
  { id: 'explorer', title: 'Explorer', emoji: '🧭', map: 'countries', after: 'world', blurb: 'Hidden gems for real explorers', pick: (l) => l.tier === 3 },
  { id: 'grand-tour', title: 'Grand Tour', emoji: '✈️', map: 'countries', after: 'explorer', blurb: 'Every landmark in the game', pick: () => true },
];

export const UNLOCK_STARS = 2;
export const ROUND_LENGTH = 12;

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function landmarksOf(level: LevelDef): LandmarkDef[] {
  return LANDMARKS.filter(level.pick);
}

/** Region ids that count for a landmark on this level's map. */
export function answersFor(level: LevelDef, l: LandmarkDef): string[] {
  return level.map === 'us' ? acceptedStates(l) : acceptedRegions(l);
}

/** Every region in play on a level (coloured on the map; the rest are grey and just get named). */
export function activeRegions(level: LevelDef): Set<string> {
  return new Set(landmarksOf(level).flatMap((l) => answersFor(level, l)));
}

/** Prior (difficulty weight) by tier, as in the spec: famous ones are easier. */
export const TIER_PRIOR = { 1: 0.8, 2: 1.0, 3: 1.3 } as const;

// ---- cameras -------------------------------------------------------------------------------------

export interface Camera {
  view: ViewBox;
  inset?: InsetSpec;
}

/** World without Antarctica + a magnified Europe inset over the empty South Pacific (as Maps' All Countries). */
const WORLD_VIEW: ViewBox = [0, 0, 1000, 448];
const EUROPE_INSET: InsetSpec = { src: [448, 52, 160, 100], dst: [8, 250, 272, 170] };
const WORLD_PORTRAIT: Camera = { view: [0, 0, 1000, 790], inset: { src: EUROPE_INSET.src, dst: [230, 470, 540, 337.5] } };

/** All 50 states + a 2× inset of the small north-eastern states (as Maps' All 50). */
const US_VIEW: ViewBox = [0, 0, 1205, 610];
const US_NE_INSET: InsetSpec = { src: [838, 124, 112, 176], dst: [985, 150, 216, 339] };
const US_PORTRAIT: Camera = { view: [0, 0, 975, 1090], inset: { src: US_NE_INSET.src, dst: [330, 640, 286, 449.4] } };

/** The level's normal camera; tall boxes (iPad/iPhone portrait) put the inset under the map. */
export function baseCamera(map: MapKind, tall: boolean): Camera {
  if (map === 'us') return tall ? US_PORTRAIT : { view: US_VIEW, inset: US_NE_INSET };
  return tall ? WORLD_PORTRAIT : { view: WORLD_VIEW, inset: EUROPE_INSET };
}

/**
 * Regional cameras for countries too small to tap on the whole-world view (Singapore, Jordan,
 * Sri Lanka…). Fixed boxes, never centred on the answer, so zooming in narrows the search to a
 * region without pointing at the country.
 */
export const REGION_VIEWS: Array<{ name: string; view: ViewBox }> = [
  { name: 'Europe', view: [430, 30, 220, 150] },
  { name: 'the Middle East', view: [545, 115, 170, 115] },
  { name: 'Southeast Asia', view: [700, 150, 210, 145] },
  { name: 'South Asia', view: [640, 120, 170, 120] },
  { name: 'East Asia', view: [760, 80, 200, 140] },
  { name: 'Central America', view: [170, 150, 190, 125] },
  { name: 'Africa', view: [430, 140, 260, 230] },
  { name: 'South America', view: [210, 215, 220, 245] },
  { name: 'Oceania', view: [780, 250, 220, 190] },
];

type BBox = [number, number, number, number];

const contains = (v: ViewBox, b: BBox, pad: number) =>
  b[0] >= v[0] + pad && b[2] <= v[0] + v[2] - pad && b[1] >= v[1] + pad && b[3] <= v[1] + v[3] - pad;

/** Smallest region view that holds the box with some margin, or null. */
export function regionViewFor(b: BBox): { name: string; view: ViewBox } | null {
  const fits = REGION_VIEWS.filter((r) => contains(r.view, b, Math.min(r.view[2], r.view[3]) * 0.06));
  fits.sort((a, c) => a.view[2] * a.view[3] - c.view[2] * c.view[3]);
  return fits[0] ?? null;
}

/** Map units per screen px for a camera shown in a box of w×h px (preserveAspectRatio meet). */
export function unitsPerPx(view: ViewBox, w: number, h: number): number {
  return Math.max(view[2] / Math.max(1, w), view[3] / Math.max(1, h));
}

/**
 * Screen size (px, smaller side) of a region on a camera — through the inset when the inset
 * magnifies it (it is drawn there too).
 */
export function screenSize(b: BBox, cam: Camera, w: number, h: number): number {
  const k = unitsPerPx(cam.view, w, h);
  let px = Math.min(b[2] - b[0], b[3] - b[1]) / k;
  if (cam.inset) {
    const s = cam.inset.src;
    const inInset = b[0] >= s[0] && b[2] <= s[0] + s[2] && b[1] >= s[1] && b[3] <= s[1] + s[3];
    if (inInset) px *= cam.inset.dst[2] / s[2];
  }
  return px;
}

/** Below this many screen px a country gets the regional zoom. */
export const MIN_TAP_PX = 14;

// ---- scoring ---------------------------------------------------------------------------------------

/** Looking at a photo takes a moment: fast ≤ 5 s, ok ≤ 10 s. */
export const LM_SPEED = { fastMs: 5000, okMs: 10000 };

/**
 * Points for a correct tap (docs/GEO-LOGIC.md §D.4): first try 8 + 8·prior (+8 ≤ 5 s, +4 ≤ 10 s)
 * × combo; after one miss +5; after the reveal 0.
 */
export function landmarkPoints(opts: { prior: number; ms: number; misses: number; comboMult: number }): number {
  const { prior, ms, misses, comboMult } = opts;
  if (misses >= 2) return 0;
  if (misses === 1) return 5;
  const bonus = ms <= LM_SPEED.fastMs ? 8 : ms <= LM_SPEED.okMs ? 4 : 0;
  return Math.round((8 + 8 * prior + bonus) * comboMult);
}
