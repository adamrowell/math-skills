/**
 * mirror — "Which is the mirror image?" A block figure sits beside a dashed mirror line; the child
 * picks what the mirror shows. Distractors: the figure unchanged, turned instead of flipped,
 * flipped across the other line, markers left unflipped.
 */
import type { Difficulty, ExplainStep, Puzzle, PuzzleFamily, Rng, VisualNode, VisualSpec } from '../../engine/types';
import { OPTION_COUNT } from '../../engine/types';
import { grid, group, line, mirrorSpec, pick, rotateSpec, sameVisual, shuffle, spec, type MirrorAxis } from '../../engine/shapes';
import { byId, checkVisualChoice, choice, finish, generateValid, pickWrong, type Wrong } from './common';
import { BOX, figureSpec, hasSymmetry, randomFigure, specOfGroup, type Figure } from './figure';

const ID = 'mirror' as const;

const VARIANTS: Record<Difficulty, string[]> = {
  1: ['side'],
  2: ['side', 'below'],
  3: ['side', 'below', 'diagonal'],
};

type Layout = 'side' | 'below' | 'diagonal';
const AXIS: Record<Layout, MirrorAxis> = { side: 'x', below: 'y', diagonal: 'anti' };

const layoutVisual = (fig: VisualSpec, lay: Layout): VisualSpec => {
  const g = group(fig.nodes, { id: 'fig', x: 6, y: 6 });
  if (lay === 'side') {
    const mx = 6 + BOX + 12;
    return spec(BOX * 2 + 36, BOX + 12, [
      g,
      line(mx, 2, mx, BOX + 10, { id: 'mirror', dash: true, stroke: 'ink', strokeWidth: 3 }),
      grid(mx + 12, 6, 1, 1, BOX, { id: 'q', unknown: [{ r: 0, c: 0 }] }),
    ], 'A figure, a mirror line, and a question mark');
  }
  if (lay === 'below') {
    const my = 6 + BOX + 12;
    return spec(BOX + 12, BOX * 2 + 36, [
      g,
      line(2, my, BOX + 10, my, { id: 'mirror', dash: true, stroke: 'ink', strokeWidth: 3 }),
      grid(6, my + 12, 1, 1, BOX, { id: 'q', unknown: [{ r: 0, c: 0 }] }),
    ], 'A figure above a mirror line and a question mark below');
  }
  // Diagonal: the figure top-left, the mirror runs bottom-left → top-right, the answer bottom-right.
  const S = 6 + BOX + 12 + BOX + 6 + 6; // 236
  return spec(S, S, [
    g,
    line(2, S - 2, S - 2, 2, { id: 'mirror', dash: true, stroke: 'ink', strokeWidth: 3 }),
    grid(S - 6 - BOX, S - 6 - BOX, 1, 1, BOX, { id: 'q', unknown: [{ r: 0, c: 0 }] }),
  ], 'A figure, a slanted mirror line, and a question mark');
};

const axisWord: Record<MirrorAxis, string> = { x: 'left and right swap', y: 'top and bottom swap', diag: 'it flips over the slanted line', anti: 'it flips over the slanted line' };

const attempt = (d: Difficulty, rng: Rng): Puzzle | null => {
  const lay = pick(VARIANTS[d], rng) as Layout;
  const axis = AXIS[lay];
  const f: Figure = randomFigure(d === 1 ? 4 : 5, d === 1 ? 1 : 2, rng);
  const fig = figureSpec(f);
  if (hasSymmetry(fig)) return null;
  const ans = mirrorSpec(fig, axis);
  const other: MirrorAxis = axis === 'x' ? 'y' : axis === 'y' ? 'x' : 'diag';
  const unflippedMarkers = spec(BOX, BOX, [
    ...mirrorSpec(figureSpec({ ...f, markers: [] }), axis).nodes,
    ...fig.nodes.slice(f.cells.length).map((m) => {
      // Markers moved to their mirrored block but still facing the old way.
      const moved = mirrorSpec(spec(BOX, BOX, [m]), axis).nodes[0];
      return m.t === 'shape' && moved.t === 'shape' ? { ...m, x: moved.x, y: moved.y } : moved;
    }),
  ]);
  const pool: Wrong[] = shuffle(
    [
      { visual: fig, why: 'that is the same picture — a mirror flips it' },
      { visual: rotateSpec(fig, 180), why: 'that is turned upside down, not flipped' },
      { visual: mirrorSpec(fig, other), why: 'that is flipped the wrong way' },
      { visual: unflippedMarkers, why: 'the little shapes did not flip' },
    ],
    rng,
  );
  pool.push(
    { visual: rotateSpec(fig, 90), why: 'that is turned, not flipped' },
    { visual: rotateSpec(ans, 90), why: 'flipped, but then turned too' },
    { visual: rotateSpec(fig, 270), why: 'that is turned, not flipped' },
  );
  const wrong = pickWrong(ans, pool, OPTION_COUNT[d]);
  if (!wrong) return null;
  const visual = layoutVisual(fig, lay);
  const explanation: ExplainStep[] = [
    { text: 'Pretend the dashed line is a mirror.', visual, highlight: ['mirror'] },
    {
      text:
        lay === 'diagonal'
          ? 'Blocks close to the line stay close to it; far ones stay far.'
          : `In a mirror, ${axisWord[axis]}: what is near the line stays near it.`,
      visual,
      highlight: ['fig'],
    },
    { text: 'This is what the mirror shows.', visual: ans },
  ];
  return finish(ID, d, {
    prompt: 'Which is the mirror image?',
    visual,
    answer: choice(rng, ans, wrong),
    explanation,
    rule: lay === 'side' ? 'mirror left ↔ right' : lay === 'below' ? 'mirror top ↔ bottom' : 'mirror across the slanted line',
    variant: lay,
  });
};

/** Read the figure and the mirror line back; the answer is the figure's reflection. */
export const deriveMirror = (p: Puzzle): { expected: VisualSpec; fig: VisualSpec } | string[] => {
  const fig = specOfGroup(byId(p.visual.nodes, 'fig'));
  const m = byId(p.visual.nodes, 'mirror') as VisualNode | undefined;
  if (!fig || !m || m.t !== 'line') return ['missing figure or mirror line'];
  const axis: MirrorAxis = m.x1 === m.x2 ? 'x' : m.y1 === m.y2 ? 'y' : 'anti';
  const expected = mirrorSpec(fig, axis);
  if (sameVisual(expected, fig)) return ['figure is symmetric across the mirror'];
  return { expected, fig };
};

export const validateMirror = (p: Puzzle): string[] => {
  const r = deriveMirror(p);
  if (Array.isArray(r)) return r;
  return checkVisualChoice(p, r.expected);
};

export const mirror: PuzzleFamily = {
  id: ID,
  title: 'Mirror, mirror',
  emoji: '🪞',
  group: 'spatial',
  variants: ['side', 'below', 'diagonal'],
  generate: (d, rng) => generateValid(() => attempt(d, rng), validateMirror),
  validate: validateMirror,
};
