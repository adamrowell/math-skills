/**
 * Points economy: points must work as a parent's reward currency.
 *  - a good 60 s sprint lands in the hundreds, not the thousands;
 *  - practising hard facts pays more per minute than farming an easy table;
 *  - 0s/1s/12s do not crowd a brand-new learner's first rounds.
 */
import { describe, expect, it } from 'vitest';
import { comboMilestone, comboMultiplier, isRealRound, roundBonuses, scoreAnswer } from './scoring';
import { pickNextFact } from './scheduler';
import { EMPTY_MASTERY } from './mastery';
import { multiplicationGenerator as g, setPointsMult } from '../apps/multiplication/facts';
import type { Fact } from './types';

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

/** Average points for a 60 s sprint on `setId` answering every `secs` seconds with accuracy `acc`. */
function sprint(setId: string, secs: number, acc: number, rounds = 200): number {
  const rng = mulberry32(42);
  const facts = g.factsForSet(setId, EMPTY_MASTERY);
  let total = 0;
  for (let r = 0; r < rounds; r++) {
    let t = 0;
    let combo = 0;
    let recent: string[] = [];
    let q = 0;
    while (t < 60) {
      const { fact } = pickNextFact({ facts, mastery: EMPTY_MASTERY, speed: g.speed, recent, sessionWrong: {}, sessionRecovered: {}, comeback: [], questionIndex: q++, rng });
      recent = [...recent, fact.id].slice(-12);
      const right = rng() < acc;
      if (right) {
        combo++;
        total += scoreAnswer({ fact, ms: secs * 1000, combo, attempt: 1, speed: g.speed, pointsMult: setPointsMult(setId) }).points;
        t += secs + 0.3;
      } else {
        combo = 0;
        t += secs + 2.5; // retype
      }
    }
  }
  return total / rounds;
}

const fact = (a: number, b: number): Fact => g.allFacts().find((f) => f.id === `mul:${a}x${b}`)!;

describe('scoring', () => {
  it('7×8 is worth about 3× a 2×3 and far more than 0×5', () => {
    const s = (f: Fact) => scoreAnswer({ fact: f, ms: 1500, combo: 1, attempt: 1, speed: g.speed }).points;
    expect(s(fact(7, 8)) / s(fact(2, 3))).toBeGreaterThan(2.5);
    expect(s(fact(7, 8)) / s(fact(0, 5))).toBeGreaterThan(5);
  });

  it('gold (box 5) facts pay ~60% of a fact still being learned', () => {
    const s = (box?: number) => scoreAnswer({ fact: fact(7, 8), ms: 1500, combo: 1, attempt: 1, speed: g.speed, box }).points;
    expect(s(5) / s(0)).toBeGreaterThan(0.5);
    expect(s(5) / s(0)).toBeLessThan(0.7);
    expect(s(4)).toBeLessThan(s(2));
    expect(s(undefined)).toBe(s(0));
  });

  it('the retype (second attempt) scores nothing', () => {
    expect(scoreAnswer({ fact: fact(7, 8), ms: 500, combo: 9, attempt: 2, speed: g.speed }).points).toBe(0);
  });

  it('combo multiplier tops out at 1.5× and milestone copy has no decimals', () => {
    expect([1, 5, 10, 20, 99].map(comboMultiplier)).toEqual([1, 1.15, 1.3, 1.5, 1.5]);
    for (const c of [5, 10, 20, 30]) expect(comboMilestone(c)).toMatch(/in a row/);
    expect(comboMilestone(7)).toBeNull();
  });

  it('a good kid scores hundreds per sprint, a learning kid ~100-250', () => {
    const good = sprint('all', 2.2, 0.85);
    const learning = sprint('all', 3.5, 0.75);
    expect(good).toBeGreaterThan(250);
    expect(good).toBeLessThan(700);
    expect(learning).toBeGreaterThan(80);
    expect(learning).toBeLessThan(260);
  });

  it('a perfect robot sprint stays far below the old 10,000', () => {
    expect(sprint('all', 0.6, 1, 20)).toBeLessThan(2500);
  });

  it('farming an easy table pays less per minute than practising the hard ones', () => {
    const hard = sprint('hard', 1.8, 0.95);
    for (const easy of [sprint('table-10', 1.0, 1), sprint('table-2', 1.2, 1), sprint('easy', 1.1, 1)]) {
      expect(easy).toBeLessThan(hard);
    }
  });

  it('round bonuses: new-best and first-round bonuses only when asked for', () => {
    expect(roundBonuses({ newBest: false, answered: 5, correct: 0 }).total).toBe(0);
    expect(roundBonuses({ newBest: true, answered: 20, correct: 20, firstRound: true }).total).toBe(50 + 25 + 40 + 50);
    expect(isRealRound(20, 0)).toBe(false);
    expect(isRealRound(9, 9)).toBe(false);
    expect(isRealRound(12, 10)).toBe(true);
  });
});

describe('fresh learner mix', () => {
  it('12s get no more than a fair share of a brand-new "All" round and 0s/1s stay rare', () => {
    const facts = g.factsForSet('all', EMPTY_MASTERY);
    const rng = mulberry32(3);
    let recent: string[] = [];
    let twelves = 0;
    let trivial = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const { fact: f } = pickNextFact({ facts, mastery: EMPTY_MASTERY, speed: g.speed, recent, sessionWrong: {}, sessionRecovered: {}, comeback: [], questionIndex: i, rng });
      recent = [...recent, f.id].slice(-12);
      if (f.operands.includes(12)) twelves++;
      if (Math.min(...f.operands) <= 1) trivial++;
    }
    expect(twelves / N).toBeLessThan(0.21); // ≈ their fair share (21 of 121 non-trivial facts), was 24%
    expect(trivial / N).toBeLessThan(0.08);
  });

  it('single-table sets never ask ×0 or ×1', () => {
    for (const n of [2, 7, 12]) {
      for (const f of g.factsForSet(`table-${n}`, EMPTY_MASTERY)) expect(Math.min(...f.operands)).toBeGreaterThanOrEqual(2);
    }
  });
});
