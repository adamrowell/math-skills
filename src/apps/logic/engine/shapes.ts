/**
 * Pure helpers that build and compare VisualSpec nodes (docs/GEO-LOGIC.md §E.5).
 *
 * Used by every family (number and visual) and by validators. Nothing here touches React or the
 * DOM, so it all runs in node under vitest.
 *
 * Geometry conventions (SVG, y grows downwards, `rotate` is clockwise degrees):
 *   - a shape's transform is translate(x y) · rotate(r) · scale(flipX ? -1 : 1, flipY ? -1 : 1)
 *   - mirrorSpec(s, 'x') maps x → w − x (a vertical mirror line: left ↔ right)
 *   - mirrorSpec(s, 'y') maps y → h − y (a horizontal mirror line: top ↔ bottom)
 *   - mirrorSpec(s, 'diag') swaps x and y (line from top-left to bottom-right; square specs only)
 *   - mirrorSpec(s, 'anti') maps (x, y) → (w − y, h − x) (top-right to bottom-left; square specs)
 *   - rotateSpec(s, 90) turns the picture a quarter turn clockwise (w and h swap)
 *
 * `sameVisual` flattens every node to world space, folds each shape's orientation through that
 * shape kind's own symmetry group (a square turned 90° IS the same square) and compares sorted
 * canonical keys. When in doubt it errs towards "same" — a validator that over-rejects only costs a
 * regeneration, while one that under-rejects could ship two identical options.
 */
import type {
  Color,
  GridCell,
  GridNode,
  GroupNode,
  LineNode,
  PathNode,
  Rng,
  ShapeKind,
  ShapeNode,
  TextNode,
  VisualNode,
  VisualSpec,
} from './types';

// ---------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------

export const shape = (kind: ShapeKind, x: number, y: number, size: number, o?: Partial<ShapeNode>): ShapeNode => ({
  t: 'shape',
  kind,
  x,
  y,
  size,
  ...o,
});

export const text = (x: number, y: number, t: string, o?: Partial<TextNode>): TextNode => ({
  t: 'text',
  x,
  y,
  text: t,
  ...o,
});

export const line = (x1: number, y1: number, x2: number, y2: number, o?: Partial<LineNode>): LineNode => ({
  t: 'line',
  x1,
  y1,
  x2,
  y2,
  ...o,
});

export const group = (children: VisualNode[], o?: Partial<GroupNode>): GroupNode => ({
  t: 'g',
  children,
  ...o,
});

export const grid = (x: number, y: number, rows: number, cols: number, cell: number, o?: Partial<GridNode>): GridNode => ({
  t: 'grid',
  x,
  y,
  rows,
  cols,
  cell,
  ...o,
});

/** A closed polygon path from points ("M x y L x y … Z"). */
export const polygon = (pts: ReadonlyArray<readonly [number, number]>, o?: Partial<PathNode>): PathNode => ({
  t: 'path',
  d: pointsToD([pts.map(([x, y]) => [x, y] as Pt)], [true]),
  ...o,
});

/**
 * Lay nodes out left→right centred on (x, y), `gap` apart (centre to centre). Each item should be
 * authored centred on (0, 0); it is wrapped in a translated group so its own id is kept.
 */
export const row = (items: VisualNode[], o: { x: number; y: number; gap: number }): GroupNode => {
  const n = items.length;
  return group(items.map((it, i) => group([it], { x: o.x + (i - (n - 1) / 2) * o.gap, y: o.y })));
};

export const spec = (w: number, h: number, nodes: VisualNode[], label?: string): VisualSpec =>
  label === undefined ? { w, h, nodes } : { w, h, nodes, label };

// ---------------------------------------------------------------------------------------------
// Random helpers (all take the injected rng so puzzles are deterministic per seed)
// ---------------------------------------------------------------------------------------------

export const shuffle = <T>(xs: readonly T[], rng: Rng): T[] => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const pick = <T>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length) % xs.length];

/** Integer in [lo, hi] inclusive. */
export const randInt = (lo: number, hi: number, rng: Rng): number => lo + (Math.floor(rng() * (hi - lo + 1)) % (hi - lo + 1));

/** `n` distinct items in random order. */
export const sample = <T>(xs: readonly T[], n: number, rng: Rng): T[] => shuffle(xs, rng).slice(0, n);

// ---------------------------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------------------------

/** The four shapes every 5-year-old can name. */
export const KINDS_EASY: ShapeKind[] = ['circle', 'square', 'triangle', 'star'];

/** Shapes that read clearly at option size (dot/rect/L/moon left out: too easy to confuse). */
export const KINDS_ALL: ShapeKind[] = [
  'circle',
  'square',
  'triangle',
  'star',
  'diamond',
  'pentagon',
  'hexagon',
  'heart',
  'cross',
  'semicircle',
  'trapezoid',
];

/** Kid names for prompts and explanations. */
export const KIND_NAME: Record<ShapeKind, string> = {
  circle: 'circle',
  square: 'square',
  rect: 'rectangle',
  triangle: 'triangle',
  'right-triangle': 'triangle',
  diamond: 'diamond',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  star: 'star',
  heart: 'heart',
  cross: 'cross',
  arrow: 'arrow',
  moon: 'moon',
  semicircle: 'half circle',
  trapezoid: 'trapezoid',
  parallelogram: 'parallelogram',
  L: 'L shape',
  dot: 'dot',
};

/**
 * Colours that stay apart for the common colour-vision deficiencies when paired with a second
 * cue (shape, pattern or count). Families never rely on colour alone at easy: a colour cycle is
 * always also a shape or pattern cycle, or the colours come from this well-separated set.
 */
export const COLORS_SAFE: Color[] = ['blue', 'yellow', 'red', 'purple', 'teal', 'orange'];

// ---------------------------------------------------------------------------------------------
// Affine maths
// ---------------------------------------------------------------------------------------------

type Pt = [number, number];
/** SVG matrix(a b c d e f): x' = a x + c y + e, y' = b x + d y + f. */
type M = [number, number, number, number, number, number];

const I: M = [1, 0, 0, 1, 0, 0];
const mul = (p: M, q: M): M => [
  p[0] * q[0] + p[2] * q[1],
  p[1] * q[0] + p[3] * q[1],
  p[0] * q[2] + p[2] * q[3],
  p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4],
  p[1] * q[4] + p[3] * q[5] + p[5],
];
const apply = (m: M, x: number, y: number): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const rad = (deg: number) => (deg * Math.PI) / 180;
const translateM = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const rotateM = (deg: number): M => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, s, -s, c, 0, 0];
};
const scaleM = (sx: number, sy: number): M => [sx, 0, 0, sy, 0, 0];

const nodeM = (n: { x?: number; y?: number; rotate?: number; flipX?: boolean; flipY?: boolean; scale?: number }): M =>
  mul(
    mul(translateM(n.x ?? 0, n.y ?? 0), rotateM(n.rotate ?? 0)),
    scaleM((n.flipX ? -1 : 1) * (n.scale ?? 1), (n.flipY ? -1 : 1) * (n.scale ?? 1)),
  );

const norm360 = (deg: number) => {
  const r = Math.round(deg) % 360;
  return r < 0 ? r + 360 : r;
};

// ---------------------------------------------------------------------------------------------
// Path parsing (M/L/H/V/Z absolute commands — what this module and the families emit)
// ---------------------------------------------------------------------------------------------

/** Parse "M x y L x y H x V y Z" into sub-paths. Throws on commands it does not understand. */
export const parsePath = (d: string): { subs: Pt[][]; closed: boolean[] } => {
  const toks = d.match(/[MLHVZmlhvz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const subs: Pt[][] = [];
  const closed: boolean[] = [];
  let cur: Pt[] | null = null;
  let cmd = '';
  let i = 0;
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    const t = toks[i];
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd === 'Z' || cmd === 'z') {
        if (cur) closed[closed.length - 1] = true;
        cur = null;
        continue;
      }
      if (!'MLHV'.includes(cmd)) throw new Error(`parsePath: unsupported command ${cmd}`);
    }
    const last: Pt = cur && cur.length ? cur[cur.length - 1] : [0, 0];
    if (cmd === 'M') {
      cur = [[num(), num()]];
      subs.push(cur);
      closed.push(false);
      cmd = 'L';
    } else if (cmd === 'L') {
      cur?.push([num(), num()]);
    } else if (cmd === 'H') {
      cur?.push([num(), last[1]]);
    } else if (cmd === 'V') {
      cur?.push([last[0], num()]);
    } else {
      throw new Error(`parsePath: bad token ${t}`);
    }
  }
  return { subs, closed };
};

const fmt = (v: number) => String(Math.round(v * 100) / 100);
const pointsToD = (subs: Pt[][], closed: boolean[]) =>
  subs
    .map((pts, k) => pts.map((p, i) => `${i ? 'L' : 'M'}${fmt(p[0])} ${fmt(p[1])}`).join(' ') + (closed[k] ? ' Z' : ''))
    .join(' ');

// ---------------------------------------------------------------------------------------------
// Whole-picture transforms
// ---------------------------------------------------------------------------------------------

export type MirrorAxis = 'x' | 'y' | 'diag' | 'anti';

interface Op {
  /** Point map in the parent's coordinates. */
  pt: (x: number, y: number) => Pt;
  /** Orientation update for an oriented node (shape / group). */
  orient: (rotate: number, flipX: boolean, flipY: boolean) => { rotate: number; flipX: boolean; flipY: boolean };
  /** Same op for a box of size w×h (used inside grid cells). */
  forBox: (w: number, h: number) => Op;
  /** Text anchor update. */
  anchor: (a: TextNode['anchor']) => TextNode['anchor'];
  /** Grid: new (rows, cols, r, c) mapping. */
  cell: (rows: number, cols: number, r: number, c: number) => [number, number];
  swapsRC: boolean;
}

const mirrorOp = (axis: MirrorAxis, w: number, h: number): Op => {
  const flipAnchor = (a: TextNode['anchor']) => (a === 'start' ? 'end' : a === 'end' ? 'start' : a);
  switch (axis) {
    case 'x':
      return {
        pt: (x, y) => [w - x, y],
        orient: (r, fx, fy) => ({ rotate: norm360(-r), flipX: !fx, flipY: fy }),
        forBox: (bw, bh) => mirrorOp('x', bw, bh),
        anchor: flipAnchor,
        cell: (_rows, cols, r, c) => [r, cols - 1 - c],
        swapsRC: false,
      };
    case 'y':
      return {
        pt: (x, y) => [x, h - y],
        orient: (r, fx, fy) => ({ rotate: norm360(-r), flipX: fx, flipY: !fy }),
        forBox: (bw, bh) => mirrorOp('y', bw, bh),
        anchor: (a) => a,
        cell: (rows, _cols, r, c) => [rows - 1 - r, c],
        swapsRC: false,
      };
    case 'diag':
      // (x, y) → (y, x) = R(270)·F
      return {
        pt: (x, y) => [y, x],
        orient: (r, fx, fy) => ({ rotate: norm360(270 - r), flipX: !fx, flipY: fy }),
        forBox: (bw, bh) => mirrorOp('diag', bw, bh),
        anchor: (a) => a,
        cell: (_rows, _cols, r, c) => [c, r],
        swapsRC: true,
      };
    case 'anti':
      // (x, y) → (w − y, h − x) = R(90)·F about the centre
      return {
        pt: (x, y) => [w - y, h - x],
        orient: (r, fx, fy) => ({ rotate: norm360(90 - r), flipX: !fx, flipY: fy }),
        forBox: (bw, bh) => mirrorOp('anti', bw, bh),
        anchor: (a) => a,
        cell: (rows, cols, r, c) => [cols - 1 - c, rows - 1 - r],
        swapsRC: true,
      };
  }
};

const rotateOp = (deg: 90 | 180 | 270, w: number, h: number): Op => {
  const pt = (x: number, y: number): Pt =>
    deg === 90 ? [h - y, x] : deg === 180 ? [w - x, h - y] : [y, w - x];
  return {
    pt,
    orient: (r, fx, fy) => ({ rotate: norm360(r + deg), flipX: fx, flipY: fy }),
    forBox: (bw, bh) => rotateOp(deg, bw, bh),
    anchor: (a) => a,
    cell: (rows, cols, r, c) =>
      deg === 90 ? [c, rows - 1 - r] : deg === 180 ? [rows - 1 - r, cols - 1 - c] : [cols - 1 - c, r],
    swapsRC: deg !== 180,
  };
};

const xformNode = (n: VisualNode, op: Op): VisualNode => {
  switch (n.t) {
    case 'shape': {
      const [x, y] = op.pt(n.x, n.y);
      const o = op.orient(n.rotate ?? 0, !!n.flipX, !!n.flipY);
      const out: ShapeNode = { ...n, x, y };
      setOrient(out, o);
      return out;
    }
    case 'g': {
      const [x, y] = op.pt(n.x ?? 0, n.y ?? 0);
      const o = op.orient(n.rotate ?? 0, !!n.flipX, !!n.flipY);
      const out: GroupNode = { ...n, x, y };
      setOrient(out, o);
      return out;
    }
    case 'text':
    case 'emoji':
    case 'clock':
    case 'scale': {
      const [x, y] = op.pt(n.x, n.y);
      if (n.t === 'text') {
        const a = op.anchor(n.anchor);
        const out: TextNode = { ...n, x, y };
        if (a === undefined) delete out.anchor;
        else out.anchor = a;
        return out;
      }
      return { ...n, x, y };
    }
    case 'line': {
      const [x1, y1] = op.pt(n.x1, n.y1);
      const [x2, y2] = op.pt(n.x2, n.y2);
      return { ...n, x1, y1, x2, y2 };
    }
    case 'path': {
      const { subs, closed } = parsePath(n.d);
      return { ...n, d: pointsToD(subs.map((s) => s.map(([x, y]) => op.pt(x, y))), closed) };
    }
    case 'grid': {
      const W = n.cols * n.cell;
      const H = n.rows * n.cell;
      const corners = [op.pt(n.x, n.y), op.pt(n.x + W, n.y + H)];
      const x = Math.min(corners[0][0], corners[1][0]);
      const y = Math.min(corners[0][1], corners[1][1]);
      const rows = op.swapsRC ? n.cols : n.rows;
      const cols = op.swapsRC ? n.rows : n.cols;
      const inner = op.forBox(n.cell, n.cell);
      const mapCell = (c: GridCell): GridCell => {
        const [r2, c2] = op.cell(n.rows, n.cols, c.r, c.c);
        const out: GridCell = { ...c, r: r2, c: c2 };
        if (c.node) out.node = xformNode(c.node, inner);
        return out;
      };
      const out: GridNode = { ...n, x, y, rows, cols };
      if (n.cells) out.cells = n.cells.map(mapCell);
      if (n.unknown)
        out.unknown = n.unknown.map((u) => {
          const [r, c] = op.cell(n.rows, n.cols, u.r, u.c);
          return { r, c };
        });
      return out;
    }
  }
};

const setOrient = (
  out: { rotate?: number; flipX?: boolean; flipY?: boolean },
  o: { rotate: number; flipX: boolean; flipY: boolean },
) => {
  if (o.rotate) out.rotate = o.rotate;
  else delete out.rotate;
  if (o.flipX) out.flipX = true;
  else delete out.flipX;
  if (o.flipY) out.flipY = true;
  else delete out.flipY;
};

/** The mirror image of the whole picture (see the axis conventions at the top of the file). */
export const mirrorSpec = (s: VisualSpec, axis: MirrorAxis): VisualSpec => {
  const op = mirrorOp(axis, s.w, s.h);
  const swap = axis === 'diag' || axis === 'anti';
  return { ...s, w: swap ? s.h : s.w, h: swap ? s.w : s.h, nodes: s.nodes.map((n) => xformNode(n, op)) };
};

/** The whole picture turned clockwise by `deg` about its centre. */
export const rotateSpec = (s: VisualSpec, deg: 90 | 180 | 270): VisualSpec => {
  const op = rotateOp(deg, s.w, s.h);
  const swap = deg !== 180;
  return { ...s, w: swap ? s.h : s.w, h: swap ? s.w : s.h, nodes: s.nodes.map((n) => xformNode(n, op)) };
};

/** Mirror/rotate a single node inside a w×h box (for building figures part by part). */
export const mirrorNode = (n: VisualNode, axis: MirrorAxis, w: number, h: number): VisualNode =>
  xformNode(n, mirrorOp(axis, w, h));
export const rotateNode = (n: VisualNode, deg: 90 | 180 | 270, w: number, h: number): VisualNode =>
  xformNode(n, rotateOp(deg, w, h));

// ---------------------------------------------------------------------------------------------
// Canonical equality
// ---------------------------------------------------------------------------------------------

/**
 * Each kind's symmetry group, assuming the polygon table in docs/GEO-LOGIC.md §E.4 (unit size,
 * centred, upright): `rot` = smallest rotation (deg) that maps the shape onto itself (360 = none,
 * 0 = every angle); `mirror` = angle φ such that rotate(φ)·flipX maps it onto itself (null = no
 * mirror axis). E.g. an arrow pointing right is symmetric top↔bottom, i.e. flipY = rotate(180)·flipX.
 */
export const SYMMETRY: Record<ShapeKind, { rot: number; mirror: number | null }> = {
  circle: { rot: 0, mirror: 0 },
  dot: { rot: 0, mirror: 0 },
  square: { rot: 90, mirror: 0 },
  rect: { rot: 180, mirror: 0 },
  triangle: { rot: 120, mirror: 0 },
  'right-triangle': { rot: 360, mirror: 90 },
  diamond: { rot: 180, mirror: 0 },
  pentagon: { rot: 72, mirror: 0 },
  hexagon: { rot: 60, mirror: 0 },
  star: { rot: 72, mirror: 0 },
  heart: { rot: 360, mirror: 0 },
  cross: { rot: 90, mirror: 0 },
  arrow: { rot: 360, mirror: 180 },
  moon: { rot: 360, mirror: 180 },
  semicircle: { rot: 360, mirror: 0 },
  trapezoid: { rot: 360, mirror: 0 },
  parallelogram: { rot: 180, mirror: null },
  L: { rot: 360, mirror: null },
};

type Orient = [number, 0 | 1]; // R(angle) · F^m

const groupElements = (kind: ShapeKind, pattern: string | undefined): Orient[] => {
  const sym = SYMMETRY[kind];
  if (sym.rot === 0 && pattern === 'half') return [[0, 0], [180, 1]];
  const els: Orient[] = [];
  const step = sym.rot === 0 ? 360 : sym.rot;
  for (let a = 0; a < 360; a += step) {
    els.push([norm360(a), 0]);
    if (sym.mirror !== null) els.push([norm360(sym.mirror + a), 1]);
  }
  // A half-filled shape (left half) keeps only the symmetries that fix the left half.
  if (pattern === 'half') return els.filter(([a, m]) => (a === 0 && m === 0) || (a === 180 && m === 1));
  return els;
};

const canonOrient = (kind: ShapeKind, pattern: string | undefined, theta: number, m: 0 | 1): string => {
  if (SYMMETRY[kind].rot === 0 && pattern !== 'half') return 'any';
  let best = '';
  for (const [ga, gm] of groupElements(kind, pattern)) {
    // R(θ)F^m · R(ga)F^gm
    const a = m === 0 ? theta + ga : theta - ga;
    const mm = (m + gm) % 2;
    const key = `${String(norm360(a)).padStart(3, '0')}${mm}`;
    if (!best || key < best) best = key;
  }
  return best;
};

const r5 = (v: number) => {
  const q = Math.round(v * 2) / 2;
  return Object.is(q, -0) ? '0' : String(q);
};

const decompose = (m: M): { theta: number; mir: 0 | 1; s: number } => {
  const det = m[0] * m[3] - m[1] * m[2];
  const mir: 0 | 1 = det < 0 ? 1 : 0;
  // L·F has positive determinant (F = flipX = diag(-1, 1)).
  const a = mir ? -m[0] : m[0];
  const b = mir ? -m[1] : m[1];
  return { theta: (Math.atan2(b, a) * 180) / Math.PI, mir, s: Math.sqrt(Math.abs(det)) };
};

const canonPts = (pts: string[], closed: boolean): string => {
  const n = pts.length;
  const cands: string[] = [];
  const rev = pts.slice().reverse();
  if (!closed) return [pts.join(';'), rev.join(';')].sort()[0];
  // Drop a duplicated closing point.
  const ring = n > 1 && pts[0] === pts[n - 1] ? pts.slice(0, -1) : pts;
  const rring = ring.slice().reverse();
  for (let i = 0; i < ring.length; i++) {
    cands.push(ring.slice(i).concat(ring.slice(0, i)).join(';'));
    cands.push(rring.slice(i).concat(rring.slice(0, i)).join(';'));
  }
  return cands.sort()[0];
};

const leaves = (n: VisualNode, m: M, out: string[], opacity: number) => {
  const op = (n.opacity ?? 1) * opacity;
  const opk = op === 1 ? '' : `|o${r5(op * 10)}`;
  switch (n.t) {
    case 'g': {
      const mm = mul(m, nodeM(n));
      for (const c of n.children) leaves(c, mm, out, op);
      return;
    }
    case 'shape': {
      const mm = mul(m, nodeM(n));
      const { theta, mir, s } = decompose(mm);
      const [x, y] = apply(mm, 0, 0);
      const pat = n.pattern && n.pattern !== 'solid' ? n.pattern : '';
      const extra = n.kind === 'rect' || n.kind === 'parallelogram' ? `|a${r5((n.aspect ?? 0.6) * 10)}` : '';
      out.push(
        `S|${n.kind}|${r5(x)}|${r5(y)}|${r5(n.size * s)}|${n.fill ?? ''}|${n.stroke ?? 'ink'}|${n.strokeWidth ?? 2.5}|${pat}|${canonOrient(n.kind, pat, theta, mir)}${extra}${opk}`,
      );
      return;
    }
    case 'text': {
      const [x, y] = apply(m, n.x, n.y);
      out.push(`T|${n.text}|${r5(x)}|${r5(y)}|${n.size ?? 18}|${n.fill ?? ''}${opk}`);
      return;
    }
    case 'emoji': {
      const [x, y] = apply(m, n.x, n.y);
      out.push(`E|${n.char}|${r5(x)}|${r5(y)}|${n.size}${opk}`);
      return;
    }
    case 'line': {
      const a = apply(m, n.x1, n.y1);
      const b = apply(m, n.x2, n.y2);
      const pa = `${r5(a[0])},${r5(a[1])}`;
      const pb = `${r5(b[0])},${r5(b[1])}`;
      const ends = n.arrow === 'end' ? `${pa}>${pb}` : [pa, pb].sort().join('-');
      out.push(`L|${ends}|${n.stroke ?? ''}|${n.strokeWidth ?? ''}|${n.dash ? 1 : 0}|${n.arrow ?? ''}${opk}`);
      return;
    }
    case 'path': {
      const { subs, closed } = parsePath(n.d);
      const parts = subs
        .map((s, k) =>
          canonPts(
            s.map(([x, y]) => {
              const p = apply(m, x, y);
              return `${r5(p[0])},${r5(p[1])}`;
            }),
            closed[k],
          ),
        )
        .sort();
      const pat = n.pattern && n.pattern !== 'solid' ? n.pattern : '';
      out.push(`P|${parts.join('/')}|${n.fill ?? ''}|${n.stroke ?? ''}|${n.strokeWidth ?? ''}|${n.dash ? 1 : 0}|${pat}${opk}`);
      return;
    }
    case 'grid': {
      const byKey = new Map<string, GridCell>();
      for (const c of n.cells ?? []) byKey.set(`${c.r},${c.c}`, c);
      const unknown = new Set((n.unknown ?? []).map((u) => `${u.r},${u.c}`));
      const lines = n.lines !== false;
      for (let r = 0; r < n.rows; r++)
        for (let c = 0; c < n.cols; c++) {
          const cell = byKey.get(`${r},${c}`);
          const [cx, cy] = apply(m, n.x + (c + 0.5) * n.cell, n.y + (r + 0.5) * n.cell);
          const has = lines || cell?.fill || unknown.has(`${r},${c}`);
          if (has)
            out.push(
              `C|${r5(cx)}|${r5(cy)}|${r5(n.cell)}|${cell?.fill ?? ''}|${cell?.label ?? ''}|${unknown.has(`${r},${c}`) ? '?' : ''}|${lines ? n.stroke ?? '' : '-'}${opk}`,
            );
          if (cell?.node) leaves(cell.node, mul(m, translateM(n.x + c * n.cell, n.y + r * n.cell)), out, op);
        }
      return;
    }
    case 'clock': {
      const [x, y] = apply(m, n.x, n.y);
      out.push(`K|${r5(x)}|${r5(y)}|${n.r}|${n.hour}|${n.minute ?? ''}${opk}`);
      return;
    }
    case 'scale': {
      const [x, y] = apply(m, n.x, n.y);
      const sub = (ns: VisualNode[]) => {
        const o: string[] = [];
        ns.forEach((c) => leaves(c, I, o, 1));
        return o.sort().join('&');
      };
      out.push(`B|${r5(x)}|${r5(y)}|${n.width}|${n.tilt}|${sub(n.left)}|${sub(n.right)}${opk}`);
      return;
    }
  }
};

/** Sorted canonical leaf keys of a picture (exported for debugging and tests). */
const keyCache = new WeakMap<VisualSpec, string>();
/** Specs are treated as immutable values, so keys are memoised per object. */
export const visualKey = (s: VisualSpec): string => {
  const hit = keyCache.get(s);
  if (hit !== undefined) return hit;
  const out: string[] = [];
  for (const n of s.nodes) leaves(n, I, out, 1);
  const k = out.sort().join('\n');
  keyCache.set(s, k);
  return k;
};

/** Canonical equality for "is this the same picture" (sorts nodes, rounds to 0.5 units, ignores ids). */
export const sameVisual = (a: VisualSpec, b: VisualSpec): boolean => visualKey(a) === visualKey(b);

/** All distinct pictures? (pairwise `sameVisual`) */
export const allDistinct = (xs: VisualSpec[]): boolean => new Set(xs.map(visualKey)).size === xs.length;

/** Every rotation of a picture (0, 90, 180, 270). */
export const allRotations = (s: VisualSpec): VisualSpec[] => [s, rotateSpec(s, 90), rotateSpec(s, 180), rotateSpec(s, 270)];
