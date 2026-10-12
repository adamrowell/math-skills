import { describe, expect, it } from 'vitest';
import { PICTURES, targetsOf } from './pictures';
import { LEVELS, offsetFor, picturesFor, place } from './levels';
import { MISS_PENALTY, PENALTY_CAP, SNAP_RADIUS, judgeTap, missPenalty, pointsForHit } from './game';
import { pickPicture } from './pick';
import type { GalleryState } from './store';

const medium = LEVELS.find((l) => l.id === 'medium')!;

describe('pictures', () => {
  it('has at least 15 pictures with unique ids', () => {
    expect(PICTURES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(PICTURES.map((p) => p.id)).size).toBe(PICTURES.length);
  });

  it.each(PICTURES.map((p) => [p.id, p] as const))('%s: integer points on its grid, no back-to-back repeats', (_id, p) => {
    const t = targetsOf(p);
    expect(t.length).toBeGreaterThanOrEqual(7);
    expect(t.length).toBeLessThanOrEqual(30);
    for (const [x, y] of t) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(p.size);
      expect(y).toBeLessThanOrEqual(p.size);
    }
    for (let i = 1; i < t.length; i++) expect(t[i][0] === t[i - 1][0] && t[i][1] === t[i - 1][1]).toBe(false);
  });

  it('every level has pictures and they fit its grid', () => {
    for (const l of LEVELS) {
      const pics = picturesFor(l);
      expect(pics.length).toBeGreaterThanOrEqual(8);
      for (const p of pics) {
        const off = offsetFor(l, p);
        for (const pt of targetsOf(p)) {
          const [x, y] = place(pt, off);
          expect(x >= l.min && x <= l.max && y >= l.min && y <= l.max).toBe(true);
        }
      }
    }
  });

  it('expert pictures use all four quadrants', () => {
    const expert = LEVELS.find((l) => l.id === 'expert')!;
    const star = PICTURES.find((p) => p.id === 'star')!;
    const pts = targetsOf(star).map((pt) => place(pt, offsetFor(expert, star)));
    expect(pts.some(([x, y]) => x < 0 && y > 0)).toBe(true);
    expect(pts.some(([x, y]) => x > 0 && y < 0)).toBe(true);
  });
});

describe('taps', () => {
  it('hits only the nearest intersection within the snap radius', () => {
    expect(judgeTap(3.2, 6.8, [3, 7], medium).kind).toBe('hit');
    expect(judgeTap(3 + SNAP_RADIUS * 0.75, 7 + SNAP_RADIUS * 0.75, [3, 7], medium).kind).toBe('between');
    expect(judgeTap(3.5, 7, [3, 7], medium).kind).toBe('between');
    const miss = judgeTap(4.1, 7, [3, 7], medium);
    expect(miss).toEqual({ kind: 'miss', at: [4, 7], swapped: false });
    expect(judgeTap(7, 3, [3, 7], medium)).toEqual({ kind: 'miss', at: [7, 3], swapped: true });
    expect(judgeTap(-0.9, 3, [3, 7], medium).kind).toBe('between');
    expect(judgeTap(11, 3, [3, 7], medium).kind).toBe('between');
  });
});

describe('economy', () => {
  it('first try earns real points; later tries earn little or nothing', () => {
    expect(pointsForHit(0, 1000, 1, medium)).toBe(30);
    expect(pointsForHit(0, 6000, 1, medium)).toBe(25);
    expect(pointsForHit(0, 20000, 1, medium)).toBe(20);
    expect(pointsForHit(0, 1000, 20, medium)).toBe(45); // combo tops out at 1.5×
    expect(pointsForHit(1, 1000, 0, medium)).toBe(5);
    expect(pointsForHit(2, 1000, 0, medium)).toBe(0);
  });

  it('random tapping is net-negative', () => {
    // A random tap on an 11×11 grid lands on the target ~1/121 of the time. After one miss the
    // x column is lit (11 dots), after two the dot is obvious but worth 0.
    const p1 = 1 / 121;
    const p2 = 1 / 11;
    const ev = p1 * 30 + (1 - p1) * (-MISS_PENALTY + p2 * 5 + (1 - p2) * -MISS_PENALTY);
    expect(ev).toBeLessThan(-5);
  });

  it('penalties stop at the per-picture cap', () => {
    expect(missPenalty(0)).toBe(5);
    expect(missPenalty(PENALTY_CAP - 2)).toBe(2);
    expect(missPenalty(PENALTY_CAP)).toBe(0);
  });
});

describe('picking', () => {
  const empty: GalleryState = { version: 1, entries: {}, level: 'medium', lastPic: null };
  it('prefers pictures never drawn and never repeats the last one', () => {
    const entries: GalleryState['entries'] = {};
    for (const p of picturesFor(medium).slice(1))
      entries[p.id] = { count: 1, firstAt: 0, lastAt: 0, bestMisses: 0, bestMs: 1, levels: ['medium'] };
    const first = picturesFor(medium)[0];
    expect(pickPicture(medium, { ...empty, entries }, null).id).toBe(first.id);
    for (let i = 0; i < 20; i++) expect(pickPicture(medium, { ...empty, entries }, first.id).id).not.toBe(first.id);
  });
  it('easy only picks easy pictures', () => {
    const easy = LEVELS[0];
    for (let i = 0; i < 30; i++) expect(pickPicture(easy, empty, null).easy).toBe(true);
  });
});
