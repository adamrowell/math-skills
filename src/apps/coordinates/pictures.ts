/**
 * Dot Drawing pictures. Each picture is a list of parts; every point of every part is one
 * target he plots, in order. Consecutive points of a part are joined by a line; `closed`
 * also joins the last point back to the first; `fill` colours the part's polygon once its
 * last point is placed. A one-point part is a big dot (an eye, a wheel).
 *
 * Coordinates are on a first-quadrant grid 0..size. Levels re-centre them (see levels.ts).
 */

export type P = readonly [number, number];

export interface Part {
  pts: readonly P[];
  closed?: boolean;
  /** Fill colour, or 'rainbow' for the banded rainbow gradient. */
  fill?: string;
  /** Line colour (default ink). */
  line?: string;
  /** Line width in grid units (default 0.14). */
  width?: number;
  /** Radius (grid units) for one-point parts. */
  r?: number;
}

export interface Picture {
  id: string;
  name: string;
  emoji: string;
  /** Native grid: 0..size on both axes. */
  size: 10 | 12;
  /** In the Easy pool (few points, simple shape). */
  easy?: boolean;
  parts: readonly Part[];
  /** Rainbow gradient centre / radii (only for fill 'rainbow'). */
  rainbow?: { c: P; r0: number; r1: number };
}

const INK = '#1b2559';

export const PICTURES: readonly Picture[] = [
  {
    id: 'star',
    name: 'Star',
    emoji: '⭐',
    size: 10,
    easy: true,
    parts: [
      {
        pts: [[5, 10], [6, 7], [10, 7], [7, 4], [8, 0], [5, 2], [2, 0], [3, 4], [0, 7], [4, 7]],
        closed: true,
        fill: '#FFC93C',
      },
    ],
  },
  {
    id: 'heart',
    name: 'Heart',
    emoji: '❤️',
    size: 10,
    easy: true,
    parts: [
      {
        pts: [[5, 1], [1, 5], [1, 7], [2, 8], [4, 8], [5, 7], [6, 8], [8, 8], [9, 7], [9, 5]],
        closed: true,
        fill: '#FF4D6D',
      },
    ],
  },
  {
    id: 'lightning',
    name: 'Lightning Bolt',
    emoji: '⚡',
    size: 10,
    easy: true,
    parts: [
      {
        pts: [[5, 10], [2, 5], [5, 5], [3, 0], [8, 6], [5, 6], [8, 10]],
        closed: true,
        fill: '#FFD43B',
      },
    ],
  },
  {
    id: 'house',
    name: 'House',
    emoji: '🏠',
    size: 10,
    easy: true,
    parts: [
      { pts: [[2, 1], [8, 1], [8, 6], [2, 6]], closed: true, fill: '#FFD8A8' },
      { pts: [[1, 6], [5, 9], [9, 6]], closed: true, fill: '#E03131' },
      { pts: [[4, 1], [4, 4], [6, 4], [6, 1]], closed: true, fill: '#8B5A2B' },
    ],
  },
  {
    id: 'icecream',
    name: 'Ice Cream',
    emoji: '🍦',
    size: 10,
    easy: true,
    parts: [
      { pts: [[3, 5], [5, 0], [7, 5]], closed: true, fill: '#E9B872' },
      { pts: [[2, 5], [2, 7], [3, 9], [5, 10], [7, 9], [8, 7], [8, 5]], closed: true, fill: '#FF8FB1' },
    ],
  },
  {
    id: 'tree',
    name: 'Pine Tree',
    emoji: '🌲',
    size: 10,
    easy: true,
    parts: [
      { pts: [[4, 0], [4, 3], [6, 3], [6, 0]], closed: true, fill: '#8B5A2B' },
      { pts: [[1, 3], [4, 6], [2, 6], [5, 10], [8, 6], [6, 6], [9, 3]], closed: true, fill: '#2F9E44' },
    ],
  },
  {
    id: 'crown',
    name: 'Crown',
    emoji: '👑',
    size: 10,
    easy: true,
    parts: [
      { pts: [[1, 2], [1, 8], [3, 5], [5, 9], [7, 5], [9, 8], [9, 2]], closed: true, fill: '#FCC419' },
      { pts: [[3, 3]], fill: '#E03131', r: 0.55 },
      { pts: [[5, 3]], fill: '#1C7ED6', r: 0.55 },
      { pts: [[7, 3]], fill: '#2F9E44', r: 0.55 },
    ],
  },
  {
    id: 'sailboat',
    name: 'Sailboat',
    emoji: '⛵',
    size: 10,
    easy: true,
    parts: [
      { pts: [[5, 3], [5, 10], [9, 4], [5, 4]], fill: '#FFFFFF' },
      { pts: [[4, 8], [4, 4], [1, 4]], closed: true, fill: '#FFE066' },
      { pts: [[0, 3], [10, 3], [8, 1], [2, 1]], closed: true, fill: '#C2410C' },
    ],
  },
  {
    id: 'sword',
    name: 'Diamond Sword',
    emoji: '🗡️',
    size: 10,
    easy: true,
    parts: [
      { pts: [[4, 3], [4, 9], [5, 10], [6, 9], [6, 3]], closed: true, fill: '#4FD1C5' },
      { pts: [[2, 3], [8, 3], [8, 2], [2, 2]], closed: true, fill: '#6B4423' },
      { pts: [[4, 2], [4, 0], [6, 0], [6, 2]], closed: true, fill: '#8B5A2B' },
    ],
  },
  {
    id: 'fish',
    name: 'Fish',
    emoji: '🐟',
    size: 10,
    easy: true,
    parts: [
      { pts: [[1, 5], [3, 8], [6, 8], [8, 5], [6, 2], [3, 2]], closed: true, fill: '#4DABF7' },
      { pts: [[8, 5], [10, 8], [10, 2]], closed: true, fill: '#FF922B' },
      { pts: [[4, 8], [5, 10], [6, 8]], closed: true, fill: '#FF922B' },
      { pts: [[3, 6]], fill: INK, r: 0.4 },
    ],
  },
  {
    id: 'rocket',
    name: 'Rocket',
    emoji: '🚀',
    size: 10,
    parts: [
      { pts: [[3, 2], [3, 7], [5, 10], [7, 7], [7, 2]], closed: true, fill: '#E9ECEF' },
      { pts: [[3, 4], [1, 1], [3, 2]], closed: true, fill: '#E03131' },
      { pts: [[7, 4], [9, 1], [7, 2]], closed: true, fill: '#E03131' },
      { pts: [[4, 2], [5, 0], [6, 2]], closed: true, fill: '#FF922B' },
      { pts: [[5, 6]], fill: '#4DABF7', r: 0.75 },
    ],
  },
  {
    id: 'cat',
    name: 'Cat',
    emoji: '🐱',
    size: 10,
    parts: [
      {
        pts: [[3, 1], [2, 3], [2, 7], [3, 9], [4, 7], [6, 7], [7, 9], [8, 7], [8, 3], [7, 1]],
        closed: true,
        fill: '#FFA94D',
      },
      { pts: [[4, 5]], fill: '#2B8A3E', r: 0.45 },
      { pts: [[6, 5]], fill: '#2B8A3E', r: 0.45 },
      { pts: [[5, 3]], fill: '#F06595', r: 0.35 },
      { pts: [[0, 4], [3, 3]] },
      { pts: [[10, 4], [7, 3]] },
    ],
  },
  {
    id: 'car',
    name: 'Race Car',
    emoji: '🚗',
    size: 10,
    parts: [
      { pts: [[0, 2], [0, 5], [2, 5], [3, 8], [7, 8], [8, 5], [10, 5], [10, 2]], closed: true, fill: '#F03E3E' },
      { pts: [[3, 5], [4, 7], [6, 7], [7, 5]], closed: true, fill: '#A5D8FF' },
      { pts: [[2, 2]], fill: '#343A40', r: 1.1 },
      { pts: [[8, 2]], fill: '#343A40', r: 1.1 },
    ],
  },
  {
    id: 'creeper',
    name: 'Creeper',
    emoji: '🟩',
    size: 10,
    parts: [
      { pts: [[1, 1], [9, 1], [9, 9], [1, 9]], closed: true, fill: '#5DBB4C' },
      { pts: [[2, 7], [4, 7], [4, 5], [2, 5]], closed: true, fill: '#111111' },
      { pts: [[6, 7], [8, 7], [8, 5], [6, 5]], closed: true, fill: '#111111' },
      {
        pts: [[4, 5], [6, 5], [6, 4], [7, 4], [7, 1], [6, 1], [6, 2], [4, 2], [4, 1], [3, 1], [3, 4], [4, 4]],
        closed: true,
        fill: '#111111',
      },
    ],
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    emoji: '🌈',
    size: 10,
    rainbow: { c: [5, 1], r0: 3, r1: 5 },
    parts: [
      {
        pts: [[0, 1], [1, 4], [2, 5], [5, 6], [8, 5], [9, 4], [10, 1], [8, 1], [7, 3], [5, 4], [3, 3], [2, 1]],
        closed: true,
        fill: 'rainbow',
      },
      { pts: [[1, 1]], fill: '#FFFFFF', line: '#ADB5BD', r: 1.2 },
      { pts: [[9, 1]], fill: '#FFFFFF', line: '#ADB5BD', r: 1.2 },
    ],
  },
  {
    id: 'robot',
    name: 'Robot',
    emoji: '🤖',
    size: 12,
    parts: [
      { pts: [[4, 8], [4, 11], [8, 11], [8, 8]], closed: true, fill: '#CED4DA' },
      { pts: [[5, 10]], fill: '#22B8CF', r: 0.4 },
      { pts: [[7, 10]], fill: '#22B8CF', r: 0.4 },
      { pts: [[5, 9], [7, 9]] },
      { pts: [[3, 3], [3, 8], [9, 8], [9, 3]], closed: true, fill: '#4C6EF5' },
      { pts: [[6, 5]], fill: '#FF6B6B', r: 0.6 },
      { pts: [[3, 7], [1, 4]], width: 0.3 },
      { pts: [[9, 7], [11, 4]], width: 0.3 },
      { pts: [[4, 3], [4, 0]], width: 0.3 },
      { pts: [[8, 3], [8, 0]], width: 0.3 },
    ],
  },
  {
    id: 'dino',
    name: 'Dinosaur',
    emoji: '🦕',
    size: 12,
    parts: [
      {
        pts: [
          [0, 4], [4, 7], [7, 7], [9, 10], [10, 11], [12, 11], [12, 10], [10, 9],
          [9, 6], [9, 1], [8, 1], [8, 3], [5, 3], [5, 1], [4, 1], [4, 4],
        ],
        closed: true,
        fill: '#69DB7C',
      },
      { pts: [[11, 10]], fill: INK, r: 0.3 },
    ],
  },
  {
    id: 'castle',
    name: 'Castle',
    emoji: '🏰',
    size: 12,
    parts: [
      {
        pts: [
          [1, 0], [1, 10], [3, 10], [3, 8], [4, 8], [4, 9], [5, 9], [5, 8],
          [7, 8], [7, 9], [8, 9], [8, 8], [9, 8], [9, 10], [11, 10], [11, 0],
        ],
        closed: true,
        fill: '#ADB5BD',
      },
      { pts: [[5, 0], [5, 3], [6, 4], [7, 3], [7, 0]], closed: true, fill: '#8B5A2B' },
      { pts: [[2, 8]], fill: '#FFD43B', r: 0.45 },
      { pts: [[10, 8]], fill: '#FFD43B', r: 0.45 },
    ],
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    emoji: '🦋',
    size: 12,
    parts: [
      { pts: [[6, 6], [2, 11], [0, 9], [2, 6], [1, 2], [3, 1], [6, 5]], closed: true, fill: '#B197FC' },
      { pts: [[6, 6], [10, 11], [12, 9], [10, 6], [11, 2], [9, 1], [6, 5]], closed: true, fill: '#FF922B' },
      { pts: [[6, 2], [6, 9]], width: 0.45 },
      { pts: [[5, 11], [6, 9], [7, 11]] },
    ],
  },
];

export function pictureById(id: string): Picture | undefined {
  return PICTURES.find((p) => p.id === id);
}

/** Every target in order. */
export function targetsOf(p: Picture): P[] {
  return p.parts.flatMap((part) => part.pts);
}

export function pointCount(p: Picture): number {
  return p.parts.reduce((n, part) => n + part.pts.length, 0);
}
