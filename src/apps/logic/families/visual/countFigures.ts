/**
 * count-figures — "How many triangles?" / "How many squares?" (keypad). Every figure is built from
 * straight line segments only, and the count is found by brute force over the drawn lines: every
 * triple of points joined by drawn lines is a triangle, every four points joined in a square is a
 * square. The validator re-reads the line nodes from the picture and counts again.
 */
import type { Difficulty, ExplainStep, LineNode, Puzzle, PuzzleFamily, Rng, VisualNode } from '../../engine/types';
import { group, line, pick, randInt, spec } from '../../engine/shapes';
import { byId, finish, generateValid } from './common';

const ID = 'count-figures' as const;

type P = [number, number];
type Seg = [P, P];

const EPS = 1e-6;
const eq = (a: number, b: number) => Math.abs(a - b) < 1e-4;

// ------------------------------------------------------------------------------------------------
// Geometry: merge collinear segments, find points, count shapes.

const cross = (a: P, b: P, c: P) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Distance tolerance (px): drawn coordinates are rounded to 0.01 px, so near-collinear rounded
 * pieces of one long slanted line must still count as one line. Lines in a figure are always far
 * more than this apart. */
const TOL = 0.5;
/** Perpendicular distance from p to the infinite line through a, b. */
const lineDist = (a: P, b: P, p: P) => Math.abs(cross(a, b, p)) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);

const onSeg = (p: P, s: Seg) => {
  const [a, b] = s;
  if (lineDist(a, b, p) > TOL) return false;
  const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const slack = TOL / len;
  return t > -slack && t < 1 + slack;
};

/** Merge overlapping/touching collinear segments into maximal ones. */
export const mergeSegments = (segs: Seg[]): Seg[] => {
  let out = segs.slice();
  for (let changed = true; changed; ) {
    changed = false;
    outer: for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        if (lineDist(a[0], a[1], b[0]) > TOL || lineDist(a[0], a[1], b[1]) > TOL) continue;
        if (!(onSeg(b[0], a) || onSeg(b[1], a) || onSeg(a[0], b) || onSeg(a[1], b))) continue;
        // Collinear and touching: span the extreme points.
        const pts = [a[0], a[1], b[0], b[1]];
        const dir: P = [a[1][0] - a[0][0], a[1][1] - a[0][1]];
        const proj = (p: P) => p[0] * dir[0] + p[1] * dir[1];
        pts.sort((p, q) => proj(p) - proj(q));
        out = out.filter((_, k) => k !== i && k !== j);
        out.push([pts[0], pts[3]]);
        changed = true;
        break outer;
      }
  }
  return out;
};

const intersect = (s: Seg, t: Seg): P | null => {
  const [p, p2] = s;
  const [q, q2] = t;
  const r: P = [p2[0] - p[0], p2[1] - p[1]];
  const v: P = [q2[0] - q[0], q2[1] - q[1]];
  const den = r[0] * v[1] - r[1] * v[0];
  if (Math.abs(den) < EPS) return null;
  const tt = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den;
  const uu = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den;
  const sl = TOL / Math.hypot(r[0], r[1]);
  const ul = TOL / Math.hypot(v[0], v[1]);
  if (tt < -sl || tt > 1 + sl || uu < -ul || uu > 1 + ul) return null;
  return [p[0] + tt * r[0], p[1] + tt * r[1]];
};

export interface Found {
  pts: P[];
  area: number;
}

export const analyse = (raw: Seg[]) => {
  const segs = mergeSegments(raw);
  const list: P[] = [];
  const near = (p: P) => list.findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < TOL);
  const add = (p: P) => {
    if (near(p) < 0) list.push(p);
  };
  for (const s of segs) {
    add(s[0]);
    add(s[1]);
  }
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const x = intersect(segs[i], segs[j]);
      if (x) add(x);
    }
  const pts = list;
  const n = pts.length;
  const conn: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) conn[i][j] = conn[j][i] = segs.some((s) => onSeg(pts[i], s) && onSeg(pts[j], s));
  const area = (ps: P[]) => Math.abs(ps.reduce((a, p, i) => a + p[0] * ps[(i + 1) % ps.length][1] - ps[(i + 1) % ps.length][0] * p[1], 0)) / 2;

  const triangles: Found[] = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      if (!conn[a][b]) continue;
      for (let c = b + 1; c < n; c++) {
        if (!conn[a][c] || !conn[b][c]) continue;
        if (lineDist(pts[a], pts[b], pts[c]) < 2 * TOL) continue;
        triangles.push({ pts: [pts[a], pts[b], pts[c]], area: area([pts[a], pts[b], pts[c]]) });
      }
    }
  const squares: Found[] = [];
  const seen = new Set<string>();
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      if (a === b || !conn[a][b]) continue;
      const dx = pts[b][0] - pts[a][0];
      const dy = pts[b][1] - pts[a][1];
      const c = near([pts[b][0] - dy, pts[b][1] + dx]);
      const d = near([pts[a][0] - dy, pts[a][1] + dx]);
      if (c < 0 || d < 0) continue;
      if (!conn[b][c] || !conn[c][d] || !conn[d][a]) continue;
      const key = [a, b, c, d].sort((x, y) => x - y).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      squares.push({ pts: [pts[a], pts[b], pts[c], pts[d]], area: dx * dx + dy * dy });
    }
  return { triangles, squares, segs };
};

// ------------------------------------------------------------------------------------------------
// Figure templates (unit coordinates, y down)

interface Fig {
  segs: Seg[];
  ask: 'triangles' | 'squares';
  variant: string;
}

const rect = (x: number, y: number, w: number, h: number): Seg[] => [
  [[x, y], [x + w, y]],
  [[x + w, y], [x + w, y + h]],
  [[x + w, y + h], [x, y + h]],
  [[x, y + h], [x, y]],
];

const gridSegs = (m: number, n: number): Seg[] => {
  const s: Seg[] = [];
  for (let r = 0; r <= m; r++) s.push([[0, r], [n, r]]);
  for (let c = 0; c <= n; c++) s.push([[c, 0], [c, m]]);
  return s;
};

/** Big triangle (apex up) of side 1 split into k rows of small triangles. */
export const triRows = (k: number): Seg[] => {
  const h = Math.sqrt(3) / 2;
  const s: Seg[] = [];
  const A: P = [0.5, 0];
  const B: P = [0, h];
  const C: P = [1, h];
  const lerp = (p: P, q: P, t: number): P => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  s.push([A, B], [B, C], [C, A]);
  for (let i = 1; i < k; i++) {
    const t = i / k;
    s.push([lerp(A, B, t), lerp(A, C, t)]); // horizontal
    s.push([lerp(B, A, t), lerp(B, C, t)]); // parallel to AC
    s.push([lerp(C, A, t), lerp(C, B, t)]); // parallel to AB
  }
  return s;
};

/** Triangle with k lines from the apex to the base, and optional cross bars. */
const triApex = (k: number, bars: number): Seg[] => {
  const A: P = [0.5, 0];
  const B: P = [0, 0.9];
  const C: P = [1, 0.9];
  const s: Seg[] = [
    [A, B],
    [B, C],
    [C, A],
  ];
  const xs = Array.from({ length: k }, (_, i) => (i + 1) / (k + 1));
  // Uneven spacing so it doesn't look like rows.
  for (const x of xs) s.push([A, [x, 0.9]]);
  for (let b = 1; b <= bars; b++) {
    const t = b / (bars + 1) + 0.1;
    s.push([
      [0.5 - 0.5 * t, 0.9 * t],
      [0.5 + 0.5 * t, 0.9 * t],
    ]);
  }
  return s;
};

/** Every unit edge of an m×n grid. */
export const gridUnits = (m: number, n: number): Seg[] => {
  const s: Seg[] = [];
  for (let r = 0; r <= m; r++) for (let c = 0; c < n; c++) s.push([[c, r], [c + 1, r]]);
  for (let c = 0; c <= n; c++) for (let r = 0; r < m; r++) s.push([[c, r], [c, r + 1]]);
  return s;
};

/** Every small edge of a big triangle split into k rows. */
export const triUnits = (k: number): Seg[] => {
  const h = Math.sqrt(3) / 2 / k;
  const P_ = (row: number, i: number): P => [0.5 + (i - row / 2) / k, row * h]; // row 0 = apex, i = 0..row
  const s: Seg[] = [];
  for (let row = 0; row < k; row++)
    for (let i = 0; i <= row; i++) {
      s.push([P_(row, i), P_(row + 1, i)], [P_(row, i), P_(row + 1, i + 1)]);
    }
  for (let row = 1; row <= k; row++) for (let i = 0; i < row; i++) s.push([P_(row, i), P_(row, i + 1)]);
  return s;
};

/** Remove `k` edges that are not on the outside border (so the outline stays whole). */
export const withGaps = (units: Seg[], k: number, rng: Rng): Seg[] => {
  const xs = units.flatMap((u) => [u[0][0], u[1][0]]);
  const ys = units.flatMap((u) => [u[0][1], u[1][1]]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const minY = Math.min(...ys);
  const isBorder = (u: Seg) => {
    // A unit edge is on the border when it is not shared by two cells: approximate by the hull lines.
    const mid: P = [(u[0][0] + u[1][0]) / 2, (u[0][1] + u[1][1]) / 2];
    const onBox = eq(mid[0], minX) || eq(mid[0], maxX) || eq(mid[1], minY) || eq(mid[1], maxY);
    // Triangle sides: points on the lines from apex (0.5, 0) to the base corners.
    const onSide = eq(mid[1], 2 * (Math.sqrt(3) / 2) * Math.abs(mid[0] - 0.5)) && eq(maxY, Math.sqrt(3) / 2);
    return onBox || onSide;
  };
  const inner = units.map((u, i) => ({ u, i })).filter((x) => !isBorder(x.u));
  const drop = new Set<number>();
  for (let t = 0; t < k && inner.length; t++) drop.add(pick(inner, rng).i);
  return units.filter((_, i) => !drop.has(i));
};

const squareX = (mid: boolean): Seg[] => {
  const s = rect(0, 0, 1, 1);
  s.push([[0, 0], [1, 1]], [[1, 0], [0, 1]]);
  if (mid) s.push([[0.5, 0], [0.5, 1]], [[0, 0.5], [1, 0.5]]);
  return s;
};

const starOfDavid = (): Seg[] => {
  const h = Math.sqrt(3) / 2;
  const up: P[] = [[0.5, 0], [0, h], [1, h]];
  const dn: P[] = [[0, h / 3], [1, h / 3], [0.5, (4 * h) / 3]];
  return [
    [up[0], up[1]], [up[1], up[2]], [up[2], up[0]],
    [dn[0], dn[1]], [dn[1], dn[2]], [dn[2], dn[0]],
  ];
};

/** Two or three squares overlapping at random offsets on an integer lattice. */
const overlapSquares = (count: number, rng: Rng): Seg[] => {
  const s: Seg[] = [];
  for (let i = 0; i < count; i++) {
    const size = randInt(2, 3, rng);
    s.push(...rect(randInt(0, 2, rng), randInt(0, 2, rng), size, size));
  }
  return s;
};

const triangleOneLine = (rng: Rng): Seg[] => (rng() < 0.5 ? triApex(1, 0) : [...rect(0, 0, 1, 1), [[0, 0], [1, 1]]]);

const plan = (d: Difficulty, rng: Rng): Fig => {
  const pool: Record<Difficulty, Array<[number, () => Fig]>> = {
    1: [
      [1, () => ({ segs: gridSegs(randInt(1, 2, rng), 2 + randInt(0, 1, rng)), ask: 'squares', variant: 'grid' })],
      [3, () => ({ segs: overlapSquares(2, rng), ask: 'squares', variant: 'overlap' })],
      [1, () => ({ segs: triangleOneLine(rng), ask: 'triangles', variant: 'split' })],
      [1, () => ({ segs: triApex(randInt(1, 2, rng), 0), ask: 'triangles', variant: 'fan' })],
      [3, () => ({ segs: withGaps(gridUnits(2, 3), 1, rng), ask: 'squares', variant: 'grid-gaps' })],
    ],
    2: [
      [3, () => ({ segs: withGaps(gridUnits(3, 3), randInt(2, 4, rng), rng), ask: 'squares', variant: 'grid-gaps' })],
      [3, () => ({ segs: withGaps(triUnits(3), randInt(2, 4, rng), rng), ask: 'triangles', variant: 'rows-gaps' })],
      [1, () => ({ segs: triRows(2), ask: 'triangles', variant: 'rows' })],
      [1, () => ({ segs: squareX(false), ask: 'triangles', variant: 'square-x' })],
      [1, () => ({ segs: gridSegs(2, randInt(2, 3, rng)), ask: 'squares', variant: 'grid' })],
      [1, () => ({ segs: triApex(randInt(2, 3, rng), 0), ask: 'triangles', variant: 'fan' })],
      [3, () => ({ segs: overlapSquares(3, rng), ask: 'squares', variant: 'overlap' })],
    ],
    3: [
      [1, () => ({ segs: gridSegs(3, 3), ask: 'squares', variant: 'grid' })],
      [1, () => ({ segs: gridSegs(randInt(2, 3, rng), 4), ask: 'squares', variant: 'grid' })],
      [1, () => ({ segs: triRows(3), ask: 'triangles', variant: 'rows' })],
      [1, () => ({ segs: starOfDavid(), ask: 'triangles', variant: 'star' })],
      [1, () => ({ segs: triApex(randInt(1, 2, rng), 1), ask: 'triangles', variant: 'fan-bar' })],
      [1, () => ({ segs: squareX(true), ask: 'triangles', variant: 'square-x' })],
      [3, () => ({ segs: withGaps(gridUnits(3, 4), randInt(1, 3, rng), rng), ask: 'squares', variant: 'grid-gaps' })],
      [3, () => ({ segs: withGaps(gridUnits(4, 4), randInt(3, 6, rng), rng), ask: 'squares', variant: 'grid-gaps' })],
      [3, () => ({ segs: withGaps(triUnits(3), randInt(1, 2, rng), rng), ask: 'triangles', variant: 'rows-gaps' })],
      [3, () => ({ segs: withGaps(triUnits(4), randInt(4, 7, rng), rng), ask: 'triangles', variant: 'rows-gaps' })],
    ],
  };
  // Classic fixed figures are worth meeting, but the open-ended "gaps" and overlap figures carry the
  // variety, so they are drawn twice as often.
  const weighted = pool[d].flatMap(([w, f]) => Array.from({ length: w }, () => f));
  return pick(weighted, rng)();
};

const LIMITS: Record<Difficulty, [number, number]> = { 1: [2, 7], 2: [4, 13], 3: [8, 20] };

const W = 300;
const H = 240;

const attempt = (d: Difficulty, rng: Rng): Puzzle | null => {
  const fig = plan(d, rng);
  // Random quarter-turn / flip so the same family looks different.
  const turn = randInt(0, 3, rng);
  const flip = rng() < 0.5;
  const tf = (p: P): P => {
    let [x, y] = flip ? [-p[0], p[1]] : p;
    for (let i = 0; i < turn; i++) [x, y] = [-y, x];
    return [x, y];
  };
  const segs: Seg[] = fig.segs.map(([a, b]) => [tf(a), tf(b)]);
  const xs = segs.flatMap((s) => [s[0][0], s[1][0]]);
  const ys = segs.flatMap((s) => [s[0][1], s[1][1]]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const sw = Math.max(...xs) - minX;
  const sh = Math.max(...ys) - minY;
  const scale = Math.min((W - 40) / sw, (H - 40) / sh);
  const ox = (W - sw * scale) / 2;
  const oy = (H - sh * scale) / 2;
  const toExact = (p: P): P => [ox + (p[0] - minX) * scale, oy + (p[1] - minY) * scale];
  const exact: Seg[] = segs.map(([a, b]) => [toExact(a), toExact(b)]);
  const round = (p: P): P => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
  const px: Seg[] = exact.map(([a, b]) => [round(a), round(b)]);
  const colour = pick(['blue', 'purple', 'teal', 'ink', 'red', 'green'] as const, rng);
  const lines: VisualNode[] = px.map(([a, b]) => line(a[0], a[1], b[0], b[1], { stroke: colour, strokeWidth: 3.5 }));
  const visual = spec(W, H, [group(lines, { id: 'fig' })], `A figure made of lines. Count the ${fig.ask}.`);
  // Count on the exact (unrounded) geometry; the validator re-counts from the rounded drawn lines,
  // so the two must agree.
  const res = analyse(exact);
  const found = fig.ask === 'triangles' ? res.triangles : res.squares;
  const n = found.length;
  if (n < LIMITS[d][0] || n > LIMITS[d][1]) return null;

  // Group by size for the explanation (biggest last), with one example of each outlined.
  const bySize = new Map<number, Found[]>();
  for (const f of found) {
    const k = Math.round(f.area / 50) * 50;
    const hit = [...bySize.keys()].find((a) => Math.abs(a - k) <= Math.max(60, a * 0.08));
    bySize.set(hit ?? k, [...(bySize.get(hit ?? k) ?? []), f]);
  }
  const sizes = [...bySize.entries()].sort((a, b) => a[0] - b[0]);
  const names = sizes.length === 1 ? [''] : sizes.length === 2 ? ['small', 'big'] : ['small', 'middle', 'big', 'giant'];
  const steps: ExplainStep[] = sizes.slice(0, 3).map(([, fs], i) => {
    const ex = fs[0].pts;
    const outline = ex.map((p, j) => line(p[0], p[1], ex[(j + 1) % ex.length][0], ex[(j + 1) % ex.length][1], { stroke: 'red', strokeWidth: 6, id: `ex${i}` }));
    const word = fig.ask === 'triangles' ? 'triangle' : 'square';
    const nm = names[i] ? `${names[i]} ` : '';
    return {
      text: `${nm ? nm[0].toUpperCase() + nm.slice(1) : 'Each '}${word}s like this one: ${fs.length}.`.replace('Each triangles', 'Triangles').replace('Each squares', 'Squares'),
      visual: spec(W, H, [group(lines), ...outline]),
      highlight: [`ex${i}`],
    };
  });
  const sum = sizes.map(([, fs]) => fs.length);
  steps.push({ text: sum.length > 1 ? `Add them up: ${sum.join(' + ')} = ${n}.` : `That makes ${n}.` });
  return finish(ID, d, {
    prompt: `How many ${fig.ask}?`,
    speak: `How many ${fig.ask} can you find? Look for big ones too!`,
    visual,
    answer: { kind: 'number', answer: n },
    explanation: steps.slice(-4),
    rule: `${sum.join(' + ')} = ${n} ${fig.ask}`,
    variant: fig.variant,
  });
};

export const countInPuzzle = (p: Puzzle): number | null => {
  const g = byId(p.visual.nodes, 'fig');
  if (!g || g.t !== 'g') return null;
  const segs: Seg[] = g.children.filter((c): c is LineNode => c.t === 'line').map((l) => [[l.x1, l.y1], [l.x2, l.y2]]);
  const r = analyse(segs);
  return p.prompt.includes('triangles') ? r.triangles.length : p.prompt.includes('squares') ? r.squares.length : null;
};

export const validateCountFigures = (p: Puzzle): string[] => {
  if (p.answer.kind !== 'number') return ['expected a number answer'];
  const n = countInPuzzle(p);
  if (n === null) return ['could not read the figure'];
  if (n !== p.answer.answer) return [`counted ${n}, answer says ${p.answer.answer}`];
  if (!eq(n, Math.round(n))) return ['bad count'];
  return [];
};

export const countFigures: PuzzleFamily = {
  id: ID,
  title: 'Shape hunt',
  emoji: '🔺',
  group: 'spatial',
  variants: ['grid', 'grid-gaps', 'overlap', 'split', 'fan', 'rows', 'rows-gaps', 'square-x', 'star', 'fan-bar'],
  generate: (d, rng) => generateValid(() => attempt(d, rng), validateCountFigures),
  validate: validateCountFigures,
};
