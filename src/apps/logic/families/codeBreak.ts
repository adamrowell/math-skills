/**
 * code-break — "Each picture is a number" (docs/GEO-LOGIC.md §E.6).
 * Rows of pictures with totals; find one picture's value or a new row's total.
 * Validator: reads every row back from the picture and brute-forces all values 1..20 for every
 * symbol; exactly one assignment may satisfy all rows.
 */
import type { AnswerSpec, Difficulty, Puzzle, PuzzleFamily, Rng, VisualNode, VisualSpec } from '../engine/types';
import { OPTION_COUNT } from '../engine/types';
import { chance, pick, puzzleId, randInt, sample, shuffled } from '../engine/rng';
import type { Candidate } from './kit';
import { checkTextChoice, emoji, grid, numberOptions, spec, text, walk } from './kit';

const VARIANTS = ['value', 'total', 'times', 'minus'] as const;
type Variant = (typeof VARIANTS)[number];

const BY_D: Record<Difficulty, Variant[]> = {
  1: ['value', 'total'],
  2: ['value', 'total'],
  3: ['times', 'minus', 'value'],
};

const SYMBOLS = ['🍎', '🍌', '🍇', '🍓', '🐱', '🐶', '⭐', '🚗', '⚽', '🎈', '🍩', '🐸', '🌵', '🦊', '🍋', '🐟'];

type Op = '+' | '−' | '×';
interface Row {
  syms: number[]; // symbol indexes
  ops: Op[]; // between symbols
  total: number;
}

function evalRow(vals: number[], syms: number[], ops: Op[]): number {
  let acc = vals[syms[0]];
  ops.forEach((op, i) => {
    const v = vals[syms[i + 1]];
    acc = op === '+' ? acc + v : op === '−' ? acc - v : acc * v;
  });
  return acc;
}

function rowNodes(prefix: string, y: number, chars: string[], syms: number[], ops: Op[], total: string | null): VisualNode[] {
  const nodes: VisualNode[] = [];
  let x = 26;
  syms.forEach((s, j) => {
    nodes.push(emoji(x, y, chars[s], 34, { id: `${prefix}s${j}` }));
    x += 30;
    if (j < ops.length) {
      nodes.push(text(x, y, ops[j], { id: `${prefix}o${j}`, size: 24 }));
      x += 30;
    }
  });
  nodes.push(text(x, y, '=', { size: 24 }));
  x += 34;
  if (total === null) nodes.push(grid(x - 20, y - 20, 1, 1, 40, { id: `${prefix}t`, unknown: [{ r: 0, c: 0 }] }));
  else nodes.push(text(x, y, total, { id: `${prefix}t`, size: 26, anchor: 'middle' }));
  return nodes;
}

function buildRows(v: Variant, d: Difficulty, rng: Rng): { vals: number[]; rows: Row[] } | null {
  const n = d === 1 ? 2 : 3;
  const vals = Array.from({ length: n }, () => randInt(rng, 1, d === 1 ? 9 : 10));
  if (new Set(vals).size < n) return null;
  const rows: Row[] = [];
  // Row 1: one symbol repeated (2–3 times), or a product/square at d3.
  const k = d === 1 ? 2 : randInt(rng, 2, 3);
  if (v === 'times') rows.push({ syms: [0, 0], ops: ['×'], total: vals[0] * vals[0] });
  else rows.push({ syms: Array(k).fill(0), ops: Array(k - 1).fill('+'), total: vals[0] * k });
  // Each next row adds exactly one new symbol.
  for (let s = 1; s < n; s++) {
    const useMinus = v === 'minus' && s === 1;
    if (useMinus) {
      if (vals[0] <= vals[1]) return null;
      rows.push({ syms: [0, 1], ops: ['−'], total: vals[0] - vals[1] });
    } else {
      const old = randInt(rng, 0, s - 1);
      const twice = d > 1 && chance(rng, 0.4);
      const syms = twice ? [old, s, s] : chance(rng, 0.5) ? [s, old] : [old, s];
      rows.push({ syms, ops: Array(syms.length - 1).fill('+'), total: evalRow(vals, syms, Array(syms.length - 1).fill('+')) });
    }
  }
  return { vals, rows: d === 1 ? rows : shuffled(rng, rows) };
}

function generate(d: Difficulty, rng: Rng): Puzzle {
  for (let tries = 0; tries < 300; tries++) {
    const variant = pick(rng, BY_D[d]);
    const built = buildRows(variant, d, rng);
    if (!built) continue;
    const { vals, rows } = built;
    const chars = sample(rng, SYMBOLS, vals.length);
    const askTotal = variant === 'total' || ((variant === 'times' || variant === 'minus') && chance(rng, 0.5));
    let answerVal: number;
    let qSyms: number[];
    let qOps: Op[];
    if (askTotal) {
      const len = randInt(rng, 2, 3);
      qSyms = Array.from({ length: len }, () => randInt(rng, 0, vals.length - 1));
      if (new Set(qSyms).size < 2) qSyms[0] = (qSyms[1] + 1) % vals.length;
      qOps = Array(len - 1).fill(variant === 'times' && len === 2 ? '×' : '+');
      answerVal = evalRow(vals, qSyms, qOps);
      if (rows.some((r) => r.syms.join() === qSyms.join() && r.ops.join() === qOps.join())) continue;
    } else {
      const s = vals.length - 1 - (chance(rng, 0.3) ? 1 : 0);
      qSyms = [s];
      qOps = [];
      answerVal = vals[s];
    }
    if (answerVal < 0 || answerVal > 200) continue;
    const rowH = 54;
    const nodes: VisualNode[] = rows.flatMap((r, i) => rowNodes(`r${i}`, 30 + i * rowH, chars, r.syms, r.ops, String(r.total)));
    const qy = 30 + rows.length * rowH + 8;
    nodes.push(...rowNodes('q', qy, chars, qSyms, qOps, null));
    const visual: VisualSpec = spec(300, qy + 30, nodes, 'Picture code rows with totals; find the question mark.');
    const keypad = d >= 2 && chance(rng, d === 3 ? 0.6 : 0.35);
    const pool: Candidate[] = askTotal
      ? [
          { v: answerVal + 1, why: 'Add up each picture again' },
          { v: answerVal - 1, why: 'Add up each picture again' },
          { v: qSyms.reduce((a, s) => a + vals[s], 0) + (qOps.includes('×') ? 0 : vals[0]), why: 'Count every picture in the row once' },
          { v: rows[0].total, why: 'That total belongs to another row' },
          { v: answerVal + vals[qSyms[0]], why: 'Count every picture in the row once' },
        ]
      : [
          ...vals.filter((_, i) => i !== qSyms[0]).map((v) => ({ v, why: 'That is a different picture' })),
          { v: answerVal + 1, why: 'Check it in the rows' },
          { v: answerVal - 1, why: 'Check it in the rows' },
          { v: rows.find((r) => r.syms.includes(qSyms[0]))?.total ?? answerVal + 2, why: "That is the row's total" },
        ];
    const answer: AnswerSpec = keypad
      ? { kind: 'number', answer: answerVal }
      : numberOptions(rng, answerVal, pool, OPTION_COUNT[d], { min: 0, max: 200 });
    const first = rows.find((r) => new Set(r.syms).size === 1) ?? rows[0];
    const fsym = chars[first.syms[0]];
    const say = (s: number) => `${chars[s]} = ${vals[s]}`;
    const p: Puzzle = {
      id: puzzleId('code-break', d, `${variant}|${vals.join(',')}|${rows.map((r) => `${r.syms.join('')}${r.ops.join('')}`).join('/')}|${qSyms.join('')}${qOps.join('')}`),
      family: 'code-break',
      difficulty: d,
      prompt: askTotal ? 'Each picture is a number. What is the last row?' : `Each picture is a number. What is ${chars[qSyms[0]]}?`,
      speak: askTotal ? 'Each picture is a number. What does the last row make?' : 'Each picture is a number. What is the last picture worth?',
      visual,
      answer,
      explanation: [
        { text: `Start with the row that has only ${fsym}: ${first.syms.map((s) => chars[s]).join(` ${first.ops[0]} `)} = ${first.total}.`, visual, highlight: rows.map((r, i) => (r === first ? `r${i}t` : '')).filter(Boolean) },
        { text: `So ${say(first.syms[0])}. Put that into the next row.` },
        { text: `${vals.map((_, s) => say(s)).join(', ')}.` },
        { text: askTotal ? `${qSyms.map((s) => vals[s]).join(` ${qOps[0] ?? '+'} `)} = ${answerVal}.` : `So ${chars[qSyms[0]]} is ${answerVal}.` },
      ],
      rule: vals.map((_, s) => say(s)).join(', '),
      variant,
    };
    if (validate(p).length === 0) return p;
  }
  throw new Error('code-break: generator stuck');
}

// ---------------------------------------------------------------------------------------------
// Independent validator
// ---------------------------------------------------------------------------------------------

interface ParsedRow {
  syms: string[];
  ops: Op[];
  total: number | null;
}

function parseRows(s: VisualSpec): { rows: ParsedRow[]; q: ParsedRow | null } {
  const byPrefix = new Map<string, { syms: Array<[number, string]>; ops: Array<[number, Op]>; total: number | null }>();
  walk(s.nodes, (n) => {
    const m = n.id ? /^(r\d+|q)(s|o|t)(\d*)$/.exec(n.id) : null;
    if (!m) return;
    const e = byPrefix.get(m[1]) ?? { syms: [], ops: [], total: null };
    if (m[2] === 's' && n.t === 'emoji') e.syms.push([Number(m[3]), n.char]);
    if (m[2] === 'o' && n.t === 'text') e.ops.push([Number(m[3]), n.text as Op]);
    if (m[2] === 't' && n.t === 'text') e.total = Number(n.text);
    byPrefix.set(m[1], e);
  });
  const toRow = (e: { syms: Array<[number, string]>; ops: Array<[number, Op]>; total: number | null }): ParsedRow => ({
    syms: e.syms.sort((a, b) => a[0] - b[0]).map((x) => x[1]),
    ops: e.ops.sort((a, b) => a[0] - b[0]).map((x) => x[1]),
    total: e.total,
  });
  const rows: ParsedRow[] = [];
  for (const [k, e] of byPrefix) if (k !== 'q') rows.push(toRow(e));
  const qe = byPrefix.get('q');
  return { rows, q: qe ? toRow(qe) : null };
}

function validate(p: Puzzle): string[] {
  const { rows, q } = parseRows(p.visual);
  if (!q || rows.length < 2) return ['cannot read rows'];
  const symbols = [...new Set([...rows.flatMap((r) => r.syms), ...q.syms])];
  if (symbols.length > 3) return ['too many symbols'];
  const idx = (c: string) => symbols.indexOf(c);
  const sols: number[][] = [];
  const vals = Array(symbols.length).fill(1);
  const rec = (i: number) => {
    if (i === symbols.length) {
      if (rows.every((r) => evalRow(vals, r.syms.map(idx), r.ops) === r.total)) sols.push(vals.slice());
      return;
    }
    for (let v = 1; v <= 20; v++) {
      vals[i] = v;
      rec(i + 1);
    }
  };
  rec(0);
  if (sols.length !== 1) return [`${sols.length} solutions`];
  const ans = q.ops.length === 0 && q.syms.length === 1 ? sols[0][idx(q.syms[0])] : evalRow(sols[0], q.syms.map(idx), q.ops);
  if (p.answer.kind === 'number') return p.answer.answer === ans ? [] : [`keypad ${p.answer.answer} ≠ ${ans}`];
  if (p.answer.kind !== 'choice') return ['unexpected answer kind'];
  return checkTextChoice(p.answer, String(ans));
}

export const codeBreak: PuzzleFamily = {
  id: 'code-break',
  title: 'Secret Code',
  emoji: '🔐',
  group: 'number',
  variants: VARIANTS,
  generate,
  validate,
};
