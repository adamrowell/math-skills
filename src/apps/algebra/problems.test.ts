import { describe, expect, it } from 'vitest';
import { LEVELS, MAX_ANSWER, makeProblem } from './problems';
import { pointsFor, secondTryPoints, streakMultiplier } from './scoring';

/** Evaluate `lhs=rhs` with the given variable values; exact arithmetic (÷ must divide). */
function holds(line: string, vars: Record<string, number>): boolean {
  const sides = line.split('=');
  const vals = sides.map((side) => {
    const expr = side.replace(/[A-Z?x]/g, (m) => String(vars[m === '?' ? 'x' : m]));
    if (!/^[0-9+\-*/ ]+$/.test(expr)) throw new Error(`bad expr ${expr}`);
    return Function(`"use strict"; return (${expr});`)() as number;
  });
  return vals.every((v) => v === vals[0]);
}

/** Every value 0..limit for the unknowns that satisfies all lines → unique answer check. */
function solutions(eq: string): number[] {
  const parts = eq.split(';');
  const ask = parts.pop()!.replace('ask=', '');
  const lines = parts;
  const names = Array.from(new Set(lines.join('').match(/[A-Z]/g) ?? []));
  if (!names.length) {
    const out: number[] = [];
    for (let v = 0; v <= MAX_ANSWER; v++) if (lines.every((l) => holds(l, { x: v }))) out.push(v);
    return out;
  }
  const out = new Set<number>();
  const lim = 20; // picture values stay ≤ 19
  const rec = (i: number, vars: Record<string, number>) => {
    if (i === names.length) {
      if (lines.every((l) => holds(l, vars))) out.add(vars[ask]);
      return;
    }
    for (let v = 0; v <= lim; v++) rec(i + 1, { ...vars, [names[i]]: v });
  };
  rec(0, {});
  return [...out];
}

describe('algebra problems', () => {
  for (const level of LEVELS) {
    for (const t of level.templates) {
      it(`${t.id}: whole answers 0..144, unique, hint + steps`, () => {
        for (let i = 0; i < (level.id === 5 ? 60 : 150); i++) {
          const p = makeProblem(t.id);
          expect(Number.isInteger(p.answer)).toBe(true);
          expect(p.answer).toBeGreaterThanOrEqual(0);
          expect(p.answer).toBeLessThanOrEqual(MAX_ANSWER);
          expect(solutions(p.eq)).toEqual([p.answer]);
          expect(p.hint.length).toBeGreaterThan(5);
          expect(p.steps.length).toBeGreaterThanOrEqual(2);
          // Last worked step ends with the answer.
          const last = p.steps[p.steps.length - 1].eq;
          expect(last[last.length - 1]).toEqual({ t: 'n', v: p.answer });
          // Every number shown is a whole number in range.
          for (const l of p.lines) for (const k of l) if (k.t === 'n') expect(k.v).toBeLessThanOrEqual(200);
        }
      });
    }
  }
});

describe('algebra scoring', () => {
  it('harder levels pay more', () => {
    const at = (lv: number) => pointsFor({ level: LEVELS[lv - 1], ms: 99999, combo: 1 }).points;
    expect(at(2)).toBeGreaterThan(at(1));
    expect(at(3)).toBeGreaterThan(at(2));
    expect(at(4)).toBeGreaterThan(at(3));
    expect(at(5)).toBeGreaterThanOrEqual(at(4));
  });
  it('timed levels have a speed bonus; paper levels do not', () => {
    const l1 = LEVELS[0];
    expect(pointsFor({ level: l1, ms: 1000, combo: 1 }).points).toBeGreaterThan(pointsFor({ level: l1, ms: 60000, combo: 1 }).points);
    const l4 = LEVELS[3];
    expect(pointsFor({ level: l4, ms: 1000, combo: 1 }).points).toBe(pointsFor({ level: l4, ms: 200000, combo: 1 }).points);
  });
  it('paper streak bonus grows and caps', () => {
    expect(streakMultiplier(1)).toBe(1);
    expect(streakMultiplier(5)).toBeGreaterThan(streakMultiplier(2));
    expect(streakMultiplier(50)).toBe(2);
    const l4 = LEVELS[3];
    expect(pointsFor({ level: l4, ms: 1, combo: 6 }).points).toBeGreaterThan(pointsFor({ level: l4, ms: 1, combo: 1 }).points);
  });
  it('second try pays less than first', () => {
    for (const l of LEVELS) expect(secondTryPoints(l)).toBeLessThan(pointsFor({ level: l, ms: 99999, combo: 1 }).points);
  });
});
