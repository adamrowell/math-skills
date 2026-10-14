import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNTRIES_MAP } from '../maps/data/countries.gen';
import { regionMeta } from '../maps/stages';
import { FLAGS, FLAG_BY_CC, LOOKALIKES } from './data/flags';
import {
  LEVELS,
  SPOTTER_MISS,
  buildFlagChoices,
  collectAfter,
  findPoints,
  lookalikesOf,
  pickSpotterTarget,
  spotterGrid,
  spotterPoints,
  whichPoints,
} from './logic';

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('flag catalog', () => {
  it('has 64 flags with unique codes and ids, 16/24/24 by tier', () => {
    expect(FLAGS).toHaveLength(64);
    expect(new Set(FLAGS.map((f) => f.cc)).size).toBe(64);
    expect(new Set(FLAGS.map((f) => f.id)).size).toBe(64);
    expect(FLAGS.filter((f) => f.tier === 1)).toHaveLength(16);
    expect(FLAGS.filter((f) => f.tier === 2)).toHaveLength(24);
    expect(FLAGS.filter((f) => f.tier === 3)).toHaveLength(24);
  });

  it('every flag is on the countries map, under the same kid-facing name', () => {
    const byId = new Map(COUNTRIES_MAP.regions.map((r) => [r.id, r]));
    for (const f of FLAGS) {
      const r = byId.get(f.id);
      expect(r, f.cc).toBeDefined();
      expect(regionMeta('countries', f.id, r!.name).label, f.cc).toBe(f.name);
    }
  });

  it('every flag has a look-alike group or ≥ 2 colours, known groups only, a short fact', () => {
    for (const f of FLAGS) {
      expect(f.groups.length > 0 || f.colors.length >= 2).toBe(true);
      for (const g of f.groups) expect(LOOKALIKES[g], `${f.cc}: ${g}`).toBeDefined();
      expect(f.fact.split(/\s+/).length, f.cc).toBeLessThanOrEqual(14);
    }
  });

  it('flag-icons has an SVG for every code', () => {
    const dir = join(process.cwd(), 'node_modules/flag-icons/flags/4x3');
    if (!existsSync(dir)) return; // not installed in this checkout
    for (const f of FLAGS) expect(existsSync(join(dir, `${f.cc}.svg`)), f.cc).toBe(true);
  });

  it('levels grow: famous 16 ⊂ world 40; look-alikes holds every tier-3 flag; all 64', () => {
    const [famous, world, look, all] = LEVELS;
    expect(famous.flags).toHaveLength(16);
    expect(world.flags).toHaveLength(40);
    for (const cc of famous.flags) expect(world.flags).toContain(cc);
    for (const f of FLAGS.filter((x) => x.tier === 3)) expect(look.flags).toContain(f.cc);
    expect(look.flags.length).toBeGreaterThanOrEqual(30);
    expect(all.flags).toHaveLength(64);
    for (const l of LEVELS) expect(l.flags.length).toBeGreaterThanOrEqual(12);
  });
});

describe('buildFlagChoices', () => {
  it('4 distinct flags, the answer once, a look-alike whenever one exists', () => {
    const rng = seeded(9);
    for (let t = 0; t < 40; t++)
      for (const f of FLAGS) {
        const ch = buildFlagChoices(f, FLAGS, rng);
        expect(ch).toHaveLength(4);
        expect(new Set(ch).size).toBe(4);
        expect(ch.filter((c) => c === f.cc)).toHaveLength(1);
        const look = lookalikesOf(f, FLAGS).map((x) => x.cc);
        if (look.length) expect(ch.some((c) => look.includes(c)), f.cc).toBe(true);
      }
  });

  it('never offers a recently wrong flag (when the pool allows)', () => {
    const rng = seeded(2);
    const ro = FLAG_BY_CC.get('ro')!;
    for (let t = 0; t < 200; t++) {
      const ch = buildFlagChoices(ro, FLAGS, rng, ['td', 'md']);
      expect(ch).not.toContain('td');
      expect(ch).not.toContain('md');
    }
  });

  it('the answer lands in every position over many draws (no positional tell)', () => {
    const rng = seeded(5);
    const pos = [0, 0, 0, 0];
    const fr = FLAG_BY_CC.get('fr')!;
    for (let t = 0; t < 800; t++) pos[buildFlagChoices(fr, FLAGS, rng).indexOf('fr')]++;
    for (const n of pos) expect(n).toBeGreaterThan(120);
  });
});

describe('spotter', () => {
  it('six distinct flags with the target, a look-alike when there is one, never the same cell twice in a row', () => {
    const rng = seeded(13);
    let prev = -1;
    for (let t = 0; t < 2000; t++) {
      const target = FLAGS[t % FLAGS.length];
      const g = spotterGrid(target, FLAGS, rng, prev);
      expect(g.flags).toHaveLength(6);
      expect(new Set(g.flags).size).toBe(6);
      expect(g.flags[g.cell]).toBe(target.cc);
      expect(g.cell).not.toBe(prev);
      const look = lookalikesOf(target, FLAGS).map((x) => x.cc);
      if (look.length) expect(g.flags.some((c) => look.includes(c))).toBe(true);
      prev = g.cell;
    }
  });

  it('targets do not repeat within the last few', () => {
    const rng = seeded(3);
    const pool = FLAGS.filter((f) => f.tier === 1);
    const recent: string[] = [];
    for (let t = 0; t < 300; t++) {
      const f = pickSpotterTarget(pool, recent, rng);
      expect(recent.slice(-6)).not.toContain(f.cc);
      recent.push(f.cc);
    }
  });

  it('random tapping loses points: EV of a blind tap on 6 flags is negative', () => {
    const ev = (1 / 6) * spotterPoints(5000) - (5 / 6) * SPOTTER_MISS;
    expect(ev).toBeLessThan(0);
  });
});

describe('points and stickers', () => {
  it('Find it pays like Maps; the hidden-name challenge pays more; nothing after the reveal', () => {
    const shown = findPoints({ prior: 1, ms: 2000, misses: 0, comboMult: 1, nameHidden: false });
    const hidden = findPoints({ prior: 1, ms: 2000, misses: 0, comboMult: 1, nameHidden: true });
    expect(shown).toBe(24);
    expect(hidden).toBe(36);
    expect(findPoints({ prior: 1, ms: 2000, misses: 1, comboMult: 1, nameHidden: true })).toBe(5);
    expect(findPoints({ prior: 1, ms: 2000, misses: 2, comboMult: 1, nameHidden: false })).toBe(0);
  });

  it('Which flag?: guessing 1-in-4 is not worth it', () => {
    const first = whichPoints({ prior: 1, ms: 5000, misses: 0, comboMult: 1 });
    const second = whichPoints({ prior: 1, ms: 5000, misses: 1, comboMult: 1 });
    // Blind: 1/4 first-try, else −5 and a 1/3 second try worth `second`.
    const ev = 0.25 * first + 0.75 * (-5 + (1 / 3) * second - (2 / 3) * 5);
    expect(ev).toBeLessThan(0);
  });

  it('stickers: first first-try in Find; two first-tries in Which; never twice', () => {
    expect(collectAfter({ mode: 'find', firstTry: true, already: false, whichHits: 0 }).collect).toBe(true);
    expect(collectAfter({ mode: 'find', firstTry: false, already: false, whichHits: 0 }).collect).toBe(false);
    expect(collectAfter({ mode: 'find', firstTry: true, already: true, whichHits: 0 }).collect).toBe(false);
    const w1 = collectAfter({ mode: 'which', firstTry: true, already: false, whichHits: 0 });
    expect(w1).toEqual({ collect: false, whichHits: 1 });
    expect(collectAfter({ mode: 'which', firstTry: true, already: false, whichHits: w1.whichHits })).toEqual({ collect: true, whichHits: 2 });
  });
});

describe('identical-looking flags (twins)', () => {
  it('never offers a twin as a choice or in the spotter grid, on any level', async () => {
    const { TWINS, FLAG_BY_CC } = await import('./data/flags');
    const { LEVELS, buildFlagChoices, spotterGrid } = await import('./logic');
    let s = 7;
    const rng = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (const level of LEVELS) {
      const pool = level.flags.map((cc) => FLAG_BY_CC.get(cc)!);
      for (const f of pool)
        for (let i = 0; i < 40; i++) {
          if (!TWINS[f.cc]) continue;
          expect(buildFlagChoices(f, pool, rng)).not.toContain(TWINS[f.cc]);
          expect(spotterGrid(f, pool, rng).flags).not.toContain(TWINS[f.cc]);
        }
    }
  });
  it('keeps countries too small to find out of Find it', async () => {
    const { LEVELS, findFlags, TOO_SMALL_TO_FIND } = await import('./logic');
    for (const level of LEVELS) for (const cc of findFlags(level)) expect(TOO_SMALL_TO_FIND.has(cc)).toBe(false);
  });
  it('a peek at the hidden name pays less than a plain answer', async () => {
    const { findPoints } = await import('./logic');
    const plain = findPoints({ prior: 1, ms: 2000, misses: 0, comboMult: 1, nameHidden: false });
    const peek = findPoints({ prior: 1, ms: 2000, misses: 0, comboMult: 1, nameHidden: true, peeked: true });
    expect(peek).toBeLessThan(plain);
    expect(peek).toBeGreaterThan(0);
  });
});
