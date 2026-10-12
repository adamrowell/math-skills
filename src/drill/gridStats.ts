import type { MasteryGridProps } from './types';

/** Share of grid facts at box 5, and at ≥ 3. */
export function gridStats(
  generator: MasteryGridProps['generator'],
  mastery: MasteryGridProps['mastery'],
): { gold: number; learning: number; total: number } {
  const g = generator.grid;
  if (!g) return { gold: 0, learning: 0, total: 0 };
  let gold = 0;
  let learning = 0;
  let total = 0;
  for (const r of g.rows)
    for (const c of g.cols) {
      const id = g.cellFactId(r, c);
      if (!id) continue;
      total++;
      const b = mastery.facts[id]?.box ?? 0;
      if (b >= 5) gold++;
      if (b >= 3) learning++;
    }
  return { gold, learning, total };
}
