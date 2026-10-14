/**
 * seq-shape — "What comes next?" A row of pictures where each attribute (look, shape, size, turn,
 * count) follows its own simple rule; the child picks the next picture.
 */
import type { Difficulty, ExplainStep, Puzzle, PuzzleFamily, Rng, ShapeKind, VisualNode } from '../../engine/types';
import { OPTION_COUNT } from '../../engine/types';
import { grid, KIND_NAME, KINDS_ALL, KINDS_EASY, pick, randInt, sample, shuffle, spec } from '../../engine/shapes';
import { byId, checkVisualChoice, choice, clip, finish, generateValid, pickWrongFair, type Wrong } from './common';
import { predictions, uniqueNext } from './infer';
import { drawTerm, LOOKS, lookKey, lookOf, lookWord, MID, readTerm, SIZE_WORD, termWord, TURN_KINDS, type Term } from './term';

const ID = 'seq-shape' as const;
const OPT_K = 1.6;

type Attr = 'kind' | 'look' | 'size' | 'rot' | 'count';
const ATTRS: Attr[] = ['kind', 'look', 'size', 'rot', 'count'];
const NUMERIC: Record<Attr, boolean> = { kind: false, look: false, size: true, rot: true, count: true };

const VARIANTS: Record<Difficulty, string[]> = {
  1: ['look-ab', 'look-abc', 'shape-ab', 'shape-abc', 'shape-aab'],
  2: ['two-cycles', 'size-grow', 'size-shrink', 'aabb', 'look-shape-ab'],
  3: ['turn', 'count-grow', 'abba', 'turn-shape', 'three-way'],
};

/** A cycle pattern of indices, e.g. [0,1] = ABAB, [0,0,1] = AAB, [0,1,1,0] = ABBA. */
const cycleVals = <T>(motif: number[], vals: T[], n: number): T[] => Array.from({ length: n }, (_, i) => vals[motif[i % motif.length]]);

interface Plan {
  variant: string;
  terms: Term[]; // shown + the answer last
  shown: number;
  varying: Attr[];
  rule: string;
}

const plan = (d: Difficulty, rng: Rng): Plan => {
  const variant = pick(VARIANTS[d], rng);
  const base: Term = { kind: pick(d === 1 ? KINDS_EASY : KINDS_ALL, rng), look: pick(LOOKS, rng), size: MID, rot: 0, count: 1 };
  const looks = sample(LOOKS, 3, rng);
  const kinds = sample(d === 1 ? [...KINDS_EASY, 'heart', 'diamond'] as ShapeKind[] : KINDS_ALL, 3, rng);
  const mk = (n: number, f: (i: number) => Partial<Term>): Term[] => Array.from({ length: n }, (_, i) => ({ ...base, ...f(i) }));
  switch (variant) {
    case 'look-ab': {
      const shown = randInt(5, 6, rng);
      const v = cycleVals([0, 1], looks, shown + 1);
      return { variant, terms: mk(shown + 1, (i) => ({ look: v[i] })), shown, varying: ['look'], rule: 'colours repeat A B A B' };
    }
    case 'look-abc': {
      const shown = randInt(5, 6, rng);
      const v = cycleVals([0, 1, 2], looks, shown + 1);
      return { variant, terms: mk(shown + 1, (i) => ({ look: v[i] })), shown, varying: ['look'], rule: 'colours repeat A B C' };
    }
    case 'shape-ab': {
      const shown = randInt(5, 6, rng);
      const v = cycleVals([0, 1], kinds, shown + 1);
      return { variant, terms: mk(shown + 1, (i) => ({ kind: v[i] })), shown, varying: ['kind'], rule: 'shapes repeat A B A B' };
    }
    case 'shape-abc': {
      const shown = randInt(5, 6, rng);
      const v = cycleVals([0, 1, 2], kinds, shown + 1);
      return { variant, terms: mk(shown + 1, (i) => ({ kind: v[i] })), shown, varying: ['kind'], rule: 'shapes repeat A B C' };
    }
    case 'shape-aab': {
      const shown = randInt(5, 7, rng);
      const v = cycleVals(pick([[0, 0, 1], [0, 1, 1]], rng), kinds, shown + 1);
      return { variant, terms: mk(shown + 1, (i) => ({ kind: v[i] })), shown, varying: ['kind'], rule: 'shapes repeat in threes' };
    }
    case 'two-cycles': {
      const shown = 6;
      const lv = cycleVals([0, 1], looks, shown + 1);
      const kv = cycleVals([0, 1, 2], kinds, shown + 1);
      return {
        variant,
        terms: mk(shown + 1, (i) => ({ look: lv[i], kind: kv[i] })),
        shown,
        varying: ['look', 'kind'],
        rule: 'colours repeat in twos, shapes in threes',
      };
    }
    case 'look-shape-ab': {
      const shown = 6;
      const lv = cycleVals([0, 1, 2], looks, shown + 1);
      const kv = cycleVals([0, 1], kinds, shown + 1);
      return {
        variant,
        terms: mk(shown + 1, (i) => ({ look: lv[i], kind: kv[i] })),
        shown,
        varying: ['look', 'kind'],
        rule: 'colours repeat in threes, shapes in twos',
      };
    }
    case 'size-grow':
    case 'size-shrink': {
      const shown = 4;
      const start = randInt(0, 1, rng);
      const sizes = Array.from({ length: shown + 1 }, (_, i) => start + i);
      if (variant === 'size-shrink') sizes.reverse();
      const lv = cycleVals([0, 1], looks, shown + 1);
      const withLook = rng() < 0.6;
      return {
        variant,
        terms: mk(shown + 1, (i) => ({ size: sizes[i], ...(withLook ? { look: lv[i] } : {}) })),
        shown,
        varying: withLook ? ['size', 'look'] : ['size'],
        rule: variant === 'size-grow' ? 'gets bigger each time' : 'gets smaller each time',
      };
    }
    case 'aabb': {
      const shown = 6;
      const kv = cycleVals([0, 0, 1, 1], kinds, shown + 1);
      return { variant, terms: mk(shown + 1, (i) => ({ kind: kv[i] })), shown, varying: ['kind'], rule: 'shapes go A A B B' };
    }
    case 'abba': {
      const shown = 7;
      const kv = cycleVals([0, 1, 1, 0], kinds, shown + 1);
      const lv = cycleVals([0, 1], looks, shown + 1);
      const withLook = rng() < 0.5;
      return {
        variant,
        terms: mk(shown + 1, (i) => ({ kind: kv[i], ...(withLook ? { look: lv[i] } : {}) })),
        shown,
        varying: withLook ? ['kind', 'look'] : ['kind'],
        rule: withLook ? 'shapes go A B B A, colours A B' : 'shapes go A B B A',
      };
    }
    case 'turn':
    case 'turn-shape': {
      const step = pick([45, 90, -90, -45], rng);
      const shown = 5;
      const start = pick([0, 90, 180, 270], rng);
      const kind = pick(TURN_KINDS, rng);
      const lv = cycleVals(pick([[0, 1], [0, 1, 2]], rng), looks, shown + 1);
      const rot = (i: number) => (((start + i * step) % 360) + 360) % 360;
      if (variant === 'turn')
        return {
          variant,
          terms: mk(shown + 1, (i) => ({ kind, rot: rot(i), look: lv[i] })),
          shown,
          varying: ['rot', 'look'],
          rule: `turns ${Math.abs(step) === 90 ? 'a quarter' : 'an eighth'} ${step > 0 ? 'clockwise' : 'anticlockwise'} each time`,
        };
      const kv = cycleVals([0, 1], sample(TURN_KINDS, 2, rng), shown + 1);
      return {
        variant,
        terms: mk(shown + 1, (i) => ({ kind: kv[i], rot: rot(i) })),
        shown,
        varying: ['rot', 'kind'],
        rule: `shapes A B and each one turns ${Math.abs(step)}°`,
      };
    }
    case 'count-grow': {
      const shown = 4;
      const start = randInt(1, 2, rng);
      const kv = cycleVals([0, 1], kinds, shown + 1);
      return {
        variant,
        terms: mk(shown + 1, (i) => ({ count: start + i, kind: kv[i], size: -1 })),
        shown,
        varying: ['count', 'kind'],
        rule: 'one more each time, shapes A B',
      };
    }
    default: {
      // three-way: look period 2, shape period 3, size A B (period 2 on a different phase)
      const shown = 6;
      const lv = cycleVals([0, 1], looks, shown + 1);
      const kv = cycleVals([0, 1, 2], kinds, shown + 1);
      const sv = cycleVals([0, 0, 1], [MID - 1, MID + 1], shown + 1);
      return {
        variant: 'three-way',
        terms: mk(shown + 1, (i) => ({ look: lv[i], kind: kv[i], size: sv[i] })),
        shown,
        varying: ['look', 'kind', 'size'],
        rule: 'colours in twos, shapes in threes, sizes small small big',
      };
    }
  }
};

const layout = (shown: number) => {
  const slot = Math.min(64, Math.floor(396 / (shown + 1)));
  const w = slot * (shown + 1) + 4;
  return { slot, w, h: 80, cy: 40 };
};

const optionVisual = (t: Term) => spec(100, 100, [drawTerm(t, 50, 50, OPT_K)], termWord(t, ['count', 'size']));

const valueOf = (t: Term, a: Attr): string => (a === 'look' ? lookKey(t.look) : String(t[a]));
const withValue = (t: Term, a: Attr, v: string): Term => {
  switch (a) {
    case 'look':
      return { ...t, look: lookOf(v) };
    case 'kind':
      return { ...t, kind: v as ShapeKind };
    default:
      return { ...t, [a]: Number(v) };
  }
};

const ATTR_WORDS: Record<Attr, string> = { kind: 'shapes', look: 'colours', size: 'sizes', rot: 'turns', count: 'how many' };

const describeValues = (terms: Term[], a: Attr): string => {
  const vals = terms.map((t) =>
    a === 'look' ? lookWord(t.look) : a === 'kind' ? KIND_NAME[t.kind] : a === 'size' ? SIZE_WORD[t.size] : a === 'count' ? String(t.count) : `${t.rot}°`,
  );
  return vals.slice(0, 5).join(', ') + (vals.length > 5 ? '…' : '');
};

const attempt = (d: Difficulty, rng: Rng): Puzzle | null => {
  const pl = plan(d, rng);
  const shownTerms = pl.terms.slice(0, pl.shown);
  const ans = pl.terms[pl.shown];
  const last = shownTerms[shownTerms.length - 1];
  const { slot, w, h, cy } = layout(pl.shown);
  const nodes: VisualNode[] = shownTerms.map((t, i) => drawTerm(t, 2 + slot * (i + 0.5), cy, slot / 64, `t${i}`));
  nodes.push(grid(2 + slot * pl.shown + 4, cy - (slot - 8) / 2, 1, 1, slot - 8, { id: 'q', unknown: [{ r: 0, c: 0 }] }));
  const visual = spec(w, h, nodes, `Sequence: ${shownTerms.map((t) => termWord(t, pl.varying)).join(', ')}, then what?`);

  // Distractors: one rule broken each.
  const pool: Wrong[] = [];
  const usedKindsAll = new Set(pl.terms.map((t) => t.kind));
  const usedLooksAll = new Set(pl.terms.map((t) => lookKey(t.look)));
  for (const a of shuffle(pl.varying, rng)) {
    const seen = [...new Set(pl.terms.map((t) => valueOf(t, a)))];
    if (a === 'size' || a === 'count') {
      pool.push({ visual: optionVisual(withValue(ans, a, valueOf(last, a))), why: `the ${ATTR_WORDS[a]} did not change` });
      const step = Number(valueOf(ans, a)) - Number(valueOf(last, a));
      const skip = Number(valueOf(ans, a)) + step;
      if (a === 'size' ? skip >= 0 && skip <= 5 : skip >= 1 && skip <= 6)
        pool.push({ visual: optionVisual(withValue(ans, a, String(skip))), why: 'it jumped two steps' });
      const back = Number(valueOf(last, a)) - step;
      if (a === 'size' ? back >= 0 && back <= 5 : back >= 1 && back <= 6)
        pool.push({ visual: optionVisual(withValue(ans, a, String(back))), why: 'it went the wrong way' });
    } else if (a === 'rot') {
      pool.push({ visual: optionVisual({ ...ans, rot: last.rot }), why: 'it did not turn' });
      const step = (ans.rot - last.rot + 360) % 360;
      pool.push({ visual: optionVisual({ ...ans, rot: (last.rot - step + 360) % 360 }), why: 'it turned the wrong way' });
      pool.push({ visual: optionVisual({ ...ans, rot: (ans.rot + step) % 360 }), why: 'it turned too far' });
    } else {
      for (const v of shuffle(seen, rng))
        if (v !== valueOf(ans, a))
          pool.push({ visual: optionVisual(withValue(ans, a, v)), why: `the ${ATTR_WORDS[a]} break the pattern` });
    }
  }
  // Double slips (two things wrong at once), so the answer is not just "the option most like the
  // others"; and for growing/shrinking sizes an overshoot, so the answer is not the biggest/smallest.
  const alt = (a: Attr): string | null => {
    if (a === 'size' || a === 'count') return valueOf(last, a);
    if (a === 'rot') return String(last.rot);
    const vs = [...new Set(pl.terms.map((t) => valueOf(t, a)))].filter((v) => v !== valueOf(ans, a));
    return vs.length ? pick(vs, rng) : null;
  };
  const extra: Attr[] = ['kind', 'look'];
  for (const a1 of pl.varying)
    for (const a2 of [...pl.varying, ...extra]) {
      if (a1 >= a2 && pl.varying.includes(a2)) continue;
      if (a1 === a2) continue;
      const v1 = alt(a1);
      let v2 = alt(a2);
      if (v2 === null && a2 === 'kind') v2 = pick(KINDS_ALL.filter((k) => !usedKindsAll.has(k)), rng);
      if (v2 === null && a2 === 'look') v2 = lookKey(pick(LOOKS.filter((l) => !usedLooksAll.has(lookKey(l))), rng));
      if (v1 === null || v2 === null) continue;
      pool.push({ visual: optionVisual(withValue(withValue(ans, a1, v1), a2, v2)), why: `the ${ATTR_WORDS[a1]} and the ${ATTR_WORDS[a2]} break the pattern` });
    }
  for (const a of pl.varying)
    if (a === 'size') {
      const step = ans.size - last.size;
      const over = ans.size + 2 * step;
      if (step !== 0 && over >= 0 && over <= 5) pool.unshift({ visual: optionVisual({ ...ans, size: over }), why: 'it jumped too far' });
    }
  pool.push({ visual: optionVisual(last), why: 'that is the one before' });
  if (pl.shown >= 2) pool.push({ visual: optionVisual(shownTerms[pl.shown - 2]), why: 'that one came earlier' });
  // Fillers: a shape or look that is not in the pattern at all.
  const usedKinds = new Set(pl.terms.map((t) => t.kind));
  const usedLooks = new Set(pl.terms.map((t) => lookKey(t.look)));
  for (const k of shuffle(KINDS_ALL.filter((k) => !usedKinds.has(k)), rng).slice(0, 2))
    pool.push({ visual: optionVisual({ ...ans, kind: k }), why: `there is no ${KIND_NAME[k]} in the pattern` });
  for (const l of shuffle(LOOKS.filter((l) => !usedLooks.has(lookKey(l))), rng).slice(0, 2))
    pool.push({ visual: optionVisual({ ...ans, look: l }), why: `${lookWord(l)} is not in the pattern` });

  const n = OPTION_COUNT[d];
  // Keep the meaningful distractors first, but don't always show them in the same order.
  const meaningful = pool.slice(0, pool.length - 4);
  const fillers = pool.slice(pool.length - 4);
  const wrong = pickWrongFair(optionVisual(ans), [...shuffle(meaningful, rng), ...fillers], n, rng);
  if (!wrong) return null;

  const allIds = shownTerms.map((_, i) => `t${i}`);
  const explanation: ExplainStep[] = pl.varying.slice(0, 3).map((a) => {
    const nextWord = a === 'look' ? lookWord(ans.look) : a === 'kind' ? KIND_NAME[ans.kind] : a === 'size' ? SIZE_WORD[ans.size] : a === 'count' ? String(ans.count) : `${ans.rot}°`;
    if (a === 'rot') {
      const step = (((ans.rot - last.rot) % 360) + 360) % 360;
      const size = step === 90 || step === 270 ? 'a quarter turn' : 'an eighth of a turn';
      const way = step <= 180 ? 'the way clock hands go' : 'backwards, against the clock';
      return { text: clip(`Watch the ${KIND_NAME[ans.kind]}: it turns ${size} each time, ${way}.`), visual, highlight: allIds };
    }
    const lead = a === 'count' ? `Count them: ${describeValues(shownTerms, a)}` : `Look at the ${ATTR_WORDS[a]}: ${describeValues(shownTerms, a)}`;
    return { text: clip(`${lead}. Next: ${nextWord}!`), visual, highlight: allIds };
  });
  explanation.push({ text: clip(`So it's the ${termWord(ans, pl.varying)}.`), visual: optionVisual(ans) });

  return finish(ID, d, {
    prompt: 'What comes next?',
    visual,
    answer: choice(rng, optionVisual(ans), wrong),
    explanation,
    rule: pl.rule,
    variant: pl.variant,
  });
};

/** Re-read the shown terms and infer every attribute's next value independently. */
export const deriveSeqShape = (p: Puzzle): { next: Term | null; errs: string[] } => {
  const errs: string[] = [];
  const terms: Term[] = [];
  const k = termScale(p);
  for (let i = 0; ; i++) {
    const n = byId(p.visual.nodes, `t${i}`);
    if (!n) break;
    const t = readTerm(n, k);
    if (!t) return { next: null, errs: [`could not read term ${i}`] };
    terms.push(t);
  }
  if (terms.length < 4) return { next: null, errs: ['could not read the sequence'] };
  let next: Term = { ...terms[0] };
  for (const a of ATTRS) {
    const vals = terms.map((t) => valueOf(t, a));
    const fits = predictions(vals, NUMERIC[a], a === 'rot' ? 360 : undefined);
    const v = uniqueNext(fits);
    if (v === null) errs.push(`attribute ${a} has ${fits.length ? 'conflicting' : 'no'} rules: ${vals.join(',')}`);
    else next = withValue(next, a, v);
  }
  if (errs.length) return { next: null, errs };
  if (next.size < -1 || next.size > 5 || next.count < 1 || next.count > 6) return { next: null, errs: ['next term out of range'] };
  return { next, errs };
};

const termScale = (p: Puzzle): number => {
  let shown = 0;
  while (byId(p.visual.nodes, `t${shown}`)) shown++;
  return layout(shown).slot / 64;
};

export const validateSeqShape = (p: Puzzle): string[] => {
  const { next, errs } = deriveSeqShape(p);
  if (!next) return errs;
  return checkVisualChoice(p, optionVisual(next));
};

export const seqShape: PuzzleFamily = {
  id: ID,
  title: 'What comes next?',
  emoji: '🔶',
  group: 'shape',
  variants: [...VARIANTS[1], ...VARIANTS[2], ...VARIANTS[3]],
  generate: (d, rng) => generateValid(() => attempt(d, rng), validateSeqShape),
  validate: validateSeqShape,
};
