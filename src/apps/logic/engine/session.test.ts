import { describe, expect, it } from 'vitest';
import { adapt, createRound, familyWeight, withSeen } from './session';
import { comboMultiplier, guessExpectation, pointsFor, speedBonus } from './scoring';
import { mulberry32 } from './rng';
import type { Difficulty, FamilyId, LogicProgress, Puzzle } from './types';
import { BASE_POINTS, MISS_PENALTY, SECOND_TRY_POINTS } from './types';
import { numberFamilies } from '../families';
import { FAMILIES } from './registry';
import { EMPTY_MASTERY } from '../../../drill/mastery';

const P0: LogicProgress = { version: 1, mode: 'adaptive', level: {}, streak: {}, seen: [], rounds: 0, best: {} };

function playRound(progress: LogicProgress, seed: number, families = numberFamilies, only?: FamilyId) {
  const r = createRound({ families, mode: progress.mode, progress, mastery: EMPTY_MASTERY, rng: mulberry32(seed), only });
  const out: Puzzle[] = [];
  for (let p = r.next(); p; p = r.next()) out.push(p);
  return out;
}

describe('round scheduling', () => {
  it('10 puzzles, ≥ 6 families, no family twice in a row, ≤ 2 per family, no repeated variant', () => {
    for (let s = 0; s < 200; s++) {
      const items = playRound(P0, s);
      expect(items.length).toBe(10);
      const fams = items.map((p) => p.family);
      expect(new Set(fams).size).toBeGreaterThanOrEqual(6);
      for (let i = 1; i < fams.length; i++) expect(fams[i]).not.toBe(fams[i - 1]);
      for (const f of new Set(fams)) expect(fams.filter((x) => x === f).length).toBeLessThanOrEqual(2);
      const vs = items.map((p) => `${p.family}:${p.variant}`);
      expect(new Set(vs).size).toBe(vs.length);
    }
  });

  it('works over every registered family too', () => {
    for (let s = 0; s < 30; s++) {
      const items = playRound(P0, s, FAMILIES);
      expect(items.length).toBe(10);
      expect(new Set(items.map((p) => p.family)).size).toBeGreaterThanOrEqual(6);
    }
  });

  it('never repeats a puzzle across 50 rounds with a shared seen list', () => {
    let prog = P0;
    const history: string[] = [];
    for (let s = 0; s < 50; s++) {
      const items = playRound(prog, 1000 + s);
      for (const p of items) {
        expect(history.slice(-300), `round ${s}: ${p.id}`).not.toContain(p.id);
        history.push(p.id);
      }
      prog = withSeen(prog, items.map((p) => p.id));
    }
    expect(prog.seen.length).toBe(300);
  });

  it('every family shows up within the first 3 rounds of a new player', () => {
    for (let s = 0; s < 20; s++) {
      const seen = new Set<FamilyId>();
      for (let r = 0; r < 3; r++) for (const p of playRound(P0, s * 10 + r)) seen.add(p.family);
      expect(seen.size).toBeGreaterThanOrEqual(numberFamilies.length - 1);
    }
  });

  it('family practice serves only that family, varied', () => {
    const items = playRound(P0, 7, numberFamilies, 'balance');
    expect(items.length).toBe(10);
    expect(new Set(items.map((p) => p.family))).toEqual(new Set(['balance']));
    expect(new Set(items.map((p) => p.id)).size).toBe(10);
  });

  it('fixed modes use that difficulty everywhere; adaptive uses the family level', () => {
    for (const [mode, d] of [
      ['easy', 1],
      ['medium', 2],
      ['hard', 3],
    ] as const)
      for (const p of playRound({ ...P0, mode }, 3)) expect(p.difficulty).toBe(d);
    const lv: LogicProgress = { ...P0, level: { 'seq-number': 3, balance: 2 } };
    for (let s = 0; s < 20; s++)
      for (const p of playRound(lv, s)) expect(p.difficulty).toBe(p.family === 'seq-number' ? 3 : p.family === 'balance' ? 2 : 1);
  });

  it('options are shuffled by the engine (answer position uniform)', () => {
    const pos: Record<number, number[]> = { 4: [0, 0, 0, 0] };
    for (let s = 0; s < 300; s++)
      for (const p of playRound({ ...P0, mode: 'easy' }, s)) if (p.answer.kind === 'choice' && p.answer.options.length === 4 && p.family !== 'maze-path') pos[4][p.answer.answerIndex]++;
    const tot = pos[4].reduce((a, b) => a + b, 0);
    for (const c of pos[4]) expect(Math.abs(c - tot / 4)).toBeLessThan(tot * 0.06);
  });

  it('weights: recently used families rest, maxed families stop', () => {
    const f = numberFamilies[0];
    expect(familyWeight(f, [f.id], new Map(), EMPTY_MASTERY)).toBe(0);
    expect(familyWeight(f, [f.id, 'balance', 'analogy', 'maze-path'], new Map(), EMPTY_MASTERY)).toBeGreaterThan(0);
    expect(familyWeight(f, [f.id, 'balance', f.id, 'analogy', 'maze-path'], new Map(), EMPTY_MASTERY)).toBe(0);
  });
});

describe('adaptive 2 up / 1 down', () => {
  const f: FamilyId = 'analogy';
  it('two first-try in a row → level up; a missed-out item → level down; second try resets the streak', () => {
    let p = adapt(P0, f, 0, 'adaptive');
    expect(p.level[f]).toBe(1);
    p = adapt(p, f, 0, 'adaptive');
    expect(p.level[f]).toBe(2);
    expect(p.streak[f]).toBe(0);
    p = adapt(p, f, 0, 'adaptive');
    p = adapt(p, f, 1, 'adaptive');
    expect(p.streak[f]).toBe(0);
    p = adapt(p, f, 0, 'adaptive');
    expect(p.level[f]).toBe(2);
    p = adapt(p, f, 0, 'adaptive');
    expect(p.level[f]).toBe(3);
    p = adapt(adapt(p, f, 0, 'adaptive'), f, 0, 'adaptive');
    expect(p.level[f]).toBe(3);
    p = adapt(p, f, 2, 'adaptive');
    expect(p.level[f]).toBe(2);
    p = adapt(adapt(p, f, 2, 'adaptive'), f, 2, 'adaptive');
    expect(p.level[f]).toBe(1);
  });
  it('fixed modes never move levels', () => {
    expect(adapt(P0, f, 0, 'hard')).toBe(P0);
    expect(adapt(P0, f, 2, 'easy')).toBe(P0);
  });
});

describe('scoring', () => {
  it('first try 15 / 25 / 40, second try 5, missed out 0', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      expect(pointsFor({ difficulty: d, ms: 1000, misses: 0, combo: 1, answerKind: 'choice' })).toBe(BASE_POINTS[d]);
      expect(pointsFor({ difficulty: d, ms: 1000, misses: 1, combo: 0, answerKind: 'choice' })).toBe(SECOND_TRY_POINTS);
      expect(pointsFor({ difficulty: d, ms: 1000, misses: 2, combo: 0, answerKind: 'number' })).toBe(0);
    }
    expect(MISS_PENALTY).toBe(5);
  });
  it('speed bonus only where guessing is impossible', () => {
    expect(speedBonus(2, 1000, 'choice')).toBe(0);
    expect(speedBonus(2, 1000, 'number')).toBeGreaterThan(0);
    expect(speedBonus(2, 25_000, 'number')).toBeGreaterThan(0);
    expect(speedBonus(2, 25_000, 'number')).toBeLessThan(speedBonus(2, 1000, 'number'));
    expect(speedBonus(2, 99_000, 'sudoku')).toBe(0);
  });
  it('combo tiers 1 / 1.15 / 1.3 / 1.5', () => {
    expect([1, 5, 10, 20].map(comboMultiplier)).toEqual([1, 1.15, 1.3, 1.5]);
    expect(pointsFor({ difficulty: 3, ms: 1, misses: 0, combo: 10, answerKind: 'choice' })).toBe(52);
  });
  it('practice pays half', () => {
    expect(pointsFor({ difficulty: 2, ms: 1, misses: 0, combo: 1, answerKind: 'choice', practice: true })).toBe(13);
  });
  it('blind guessing is worth ≤ 0 per item at every difficulty (exact)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) expect(guessExpectation(d)).toBeLessThanOrEqual(0);
  });
  it('blind-guess simulation over 1,000 real items averages < 0', () => {
    const rng = mulberry32(99);
    let total = 0;
    let items = 0;
    let combo = 0;
    for (let r = 0; items < 1000; r++) {
      for (const p of playRound(P0, 5000 + r, FAMILIES)) {
        items++;
        let misses: 0 | 1 | 2 = 0;
        let got = false;
        const tried = new Set<number>();
        for (let attempt = 0; attempt < 2 && !got; attempt++) {
          if (p.answer.kind === 'choice') {
            const left = p.answer.options.map((_, i) => i).filter((i) => !tried.has(i));
            const g = left[Math.floor(rng() * left.length)];
            tried.add(g);
            got = g === p.answer.answerIndex;
          } else if (p.answer.kind === 'number') {
            got = Math.floor(rng() * 100) === p.answer.answer;
          } else got = false; // tapping random cells never completes a grid
          if (!got) {
            total -= MISS_PENALTY;
            misses = (misses + 1) as 0 | 1 | 2;
          }
        }
        combo = got && misses === 0 ? combo + 1 : 0;
        if (got) total += pointsFor({ difficulty: p.difficulty, ms: 800, misses, combo, answerKind: p.answer.kind });
      }
    }
    expect(total / items).toBeLessThan(0);
  });
});
