/**
 * A "term" is one picture in a sequence or one cell of a matrix: a shape kind in a look
 * (colour + pattern), a size level, a turn and a count. Drawing and reading back are symmetric, so
 * validators can recover the terms from the puzzle's own VisualSpec and re-derive the rule.
 *
 * Colour is never the only cue: every look pairs a colour with its own fill pattern, so a child who
 * cannot tell red from green still sees "stripes" vs "dots".
 */
import type { Color, FillPattern, GroupNode, ShapeKind, ShapeNode, VisualNode } from '../../engine/types';
import { group, KIND_NAME, shape } from '../../engine/shapes';
import { COLOR_WORD } from './common';

export interface Look {
  fill: Color;
  pattern: FillPattern;
}

export interface Term {
  kind: ShapeKind;
  look: Look;
  /** Index into SIZES; −1 = the small counting size (always used when a count rule is in play). */
  size: number;
  /** Clockwise degrees. */
  rot: number;
  count: number;
}

export const LOOKS: Look[] = [
  { fill: 'blue', pattern: 'solid' },
  { fill: 'yellow', pattern: 'dotted' },
  { fill: 'red', pattern: 'striped' },
  { fill: 'teal', pattern: 'hatched' },
  { fill: 'white', pattern: 'solid' },
  { fill: 'purple', pattern: 'half' },
];

/** Looks that are safe for turning shapes (no orientation-dependent pattern). Same as LOOKS today. */
export const lookKey = (l: Look) => `${l.fill}/${l.pattern}`;
export const lookOf = (key: string): Look => {
  const [fill, pattern] = key.split('/') as [Color, FillPattern];
  return { fill, pattern };
};

const PATTERN_WORD: Record<FillPattern, string> = {
  solid: '',
  empty: 'empty',
  striped: 'striped',
  dotted: 'dotty',
  hatched: 'checked',
  half: 'half',
};

export const lookWord = (l: Look): string => {
  if (l.fill === 'white') return 'white';
  const p = PATTERN_WORD[l.pattern];
  return p ? `${p} ${COLOR_WORD[l.fill]}` : COLOR_WORD[l.fill];
};

export const SIZES = [16, 22, 28, 34, 40, 46];
export const SIZE_WORD = ['tiny', 'small', 'medium', 'big', 'bigger', 'biggest'];
export const MID = 3;

/** Offsets (in units of `pitch`) for 1..6 copies. */
const COUNT_POS: Array<Array<[number, number]>> = [
  [],
  [[0, 0]],
  [
    [-0.5, 0],
    [0.5, 0],
  ],
  [
    [0, -0.45],
    [-0.5, 0.45],
    [0.5, 0.45],
  ],
  [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ],
  [
    [-0.6, -0.6],
    [0.6, -0.6],
    [0, 0],
    [-0.6, 0.6],
    [0.6, 0.6],
  ],
  [
    [-0.5, -0.8],
    [0.5, -0.8],
    [-0.5, 0],
    [0.5, 0],
    [-0.5, 0.8],
    [0.5, 0.8],
  ],
];

/** Size of each copy when count > 1 (fits a 56-unit slot). */
const MULTI = { size: 15, pitch: 19 };

/** Draw a term centred on (cx, cy) at scale k; the group carries `id`. */
export const drawTerm = (t: Term, cx: number, cy: number, k = 1, id?: string): GroupNode => {
  const o: Partial<ShapeNode> = { fill: t.look.fill, ...(t.look.pattern !== 'solid' ? { pattern: t.look.pattern } : {}) };
  if (t.rot) o.rotate = t.rot;
  const kids: VisualNode[] =
    t.count <= 1
      ? [shape(t.kind, cx, cy, (t.size < 0 ? MULTI.size : SIZES[t.size]) * k, o)]
      : COUNT_POS[t.count].map(([dx, dy]) => shape(t.kind, cx + dx * MULTI.pitch * k, cy + dy * MULTI.pitch * k, MULTI.size * k, o));
  return group(kids, id ? { id } : undefined);
};

/** Read a term back from a group drawn by drawTerm at scale k. */
export const readTerm = (n: VisualNode | undefined, k = 1): Term | null => {
  if (!n || n.t !== 'g' || n.children.length === 0) return null;
  const s = n.children[0];
  if (s.t !== 'shape') return null;
  const count = n.children.length;
  // size −1 = "counting size": the small copies used when a count rule is in play.
  const size = count > 1 || Math.abs(MULTI.size * k - s.size) < 0.01 ? -1 : SIZES.findIndex((v) => Math.abs(v * k - s.size) < 0.01);
  return {
    kind: s.kind,
    look: { fill: s.fill ?? 'none', pattern: s.pattern ?? 'solid' },
    size,
    rot: s.rotate ?? 0,
    count,
  };
};

export const termWord = (t: Term, attrs: ReadonlyArray<keyof Term>): string => {
  const kind = KIND_NAME[t.kind];
  const parts: string[] = [];
  if (attrs.includes('count')) parts.push(String(t.count));
  if (attrs.includes('size')) parts.push(SIZE_WORD[t.size]);
  parts.push(lookWord(t.look));
  parts.push(t.count > 1 ? plural(kind) : kind);
  return parts.join(' ');
};

/** Kinds that visibly change when turned by 45° or 90° steps (asymmetric under those turns). */
export const TURN_KINDS: ShapeKind[] = ['arrow', 'heart', 'semicircle'];

export const plural = (w: string): string => (/(s|sh|ch|x)$/.test(w) ? `${w}es` : `${w}s`);
