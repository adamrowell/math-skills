import { describe, expect, it } from 'vitest';
import { EMPTY_MASTERY, pickNextFact } from '../../drill';
import { mixedGenerator } from './facts';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function solve(f: { prompt: string }): number {
  const m = /^(\d+) ([×÷+−]) (\d+)$/.exec(f.prompt);
  if (!m) throw new Error(f.prompt);
  const a = Number(m[1]);
  const b = Number(m[3]);
  return m[2] === '×' ? a * b : m[2] === '÷' ? a / b : m[2] === '+' ? a + b : a - b;
}

describe('mixed blitz', () => {
  it('op shares ≈ 35/25/25/15 and every problem is well-formed', () => {
    const r = rng(3);
    const counts: Record<string, number> = { '×': 0, '÷': 0, '+': 0, '−': 0 };
    const N = 4000;
    const facts = mixedGenerator.factsForSet('all', EMPTY_MASTERY);
    const recent: string[] = [];
    for (let i = 0; i < N; i++) {
      const slot = pickNextFact({ facts, mastery: EMPTY_MASTERY, speed: mixedGenerator.speed, recent, sessionWrong: {}, sessionRecovered: {}, comeback: [], questionIndex: i, rng: r }).fact;
      recent.push(slot.id);
      if (recent.length > 12) recent.shift();
      const f = mixedGenerator.instantiate!(slot, r);
      counts[f.op]++;
      expect(solve(f)).toBe(f.answer);
      expect(Number.isInteger(f.answer)).toBe(true);
      expect(f.answer).toBeGreaterThanOrEqual(0);
      expect(f.answer).toBeLessThanOrEqual(198);
      expect(f.speed).toBeDefined();
    }
    expect(counts['×'] / N).toBeGreaterThan(0.3);
    expect(counts['×'] / N).toBeLessThan(0.4);
    expect(counts['÷'] / N).toBeGreaterThan(0.2);
    expect(counts['+'] / N).toBeGreaterThan(0.2);
    expect(counts['−'] / N).toBeGreaterThan(0.1);
    expect(counts['−'] / N).toBeLessThan(0.2);
  });

  it('sets restrict the operations', () => {
    const r = rng(9);
    for (const [set, ops] of [
      ['times-divide', ['×', '÷']],
      ['plus-minus', ['+', '−']],
    ] as const) {
      const facts = mixedGenerator.factsForSet(set, EMPTY_MASTERY);
      for (let i = 0; i < 200; i++) {
        const f = mixedGenerator.instantiate!(facts[i % facts.length], r);
        expect(ops).toContain(f.op);
      }
    }
  });
});
