/**
 * rule-machine — "What comes out?" Pairs like 3 → 7, 5 → 11, 8 → ? (docs/GEO-LOGIC.md §E.6).
 * Validator: reads the pairs back from the picture and fits every linear rule (y = a·x + b, any
 * rational a, b) and every "a·x² + b" rule; all fitting rules must agree on the asked number.
 */
import type { AnswerSpec, Difficulty, GridNode, Puzzle, PuzzleFamily, Rng, VisualSpec } from '../engine/types';
import { OPTION_COUNT } from '../engine/types';
import { chance, pick, puzzleId, randInt, sample } from '../engine/rng';
import type { Candidate } from './kit';
import { checkTextChoice, emoji, grid, line, numberOptions, spec, text } from './kit';

const VARIANTS = ['add', 'sub', 'times', 'two-step', 'square', 'reverse'] as const;
type Variant = (typeof VARIANTS)[number];

const BY_D: Record<Difficulty, Variant[]> = {
  1: ['add', 'sub', 'times'],
  2: ['times', 'two-step', 'add', 'reverse'],
  3: ['square', 'reverse', 'two-step'],
};
const LIMIT: Record<Difficulty, number> = { 1: 100, 2: 200, 3: 1000 };

interface Rule {
  f: (x: number) => number;
  /** "×2 then +1" */
  say: string;
  /** "3 × 2 + 1" for a given x */
  show: (x: number) => string;
  near: Array<{ f: (x: number) => number; why: string }>;
}

function makeRule(v: Variant, d: Difficulty, rng: Rng): Rule {
  if (v === 'add') {
    const n = randInt(rng, d === 1 ? 1 : 6, d === 1 ? 10 : 25);
    return {
      f: (x) => x + n,
      say: `+${n}`,
      show: (x) => `${x} + ${n}`,
      near: [
        { f: (x) => x + n + 1, why: `It adds ${n}, not ${n + 1}` },
        { f: (x) => x + n - 1, why: `It adds ${n}, not ${n - 1}` },
        { f: (x) => x * 2, why: `It adds ${n} — it doesn't double` },
        { f: (x) => x - n, why: 'The numbers get bigger, not smaller' },
      ],
    };
  }
  if (v === 'sub') {
    const n = randInt(rng, 1, 10);
    return {
      f: (x) => x - n,
      say: `−${n}`,
      show: (x) => `${x} − ${n}`,
      near: [
        { f: (x) => x - n + 1, why: `It takes away ${n}` },
        { f: (x) => x - n - 1, why: `It takes away ${n}` },
        { f: (x) => x + n, why: 'The numbers get smaller, not bigger' },
      ],
    };
  }
  if (v === 'times') {
    const n = d === 1 ? pick(rng, [2, 2, 10]) : pick(rng, [3, 4, 5, 6]);
    return {
      f: (x) => x * n,
      say: `×${n}`,
      show: (x) => `${x} × ${n}`,
      near: [
        { f: (x) => x + n, why: `It doesn't add ${n} — it's ×${n}` },
        { f: (x) => x * (n + 1), why: `×${n}, not ×${n + 1}` },
        { f: (x) => x * n + 1, why: `${'×'}${n} only` },
        { f: (x) => x * (n - 1) || x + 1, why: `×${n}, not ×${n - 1}` },
      ],
    };
  }
  if (v === 'square') {
    const c = randInt(rng, 0, 9);
    const sign = c === 0 ? 1 : pick(rng, [1, 1, -1]);
    const k = sign * c;
    const tail = k === 0 ? '' : k > 0 ? ` + ${k}` : ` − ${-k}`;
    return {
      f: (x) => x * x + k,
      say: `times itself${tail ? `, then${tail.replace(' + ', ' +').replace(' − ', ' −')}` : ''}`,
      show: (x) => `${x} × ${x}${tail}`,
      near: [
        { f: (x) => x * 2 + k, why: 'It is the number times ITSELF, not ×2' },
        { f: (x) => x * x + k + 1, why: 'Check the last step again' },
        { f: (x) => x * x, why: k === 0 ? 'Close — check again' : `Don't forget the ${k > 0 ? '+' : '−'}${Math.abs(k)}` },
        { f: (x) => (x + 1) * (x + 1) + k, why: 'Use the number itself, not one more' },
      ],
    };
  }
  // two-step (also used by reverse): ×a then ±b
  const a = d === 1 ? 2 : randInt(rng, 2, d === 3 ? 6 : 4);
  const b = randInt(rng, 1, d === 3 ? 12 : 6) * pick(rng, [1, 1, -1]);
  const tail = b > 0 ? ` + ${b}` : ` − ${-b}`;
  return {
    f: (x) => a * x + b,
    say: `×${a} then ${b > 0 ? '+' : '−'}${Math.abs(b)}`,
    show: (x) => `${x} × ${a}${tail}`,
    near: [
      { f: (x) => a * x, why: `Two steps: ×${a} AND ${b > 0 ? '+' : '−'}${Math.abs(b)}` },
      { f: (x) => x + b, why: `Two steps: ×${a} AND ${b > 0 ? '+' : '−'}${Math.abs(b)}` },
      { f: (x) => a * (x + b), why: `×${a} first, then ${b > 0 ? '+' : '−'}${Math.abs(b)}` },
      { f: (x) => a * x + b + 1, why: 'Check the last step again' },
      { f: (x) => a * x - b, why: `It's ${b > 0 ? '+' : '−'}${Math.abs(b)}, not ${b > 0 ? '−' : '+'}${Math.abs(b)}` },
    ],
  };
}

function machineVisual(pairs: Array<[number | '?', number | '?']>, hl?: number): VisualSpec {
  const cell = 46;
  const rows = pairs.length;
  const top = 34;
  const inG: GridNode = grid(40, top, rows, 1, cell, {
    id: 'in',
    cells: pairs.flatMap(([x], r) => (x === '?' ? [] : [{ r, c: 0, label: String(x), fill: hl === r ? 'yellow' : undefined }])),
    unknown: pairs.flatMap(([x], r) => (x === '?' ? [{ r, c: 0 }] : [])),
  });
  const outG: GridNode = grid(210, top, rows, 1, cell, {
    id: 'out',
    cells: pairs.flatMap(([, y], r) => (y === '?' ? [] : [{ r, c: 0, label: String(y), fill: hl === r ? 'yellow' : undefined }])),
    unknown: pairs.flatMap(([, y], r) => (y === '?' ? [{ r, c: 0 }] : [])),
  });
  const nodes = [
    text(63, 16, 'IN', { size: 15, fill: 'blue' }),
    text(233, 16, 'OUT', { size: 15, fill: 'green' }),
    inG,
    outG,
    ...pairs.map((_, r) => line(92, top + r * cell + cell / 2, 202, top + r * cell + cell / 2, { stroke: 'grey', strokeWidth: 3, arrow: 'end' as const })),
    emoji(147, top + (rows * cell) / 2, '🤖', 44, { id: 'bot' }),
  ];
  return spec(266, top + rows * cell + 6, nodes, `Machine: ${pairs.map(([x, y]) => `${x} goes to ${y}`).join(', ')}`);
}

function generate(d: Difficulty, rng: Rng): Puzzle {
  const lim = LIMIT[d];
  for (let tries = 0; tries < 300; tries++) {
    const variant = pick(rng, BY_D[d]);
    const rule = makeRule(variant === 'reverse' ? 'two-step' : variant, d, rng);
    const xmax = variant === 'square' ? 12 : d === 1 ? 12 : 20;
    const xs = sample(
      rng,
      Array.from({ length: xmax }, (_, i) => i + 1),
      4,
    );
    const shownXs = d === 1 ? xs.slice(0, 3).sort((a, b) => a - b) : xs.slice(0, 3);
    const qx = xs[3];
    const ys = [...shownXs, qx].map(rule.f);
    if (ys.some((y) => y < 0 || y > lim)) continue;
    const reverse = variant === 'reverse';
    const answerVal = reverse ? qx : rule.f(qx);
    const pairs: Array<[number | '?', number | '?']> = [...shownXs.map((x, i): [number, number] => [x, ys[i]]), reverse ? ['?', rule.f(qx)] : [qx, '?']];
    const visual = machineVisual(pairs);
    const pool: Candidate[] = reverse
      ? [
          { v: rule.f(rule.f(qx)), why: 'Go BACKWARDS through the machine' },
          { v: qx + 1, why: `Check it: ${rule.show(qx + 1)} = ${rule.f(qx + 1)}` },
          { v: qx - 1, why: `Check it: ${rule.show(qx - 1)} = ${rule.f(qx - 1)}` },
          { v: rule.f(qx) - qx, why: 'Undo each step, last step first' },
          { v: qx + 2, why: `Check it: ${rule.show(qx + 2)} = ${rule.f(qx + 2)}` },
        ]
      : [...rule.near.map((nr) => ({ v: nr.f(qx), why: nr.why })), { v: ys[2], why: 'That is the answer for a different number' }];
    const keypad = d === 3 && chance(rng, 0.5);
    const answer: AnswerSpec = keypad
      ? { kind: 'number', answer: answerVal }
      : numberOptions(rng, answerVal, pool, OPTION_COUNT[d], { min: 0, max: lim });
    const x0 = shownXs[0];
    const p: Puzzle = {
      id: puzzleId('rule-machine', d, `${variant}|${pairs.map((q) => q.join('>')).join(',')}`),
      family: 'rule-machine',
      difficulty: d,
      prompt: reverse ? 'What number went IN?' : 'What comes out of the machine?',
      speak: reverse ? 'What number went in, to make this come out?' : 'What comes out of the machine?',
      visual,
      answer,
      explanation: [
        { text: `Look at the first one: ${x0} goes in, ${ys[0]} comes out.`, visual: machineVisual(pairs, 0) },
        { text: `The machine does ${rule.say}: ${rule.show(x0)} = ${ys[0]}.` },
        { text: `Check another: ${rule.show(shownXs[1])} = ${ys[1]}. Yes!` },
        { text: reverse ? `Work backwards: ${rule.show(qx)} = ${rule.f(qx)}, so ${qx} went in.` : `So ${rule.show(qx)} = ${rule.f(qx)}.` },
      ],
      rule: `the machine does ${rule.say}`,
      variant,
    };
    if (validate(p).length === 0) return p;
  }
  throw new Error('rule-machine: generator stuck');
}

// ---------------------------------------------------------------------------------------------
// Independent validator
// ---------------------------------------------------------------------------------------------

type Fit = (x: number) => number;

/** Rules fitted through the complete pairs (overdetermined: 2 parameters, ≥ 3 points). */
export function fitMachine(pairs: Array<[number, number]>): Fit[] {
  const fits: Fit[] = [];
  const [[x1, y1], [x2, y2]] = pairs;
  const ok = (f: Fit) => pairs.every(([x, y]) => Math.abs(f(x) - y) < 1e-9);
  if (x1 !== x2) {
    const a = (y2 - y1) / (x2 - x1);
    const b = y1 - a * x1;
    const f = (x: number) => a * x + b;
    if (ok(f)) fits.push(f);
  }
  if (x1 * x1 !== x2 * x2) {
    const a = (y2 - y1) / (x2 * x2 - x1 * x1);
    const b = y1 - a * x1 * x1;
    const f = (x: number) => a * x * x + b;
    if (ok(f)) fits.push(f);
  }
  return fits;
}

function readCol(g: GridNode): Array<number | '?'> {
  const out: Array<number | '?'> = Array.from({ length: g.rows }, () => 0);
  for (const c of g.cells ?? []) out[c.r] = Number(c.label);
  for (const u of g.unknown ?? []) out[u.r] = '?';
  return out;
}

function validate(p: Puzzle): string[] {
  const gi = p.visual.nodes.find((n): n is GridNode => n.t === 'grid' && n.id === 'in');
  const go = p.visual.nodes.find((n): n is GridNode => n.t === 'grid' && n.id === 'out');
  if (!gi || !go) return ['no machine'];
  const ins = readCol(gi);
  const outs = readCol(go);
  const known: Array<[number, number]> = [];
  let q: { x: number | '?'; y: number | '?' } | null = null;
  ins.forEach((x, i) => {
    const y = outs[i];
    if (x === '?' || y === '?') q = { x, y };
    else known.push([x, y]);
  });
  if (!q || known.length < 3) return ['need 3 pairs and one question'];
  const fits = fitMachine(known);
  if (!fits.length) return ['no rule fits the pairs'];
  const lim = LIMIT[p.difficulty];
  const vals = new Set<number>();
  const qq = q as { x: number | '?'; y: number | '?' };
  for (const f of fits) {
    if (qq.y === '?') {
      const y = f(qq.x as number);
      if (Number.isInteger(Math.round(y * 1e9) / 1e9)) vals.add(Math.round(y));
      else return ['answer is not a whole number'];
    } else {
      for (let x = 0; x <= lim; x++) if (Math.abs(f(x) - (qq.y as number)) < 1e-9) vals.add(x);
    }
  }
  if (vals.size !== 1) return [`ambiguous: ${[...vals].join(',')}`];
  const ans = [...vals][0];
  if (p.answer.kind === 'number') return p.answer.answer === ans ? [] : [`keypad ${p.answer.answer} ≠ ${ans}`];
  if (p.answer.kind !== 'choice') return ['unexpected answer kind'];
  return checkTextChoice(p.answer, String(ans));
}

export const ruleMachine: PuzzleFamily = {
  id: 'rule-machine',
  title: 'Robot Machine',
  emoji: '🤖',
  group: 'number',
  variants: VARIANTS,
  generate,
  validate,
};
