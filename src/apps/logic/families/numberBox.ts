/**
 * number-box — "Which number goes in the box?" (docs/GEO-LOGIC.md §E.6).
 * Row boxes (find the rule from the full rows), + tables, cross sums, number pyramids, magic squares.
 * Validator: reads the numbers back from the picture and brute-forces every value 0..limit for the
 * unknown cell(s) against every rule it knows; exactly one value for "?" may survive.
 */
import type { AnswerSpec, Difficulty, ExplainStep, GridCell, GridNode, Puzzle, PuzzleFamily, Rng, VisualNode } from '../engine/types';
import { OPTION_COUNT } from '../engine/types';
import { chance, pick, puzzleId, randInt, shuffled } from '../engine/rng';
import type { Candidate } from './kit';
import { checkTextChoice, grid, numberOptions, spec } from './kit';

const VARIANTS = ['sum-row', 'diff-row', 'times-row', 'add-table', 'cross-sum', 'pyramid', 'magic'] as const;
type Variant = (typeof VARIANTS)[number];

const BY_D: Record<Difficulty, Variant[]> = {
  1: ['sum-row', 'add-table', 'diff-row'],
  2: ['times-row', 'cross-sum', 'pyramid', 'diff-row', 'sum-row'],
  3: ['magic', 'pyramid', 'cross-sum'],
};

const LIMIT: Record<Difficulty, number> = { 1: 100, 2: 200, 3: 300 };
const BLANK = '·';

interface Built {
  /** grids drawn (ids `b0`, `b1`…); unknown "?" is in exactly one grid. */
  grids: GridNode[];
  extra?: VisualNode[];
  w: number;
  h: number;
  answer: number;
  rule: string;
  pool: Candidate[];
  why: string[];
  prompt: string;
}

const cellsOf = (rows: Array<Array<number | null | '?'>>): { cells: GridCell[]; unknown: Array<{ r: number; c: number }> } => {
  const cells: GridCell[] = [];
  const unknown: Array<{ r: number; c: number }> = [];
  rows.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v === '?') unknown.push({ r, c });
      else cells.push({ r, c, label: v === null ? BLANK : String(v), fill: v === null ? 'grey' : undefined });
    }),
  );
  return { cells, unknown };
};

type RowRule = 'add' | 'sub' | 'mul';
const ROW_FN: Record<RowRule, (a: number, b: number) => number> = { add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b };
const ROW_TXT: Record<RowRule, string> = { add: 'first + second = third', sub: 'first − second = third', mul: 'first × second = third' };
const OP: Record<RowRule, string> = { add: '+', sub: '−', mul: '×' };

function rowBox(rule: RowRule, d: Difficulty, rng: Rng): Built | null {
  const rows: number[][] = [];
  for (let i = 0; i < 3; i++) {
    let a: number;
    let b: number;
    if (rule === 'mul') {
      a = randInt(rng, 2, d === 2 ? 9 : 12);
      b = randInt(rng, 2, 9);
    } else if (rule === 'sub') {
      a = randInt(rng, 5, d === 1 ? 20 : 60);
      b = randInt(rng, 1, a - 1);
    } else {
      a = randInt(rng, 1, d === 1 ? 12 : 40);
      b = randInt(rng, 1, d === 1 ? 9 : 40);
    }
    rows.push([a, b, ROW_FN[rule](a, b)]);
  }
  if (new Set(rows.map((r) => r[2])).size < 3) return null;
  const col = d === 1 ? pick(rng, [2, 2, 1, 0]) : pick(rng, [0, 1, 2]);
  const answer = rows[2][col];
  const shown: Array<Array<number | '?'>> = rows.map((r, i) => r.map((v, c) => (i === 2 && c === col ? '?' : v)));
  const { cells, unknown } = cellsOf(shown);
  const g = grid(4, 4, 3, 3, 60, { id: 'b0', cells, unknown });
  const [a, b, c] = rows[2];
  const [a0, b0, c0] = rows[0];
  const pool: Candidate[] =
    col === 2
      ? [
          { v: a * b, why: `Look at the full rows — it's not ×` },
          { v: Math.abs(a - b), why: `Look at the full rows — it's not −` },
          { v: a + b, why: `Look at the full rows — it's not +` },
          { v: c + 1, why: `${a} ${OP[rule]} ${b} = ${c}` },
          { v: c - 1, why: `${a} ${OP[rule]} ${b} = ${c}` },
          { v: rows[1][2], why: 'That number is in the row above' },
        ]
      : [
          { v: col === 0 ? c + b : c + a, why: 'Check it: the row must work' },
          { v: col === 0 ? c - b + 1 : c - a + 1, why: 'Check it: the row must work' },
          { v: col === 0 ? c - b - 1 : c - a - 1, why: 'Check it: the row must work' },
          { v: c, why: 'That is the answer to the row' },
          { v: rows[1][col], why: 'That number is in the row above' },
        ];
  pool.splice(0, pool.length, ...pool.filter((p) => p.v !== answer));
  const why = [
    `Look at a full row: ${a0} ${OP[rule]} ${b0} = ${c0}.`,
    `Every row works the same way: ${ROW_TXT[rule]}.`,
    col === 2 ? `So ${a} ${OP[rule]} ${b} = ${c}.` : `So the ? must be ${answer}: ${a} ${OP[rule]} ${b} = ${c}.`,
  ];
  return { grids: [g], w: 188, h: 188, answer, rule: ROW_TXT[rule], pool, why, prompt: 'Which number goes in the box?' };
}

function addTable(d: Difficulty, rng: Rng): Built {
  const h1 = randInt(rng, 1, d === 1 ? 9 : 20);
  let h2 = randInt(rng, 1, d === 1 ? 9 : 20);
  if (h2 === h1) h2 = h1 + 2;
  const v1 = randInt(rng, 1, d === 1 ? 9 : 20);
  let v2 = randInt(rng, 1, d === 1 ? 9 : 20);
  if (v2 === v1) v2 = v1 + 3;
  const table: Array<Array<number | '?' | null>> = [
    [null, h1, h2],
    [v1, v1 + h1, v1 + h2],
    [v2, v2 + h1, v2 + h2],
  ];
  const spots: Array<[number, number]> = [
    [1, 1],
    [1, 2],
    [2, 1],
    [2, 2],
    [0, 1],
    [2, 0],
  ];
  const [r, c] = pick(rng, d === 1 ? spots.slice(0, 4) : spots);
  const answer = table[r][c] as number;
  table[r][c] = '?';
  const { cells, unknown } = cellsOf(table);
  const corner = cells.find((x) => x.r === 0 && x.c === 0)!;
  corner.label = '+';
  corner.fill = 'yellow';
  for (const x of cells) if ((x.r === 0 || x.c === 0) && !(x.r === 0 && x.c === 0)) x.fill = 'yellow';
  const g = grid(4, 4, 3, 3, 60, { id: 'b0', cells, unknown });
  const head = r === 0 || c === 0;
  const rowH = table[r][0] as number | '?';
  const colH = table[0][c] as number | '?';
  const why = head
    ? [`Each inside number is its row number + its column number.`, `Find a full sum in the same line and take away the other number.`, `The ? is ${answer}.`]
    : [`Each inside number is its row number + its column number.`, `Row ${rowH}, column ${colH}: ${rowH} + ${colH} = ${answer}.`];
  const pool: Candidate[] = [
    { v: answer + 1, why: 'Add the row and column numbers' },
    { v: answer - 1, why: 'Add the row and column numbers' },
    { v: typeof rowH === 'number' && typeof colH === 'number' ? rowH * colH : answer + 2, why: 'It is a + table, not ×' },
    { v: answer + 10, why: 'Add the row and column numbers' },
  ];
  return { grids: [g], w: 188, h: 188, answer, rule: '+ table: row + column', pool, why, prompt: 'Which number goes in the box?' };
}

function crossSum(d: Difficulty, rng: Rng): Built | null {
  const m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => randInt(rng, 1, d === 2 ? 9 : 15)));
  const rs = m.map((r) => r[0] + r[1] + r[2]);
  const cs = [0, 1, 2].map((c) => m[0][c] + m[1][c] + m[2][c]);
  const full: Array<Array<number | '?' | null>> = [
    [...m[0], rs[0]],
    [...m[1], rs[1]],
    [...m[2], rs[2]],
    [...cs, null],
  ];
  const r = randInt(rng, 0, 2);
  const c = randInt(rng, 0, 2);
  const answer = m[r][c];
  full[r][c] = '?';
  let twoStep = false;
  if (d === 3 || (d === 2 && chance(rng, 0.5))) {
    // A second blank in the same row: the row sum alone can't do it, use the column.
    const c2 = (c + randInt(rng, 1, 2)) % 3;
    full[r][c2] = null;
    twoStep = true;
  }
  const { cells, unknown } = cellsOf(full);
  for (const x of cells) {
    if (x.r === 3 && x.c === 3) {
      x.label = '';
      x.fill = undefined;
    } else if (x.r === 3 || x.c === 3) x.fill = 'yellow';
  }
  const g = grid(4, 4, 4, 4, 52, { id: 'b0', cells, unknown });
  const colVals = [0, 1, 2].filter((i) => i !== r).map((i) => m[i][c]);
  const why = twoStep
    ? [`Yellow squares are totals: each row and column adds up to them.`, `The ? row has a hidden square, so use the ? column instead.`, `${cs[c]} − ${colVals[0]} − ${colVals[1]} = ${answer}.`]
    : [`Yellow squares are totals: each row and column adds up to them.`, `${rs[r]} take away the other two in the row = ${answer}.`];
  const pool: Candidate[] = [
    { v: answer + 1, why: 'Check the total again' },
    { v: answer - 1, why: 'Check the total again' },
    { v: rs[r] - answer, why: 'Take the other numbers away from the total' },
    { v: cs[c], why: 'That is the total, not the missing number' },
    { v: answer + 2, why: 'Check the total again' },
  ];
  return {
    grids: [g],
    w: 216,
    h: 216,
    answer,
    rule: 'rows and columns add up to the yellow totals',
    pool,
    why,
    prompt: 'Yellow squares are totals. What is the ?',
  };
}

/** Pyramid of `n` bottom blocks; each block = the two under it added. */
function pyramid(d: Difficulty, rng: Rng): Built | null {
  const n = d === 2 ? 3 : 4;
  const bottom = Array.from({ length: n }, () => randInt(rng, 1, d === 2 ? 12 : 15));
  const rows: number[][] = [bottom];
  while (rows[0].length > 1) {
    const b = rows[0];
    rows.unshift(b.slice(1).map((v, i) => b[i] + v));
  }
  // rows[0] = top
  const shown: Array<Array<number | '?' | null>> = rows.map((r) => r.slice());
  const all: Array<[number, number]> = [];
  rows.forEach((r, i) => r.forEach((_, j) => all.push([i, j])));
  const [qr, qc] = pick(rng, d === 2 ? all : all.filter(([i]) => i > 0));
  const answer = rows[qr][qc];
  shown[qr][qc] = '?';
  if (d === 3) {
    // Hide one or two more so it takes more than one step.
    const others = shuffled(rng, all.filter(([i, j]) => !(i === qr && j === qc)));
    const k = randInt(rng, 1, 2);
    for (const [i, j] of others.slice(0, k)) shown[i][j] = null;
  }
  const cell = n === 3 ? 58 : 50;
  const W = n * cell + 8;
  const grids: GridNode[] = shown.map((r, i) => {
    const { cells, unknown } = cellsOf([r]);
    return grid(4 + ((n - r.length) * cell) / 2, 4 + i * cell, 1, r.length, cell, { id: `b${i}`, cells, unknown });
  });
  // Solve it to explain (propagation).
  const below = qr < rows.length - 1 ? [rows[qr + 1][qc], rows[qr + 1][qc + 1]] : null;
  const why = [
    `Each block is the two blocks under it added together.`,
    below ? `Under the ? are ${below[0]} and ${below[1]}: ${below[0]} + ${below[1]} = ${answer}.` : `Take the block next to ? away from the block above them.`,
    `The ? is ${answer}.`,
  ];
  const pool: Candidate[] = [
    { v: answer + 1, why: 'Each block = the two under it added' },
    { v: answer - 1, why: 'Each block = the two under it added' },
    { v: rows[0][0], why: 'That is the top block' },
    { v: answer * 2, why: 'Each block = the two under it added' },
    { v: answer + 2, why: 'Each block = the two under it added' },
  ];
  return { grids, w: W, h: rows.length * cell + 8, answer, rule: 'each block = the two under it added', pool, why, prompt: 'Each block is the two below added. What is ?' };
}

const LO_SHU = [
  [2, 7, 6],
  [9, 5, 1],
  [4, 3, 8],
];

function magic(rng: Rng): Built {
  let m = LO_SHU.map((r) => r.slice());
  const t = randInt(rng, 0, 7);
  if (t & 1) m = m.map((r) => r.slice().reverse());
  if (t & 2) m = m.slice().reverse();
  if (t & 4) m = m[0].map((_, c) => m.map((r) => r[c]));
  const k = randInt(rng, 0, 12);
  const mult = pick(rng, [1, 1, 2]);
  m = m.map((r) => r.map((v) => v * mult + k));
  const total = m[0][0] + m[0][1] + m[0][2];
  const shown: Array<Array<number | '?' | null>> = m.map((r) => r.slice());
  const qr = randInt(rng, 0, 2);
  const qc = randInt(rng, 0, 2);
  const answer = m[qr][qc];
  shown[qr][qc] = '?';
  // Hide one more cell in a different row AND column (so both lines through ? stay usable once solved).
  const br = (qr + randInt(rng, 1, 2)) % 3;
  const bc = (qc + randInt(rng, 1, 2)) % 3;
  shown[br][bc] = null;
  const { cells, unknown } = cellsOf(shown);
  const g = grid(4, 4, 3, 3, 60, { id: 'b0', cells, unknown });
  const rowOthers = m[qr].filter((_, c) => c !== qc);
  const why = [
    `Find a full row or column: it adds up to ${total}.`,
    `Every row and column adds up to ${total}.`,
    `In the ? row: ${total} − ${rowOthers[0]} − ${rowOthers[1]} = ${answer}.`,
  ];
  const pool: Candidate[] = [
    { v: answer + 1, why: `The row must add up to ${total}` },
    { v: answer - 1, why: `The row must add up to ${total}` },
    { v: total - rowOthers[0], why: 'Take away BOTH other numbers' },
    { v: total, why: 'That is the total, not the missing number' },
    { v: answer + mult * 2, why: `The row must add up to ${total}` },
  ];
  return { grids: [g], w: 188, h: 188, answer, rule: `every row and column adds to ${total}`, pool, why, prompt: 'Every row and column adds the same. What is ?' };
}

function build(v: Variant, d: Difficulty, rng: Rng): Built | null {
  switch (v) {
    case 'sum-row':
      return rowBox('add', d, rng);
    case 'diff-row':
      return rowBox('sub', d, rng);
    case 'times-row':
      return rowBox('mul', d, rng);
    case 'add-table':
      return addTable(d, rng);
    case 'cross-sum':
      return crossSum(d, rng);
    case 'pyramid':
      return pyramid(d, rng);
    case 'magic':
      return magic(rng);
  }
}

function generate(d: Difficulty, rng: Rng): Puzzle {
  for (let tries = 0; tries < 200; tries++) {
    const variant = pick(rng, BY_D[d]);
    const b = build(variant, d, rng);
    if (!b) continue;
    const keypad = d === 3 && chance(rng, 0.5);
    const answer: AnswerSpec = keypad
      ? { kind: 'number', answer: b.answer }
      : numberOptions(rng, b.answer, b.pool, OPTION_COUNT[d], { min: 0, max: LIMIT[d] });
    const visual = spec(b.w, b.h, [...b.grids, ...(b.extra ?? [])], `Number puzzle: ${b.prompt}`);
    const p: Puzzle = {
      id: puzzleId('number-box', d, `${variant}|${JSON.stringify(b.grids.map((g) => [g.cells?.map((c) => c.label), g.unknown]))}`),
      family: 'number-box',
      difficulty: d,
      prompt: b.prompt,
      visual,
      answer,
      explanation: b.why.map((t, i): ExplainStep => (i === 0 ? { text: t, visual } : { text: t })),
      rule: b.rule,
      variant,
    };
    if (validate(p).length === 0) return p;
  }
  throw new Error('number-box: generator stuck');
}

// ---------------------------------------------------------------------------------------------
// Independent validator
// ---------------------------------------------------------------------------------------------

type Cell = number | '?' | null;

function readGrid(g: GridNode): Cell[][] {
  const out: Cell[][] = Array.from({ length: g.rows }, () => Array.from({ length: g.cols }, (): Cell => null));
  for (const c of g.cells ?? []) {
    const n = Number(c.label);
    out[c.r][c.c] = c.label !== undefined && c.label !== '' && c.label !== BLANK && Number.isFinite(n) ? n : null;
  }
  for (const u of g.unknown ?? []) out[u.r][u.c] = '?';
  return out;
}

/** Values of "?" that make `ok(qValue, blankValues)` true for some filling of the blanks. */
function solveValues(blanks: number, lim: number, ok: (q: number, bl: number[]) => boolean): number[] {
  const res: number[] = [];
  for (let q = 0; q <= lim; q++) {
    let hit = false;
    if (blanks === 0) hit = ok(q, []);
    else if (blanks === 1) {
      for (let a = 0; a <= lim && !hit; a++) hit = ok(q, [a]);
    } else {
      for (let a = 0; a <= lim && !hit; a++) for (let b = 0; b <= lim && !hit; b++) hit = ok(q, [a, b]);
    }
    if (hit) res.push(q);
  }
  return res;
}

function fill(m: Cell[][], q: number, bl: number[]): number[][] {
  let i = 0;
  return m.map((r) => r.map((v) => (v === '?' ? q : v === null ? (bl[i++] ?? 0) : v)));
}

function validate(p: Puzzle): string[] {
  const grids = p.visual.nodes.filter((n): n is GridNode => n.t === 'grid');
  const lim = LIMIT[p.difficulty];
  let values: number[] = [];
  const v = p.variant as Variant;
  if (v === 'sum-row' || v === 'diff-row' || v === 'times-row') {
    const m = readGrid(grids[0]);
    // Every row rule the validator knows; a rule must hold on every complete row.
    const rules: Array<(a: number, b: number, c: number) => boolean> = [
      (a, b, c) => a + b === c,
      (a, b, c) => a - b === c,
      (a, b, c) => b - a === c,
      (a, b, c) => a * b === c,
      (a, b, c) => a + b + 1 === c,
      (a, b, c) => 2 * a + b === c,
    ];
    const complete = m.filter((r) => r.every((x) => typeof x === 'number')) as number[][];
    const qRow = m.find((r) => r.includes('?'));
    if (!qRow || complete.length < 2) return ['bad row box'];
    const fits = rules.filter((f) => complete.every(([a, b, c]) => f(a, b, c)));
    // Also: every complete row has the same third number (a "constant" rule) → ambiguous.
    if (new Set(complete.map((r) => r[2])).size === 1) return ['constant third column'];
    const set = new Set<number>();
    for (const f of fits) for (let q = 0; q <= lim; q++) {
      const [a, b, c] = qRow.map((x) => (x === '?' ? q : (x as number)));
      if (f(a, b, c)) set.add(q);
    }
    values = [...set];
  } else if (v === 'add-table') {
    const m = readGrid(grids[0]);
    values = solveValues(0, lim, (q) => {
      const f = fill(m, q, []);
      return [1, 2].every((r) => [1, 2].every((c) => f[r][c] === f[r][0] + f[0][c]));
    });
  } else if (v === 'cross-sum') {
    const m = readGrid(grids[0]);
    const blanks = m.flat().filter((x, i) => x === null && i !== 15).length;
    m[3][3] = 0;
    values = solveValues(blanks, Math.min(lim, 60), (q, bl) => {
      const f = fill(m, q, bl);
      for (let i = 0; i < 3; i++) {
        if (f[i][0] + f[i][1] + f[i][2] !== f[i][3]) return false;
        if (f[0][i] + f[1][i] + f[2][i] !== f[3][i]) return false;
      }
      return true;
    });
  } else if (v === 'pyramid') {
    const rows = grids.map((g) => readGrid(g)[0]);
    // Propagate: any block relation with exactly one unknown determines it.
    const val: Array<Array<number | null>> = rows.map((r) => r.map((x) => (typeof x === 'number' ? x : null)));
    for (let pass = 0; pass < 10; pass++) {
      for (let i = 0; i < val.length - 1; i++) {
        for (let j = 0; j < val[i].length; j++) {
          const t = val[i][j];
          const l = val[i + 1][j];
          const r = val[i + 1][j + 1];
          if (t === null && l !== null && r !== null) val[i][j] = l + r;
          else if (t !== null && l === null && r !== null) val[i + 1][j] = t - r;
          else if (t !== null && l !== null && r === null) val[i + 1][j + 1] = t - l;
        }
      }
    }
    for (let i = 0; i < val.length - 1; i++)
      for (let j = 0; j < val[i].length; j++) {
        const t = val[i][j];
        const l = val[i + 1][j];
        const r = val[i + 1][j + 1];
        if (t === null || l === null || r === null) return ['pyramid not solvable step by step'];
        if (t !== l + r) return ['pyramid inconsistent'];
        if (l < 0 || r < 0) return ['negative block'];
      }
    let q: number | null = null;
    rows.forEach((r, i) => r.forEach((x, j) => (x === '?' ? (q = val[i][j]) : null)));
    values = q === null ? [] : [q];
  } else if (v === 'magic') {
    const m = readGrid(grids[0]);
    values = solveValues(1, Math.min(lim, 80), (q, bl) => {
      const f = fill(m, q, bl);
      const sums = [
        ...f.map((r) => r[0] + r[1] + r[2]),
        ...[0, 1, 2].map((c) => f[0][c] + f[1][c] + f[2][c]),
      ];
      return sums.every((s) => s === sums[0]);
    });
  } else return [`unknown variant ${v}`];

  if (values.length !== 1) return [`"?" has ${values.length} possible values (${values.slice(0, 5).join(',')})`];
  const ans = values[0];
  if (p.answer.kind === 'number') return p.answer.answer === ans ? [] : [`keypad ${p.answer.answer} ≠ ${ans}`];
  if (p.answer.kind !== 'choice') return ['unexpected answer kind'];
  return checkTextChoice(p.answer, String(ans));
}

export const numberBox: PuzzleFamily = {
  id: 'number-box',
  title: 'Number Boxes',
  emoji: '🔲',
  group: 'number',
  variants: VARIANTS,
  generate,
  validate,
};
