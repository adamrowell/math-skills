import { describe, expect, it } from 'vitest';
import { answerPoints, buildChoices, dueBoost, missPenalty, nextRecent, pickTarget, scheduleComeback, starsFor } from './logic';
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

describe('no-repeat scheduling across rounds', () => {
  it('a 12-target stage asks 12 different targets in 12 questions (500 rounds, with recent seeding)', () => {
    const rng = seeded(21);
    let prev: string[] = [];
    for (let trial = 0; trial < 500; trial++) {
      const asked: string[] = [];
      for (let i = 0; i < 12; i++) {
        const id = pickTarget({ candidates: cands(12), mastery: {}, asked, missed: new Set(), comeback: new Map(), index: i, speed: FIND_SPEED, rng, prevRecent: prev, now: 1e12 });
        if (i < prev.length) expect(prev).not.toContain(id);
        asked.push(id);
      }
      expect(new Set(asked).size).toBe(12);
      prev = nextRecent(asked);
      expect(prev).toHaveLength(4);
    }
  });

  it('the first question never equals one of the previous round’s last 4', () => {
    const rng = seeded(4);
    for (let t = 0; t < 300; t++) {
      const prev = ['r0', 'r1', 'r2', 'r3'];
      const id = pickTarget({ candidates: cands(36), mastery: {}, asked: [], missed: new Set(), comeback: new Map(), index: 0, speed: FIND_SPEED, rng, prevRecent: prev });
      expect(prev).not.toContain(id);
    }
  });

  it('falls back gracefully when the hold-back would block everything', () => {
    const id = pickTarget({ candidates: cands(2), mastery: {}, asked: [], missed: new Set(), comeback: new Map(), index: 0, speed: FIND_SPEED, rng: seeded(1), prevRecent: ['r0', 'r1'] });
    expect(['r0', 'r1']).toContain(id);
  });

  it('dueBoost: stale-but-known ×2, fresh mastered ×0.6, else ×1', () => {
    const now = 100 * 86_400_000;
    const m = (box: 0 | 1 | 2 | 3 | 4 | 5, daysAgo: number) => ({ box, attempts: 1, correct: 1, avgMs: 0, bestMs: 0, lastSeen: now - daysAgo * 86_400_000, lastWrong: 0 });
    expect(dueBoost(undefined, now)).toBe(1);
    expect(dueBoost(m(3, 4), now)).toBe(2);
    expect(dueBoost(m(2, 10), now)).toBe(1);
    expect(dueBoost(m(5, 0.5), now)).toBe(0.6);
    expect(dueBoost(m(5, 2), now)).toBe(1);
    expect(dueBoost(m(3, 4), now)).toBeGreaterThan(dueBoost(m(5, 0.5), now));
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

describe('variety across rounds (big pools)', () => {
  it('covers a 24-place pool in 2–3 rounds when he gets everything right', () => {
    let two = 0;
    let three = 0;
    const T = 200;
    for (let t = 0; t < T; t++) {
      const rng = seeded(1000 + t);
      const mastery: Record<string, import('../../drill').FactMastery> = {};
      const seen = new Set<string>();
      let prev: string[] = [];
      let now = 1e12;
      for (let round = 0; round < 3; round++) {
        const asked: string[] = [];
        for (let i = 0; i < 12; i++) {
          const id = pickTarget({ candidates: cands(24), mastery, asked, missed: new Set(), comeback: new Map(), index: i, speed: FIND_SPEED, rng, prevRecent: prev, now });
          asked.push(id);
          seen.add(id);
          const m = mastery[id] ?? { box: 0, attempts: 0, correct: 0, avgMs: 0, bestMs: 0, lastSeen: 0, lastWrong: 0 };
          mastery[id] = { ...m, box: Math.min(5, m.box + 1) as 0 | 1 | 2 | 3 | 4 | 5, attempts: m.attempts + 1, correct: m.correct + 1, avgMs: 2500, bestMs: 2500, lastSeen: now };
          now += 5000;
        }
        prev = nextRecent(asked);
        if (round === 1) two += seen.size;
        if (round === 2) three += seen.size;
        now += 60_000;
      }
    }
    expect(two / T).toBeGreaterThanOrEqual(22);
    expect(three / T).toBeGreaterThanOrEqual(23.5);
  });
});
