import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { COUNTRIES_MAP } from '../maps/data/countries.gen';
import { US_MAP } from '../maps/data/us.gen';
import { pickTarget } from '../maps/logic';
import credits from './data/credits.json';
import { distToRings, pathRings } from './data/geometry';
import { ALPHA2_TO_NUMERIC, ISO } from './data/iso';
import { LANDMARKS, acceptedRegions, acceptedStates, regionOf, spokenName } from './data/landmarks';
import { LANDMARK_PX } from './data/landmarks.gen';
import { LEVELS, ROUND_LENGTH, TIER_PRIOR, activeRegions, landmarkPoints, landmarksOf, levelById, regionViewFor, screenSize } from './levels';
import type { Camera } from './levels';
import { countryComplete } from './progress';

const PUBLIC = join(__dirname, '..', '..', '..', 'public', 'landmarks');
const region = (id: string) => COUNTRIES_MAP.regions.find((r) => r.id === id);
const state = (id: string) => US_MAP.regions.find((r) => r.id === id);
const PX = new Map(LANDMARK_PX.map((p) => [p.id, p]));

describe('landmark catalog', () => {
  it('has 103 landmarks with unique ids: 24 super famous, 38 world famous, 41 explorer', () => {
    expect(LANDMARKS).toHaveLength(103);
    expect(new Set(LANDMARKS.map((l) => l.id)).size).toBe(103);
    expect(new Set(LANDMARKS.map((l) => l.name)).size).toBe(103);
    const tiers = [1, 2, 3].map((t) => LANDMARKS.filter((l) => l.tier === t).length);
    expect(tiers).toEqual([24, 38, 41]);
  });

  it('every country (and border country) is in the ISO table and on the countries map with the right name', () => {
    for (const l of LANDMARKS) {
      for (const cc of [l.cc, ...(l.accept ?? [])]) {
        expect(ISO[cc], `${l.id}: ${cc}`).toBeDefined();
        const r = region(ALPHA2_TO_NUMERIC[cc]);
        expect(r, `${l.id}: ${cc} on the map`).toBeDefined();
        expect(r!.name).toBe(ISO[cc].name);
      }
      expect(acceptedRegions(l)[0]).toBe(regionOf(l));
    }
  });

  it('every ISO entry points at a real map region with that name', () => {
    for (const [cc, c] of Object.entries(ISO)) expect(region(c.n)?.name, cc).toBe(c.name);
  });

  it('20 US landmarks have a state on the US map; D.C. ones have none', () => {
    const withState = LANDMARKS.filter((l) => l.state);
    expect(withState).toHaveLength(20);
    for (const l of withState) {
      expect(l.cc).toBe('US');
      for (const s of acceptedStates(l)) expect(state(s), `${l.id}: ${s}`).toBeDefined();
    }
    expect(LANDMARKS.find((l) => l.id === 'white-house')?.state).toBeUndefined();
  });

  it('every fact is one short kid sentence (≤ 16 words)', () => {
    for (const l of LANDMARKS) {
      expect(l.fact.split(/\s+/).length, l.id).toBeLessThanOrEqual(16);
      expect(l.fact).toMatch(/[.!?]$/);
    }
  });

  it('says "the" where English needs it', () => {
    const say = (id: string) => spokenName(LANDMARKS.find((l) => l.id === id)!);
    expect(say('eiffel-tower')).toBe('the Eiffel Tower');
    expect(say('stonehenge')).toBe('Stonehenge');
    expect(say('alamo')).toBe('the Alamo');
    expect(say('mount-fuji')).toBe('Mount Fuji');
    expect(say('yellowstone')).toBe('Old Faithful');
  });
});

describe('pins', () => {
  it('every landmark has a world pin; every state landmark a US pin', () => {
    for (const l of LANDMARKS) {
      const p = PX.get(l.id);
      expect(p, l.id).toBeDefined();
      if (l.state) expect(p?.ux !== undefined && p?.uy !== undefined, l.id).toBe(true);
    }
  });

  it('each world pin lands in (or right on the coast of) its country', () => {
    // Easter Island is not part of Chile's Natural Earth 50m shape: its pin is out in the Pacific.
    const offshore: Record<string, number> = { moai: 110, 'great-barrier-reef': 5, santorini: 5 };
    for (const l of LANDMARKS) {
      const p = PX.get(l.id)!;
      const d = distToRings(pathRings(region(regionOf(l))!.d), p.wx, p.wy);
      expect(d, l.id).toBeLessThanOrEqual(offshore[l.id] ?? 1);
    }
  });

  it('each US pin lands in its state', () => {
    for (const l of LANDMARKS.filter((x) => x.state)) {
      const p = PX.get(l.id)!;
      expect(distToRings(pathRings(state(l.state!)!.d), p.ux!, p.uy!), l.id).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('photos and credits', () => {
  const rows = (credits as { photos: Array<Record<string, string>> }).photos;
  const ALLOWED = /^(CC0|Public domain|CC BY(-SA)? (2\.0|2\.5|3\.0|4\.0)( [a-z]{2})?)$/;

  it('every landmark has a credited, freely licensed photo', () => {
    expect(rows.map((r) => r.id)).toEqual(LANDMARKS.map((l) => l.id));
    for (const r of rows) {
      expect(r.license, r.id).toMatch(ALLOWED);
      expect(r.author.length, r.id).toBeGreaterThan(1);
      expect(r.author, r.id).not.toMatch(/@/);
      expect(r.sourceUrl, r.id).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      if (/^CC BY/.test(r.license)) expect(r.licenseUrl, r.id).toMatch(/^https?:\/\/creativecommons\.org\//);
    }
  });

  it('photos are small WebPs (≤ 80 KB, thumbs ≤ 12 KB) without EXIF', async () => {
    for (const l of LANDMARKS) {
      const big = join(PUBLIC, `${l.id}.webp`);
      const thumb = join(PUBLIC, `${l.id}-thumb.webp`);
      expect(existsSync(big) && existsSync(thumb), l.id).toBe(true);
      expect(statSync(big).size, l.id).toBeLessThanOrEqual(80 * 1024);
      expect(statSync(thumb).size, l.id).toBeLessThanOrEqual(12 * 1024);
      const m = await sharp(readFileSync(big)).metadata();
      expect(m.format).toBe('webp');
      expect(m.exif, l.id).toBeUndefined();
      expect(m.xmp, l.id).toBeUndefined();
      expect((m.width ?? 0) / (m.height ?? 1)).toBeCloseTo(4 / 3, 1);
    }
  }, 30_000);
});

describe('levels', () => {
  it('sizes: famous 24, world 62, usa 20, explorer 41, grand tour 103 — all ≥ a round, so a round never repeats', () => {
    const n = Object.fromEntries(LEVELS.map((l) => [l.id, landmarksOf(l).length]));
    expect(n).toEqual({ famous: 24, world: 62, usa: 20, explorer: 41, 'grand-tour': 103 });
    for (const l of LEVELS) expect(landmarksOf(l).length).toBeGreaterThanOrEqual(ROUND_LENGTH);
  });

  it('the USA level is played on the US map with states in play', () => {
    const usa = levelById('usa')!;
    expect(usa.map).toBe('us');
    const act = activeRegions(usa);
    expect(act.has('NY') && act.has('CA') && act.has('UT')).toBe(true);
    expect([...act].every((id) => /^[A-Z]{2}$/.test(id))).toBe(true);
  });

  it('a 12-question round never asks the same landmark twice', () => {
    for (const level of LEVELS) {
      const candidates = landmarksOf(level).map((l) => ({ id: l.id, prior: TIER_PRIOR[l.tier] }));
      for (let seed = 1; seed <= 30; seed++) {
        let x = seed;
        const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647);
        const asked: string[] = [];
        for (let i = 0; i < ROUND_LENGTH; i++) {
          asked.push(
            pickTarget({ candidates, mastery: {}, asked, missed: new Set(), comeback: new Map(), index: i, speed: { fastMs: 5000, okMs: 10000 }, rng }),
          );
        }
        expect(new Set(asked).size).toBe(ROUND_LENGTH);
      }
    }
  });

  it('tiny countries get a regional zoom that contains them; big ones do not', () => {
    const world: Camera = { view: [0, 0, 1000, 448], inset: { src: [448, 52, 160, 100], dst: [8, 250, 272, 170] } };
    const sg = region('702')!; // Singapore
    expect(screenSize(sg.bbox, world, 1200, 600)).toBeLessThan(14);
    const rv = regionViewFor(sg.bbox)!;
    expect(rv).not.toBeNull();
    const [x, y, w, h] = rv.view;
    expect(sg.bbox[0] >= x && sg.bbox[2] <= x + w && sg.bbox[1] >= y && sg.bbox[3] <= y + h).toBe(true);
    expect(screenSize(region('076')!.bbox, world, 1200, 600)).toBeGreaterThan(14); // Brazil
    // Belgium is small on the world map but magnified in the Europe inset.
    const be = region('056')!;
    expect(screenSize(be.bbox, world, 1200, 600)).toBeGreaterThan(screenSize(be.bbox, { view: world.view }, 1200, 600));
  });

  it('every landmark country can be tapped: big enough on the world view, or inside a regional zoom', () => {
    const world: Camera = { view: [0, 0, 1000, 448], inset: { src: [448, 52, 160, 100], dst: [8, 250, 272, 170] } };
    for (const l of LANDMARKS) {
      const bbs = acceptedRegions(l).map((id) => region(id)!.bbox);
      // Phone portrait is the worst case (≈ 370 px wide).
      if (bbs.some((b) => screenSize(b, world, 370, 300) >= 14)) continue;
      expect(regionViewFor(bbs[0]), l.id).not.toBeNull();
    }
  });
});

describe('scoring', () => {
  it('first try 8 + 8·prior (+8 fast, +4 ok) × combo; one miss 5; revealed 0', () => {
    expect(landmarkPoints({ prior: 1, ms: 3000, misses: 0, comboMult: 1 })).toBe(24);
    expect(landmarkPoints({ prior: 1, ms: 8000, misses: 0, comboMult: 1 })).toBe(20);
    expect(landmarkPoints({ prior: 1, ms: 20000, misses: 0, comboMult: 1 })).toBe(16);
    expect(landmarkPoints({ prior: 0.8, ms: 3000, misses: 0, comboMult: 1.5 })).toBe(Math.round((8 + 6.4 + 8) * 1.5));
    expect(landmarkPoints({ prior: 1.3, ms: 100, misses: 1, comboMult: 1.5 })).toBe(5);
    expect(landmarkPoints({ prior: 1.3, ms: 100, misses: 2, comboMult: 1.5 })).toBe(0);
  });

  it('random tapping loses points on average (un-gameable)', () => {
    // Fewest countries in play = easiest to guess: Super Famous.
    const n = activeRegions(levelById('famous')!).size;
    const best = landmarkPoints({ prior: 1.3, ms: 0, misses: 0, comboMult: 1 });
    const p1 = 1 / n;
    const p2 = 1 / (n - 1);
    const ev = p1 * best + (1 - p1) * (-5 + p2 * 5 + (1 - p2) * -5);
    expect(n).toBeGreaterThanOrEqual(10);
    expect(ev).toBeLessThan(0);
  });
});

describe('passport', () => {
  it('a country page completes only when all its landmarks are stamped', () => {
    const fr = LANDMARKS.filter((l) => l.cc === 'FR').map((l) => l.id);
    expect(fr.length).toBe(6);
    const some = Object.fromEntries(fr.slice(1).map((id) => [id, 1]));
    expect(countryComplete(some, 'FR')).toBe(false);
    expect(countryComplete({ ...some, [fr[0]]: 1 }, 'FR')).toBe(true);
  });
});
