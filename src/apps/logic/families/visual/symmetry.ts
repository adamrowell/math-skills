/**
 * symmetry-fill — "Make it symmetrical": half a picture is coloured on a grid with a dashed mirror
 * line; the child taps the squares on the other side to complete it (a `cells` answer).
 */
import type { Color, Difficulty, GridCell, Puzzle, PuzzleFamily, Rng, VisualNode } from '../../engine/types';
import { grid, line, pick, randInt, spec } from '../../engine/shapes';
import { byId, finish, generateValid } from './common';

const ID = 'symmetry-fill' as const;

type Axis = 'v' | 'h' | 'd' | 'vh';
const VARIANTS: Record<Difficulty, Axis[]> = { 1: ['v'], 2: ['v', 'h'], 3: ['d', 'vh'] };
const VARIANT_NAME: Record<Axis, string> = { v: 'vertical', h: 'horizontal', d: 'diagonal', vh: 'four-way' };

const key = (r: number, c: number) => `${r},${c}`;

/** Every image of (r, c) under the axis set (excluding itself). */
export const images = (axis: Axis, n: number, r: number, c: number): Array<[number, number]> => {
  switch (axis) {
    case 'v':
      return [[r, n - 1 - c]];
    case 'h':
      return [[n - 1 - r, c]];
    case 'd':
      return [[c, r]];
    case 'vh':
      return [
        [r, n - 1 - c],
        [n - 1 - r, c],
        [n - 1 - r, n - 1 - c],
      ];
  }
};

/** Is (r, c) in the region where the givens live? */
const inGivenSide = (axis: Axis, n: number, r: number, c: number): boolean => {
  const h = n / 2;
  switch (axis) {
    case 'v':
      return c < h;
    case 'h':
      return r < h;
    case 'd':
      return r > c; // below the diagonal
    case 'vh':
      return r < h && c < h;
  }
};

const attempt = (d: Difficulty, rng: Rng): Puzzle | null => {
  const axis = pick(VARIANTS[d], rng);
  const n = d === 2 ? 8 : 6;
  const cell = d === 2 ? 34 : 44;
  const colours: Color[] = d === 2 ? ['blue', 'yellow'] : [pick(['blue', 'red', 'purple', 'teal'] as Color[], rng)];
  const want = axis === 'vh' ? randInt(3, 5, rng) : d === 1 ? randInt(4, 6, rng) : randInt(6, 8, rng);
  // Random connected blob on the given side.
  const side: Array<[number, number]> = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (inGivenSide(axis, n, r, c)) side.push([r, c]);
  const start = pick(side, rng);
  const blob = new Map<string, [number, number]>([[key(...start), start]]);
  for (let g = 0; blob.size < want && g < 300; g++) {
    const [r, c] = pick([...blob.values()], rng);
    const [dr, dc] = pick(
      [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as Array<[number, number]>,
      rng,
    );
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= n || nc >= n || !inGivenSide(axis, n, nr, nc)) continue;
    blob.set(key(nr, nc), [nr, nc]);
  }
  if (blob.size < want) return null;
  const givens = [...blob.values()].map(([r, c]) => ({ r, c, fill: pick(colours, rng) }));
  // With two colours, make sure both are used.
  if (colours.length === 2 && new Set(givens.map((g) => g.fill)).size < 2) givens[0].fill = givens[0].fill === colours[0] ? colours[1] : colours[0];
  const target: Record<string, Color> = {};
  for (const g of givens) {
    target[key(g.r, g.c)] = g.fill;
    for (const [r, c] of images(axis, n, g.r, g.c)) target[key(r, c)] = g.fill;
  }
  const P = 6;
  const W = n * cell;
  const cells: GridCell[] = givens.map((g) => ({ r: g.r, c: g.c, fill: g.fill }));
  const lines: VisualNode[] = [];
  const dash = { dash: true, stroke: 'ink' as Color, strokeWidth: 4 };
  if (axis === 'v' || axis === 'vh') lines.push(line(P + W / 2, P - 4, P + W / 2, P + W + 4, { id: 'axis', ...dash }));
  if (axis === 'h' || axis === 'vh') lines.push(line(P - 4, P + W / 2, P + W + 4, P + W / 2, { id: axis === 'vh' ? 'axis2' : 'axis', ...dash }));
  if (axis === 'd') lines.push(line(P - 4, P - 4, P + W + 4, P + W + 4, { id: 'axis', ...dash }));
  const g = grid(P, P, n, n, cell, { id: 'sym', cells });
  const visual = spec(W + 2 * P, W + 2 * P, [g, ...lines], 'Half of a picture on a grid with a dashed mirror line');
  const done = spec(W + 2 * P, W + 2 * P, [
    grid(P, P, n, n, cell, { cells: Object.entries(target).map(([k, fill]) => ({ r: Number(k.split(',')[0]), c: Number(k.split(',')[1]), fill })) }),
    ...lines,
  ]);
  const taps = Object.keys(target).length - givens.length;
  const lineWord = axis === 'vh' ? 'both lines' : 'the line';
  return finish(ID, d, {
    prompt: axis === 'vh' ? 'Mirror it into all four corners!' : 'Make it symmetrical — tap the squares!',
    speak:
      axis === 'vh'
        ? 'Mirror the picture into all four corners, across both mirror lines. Tap the squares, then press check.'
        : 'Make the picture symmetrical. Tap the squares on the other side of the mirror line, then press check.',
    visual,
    answer: {
      kind: 'cells',
      gridId: 'sym',
      palette: colours,
      target,
      locked: givens.map((x) => key(x.r, x.c)),
    },
    explanation: [
      { text: `Every coloured square needs a twin on the other side of ${lineWord}.`, visual, highlight: ['axis', 'axis2'] },
      { text: 'Count how far each square is from the line. Its twin is just as far on the other side.', visual },
      { text: `That makes ${taps} squares to colour. Here it is finished!`, visual: done },
    ],
    rule: `${VARIANT_NAME[axis]} mirror, ${taps} squares`,
    variant: VARIANT_NAME[axis],
  });
};

export const validateSymmetry = (p: Puzzle): string[] => {
  const a = p.answer;
  if (a.kind !== 'cells') return ['expected a cells answer'];
  const g = byId(p.visual.nodes, 'sym');
  if (!g || g.t !== 'grid' || g.rows !== g.cols) return ['missing square grid'];
  const n = g.rows;
  const ax = byId(p.visual.nodes, 'axis');
  const ax2 = byId(p.visual.nodes, 'axis2');
  if (!ax || ax.t !== 'line') return ['missing axis'];
  const mid = g.x + (n * g.cell) / 2;
  const axis: Axis | null = ax2
    ? 'vh'
    : ax.x1 === ax.x2 && Math.abs(ax.x1 - mid) < 0.01
      ? 'v'
      : ax.y1 === ax.y2 && Math.abs(ax.y1 - (g.y + (n * g.cell) / 2)) < 0.01
        ? 'h'
        : ax.x2 - ax.x1 === ax.y2 - ax.y1
          ? 'd'
          : null;
  if (!axis) return ['axis is not a grid symmetry line'];
  const errs: string[] = [];
  const givens = (g.cells ?? []).filter((c) => c.fill);
  if (givens.length < 3) errs.push('too few given squares');
  const want: Record<string, Color> = {};
  for (const c of givens) {
    want[key(c.r, c.c)] = c.fill!;
    for (const [r, cc] of images(axis, n, c.r, c.c)) {
      if (r === c.r && cc === c.c) errs.push('a given square sits on the mirror line');
      if (givens.some((x) => x.r === r && x.c === cc)) errs.push('a given square already has its twin');
      want[key(r, cc)] = c.fill!;
    }
  }
  const tk = Object.keys(a.target).sort();
  const wk = Object.keys(want).sort();
  if (tk.join('|') !== wk.join('|') || tk.some((k) => a.target[k] !== want[k])) errs.push('target is not the symmetric completion');
  const locked = (a.locked ?? []).slice().sort();
  if (locked.join('|') !== givens.map((c) => key(c.r, c.c)).sort().join('|')) errs.push('locked cells must be exactly the givens');
  if (Object.values(a.target).some((c) => !a.palette.includes(c))) errs.push('target uses a colour not in the palette');
  if (a.gridId !== 'sym') errs.push('gridId mismatch');
  // The completed picture is symmetric (re-check from the target itself).
  for (const k of Object.keys(a.target)) {
    const [r, c] = k.split(',').map(Number);
    for (const [r2, c2] of images(axis, n, r, c)) if (a.target[key(r2, c2)] !== a.target[k]) errs.push('completed picture is not symmetric');
  }
  return [...new Set(errs)];
};

export const symmetryFill: PuzzleFamily = {
  id: ID,
  title: 'Mirror painting',
  emoji: '🦋',
  group: 'spatial',
  variants: ['vertical', 'horizontal', 'diagonal', 'four-way'],
  generate: (d, rng) => generateValid(() => attempt(d, rng), validateSymmetry),
  validate: validateSymmetry,
};
