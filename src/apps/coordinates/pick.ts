import type { Level } from './levels';
import { picturesFor } from './levels';
import type { Picture } from './pictures';
import type { GalleryState } from './store';

/**
 * Next mystery picture for a level: never-drawn pictures first, then ones not yet drawn at this
 * level, then the least-drawn; never the one just played when there is a choice.
 */
export function pickPicture(level: Level, g: GalleryState, exclude: string | null, rand: () => number = Math.random): Picture {
  const pool = picturesFor(level);
  const candidates = pool.length > 1 ? pool.filter((p) => p.id !== exclude) : pool;
  const rank = (p: Picture) => {
    const e = g.entries[p.id];
    if (!e) return 0;
    if (!e.levels.includes(level.id)) return 1;
    return 2 + e.count;
  };
  const bestRank = Math.min(...candidates.map(rank));
  const best = candidates.filter((p) => rank(p) === bestRank);
  return best[Math.floor(rand() * best.length) % best.length];
}
