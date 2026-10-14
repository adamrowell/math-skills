/**
 * balance — scale pictures (docs/GEO-LOGIC.md §E.6).
 * Order questions ("Which is heaviest?") from tilted scales, and level-scale ratio questions
 * ("How many 🍎 weigh the same as one 🍉?").
 * Validator: reads every scale back (tilt + pan contents). Order: transitive closure — exactly one
 * object must be provably heavier (lighter) than every other. Ratio: brute-forces whole-number
 * weights 1..24 for every object; every consistent weighting must give the same answer.
 */
import type { AnswerSpec, Difficulty, Puzzle, PuzzleFamily, Rng, ScaleNode, VisualNode, VisualSpec } from '../engine/types';
import { OPTION_COUNT } from '../engine/types';
import { chance, pick, puzzleId, randInt, sample, shuffled } from '../engine/rng';
import type { Candidate } from './kit';
import { checkTextChoice, emoji, finalizeChoice, numberOptions, spec, text, walk } from './kit';

const VARIANTS = ['heaviest', 'lightest', 'chain', 'how-many', 'ratio'] as const;
type Variant = (typeof VARIANTS)[number];

const BY_D: Record<Difficulty, Variant[]> = {
  1: ['heaviest', 'lightest'],
  2: ['chain', 'how-many'],
  3: ['chain', 'ratio'],
};

const THINGS: Array<[string, string, string]> = [
  ['🍎', 'apple', 'apples'],
  ['🍐', 'pear', 'pears'],
  ['🍉', 'watermelon', 'watermelons'],
  ['🍌', 'banana', 'bananas'],
  ['🍓', 'strawberry', 'strawberries'],
  ['🍇', 'bunch of grapes', 'bunches of grapes'],
  ['🥕', 'carrot', 'carrots'],
  ['🍋', 'lemon', 'lemons'],
  ['🥥', 'coconut', 'coconuts'],
  ['🍍', 'pineapple', 'pineapples'],
  ['🎃', 'pumpkin', 'pumpkins'],
  ['🧸', 'teddy bear', 'teddy bears'],
  ['⚽', 'ball', 'balls'],
  ['📦', 'box', 'boxes'],
];
const nameOf = (c: string, plural = false) => {
  const t = THINGS.find((x) => x[0] === c);
  return t ? t[plural ? 2 : 1] : 'thing';
};

/** Lay out `count` emoji in a pan (≤ 3 per row, stacked upwards). */
function panItems(chars: string[], size: number): VisualNode[] {
  const per = 3;
  const gap = size * 0.82;
  return chars.map((c, i) => {
    const row = Math.floor(i / per);
    const inRow = Math.min(per, chars.length - row * per);
    const col = i % per;
    return emoji((col - (inRow - 1) / 2) * gap, -row * gap * 0.85, c, size);
  });
}

function scaleAt(x: number, y: number, width: number, left: string[], right: string[], tilt: -1 | 0 | 1, size: number, id: string): ScaleNode {
  return { t: 'scale', id, x, y, width, tilt, left: panItems(left, size), right: panItems(right, size) };
}

/** Positions for n scales inside 400 × (≤ 300): two per row (three per row for 5+). */
function layout(n: number): { w: number; h: number; pos: Array<[number, number]>; width: number; size: number } {
  const cols = n >= 5 ? 3 : 2;
  const cw = 400 / cols;
  const rows = Math.ceil(n / cols);
  const pos: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const c = i % cols;
    pos.push([200 + (c - (inRow - 1) / 2) * cw, 30 + r * 140]);
  }
  return { w: 400, h: rows * 140 - 8, pos, width: cols === 3 ? 88 : 128, size: cols === 3 ? 21 : 26 };
}

function orderPuzzle(variant: Variant, d: Difficulty, rng: Rng): Puzzle | null {
  const n = OPTION_COUNT[d];
  const objs = sample(rng, THINGS, n).map((t) => t[0]);
  // objs[0] heaviest … objs[n-1] lightest
  const askHeavy = variant === 'heaviest' || (variant === 'chain' && chance(rng, 0.5));
  let pairs: Array<[number, number]>; // [heavier, lighter]
  if (variant === 'chain') {
    pairs = objs.slice(1).map((_, i) => [i, i + 1] as [number, number]);
  } else if (askHeavy) {
    // A is down against B and C, and C is down against D (so A shows up as often as C).
    pairs = [
      [0, 1],
      [0, 2],
      [2, 3],
    ];
  } else {
    // D is up against A and B, and B is up against C.
    pairs = [
      [0, 3],
      [1, 3],
      [2, 1],
    ];
  }
  pairs = shuffled(rng, pairs);
  const L = layout(pairs.length);
  const scales = pairs.map(([h, l], i) => {
    const heavyLeft = chance(rng, 0.5);
    const [x, y] = L.pos[i];
    return heavyLeft
      ? scaleAt(x, y, L.width, [objs[h]], [objs[l]], -1, L.size, `s${i}`)
      : scaleAt(x, y, L.width, [objs[l]], [objs[h]], 1, L.size, `s${i}`);
  });
  const visual: VisualSpec = spec(L.w, L.h, scales, `Balance scales comparing ${objs.map((o) => nameOf(o)).join(', ')}.`);
  const ansIdx = askHeavy ? 0 : n - 1;
  const ans = objs[ansIdx];
  const wrong = objs
    .map((o, i) => ({ o, i }))
    .filter((x) => x.i !== ansIdx)
    .map(({ o, i }) => ({
      text: o,
      why: askHeavy
        ? i === 1 && variant === 'chain'
          ? `${o} is heavy, but ${ans} pushes it up`
          : `${ans} is heavier than ${o}`
        : `${o} is lighter… but ${ans} is lighter still`,
    }));
  const answer = finalizeChoice(rng, { text: ans }, wrong);
  const word = askHeavy ? 'heaviest' : 'lightest';
  return {
    id: puzzleId('balance', d, `${variant}|${askHeavy}|${objs.join('')}|${pairs.join('/')}`),
    family: 'balance',
    difficulty: d,
    prompt: `Which one is the ${word}?`,
    visual,
    answer,
    explanation: [
      { text: 'The heavier side goes DOWN. The lighter side goes UP.', visual },
      variant === 'chain'
        ? { text: `Follow the chain: ${objs.join(' > ')} (heavier first).` }
        : { text: askHeavy ? `${ans} goes down on every scale it is on. Nothing beats it.` : `${ans} goes up on every scale it is on.` },
      { text: `So the ${word} is ${ans}.` },
    ],
    rule: variant === 'chain' ? `order: ${objs.join(' > ')}` : `${ans} is the ${word}`,
    variant,
  };
}

function ratioPuzzle(variant: Variant, d: Difficulty, rng: Rng): Puzzle | null {
  const objs = sample(rng, THINGS, 3).map((t) => t[0]);
  const [small, mid, big] = objs;
  let scales: ScaleNode[];
  let answerVal: number;
  let ask: { n: number; of: string; unit: string };
  let explain: string[];
  let pool: Candidate[];
  if (variant === 'how-many') {
    const k = randInt(rng, 2, 4);
    const m = randInt(rng, 2, 3);
    scales = [scaleAt(100, 30, 128, [mid], Array(k).fill(small), 0, 24, 's0')];
    answerVal = k * m;
    ask = { n: m, of: mid, unit: small };
    explain = [`One ${mid} weighs the same as ${k} ${small}.`, `${m} ${mid} is ${m} groups of ${k}.`, `${m} × ${k} = ${answerVal} ${small}.`];
    pool = [
      { v: k, why: `That balances ONE ${mid}` },
      { v: k + m, why: `${m} groups of ${k}, not ${k} + ${m}` },
      { v: answerVal + 1, why: `${m} × ${k} = ${answerVal}` },
      { v: answerVal - 1, why: `${m} × ${k} = ${answerVal}` },
      { v: answerVal + k, why: `Only ${m} ${mid}` },
    ];
  } else {
    const a = randInt(rng, 2, 4);
    const b = randInt(rng, 2, 3);
    const flip = chance(rng, 0.5);
    scales = [
      scaleAt(100, 30, 128, flip ? Array(a).fill(small) : [mid], flip ? [mid] : Array(a).fill(small), 0, 22, 's0'),
      scaleAt(300, 30, 128, flip ? [big] : Array(b).fill(mid), flip ? Array(b).fill(mid) : [big], 0, 22, 's1'),
    ];
    answerVal = a * b;
    ask = { n: 1, of: big, unit: small };
    explain = [`1 ${mid} = ${a} ${small}, and 1 ${big} = ${b} ${mid}.`, `Swap each ${mid} for ${a} ${small}.`, `${b} × ${a} = ${answerVal} ${small}.`];
    pool = [
      { v: a + b, why: `Each ${mid} is worth ${a} ${small} — multiply` },
      { v: a, why: `That balances one ${mid}, not one ${big}` },
      { v: b, why: `That is how many ${mid}, not ${small}` },
      { v: answerVal + a, why: `${b} × ${a} = ${answerVal}` },
      { v: answerVal - 1, why: `${b} × ${a} = ${answerVal}` },
      { v: answerVal + 1, why: `${b} × ${a} = ${answerVal}` },
    ];
  }
  const qy = variant === 'how-many' ? 26 : 140;
  const qx = variant === 'how-many' ? 300 : 200;
  const askNodes: VisualNode[] = [
    text(qx - 60, qy + 30, String(ask.n), { id: 'ask-n', size: 30 }),
    emoji(qx - 30, qy + 30, ask.of, 32, { id: 'ask-a' }),
    text(qx + 4, qy + 30, '=', { size: 30 }),
    text(qx + 36, qy + 30, '?', { size: 30, fill: 'purple' }),
    emoji(qx + 68, qy + 30, ask.unit, 32, { id: 'ask-b' }),
  ];
  const visual = spec(400, variant === 'how-many' ? 128 : 196, [...scales, ...askNodes], 'Level scales and a question.');
  const keypad = d === 3 && chance(rng, 0.5);
  const answer: AnswerSpec = keypad ? { kind: 'number', answer: answerVal } : numberOptions(rng, answerVal, pool, OPTION_COUNT[d], { min: 1, max: 40 });
  const plural = nameOf(ask.unit, true);
  return {
    id: puzzleId('balance', d, `${variant}|${objs.join('')}|${JSON.stringify(scales.map((s) => [s.left.length, s.right.length]))}|${ask.n}`),
    family: 'balance',
    difficulty: d,
    prompt: `How many ${ask.unit} weigh the same as ${ask.n} ${ask.of}?`,
    speak: `How many ${plural} weigh the same as ${ask.n === 1 ? `one ${nameOf(ask.of)}` : `${ask.n} ${nameOf(ask.of, true)}`}?`,
    visual,
    answer,
    explanation: [{ text: 'A level scale means both sides weigh the same.', visual }, ...explain.map((t) => ({ text: t }))],
    rule: explain[explain.length - 1],
    variant,
  };
}

function generate(d: Difficulty, rng: Rng): Puzzle {
  for (let tries = 0; tries < 200; tries++) {
    const variant = pick(rng, BY_D[d]);
    const p = variant === 'how-many' || variant === 'ratio' ? ratioPuzzle(variant, d, rng) : orderPuzzle(variant, d, rng);
    if (p && validate(p).length === 0) return p;
  }
  throw new Error('balance: generator stuck');
}

// ---------------------------------------------------------------------------------------------
// Independent validator
// ---------------------------------------------------------------------------------------------

function chars(nodes: VisualNode[]): string[] {
  const out: string[] = [];
  walk(nodes, (n) => {
    if (n.t === 'emoji') out.push(n.char);
  });
  return out;
}

function validate(p: Puzzle): string[] {
  const scales = p.visual.nodes.filter((n): n is ScaleNode => n.t === 'scale');
  if (!scales.length) return ['no scales'];
  const sc = scales.map((s) => ({ L: chars(s.left), R: chars(s.right), tilt: s.tilt }));
  const objs = [...new Set(sc.flatMap((s) => [...s.L, ...s.R]))];
  const isOrder = /heaviest|lightest/.test(p.prompt);
  if (isOrder) {
    // heavier[a] = set of things a is heavier than (transitive closure).
    const gt = new Map<string, Set<string>>(objs.map((o) => [o, new Set<string>()]));
    for (const s of sc) {
      if (s.L.length !== 1 || s.R.length !== 1 || s.tilt === 0) return ['order scales must be one-to-one and tilted'];
      const [h, l] = s.tilt === -1 ? [s.L[0], s.R[0]] : [s.R[0], s.L[0]];
      gt.get(h)!.add(l);
    }
    for (let k = 0; k < objs.length; k++)
      for (const a of objs) for (const b of [...gt.get(a)!]) for (const c of gt.get(b)!) gt.get(a)!.add(c);
    if (objs.some((o) => gt.get(o)!.has(o))) return ['contradiction'];
    const heavy = /heaviest/.test(p.prompt);
    const winners = objs.filter((o) => (heavy ? gt.get(o)!.size === objs.length - 1 : objs.every((x) => x === o || gt.get(x)!.has(o))));
    if (winners.length !== 1) return [`${winners.length} provable answers`];
    if (p.answer.kind !== 'choice') return ['order answers are choices'];
    const errs = checkTextChoice(p.answer, winners[0]);
    if (p.answer.options.some((o) => !objs.includes(o.text ?? ''))) errs.push('an option is not on the scales');
    return errs;
  }
  // Ratio: brute force weights.
  let askN = 0;
  let askA = '';
  let askB = '';
  walk(p.visual.nodes, (n) => {
    if (n.id === 'ask-n' && n.t === 'text') askN = Number(n.text);
    if (n.id === 'ask-a' && n.t === 'emoji') askA = n.char;
    if (n.id === 'ask-b' && n.t === 'emoji') askB = n.char;
  });
  const all = [...new Set([...objs, askA, askB])];
  if (all.length > 3 || !askN) return ['cannot read ratio question'];
  const answers = new Set<string>();
  const w = Array(all.length).fill(1);
  const at = (c: string) => w[all.indexOf(c)];
  const rec = (i: number) => {
    if (i === all.length) {
      const ok = sc.every((s) => {
        const l = s.L.reduce((a, c) => a + at(c), 0);
        const r = s.R.reduce((a, c) => a + at(c), 0);
        return s.tilt === 0 ? l === r : s.tilt === -1 ? l > r : r > l;
      });
      if (ok) answers.add(String((askN * at(askA)) / at(askB)));
      return;
    }
    for (let v = 1; v <= 24; v++) {
      w[i] = v;
      rec(i + 1);
    }
  };
  rec(0);
  if (answers.size !== 1) return [`ratio ambiguous: ${[...answers].slice(0, 4).join(',')}`];
  const ans = Number([...answers][0]);
  if (!Number.isInteger(ans)) return ['ratio is not whole'];
  if (p.answer.kind === 'number') return p.answer.answer === ans ? [] : [`keypad ${p.answer.answer} ≠ ${ans}`];
  if (p.answer.kind !== 'choice') return ['unexpected answer kind'];
  return checkTextChoice(p.answer, String(ans));
}

export const balance: PuzzleFamily = {
  id: 'balance',
  title: 'Balance Scales',
  emoji: '⚖️',
  group: 'logic',
  variants: VARIANTS,
  generate,
  validate,
};
