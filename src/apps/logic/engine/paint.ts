/** Palette + shape outlines for <Visual> (pure; shared with tests). */
import type { Color, ShapeKind } from './types';

export const PALETTE: Record<Color, string> = {
  red: '#ff5a5f',
  blue: '#3d7bff',
  green: '#22c55e',
  yellow: '#ffc43d',
  purple: '#8b5cf6',
  orange: '#ff9f1c',
  pink: '#f472b6',
  teal: '#14b8a6',
  brown: '#a16207',
  grey: '#cbd2df',
  ink: '#1b2559',
  white: '#ffffff',
  none: 'none',
};

export const GRID_LINE = '#aab4d4';

type Pt = [number, number];

function regular(n: number, r: number, rot = -90): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)] as Pt;
  });
}

function star(points: number, outer: number, inner: number): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = ((-90 + (180 / points) * i) * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)] as Pt;
  });
}

export const r2 = (n: number) => Math.round(n * 100) / 100;
const poly = (pts: Pt[], s: number) => `M${pts.map(([x, y]) => `${r2(x * s)} ${r2(y * s)}`).join(' L')} Z`;

/**
 * Unit outlines (bounding circle of diameter 1, centred at 0,0), scaled by `size`.
 * L is drawn as an L-tetromino (3 tall + a foot): the 3-square tromino is mirror-symmetric about its
 * diagonal, which would make "mirror vs rotate" puzzles look identical.
 */
export function shapePath(kind: ShapeKind, size: number, aspect?: number): string {
  const s = size;
  switch (kind) {
    case 'square':
      return poly(
        [
          [-0.37, -0.37],
          [0.37, -0.37],
          [0.37, 0.37],
          [-0.37, 0.37],
        ],
        s,
      );
    case 'rect': {
      const h = (aspect ?? 0.6) / 2;
      return poly(
        [
          [-0.5, -h],
          [0.5, -h],
          [0.5, h],
          [-0.5, h],
        ],
        s,
      );
    }
    case 'triangle':
      return poly(
        [
          [0, -0.48],
          [0.46, 0.34],
          [-0.46, 0.34],
        ],
        s,
      );
    case 'right-triangle':
      return poly(
        [
          [-0.38, -0.4],
          [0.4, 0.38],
          [-0.38, 0.38],
        ],
        s,
      );
    case 'diamond':
      return poly(
        [
          [0, -0.5],
          [0.36, 0],
          [0, 0.5],
          [-0.36, 0],
        ],
        s,
      );
    case 'pentagon':
      return poly(regular(5, 0.48), s);
    case 'hexagon':
      return poly(regular(6, 0.47, 0), s);
    case 'star':
      return poly(star(5, 0.5, 0.21), s);
    case 'cross': {
      const a = 0.14;
      const b = 0.44;
      return poly(
        [
          [-a, -b],
          [a, -b],
          [a, -a],
          [b, -a],
          [b, a],
          [a, a],
          [a, b],
          [-a, b],
          [-a, a],
          [-b, a],
          [-b, -a],
          [-a, -a],
        ],
        s,
      );
    }
    case 'arrow':
      return poly(
        [
          [-0.46, -0.12],
          [0.08, -0.12],
          [0.08, -0.3],
          [0.48, 0],
          [0.08, 0.3],
          [0.08, 0.12],
          [-0.46, 0.12],
        ],
        s,
      );
    case 'trapezoid':
      return poly(
        [
          [-0.25, -0.28],
          [0.25, -0.28],
          [0.47, 0.28],
          [-0.47, 0.28],
        ],
        s,
      );
    case 'parallelogram': {
      const h = (aspect ?? 0.6) / 2;
      return poly(
        [
          [-0.22, -h],
          [0.5, -h],
          [0.22, h],
          [-0.5, h],
        ],
        s,
      );
    }
    case 'L':
      return poly(
        [
          [-0.27, -0.42],
          [0, -0.42],
          [0, 0.14],
          [0.27, 0.14],
          [0.27, 0.42],
          [-0.27, 0.42],
        ],
        s,
      );
    case 'heart':
      return `M0 ${r2(0.42 * s)} C${r2(-0.62 * s)} ${r2(0.0 * s)} ${r2(-0.38 * s)} ${r2(-0.52 * s)} 0 ${r2(-0.2 * s)} C${r2(0.38 * s)} ${r2(-0.52 * s)} ${r2(0.62 * s)} ${r2(0 * s)} 0 ${r2(0.42 * s)} Z`;
    case 'moon':
      // Crescent opening to the right.
      return `M${r2(0.12 * s)} ${r2(-0.46 * s)} A${r2(0.48 * s)} ${r2(0.48 * s)} 0 1 0 ${r2(0.12 * s)} ${r2(0.46 * s)} A${r2(0.36 * s)} ${r2(0.36 * s)} 0 1 1 ${r2(0.12 * s)} ${r2(-0.46 * s)} Z`;
    case 'semicircle':
      return `M${r2(-0.48 * s)} ${r2(0.2 * s)} A${r2(0.48 * s)} ${r2(0.48 * s)} 0 0 1 ${r2(0.48 * s)} ${r2(0.2 * s)} Z`;
    case 'circle':
    case 'dot':
    default:
      return `M${r2(-0.5 * s)} 0 A${r2(0.5 * s)} ${r2(0.5 * s)} 0 1 0 ${r2(0.5 * s)} 0 A${r2(0.5 * s)} ${r2(0.5 * s)} 0 1 0 ${r2(-0.5 * s)} 0 Z`;
  }
}

