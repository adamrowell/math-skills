/**
 * Small pure helpers shared by builder 3's families: node builders, rank-balanced number options,
 * choice finalising and a canonical picture key. (Builder 4's `engine/shapes.ts` has its own set;
 * these stay independent so neither builder waits on the other.)
 */
import type {
  ChoiceAnswer,
  ChoiceOption,
  Color,
  EmojiNode,
  GridNode,
  LineNode,
  Rng,
  ShapeKind,
  ShapeNode,
  TextNode,
  VisualNode,
  VisualSpec,
} from '../engine/types';
import { shuffled } from '../engine/rng';
import { visualKey } from '../engine/canon';

// ---------------------------------------------------------------------------------------------
// Node builders
// ---------------------------------------------------------------------------------------------

export const shape = (kind: ShapeKind, x: number, y: number, size: number, o: Partial<ShapeNode> = {}): ShapeNode => ({
  t: 'shape',
  kind,
  x,
  y,
  size,
  ...o,
});

export const text = (x: number, y: number, t: string, o: Partial<TextNode> = {}): TextNode => ({ t: 'text', x, y, text: t, ...o });

export const emoji = (x: number, y: number, char: string, size: number, o: Partial<EmojiNode> = {}): EmojiNode => ({
  t: 'emoji',
  x,
  y,
  char,
  size,
  ...o,
});

export const line = (x1: number, y1: number, x2: number, y2: number, o: Partial<LineNode> = {}): LineNode => ({
  t: 'line',
  x1,
  y1,
  x2,
  y2,
  ...o,
});

export const grid = (x: number, y: number, rows: number, cols: number, cell: number, o: Partial<GridNode> = {}): GridNode => ({
  t: 'grid',
  x,
  y,
  rows,
  cols,
  cell,
  ...o,
});

export const spec = (w: number, h: number, nodes: VisualNode[], label?: string): VisualSpec => ({ w, h, nodes, ...(label ? { label } : {}) });

export { visualKey } from '../engine/canon';

export function optionKey(o: ChoiceOption): string {
  return o.visual ? `v:${visualKey(o.visual)}` : `t:${o.text ?? ''}`;
}

// ---------------------------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------------------------

/** Shuffle options; the correct one is `options[0]` on input. */
export function finalizeChoice(rng: Rng, correct: ChoiceOption, wrong: ChoiceOption[]): ChoiceAnswer {
  const all = [{ o: { ...correct, why: undefined }, ok: true }, ...wrong.map((o) => ({ o, ok: false }))];
  const sh = shuffled(rng, all);
  const options = sh.map((x) => {
    const { why, ...rest } = x.o;
    return x.ok ? rest : { ...rest, why };
  });
  return { kind: 'choice', options, answerIndex: sh.findIndex((x) => x.ok) };
}

export interface Candidate {
  v: number;
  why: string;
}

/**
 * Pick `n − 1` wrong numbers so the answer's RANK among the sorted options is uniform (never always
 * the middle, the biggest or the smallest — the classic multiple-choice tells). Meaningful distractors
 * from `pool` are used first; gaps are filled with answer ± k·step.
 */
export function numberOptions(
  rng: Rng,
  answer: number,
  pool: Candidate[],
  n: number,
  opts: { min?: number; max?: number; step?: number; fmt?: (v: number) => string } = {},
): ChoiceAnswer {
  const min = opts.min ?? 0;
  const max = opts.max ?? 9999;
  const step = Math.max(1, Math.round(opts.step ?? 1));
  const fmt = opts.fmt ?? ((v: number) => String(v));
  const seen = new Set<number>([answer]);
  const clean: Candidate[] = [];
  for (const c of shuffled(rng, pool)) {
    if (!Number.isInteger(c.v) || c.v < min || c.v > max || seen.has(c.v)) continue;
    seen.add(c.v);
    clean.push(c);
  }
  // Synthetic fillers on both sides.
  const synth = (side: -1 | 1): Candidate[] => {
    const out: Candidate[] = [];
    for (let k = 1; out.length < n; k++) {
      const v = answer + side * k * step;
      if (v < min || v > max) break;
      if (!seen.has(v)) out.push({ v, why: side < 0 ? `${fmt(v)} is too small` : `${fmt(v)} is too big` });
      if (k > 60) break;
    }
    return out;
  };
  const below = [...clean.filter((c) => c.v < answer)];
  const above = [...clean.filter((c) => c.v > answer)];
  const synthBelow = synth(-1);
  const synthAbove = synth(1);
  const maxBelow = below.length + synthBelow.length;
  const maxAbove = above.length + synthAbove.length;
  const lo = Math.max(0, n - 1 - maxAbove);
  const hi = Math.min(n - 1, maxBelow);
  const rank = lo + Math.floor(rng() * (hi - lo + 1));
  const takeSide = (real: Candidate[], fake: Candidate[], k: number): Candidate[] => {
    const got = real.slice(0, k);
    for (const f of fake) {
      if (got.length >= k) break;
      if (!got.some((g) => g.v === f.v)) got.push(f);
    }
    return got;
  };
  const wrong = [...takeSide(below, synthBelow, rank), ...takeSide(above, synthAbove, n - 1 - rank)];
  return finalizeChoice(
    rng,
    { text: fmt(answer) },
    wrong.map((w) => ({ text: fmt(w.v), why: w.why })),
  );
}

/** Text options from a list of distractor candidates (deduped, first n − 1). */
export function textOptions(rng: Rng, answer: string, pool: Array<{ text: string; why: string }>, n: number): ChoiceAnswer {
  const used = new Set([answer]);
  const wrong: ChoiceOption[] = [];
  for (const c of pool) {
    if (wrong.length >= n - 1) break;
    if (used.has(c.text)) continue;
    used.add(c.text);
    wrong.push({ text: c.text, why: c.why });
  }
  return finalizeChoice(rng, { text: answer }, wrong);
}

// ---------------------------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------------------------

/** Common checks for a choice answer whose correct value is `expected` (text) — exactly one match, all distinct. */
export function checkTextChoice(a: ChoiceAnswer, expected: string): string[] {
  const errs: string[] = [];
  const texts = a.options.map((o) => o.text ?? '');
  if (new Set(texts).size !== texts.length) errs.push(`duplicate options: ${texts.join(',')}`);
  const hits = texts.filter((t) => t === expected).length;
  if (hits !== 1) errs.push(`expected exactly one option "${expected}", found ${hits}`);
  if (texts[a.answerIndex] !== expected) errs.push(`answerIndex points at "${texts[a.answerIndex]}", derived "${expected}"`);
  return errs;
}

/** All text nodes (recursively, including grid labels) with their ids. */
export function walk(nodes: VisualNode[], fn: (n: VisualNode) => void): void {
  for (const n of nodes) {
    fn(n);
    if (n.t === 'g') walk(n.children, fn);
    if (n.t === 'scale') {
      walk(n.left, fn);
      walk(n.right, fn);
    }
    if (n.t === 'grid') for (const c of n.cells ?? []) if (c.node) walk([c.node], fn);
  }
}

export function findById(s: VisualSpec, id: string): VisualNode | undefined {
  let hit: VisualNode | undefined;
  walk(s.nodes, (n) => {
    if (!hit && n.id === id) hit = n;
  });
  return hit;
}

export function textById(s: VisualSpec, id: string): string | undefined {
  const n = findById(s, id);
  return n && n.t === 'text' ? n.text : undefined;
}

export const COLOR_NAMES: Record<Color, string> = {
  red: 'red',
  blue: 'blue',
  green: 'green',
  yellow: 'yellow',
  purple: 'purple',
  orange: 'orange',
  pink: 'pink',
  teal: 'teal',
  brown: 'brown',
  grey: 'grey',
  ink: 'black',
  white: 'white',
  none: 'clear',
};

/**
 * Options as a (near-)factorial design over two attributes: the answer is (a, b); wrong options mix
 * `a`/alternatives with `b`/alternatives so that no option — the answer included — agrees with the
 * others more than the rest do (kills the "pick the most typical option" tell).
 * n = 4 → 2×2, n = 5 → 3×2 minus one random wrong cell, n = 6 → 3×2.
 */
export function factorial<A, B>(rng: Rng, a: A, aAlts: A[], b: B, bAlts: B[], n: number): Array<{ a: A; b: B; isAnswer: boolean }> {
  const as = [a, ...aAlts.slice(0, n === 4 ? 1 : 2)];
  const bs = [b, ...bAlts.slice(0, 1)];
  const cells: Array<{ a: A; b: B; isAnswer: boolean }> = [];
  as.forEach((x, i) => bs.forEach((y, j) => cells.push({ a: x, b: y, isAnswer: i === 0 && j === 0 })));
  while (cells.length > n) {
    const wrong = cells.map((c, i) => (c.isAnswer ? -1 : i)).filter((i) => i >= 0);
    cells.splice(wrong[Math.floor(rng() * wrong.length)], 1);
  }
  return cells;
}
