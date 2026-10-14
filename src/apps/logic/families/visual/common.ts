/**
 * Shared plumbing for builder 4's visual families: option assembly, the generic choice checks every
 * validator runs, node lookup and kid-language names.
 */
import type {
  ChoiceAnswer,
  ChoiceOption,
  Color,
  Difficulty,
  ExplainStep,
  FamilyId,
  Puzzle,
  Rng,
  VisualNode,
  VisualSpec,
} from '../../engine/types';
import { OPTION_COUNT } from '../../engine/types';
import { puzzleId } from '../../engine/rng';
import { shuffle, visualKey } from '../../engine/shapes';

export const COLOR_WORD: Record<Color, string> = {
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

export interface Wrong {
  visual: VisualSpec;
  why: string;
}

/**
 * Pick `n − 1` distractors from `pool` (in order of preference), skipping any picture equal to the
 * answer or to one already taken. Returns null when there are not enough distinct ones (the caller
 * regenerates).
 */
export const pickWrong = (answer: VisualSpec, pool: Wrong[], n: number): Wrong[] | null => {
  const seen = new Set([visualKey(answer)]);
  const out: Wrong[] = [];
  for (const w of pool) {
    if (out.length >= n - 1) break;
    const k = visualKey(w.visual);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out.length === n - 1 ? out : null;
};

/** Every shape drawn in a picture (inside groups and grid cells). */
const shapesIn = (nodes: VisualNode[]) => {
  const out: Array<Extract<VisualNode, { t: 'shape' }>> = [];
  const visit = (n: VisualNode) => {
    if (n.t === 'shape') out.push(n);
    if (n.t === 'g') n.children.forEach(visit);
    if (n.t === 'grid') for (const c of n.cells ?? []) if (c.node) visit(c.node);
  };
  nodes.forEach(visit);
  return out;
};

/** What a test-wise guesser can compare between options without solving anything. */
export const surfaceOf = (v: VisualSpec) => {
  const ss = shapesIn(v.nodes);
  const j = (f: (s: (typeof ss)[number]) => string) => ss.map(f).sort().join('|');
  return {
    feats: [j((s) => s.fill ?? ''), j((s) => s.kind), j((s) => s.pattern ?? 'solid'), j((s) => String(Math.round(s.size))), j((s) => String(s.rotate ?? 0))],
    area: ss.reduce((a, s) => a + s.size * s.size, 0),
  };
};

/** Index of the options that win "pick the most typical / biggest / smallest" (ties included). */
const tells = (opts: Array<ReturnType<typeof surfaceOf>>) => {
  const typical = opts.map((o, i) => o.feats.reduce((acc, v, k) => acc + opts.filter((p, m) => m !== i && p.feats[k] === v).length, 0));
  const top = (xs: number[]) => xs.map((x, i) => (x === Math.max(...xs) ? i : -1)).filter((i) => i >= 0);
  return [top(typical), top(opts.map((o) => o.area)), top(opts.map((o) => -o.area))];
};

/**
 * Like pickWrong, but chooses the set of distractors so the answer is (almost always) NOT the
 * option a test-wise guesser would pick: the most typical one (most in common with the others), the
 * biggest or the smallest. Prefers earlier pool entries; falls back to plain pickWrong order.
 * Once in `n` puzzles the constraint is dropped so the answer is not systematically the *least*
 * typical either.
 */
export const pickWrongFair = (answer: VisualSpec, pool: Wrong[], n: number, rng: Rng): Wrong[] | null => {
  const seen = new Set([visualKey(answer)]);
  const cand: Wrong[] = [];
  for (const w of pool) {
    const k = visualKey(w.visual);
    if (seen.has(k)) continue;
    seen.add(k);
    cand.push(w);
    if (cand.length >= 12) break;
  }
  if (cand.length < n - 1) return null;
  const first = cand.slice(0, n - 1);
  if (rng() < 1 / n) return first;
  const ansS = surfaceOf(answer);
  const surf = cand.map((w) => surfaceOf(w.visual));
  const badness = (idx: number[]) => tells([ansS, ...idx.map((i) => surf[i])]).reduce((a, t) => a + (t.includes(0) ? 1 / t.length : 0), 0);
  let best = first.map((_, i) => i);
  let bestBad = badness(best);
  for (let t = 0; t < 160 && bestBad > 0; t++) {
    // Random subset, biased towards the front of the pool (the meaningful distractors).
    const idx: number[] = [];
    const order = cand.map((_, i) => i).sort((a, b) => a + rng() * 8 - (b + rng() * 8));
    for (const i of order) if (idx.length < n - 1) idx.push(i);
    const b = badness(idx);
    if (b < bestBad) {
      best = idx;
      bestBad = b;
    }
  }
  return best.map((i) => cand[i]);
};

/** Shuffle the answer in among the distractors. */
export const choice = (rng: Rng, answer: VisualSpec, wrong: Wrong[]): ChoiceAnswer => {
  const all: Array<{ o: ChoiceOption; ok: boolean }> = [
    { o: { visual: answer }, ok: true },
    ...wrong.map((w) => ({ o: { visual: w.visual, why: w.why }, ok: false })),
  ];
  const sh = shuffle(all, rng);
  return { kind: 'choice', options: sh.map((x) => x.o), answerIndex: sh.findIndex((x) => x.ok) };
};

/** The generic checks for a picture choice whose correct picture is `expected`. */
export const checkVisualChoice = (p: Puzzle, expected: VisualSpec): string[] => {
  const errs: string[] = [];
  const a = p.answer;
  if (a.kind !== 'choice') return [`expected a choice answer, got ${a.kind}`];
  if (a.options.length !== OPTION_COUNT[p.difficulty]) errs.push(`option count ${a.options.length} ≠ ${OPTION_COUNT[p.difficulty]}`);
  const keys = a.options.map((o) => (o.visual ? visualKey(o.visual) : `text:${o.text}`));
  if (new Set(keys).size !== keys.length) errs.push('two options look the same');
  const want = visualKey(expected);
  const hits = keys.map((k, i) => (k === want ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) errs.push(`expected exactly one option equal to the derived answer, found ${hits.length}`);
  else if (hits[0] !== a.answerIndex) errs.push(`answerIndex ${a.answerIndex} but the derived answer is option ${hits[0]}`);
  a.options.forEach((o, i) => {
    if (!o.visual) errs.push(`option ${i} has no picture`);
    if (i !== a.answerIndex && !o.why) errs.push(`wrong option ${i} has no why`);
  });
  return errs;
};

/** Every node with an id, depth first. */
export const byId = (nodes: VisualNode[], id: string): VisualNode | undefined => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.t === 'g') {
      const hit = byId(n.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
};

/** Ids starting with a prefix, in document order. */
export const byPrefix = (nodes: VisualNode[], prefix: string, out: VisualNode[] = []): VisualNode[] => {
  for (const n of nodes) {
    if (n.id?.startsWith(prefix)) out.push(n);
    if (n.t === 'g') byPrefix(n.children, prefix, out);
  }
  return out;
};

export interface Draft {
  prompt: string;
  speak?: string;
  visual: VisualSpec;
  answer: Puzzle['answer'];
  explanation: ExplainStep[];
  rule: string;
  variant: string;
}

/** Wrap a draft into a Puzzle with a content-hashed id. */
export const finish = (family: FamilyId, d: Difficulty, dr: Draft): Puzzle => {
  const a = dr.answer;
  const answerKey =
    a.kind === 'choice'
      ? a.options
          .map((o) => (o.visual ? visualKey(o.visual) : o.text))
          .sort()
          .join('|')
      : JSON.stringify(a);
  const content = `${dr.prompt}\n${visualKey(dr.visual)}\n${answerKey}`;
  return {
    id: puzzleId(family, d, content),
    family,
    difficulty: d,
    prompt: dr.prompt,
    ...(dr.speak ? { speak: dr.speak } : {}),
    visual: dr.visual,
    answer: dr.answer,
    explanation: dr.explanation,
    rule: dr.rule,
    variant: dr.variant,
  };
};

/**
 * Run `attempt` until it returns a puzzle that validates (generators build by construction; the
 * loop only guards against rare accidental ambiguities). Throws after 60 tries — the property tests
 * prove that never happens.
 */
export const generateValid = (attempt: () => Puzzle | null, validate: (p: Puzzle) => string[]): Puzzle => {
  let last: string[] = [];
  for (let i = 0; i < 60; i++) {
    const p = attempt();
    if (!p) continue;
    last = validate(p);
    if (last.length === 0) return p;
  }
  throw new Error(`generator could not build a valid puzzle: ${last.join('; ')}`);
};

/** Clamp a string to n characters (explanations are ≤ 90). */
export const clip = (s: string, n = 90): string => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

export const ordinal = (n: number): string => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n] ?? `${n + 1}th`;
