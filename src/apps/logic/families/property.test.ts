/**
 * Property test for builder 3's families: ≥ 2000 puzzles per family per difficulty.
 *  - exactly one correct option (the independent validator) and no duplicate options;
 *  - the correct option's position is uniform (before the engine's own shuffle);
 *  - no test-wise shortcut works: picking the longest / shortest / biggest / smallest / middle
 *    option, the "most different" option or the "most typical" option must not beat chance by
 *    more than 20 points.
 */
import { describe, expect, it } from 'vitest';
import { numberFamilies } from './index';
import { hashSeed, mulberry32 } from '../engine/rng';
import type { ChoiceAnswer, ChoiceOption, Difficulty, Puzzle } from '../engine/types';
import { OPTION_COUNT } from '../engine/types';
import { optionKey, walk } from './kit';

const N = 2000;

type Feature = (o: ChoiceOption) => string;

function shapeFeatures(): Feature[] {
  const collect = (o: ChoiceOption, fn: (n: import('../engine/types').VisualNode) => string | null) => {
    const out: string[] = [];
    if (o.visual)
      walk(o.visual.nodes, (n) => {
        const v = fn(n);
        if (v !== null) out.push(v);
      });
    return out.sort().join('|');
  };
  return [
    (o) => collect(o, (n) => (n.t === 'shape' ? (n.fill ?? '') : null)),
    (o) => collect(o, (n) => (n.t === 'shape' ? n.kind : null)),
    (o) => collect(o, (n) => (n.t === 'shape' ? String(Math.round(n.size)) : null)),
    (o) => collect(o, (n) => (n.t === 'shape' ? (n.pattern ?? 'solid') : null)),
    (o) => collect(o, (n) => (n.t === 'shape' ? String(n.rotate ?? 0) : null)),
    (o) => collect(o, (n) => (n.t === 'clock' ? String(n.hour) : null)),
    (o) => collect(o, (n) => (n.t === 'clock' ? String(n.minute) : null)),
    (o) => String(o.visual?.nodes.length ?? 0),
  ];
}
const textFeatures: Feature[] = [(o) => String(o.text?.length ?? 0), (o) => (o.text ?? '').slice(0, 1), (o) => (o.text ?? '').slice(-1)];

/** Fractional success of a strategy that picks the options scoring max (ties split). */
function successOf(a: ChoiceAnswer, score: (i: number) => number): number {
  const s = a.options.map((_, i) => score(i));
  const best = Math.max(...s);
  const top = s.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
  return top.includes(a.answerIndex) ? 1 / top.length : 0;
}

function strategies(a: ChoiceAnswer): Record<string, number> {
  const isText = a.options.every((o) => o.text !== undefined);
  const out: Record<string, number> = {};
  const feats = isText ? textFeatures : shapeFeatures();
  const vals = a.options.map((o) => feats.map((f) => f(o)));
  out['most different'] = successOf(a, (i) => feats.reduce((acc, _, k) => acc + (vals.filter((v) => v[k] === vals[i][k]).length === 1 ? 1 : 0), 0));
  out['most typical'] = successOf(a, (i) => feats.reduce((acc, _, k) => acc + vals.filter((v, j) => j !== i && v[k] === vals[i][k]).length, 0));
  if (isText) {
    out['longest'] = successOf(a, (i) => a.options[i].text!.length);
    out['shortest'] = successOf(a, (i) => -a.options[i].text!.length);
    const nums = a.options.map((o) => Number(o.text));
    if (nums.every((x) => Number.isFinite(x))) {
      const sorted = [...nums].sort((x, y) => x - y);
      const n = nums.length;
      const mids = n % 2 ? [sorted[(n - 1) / 2]] : [sorted[n / 2 - 1], sorted[n / 2]];
      out['biggest'] = successOf(a, (i) => nums[i]);
      out['smallest'] = successOf(a, (i) => -nums[i]);
      out['middle'] = successOf(a, (i) => (mids.includes(nums[i]) ? 1 : 0));
    }
  }
  return out;
}

/** Shortcuts that are the skill itself (the odd one IS the different one at easy). */
const INTRINSIC: Record<string, string[]> = { 'odd-one-out:1': ['most different'] };

for (const fam of numberFamilies) {
  describe(`property: ${fam.id}`, () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      it(`difficulty ${d}: ${N} puzzles, one answer, no tells`, () => {
        const n = OPTION_COUNT[d];
        const pos = Array(n).fill(0);
        const strat: Record<string, number> = {};
        let choices = 0;
        for (let k = 0; k < N; k++) {
          const p: Puzzle = fam.generate(d, mulberry32(hashSeed(fam.id, d, 50_000 + k)));
          expect(fam.validate(p), p.id).toEqual([]);
          if (p.answer.kind !== 'choice') continue;
          const a = p.answer;
          choices++;
          expect(new Set(a.options.map(optionKey)).size).toBe(a.options.length);
          pos[a.answerIndex]++;
          for (const [name, v] of Object.entries(strategies(a))) strat[name] = (strat[name] ?? 0) + v;
        }
        if (choices < 200) return; // keypad / sudoku families: nothing to guess between
        const exp = choices / n;
        for (const c of pos) {
          expect(c, `answer position counts ${pos.join(',')}`).toBeGreaterThan(exp * 0.75);
          expect(c, `answer position counts ${pos.join(',')}`).toBeLessThan(exp * 1.25);
        }
        const skip = INTRINSIC[`${fam.id}:${d}`] ?? [];
        for (const [name, total] of Object.entries(strat)) {
          if (skip.includes(name)) continue;
          // Only meaningful when the strategy applied to (nearly) every choice puzzle.
          const rate = total / choices;
          expect(rate, `"${name}" shortcut wins ${(rate * 100).toFixed(0)}% (chance ${(100 / n).toFixed(0)}%)`).toBeLessThanOrEqual(1 / n + 0.2);
        }
      }, 120_000);
    }
  });
}
