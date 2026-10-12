import { describe, expect, it } from 'vitest';
import { answerPoints, buildChoices, missPenalty, pickTarget, scheduleComeback, starsFor } from './logic';
import type { Candidate } from './logic';
import { FIND_SPEED } from './logic';

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const cands = (n: number): Candidate[] => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, prior: 1 }));

describe('pickTarget', () => {
  it('never repeats within a 12-question round when there are ≥ 12 regions', () => {
    const rng = seeded(7);
    for (let trial = 0; trial < 50; trial++) {
      const asked: string[] = [];
      for (let i = 0; i < 12; i++) {
        asked.push(pickTarget({ candidates: cands(12), mastery: {}, asked, missed: new Set(), comeback: new Map(), index: i, speed: FIND_SPEED, rng }));
      }
      expect(new Set(asked).size).toBe(12);
    }
  });

  it('never asks the same region twice in a row in small sets', () => {
    const rng = seeded(3);
    const asked: string[] = [];
    for (let i = 0; i < 200; i++) {
      const id = pickTarget({ candidates: cands(5), mastery: {}, asked, missed: new Set(), comeback: new Map(), index: i, speed: FIND_SPEED, rng });
      expect(id).not.toBe(asked[asked.length - 1]);
      asked.push(id);
    }
  });

  it('brings a missed region back 3–5 questions later', () => {
    const rng = seeded(11);
    const comeback = new Map<string, number>();
    scheduleComeback(comeback, 'r3', 2, rng);
    const due = comeback.get('r3')!;
    expect(due).toBeGreaterThanOrEqual(5);
    expect(due).toBeLessThanOrEqual(7);
    const id = pickTarget({ candidates: cands(20), mastery: {}, asked: ['r0'], missed: new Set(['r3']), comeback, index: due, speed: FIND_SPEED, rng });
    expect(id).toBe('r3');
  });

  it('favours weak regions over mastered ones', () => {
    const rng = seeded(5);
    const counts: Record<string, number> = { weak: 0, strong: 0 };
    const mastered = { box: 5 as const, attempts: 10, correct: 10, avgMs: 1500, bestMs: 1000, lastSeen: 0, lastWrong: 0 };
    for (let i = 0; i < 4000; i++) {
      const id = pickTarget({
        candidates: [
          { id: 'weak', prior: 1 },
          { id: 'strong', prior: 1 },
          { id: 'x', prior: 1 },
        ],
        mastery: { strong: mastered },
        asked: ['x'],
        missed: new Set(),
        comeback: new Map(),
        index: 1,
        speed: FIND_SPEED,
        rng,
      });
      counts[id]++;
    }
    expect(counts.weak).toBeGreaterThan(counts.strong * 2.5);
  });
});

describe('buildChoices', () => {
  it('returns 3 distinct options including the answer and its nearest neighbour', () => {
    const pool = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 1, y: 0 },
      { id: 'c', x: 5, y: 0 },
      { id: 'd', x: 9, y: 0 },
      { id: 'e', x: 20, y: 0 },
    ];
    for (let s = 1; s < 30; s++) {
      const ch = buildChoices(pool[0], pool, seeded(s));
      expect(ch).toHaveLength(3);
      expect(new Set(ch).size).toBe(3);
      expect(ch).toContain('a');
      expect(ch).toContain('b');
    }
  });
});

describe('scoring', () => {
  it('pays most for a fast first try and nothing after the reveal', () => {
    const fast = answerPoints({ mode: 'find', prior: 1, ms: 2000, misses: 0, comboMult: 1 });
    const slow = answerPoints({ mode: 'find', prior: 1, ms: 20000, misses: 0, comboMult: 1 });
    expect(fast).toBe(24);
    expect(slow).toBe(16);
    expect(answerPoints({ mode: 'find', prior: 1, ms: 2000, misses: 1, comboMult: 1 })).toBe(5);
    expect(answerPoints({ mode: 'find', prior: 1, ms: 2000, misses: 2, comboMult: 1 })).toBe(0);
    expect(answerPoints({ mode: 'name', prior: 1, ms: 1000, misses: 0, comboMult: 1 })).toBeLessThan(fast);
  });

  it('guessing is worse than thinking: a miss costs more than a second-try correct earns', () => {
    expect(missPenalty(100)).toBe(5);
    expect(answerPoints({ mode: 'name', prior: 1, ms: 1000, misses: 1, comboMult: 1 })).toBeLessThan(missPenalty(100));
  });

  it('never takes a round below zero', () => {
    expect(missPenalty(0)).toBe(0);
    expect(missPenalty(3)).toBe(3);
  });

  it('stars', () => {
    expect(starsFor(12, 12)).toBe(3);
    expect(starsFor(9, 12)).toBe(2);
    expect(starsFor(6, 12)).toBe(1);
    expect(starsFor(5, 12)).toBe(0);
  });
});
