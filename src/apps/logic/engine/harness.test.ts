/**
 * The generator contract (docs/GEO-LOGIC.md §E.9) — runs over EVERY registered family
 * (builder 3's and builder 4's): 200 seeds × difficulty.
 */
import { describe, expect, it } from 'vitest';
import { FAMILIES } from './registry';
import { hashSeed, mulberry32 } from './rng';
import type { Difficulty, Puzzle, VisualSpec } from './types';
import { FAMILY_IDS, OPTION_COUNT } from './types';
import { optionKey } from '../families/kit';

const SEEDS = 200;
const DS: Difficulty[] = [1, 2, 3];

function visuals(p: Puzzle): VisualSpec[] {
  const out = [p.visual, ...p.explanation.flatMap((e) => (e.visual ? [e.visual] : []))];
  if (p.answer.kind === 'choice') for (const o of p.answer.options) if (o.visual) out.push(o.visual);
  return out;
}

describe('logic families: registry', () => {
  it('registers builder 3 families and only known ids', () => {
    const ids = FAMILIES.map((f) => f.id);
    for (const id of ['seq-number', 'number-box', 'rule-machine', 'code-break', 'balance', 'clock-calendar', 'mini-sudoku', 'maze-path', 'odd-one-out', 'analogy'])
      expect(ids).toContain(id);
    for (const id of ids) expect(FAMILY_IDS).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

for (const fam of FAMILIES) {
  describe(`harness: ${fam.id}`, () => {
    for (const d of DS) {
      it(`difficulty ${d}: ${SEEDS} valid puzzles`, () => {
        const ids = new Set<string>();
        const times: number[] = [];
        fam.generate(d, mulberry32(hashSeed(fam.id, d, -1))); // warm-up (JIT) before timing
        for (let n = 0; n < SEEDS; n++) {
          const t0 = performance.now();
          const p = fam.generate(d, mulberry32(hashSeed(fam.id, d, n)));
          times.push(performance.now() - t0);
          const where = `${p.id} (${p.variant})`;
          expect(fam.validate(p), where).toEqual([]);
          expect(p.family).toBe(fam.id);
          expect(p.difficulty).toBe(d);
          expect(p.id.startsWith(`${fam.id}:${d}:`)).toBe(true);
          expect(fam.variants).toContain(p.variant);
          ids.add(p.id);
          expect(p.prompt.length, where).toBeLessThanOrEqual(60);
          expect(p.explanation.length, where).toBeGreaterThanOrEqual(1);
          expect(p.explanation.length, where).toBeLessThanOrEqual(4);
          for (const s of p.explanation) expect(s.text.length, `${where}: "${s.text}"`).toBeLessThanOrEqual(90);
          for (const v of visuals(p)) {
            expect(v.w, where).toBeLessThanOrEqual(400);
            expect(v.h, where).toBeLessThanOrEqual(300);
          }
          if (p.answer.kind === 'choice') {
            const a = p.answer;
            expect(a.options.length, where).toBe(OPTION_COUNT[d]);
            expect(a.answerIndex).toBeGreaterThanOrEqual(0);
            expect(a.answerIndex).toBeLessThan(a.options.length);
            const keys = a.options.map(optionKey);
            expect(new Set(keys).size, `${where} duplicate options`).toBe(keys.length);
            a.options.forEach((o, i) => {
              expect(Boolean(o.visual) !== Boolean(o.text), `${where} option ${i} needs exactly one of text/visual`).toBe(true);
              if (i !== a.answerIndex) expect(o.why, `${where} option ${i} why`).toBeTruthy();
            });
          } else if (p.answer.kind === 'number') {
            expect(Number.isInteger(p.answer.answer)).toBe(true);
            expect(p.answer.answer).toBeGreaterThanOrEqual(0);
            expect(p.answer.answer).toBeLessThanOrEqual(9999);
          }
        }
        // Content-based ids: repeats only when the same puzzle really came up again.
        expect(ids.size / SEEDS, 'variety (distinct puzzles per 200 draws)').toBeGreaterThanOrEqual(0.5);
        times.sort((a, b) => a - b);
        // Budget is 5 ms; the median must meet it, p95 gets head-room for a busy machine (tests and
        // builds running in parallel).
        expect(times[Math.floor(times.length * 0.5)], 'median generation ms').toBeLessThan(5);
        expect(times[Math.floor(times.length * 0.95)], 'p95 generation ms').toBeLessThan(15);
      }, 60_000);
    }

    it('every variant shows up within 60 draws per difficulty', () => {
      const got = new Set<string>();
      for (const d of DS) for (let n = 0; n < 60; n++) got.add(fam.generate(d, mulberry32(hashSeed(fam.id, d, 10_000 + n))).variant);
      expect([...fam.variants].filter((v) => !got.has(v))).toEqual([]);
    }, 60_000);

    it('the validator is not a rubber stamp (a wrong answer is rejected)', () => {
      let checked = 0;
      for (const d of DS)
        for (let n = 0; n < 20; n++) {
          const p = fam.generate(d, mulberry32(hashSeed(fam.id, d, 20_000 + n)));
          const a = p.answer;
          let bad: Puzzle | null = null;
          if (a.kind === 'choice') bad = { ...p, answer: { ...a, answerIndex: (a.answerIndex + 1) % a.options.length } };
          else if (a.kind === 'number') bad = { ...p, answer: { ...a, answer: a.answer + 1 } };
          else if (a.kind === 'cells') {
            const k = Object.keys(a.target)[0];
            const target = { ...a.target };
            delete target[k];
            bad = { ...p, answer: { ...a, target } };
          } else if (a.kind === 'sudoku') {
            const sol = a.solution.map((r) => r.slice());
            [sol[0][0], sol[0][1]] = [sol[0][1], sol[0][0]];
            bad = { ...p, answer: { ...a, solution: sol } };
          }
          if (!bad) continue;
          checked++;
          expect(fam.validate(bad).length, `${p.id} corrupted answer still validates`).toBeGreaterThan(0);
        }
      expect(checked).toBeGreaterThan(0);
    }, 60_000);
  });
}
