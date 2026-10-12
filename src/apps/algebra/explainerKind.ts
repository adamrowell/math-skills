import type { LevelId } from './problems';

export type ExplainerKind = 'x' | 'paper' | 'pics';

/** The one-time explainer for a level, or null when already seen. */
export function explainerFor(level: LevelId, seen: string[]): ExplainerKind | null {
  const k: ExplainerKind | null = level === 3 ? 'x' : level === 4 ? 'paper' : level === 5 ? 'pics' : null;
  return k && !seen.includes(k) ? k : null;
}
