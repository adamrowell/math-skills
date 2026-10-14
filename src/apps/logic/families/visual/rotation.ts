/**
 * rotation — "Which is the same shape, just turned?" Exactly one option is the figure turned; every
 * other option is a flipped (mirror) version or a slightly changed figure, and the validator proves
 * none of them equals ANY turn of the figure.
 */
import type { Difficulty, ExplainStep, Puzzle, PuzzleFamily, Rng, VisualSpec } from '../../engine/types';
import { OPTION_COUNT } from '../../engine/types';
import { group, mirrorSpec, pick, sameVisual, shuffle, spec } from '../../engine/shapes';
import { byId, choice, finish, generateValid, pickWrong, type Wrong } from './common';
import { BOX, figureSpec, hasSymmetry, moveBlock, moveMarker, randomFigure, specOfGroup, turnAny } from './figure';

const ID = 'rotation' as const;

/** Options are drawn shrunk so 45° turns fit the box; every option uses the same scale. */
const SCALE: Record<Difficulty, number> = { 1: 1, 2: 0.7, 3: 1 };
const STEPS: Record<Difficulty, number[]> = { 1: [90, 180, 270], 2: [45, 90, 135, 180, 225, 270, 315], 3: [90, 180, 270] };
const ALL_TURNS: Record<Difficulty, number[]> = { 1: [0, 90, 180, 270], 2: [0, 45, 90, 135, 180, 225, 270, 315], 3: [0, 90, 180, 270] };

const VARIANTS: Record<Difficulty, string[]> = { 1: ['quarter-turns'], 2: ['eighth-turns'], 3: ['flip-traps'] };

const turn = (fig: VisualSpec, deg: number, d: Difficulty) => turnAny(fig, deg, SCALE[d]);

const attempt = (d: Difficulty, rng: Rng): Puzzle | null => {
  const f = randomFigure(d === 1 ? 4 : 5, d === 1 ? 1 : 2, rng);
  const fig = figureSpec(f);
  if (hasSymmetry(fig)) return null;
  const k = pick(STEPS[d], rng);
  const ans = turn(fig, k, d);
  const flipped = mirrorSpec(fig, 'x');
  const pool: Wrong[] = [];
  if (d === 3) {
    // Mirror traps: the flipped figure turned to every angle, starting with the answer's own.
    for (const j of shuffle(ALL_TURNS[3], rng)) pool.push({ visual: turn(flipped, j, d), why: 'that one is flipped over, not just turned' });
    const alt = moveMarker(f, rng);
    if (alt) pool.push({ visual: turn(figureSpec(alt), k, d), why: 'a little shape moved to another block' });
  } else {
    const flips = shuffle(ALL_TURNS[d], rng).slice(0, 2);
    for (const j of flips) pool.push({ visual: turn(flipped, j, d), why: 'that one is flipped over, not just turned' });
    const alt = moveMarker(f, rng);
    if (alt) pool.push({ visual: turn(figureSpec(alt), pick(ALL_TURNS[d], rng), d), why: 'a little shape moved to another block' });
    const alt2 = moveBlock(f, rng);
    if (alt2) pool.push({ visual: turn(figureSpec(alt2), pick(ALL_TURNS[d], rng), d), why: 'one block moved' });
    for (const j of shuffle(ALL_TURNS[d], rng)) pool.push({ visual: turn(flipped, j, d), why: 'that one is flipped over, not just turned' });
  }
  const shuffled = d === 3 ? pool : [...shuffle(pool.slice(0, 4), rng), ...pool.slice(4)];
  const wrong = pickWrong(ans, shuffled, OPTION_COUNT[d]);
  if (!wrong) return null;
  const visual = spec(BOX + 12, BOX + 12, [group(turn(fig, 0, d).nodes, { id: 'fig', x: 6, y: 6 })], 'A figure made of blocks');
  const explanation: ExplainStep[] = [
    { text: 'Find a special block, like the one with the dot, and follow it as it turns.', visual, highlight: ['fig'] },
    { text: 'Flipped shapes are tricky: they look close, but no turning makes them match.' },
    { text: `This one is the same shape turned ${k === 180 ? 'upside down' : k % 90 ? 'a little' : 'a quarter turn'}.`, visual: ans },
  ];
  return finish(ID, d, {
    prompt: 'Which is the same shape, just turned?',
    visual,
    answer: choice(rng, ans, wrong),
    explanation,
    rule: `turned ${k}°`,
    variant: VARIANTS[d][0],
  });
};

export const validateRotation = (p: Puzzle): string[] => {
  const g = byId(p.visual.nodes, 'fig');
  const inner = g && g.t === 'g' ? g.children[0] : undefined;
  // The figure group holds the turnAny wrapper at turn 0: unwrap it to the plain figure.
  const fig = inner && inner.t === 'g' && inner.children[0]?.t === 'g' ? specOfGroup(inner.children[0]) : null;
  const scale = inner && inner.t === 'g' ? (inner.scale ?? 1) : 1;
  if (!fig) return ['missing figure'];
  if (hasSymmetry(fig)) return ['figure has a symmetry'];
  const a = p.answer;
  if (a.kind !== 'choice') return ['bad answer kind'];
  const errs: string[] = [];
  if (a.options.length !== OPTION_COUNT[p.difficulty]) errs.push('option count');
  const turns = ALL_TURNS[p.difficulty].map((deg) => turnAny(fig, deg, scale));
  const isTurn = a.options.map((o) => !!o.visual && turns.some((t) => sameVisual(t, o.visual!)));
  const hits = isTurn.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) errs.push(`expected exactly one turned copy, found ${hits.length}`);
  else if (hits[0] !== a.answerIndex) errs.push('answerIndex is not the turned copy');
  if (sameVisual(a.options[a.answerIndex]?.visual ?? spec(1, 1, []), turns[0])) errs.push('answer is not turned at all');
  for (let i = 0; i < a.options.length; i++)
    for (let j = i + 1; j < a.options.length; j++) if (sameVisual(a.options[i].visual!, a.options[j].visual!)) errs.push('two options look the same');
  a.options.forEach((o, i) => i !== a.answerIndex && !o.why && errs.push(`option ${i} has no why`));
  return errs;
};

export const rotation: PuzzleFamily = {
  id: ID,
  title: 'Turn it around',
  emoji: '🔄',
  group: 'spatial',
  variants: ['quarter-turns', 'eighth-turns', 'flip-traps'],
  generate: (d, rng) => generateValid(() => attempt(d, rng), validateRotation),
  validate: validateRotation,
};
