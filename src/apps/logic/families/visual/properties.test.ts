/**
 * Property tests for every visual family: 2000 seeds × difficulty. Each generated puzzle must pass
 * its own (independent) validator plus the generic contract (docs/GEO-LOGIC.md §E.9).
 */
import { describe, expect, it } from 'vitest';
import type { Difficulty, Puzzle } from '../../engine/types';
import { OPTION_COUNT } from '../../engine/types';
import { hashSeed, mulberry32 } from '../../engine/rng';
import { visualKey } from '../../engine/shapes';
import { visualFamilies } from './index';

const N = Number(process.env.LOGIC_SAMPLES ?? 2000);

const contract = (p: Puzzle): string[] => {
  const errs: string[] = [];
  if (p.prompt.length > 60) errs.push(`prompt too long: ${p.prompt}`);
  if (p.explanation.length < 1 || p.explanation.length > 4) errs.push(`explanation has ${p.explanation.length} steps`);
  for (const s of p.explanation) if (s.text.length > 90) errs.push(`step too long: ${s.text}`);
  if (p.visual.w > 400 || p.visual.h > 300) errs.push(`visual ${p.visual.w}×${p.visual.h}`);
  if (!p.rule) errs.push('no rule');
  if (p.answer.kind === 'choice') {
    if (p.answer.options.length !== OPTION_COUNT[p.difficulty]) errs.push('option count');
    if (p.answer.answerIndex < 0 || p.answer.answerIndex >= p.answer.options.length) errs.push('answerIndex out of range');
    const keys = p.answer.options.map((o) => (o.visual ? visualKey(o.visual) : o.text));
    if (new Set(keys).size !== keys.length) errs.push('duplicate options');
    const a = p.answer;
    a.options.forEach((o, i) => {
      if (i !== a.answerIndex && !o.why) errs.push(`option ${i} lacks why`);
      if (o.visual && (o.visual.w > 400 || o.visual.h > 300)) errs.push('option visual too big');
    });
  }
  return errs;
};

for (const fam of visualFamilies) {
  describe(`${fam.id}`, () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      it(`difficulty ${d}: ${N} puzzles all valid, varied and fast`, () => {
        const ids = new Set<string>();
        const early = new Set<string>();
        const variants = new Map<string, number>();
        const times: number[] = [];
        let firstAnswerIdx = 0;
        for (let n = 0; n < N; n++) {
          const rng = mulberry32(hashSeed(fam.id, d, n));
          const t0 = performance.now();
          const p = fam.generate(d, rng);
          times.push(performance.now() - t0);
          expect(p.family).toBe(fam.id);
          expect(p.difficulty).toBe(d);
          const errs = [...contract(p), ...fam.validate(p)];
          if (errs.length) throw new Error(`seed ${n}: ${errs.join('; ')}\n${JSON.stringify(p).slice(0, 600)}`);
          ids.add(p.id);
          if (n < 100) early.add(p.id);
          // Tampering with the answer must be caught by the validator (it never trusts answerIndex).
          if (p.answer.kind === 'choice' && n < 200) {
            const bad = { ...p, answer: { ...p.answer, answerIndex: (p.answer.answerIndex + 1) % p.answer.options.length } };
            expect(fam.validate(bad).length).toBeGreaterThan(0);
          }
          if (p.answer.kind === 'cells' && n < 200) {
            const t = { ...p.answer.target };
            delete t[Object.keys(t)[Object.keys(t).length - 1]];
            expect(fam.validate({ ...p, answer: { ...p.answer, target: t } }).length).toBeGreaterThan(0);
          }
          if (p.answer.kind === 'number' && n < 200) expect(fam.validate({ ...p, answer: { ...p.answer, answer: p.answer.answer + 1 } }).length).toBeGreaterThan(0);
          variants.set(p.variant, (variants.get(p.variant) ?? 0) + 1);
          if (p.answer.kind === 'choice' && p.answer.answerIndex === 0) firstAnswerIdx++;
          expect(fam.variants).toContain(p.variant);
        }
        // Variety: plenty of different puzzles overall, and back-to-back draws rarely repeat.
        expect(ids.size).toBeGreaterThanOrEqual(Math.min(150, 0.9 * N));
        expect(early.size).toBeGreaterThanOrEqual(Math.min(80, 0.8 * N));
        // The correct option is not stuck in one place.
        if (firstAnswerIdx) expect(firstAnswerIdx / N).toBeLessThan(0.4);
        times.sort((a, b) => a - b);
        expect(times[Math.floor(N * 0.5)]).toBeLessThan(5);
        expect(times[Math.floor(N * 0.95)]).toBeLessThan(15);
      });
    }
    it('every variant shows up within 60 draws per difficulty that offers it', () => {
      const seen = new Set<string>();
      for (const d of [1, 2, 3] as Difficulty[])
        for (let n = 0; n < 60; n++) seen.add(fam.generate(d, mulberry32(hashSeed(fam.id, d, 10_000 + n))).variant);
      expect([...seen].sort()).toEqual([...fam.variants].sort());
    });
  });
}

// ------------------------------------------------------------------------------------------------
// Test-wise shortcuts (same rule as builder 3's property.test.ts): picking the biggest, the
// smallest or the "most typical" option must not beat chance by more than 20 points.

type Node = import('../../engine/types').VisualNode;
const shapesOf = (nodes: Node[]): Array<Extract<Node, { t: 'shape' }>> => {
  const out: Array<Extract<Node, { t: 'shape' }>> = [];
  const visit = (n: Node) => {
    if (n.t === 'shape') out.push(n);
    if (n.t === 'g') n.children.forEach(visit);
    if (n.t === 'grid') for (const c of n.cells ?? []) if (c.node) visit(c.node);
  };
  nodes.forEach(visit);
  return out;
};
const successOf = (scores: number[], answer: number) => {
  const best = Math.max(...scores);
  const top = scores.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
  return top.includes(answer) ? 1 / top.length : 0;
};
/** Shortcuts that are the skill itself. */
const INTRINSIC_V: Record<string, string[]> = {};

for (const fam of visualFamilies) {
  describe(`${fam.id} shortcuts`, () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      it(`difficulty ${d}: no biggest / smallest / most-typical tell`, () => {
        const M = Math.min(N, 800);
        const strat: Record<string, number> = {};
        let choices = 0;
        for (let k = 0; k < M; k++) {
          const p = fam.generate(d, mulberry32(hashSeed(fam.id, d, 70_000 + k)));
          if (p.answer.kind !== 'choice' || p.answer.options.some((o) => !o.visual)) continue;
          choices++;
          const sh = p.answer.options.map((o) => shapesOf(o.visual!.nodes));
          const area = sh.map((ss) => ss.reduce((a, s) => a + s.size * s.size, 0));
          const feats = sh.map((ss) => [
            ss.map((s) => s.fill ?? '').sort().join('|'),
            ss.map((s) => s.kind).sort().join('|'),
            ss.map((s) => (s.pattern ?? 'solid')).sort().join('|'),
            ss.map((s) => String(Math.round(s.size))).sort().join('|'),
            ss.map((s) => String(s.rotate ?? 0)).sort().join('|'),
          ]);
          const typical = feats.map((f, i) => f.reduce((acc, v, j) => acc + feats.filter((g, m) => m !== i && g[j] === v).length, 0));
          const ai = p.answer.answerIndex;
          const add = (name: string, v: number) => (strat[name] = (strat[name] ?? 0) + v);
          add('biggest', successOf(area, ai));
          add('smallest', successOf(area.map((x) => -x), ai));
          add('most typical', successOf(typical, ai));
        }
        if (choices < 200) return;
        const n = OPTION_COUNT[d];
        for (const [name, total] of Object.entries(strat)) {
          if ((INTRINSIC_V[`${fam.id}:${d}`] ?? []).includes(name)) continue;
          const rate = total / choices;
          expect(rate, `"${name}" shortcut wins ${(rate * 100).toFixed(0)}% (chance ${(100 / n).toFixed(0)}%)`).toBeLessThanOrEqual(1 / n + 0.2);
        }
      }, 120_000);
    }
  });
}
