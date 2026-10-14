/**
 * pattern-block — a tiled floor with a missing tile (easy/medium) or a missing piece (hard):
 * "Which tile completes the pattern?" / "Which piece fills the hole?". The floor repeats with a
 * period (checkerboard, stripes, pinwheels, diagonals); the validator re-infers every periodic
 * model that fits the visible tiles and demands they all agree on the missing ones.
 */
import type { Color, Difficulty, ExplainStep, GridCell, GridNode, Puzzle, PuzzleFamily, Rng, VisualNode, VisualSpec } from '../../engine/types';
import { OPTION_COUNT } from '../../engine/types';
import { grid, group, mirrorSpec, pick, polygon, randInt, rotateSpec, sample, shape, shuffle, spec, visualKey } from '../../engine/shapes';
import { byId, checkVisualChoice, choice, finish, generateValid, pickWrongFair, type Wrong } from './common';
import { polyomino } from './figure';

const ID = 'pattern-block' as const;

type Motif = 'tri' | 'dot' | 'diamond' | 'half' | 'star' | 'plain';
interface Tile {
  bg: Color;
  motif: Motif;
  fg: Color;
  rot: 0 | 90 | 180 | 270;
}

const rotPt = (x: number, y: number, s: number, rot: number): [number, number] => {
  // Rotate (x, y) in a cell of side s about its centre.
  const cx = x - s / 2;
  const cy = y - s / 2;
  const [rx, ry] = rot === 90 ? [-cy, cx] : rot === 180 ? [-cx, -cy] : rot === 270 ? [cy, -cx] : [cx, cy];
  return [rx + s / 2, ry + s / 2];
};

const tileNode = (t: Tile, s: number): VisualNode => {
  const kids: VisualNode[] = [];
  const poly = (pts: Array<[number, number]>) => polygon(pts.map(([x, y]) => rotPt(x, y, s, t.rot)), { fill: t.fg, strokeWidth: 1.5 });
  if (t.motif === 'tri')
    kids.push(
      poly([
        [0, 0],
        [s, 0],
        [0, s],
      ]),
    );
  if (t.motif === 'half')
    kids.push(
      poly([
        [0, 0],
        [s / 2, 0],
        [s / 2, s],
        [0, s],
      ]),
    );
  if (t.motif === 'dot') kids.push(shape('circle', s / 2, s / 2, s * 0.5, { fill: t.fg, strokeWidth: 2 }));
  if (t.motif === 'diamond') kids.push(shape('diamond', s / 2, s / 2, s * 0.72, { fill: t.fg, strokeWidth: 2 }));
  if (t.motif === 'star') kids.push(shape('star', s / 2, s / 2, s * 0.7, { fill: t.fg, strokeWidth: 2 }));
  return group(kids);
};

const sameTile = (a: Tile, b: Tile) => a.bg === b.bg && a.motif === b.motif && a.fg === b.fg && (a.rot === b.rot || a.motif === 'dot' || a.motif === 'diamond' || a.motif === 'star' || a.motif === 'plain');

// ------------------------------------------------------------------------------------------------
// Pattern models: the tile at (r, c) is motifs[classOf(r, c)].

type Model = { name: string; cls: (r: number, c: number) => string };
const MODELS: Model[] = [];
for (const pr of [1, 2, 3]) for (const pc of [1, 2, 3]) MODELS.push({ name: `p${pr}x${pc}`, cls: (r, c) => `${r % pr},${c % pc}` });
for (const k of [2, 3, 4]) {
  MODELS.push({ name: `d+${k}`, cls: (r, c) => `${(r + c) % k}` });
  MODELS.push({ name: `d-${k}`, cls: (r, c) => `${(((r - c) % k) + k) % k}` });
}

const BGS: Color[] = ['white', 'yellow', 'grey'];
const FGS: Color[] = ['blue', 'red', 'purple', 'teal', 'orange'];

interface Plan {
  variant: string;
  rows: number;
  cols: number;
  tileAt: (r: number, c: number) => Tile;
  rule: string;
  explain: string;
}

const plan = (d: Difficulty, rng: Rng): Plan => {
  const variants: Record<Difficulty, string[]> = {
    1: ['checker', 'stripes'],
    2: ['pinwheel', 'diagonal', 'block'],
    3: ['pinwheel', 'diagonal', 'block', 'checker'],
  };
  const variant = pick(variants[d], rng);
  const rows = d === 1 ? 3 : d === 2 ? 4 : 5;
  const cols = d === 1 ? pick([3, 4], rng) : d === 2 ? 4 : 5;
  // Blue and purple are too close to be the only difference on a small tile; orange on yellow is
  // too faint.
  let fgs = sample(FGS, 3, rng);
  while (fgs.includes('blue') && fgs.includes('purple')) fgs = sample(FGS, 3, rng);
  const [fa, fb, fc] = fgs;
  const bg = pick(fgs.includes('orange') ? BGS.filter((b) => b !== 'yellow') : BGS, rng);
  const motifs: Motif[] = ['tri', 'dot', 'diamond', 'half', 'star'];
  const mk = (motif: Motif, fg: Color, rot: Tile['rot'] = 0, b: Color = bg): Tile => ({ bg: b, motif, fg, rot });
  switch (variant) {
    case 'checker': {
      const [m1, m2] = sample(motifs, 2, rng);
      const a = mk(m1, fa, pick([0, 90, 180, 270] as const, rng));
      const b = mk(m2, fb, pick([0, 90, 180, 270] as const, rng));
      return { variant, rows, cols, tileAt: (r, c) => ((r + c) % 2 ? b : a), rule: 'checkerboard: two tiles take turns', explain: 'The tiles take turns like a checkerboard, across and down.' };
    }
    case 'stripes': {
      const byRow = rng() < 0.5;
      const n = pick([2, 3], rng);
      const ts = sample(motifs, n, rng).map((m, i) => mk(m, [fa, fb, fc][i]));
      return {
        variant,
        rows,
        cols,
        tileAt: (r, c) => ts[(byRow ? r : c) % n],
        rule: `stripes ${byRow ? 'across' : 'down'}, ${n} tiles`,
        explain: byRow ? 'Each row is all the same tile; the rows repeat.' : 'Each column is all the same tile; the columns repeat.',
      };
    }
    case 'pinwheel': {
      const m = pick(['tri', 'half'] as Motif[], rng);
      const turns = pick(
        [
          [0, 90, 270, 180],
          [0, 270, 90, 180],
          [90, 0, 180, 270],
        ] as Array<Array<Tile['rot']>>,
        rng,
      );
      return {
        variant,
        rows,
        cols,
        tileAt: (r, c) => mk(m, fa, turns[(r % 2) * 2 + (c % 2)]),
        rule: 'a 2×2 pinwheel block repeats',
        explain: 'A block of 2×2 tiles, each turned a different way, repeats over and over.',
      };
    }
    case 'diagonal': {
      const ts = [mk('tri', fa, 0), mk(pick(['dot', 'star', 'diamond'] as Motif[], rng), fb), mk('plain', fa, 0, pick(BGS.filter((x) => x !== bg), rng))];
      const dir = rng() < 0.5 ? 1 : -1;
      return {
        variant,
        rows,
        cols,
        tileAt: (r, c) => ts[(((r + dir * c) % 3) + 3) % 3],
        rule: 'three tiles repeat along slanted lines',
        explain: 'The same tiles run in slanted lines, in an order of three.',
      };
    }
    default: {
      const block = [mk(pick(motifs, rng), fa, pick([0, 90, 180, 270] as const, rng)), mk(pick(motifs, rng), fb, pick([0, 90, 180, 270] as const, rng)), mk(pick(motifs, rng), fc, pick([0, 90, 180, 270] as const, rng)), mk('plain', fa)];
      const order = shuffle([0, 1, 2, 3], rng);
      return {
        variant: 'block',
        rows,
        cols,
        tileAt: (r, c) => block[order[(r % 2) * 2 + (c % 2)]],
        rule: 'a 2×2 block of four tiles repeats',
        explain: 'Find the 2×2 block of four tiles: it repeats across and down.',
      };
    }
  }
};

const CELL: Record<Difficulty, number> = { 1: 56, 2: 52, 3: 48 };

const cellOf = (t: Tile, s: number, r: number, c: number): GridCell => ({ r, c, fill: t.bg === 'white' ? undefined : t.bg, node: tileNode(t, s) });

/** A piece = the given cells, drawn on its own (no grid lines outside the piece), scaled. */
const pieceSpec = (cells: GridCell[], s: number, scale: number): VisualSpec => {
  const r0 = Math.min(...cells.map((c) => c.r));
  const c0 = Math.min(...cells.map((c) => c.c));
  const h = Math.max(...cells.map((c) => c.r)) - r0 + 1;
  const w = Math.max(...cells.map((c) => c.c)) - c0 + 1;
  const kids: VisualNode[] = [];
  for (const cell of cells) {
    const x = (cell.c - c0) * s;
    const y = (cell.r - r0) * s;
    kids.push(
      polygon(
        [
          [x, y],
          [x + s, y],
          [x + s, y + s],
          [x, y + s],
        ],
        { fill: cell.fill ?? 'white', stroke: 'ink', strokeWidth: 2 },
      ),
    );
    if (cell.node) kids.push(group([cell.node], { x, y }));
  }
  return spec(100, 100, [group(kids, { x: 50 - (w * s * scale) / 2, y: 50 - (h * s * scale) / 2, scale })], 'A piece of the pattern');
};

const attempt = (d: Difficulty, rng: Rng): Puzzle | null => {
  const pl = plan(d, rng);
  const s = CELL[d];
  // Easy/medium: one missing tile. Hard: a 3–4 tile hole, placed anywhere on the board.
  const shapeCells: Array<[number, number]> = d === 3 ? polyomino(randInt(3, 4, rng), rng).map(([c, r]) => [r, c]) : [[0, 0]];
  const r0 = Math.min(...shapeCells.map((h) => h[0]));
  const c0 = Math.min(...shapeCells.map((h) => h[1]));
  const norm = shapeCells.map(([r, c]) => [r - r0, c - c0] as [number, number]);
  const hr = Math.max(...norm.map((h) => h[0]));
  const hc = Math.max(...norm.map((h) => h[1]));
  if (hr >= pl.rows || hc >= pl.cols) return null;
  const dr = randInt(0, pl.rows - 1 - hr, rng);
  const dc = randInt(0, pl.cols - 1 - hc, rng);
  const hole = norm.map(([r, c]) => [r + dr, c + dc] as [number, number]);
  const isHole = (r: number, c: number) => hole.some(([a, b]) => a === r && b === c);
  const cells: GridCell[] = [];
  for (let r = 0; r < pl.rows; r++) for (let c = 0; c < pl.cols; c++) if (!isHole(r, c)) cells.push(cellOf(pl.tileAt(r, c), s, r, c));
  const g = grid(6, 6, pl.rows, pl.cols, s, { id: 'board', cells, unknown: hole.map(([r, c]) => ({ r, c })) });
  const visual = spec(pl.cols * s + 12, pl.rows * s + 12, [g], 'A tiled floor with a missing part');

  const holeCellsAns = hole.map(([r, c]) => cellOf(pl.tileAt(r, c), s, r, c));
  const scale = d === 3 ? Math.min(1, 84 / (s * Math.max(...[0, 1].map((k) => Math.max(...hole.map((h) => h[k])) - Math.min(...hole.map((h) => h[k])) + 1)))) : 80 / s;
  const ans = pieceSpec(holeCellsAns, s, scale);

  const pool: Wrong[] = [];
  const allTiles: Tile[] = [];
  for (let r = 0; r < pl.rows; r++) for (let c = 0; c < pl.cols; c++) if (!allTiles.some((t) => sameTile(t, pl.tileAt(r, c)))) allTiles.push(pl.tileAt(r, c));
  if (d < 3) {
    const [r, c] = hole[0];
    const right = pl.tileAt(r, c);
    for (const t of shuffle(allTiles, rng)) if (!sameTile(t, right)) pool.push({ visual: pieceSpec([cellOf(t, s, r, c)], s, scale), why: 'that tile belongs somewhere else in the pattern' });
    if (right.motif === 'tri' || right.motif === 'half')
      for (const rot of shuffle([0, 90, 180, 270] as const, rng))
        if (rot !== right.rot) pool.push({ visual: pieceSpec([cellOf({ ...right, rot }, s, r, c)], s, scale), why: 'right tile, but turned the wrong way' });
    const near: Partial<Record<Color, Color>> = { blue: 'purple', purple: 'blue' };
    const otherFg = pick(FGS.filter((f) => f !== right.fg && f !== near[right.fg] && !(f === 'orange' && right.bg === 'yellow')), rng);
    const otherMotif: Motif = right.motif === 'dot' ? 'star' : 'dot';
    pool.push({ visual: pieceSpec([cellOf({ ...right, fg: otherFg }, s, r, c)], s, scale), why: 'that colour is not in the pattern there' });
    pool.push({ visual: pieceSpec([cellOf({ ...right, motif: otherMotif }, s, r, c)], s, scale), why: 'that shape is not in the pattern there' });
    // Double slips, so the right tile is not simply "the one most like the others".
    pool.push({ visual: pieceSpec([cellOf({ ...right, motif: otherMotif, fg: otherFg }, s, r, c)], s, scale), why: 'that shape and colour are not in the pattern there' });
    for (const t of allTiles)
      if (!sameTile(t, right) && t.motif !== 'plain') pool.push({ visual: pieceSpec([cellOf({ ...t, fg: otherFg }, s, r, c)], s, scale), why: 'that tile is not in the pattern' });
  } else {
    pool.push({ visual: rotateSpec(ans, 90), why: 'that piece is turned around' });
    pool.push({ visual: mirrorSpec(ans, 'x'), why: 'that piece is flipped over' });
    pool.push({ visual: rotateSpec(ans, 180), why: 'that piece is upside down' });
    // Right shape, pattern shifted by one tile.
    for (const [sr, sc] of shuffle(
      [
        [0, 1],
        [1, 0],
        [0, -1],
      ] as Array<[number, number]>,
      rng,
    ))
      pool.push({ visual: pieceSpec(hole.map(([r, c]) => cellOf(pl.tileAt(r + sr + 6, c + sc + 6), s, r, c)), s, scale), why: 'right shape, but the pattern is shifted' });
    // Wrong shape: one cell moved.
    const moved = hole.slice(0, -1);
    const [lr, lc] = hole[hole.length - 1];
    const alt: [number, number] = [lr, lc + (lc + 1 < pl.cols && !isHole(lr, lc + 1) ? 1 : -1)];
    if (alt[1] >= 0 && !isHole(alt[0], alt[1])) moved.push(alt);
    if (moved.length === hole.length) pool.push({ visual: pieceSpec(moved.map(([r, c]) => cellOf(pl.tileAt(r, c), s, r, c)), s, scale), why: 'that piece is the wrong shape' });
  }
  const wrong = pickWrongFair(ans, d === 3 ? [...shuffle(pool.slice(0, 4), rng), ...pool.slice(4)] : shuffle(pool, rng), OPTION_COUNT[d], rng);
  if (!wrong) return null;
  const explanation: ExplainStep[] = [
    { text: pl.explain, visual },
    { text: d === 3 ? 'Look at the tiles next to the hole and keep the pattern going into it.' : 'Find another spot in the same place in the pattern and copy it.', visual },
    { text: d === 3 ? 'This piece fits — shape and pattern!' : 'This tile fits!', visual: ans },
  ];
  return finish(ID, d, {
    prompt: d === 3 ? 'Which piece fills the hole?' : 'Which tile completes the pattern?',
    visual,
    answer: choice(rng, ans, wrong),
    explanation,
    rule: pl.rule,
    variant: d === 3 ? `hole-${pl.variant}` : pl.variant,
  });
};

/** Predict every hole cell from all periodic models that fit the visible tiles. */
export const derivePatternBlock = (p: Puzzle): { cells: GridCell[]; s: number } | string[] => {
  const g = byId(p.visual.nodes, 'board') as GridNode | undefined;
  if (!g || g.t !== 'grid' || !g.unknown?.length) return ['no board'];
  const key = (c: GridCell) => `${c.fill ?? ''}|${c.node ? visualKey(spec(g.cell, g.cell, [c.node])) : ''}`;
  const known = (g.cells ?? []).map((c) => ({ r: c.r, c: c.c, k: key(c), cell: c }));
  const preds = g.unknown.map(() => new Set<string>());
  const pick1 = new Map<string, GridCell>(known.map((x) => [x.k, x.cell]));
  for (const m of MODELS) {
    const cls = new Map<string, Set<string>>();
    for (const x of known) {
      const k = m.cls(x.r, x.c);
      cls.set(k, (cls.get(k) ?? new Set()).add(x.k));
    }
    if ([...cls.values()].some((v) => v.size > 1)) continue;
    // A model only counts when every class it uses is seen at least twice (real evidence).
    const counts = new Map<string, number>();
    for (const x of known) counts.set(m.cls(x.r, x.c), (counts.get(m.cls(x.r, x.c)) ?? 0) + 1);
    const ok = g.unknown.every((u) => (counts.get(m.cls(u.r, u.c)) ?? 0) >= 2);
    if (!ok) continue;
    g.unknown.forEach((u, i) => preds[i].add([...cls.get(m.cls(u.r, u.c))!][0]));
  }
  if (preds.some((s) => s.size !== 1)) return [`hole tiles are ${preds.some((s) => s.size === 0) ? 'not determined' : 'ambiguous'}`];
  const cells = g.unknown.map((u, i) => ({ ...pick1.get([...preds[i]][0])!, r: u.r, c: u.c }));
  return { cells, s: g.cell };
};

export const validatePatternBlock = (p: Puzzle): string[] => {
  const r = derivePatternBlock(p);
  if (Array.isArray(r)) return r;
  const hole = r.cells;
  const span = Math.max(...[0, 1].map((k) => Math.max(...hole.map((h) => (k ? h.c : h.r))) - Math.min(...hole.map((h) => (k ? h.c : h.r))) + 1));
  const scale = p.difficulty === 3 ? Math.min(1, 84 / (r.s * span)) : 80 / r.s;
  return checkVisualChoice(p, pieceSpec(hole, r.s, scale));
};

export const patternBlock: PuzzleFamily = {
  id: ID,
  title: 'Tile patterns',
  emoji: '🧩',
  group: 'shape',
  variants: ['checker', 'stripes', 'pinwheel', 'diagonal', 'block', 'hole-pinwheel', 'hole-diagonal', 'hole-block', 'hole-checker'],
  generate: (d, rng) => generateValid(() => attempt(d, rng), validatePatternBlock),
  validate: validatePatternBlock,
};
