import { describe, expect, it } from 'vitest';
import {
  allRotations,
  grid,
  group,
  line,
  mirrorSpec,
  parsePath,
  pick,
  polygon,
  randInt,
  rotateSpec,
  row,
  sameVisual,
  shape,
  shuffle,
  spec,
  text,
  visualKey,
} from './shapes';
import type { VisualSpec } from './types';

const L = (fill: 'red' | 'blue' = 'red') =>
  polygon(
    [
      [30, 20],
      [45, 20],
      [45, 65],
      [75, 65],
      [75, 80],
      [30, 80],
    ],
    { fill },
  );

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

describe('shapes builders', () => {
  it('builds nodes with overrides', () => {
    expect(shape('circle', 1, 2, 3, { fill: 'red' })).toEqual({ t: 'shape', kind: 'circle', x: 1, y: 2, size: 3, fill: 'red' });
    expect(text(1, 2, 'hi').text).toBe('hi');
    expect(line(0, 0, 1, 1).t).toBe('line');
    expect(grid(0, 0, 2, 3, 10).cols).toBe(3);
    expect(spec(10, 20, [], 'x')).toEqual({ w: 10, h: 20, nodes: [], label: 'x' });
  });

  it('row centres items around x', () => {
    const r = row([shape('circle', 0, 0, 10, { id: 'a' }), shape('circle', 0, 0, 10, { id: 'b' })], { x: 50, y: 20, gap: 30 });
    const xs = r.children.map((c) => (c.t === 'g' ? c.x : NaN));
    expect(xs).toEqual([35, 65]);
    expect(JSON.stringify(r)).toContain('"id":"a"');
  });

  it('shuffle / pick / randInt are deterministic and in range', () => {
    const a = shuffle([1, 2, 3, 4, 5], seeded(1));
    expect(a.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    expect(shuffle([1, 2, 3, 4, 5], seeded(1))).toEqual(a);
    const rng = seeded(7);
    for (let i = 0; i < 500; i++) {
      const v = randInt(2, 5, rng);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      expect(['a', 'b']).toContain(pick(['a', 'b'], rng));
    }
  });

  it('parses and re-emits simple paths', () => {
    const p = parsePath('M0 0 H10 V10 L0 10 Z');
    expect(p.subs[0]).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    expect(p.closed).toEqual([true]);
  });
});

describe('sameVisual', () => {
  it('ignores ids, node order and tiny rounding', () => {
    const a = spec(100, 100, [shape('circle', 10, 10, 20, { id: 'x', fill: 'red' }), shape('square', 50, 50, 20)]);
    const b = spec(100, 100, [shape('square', 50.1, 49.9, 20), shape('circle', 10, 10, 20, { fill: 'red' })]);
    expect(sameVisual(a, b)).toBe(true);
  });

  it('knows symmetric shapes look the same when turned', () => {
    const sq = (r: number) => spec(100, 100, [shape('square', 50, 50, 30, { rotate: r })]);
    expect(sameVisual(sq(0), sq(90))).toBe(true);
    expect(sameVisual(sq(0), sq(45))).toBe(false);
    const tri = (r: number, flip = false) => spec(100, 100, [shape('triangle', 50, 50, 30, { rotate: r, flipX: flip })]);
    expect(sameVisual(tri(0), tri(120))).toBe(true);
    expect(sameVisual(tri(0), tri(0, true))).toBe(true);
    expect(sameVisual(tri(0), tri(180))).toBe(false);
    const arrow = (o: object) => spec(100, 100, [shape('arrow', 50, 50, 30, o)]);
    expect(sameVisual(arrow({}), arrow({ flipY: true }))).toBe(true);
    expect(sameVisual(arrow({}), arrow({ flipX: true }))).toBe(false);
    expect(sameVisual(arrow({ flipX: true }), arrow({ rotate: 180 }))).toBe(true);
    const c = (o: object) => spec(100, 100, [shape('circle', 50, 50, 30, o)]);
    expect(sameVisual(c({ rotate: 33 }), c({ flipX: true }))).toBe(true);
  });

  it('half-filled shapes keep their orientation', () => {
    const c = (o: object) => spec(100, 100, [shape('circle', 50, 50, 30, { pattern: 'half', ...o })]);
    expect(sameVisual(c({}), c({ rotate: 180 }))).toBe(false);
    expect(sameVisual(c({}), c({ flipY: true }))).toBe(true);
  });

  it('distinguishes colours, sizes, patterns and kinds', () => {
    const base = spec(100, 100, [shape('circle', 50, 50, 30, { fill: 'red' })]);
    expect(sameVisual(base, spec(100, 100, [shape('circle', 50, 50, 30, { fill: 'blue' })]))).toBe(false);
    expect(sameVisual(base, spec(100, 100, [shape('circle', 50, 50, 40, { fill: 'red' })]))).toBe(false);
    expect(sameVisual(base, spec(100, 100, [shape('circle', 50, 50, 30, { fill: 'red', pattern: 'striped' })]))).toBe(false);
    expect(sameVisual(base, spec(100, 100, [shape('square', 50, 50, 30, { fill: 'red' })]))).toBe(false);
  });

  it('flattens groups', () => {
    const a = spec(100, 100, [group([shape('star', 0, 0, 20)], { x: 30, y: 40 })]);
    const b = spec(100, 100, [shape('star', 30, 40, 20)]);
    expect(sameVisual(a, b)).toBe(true);
  });

  it('treats a polygon independent of start point and direction', () => {
    const a = polygon([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    const b = polygon([
      [10, 10],
      [10, 0],
      [0, 0],
    ]);
    expect(sameVisual(spec(10, 10, [a]), spec(10, 10, [b]))).toBe(true);
  });
});

describe('mirrorSpec / rotateSpec', () => {
  const fig: VisualSpec = spec(100, 100, [L(), shape('circle', 70, 30, 14, { fill: 'blue' }), shape('arrow', 30, 85, 16, { rotate: 90 })]);

  it('mirroring twice is the identity; four quarter turns are the identity', () => {
    for (const ax of ['x', 'y', 'diag', 'anti'] as const) expect(sameVisual(mirrorSpec(mirrorSpec(fig, ax), ax), fig)).toBe(true);
    let r = fig;
    for (let i = 0; i < 4; i++) r = rotateSpec(r, 90);
    expect(sameVisual(r, fig)).toBe(true);
    expect(sameVisual(rotateSpec(rotateSpec(fig, 90), 90), rotateSpec(fig, 180))).toBe(true);
    expect(sameVisual(rotateSpec(fig, 270), rotateSpec(rotateSpec(fig, 180), 90))).toBe(true);
  });

  it('a mirror image of an asymmetric figure is not any rotation of it', () => {
    for (const ax of ['x', 'y', 'diag', 'anti'] as const) {
      const m = mirrorSpec(fig, ax);
      for (const r of allRotations(fig)) expect(sameVisual(m, r)).toBe(false);
    }
  });

  it('mirror x then mirror y equals a half turn', () => {
    expect(sameVisual(mirrorSpec(mirrorSpec(fig, 'x'), 'y'), rotateSpec(fig, 180))).toBe(true);
  });

  it('diag mirror equals mirror x then a quarter turn anticlockwise', () => {
    expect(sameVisual(mirrorSpec(fig, 'diag'), rotateSpec(mirrorSpec(fig, 'x'), 270))).toBe(true);
    expect(sameVisual(mirrorSpec(fig, 'anti'), rotateSpec(mirrorSpec(fig, 'x'), 90))).toBe(true);
  });

  it('moves shapes and flips their orientation', () => {
    const s = spec(100, 100, [shape('arrow', 20, 30, 10)]);
    const m = mirrorSpec(s, 'x');
    expect(m.nodes[0]).toMatchObject({ x: 80, y: 30, flipX: true });
    const r = rotateSpec(s, 90);
    expect(r.nodes[0]).toMatchObject({ x: 70, y: 20, rotate: 90 });
  });

  it('a symmetric picture equals its mirror', () => {
    const s = spec(100, 100, [shape('heart', 50, 50, 30, { fill: 'red' }), shape('circle', 20, 20, 10), shape('circle', 80, 20, 10)]);
    expect(sameVisual(mirrorSpec(s, 'x'), s)).toBe(true);
    expect(sameVisual(mirrorSpec(s, 'y'), s)).toBe(false);
  });

  it('transforms grids cell by cell', () => {
    const g = spec(60, 60, [grid(0, 0, 3, 3, 20, { cells: [{ r: 0, c: 0, fill: 'red' }, { r: 1, c: 2, fill: 'blue' }] })]);
    const m = mirrorSpec(g, 'x');
    const cells = (m.nodes[0] as { cells: Array<{ r: number; c: number; fill?: string }> }).cells;
    expect(cells).toContainEqual({ r: 0, c: 2, fill: 'red' });
    expect(cells).toContainEqual({ r: 1, c: 0, fill: 'blue' });
    const r = rotateSpec(g, 90);
    const rc = (r.nodes[0] as { cells: Array<{ r: number; c: number; fill?: string }> }).cells;
    expect(rc).toContainEqual({ r: 0, c: 2, fill: 'red' });
    expect(rc).toContainEqual({ r: 2, c: 1, fill: 'blue' });
    // The grid picture key agrees with a picture built directly.
    const direct = spec(60, 60, [grid(0, 0, 3, 3, 20, { cells: [{ r: 0, c: 2, fill: 'red' }, { r: 2, c: 1, fill: 'blue' }] })]);
    expect(visualKey(r)).toBe(visualKey(direct));
  });
});
