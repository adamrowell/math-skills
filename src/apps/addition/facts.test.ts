import { describe, expect, it } from 'vitest';
import { additionGenerator, makeProblem, SKILLS } from './facts';
import { matchNumberAnswer } from '../../voice';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ones = (n: number) => n % 10;

describe('addition skills', () => {
  const r = rng(7);
  for (const t of additionGenerator.allFacts()) {
    it(`${t.id} makes valid problems`, () => {
      for (let i = 0; i < 400; i++) {
        const f = makeProblem(t, r);
        const [a, b] = f.operands;
        expect(f.id).toBe(t.id);
        expect(f.answer).toBe(a + b);
        expect(f.prompt).toBe(`${a} + ${b}`);
        expect(f.answer).toBeLessThanOrEqual(198);
        expect(a).toBeGreaterThan(0);
        expect(b).toBeGreaterThan(0);
        const carry = ones(a) + ones(b) >= 10;
        switch (t.id) {
          case 'add:1d-bridge':
            expect(a < 10 && b < 10 && a + b > 10).toBe(true);
            break;
          case 'add:2d1d':
          case 'add:2d-tens':
          case 'add:2d2d':
            expect(carry).toBe(false);
            expect(a + b).toBeLessThan(100);
            break;
          case 'add:2d1d-carry':
          case 'add:2d2d-carry':
          case 'add:2d2d-carry-big':
            expect(carry).toBe(true);
            expect(a + b).toBeLessThan(100);
            break;
          case 'add:big':
            expect(carry).toBe(false);
            expect(a + b).toBeGreaterThanOrEqual(100);
            break;
          case 'add:big-carry':
            expect(carry).toBe(true);
            expect(a + b).toBeGreaterThanOrEqual(100);
            break;
        }
        if (t.id.includes('2d2d') || t.id.startsWith('add:big')) expect(a >= 10 && b >= 10).toBe(true);
      }
    });
  }
  it('every skill has a set', () => {
    const sets = additionGenerator.sets().map((s) => s.id);
    for (const s of SKILLS) expect(sets).toContain(s.group);
  });
});

describe('voice: 3-digit sums', () => {
  const cases: Array<[string, number]> = [
    ['one hundred forty three', 143],
    ['a hundred and forty three', 143],
    ['one hundred and eight', 108],
    ['143', 143],
    ['one hundred', 100],
    ['a hundred', 100],
    ['one hundred ninety eight', 198],
    ['one hundred twelve', 112],
    ['seventy two', 72],
  ];
  for (const [text, n] of cases) {
    it(`"${text}" → ${n}`, () => {
      expect(matchNumberAnswer(text, { expected: n, maxPlausible: 198 }).verdict).toBe('correct');
    });
  }
  it('"one hundred" of 143 is a partial, not wrong', () => {
    const r = matchNumberAnswer('one hundred', { expected: 143, maxPlausible: 198 });
    expect(r.verdict).toBe('unclear');
  });
  it('"one forty three" → 143', () => {
    expect(matchNumberAnswer('one forty three', { expected: 143, maxPlausible: 198 }).verdict).toBe('correct');
  });
});
