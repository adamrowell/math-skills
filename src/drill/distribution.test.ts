/**
 * Fact distribution for the Times Tables "Everything" set with a brand-new learner:
 * 0s and 1s must be rare, the notorious facts (6×7, 7×8, 8×9 …) frequent, no immediate repeats,
 * and every fact still shows up eventually.
 */
import { describe, expect, it } from 'vitest';
import { pickNextFact } from './scheduler';
import { EMPTY_MASTERY } from './mastery';
import { multiplicationGenerator } from '../apps/multiplication/facts';

/** Deterministic PRNG so the test never flakes. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(setId: string, n: number, seed = 7) {
  const g = multiplicationGenerator;
  const facts = g.factsForSet(setId, EMPTY_MASTERY);
  const rng = mulberry32(seed);
  const counts = new Map<string, number>();
  let recent: string[] = [];
  let repeats = 0;
  for (let i = 0; i < n; i++) {
    const { fact } = pickNextFact({
      facts,
      mastery: EMPTY_MASTERY,
      speed: g.speed,
      recent,
      sessionWrong: {},
      sessionRecovered: {},
      comeback: [],
      questionIndex: i,
      rng,
    });
    if (recent[recent.length - 1] === fact.id) repeats++;
    recent = [...recent, fact.id].slice(-12);
    counts.set(fact.id, (counts.get(fact.id) ?? 0) + 1);
  }
  return { counts, repeats, facts };
}

const ops = (id: string) => id.replace('mul:', '').split('x').map(Number) as [number, number];

describe('multiplication fact distribution', () => {
  const N = 40_000;
  const { counts, repeats, facts } = sample('all', N);
  const share = (pred: (a: number, b: number) => boolean) =>
    [...counts].filter(([id]) => pred(...ops(id))).reduce((s, [, c]) => s + c, 0) / N;

  it('covers all 169 facts', () => {
    expect(facts).toHaveLength(169);
    expect(counts.size).toBe(169);
  });

  it('0s and 1s are rare (well under 10% combined)', () => {
    const zerosOnes = share((a, b) => Math.min(a, b) <= 1);
    expect(zerosOnes).toBeLessThan(0.08);
    expect(zerosOnes).toBeGreaterThan(0.01); // still sprinkled in
  });

  it('hard facts (6–9 × 6–9) dominate', () => {
    const hard = share((a, b) => a >= 6 && a <= 9 && b >= 6 && b <= 9);
    // 16 of 169 facts (9.5%) → expect roughly double that share.
    expect(hard).toBeGreaterThan(0.17);
  });

  it('7×8 comes up far more often than 2×3 and 1×7', () => {
    const c = (id: string) => counts.get(id) ?? 0;
    const hard = c('mul:7x8') + c('mul:8x7');
    expect(hard / Math.max(1, c('mul:2x3') + c('mul:3x2'))).toBeGreaterThan(2.5);
    expect(hard / Math.max(1, c('mul:1x7') + c('mul:7x1'))).toBeGreaterThan(8);
  });

  it('never asks the same fact twice in a row', () => {
    expect(repeats).toBe(0);
  });

  it('table-7 practice only asks 7s and still avoids repeats', () => {
    const t = sample('table-7', 2000, 11);
    for (const id of t.counts.keys()) expect(ops(id)).toContain(7);
    expect(t.repeats).toBe(0);
  });
});
