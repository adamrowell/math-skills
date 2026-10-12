import type { P, Picture } from './pictures';
import { PICTURES } from './pictures';

export type LevelId = 'easy' | 'medium' | 'hard' | 'expert';

export interface Level {
  id: LevelId;
  name: string;
  emoji: string;
  blurb: string;
  /** Grid range on both axes. */
  min: number;
  max: number;
  /** Axis numbers every `labelStep`. */
  labelStep: number;
  /** Desktop hover: 'coords' = crosshair + (x, y) readout, 'dot' = nearest-dot ring, 'none'. */
  hover: 'coords' | 'dot' | 'none';
  /** Per-point points multiplier (helpers make Easy easier). */
  mult: number;
  /** Speed bonus thresholds (ms from the target appearing). */
  fastMs: number;
  okMs: number;
  /** Completed drawings needed to unlock. */
  unlockAt: number;
}

export const LEVELS: readonly Level[] = [
  {
    id: 'easy',
    name: 'Easy',
    emoji: '🐣',
    blurb: '0 to 10 · helper on',
    min: 0,
    max: 10,
    labelStep: 1,
    hover: 'coords',
    mult: 0.6,
    fastMs: 4000,
    okMs: 8000,
    unlockAt: 0,
  },
  {
    id: 'medium',
    name: 'Medium',
    emoji: '🙂',
    blurb: '0 to 10',
    min: 0,
    max: 10,
    labelStep: 1,
    hover: 'dot',
    mult: 1,
    fastMs: 4000,
    okMs: 8000,
    unlockAt: 0,
  },
  {
    id: 'hard',
    name: 'Hard',
    emoji: '💪',
    blurb: '0 to 12 · count!',
    min: 0,
    max: 12,
    labelStep: 2,
    hover: 'none',
    mult: 1.25,
    fastMs: 5000,
    okMs: 10000,
    unlockAt: 0,
  },
  {
    id: 'expert',
    name: 'Expert',
    emoji: '🚀',
    blurb: '−6 to 6 · 4 corners',
    min: -6,
    max: 6,
    labelStep: 1,
    hover: 'none',
    mult: 1.5,
    fastMs: 6000,
    okMs: 12000,
    unlockAt: 5,
  },
];

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function isLevelId(id: string): id is LevelId {
  return LEVELS.some((l) => l.id === id);
}

/** Pictures playable at a level. */
export function picturesFor(level: Level): Picture[] {
  if (level.id === 'easy') return PICTURES.filter((p) => p.easy);
  if (level.id === 'medium') return PICTURES.filter((p) => p.size === 10);
  return [...PICTURES];
}

/** How a picture's native 0..size coordinates move onto the level's grid (centred). */
export function offsetFor(level: Level, pic: Picture): number {
  const span = level.max - level.min;
  return level.min + Math.floor((span - pic.size) / 2);
}

export function place(p: P, off: number): P {
  return [p[0] + off, p[1] + off];
}
