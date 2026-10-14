/**
 * A tiny attribute model for "figure" puzzles (odd-one-out, analogy): a figure is `count` copies of
 * one shape with a colour, size, fill pattern, rotation and (for L only) a flip, plus optional dots.
 * `renderFigure` turns it into nodes; `readFigure` reads the attributes back from nodes, so
 * validators work from the picture itself, not from the generator's notes.
 */
import type { Color, FillPattern, ShapeKind, ShapeNode, VisualNode, VisualSpec } from '../engine/types';
import { shape, spec, walk } from './kit';

export type SizeClass = 0 | 1 | 2;

export interface Figure {
  kind: ShapeKind;
  color: Color;
  size: SizeClass;
  pattern: FillPattern;
  rot: number;
  flip: boolean;
  count: number;
  /** Dots drawn inside a single shape (dots-vs-sides puzzles). */
  dots?: number;
  /** Second shape kind for "pair" figures (count = 2, two kinds). */
  kind2?: ShapeKind;
  color2?: Color;
}

export const SIZE_PX: Record<SizeClass, number> = { 0: 0.42, 1: 0.6, 2: 0.82 };
const COUNT_SCALE = [1, 1, 0.62, 0.52, 0.46];

export const SIDES: Partial<Record<ShapeKind, number>> = {
  triangle: 3,
  'right-triangle': 3,
  square: 4,
  rect: 4,
  diamond: 4,
  trapezoid: 4,
  parallelogram: 4,
  pentagon: 5,
  hexagon: 6,
  L: 6,
  cross: 12,
  star: 10,
  arrow: 7,
};
export const CURVY: ShapeKind[] = ['circle', 'heart', 'moon'];

const POS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [
    [-0.24, 0],
    [0.24, 0],
  ],
  3: [
    [0, -0.21],
    [-0.24, 0.2],
    [0.24, 0.2],
  ],
  4: [
    [-0.22, -0.22],
    [0.22, -0.22],
    [-0.22, 0.22],
    [0.22, 0.22],
  ],
};

/** Dot positions inside a shape (unit, centred). */
const DOTS: Record<number, Array<[number, number]>> = {
  1: [[0, 0.04]],
  2: [
    [-0.1, 0.06],
    [0.1, 0.06],
  ],
  3: [
    [0, -0.06],
    [-0.11, 0.12],
    [0.11, 0.12],
  ],
  4: [
    [-0.1, -0.07],
    [0.1, -0.07],
    [-0.1, 0.12],
    [0.1, 0.12],
  ],
  5: [
    [-0.12, -0.08],
    [0.12, -0.08],
    [0, 0.03],
    [-0.12, 0.14],
    [0.12, 0.14],
  ],
  6: [
    [-0.12, -0.1],
    [0, -0.1],
    [0.12, -0.1],
    [-0.12, 0.1],
    [0, 0.1],
    [0.12, 0.1],
  ],
  7: [
    [-0.12, -0.12],
    [0, -0.12],
    [0.12, -0.12],
    [-0.15, 0.04],
    [0, 0.04],
    [0.15, 0.04],
    [0, 0.17],
  ],
};

/** Nodes for a figure centred at (cx, cy) inside a `box`-wide square. */
export function renderFigure(f: Figure, cx: number, cy: number, box: number): VisualNode[] {
  const pos = POS[Math.min(4, Math.max(1, f.count))];
  const px = SIZE_PX[f.size] * COUNT_SCALE[Math.min(4, f.count)] * box;
  const out: VisualNode[] = pos.map(([x, y], i) => {
    const second = f.kind2 && i === 1;
    return shape(second ? f.kind2! : f.kind, cx + x * box, cy + y * box, px, {
      fill: second && f.color2 ? f.color2 : f.color,
      pattern: f.pattern,
      rotate: f.rot || undefined,
      flipX: f.flip || undefined,
    });
  });
  if (f.dots) {
    for (const [x, y] of DOTS[f.dots] ?? []) out.push(shape('dot', cx + x * box * 1.15, cy + y * box * 1.15, box * 0.07, { fill: 'ink' }));
  }
  return out;
}

export function figureSpec(f: Figure, label?: string): VisualSpec {
  return spec(100, 100, renderFigure(f, 50, 50, 100), label ?? describe(f));
}

const SIZE_WORD = ['small', 'medium', 'big'];
export function describe(f: Figure): string {
  return `${f.count > 1 ? `${f.count} ` : ''}${SIZE_WORD[f.size]} ${f.color} ${f.kind}${f.count > 1 ? 's' : ''}${f.dots ? ` with ${f.dots} dots` : ''}`;
}

/** What a validator can see. */
export interface SeenFigure {
  kinds: string;
  colors: string;
  pattern: string;
  size: number;
  rot: number;
  flip: boolean;
  count: number;
  dots: number;
  /** sides of the single main shape, -1 when curvy or several. */
  sides: number;
  curvy: boolean;
  chirality: string;
  pairSame: boolean;
}

export function readFigure(nodes: VisualNode[], box = 100): SeenFigure {
  const shapes: ShapeNode[] = [];
  walk(nodes, (n) => {
    if (n.t === 'shape') shapes.push(n);
  });
  const main = shapes.filter((s) => s.kind !== 'dot');
  const dots = shapes.length - main.length;
  const count = main.length;
  const first = main[0];
  const raw = first ? first.size / (COUNT_SCALE[Math.min(4, count)] * box) : 0;
  const size = Math.round(raw * 100);
  const kinds = main.map((s) => s.kind).sort();
  return {
    kinds: [...new Set(kinds)].join('+'),
    // What is *visible*: an empty shape is drawn white with only an outline, so its fill colour
    // can't be seen and must not count as a difference.
    colors: main
      .map((s) => (s.pattern === 'empty' ? 'none' : (s.fill ?? 'white')))
      .sort()
      .join('+'),
    pattern: main
      .map((s) => s.pattern ?? 'solid')
      .sort()
      .join('+'),
    size,
    rot: (((first?.rotate ?? 0) % 360) + 360) % 360,
    flip: Boolean(first?.flipX),
    count,
    dots,
    sides: count === 1 ? (SIDES[first.kind] ?? -1) : -1,
    curvy: main.length > 0 && main.every((s) => CURVY.includes(s.kind)),
    chirality: first && first.kind === 'L' ? (first.flipX ? 'left' : 'right') : 'none',
    pairSame: count === 2 && kinds[0] === kinds[1],
  };
}

export const sameSeen = (a: SeenFigure, b: SeenFigure) => JSON.stringify(a) === JSON.stringify(b);
