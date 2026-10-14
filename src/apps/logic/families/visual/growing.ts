/**
 * growing-pattern — figures 1, 2, 3 made of blocks grow by a rule; which is figure 4 / how many
 * blocks in figure 4 (or 5)?
 */
import type { Difficulty, ExplainStep, Puzzle, PuzzleFamily, Rng, ShapeKind, VisualNode, VisualSpec } from '../../engine/types';
import { OPTION_COUNT } from '../../engine/types';
import { grid, group, pick, randInt, sameVisual, shape, shuffle, spec, text } from '../../engine/shapes';
import { byId, checkVisualChoice, choice, clip, finish, generateValid, pickWrongFair, type Wrong } from './common';
import { LOOKS, type Look } from './term';

const ID = 'growing-pattern' as const;

type Cell = [number, number]; // [col, row], row 0 = bottom

interface Construction {
  id: string;
  name: string;
  /** Figure n (n ≥ 1). */
  cells: (n: number) => Cell[];
  /** How it grows, in kid words. */
  grows: string;
  count: (n: number) => number;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const C: Record<string, Construction> = {
  row: { id: 'row', name: 'a row', grows: 'one more block each time', cells: (n) => range(n + 1).map((i) => [i, 0]), count: (n) => n + 1 },
  'two-rows': {
    id: 'two-rows',
    name: 'two rows',
    grows: 'two more blocks each time, one on each row',
    cells: (n) => range(n).flatMap((i) => [[i, 0] as Cell, [i, 1] as Cell]),
    count: (n) => 2 * n,
  },
  L: {
    id: 'L',
    name: 'an L shape',
    grows: 'one more block on each arm of the L',
    cells: (n) => [[0, 0] as Cell, ...range(n).map((i) => [i + 1, 0] as Cell), ...range(n).map((i) => [0, i + 1] as Cell)],
    count: (n) => 2 * n + 1,
  },
  V: {
    id: 'V',
    name: 'a V shape',
    grows: 'one more block on each side of the V',
    cells: (n) => [[n, 0] as Cell, ...range(n).flatMap((i) => [[n - 1 - i, i + 1] as Cell, [n + 1 + i, i + 1] as Cell])],
    count: (n) => 2 * n + 1,
  },
  T: {
    id: 'T',
    name: 'a T shape',
    grows: 'one more block on each of the three arms',
    cells: (n) => [
      ...range(2 * n + 1).map((i) => [i, n] as Cell),
      ...range(n).map((i) => [n, i] as Cell),
    ],
    count: (n) => 3 * n + 1,
  },
  U: {
    id: 'U',
    name: 'a U shape',
    grows: 'the bottom and both sides get one longer',
    cells: (n) => [...range(n + 2).map((i) => [i, 0] as Cell), ...range(n).flatMap((i) => [[0, i + 1] as Cell, [n + 1, i + 1] as Cell])],
    count: (n) => 3 * n + 2,
  },
  'three-rows': {
    id: 'three-rows',
    name: 'three rows',
    grows: 'three more blocks each time, one on each row',
    cells: (n) => range(n).flatMap((i) => [[i, 0] as Cell, [i, 1] as Cell, [i, 2] as Cell]),
    count: (n) => 3 * n,
  },
  plus: {
    id: 'plus',
    name: 'a plus sign',
    grows: 'all four arms get one longer',
    cells: (n) => [
      [n, n] as Cell,
      ...range(n).flatMap((i) => [[n, n + 1 + i] as Cell, [n, n - 1 - i] as Cell, [n + 1 + i, n] as Cell, [n - 1 - i, n] as Cell]),
    ],
    count: (n) => 4 * n + 1,
  },
  square: {
    id: 'square',
    name: 'a square',
    grows: 'a square: 1×1, 2×2, 3×3, so figure 4 is 4×4',
    cells: (n) => range(n).flatMap((r) => range(n).map((c) => [c, r] as Cell)),
    count: (n) => n * n,
  },
  stairs: {
    id: 'stairs',
    name: 'a staircase',
    grows: 'a staircase: each new step is one taller',
    cells: (n) => range(n).flatMap((c) => range(c + 1).map((r) => [c, r] as Cell)),
    count: (n) => (n * (n + 1)) / 2,
  },
  rect: {
    id: 'rect',
    name: 'a rectangle',
    grows: 'a rectangle one wider and one taller each time',
    cells: (n) => range(n).flatMap((r) => range(n + 1).map((c) => [c, r] as Cell)),
    count: (n) => n * (n + 1),
  },
  frame: {
    id: 'frame',
    name: 'a hollow square',
    grows: 'a hollow square that gets one bigger',
    cells: (n) =>
      range(n + 1).flatMap((r) => range(n + 1).filter((c) => r === 0 || r === n || c === 0 || c === n).map((c) => [c, r] as Cell)),
    count: (n) => 4 * n,
  },
  towers: {
    id: 'towers',
    name: 'a pair of towers',
    grows: 'both towers get one taller',
    cells: (n) => range(n + 1).flatMap((r) => [[0, r] as Cell, [2, r] as Cell]),
    count: (n) => 2 * n + 2,
  },
  X: {
    id: 'X',
    name: 'an X shape',
    grows: 'all four arms of the X get one longer',
    cells: (n) => [
      [n, n] as Cell,
      ...range(n).flatMap((i) => [[n + 1 + i, n + 1 + i] as Cell, [n - 1 - i, n - 1 - i] as Cell, [n + 1 + i, n - 1 - i] as Cell, [n - 1 - i, n + 1 + i] as Cell]),
    ],
    count: (n) => 4 * n + 1,
  },
  steps2: {
    id: 'steps2',
    name: 'a staircase',
    grows: 'each new step is one block taller',
    cells: (n) => range(n).flatMap((c) => range(c + 2).map((r) => [c, r] as Cell)),
    count: (n) => (n * (n + 3)) / 2,
  },
  pyramid: {
    id: 'pyramid',
    name: 'a pyramid',
    grows: 'a pyramid with a new, wider row underneath',
    cells: (n) => range(n).flatMap((k) => range(2 * k + 1).map((i) => [n - 1 - k + i, n - 1 - k] as Cell)),
    count: (n) => n * n,
  },
};

const BY_D: Record<Difficulty, string[]> = {
  1: ['row', 'two-rows', 'L', 'V', 'towers'],
  2: ['T', 'U', 'three-rows', 'plus', 'X', 'L', 'V', 'steps2'],
  3: ['square', 'stairs', 'rect', 'frame', 'pyramid', 'plus', 'X', 'T'],
};

const ALL = Object.values(C);
const VARIANTS = [...new Set([...BY_D[1], ...BY_D[2], ...BY_D[3]])];

// ------------------------------------------------------------------------------------------------
// Drawing

const extent = (cells: Cell[]) => {
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
};

interface Style {
  kind: ShapeKind;
  look: Look;
}

/** Draw cells with their box's bottom-centre at (cx, by). */
const drawCells = (cells: Cell[], cx: number, by: number, unit: number, st: Style, id?: string): VisualNode => {
  const e = extent(cells);
  const x0 = cx - (e.w * unit) / 2;
  return group(
    cells.map(([c, r]) =>
      shape(st.kind, x0 + (c - e.minX + 0.5) * unit, by - (r - e.minY + 0.5) * unit, unit * (st.kind === 'circle' ? 0.86 : 0.9), {
        fill: st.look.fill,
        ...(st.look.pattern !== 'solid' ? { pattern: st.look.pattern } : {}),
        strokeWidth: 1.5,
      }),
    ),
    id ? { id } : undefined,
  );
};

const figureOption = (cells: Cell[], unit: number, st: Style): VisualSpec => {
  const e = extent(cells);
  return spec(100, 100, [drawCells(cells, 50, 50 + (e.h * unit) / 2, unit, st)], `${cells.length} blocks`);
};

/** Smallest centre-to-centre step between blocks of a figure (= the unit). */
const unitOf = (n: VisualNode | undefined): number => {
  if (!n || n.t !== 'g') return 0;
  let u = Infinity;
  const ss = n.children.filter((c) => c.t === 'shape');
  for (const a of ss)
    for (const b of ss) {
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (dx > 0.5 && dx < u) u = dx;
      if (dy > 0.5 && dy < u) u = dy;
    }
  return Number.isFinite(u) ? u : 0;
};

/** Read cells back from a figure group (needs the unit). */
const readCells = (n: VisualNode | undefined, unit: number): { cells: Cell[]; st: Style } | null => {
  if (!n || n.t !== 'g' || !n.children.length) return null;
  const s0 = n.children[0];
  if (s0.t !== 'shape') return null;
  const cells = n.children.map((s) =>
    s.t === 'shape' ? ([Math.round((s.x - s0.x) / unit), -Math.round((s.y - s0.y) / unit)] as Cell) : ([NaN, NaN] as Cell),
  );
  return { cells, st: { kind: s0.kind, look: { fill: s0.fill ?? 'none', pattern: s0.pattern ?? 'solid' } } };
};

const norm = (cells: Cell[]): string => {
  const e = extent(cells);
  return cells
    .map(([c, r]) => `${c - e.minX},${r - e.minY}`)
    .sort()
    .join(' ');
};

// ------------------------------------------------------------------------------------------------

const layoutFigures = (figs: Cell[][], qW: number) => {
  const widths = [...figs.map((f) => extent(f).w), qW];
  const maxH = Math.max(...figs.map((f) => extent(f).h), 1);
  const gapU = 1.6;
  const totalU = widths.reduce((a, b) => a + b, 0) + gapU * (widths.length + 1);
  const unit = Math.max(9, Math.min(20, Math.floor(392 / totalU), Math.floor(200 / maxH)));
  const w = Math.min(400, Math.ceil(totalU * unit) + 8);
  let x = (w - (totalU - 2 * gapU) * unit) / 2;
  const centers = widths.map((wu) => {
    const c = x + (wu * unit) / 2;
    x += (wu + gapU) * unit;
    return c;
  });
  const h = maxH * unit + 50;
  return { unit, w, h, centers, base: maxH * unit + 14 };
};

/** The 8 ways to turn/flip a construction (o & 3 = quarter turns, o & 4 = mirror). */
const orient = (cells: Cell[], o: number): Cell[] =>
  cells.map(([c, r]) => {
    let x = o & 4 ? -c : c;
    let y = r;
    for (let k = 0; k < (o & 3); k++) [x, y] = [y, -x];
    return [x, y] as Cell;
  });

const figure = (con: Construction, o: number, n: number) => orient(con.cells(n), o);

const attempt = (d: Difficulty, rng: Rng): Puzzle | null => {
  const con = C[pick(BY_D[d], rng)];
  const o = randInt(0, 7, rng);
  const asCount = d === 1 ? false : d === 2 ? rng() < 0.5 : rng() < 0.75;
  const first = d === 1 ? 1 : pick([1, 1, 2], rng);
  const nums = [first, first + 1, first + 2];
  const linear = con.count(3) - con.count(2) === con.count(2) - con.count(1);
  const target = first + 3 + (asCount && d === 3 && linear && rng() < 0.4 ? 1 : 0);
  const st: Style = { kind: pick(['square', 'square', 'circle', 'star'] as ShapeKind[], rng), look: pick(LOOKS.filter((l) => l.fill !== 'white' && l.pattern !== 'half'), rng) };
  const figs = nums.map((n) => figure(con, o, n));
  const ans = figure(con, o, target);
  if (Math.max(extent(ans).w, extent(ans).h) > 10) return null;
  const qW = Math.min(extent(ans).w, 4);
  const L = layoutFigures(figs, qW);
  const nodes: VisualNode[] = [];
  figs.forEach((f, i) => {
    nodes.push(drawCells(f, L.centers[i], L.base, L.unit, st, `f${i + 1}`));
    nodes.push(text(L.centers[i], L.base + 22, String(nums[i]), { size: 16, fill: 'ink', id: `lab${i + 1}` }));
  });
  const qs = Math.min(qW * L.unit, 60);
  nodes.push(grid(L.centers[3] - qs / 2, L.base - qs, 1, 1, qs, { id: 'q', unknown: [{ r: 0, c: 0 }] }));
  nodes.push(text(L.centers[3], L.base + 22, String(target), { size: 16, fill: 'ink', id: 'qlab' }));
  const visual = spec(L.w, L.h, nodes, `Figures ${nums.join(', ')} made of ${figs.map((f) => f.length).join(', ')} blocks. Figure ${target}?`);
  const counts = nums.map((n) => con.count(n));

  const explanation: ExplainStep[] = [
    { text: clip(`Count the blocks: ${counts.join(', ')}.`), visual, highlight: ['f1', 'f2', 'f3'] },
    { text: clip(`It's ${con.name}: ${con.grows}.`), visual },
  ];

  if (asCount) {
    const n = con.count(target);
    if (target === nums[2] + 2) explanation.push({ text: clip(`Figure ${target - 1} has ${con.count(target - 1)}, so figure ${target} has ${n}.`) });
    else explanation.push({ text: clip(`So figure ${target} has ${n} blocks.`), visual: figureOption(ans, Math.min(16, Math.floor(88 / Math.max(extent(ans).w, extent(ans).h))), st) });
    return finish(ID, d, {
      prompt: `How many blocks in figure ${target}?`,
      visual,
      answer: { kind: 'number', answer: n },
      explanation,
      rule: `${con.name}: ${counts.join(', ')} → ${n}`,
      variant: con.id,
    });
  }

  // Picture options at one shared unit.
  const after = figure(con, o, target + 1);
  const f3 = figs[2];
  const minus = ans.slice(0, -1);
  const e4 = extent(ans);
  const plusOne: Cell[] = [...ans, [e4.maxX + 1, e4.minY]];
  // Wrong growth: the last figure with the right number of new blocks all stuck on one end.
  const grow = ans.length - f3.length;
  const e3 = extent(f3);
  const lopsided: Cell[] = [...f3, ...Array.from({ length: grow }, (_, i) => [e3.maxX + 1 + i, e3.minY] as Cell)];
  const cands: Array<{ cells: Cell[]; why: string }> = [
    { cells: f3, why: `that is figure ${nums[2]} again` },
    { cells: lopsided, why: 'right number of blocks, but it grew the wrong way' },
    { cells: minus, why: 'one block is missing' },
    { cells: after, why: `that is figure ${target + 1} — one step too far` },
    { cells: plusOne, why: 'one block too many' },
    { cells: orient(ans, 4), why: 'that one is flipped the wrong way' },
  ];
  // A different construction with the same count (wrong shape).
  for (const other of shuffle(ALL, rng))
    if (other.id !== con.id) {
      for (const k of [3, 4, 5]) {
        const oc = figure(other, o, k);
        if (oc.length === ans.length && norm(oc) !== norm(ans)) {
          cands.push({ cells: oc, why: 'right number of blocks but the wrong shape' });
          break;
        }
      }
    }
  const ext = (c: Cell[]) => Math.max(extent(c).w, extent(c).h);
  const ansExt = ext(ans);
  const ordered = [...shuffle(cands.slice(0, 3), rng), ...shuffle(cands.slice(3), rng)].filter((c) => ext(c.cells) <= ansExt + 1);
  // Choose with a provisional unit, then redraw the chosen ones at the unit that fits them all.
  const prov = pickWrongFair(
    figureOption(ans, 10, st),
    ordered.map((c) => ({ visual: figureOption(c.cells, 10, st), why: c.why })),
    OPTION_COUNT[d],
    rng,
  );
  if (!prov) return null;
  const chosen = prov.map((w) => ordered.find((c) => c.why === w.why && sameVisual(figureOption(c.cells, 10, st), w.visual))!);
  const unit = Math.min(18, Math.floor(88 / Math.max(ansExt, ...chosen.map((c) => ext(c.cells)))));
  const wrong: Wrong[] = chosen.map((c) => ({ visual: figureOption(c.cells, unit, st), why: c.why }));
  if (!wrong) return null;
  if (chosen.some((c) => c.why.startsWith('right number of blocks')))
    explanation.push({ text: clip(`The right count is not enough: it must keep the same shape (${con.name}).`) });
  explanation.push({ text: clip(`So figure ${target} is ${con.name} with ${ans.length} blocks.`), visual: figureOption(ans, unit, st) });
  return finish(ID, d, {
    prompt: `Which one is figure ${target}?`,
    visual,
    answer: choice(rng, figureOption(ans, unit, st), wrong),
    explanation,
    rule: `${con.name}: ${counts.join(', ')} → ${ans.length}`,
    variant: con.id,
  });
};

/** Identify the construction from the three figures (exactly one prediction) and rebuild the target. */
export const deriveGrowing = (p: Puzzle): { target: number; cells: Cell[]; st: Style } | { errs: string[] } => {
  const unit = unitOf(byId(p.visual.nodes, 'f3'));
  if (!unit) return { errs: ['no figure 3'] };
  const figs = ['f1', 'f2', 'f3'].map((id) => readCells(byId(p.visual.nodes, id), unit));
  if (figs.some((f) => !f)) return { errs: ['could not read figures'] };
  const numOf = (id: string) => {
    const n = byId(p.visual.nodes, id);
    return n && n.t === 'text' ? Number(n.text) : NaN;
  };
  const nums = ['lab1', 'lab2', 'lab3'].map(numOf);
  const target = numOf('qlab');
  if (!(nums[1] === nums[0] + 1 && nums[2] === nums[1] + 1 && target > nums[2] && target <= nums[2] + 2)) return { errs: ['bad figure numbers'] };
  const shown = figs.map((f) => norm(f!.cells));
  const counts = figs.map((f) => f!.cells.length);
  if (!(counts[0] < counts[1] && counts[1] < counts[2])) return { errs: ['figures do not grow'] };
  const preds = new Map<string, Cell[]>();
  for (const c of ALL)
    for (let o = 0; o < 8; o++)
      if (nums.every((n, i) => norm(figure(c, o, n)) === shown[i])) {
        const t = figure(c, o, target);
        preds.set(norm(t), t);
      }
  if (preds.size === 0) return { errs: ['no construction matches the figures'] };
  if (preds.size !== 1) return { errs: ['figures are ambiguous'] };
  const cells = [...preds.values()][0];
  // A steady step in the counts must agree with the picture rule.
  const d1 = counts[1] - counts[0];
  const d2 = counts[2] - counts[1];
  if (d1 === d2 && counts[2] + d1 * (target - nums[2]) !== cells.length) return { errs: ['count rule and shape rule disagree'] };
  return { target, cells, st: figs[0]!.st };
};

export const validateGrowing = (p: Puzzle): string[] => {
  const r = deriveGrowing(p);
  if ('errs' in r) return r.errs;
  // Block counts in the drawing really are what the rule says.
  if (p.answer.kind === 'number') return p.answer.answer === r.cells.length ? [] : [`answer ${p.answer.answer} ≠ ${r.cells.length}`];
  if (p.answer.kind !== 'choice') return ['bad answer kind'];
  // All options share one unit: recover it from the block spacing of any option.
  const unit = Math.max(...p.answer.options.map((o) => unitOf(o.visual?.nodes[0])));
  return checkVisualChoice(p, figureOption(r.cells, unit, r.st));
};

export const growingPattern: PuzzleFamily = {
  id: ID,
  title: 'Growing patterns',
  emoji: '🌱',
  group: 'shape',
  variants: VARIANTS,
  generate: (d, rng) => generateValid(() => attempt(d, rng), validateGrowing),
  validate: validateGrowing,
};
