/**
 * tangram-fit — "Which two pieces make this shape?" Shapes live on a lattice of quarter-triangles
 * (each unit square cut by both diagonals into N/E/S/W quarters), so squares, half-square
 * triangles, roofs, parallelograms and trapezoids are all exact sets. The validator brute-forces
 * every placement: the answer pair must tile the target using turns only; no other pair may tile
 * it even if its pieces are also flipped over.
 */
import type { Color, Difficulty, ExplainStep, Puzzle, PuzzleFamily, Rng, VisualNode, VisualSpec } from '../../engine/types';
import { OPTION_COUNT } from '../../engine/types';
import { group, line, pick, polygon, randInt, sample, shuffle, spec } from '../../engine/shapes';
import { byId, checkVisualChoice, choice, finish, generateValid, pickWrong, type Wrong } from './common';

const ID = 'tangram-fit' as const;

/** A quarter: [x, y, q] with q = 0 N, 1 E, 2 S, 3 W. */
type Q = [number, number, number];
type Shape = Q[];

const qk = (q: Q) => `${q[0]},${q[1]},${q[2]}`;
const sortQ = (s: Shape) => s.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]);

export const normalize = (s: Shape): Shape => {
  const mx = Math.min(...s.map((q) => q[0]));
  const my = Math.min(...s.map((q) => q[1]));
  return sortQ(s.map(([x, y, q]) => [x - mx, y - my, q]));
};
const key = (s: Shape) => normalize(s).map(qk).join(' ');

/** Quarter turn clockwise (SVG, y down): cell (x, y) → (−y−1, x); N → E → S → W. */
const turn = (s: Shape): Shape => s.map(([x, y, q]) => [-y - 1, x, (q + 1) % 4]);
/** Flip left ↔ right: E ↔ W. */
const flip = (s: Shape): Shape => s.map(([x, y, q]) => [-x - 1, y, q === 1 ? 3 : q === 3 ? 1 : q]);

const orientCache = new Map<string, Shape[]>();
export const orientations = (s: Shape, withFlips: boolean): Shape[] => {
  const ck = `${withFlips ? 1 : 0}|${key(s)}`;
  const hit = orientCache.get(ck);
  if (hit) return hit;
  const res = orientationsRaw(s, withFlips);
  orientCache.set(ck, res);
  return res;
};
const orientationsRaw = (s: Shape, withFlips: boolean): Shape[] => {
  const out = new Map<string, Shape>();
  let cur = s;
  for (let i = 0; i < 4; i++) {
    out.set(key(cur), normalize(cur));
    if (withFlips) out.set(key(flip(cur)), normalize(flip(cur)));
    cur = turn(cur);
  }
  return [...out.values()];
};

const full = (x: number, y: number): Shape => [0, 1, 2, 3].map((q) => [x, y, q] as Q);

/** The piece library (natural orientation). */
const PIECES: Record<string, { name: string; shape: Shape }> = {
  sq: { name: 'square', shape: full(0, 0) },
  tri: { name: 'small triangle', shape: [[0, 0, 0], [0, 0, 1]] },
  rect: { name: 'rectangle', shape: [...full(0, 0), ...full(1, 0)] },
  bigtri: { name: 'big triangle', shape: [...full(1, 0), [0, 0, 0], [0, 0, 1], [1, 1, 0], [1, 1, 1]] },
  roof: { name: 'roof triangle', shape: [[0, 0, 2], [0, 0, 1], [1, 0, 2], [1, 0, 3]] },
  para: { name: 'slanted shape', shape: [[0, 0, 2], [0, 0, 1], [1, 0, 0], [1, 0, 3]] },
  trap: { name: 'ramp', shape: [...full(0, 0), [1, 0, 2], [1, 0, 3]] },
  ell: { name: 'L shape', shape: [...full(0, 0), ...full(0, 1), ...full(1, 1)] },
  big: { name: 'big square', shape: [...full(0, 0), ...full(1, 0), ...full(0, 1), ...full(1, 1)] },
};
const area = (s: Shape) => s.length;

const place = (s: Shape, dx: number, dy: number): Shape => s.map(([x, y, q]) => [x + dx, y + dy, q]);
const turned = (s: Shape, k: number): Shape => {
  let c = s;
  for (let i = 0; i < k; i++) c = turn(c);
  return normalize(c);
};

interface Recipe {
  name: string;
  /** Build the target from the two answer pieces (piece id, quarter turns, offset). */
  parts: Array<{ id: string; k: number; dx: number; dy: number }>;
}

const RECIPES: Record<Difficulty, Recipe[]> = {
  1: [
    { name: 'square', parts: [{ id: 'tri', k: 0, dx: 0, dy: 0 }, { id: 'tri', k: 2, dx: 0, dy: 0 }] },
    { name: 'rectangle', parts: [{ id: 'sq', k: 0, dx: 0, dy: 0 }, { id: 'sq', k: 0, dx: 1, dy: 0 }] },
    { name: 'big square', parts: [{ id: 'rect', k: 0, dx: 0, dy: 0 }, { id: 'rect', k: 0, dx: 0, dy: 1 }] },
    { name: 'big square', parts: [{ id: 'bigtri', k: 0, dx: 0, dy: 0 }, { id: 'bigtri', k: 2, dx: 0, dy: 0 }] },
  ],
  2: [
    { name: 'house', parts: [{ id: 'big', k: 0, dx: 0, dy: 1 }, { id: 'roof', k: 0, dx: 0, dy: 0 }] },
    { name: 'rectangle', parts: [{ id: 'trap', k: 0, dx: 0, dy: 0 }, { id: 'tri', k: 1, dx: 1, dy: 0 }] },
    { name: 'L shape', parts: [{ id: 'rect', k: 1, dx: 0, dy: 0 }, { id: 'sq', k: 0, dx: 1, dy: 1 }] },
    { name: 'big square', parts: [{ id: 'bigtri', k: 1, dx: 0, dy: 0 }, { id: 'bigtri', k: 3, dx: 0, dy: 0 }] },
    { name: 'long rectangle', parts: [{ id: 'rect', k: 0, dx: 0, dy: 0 }, { id: 'sq', k: 0, dx: 2, dy: 0 }] },
  ],
  3: [
    { name: 'slanted shape', parts: [{ id: 'tri', k: 0, dx: 0, dy: 0 }, { id: 'trap', k: 0, dx: 1, dy: 0 }] },
    { name: 'long rectangle', parts: [{ id: 'trap', k: 0, dx: 0, dy: 0 }, { id: 'trap', k: 2, dx: 1, dy: 0 }] },
    { name: 'house', parts: [{ id: 'big', k: 0, dx: 0, dy: 1 }, { id: 'roof', k: 0, dx: 0, dy: 0 }] },
    { name: 'tall house', parts: [{ id: 'rect', k: 1, dx: 0, dy: 1 }, { id: 'roof', k: 1, dx: 1, dy: 0 }] },
    { name: 'T shape', parts: [{ id: 'ell', k: 0, dx: 0, dy: 0 }, { id: 'sq', k: 0, dx: 2, dy: 0 }] },
  ],
};

// ------------------------------------------------------------------------------------------------
// Tiling search

/** Can pieces a and b (turns only, or turns + flips) exactly cover target t? */
export const tiles = (t: Shape, a: Shape, b: Shape, withFlips: boolean): boolean => {
  if (area(a) + area(b) !== area(t)) return false;
  const T = normalize(t);
  const tset = new Set(T.map(qk));
  const t0 = T[0];
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    const yKeys = new Set(orientations(y, withFlips).map(key));
    for (const ox of orientations(x, withFlips))
      for (const q of ox) {
        if (q[2] !== t0[2]) continue;
        const moved = place(ox, t0[0] - q[0], t0[1] - q[1]);
        if (!moved.every((m) => tset.has(qk(m)))) continue;
        const mset = new Set(moved.map(qk));
        const rest = T.filter((m) => !mset.has(qk(m)));
        if (rest.length && yKeys.has(key(rest))) return true;
      }
  }
  return false;
};

// ------------------------------------------------------------------------------------------------
// Drawing

const quarterPts = ([x, y, q]: Q, u: number, ox: number, oy: number): Array<[number, number]> => {
  const X = ox + x * u;
  const Y = oy + y * u;
  const c: [number, number] = [X + u / 2, Y + u / 2];
  const corners: Array<[number, number]> = [
    [X, Y],
    [X + u, Y],
    [X + u, Y + u],
    [X, Y + u],
  ];
  return [corners[q], corners[(q + 1) % 4], c];
};

/** Filled quarters (no stroke) plus only the outside edges in ink. */
const drawShape = (s: Shape, u: number, ox: number, oy: number, fill: Color, id?: string): VisualNode => {
  const kids: VisualNode[] = s.map((q) => polygon(quarterPts(q, u, ox, oy), { fill, stroke: fill, strokeWidth: 1 }));
  // Each quarter has 3 edges; boundary edges are those not shared with another quarter.
  const ek = (p: [number, number], r: [number, number]) => {
    const a = `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
    const b = `${Math.round(r[0] * 10)},${Math.round(r[1] * 10)}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  };
  const count = new Map<string, { n: number; p: [number, number]; r: [number, number] }>();
  for (const q of s) {
    const pts = quarterPts(q, u, ox, oy);
    for (let i = 0; i < 3; i++) {
      const p = pts[i];
      const r = pts[(i + 1) % 3];
      const k = ek(p, r);
      const e = count.get(k);
      count.set(k, { n: (e?.n ?? 0) + 1, p, r });
    }
  }
  for (const { n, p, r } of count.values()) if (n === 1) kids.push(line(p[0], p[1], r[0], r[1], { stroke: 'ink', strokeWidth: 3 }));
  return group(kids, id ? { id } : undefined);
};

const U = 30;
const dims = (s: Shape) => {
  const n = normalize(s);
  return { w: Math.max(...n.map((q) => q[0])) + 1, h: Math.max(...n.map((q) => q[1])) + 1 };
};

const pairSpec = (a: Shape, b: Shape, ca: Color, cb: Color): VisualSpec => {
  const da = dims(a);
  const db = dims(b);
  const W = 160;
  const H = 100;
  const u = 30; // one size for every option, so piece sizes compare fairly
  const gap = (W - (da.w + db.w) * u) / 3;
  return spec(W, H, [
    drawShape(normalize(a), u, gap, (H - da.h * u) / 2, ca),
    drawShape(normalize(b), u, gap * 2 + da.w * u, (H - db.h * u) / 2, cb),
  ], 'Two pieces');
};

/** Reading a pair back: each group's quarter polygons → quarters. */
const readShape = (n: VisualNode | undefined): Shape | null => {
  if (!n || n.t !== 'g') return null;
  const polys = n.children.filter((c) => c.t === 'path');
  if (!polys.length) return null;
  // Recover u and origin from the polygons: every quarter has its centre vertex last.
  const pts = polys.map((p) => (p.t === 'path' ? p.d.match(/-?\d+(\.\d+)?/g)!.map(Number) : []));
  const u = Math.min(...pts.map((v) => Math.hypot(v[0] - v[2], v[1] - v[3])));
  const minX = Math.min(...pts.flatMap((v) => [v[0], v[2]]));
  const minY = Math.min(...pts.flatMap((v) => [v[1], v[3]]));
  return pts.map((v) => {
    const cx = v[4];
    const cy = v[5];
    const x = Math.round((cx - u / 2 - minX) / u);
    const y = Math.round((cy - u / 2 - minY) / u);
    // Quarter from the first corner relative to the centre.
    const dx = v[0] - cx;
    const dy = v[1] - cy;
    const q = dx < 0 && dy < 0 ? 0 : dx > 0 && dy < 0 ? 1 : dx > 0 && dy > 0 ? 2 : 3;
    return [x, y, q] as Q;
  });
};

const an = (w: string) => (/^[aeiouL]/.test(w) ? `an ${w}` : `a ${w}`);
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

const COLS: Color[] = ['blue', 'orange', 'teal', 'purple', 'red', 'green'];

const attempt = (d: Difficulty, rng: Rng): Puzzle | null => {
  const r = pick(RECIPES[d], rng);
  const parts = r.parts.map((p) => place(turned(PIECES[p.id].shape, p.k), p.dx, p.dy));
  const target = normalize(parts.flat());
  if (new Set(target.map(qk)).size !== target.length) return null; // overlap = bad recipe
  // How the answer pieces are shown: natural at easy, turned at medium/hard.
  const show = (id: string) => turned(PIECES[id].shape, d === 1 ? 0 : randInt(0, 3, rng));
  const [ca, cb] = sample(COLS, 2, rng);
  const aId = r.parts[0].id;
  const bId = r.parts[1].id;
  const ans = pairSpec(show(aId), show(bId), ca, cb);
  // Distractor pairs: same total size first (they look plausible), then one right + one wrong.
  const ids = Object.keys(PIECES);
  const cands: Array<{ a: string; b: string }> = [];
  for (const a of ids) for (const b of ids) if (a <= b) cands.push({ a, b });
  const pool: Wrong[] = [];
  const ok = (a: string, b: string) => !tiles(target, PIECES[a].shape, PIECES[b].shape, true);
  for (const c of shuffle(cands, rng)) {
    if (pool.length >= 8) break;
    if (area(PIECES[c.a].shape) + area(PIECES[c.b].shape) !== area(target) || !ok(c.a, c.b)) continue;
    pool.push({ visual: pairSpec(show(c.a), show(c.b), ca, cb), why: `${an(PIECES[c.a].name)} and ${an(PIECES[c.b].name)} don't make that shape` });
  }
  for (const keep of shuffle([aId, bId], rng))
    for (const other of shuffle(ids, rng)) {
      if (pool.length >= 14) break;
      if (!ok(keep, other)) continue;
      pool.push({ visual: pairSpec(show(keep), show(other), ca, cb), why: `the ${PIECES[other].name} is the wrong piece` });
    }
  const wrong = pickWrong(ans, pool, OPTION_COUNT[d]);
  if (!wrong) return null;
  const td = dims(target);
  const tw = td.w * U;
  const th = td.h * U;
  const VH = Math.max(th + 30, 120);
  const visual = spec(Math.max(tw + 40, 160), VH, [drawShape(target, U, (Math.max(tw + 40, 160) - tw) / 2, (VH - th) / 2, 'grey', 'target')], `A ${r.name} shape to build`);
  const mx = Math.min(...parts.flat().map((q) => q[0]));
  const my = Math.min(...parts.flat().map((q) => q[1]));
  const tx = (Math.max(tw + 40, 160) - tw) / 2;
  const both = spec(Math.max(tw + 40, 160), VH, [drawShape(place(parts[0], -mx, -my), U, tx, (VH - th) / 2, ca), drawShape(place(parts[1], -mx, -my), U, tx, (VH - th) / 2, cb)]);
  const explanation: ExplainStep[] = [
    { text: 'Look at the corners and slanted edges of the grey shape.', visual, highlight: ['target'] },
    { text: `${cap(an(PIECES[aId].name))} and ${an(PIECES[bId].name)} fit together — you can turn them.`, visual: ans },
    { text: 'Like this!', visual: both },
  ];
  return finish(ID, d, {
    prompt: 'Which two pieces make this shape?',
    speak: 'Which two pieces fit together to make the grey shape? You can turn them, but not flip them.',
    visual,
    answer: choice(rng, ans, wrong),
    explanation,
    rule: `${r.name} = ${PIECES[aId].name} + ${PIECES[bId].name}`,
    variant: r.name.replace(/ /g, '-'),
  });
};

export const validateTangram = (p: Puzzle): string[] => {
  const t = readShape(byId(p.visual.nodes, 'target'));
  const a = p.answer;
  if (!t) return ['could not read target'];
  if (a.kind !== 'choice') return ['bad answer kind'];
  const errs: string[] = [];
  const pairs = a.options.map((o) => (o.visual ? [readShape(o.visual.nodes[0]), readShape(o.visual.nodes[1])] : [null, null]));
  if (pairs.some(([x, y]) => !x || !y)) return ['could not read an option'];
  const strict = pairs.map(([x, y]) => tiles(t, x!, y!, false));
  const loose = pairs.map(([x, y]) => tiles(t, x!, y!, true));
  const hits = strict.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) errs.push(`expected one pair that builds the shape, found ${hits.length}`);
  else if (hits[0] !== a.answerIndex) errs.push('answerIndex is not the pair that builds the shape');
  loose.forEach((b, i) => b && i !== a.answerIndex && errs.push(`option ${i} also builds it (flipped)`));
  // Sanity: the shared generic checks (distinct pictures, whys, count).
  const exp = a.options[hits[0] ?? a.answerIndex]?.visual;
  if (exp) errs.push(...checkVisualChoice(p, exp).filter((e) => !e.startsWith('answerIndex')));
  return [...new Set(errs)];
};

export const tangramFit: PuzzleFamily = {
  id: ID,
  title: 'Shape builder',
  emoji: '🔷',
  group: 'spatial',
  variants: [...new Set([...RECIPES[1], ...RECIPES[2], ...RECIPES[3]].map((r) => r.name.replace(/ /g, '-')))],
  generate: (d, rng) => generateValid(() => attempt(d, rng), validateTangram),
  validate: validateTangram,
};
