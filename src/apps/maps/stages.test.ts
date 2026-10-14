import { describe, expect, it } from 'vitest';
import { CONTINENTS_MAP } from './data/continents.gen';
import { COUNTRIES_MAP } from './data/countries.gen';
import { US_MAP } from './data/us.gen';
import { STAGES, roundLengthOf, stagesOf } from './stages';
import type { MapKind } from './types';

const DATA = { us: US_MAP, continents: CONTINENTS_MAP, countries: COUNTRIES_MAP } as const;
const idsOf = (k: MapKind) => {
  const d = DATA[k];
  return new Set([...d.regions, ...(d.oceans ?? []), ...(d.seas ?? []), ...(d.lakes ?? [])].map((r) => r.id));
};

/** Rings of a generated "M x y L x y x y … Z" path. */
function rings(d: string): number[][][] {
  return d
    .split('M')
    .filter(Boolean)
    .map((part) => {
      const nums = part.replace(/[LZ]/g, ' ').trim().split(/\s+/).map(Number);
      const out: number[][] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
      return out;
    });
}
function inside(x: number, y: number, d: string): boolean {
  let hit = false;
  for (const ring of rings(d))
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  return hit;
}

/** Distance from a point to a path's nearest edge. */
function edgeDist(x: number, y: number, d: string): number {
  let m = Infinity;
  for (const ring of rings(d))
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j];
      const [bx, by] = ring[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
      m = Math.min(m, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
  return m;
}

describe('stages', () => {
  it('every stage target exists in its map', () => {
    for (const s of STAGES) {
      const ids = idsOf(s.map);
      for (const t of s.targets) expect(ids.has(t), `${s.id}: ${t}`).toBe(true);
    }
  });

  it('every World stage has ≥ 12 distinct targets, so a round never repeats', () => {
    const world = stagesOf('world');
    expect(world.map((s) => s.id)).toEqual(['earth', 'seas', 'bays-lakes', 'water-world']);
    for (const s of world) {
      expect(new Set(s.targets).size).toBe(s.targets.length);
      expect(s.targets.length).toBeGreaterThanOrEqual(roundLengthOf(s));
    }
    expect(world[3].targets.length).toBe(34);
  });

  it('the old repetitive Oceans/Continents stages are gone', () => {
    expect(STAGES.find((s) => s.id === 'oceans')).toBeUndefined();
    expect(STAGES.find((s) => s.id === 'continents')).toBeUndefined();
  });

  it('water zones: each label point is inside its own zone and no other (zones do not overlap)', () => {
    const seas = CONTINENTS_MAP.seas ?? [];
    expect(seas.length).toBeGreaterThanOrEqual(19);
    for (const a of seas) {
      expect(inside(a.lx, a.ly, a.d), `${a.id} label inside itself`).toBe(true);
      for (const b of seas) if (a !== b) expect(inside(a.lx, a.ly, b.d), `${a.id} label inside ${b.id}`).toBe(false);
      // Spot-check overlap: no vertex of one zone lies strictly inside another.
      for (const b of seas) {
        if (a === b) continue;
        const pts = rings(a.d).flat();
        // Shared borders are fine; a vertex deeper than 0.8 map units inside another zone is an overlap.
        const bad = pts.filter(([x, y]) => inside(x, y, b.d) && edgeDist(x, y, b.d) > 0.8);
        expect(bad.length, `${a.id} overlaps ${b.id}`).toBe(0);
      }
    }
  });

  it('world maps carry a coastline outline; lakes are generated', () => {
    expect(CONTINENTS_MAP.outline?.length).toBeGreaterThan(1000);
    expect(COUNTRIES_MAP.outline?.length).toBeGreaterThan(1000);
    expect((CONTINENTS_MAP.lakes ?? []).map((l) => l.id).sort()).toEqual(['baikal', 'great-lakes', 'victoria']);
  });
});
