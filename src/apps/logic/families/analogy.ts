/**
 * analogy — "A is to B as C is to ?" (docs/GEO-LOGIC.md §E.6).
 * Picture analogies: one change (easy), harder changes (medium), two changes at once (hard), plus
 * picture-word analogies (🐰 → 🥕 as 🐒 → ?) from a curated table.
 * The change only ever touches attributes where C looks like A, so "make it like B" and
 * "change it the same way" always agree — one honest answer.
 * Validator: reads A, B, C and every option back; derives the A→B change; applies it to C; exactly
 * one option equals the result.
 */
import type { ChoiceOption, Color, Difficulty, FillPattern, Puzzle, PuzzleFamily, Rng, ShapeKind, VisualNode, VisualSpec } from '../engine/types';
import { COLORS } from '../engine/types';
import { OPTION_COUNT } from '../engine/types';
import { chance, pick, puzzleId, randInt, sample, shuffled } from '../engine/rng';
import { checkTextChoice, emoji, finalizeChoice, line, spec, text, walk } from './kit';
import type { Figure, SeenFigure, SizeClass } from './figures';
import { figureSpec, readFigure, renderFigure } from './figures';

const VARIANTS = ['colour', 'size', 'add-one', 'turn', 'fill', 'double', 'two-changes', 'pictures'] as const;
type Variant = (typeof VARIANTS)[number];

const BY_D: Record<Difficulty, Variant[]> = {
  1: ['colour', 'size', 'add-one', 'pictures'],
  2: ['turn', 'fill', 'double', 'pictures', 'colour'],
  3: ['two-changes', 'turn', 'double'],
};

type Attr = 'color' | 'size' | 'count' | 'rot' | 'pattern';
const KINDS: ShapeKind[] = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'hexagon', 'pentagon'];
const TURNERS: ShapeKind[] = ['L', 'arrow', 'right-triangle', 'semicircle', 'moon', 'trapezoid'];

/** Curated picture relations: every pair in a relation is "X goes with Y" the same way. */
const RELATIONS: Array<{ name: string; pairs: Array<[string, string]> }> = [
  {
    name: 'what it eats',
    pairs: [
      ['🐰', '🥕'],
      ['🐒', '🍌'],
      ['🐭', '🧀'],
      ['🐶', '🦴'],
      ['🐼', '🎋'],
      ['🐝', '🌸'],
      ['🐿️', '🌰'],
      ['🐄', '🌾'],
    ],
  },
  {
    name: 'baby and grown-up',
    pairs: [
      ['🐣', '🐔'],
      ['🐛', '🦋'],
      ['🌱', '🌳'],
      ['👶', '🧑'],
    ],
  },
  {
    name: 'what you use it with',
    pairs: [
      ['✏️', '📄'],
      ['🔑', '🔒'],
      ['⚽', '🥅'],
      ['🧦', '👟'],
      ['🥄', '🥣'],
      ['🖌️', '🎨'],
    ],
  },
  {
    name: 'weather and what you need',
    pairs: [
      ['🌧️', '☂️'],
      ['☀️', '🕶️'],
      ['❄️', '🧤'],
    ],
  },
  {
    name: 'where it lives',
    pairs: [
      ['🐟', '🌊'],
      ['🐦', '🪺'],
      ['🐫', '🏜️'],
      ['🐧', '🧊'],
    ],
  },
];

/**
 * Wrong picture options a child could reasonably defend for this C (a rabbit does eat grass, a
 * penguin does live in the sea…). They are never offered when C is that picture.
 */
const ALSO_FITS: Record<string, string[]> = {
  '🐰': ['🌾', '🌸'],
  '🐭': ['🌾', '🌰', '🥕'],
  '🐿️': ['🌾', '🍌', '🌸'],
  '🐒': ['🌰', '🌸'],
  '🐄': ['🥕', '🌸'],
  '🐶': ['🧀'],
  '🐧': ['🌊'],
  '🐟': ['🧊'],
  '🐦': ['🌾', '🌳', '🌸'],
  '🐣': ['🪺', '🌾'],
  '❄️': ['🕶️'],
  '☀️': ['☂️'],
  '🌱': ['🌸'],
};

/** Colours too close to tell apart on a small phone tile (or for colour-blind eyes). */
const CLOSE: Partial<Record<Color, Color>> = { yellow: 'orange', orange: 'yellow', blue: 'purple', purple: 'blue' };

const base = (o: Partial<Figure> = {}): Figure => ({ kind: 'circle', color: 'blue', size: 1, pattern: 'solid', rot: 0, flip: false, count: 1, ...o });

function otherValue(attr: Attr, cur: Figure, rng: Rng, avoid: Array<Figure[Attr]> = []): Figure[Attr] {
  const pool: Array<Figure[Attr]> =
    attr === 'color'
      ? [...COLORS]
      : attr === 'size'
        ? ([0, 1, 2] as SizeClass[])
        : attr === 'count'
          ? [1, 2, 3, 4]
          : attr === 'rot'
            ? [0, 90, 180, 270]
            : (['solid', 'empty', 'striped'] as FillPattern[]);
  const near = attr === 'color' ? [cur.color, ...(avoid as Color[])].map((c) => CLOSE[c]) : [];
  const opts = pool.filter((v) => v !== cur[attr] && !avoid.includes(v) && !near.includes(v as Color));
  return pick(rng, opts);
}

function changeFor(attr: Attr, a: Figure, rng: Rng, v: Variant): Figure[Attr] | null {
  switch (attr) {
    case 'color':
      return otherValue('color', a, rng);
    case 'size':
      return a.size === 2 ? 0 : a.size === 0 ? 2 : pick(rng, [0, 2] as SizeClass[]);
    case 'count':
      if (v === 'double') return a.count <= 2 ? a.count * 2 : null;
      return a.count < 4 ? a.count + 1 : null;
    case 'rot':
      return (a.rot + pick(rng, [90, 90, 180, 270])) % 360;
    case 'pattern':
      return a.pattern === 'solid' ? 'empty' : a.pattern === 'empty' ? 'solid' : 'solid';
  }
}

const SAY: Record<Attr, string> = { color: 'colour', size: 'size', count: 'number', rot: 'way it points', pattern: 'filling' };

function changeText(attr: Attr, a: Figure, b: Figure): string {
  if (attr === 'color') return `it turns ${b.color}`;
  if (attr === 'size') return b.size > a.size ? 'it gets bigger' : 'it gets smaller';
  if (attr === 'count') return b.count === a.count * 2 && a.count > 1 ? 'there are twice as many' : `${a.count} becomes ${b.count}`;
  if (attr === 'rot') return `it turns ${((b.rot - a.rot + 360) % 360) === 90 ? 'a quarter turn clockwise' : ((b.rot - a.rot + 360) % 360) === 180 ? 'upside down' : 'a quarter turn back'}`;
  return b.pattern === 'empty' ? 'it becomes empty' : 'it gets filled in';
}

function layout(a: VisualNode[], b: VisualNode[], c: VisualNode[], qId = 'Q'): VisualSpec {
  const g = (id: string, x: number, kids: VisualNode[]): VisualNode => ({ t: 'g', id, x, y: 0, children: kids });
  return spec(
    400,
    100,
    [
      g('A', 0, a),
      line(86, 50, 112, 50, { arrow: 'end', stroke: 'grey', strokeWidth: 3 }),
      g('B', 100, b),
      text(200, 50, 'as', { size: 18, fill: 'purple' }),
      g('C', 200, c),
      line(286, 50, 312, 50, { arrow: 'end', stroke: 'grey', strokeWidth: 3 }),
      { t: 'grid', id: qId, x: 312, y: 12, rows: 1, cols: 1, cell: 76, unknown: [{ r: 0, c: 0 }] },
    ],
    'A goes to B, as C goes to question mark.',
  );
}

function figurePuzzle(v: Variant, d: Difficulty, rng: Rng): Puzzle | null {
  const attrs: Attr[] =
    v === 'colour'
      ? ['color']
      : v === 'size'
        ? ['size']
        : v === 'add-one' || v === 'double'
          ? ['count']
          : v === 'turn'
            ? ['rot']
            : v === 'fill'
              ? ['pattern']
              : sample(rng, ['color', 'size', 'rot', 'pattern', 'count'] as Attr[], 2);
  // An empty shape shows no fill colour, so a colour change next to a fill change can be invisible.
  if (attrs.includes('color') && attrs.includes('pattern')) return null;
  const needsTurn = attrs.includes('rot');
  const kinds = sample(rng, needsTurn ? TURNERS : KINDS, 2);
  const a = base({
    kind: kinds[0],
    color: pick(rng, COLORS),
    size: attrs.includes('size') ? pick(rng, [0, 1, 2] as SizeClass[]) : 1,
    count: attrs.includes('count') ? (v === 'double' ? randInt(rng, 1, 2) : randInt(rng, 1, 3)) : 1,
    rot: needsTurn ? pick(rng, [0, 90, 180, 270]) : 0,
    pattern: attrs.includes('pattern') ? pick(rng, ['solid', 'empty'] as FillPattern[]) : 'solid',
  });
  if (attrs.includes('count') && attrs.includes('size')) a.size = 1;
  const b: Figure = { ...a };
  for (const at of attrs) {
    const nv = changeFor(at, a, rng, v);
    if (nv === null) return null;
    (b as unknown as Record<string, unknown>)[at] = nv;
  }
  // C: same as A on every changed attribute, different kind (and maybe colour if colour is not changing).
  const c: Figure = { ...a, kind: kinds[1] };
  if (!attrs.includes('color') && chance(rng, 0.7)) c.color = otherValue('color', a, rng) as Color;
  const ans: Figure = { ...c };
  for (const at of attrs) (ans as unknown as Record<string, unknown>)[at] = b[at];

  // Options: factorial over (kind: C's or a new one) × (each changed attr: B's value, A's value or a third).
  const altKind = pick(rng, (needsTurn ? TURNERS : KINDS).filter((k) => k !== c.kind && k !== a.kind)) ?? a.kind;
  const n = OPTION_COUNT[d];
  const dims: Array<{ name: string; vals: Array<{ apply: (f: Figure) => void; ok: boolean; why: string }> }> = [];
  for (const at of attrs) {
    const third = otherValue(at, { ...ans }, rng, [a[at]]);
    dims.push({
      name: at,
      vals: [
        { apply: (f) => ((f as unknown as Record<string, unknown>)[at] = b[at]), ok: true, why: '' },
        { apply: (f) => ((f as unknown as Record<string, unknown>)[at] = a[at]), ok: false, why: `The ${SAY[at]} should change too` },
        { apply: (f) => ((f as unknown as Record<string, unknown>)[at] = third), ok: false, why: `The ${SAY[at]} changes the same way as A to B` },
      ],
    });
  }
  dims.push({
    name: 'kind',
    vals: [
      { apply: (f) => (f.kind = c.kind), ok: true, why: '' },
      { apply: (f) => (f.kind = altKind), ok: false, why: `Keep C's shape` },
    ],
  });
  // Every combination, the answer first; then pick wrong ones (single slips first, mixed after).
  let combos: Array<Array<number>> = [[]];
  for (const dm of dims) combos = combos.flatMap((cmb) => dm.vals.map((_, i) => [...cmb, i]));
  const wrongCombos = shuffled(
    rng,
    combos.filter((cmb) => cmb.some((i) => i !== 0)),
  ).sort((x, y) => x.filter((i) => i !== 0).length - y.filter((i) => i !== 0).length);
  // Mix in some double slips so the answer is not the "most typical" option.
  const singles = wrongCombos.filter((cmb) => cmb.filter((i) => i !== 0).length === 1);
  const multis = wrongCombos.filter((cmb) => cmb.filter((i) => i !== 0).length > 1);
  const nMulti = Math.min(multis.length, Math.max(1, Math.floor((n - 1) / 2)));
  const chosen = [...shuffled(rng, singles).slice(0, n - 1 - nMulti), ...shuffled(rng, multis).slice(0, nMulti)];
  while (chosen.length < n - 1 && wrongCombos.length) {
    const nx = wrongCombos.find((w) => !chosen.includes(w));
    if (!nx) break;
    chosen.push(nx);
  }
  const wrong: ChoiceOption[] = chosen.map((cmb) => {
    const f: Figure = { ...ans };
    const whys: string[] = [];
    cmb.forEach((i, k) => {
      dims[k].vals[i].apply(f);
      if (!dims[k].vals[i].ok) whys.push(dims[k].vals[i].why);
    });
    return { visual: figureSpec(f), why: whys[0] ?? 'Not quite' };
  });
  if (wrong.length !== n - 1) return null;
  const nodesOf = (f: Figure) => renderFigure(f, 50, 50, 84);
  const visual = layout(nodesOf(a), nodesOf(b), nodesOf(c));
  const changes = attrs.map((at) => changeText(at, a, b));
  return {
    id: puzzleId('analogy', d, `${v}|${JSON.stringify([a, b, c])}`),
    family: 'analogy',
    difficulty: d,
    prompt: 'A is to B as C is to…?',
    speak: 'The first picture changes into the second. Change the third picture the same way. Which one is it?',
    visual,
    answer: finalizeChoice(rng, { visual: figureSpec(ans) }, wrong),
    explanation: [
      { text: 'What changed from the first picture to the second?', visual, highlight: ['A', 'B'] },
      { text: `From A to B, ${changes.join(' and ')}.` },
      { text: `Do the same to C: ${changes.join(' and ')}. Keep its shape!`, visual: figureSpec(ans) },
    ],
    rule: changes.join(' and '),
    variant: v,
  };
}

function picturePuzzle(d: Difficulty, rng: Rng): Puzzle | null {
  const rel = pick(rng, RELATIONS);
  if (rel.pairs.length < 2) return null;
  const [p1, p2] = sample(rng, rel.pairs, 2);
  const ans = p2[1];
  const n = OPTION_COUNT[d];
  const used = new Set([p1[0], p1[1], p2[0]]);
  const pool: Array<{ text: string; why: string }> = [];
  // Same relation, other pairs' answers (tempting); things from other relations.
  for (const [x, y] of shuffled(rng, rel.pairs)) if (y !== ans && !used.has(y)) pool.push({ text: y, why: `${y} goes with ${x}` });
  for (const r of shuffled(rng, RELATIONS)) {
    if (r === rel) continue;
    for (const [x, y] of shuffled(rng, r.pairs)) if (!used.has(y)) pool.push({ text: y, why: `${y} goes with ${x}` });
  }
  pool.unshift({ text: p1[1], why: `${p1[1]} goes with ${p1[0]}, not ${p2[0]}` });
  const seen = new Set([ans]);
  const wrong: ChoiceOption[] = [];
  for (const c of pool) {
    if (wrong.length >= n - 1) break;
    if (seen.has(c.text) || c.text === p2[0]) continue;
    // Never offer something that ALSO fits this relation for C.
    if (rel.pairs.some(([x, y]) => x === p2[0] && y === c.text)) continue;
    if (ALSO_FITS[p2[0]]?.includes(c.text)) continue;
    seen.add(c.text);
    wrong.push({ text: c.text, why: c.why });
  }
  const em = (c: string) => [emoji(50, 52, c, 60)];
  const visual = layout(em(p1[0]), em(p1[1]), em(p2[0]));
  return {
    id: puzzleId('analogy', d, `pictures|${p1.join('')}|${p2.join('')}`),
    family: 'analogy',
    difficulty: d,
    prompt: 'A is to B as C is to…?',
    speak: 'The first picture goes with the second. What goes with the third picture in the same way?',
    visual,
    answer: finalizeChoice(rng, { text: ans }, wrong),
    explanation: [
      { text: `How does ${p1[0]} go with ${p1[1]}?`, visual, highlight: ['A', 'B'] },
      { text: `It's ${rel.name}.` },
      { text: `So ${p2[0]} goes with ${ans}.` },
    ],
    rule: `${rel.name}: ${p1[0]}→${p1[1]}, ${p2[0]}→${ans}`,
    variant: 'pictures',
  };
}

function generate(d: Difficulty, rng: Rng): Puzzle {
  for (let tries = 0; tries < 300; tries++) {
    const v = pick(rng, BY_D[d]);
    const p = v === 'pictures' ? picturePuzzle(d, rng) : figurePuzzle(v, d, rng);
    if (p && validate(p).length === 0) return p;
  }
  throw new Error('analogy: generator stuck');
}

// ---------------------------------------------------------------------------------------------
// Independent validator
// ---------------------------------------------------------------------------------------------

function groupKids(s: VisualSpec, id: string): VisualNode[] {
  const g = s.nodes.find((n) => n.t === 'g' && n.id === id);
  return g && g.t === 'g' ? g.children : [];
}

const FIELDS: Array<keyof SeenFigure> = ['colors', 'pattern', 'size', 'rot', 'flip', 'count'];

function validate(p: Puzzle): string[] {
  if (p.answer.kind !== 'choice') return ['analogy is a choice'];
  const a = p.answer;
  if (p.variant === 'pictures') {
    const ch = (id: string) => {
      let c = '';
      walk(groupKids(p.visual, id), (n) => {
        if (n.t === 'emoji') c = n.char;
      });
      return c;
    };
    const [A, B, C] = [ch('A'), ch('B'), ch('C')];
    const rels = RELATIONS.filter((r) => r.pairs.some(([x, y]) => x === A && y === B));
    if (rels.length !== 1) return [`${rels.length} relations fit A→B`];
    const ys = rels[0].pairs.filter(([x]) => x === C).map(([, y]) => y);
    if (ys.length !== 1) return ['C has no single partner'];
    const errs = checkTextChoice(a, ys[0]);
    // No other option may ALSO be a partner of C in any relation (that would be a second answer).
    for (const o of a.options) if (o.text !== ys[0] && RELATIONS.some((r) => r.pairs.some(([x, y]) => x === C && y === o.text))) errs.push(`${o.text} also fits ${C}`);
    for (const o of a.options) if (o.text && ALSO_FITS[C]?.includes(o.text)) errs.push(`${o.text} could be defended for ${C}`);
    return errs;
  }
  // The figures are drawn in an 84-unit box (A/B/C) and a 100-unit box (options).
  const A = readFigure(groupKids(p.visual, 'A'), 84);
  const B = readFigure(groupKids(p.visual, 'B'), 84);
  const C = readFigure(groupKids(p.visual, 'C'), 84);
  const changed = FIELDS.filter((f) => A[f] !== B[f]);
  if (!changed.length) return ['A and B are the same'];
  if (A.kinds !== B.kinds) return ['A and B must be the same shape'];
  for (const f of changed) if (A[f] !== C[f]) return [`C differs from A in ${f}: the change would be ambiguous`];
  const expected: SeenFigure = { ...C };
  for (const f of changed) (expected as unknown as Record<string, unknown>)[f] = B[f];
  const seen = a.options.map((o) => (o.visual ? readFigure(o.visual.nodes, 100) : null));
  if (seen.some((s) => !s)) return ['options must be pictures'];
  const cmp = (s: SeenFigure) => s.kinds === expected.kinds && FIELDS.every((f) => s[f] === expected[f]);
  const keys = seen.map((s) => JSON.stringify(s));
  if (new Set(keys).size !== keys.length) return ['two options look the same'];
  const hits = seen.filter((s) => cmp(s!)).length;
  if (hits !== 1) return [`${hits} options match the change`];
  if (!cmp(seen[a.answerIndex]!)) return ['answerIndex is not the derived picture'];
  // Colour must never be the only, too-subtle difference between the answer and a wrong option.
  const ansSeen = seen[a.answerIndex]!;
  for (const s of seen) {
    if (s === ansSeen || s!.colors === ansSeen.colors) continue;
    const onlyColour = s!.kinds === ansSeen.kinds && FIELDS.every((f) => f === 'colors' || s![f] === ansSeen[f]);
    const c1 = ansSeen.colors.split('+')[0] as Color;
    const c2 = s!.colors.split('+')[0] as Color;
    if (onlyColour && CLOSE[c1] === c2) return [`answer and an option differ only by ${c1}/${c2}`];
  }
  return [];
}

export const analogy: PuzzleFamily = {
  id: 'analogy',
  title: 'Picture Pairs',
  emoji: '🔁',
  group: 'logic',
  variants: VARIANTS,
  generate,
  validate,
};
