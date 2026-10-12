/**
 * Quick Algebra problem bank (docs/DESIGN.md §1.6).
 *
 * Five levels, each a handful of templates. A template is the unit of mastery (Leitner boxes via
 * src/drill), and `make()` turns it into a concrete equation with its hint and worked solution.
 * Every answer is a whole number 0..144.
 */
import type { Fact, SpeedThresholds } from '../../drill';

// ---------------------------------------------------------------------------
// Equation tokens
// ---------------------------------------------------------------------------

export type OpSym = '+' | '−' | '×' | '÷' | '=';

export type Tok =
  | { t: 'n'; v: number }
  | { t: 'op'; v: OpSym }
  /** The missing number in L1–L2 (shows what he types). */
  | { t: 'box' }
  /** `c·x` (c omitted → plain x). */
  | { t: 'x'; c?: number }
  /** x over c. */
  | { t: 'frac'; c: number }
  /** A picture unknown (🍎). */
  | { t: 'pic'; v: string }
  /** The answer slot on the "x = __" line (shows what he types). */
  | { t: 'ans' };

export interface Step {
  eq: Tok[];
  note?: string;
}

export interface Problem {
  templateId: string;
  level: LevelId;
  /** Equations shown (puzzles have 2–3). */
  lines: Tok[][];
  /** Separate answer line ("x = __", "🍌 = __"), or null when the box sits inside the equation. */
  ask: Tok[] | null;
  answer: number;
  /** Numbers in the problem (voice echo guard). */
  operands: number[];
  /** First-miss hint. */
  hint: string;
  /** Worked solution after the second miss. */
  steps: Step[];
  /** Plain machine form, e.g. `3*x-4=20;ask=x` (tests + debugging). */
  eq: string;
  /** Spoken/readable form for aria + summary, e.g. `3x − 4 = 20`. */
  text: string;
}

export type LevelId = 1 | 2 | 3 | 4 | 5;

export interface Template {
  id: string;
  title: string;
  prior: number;
  make: (rng: () => number) => Problem;
}

export interface LevelDef {
  id: LevelId;
  title: string;
  emoji: string;
  blurb: string;
  /** Example shown on the level card. */
  example: Tok[];
  /** "Take your time — use paper!": no clock, no speed bonus, streak bonus instead. */
  paper: boolean;
  /** Points for a first-try correct answer before multipliers. */
  base: number;
  speed: SpeedThresholds;
  templates: Template[];
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const n = (v: number): Tok => ({ t: 'n', v });
const op = (v: OpSym): Tok => ({ t: 'op', v });
const BOX: Tok = { t: 'box' };
const X = (c?: number): Tok => (c && c !== 1 ? { t: 'x', c } : { t: 'x' });
const frac = (c: number): Tok => ({ t: 'frac', c });
const pic = (v: string): Tok => ({ t: 'pic', v });
const ANS: Tok = { t: 'ans' };
const EQ = op('=');

export function randInt(lo: number, hi: number, rng: () => number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

const OP_MACHINE: Record<OpSym, string> = { '+': '+', '−': '-', '×': '*', '÷': '/', '=': '=' };

/** `3*x-4=20`; pictures map to A, B, C in order of first appearance. */
function machine(lines: Tok[][], askName: string, pics: string[]): string {
  const tokStr = (k: Tok): string => {
    switch (k.t) {
      case 'n':
        return String(k.v);
      case 'op':
        return OP_MACHINE[k.v];
      case 'box':
        return '?';
      case 'x':
        return k.c ? `${k.c}*x` : 'x';
      case 'frac':
        return `x/${k.c}`;
      case 'pic':
        return String.fromCharCode(65 + Math.max(0, pics.indexOf(k.v)));
      case 'ans':
        return '';
    }
  };
  return [...lines.map((l) => l.map(tokStr).join('')), `ask=${askName}`].join(';');
}

/** Human form: `3x − 4 = 20`, `☐ + 7 = 15`, `🍎 + 🍎 = 10`. */
export function tokText(line: Tok[]): string {
  return line
    .map((k) => {
      switch (k.t) {
        case 'n':
          return String(k.v);
        case 'op':
          return k.v;
        case 'box':
          return '☐';
        case 'x':
          return k.c ? `${k.c}x` : 'x';
        case 'frac':
          return `x/${k.c}`;
        case 'pic':
          return k.v;
        case 'ans':
          return '?';
      }
    })
    .join(' ');
}

function boxProblem(
  templateId: string,
  level: LevelId,
  line: Tok[],
  answer: number,
  hint: string,
  steps: Step[],
): Problem {
  const operands = line.filter((k): k is { t: 'n'; v: number } => k.t === 'n').map((k) => k.v);
  return {
    templateId,
    level,
    lines: [line],
    ask: null,
    answer,
    operands,
    hint,
    steps,
    eq: machine([line], '?', []),
    text: tokText(line),
  };
}

function xProblem(templateId: string, level: LevelId, line: Tok[], answer: number, hint: string, steps: Step[]): Problem {
  const operands = line.filter((k): k is { t: 'n'; v: number } => k.t === 'n').map((k) => k.v);
  for (const k of line) if (k.t === 'x' && k.c) operands.push(k.c);
  for (const k of line) if (k.t === 'frac') operands.push(k.c);
  return {
    templateId,
    level,
    lines: [line],
    ask: [X(), EQ, ANS],
    answer,
    operands,
    hint,
    steps,
    eq: machine([line], 'x', []),
    text: tokText(line),
  };
}

function picProblem(templateId: string, lines: Tok[][], askPic: string, answer: number, hint: string, steps: Step[]): Problem {
  const pics: string[] = [];
  for (const l of lines) for (const k of l) if (k.t === 'pic' && !pics.includes(k.v)) pics.push(k.v);
  const operands = lines.flatMap((l) => l.filter((k): k is { t: 'n'; v: number } => k.t === 'n').map((k) => k.v));
  return {
    templateId,
    level: 5,
    lines,
    ask: [pic(askPic), EQ, ANS],
    answer,
    operands,
    hint,
    steps,
    eq: machine(lines, String.fromCharCode(65 + pics.indexOf(askPic)), pics),
    text: lines.map(tokText).join(' · '),
  };
}

// ---------------------------------------------------------------------------
// Level 1 — missing number, + and − within 20
// ---------------------------------------------------------------------------

const L1: Template[] = [
  {
    id: 'alg:l1:add-b',
    title: '7 + ☐ = 15',
    prior: 0.8,
    make: (rng) => {
      const a = randInt(2, 12, rng);
      const s = randInt(a + 1, 20, rng);
      const x = s - a;
      return boxProblem('alg:l1:add-b', 1, [n(a), op('+'), BOX, EQ, n(s)], x, `Count up from ${a} to ${s}. How many jumps?`, [
        { eq: [BOX, EQ, n(s), op('−'), n(a)], note: `Take ${a} away from ${s}` },
        { eq: [BOX, EQ, n(x)] },
      ]);
    },
  },
  {
    id: 'alg:l1:add-a',
    title: '☐ + 7 = 15',
    prior: 0.9,
    make: (rng) => {
      const b = randInt(2, 12, rng);
      const s = randInt(b + 1, 20, rng);
      const x = s - b;
      return boxProblem('alg:l1:add-a', 1, [BOX, op('+'), n(b), EQ, n(s)], x, `What plus ${b} makes ${s}? Take ${b} away from ${s}.`, [
        { eq: [BOX, EQ, n(s), op('−'), n(b)], note: `Take ${b} away from ${s}` },
        { eq: [BOX, EQ, n(x)] },
      ]);
    },
  },
  {
    id: 'alg:l1:sub-b',
    title: '15 − ☐ = 9',
    prior: 1.1,
    make: (rng) => {
      const m = randInt(6, 20, rng);
      const d = randInt(0, m - 1, rng);
      const x = m - d;
      return boxProblem('alg:l1:sub-b', 1, [n(m), op('−'), BOX, EQ, n(d)], x, `${m} take away what leaves ${d}? Try ${m} − ${d}.`, [
        { eq: [BOX, EQ, n(m), op('−'), n(d)], note: `The gap between ${m} and ${d}` },
        { eq: [BOX, EQ, n(x)] },
      ]);
    },
  },
  {
    id: 'alg:l1:sub-a',
    title: '☐ − 9 = 4',
    prior: 1.2,
    make: (rng) => {
      const b = randInt(2, 10, rng);
      const d = randInt(1, 10, rng);
      const x = b + d;
      return boxProblem('alg:l1:sub-a', 1, [BOX, op('−'), n(b), EQ, n(d)], x, `Put them back together: ${d} + ${b}.`, [
        { eq: [BOX, EQ, n(d), op('+'), n(b)], note: `Add the ${b} back` },
        { eq: [BOX, EQ, n(x)] },
      ]);
    },
  },
];

// ---------------------------------------------------------------------------
// Level 2 — missing factor / divisor within 12 × 12
// ---------------------------------------------------------------------------

const L2: Template[] = [
  {
    id: 'alg:l2:mul-a',
    title: '☐ × 6 = 42',
    prior: 1.0,
    make: (rng) => {
      const b = randInt(2, 12, rng);
      const x = randInt(2, 12, rng);
      const p = x * b;
      return boxProblem('alg:l2:mul-a', 2, [BOX, op('×'), n(b), EQ, n(p)], x, `What times ${b} makes ${p}? Count by ${b}s!`, [
        { eq: [BOX, EQ, n(p), op('÷'), n(b)], note: `Split ${p} into ${b} equal groups` },
        { eq: [BOX, EQ, n(x)] },
      ]);
    },
  },
  {
    id: 'alg:l2:mul-b',
    title: '6 × ☐ = 42',
    prior: 1.0,
    make: (rng) => {
      const a = randInt(2, 12, rng);
      const x = randInt(2, 12, rng);
      const p = a * x;
      return boxProblem('alg:l2:mul-b', 2, [n(a), op('×'), BOX, EQ, n(p)], x, `${a} times what makes ${p}? Think of your ${a}s table.`, [
        { eq: [BOX, EQ, n(p), op('÷'), n(a)], note: `Split ${p} into ${a} equal groups` },
        { eq: [BOX, EQ, n(x)] },
      ]);
    },
  },
  {
    id: 'alg:l2:div-b',
    title: '42 ÷ ☐ = 7',
    prior: 1.3,
    make: (rng) => {
      const x = randInt(2, 12, rng);
      const q = randInt(2, 12, rng);
      const p = x * q;
      return boxProblem('alg:l2:div-b', 2, [n(p), op('÷'), BOX, EQ, n(q)], x, `Think: ${q} × what = ${p}?`, [
        { eq: [n(q), op('×'), BOX, EQ, n(p)], note: 'Turn it into times' },
        { eq: [BOX, EQ, n(p), op('÷'), n(q)] },
        { eq: [BOX, EQ, n(x)] },
      ]);
    },
  },
  {
    id: 'alg:l2:div-a',
    title: '☐ ÷ 6 = 7',
    prior: 1.2,
    make: (rng) => {
      const b = randInt(2, 12, rng);
      const q = randInt(2, 12, rng);
      const x = b * q;
      return boxProblem('alg:l2:div-a', 2, [BOX, op('÷'), n(b), EQ, n(q)], x, `Multiply back: ${q} × ${b}.`, [
        { eq: [BOX, EQ, n(q), op('×'), n(b)], note: `${b} groups of ${q}` },
        { eq: [BOX, EQ, n(x)] },
      ]);
    },
  },
];

// ---------------------------------------------------------------------------
// Level 3 — one step with x
// ---------------------------------------------------------------------------

const L3: Template[] = [
  {
    id: 'alg:l3:add',
    title: 'x + 27 = 53',
    prior: 1.0,
    make: (rng) => {
      const b = randInt(11, 39, rng);
      const x = randInt(5, 99 - b, rng);
      const s = x + b;
      return xProblem('alg:l3:add', 3, [X(), op('+'), n(b), EQ, n(s)], x, `Take ${b} from both sides.`, [
        { eq: [X(), EQ, n(s), op('−'), n(b)], note: `Take ${b} from both sides` },
        { eq: [X(), EQ, n(x)] },
      ]);
    },
  },
  {
    id: 'alg:l3:sub',
    title: 'x − 18 = 25',
    prior: 1.2,
    make: (rng) => {
      const b = randInt(11, 39, rng);
      const d = randInt(5, 50, rng);
      const x = b + d;
      return xProblem('alg:l3:sub', 3, [X(), op('−'), n(b), EQ, n(d)], x, `Add ${b} to both sides.`, [
        { eq: [X(), EQ, n(d), op('+'), n(b)], note: `Add ${b} to both sides` },
        { eq: [X(), EQ, n(x)] },
      ]);
    },
  },
  {
    id: 'alg:l3:mul',
    title: '3x = 24',
    prior: 1.1,
    make: (rng) => {
      const c = randInt(2, 12, rng);
      const x = randInt(2, 12, rng);
      const p = c * x;
      return xProblem('alg:l3:mul', 3, [X(c), EQ, n(p)], x, `${c}x means ${c} × x. What times ${c} makes ${p}?`, [
        { eq: [n(c), op('×'), X(), EQ, n(p)], note: `${c}x means ${c} × x` },
        { eq: [X(), EQ, n(p), op('÷'), n(c)], note: `Divide both sides by ${c}` },
        { eq: [X(), EQ, n(x)] },
      ]);
    },
  },
  {
    id: 'alg:l3:div',
    title: 'x/4 = 6',
    prior: 1.3,
    make: (rng) => {
      const c = randInt(2, 10, rng);
      const q = randInt(2, 12, rng);
      const x = c * q;
      return xProblem('alg:l3:div', 3, [frac(c), EQ, n(q)], x, `x ÷ ${c} = ${q}. Multiply both sides by ${c}.`, [
        { eq: [X(), op('÷'), n(c), EQ, n(q)], note: `The line means divide` },
        { eq: [X(), EQ, n(q), op('×'), n(c)], note: `Multiply both sides by ${c}` },
        { eq: [X(), EQ, n(x)] },
      ]);
    },
  },
];

// ---------------------------------------------------------------------------
// Level 4 — two steps (paper mode)
// ---------------------------------------------------------------------------

function twoStepMulSteps(c: number, b: number, r: number, plus: boolean): Step[] {
  const mid = plus ? r - b : r + b;
  const x = mid / c;
  return [
    { eq: [X(c), EQ, n(r), op(plus ? '−' : '+'), n(b)], note: plus ? `Take ${b} from both sides` : `Add ${b} to both sides` },
    { eq: [X(c), EQ, n(mid)] },
    { eq: [X(), EQ, n(mid), op('÷'), n(c)], note: `Divide both sides by ${c}` },
    { eq: [X(), EQ, n(x)] },
  ];
}

const L4: Template[] = [
  {
    id: 'alg:l4:mul-add',
    title: '2x + 3 = 11',
    prior: 1.0,
    make: (rng) => {
      const c = randInt(2, 9, rng);
      const x = randInt(1, 12, rng);
      const b = randInt(1, 20, rng);
      const r = c * x + b;
      return xProblem('alg:l4:mul-add', 4, [X(c), op('+'), n(b), EQ, n(r)], x, `Step 1: take ${b} from both sides. Then ${c}x = ${r - b}.`, twoStepMulSteps(c, b, r, true));
    },
  },
  {
    id: 'alg:l4:mul-sub',
    title: '3x − 4 = 20',
    prior: 1.2,
    make: (rng) => {
      const c = randInt(2, 9, rng);
      const x = randInt(2, 12, rng);
      const b = randInt(1, Math.min(20, c * x - 1), rng);
      const r = c * x - b;
      return xProblem('alg:l4:mul-sub', 4, [X(c), op('−'), n(b), EQ, n(r)], x, `Step 1: add ${b} to both sides. Then ${c}x = ${r + b}.`, twoStepMulSteps(c, b, r, false));
    },
  },
  {
    id: 'alg:l4:add-mul',
    title: '5 + 4x = 33',
    prior: 1.1,
    make: (rng) => {
      const c = randInt(2, 9, rng);
      const x = randInt(1, 12, rng);
      const b = randInt(1, 20, rng);
      const r = b + c * x;
      return xProblem('alg:l4:add-mul', 4, [n(b), op('+'), X(c), EQ, n(r)], x, `Step 1: take ${b} from both sides. Then ${c}x = ${r - b}.`, twoStepMulSteps(c, b, r, true));
    },
  },
  {
    id: 'alg:l4:div-add',
    title: 'x/3 + 2 = 7',
    prior: 1.4,
    make: (rng) => {
      const c = randInt(2, 6, rng);
      const q = randInt(2, 10, rng);
      const b = randInt(1, 15, rng);
      const x = c * q;
      const r = q + b;
      return xProblem('alg:l4:div-add', 4, [frac(c), op('+'), n(b), EQ, n(r)], x, `Step 1: take ${b} from both sides. Then x ÷ ${c} = ${q}.`, [
        { eq: [frac(c), EQ, n(r), op('−'), n(b)], note: `Take ${b} from both sides` },
        { eq: [frac(c), EQ, n(q)] },
        { eq: [X(), EQ, n(q), op('×'), n(c)], note: `Multiply both sides by ${c}` },
        { eq: [X(), EQ, n(x)] },
      ]);
    },
  },
];

// ---------------------------------------------------------------------------
// Level 5 — picture puzzles (two or three equations)
// ---------------------------------------------------------------------------

const PICS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍒', '🥕', '🍩', '🧁', '🍪', '🐶', '🐱'];

function pickPics(k: number, rng: () => number): string[] {
  const pool = [...PICS];
  const out: string[] = [];
  while (out.length < k) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

const L5: Template[] = [
  {
    id: 'alg:l5:double',
    title: '🍎 + 🍎, 🍎 + 🍌',
    prior: 1.0,
    make: (rng) => {
      const [A, B] = pickPics(2, rng);
      const a = randInt(1, 10, rng);
      const b = randInt(0, 12, rng);
      const lines = [
        [pic(A), op('+'), pic(A), EQ, n(2 * a)],
        [pic(A), op('+'), pic(B), EQ, n(a + b)],
      ];
      return picProblem('alg:l5:double', lines, B, b, `Two ${A} make ${2 * a}, so one ${A} is half of ${2 * a}.`, [
        { eq: [pic(A), EQ, n(2 * a), op('÷'), n(2)], note: `Two ${A} make ${2 * a}` },
        { eq: [pic(A), EQ, n(a)] },
        { eq: [n(a), op('+'), pic(B), EQ, n(a + b)], note: `Put ${a} in for ${A}` },
        { eq: [pic(B), EQ, n(a + b), op('−'), n(a)] },
        { eq: [pic(B), EQ, n(b)] },
      ]);
    },
  },
  {
    id: 'alg:l5:triple',
    title: '🍎 + 🍎 + 🍎, 🍌 − 🍎',
    prior: 1.2,
    make: (rng) => {
      const [A, B] = pickPics(2, rng);
      const a = randInt(1, 9, rng);
      const d = randInt(1, 10, rng);
      const b = a + d;
      const lines = [
        [pic(A), op('+'), pic(A), op('+'), pic(A), EQ, n(3 * a)],
        [pic(B), op('−'), pic(A), EQ, n(d)],
      ];
      return picProblem('alg:l5:triple', lines, B, b, `Three ${A} make ${3 * a}, so one ${A} is ${3 * a} ÷ 3.`, [
        { eq: [pic(A), EQ, n(3 * a), op('÷'), n(3)], note: `Three ${A} make ${3 * a}` },
        { eq: [pic(A), EQ, n(a)] },
        { eq: [pic(B), op('−'), n(a), EQ, n(d)], note: `Put ${a} in for ${A}` },
        { eq: [pic(B), EQ, n(d), op('+'), n(a)] },
        { eq: [pic(B), EQ, n(b)] },
      ]);
    },
  },
  {
    id: 'alg:l5:times',
    title: '🍎 × 🍎, 🍎 × 🍌',
    prior: 1.3,
    make: (rng) => {
      const [A, B] = pickPics(2, rng);
      const a = randInt(2, 9, rng);
      const b = randInt(2, 12, rng);
      const lines = [
        [pic(A), op('×'), pic(A), EQ, n(a * a)],
        [pic(A), op('×'), pic(B), EQ, n(a * b)],
      ];
      return picProblem('alg:l5:times', lines, B, b, `What number times itself makes ${a * a}? That is ${A}.`, [
        { eq: [pic(A), EQ, n(a)], note: `${a} × ${a} = ${a * a}` },
        { eq: [n(a), op('×'), pic(B), EQ, n(a * b)], note: `Put ${a} in for ${A}` },
        { eq: [pic(B), EQ, n(a * b), op('÷'), n(a)] },
        { eq: [pic(B), EQ, n(b)] },
      ]);
    },
  },
  {
    id: 'alg:l5:chain',
    title: '🍎, 🍌, 🍇 chain',
    prior: 1.5,
    make: (rng) => {
      const [A, B, C] = pickPics(3, rng);
      const a = randInt(1, 9, rng);
      const b = randInt(1, 9, rng);
      const c = randInt(1, 10, rng);
      const lines = [
        [pic(A), op('+'), pic(A), EQ, n(2 * a)],
        [pic(A), op('+'), pic(B), EQ, n(a + b)],
        [pic(B), op('+'), pic(C), EQ, n(b + c)],
      ];
      return picProblem('alg:l5:chain', lines, C, c, `Go top to bottom: find ${A} first, then ${B}, then ${C}.`, [
        { eq: [pic(A), EQ, n(a)], note: `Two ${A} make ${2 * a}` },
        { eq: [pic(B), EQ, n(a + b), op('−'), n(a), EQ, n(b)], note: `Put ${a} in for ${A}` },
        { eq: [pic(C), EQ, n(b + c), op('−'), n(b)], note: `Put ${b} in for ${B}` },
        { eq: [pic(C), EQ, n(c)] },
      ]);
    },
  },
];

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    title: 'Missing number',
    emoji: '🔲',
    blurb: '+ and − up to 20',
    example: [BOX, op('+'), n(7), EQ, n(15)],
    paper: false,
    base: 16,
    speed: { fastMs: 4000, okMs: 8000 },
    templates: L1,
  },
  {
    id: 2,
    title: 'Times detective',
    emoji: '🕵️',
    blurb: '× and ÷ up to 12 × 12',
    example: [n(6), op('×'), BOX, EQ, n(42)],
    paper: false,
    base: 22,
    speed: { fastMs: 5000, okMs: 10000 },
    templates: L2,
  },
  {
    id: 3,
    title: 'Meet x',
    emoji: '❎',
    blurb: 'x is the mystery number',
    example: [X(3), EQ, n(24)],
    paper: false,
    base: 25,
    speed: { fastMs: 8000, okMs: 15000 },
    templates: L3,
  },
  {
    id: 4,
    title: 'Two steps',
    emoji: '📝',
    blurb: 'Take your time, use paper!',
    example: [X(2), op('+'), n(3), EQ, n(11)],
    paper: true,
    base: 35,
    speed: { fastMs: 20000, okMs: 40000 },
    templates: L4,
  },
  {
    id: 5,
    title: 'Fruit puzzles',
    emoji: '🍎',
    blurb: 'Crack the picture code',
    example: [pic('🍎'), op('+'), pic('🍌'), EQ, n(8)],
    paper: true,
    base: 40,
    speed: { fastMs: 20000, okMs: 40000 },
    templates: L5,
  },
];

export const LEVEL_IDS: LevelId[] = [1, 2, 3, 4, 5];

export function levelDef(id: number): LevelDef {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

export function isLevelId(v: unknown): v is LevelId {
  return typeof v === 'number' && LEVEL_IDS.includes(v as LevelId);
}

/** Templates as drill Facts, so src/drill's mastery + scheduler work unchanged. */
export function templateFacts(level: LevelId): Fact[] {
  return levelDef(level).templates.map((t) => ({
    id: t.id,
    prompt: t.title,
    answer: 0,
    operands: [],
    op: '+',
    prior: t.prior,
    tags: [`L${level}`],
  }));
}

export function makeProblem(templateId: string, rng: () => number = Math.random): Problem {
  for (const l of LEVELS) {
    const t = l.templates.find((x) => x.id === templateId);
    if (t) return t.make(rng);
  }
  throw new Error(`unknown algebra template ${templateId}`);
}

export const ALL_TEMPLATE_IDS = LEVELS.flatMap((l) => l.templates.map((t) => t.id));

export const QUESTIONS_PER_SET = 10;
export const MAX_ANSWER = 144;
