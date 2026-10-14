/**
 * odd-one-out — "Which one does not belong?" (docs/GEO-LOGIC.md §E.6).
 * Easy: one attribute breaks the pattern while two others vary harmlessly (2 + 2, nothing unique).
 * Medium: a hidden property (number of sides, curvy or straight, how many, fill) with a colour
 * red herring — some OTHER item has the only-one-of-its-colour, so "pick the odd colour" fails.
 * Hard: relational rules (dots match the sides, the mirror image, a mixed pair).
 * Validator: reads every item back and, for every property it knows, finds an item that differs
 * while ALL the others agree. Exactly one item may be odd in that sense — the answer.
 */
import type { ChoiceOption, Difficulty, Puzzle, PuzzleFamily, Rng, ShapeKind } from '../engine/types';
import { COLORS, OPTION_COUNT } from '../engine/types';
import { pick, puzzleId, randInt, sample, shuffled } from '../engine/rng';
import { finalizeChoice } from './kit';
import type { Figure, SeenFigure, SizeClass } from './figures';
import { CURVY, SIDES, figureSpec, readFigure } from './figures';

const VARIANTS = ['colour', 'shape', 'size', 'count', 'sides', 'curvy', 'how-many', 'fill', 'dots-sides', 'mirror', 'pairs'] as const;
type Variant = (typeof VARIANTS)[number];

const BY_D: Record<Difficulty, Variant[]> = {
  1: ['colour', 'shape', 'size', 'count'],
  2: ['sides', 'curvy', 'how-many', 'fill'],
  3: ['dots-sides', 'mirror', 'pairs'],
};

const EASY_KINDS: ShapeKind[] = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'];
const FOUR: ShapeKind[] = ['square', 'diamond', 'rect', 'trapezoid', 'parallelogram'];
const NOT_FOUR: ShapeKind[] = ['triangle', 'right-triangle', 'pentagon', 'hexagon'];
const STRAIGHT: ShapeKind[] = ['square', 'triangle', 'star', 'diamond', 'pentagon', 'hexagon', 'cross'];
const POLY: ShapeKind[] = ['triangle', 'square', 'pentagon', 'hexagon', 'diamond', 'rect'];

const base = (o: Partial<Figure> = {}): Figure => ({ kind: 'circle', color: 'blue', size: 1, pattern: 'solid', rot: 0, flip: false, count: 1, ...o });

/**
 * A red herring: values for n items in groups 2+2(+1(+1)) where the answer never has a value of its
 * own (so "pick the only one that looks different" fails), and the singles sit on `singles` if given.
 */
function herring<T>(rng: Rng, pal: T[], n: number, answer: number, singles?: number[]): T[] {
  const groups = n === 4 ? [2, 2] : n === 5 ? [2, 2, 1] : [2, 2, 1, 1];
  for (let t = 0; t < 60; t++) {
    const p = shuffled(rng, pal);
    const slots = shuffled(
      rng,
      groups.flatMap((g, i) => Array(g).fill(p[i % p.length]) as T[]),
    );
    const cnt = (v: T) => slots.filter((x) => x === v).length;
    if (cnt(slots[answer]) < 2) continue;
    if (singles && !singles.every((i) => cnt(slots[i]) === 1)) continue;
    return slots;
  }
  return groups.flatMap((g, i) => Array(g).fill(pal[i % pal.length]) as T[]);
}

const herringColors = (rng: Rng, n: number, answer: number) => herring(rng, sample(rng, COLORS, 4), n, answer);

interface Built {
  items: Figure[];
  answer: number;
  rule: string;
  why: string;
  explain: string[];
}

function easy(v: Variant, rng: Rng): Built | null {
  // Z = the rule attribute; X, Y = two harmless attributes with values a,a,b,b across the items.
  const n = 4;
  const ans = randInt(rng, 0, n - 1);
  const zAttr = v === 'colour' ? 'color' : v === 'shape' ? 'kind' : v === 'size' ? 'size' : 'count';
  const harmless = shuffled(
    rng,
    (['color', 'kind', 'size', 'pattern'] as const).filter((a) => a !== zAttr && !(zAttr === 'count' && a === 'size')),
  ).slice(0, 2);
  const colors = sample(rng, COLORS, 3);
  const kinds = sample(rng, EASY_KINDS, 3);
  const vals = {
    color: colors,
    kind: kinds,
    size: shuffled(rng, [0, 1, 2] as SizeClass[]),
    pattern: shuffled(rng, ['solid', 'striped', 'dotted'] as const),
    count: shuffled(rng, [1, 2, 3]),
  };
  const others = [0, 1, 2, 3].filter((i) => i !== ans);
  // X/Y grid: others (a,p) (a,q) (b,p), odd (b,q).
  const xy: Array<[number, number]> = Array(n);
  const order = shuffled(rng, [
    [0, 0],
    [0, 1],
    [1, 0],
  ] as Array<[number, number]>);
  others.forEach((o, i) => (xy[o] = order[i]));
  xy[ans] = [1, 1];
  const items = [0, 1, 2, 3].map((i) => {
    const f = base({ size: zAttr === 'count' ? 1 : 1, count: 1 });
    const set = (attr: string, idx: number) => {
      (f as unknown as Record<string, unknown>)[attr] = (vals as Record<string, unknown[]>)[attr][idx];
    };
    set(harmless[0], xy[i][0]);
    set(harmless[1], xy[i][1]);
    set(zAttr, i === ans ? 1 : 0);
    return f;
  });
  if (zAttr === 'size' || harmless.includes('size')) items.forEach((f) => (f.count = 1));
  const word = { color: 'colour', kind: 'shape', size: 'size', count: 'number of shapes' }[zAttr];
  return {
    items,
    answer: ans,
    rule: `all the others have the same ${word}`,
    why: `Same ${word} as the others`,
    explain: [`Look at the ${word} of each one.`, `Three have the same ${word}. One is different!`],
  };
}

function medium(v: Variant, rng: Rng): Built | null {
  const n = 5;
  const ans = randInt(rng, 0, n - 1);
  const colors = herringColors(rng, n, ans);
  const single = colors.findIndex((c) => colors.filter((x) => x === c).length === 1);
  // A second herring on the same item: a size (or fill) nobody else has.
  const sizes = herring<SizeClass>(rng, [0, 1, 2], n, ans, [single]);
  let items: Figure[];
  let rule: string;
  let explain: string[];
  if (v === 'sides') {
    const four = sample(rng, FOUR, 4);
    const odd = pick(rng, NOT_FOUR);
    let k = 0;
    items = colors.map((c, i) => base({ kind: i === ans ? odd : four[k++], color: c, size: sizes[i] }));
    rule = 'all the others have 4 sides';
    explain = ['Count the sides of each shape.', `The others all have 4 sides. This one has ${SIDES[odd]}.`, 'The colours were a trick!'];
  } else if (v === 'curvy') {
    const odd = pick(rng, STRAIGHT);
    items = colors.map((c, i) => base({ kind: i === ans ? odd : pick(rng, CURVY), color: c, size: sizes[i] }));
    rule = 'all the others are curvy';
    explain = ['Run your finger round the edges.', 'The others are all curvy. This one has straight sides and corners.'];
  } else if (v === 'how-many') {
    const nn = randInt(rng, 2, 3);
    const kinds = sample(rng, EASY_KINDS, 5);
    const pats = herring(rng, ['solid', 'striped', 'dotted'] as const, n, ans, [single]);
    items = colors.map((c, i) => base({ kind: kinds[i], color: c, pattern: pats[i], count: i === ans ? (nn === 2 ? pick(rng, [1, 3]) : pick(rng, [2, 4])) : nn }));
    rule = `all the others have ${nn} shapes`;
    explain = ['Count the shapes in each box.', `The others all have ${nn}. This one doesn't.`];
  } else {
    const pat = pick(rng, ['striped', 'dotted'] as const);
    const oddPat = pick(rng, ['solid', 'empty'] as const);
    const kinds = sample(rng, EASY_KINDS, 5);
    items = colors.map((c, i) => base({ kind: kinds[i], color: c, size: sizes[i], pattern: i === ans ? oddPat : pat }));
    rule = `all the others are ${pat}`;
    explain = ['Look at how each shape is filled in.', `The others are all ${pat}. This one is ${oddPat === 'solid' ? 'filled in' : 'empty'}.`];
  }
  return { items, answer: ans, rule, why: 'This one follows the rule', explain };
}

function hard(v: Variant, rng: Rng): Built | null {
  const n = 6;
  const ans = randInt(rng, 0, n - 1);
  const colors = herringColors(rng, n, ans);
  let items: Figure[];
  let rule: string;
  let explain: string[];
  if (v === 'dots-sides') {
    items = colors.map((c, i) => {
      const kind = pick(rng, POLY);
      const sides = SIDES[kind]!;
      const dots = i === ans ? sides + pick(rng, [-1, 1]) : sides;
      return base({ kind, color: c, size: 2, dots, pattern: 'empty' });
    });
    rule = 'the others have as many dots as sides';
    explain = ['Count the sides. Then count the dots.', 'In the others, dots = sides. In this one they are different.'];
  } else if (v === 'mirror') {
    const flipOdd = pick(rng, [true, false]);
    items = colors.map((c, i) => base({ kind: 'L', color: c, rot: pick(rng, [0, 90, 180, 270]), flip: i === ans ? flipOdd : !flipOdd }));
    if (new Set(items.filter((_, i) => i !== ans).map((f) => f.rot)).size < 2) return null;
    rule = 'the others are the same L, just turned';
    explain = ['Turn each L in your head until it stands up.', 'The others all turn into the same L. This one is its mirror image!'];
  } else {
    items = colors.map((c, i) => {
      const k = pick(rng, EASY_KINDS);
      const k2 = i === ans ? pick(rng, EASY_KINDS.filter((x) => x !== k)) : k;
      return base({ kind: k, kind2: k2, color: c, color2: pick(rng, COLORS), count: 2 });
    });
    rule = 'the others have two of the same shape';
    explain = ['Look at the two shapes in each box.', 'In the others both shapes match. This one has two different shapes.'];
  }
  return { items, answer: ans, rule, why: 'This one follows the rule', explain };
}

function generate(d: Difficulty, rng: Rng): Puzzle {
  for (let tries = 0; tries < 300; tries++) {
    const variant = pick(rng, BY_D[d]);
    const b = d === 1 ? easy(variant, rng) : d === 2 ? medium(variant, rng) : hard(variant, rng);
    if (!b) continue;
    const specs = b.items.map((f) => figureSpec(f));
    const wrong: ChoiceOption[] = specs.filter((_, i) => i !== b.answer).map((s) => ({ visual: s, why: b.why }));
    const answer = finalizeChoice(rng, { visual: specs[b.answer] }, wrong);
    const p: Puzzle = {
      id: puzzleId('odd-one-out', d, `${variant}|${JSON.stringify(b.items)}`),
      family: 'odd-one-out',
      difficulty: d,
      prompt: 'Which one does not belong?',
      speak: "Which one doesn't belong with the others?",
      visual: { w: 400, h: 60, nodes: [{ t: 'text', x: 200, y: 30, text: '🤔 One of these is different…', size: 22 }], label: 'Look at the boxes below.' },
      answer,
      explanation: [...b.explain.map((t) => ({ text: t })), { text: `Rule: ${b.rule}.` }].slice(0, 4),
      rule: b.rule,
      variant,
    };
    if (validate(p).length === 0) return p;
  }
  throw new Error('odd-one-out: generator stuck');
}

// ---------------------------------------------------------------------------------------------
// Independent validator
// ---------------------------------------------------------------------------------------------

const PROPS: Array<[string, (f: SeenFigure) => string]> = [
  ['kind', (f) => f.kinds],
  ['colour', (f) => f.colors],
  ['fill', (f) => f.pattern],
  ['size', (f) => String(f.size)],
  ['count', (f) => String(f.count)],
  ['dots', (f) => String(f.dots)],
  ['sides', (f) => String(f.sides)],
  ['curvy', (f) => String(f.curvy)],
  ['turn', (f) => String(f.rot)],
  ['mirror', (f) => f.chirality],
  ['pair', (f) => String(f.pairSame)],
  ['dots=sides', (f) => String(f.dots > 0 && f.dots === f.sides)],
  // Kind of outline across every shape in the box (3-sided, 4-sided, curvy, star…): catches a pair
  // box that is the only one made of triangles while the rest are all 4-sided.
  [
    'side-family',
    (f) =>
      [...new Set(f.kinds.split('+').map((k) => String(SIDES[k as ShapeKind] ?? (CURVY.includes(k as ShapeKind) ? 'curvy' : k))))]
        .sort()
        .join('+'),
  ],
];

/** Indexes of items that are "odd" under some property (differs while all others agree). */
export function oddItems(figs: SeenFigure[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [name, fn] of PROPS) {
    const vals = figs.map(fn);
    for (let i = 0; i < vals.length; i++) {
      const rest = vals.filter((_, j) => j !== i);
      if (rest.every((v) => v === rest[0]) && vals[i] !== rest[0]) out.set(i, [...(out.get(i) ?? []), name]);
    }
  }
  return out;
}

function validate(p: Puzzle): string[] {
  if (p.answer.kind !== 'choice') return ['odd-one-out is a choice'];
  const a = p.answer;
  if (a.options.length !== OPTION_COUNT[p.difficulty]) return ['wrong option count'];
  if (a.options.some((o) => !o.visual)) return ['options must be pictures'];
  const figs = a.options.map((o) => readFigure(o.visual!.nodes));
  const keys = figs.map((f) => JSON.stringify(f));
  if (new Set(keys).size !== keys.length) return ['two items look the same'];
  const odd = oddItems(figs);
  if (odd.size !== 1) return [`${odd.size} items could be the odd one (${[...odd].map(([i, ps]) => `${i}:${ps.join('/')}`).join(' ')})`];
  const [idx] = [...odd.keys()];
  if (idx !== a.answerIndex) return ['answerIndex is not the odd item'];
  return [];
}

export const oddOneOut: PuzzleFamily = {
  id: 'odd-one-out',
  title: 'Odd One Out',
  emoji: '🕵️',
  group: 'logic',
  variants: VARIANTS,
  generate,
  validate,
};
