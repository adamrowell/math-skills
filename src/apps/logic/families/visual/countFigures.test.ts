import { describe, expect, it } from 'vitest';
import { analyse } from './countFigures';

type P = [number, number];
const sq = (x: number, y: number, s: number): Array<[P, P]> => [
  [[x, y], [x + s, y]],
  [[x + s, y], [x + s, y + s]],
  [[x + s, y + s], [x, y + s]],
  [[x, y + s], [x, y]],
];

describe('count-figures brute force', () => {
  it('counts the classics', () => {
    const grid = (m: number, n: number) => {
      const s: Array<[P, P]> = [];
      for (let r = 0; r <= m; r++) s.push([[0, r * 10], [n * 10, r * 10]]);
      for (let c = 0; c <= n; c++) s.push([[c * 10, 0], [c * 10, m * 10]]);
      return s;
    };
    expect(analyse(grid(2, 2)).squares.length).toBe(5);
    expect(analyse(grid(3, 3)).squares.length).toBe(14);
    expect(analyse(grid(2, 3)).squares.length).toBe(8);
    expect(analyse(grid(2, 4)).squares.length).toBe(11);
    // Square with both diagonals: 4 small + 4 big triangles.
    expect(analyse([...sq(0, 0, 10), [[0, 0], [10, 10]], [[10, 0], [0, 10]]]).triangles.length).toBe(8);
    // Two 2×2 squares overlapping by one corner square → 3 squares.
    expect(analyse([...sq(0, 0, 20), ...sq(10, 10, 20)]).squares.length).toBe(3);
    // Segments drawn in pieces still count as one line.
    expect(analyse([[[0, 0], [5, 0]], [[5, 0], [10, 0]], [[10, 0], [10, 10]], [[10, 10], [0, 10]], [[0, 10], [0, 0]]]).squares.length).toBe(1);
  });
});

describe('count-figures triangle lattice with gaps (independent lattice count)', () => {
  // Lattice point (row, i): row 0 = apex, i = 0..row. Every triangle whose sides lie on the three
  // lattice directions is equilateral, so counting up/down triangles whose unit edges are all
  // present is an independent count.
  const key = (a: [number, number], b: [number, number]) => {
    const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? [a, b] : [b, a];
    return `${p[0]},${p[1]}-${q[0]},${q[1]}`;
  };
  const latticeEdges = (k: number) => {
    const e: Array<[[number, number], [number, number]]> = [];
    for (let r = 0; r < k; r++)
      for (let i = 0; i <= r; i++) e.push([[r, i], [r + 1, i]], [[r, i], [r + 1, i + 1]]);
    for (let r = 1; r <= k; r++) for (let i = 0; i < r; i++) e.push([[r, i], [r, i + 1]]);
    return e;
  };
  const latticeCount = (k: number, has: (a: [number, number], b: [number, number]) => boolean) => {
    let n = 0;
    for (let r = 0; r <= k; r++)
      for (let i = 0; i <= r; i++)
        for (let s = 1; r + s <= k; s++) {
          let ok = true;
          for (let t = 0; t < s && ok; t++)
            ok = has([r + t, i], [r + t + 1, i]) && has([r + t, i + t], [r + t + 1, i + t + 1]) && has([r + s, i + t], [r + s, i + t + 1]);
          if (ok) n++;
          if (i + s <= r) {
            let d = true;
            for (let t = 0; t < s && d; t++)
              d = has([r, i + t], [r, i + t + 1]) && has([r + t, i + t], [r + t + 1, i + t + 1]) && has([r + t, i + s], [r + t + 1, i + s]);
            if (d) n++;
          }
        }
    return n;
  };
  it('matches the brute-force counter on rounded pixel coordinates', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let trial = 0; trial < 300; trial++) {
      const k = 3 + (trial % 2);
      const all = latticeEdges(k);
      const border = (a: [number, number], b: [number, number]) =>
        (a[1] === 0 && b[1] === 0) || (a[1] === a[0] && b[1] === b[0]) || (a[0] === k && b[0] === k);
      const kept = all.filter(([a, b]) => border(a, b) || rnd() > 0.25);
      const set = new Set(kept.map(([a, b]) => key(a, b)));
      const want = latticeCount(k, (a, b) => set.has(key(a, b)));
      const scale = 180 + rnd() * 60;
      const turn = Math.floor(rnd() * 4);
      const toPx = ([r, i]: [number, number]): P => {
        let x = (0.5 + (i - r / 2) / k) * scale;
        let y = ((r * Math.sqrt(3)) / 2 / k) * scale;
        for (let t = 0; t < turn; t++) [x, y] = [-y, x];
        return [Math.round((x + 300) * 100) / 100, Math.round((y + 300) * 100) / 100];
      };
      const segs = kept.map(([a, b]) => [toPx(a), toPx(b)] as [P, P]);
      expect(analyse(segs).triangles.length).toBe(want);
    }
  });
  it('always counts the big outer triangle', () => {
    expect(latticeCount(3, () => true)).toBe(13);
    expect(analyse(latticeEdges(3).map(([a, b]) => {
      const f = ([r, i]: [number, number]): P => [Math.round((0.5 + (i - r / 2) / 3) * 26000) / 100, Math.round(((r * Math.sqrt(3)) / 6) * 26000) / 100];
      return [f(a), f(b)] as [P, P];
    })).triangles.length).toBe(13);
  });
});
