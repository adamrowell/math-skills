/**
 * mini-sudoku — 4×4, every row, column and 2×2 box has each symbol once (docs/GEO-LOGIC.md §E.6).
 * Generator: a shuffled valid grid, then givens are removed one by one while the puzzle keeps
 * exactly one solution. Validator: a backtracking solver counts solutions of the shown givens.
 */
import type { Difficulty, GridCell, Puzzle, PuzzleFamily, Rng, SudokuAnswer, VisualNode, VisualSpec } from '../engine/types';
import { chance, pick, puzzleId, randInt, shuffled } from '../engine/rng';
import { emoji, grid, line, shape, spec } from './kit';

const VARIANTS = ['digits', 'shapes', 'fruit'] as const;
type Variant = (typeof VARIANTS)[number];

const BY_D: Record<Difficulty, Variant[]> = {
  1: ['digits', 'fruit'],
  2: ['shapes', 'fruit', 'digits'],
  3: ['digits', 'shapes', 'fruit'],
};
const GIVENS: Record<Difficulty, [number, number]> = { 1: [8, 9], 2: [6, 7], 3: [5, 6] };

const CELL = 64;
export const SUDOKU_GRID_ID = 'sudoku';

const SHAPES: Array<{ key: string; node: (s: number) => VisualNode }> = [
  { key: 'circle', node: (s) => shape('circle', s / 2, s / 2, s * 0.62, { fill: 'red' }) },
  { key: 'square', node: (s) => shape('square', s / 2, s / 2, s * 0.78, { fill: 'blue' }) },
  { key: 'triangle', node: (s) => shape('triangle', s / 2, s / 2 + 2, s * 0.7, { fill: 'green' }) },
  { key: 'star', node: (s) => shape('star', s / 2, s / 2, s * 0.74, { fill: 'yellow' }) },
];
const FRUIT = ['🍎', '🍌', '🍇', '🍊'];

type G = Array<Array<number | null>>;

export function countSolutions(g: G, limit = 2): number {
  const grid = g.map((r) => r.slice());
  let count = 0;
  const ok = (r: number, c: number, v: number) => {
    for (let i = 0; i < 4; i++) if (grid[r][i] === v || grid[i][c] === v) return false;
    const br = r - (r % 2);
    const bc = c - (c % 2);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (grid[br + i][bc + j] === v) return false;
    return true;
  };
  const rec = (k: number): void => {
    if (count >= limit) return;
    if (k === 16) {
      count++;
      return;
    }
    const r = Math.floor(k / 4);
    const c = k % 4;
    if (grid[r][c] !== null) return rec(k + 1);
    for (let v = 0; v < 4; v++) {
      if (ok(r, c, v)) {
        grid[r][c] = v;
        rec(k + 1);
        grid[r][c] = null;
      }
    }
  };
  rec(0);
  return count;
}

function validGrid(g: number[][]): boolean {
  for (let i = 0; i < 4; i++) {
    if (new Set(g[i]).size !== 4) return false;
    if (new Set(g.map((r) => r[i])).size !== 4) return false;
    const br = Math.floor(i / 2) * 2;
    const bc = (i % 2) * 2;
    if (new Set([g[br][bc], g[br][bc + 1], g[br + 1][bc], g[br + 1][bc + 1]]).size !== 4) return false;
  }
  return true;
}

function fullGrid(rng: Rng): number[][] {
  let g = [
    [0, 1, 2, 3],
    [2, 3, 0, 1],
    [1, 0, 3, 2],
    [3, 2, 1, 0],
  ];
  const perm = shuffled(rng, [0, 1, 2, 3]);
  g = g.map((r) => r.map((v) => perm[v]));
  const rowOrder = (chance(rng, 0.5) ? [0, 1] : [1, 0]).concat(chance(rng, 0.5) ? [2, 3] : [3, 2]);
  const bands = chance(rng, 0.5) ? [0, 1, 2, 3] : [2, 3, 0, 1];
  g = bands.map((b) => g[rowOrder[b]]);
  const colOrder = (chance(rng, 0.5) ? [0, 1] : [1, 0]).concat(chance(rng, 0.5) ? [2, 3] : [3, 2]);
  const stacks = chance(rng, 0.5) ? [0, 1, 2, 3] : [2, 3, 0, 1];
  g = g.map((r) => stacks.map((s) => r[colOrder[s]]));
  if (chance(rng, 0.5)) g = g[0].map((_, c) => g.map((r) => r[c]));
  return g;
}

function symbolsFor(v: Variant): SudokuAnswer['symbols'] {
  if (v === 'digits') return ['1', '2', '3', '4'].map((k) => ({ key: k, label: k }));
  if (v === 'fruit') return FRUIT.map((k) => ({ key: k, label: k }));
  return SHAPES.map((s) => ({ key: s.key, visual: spec(CELL, CELL, [s.node(CELL)], s.key) }));
}

/** What a symbol looks like inside a cell (cell coordinates). */
export function symbolCell(variant: string, key: string): Pick<GridCell, 'label' | 'node'> {
  if (variant === 'shapes') {
    const s = SHAPES.find((x) => x.key === key);
    return s ? { node: s.node(CELL) } : {};
  }
  if (variant === 'fruit') return { node: emoji(CELL / 2, CELL / 2 + 2, key, CELL * 0.6) };
  return { label: key };
}

export function sudokuVisual(variant: string, givens: Array<Array<string | null>>, highlight?: { r: number; c: number; key: string }): VisualSpec {
  const cells: GridCell[] = [];
  givens.forEach((row, r) =>
    row.forEach((k, c) => {
      if (k !== null) cells.push({ r, c, fill: 'grey', ...symbolCell(variant, k), key: `${r},${c}` });
      else if (highlight && highlight.r === r && highlight.c === c) cells.push({ r, c, fill: 'yellow', ...symbolCell(variant, highlight.key) });
      else cells.push({ r, c, key: `${r},${c}` });
    }),
  );
  const s = 4 * CELL;
  return spec(
    s + 8,
    s + 8,
    [
      grid(4, 4, 4, 4, CELL, { id: SUDOKU_GRID_ID, cells }),
      line(4 + 2 * CELL, 4, 4 + 2 * CELL, 4 + s, { strokeWidth: 5, id: 'box-v' }),
      line(4, 4 + 2 * CELL, 4 + s, 4 + 2 * CELL, { strokeWidth: 5, id: 'box-h' }),
      { t: 'path', d: `M4 4 H${4 + s} V${4 + s} H4 Z`, fill: 'none', strokeWidth: 5 },
    ],
    'A 4 by 4 puzzle grid with some squares filled in.',
  );
}

/** A cell that has exactly one possible symbol right now (for the coach), or null. */
function nakedSingle(g: G): { r: number; c: number; v: number; why: string } | null {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (g[r][c] !== null) continue;
      const used = new Set<number>();
      for (let i = 0; i < 4; i++) {
        if (g[r][i] !== null) used.add(g[r][i]!);
        if (g[i][c] !== null) used.add(g[i][c]!);
      }
      const br = r - (r % 2);
      const bc = c - (c % 2);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (g[br + i][bc + j] !== null) used.add(g[br + i][bc + j]!);
      if (used.size === 3) {
        const v = [0, 1, 2, 3].find((x) => !used.has(x))!;
        return { r, c, v, why: `Its row, column and box already have the other three.` };
      }
    }
  return null;
}

function generate(d: Difficulty, rng: Rng): Puzzle {
  const variant = pick(rng, BY_D[d]);
  const symbols = symbolsFor(variant);
  for (let tries = 0; tries < 50; tries++) {
    const full = fullGrid(rng);
    const g: G = full.map((r) => r.slice());
    const target = randInt(rng, GIVENS[d][0], GIVENS[d][1]);
    let count = 16;
    for (const k of shuffled(rng, Array.from({ length: 16 }, (_, i) => i))) {
      if (count <= target) break;
      const r = Math.floor(k / 4);
      const c = k % 4;
      const keep = g[r][c];
      g[r][c] = null;
      if (countSolutions(g) === 1) count--;
      else g[r][c] = keep;
    }
    if (count !== target) continue;
    const key = (v: number) => symbols[v].key;
    const givens = g.map((r) => r.map((v) => (v === null ? null : key(v))));
    const solution = full.map((r) => r.map(key));
    const single = nakedSingle(g);
    const visual = sudokuVisual(variant, givens);
    const name = variant === 'digits' ? '1, 2, 3 and 4' : variant === 'fruit' ? 'each fruit' : 'each shape';
    const p: Puzzle = {
      id: puzzleId('mini-sudoku', d, `${variant}|${givens.map((r) => r.map((x) => x ?? '.').join('')).join('/')}`),
      family: 'mini-sudoku',
      difficulty: d,
      prompt: 'Every row, column and box gets each one once!',
      speak: `Fill the grid. Every row, every column and every box of four needs ${name}, just once.`,
      visual,
      answer: { kind: 'sudoku', gridId: SUDOKU_GRID_ID, symbols, solution, givens },
      explanation: [
        { text: 'Find a square where only ONE thing can go.', visual },
        ...(single
          ? [
              {
                text: `Row ${single.r + 1}, column ${single.c + 1}: ${single.why}`,
                visual: sudokuVisual(variant, givens, { r: single.r, c: single.c, key: key(single.v) }),
              },
            ]
          : []),
        { text: 'Fill it in, then look for the next square with only one choice.' },
        { text: 'Check: no row, column or box has the same thing twice.' },
      ],
      rule: 'each row, column and 2×2 box has every symbol once',
      variant,
    };
    if (validate(p).length === 0) return p;
  }
  throw new Error('mini-sudoku: generator stuck');
}

function validate(p: Puzzle): string[] {
  if (p.answer.kind !== 'sudoku') return ['not a sudoku answer'];
  const a = p.answer;
  const keys = a.symbols.map((s) => s.key);
  if (keys.length !== 4 || new Set(keys).size !== 4) return ['need 4 distinct symbols'];
  const toN = (k: string | null) => (k === null ? null : keys.indexOf(k));
  const g: G = a.givens.map((r) => r.map(toN));
  if (g.flat().some((v) => v === -1)) return ['unknown symbol in givens'];
  // The picture must show exactly the givens.
  const gn = p.visual.nodes.find((n) => n.t === 'grid' && n.id === a.gridId);
  if (!gn || gn.t !== 'grid') return ['no sudoku grid in the picture'];
  const shown = (gn.cells ?? []).filter((c) => c.label !== undefined || c.node !== undefined).length;
  const nGivens = g.flat().filter((v) => v !== null).length;
  if (shown !== nGivens) return [`picture shows ${shown} symbols, givens has ${nGivens}`];
  const sols = countSolutions(g, 3);
  if (sols !== 1) return [`${sols} solutions`];
  const sol = a.solution.map((r) => r.map((k) => keys.indexOf(k)));
  if (!validGrid(sol)) return ['solution breaks a rule'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (g[r][c] !== null && g[r][c] !== sol[r][c]) return ['solution disagrees with a given'];
  return [];
}

export const miniSudoku: PuzzleFamily = {
  id: 'mini-sudoku',
  title: 'Mini Sudoku',
  emoji: '🧩',
  group: 'logic',
  variants: VARIANTS,
  generate,
  validate,
};
