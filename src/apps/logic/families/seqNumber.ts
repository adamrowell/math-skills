/**
 * seq-number — "What number comes next?" (docs/GEO-LOGIC.md §E.6).
 * Validator: re-fits every sequence rule it knows to the SHOWN terms (read back from the picture);
 * all rules that fit must predict the same next number, and exactly one option is that number.
 */
import type { AnswerSpec, Difficulty, ExplainStep, Puzzle, PuzzleFamily, Rng, VisualNode, VisualSpec } from '../engine/types';
import { OPTION_COUNT } from '../engine/types';
import { pick, puzzleId, randInt, chance } from '../engine/rng';
import type { Candidate } from './kit';
import { checkTextChoice, grid, numberOptions, spec, text } from './kit';

const VARIANTS = ['plus', 'minus', 'times', 'alternate', 'zip', 'fib', 'square', 'tri', 'grow'] as const;
type Variant = (typeof VARIANTS)[number];

const BY_D: Record<Difficulty, Variant[]> = {
  1: ['plus', 'minus'],
  2: ['plus', 'minus', 'times', 'alternate'],
  3: ['times', 'square', 'tri', 'fib', 'zip', 'grow'],
};

const LIMIT: Record<Difficulty, number> = { 1: 100, 2: 200, 3: 1000 };

interface Built {
  terms: number[];
  next: number;
  rule: string;
  /** Explanation of the step between shown terms (labels over the gaps). */
  gaps: string[];
  why: string[];
  pool: Candidate[];
  step: number;
}

const diffs = (t: number[]) => t.slice(1).map((v, i) => v - t[i]);
const sgn = (d: number) => (d >= 0 ? `+${d}` : `−${-d}`);

function build(v: Variant, d: Difficulty, rng: Rng): Built | null {
  const lim = LIMIT[d];
  const n = d === 1 ? 5 : d === 2 ? randInt(rng, 4, 5) : 5;
  switch (v) {
    case 'plus': {
      const s = d === 1 ? pick(rng, [1, 2, 2, 5, 10, 3]) : pick(rng, [3, 4, 6, 7, 8, 9, 11, 12, 15, 25]);
      const a = randInt(rng, s === 10 ? 0 : 1, Math.max(2, Math.min(lim - s * n, d === 1 ? 75 : 150)));
      const terms = Array.from({ length: n }, (_, i) => a + i * s);
      const last = terms[n - 1];
      return {
        terms,
        next: last + s,
        rule: `+${s} each time`,
        gaps: diffs(terms).map(sgn),
        why: [`Each number is ${s} more than the one before.`, `So ${last} + ${s} = ${last + s}.`],
        pool: [
          { v: last + s + 1, why: `Count on ${s}, not ${s + 1}` },
          { v: last + s - 1, why: `Count on ${s}, not ${s - 1}` },
          { v: last + 2 * s, why: 'That skips one' },
          { v: last, why: 'That is the last number again' },
          { v: last - s, why: 'It goes up, not down' },
        ],
        step: s,
      };
    }
    case 'minus': {
      const s = d === 1 ? pick(rng, [1, 2, 2, 5, 10]) : pick(rng, [3, 4, 6, 7, 9, 11]);
      const end = randInt(rng, s === 1 ? 0 : 1, d === 1 ? 60 : 120);
      const a = end + n * s;
      if (a > lim) return null;
      const terms = Array.from({ length: n }, (_, i) => a - i * s);
      const last = terms[n - 1];
      return {
        terms,
        next: last - s,
        rule: `−${s} each time`,
        gaps: diffs(terms).map(sgn),
        why: [`Each number is ${s} less than the one before.`, `So ${last} − ${s} = ${last - s}.`],
        pool: [
          { v: last - s + 1, why: `Take away ${s}, not ${s - 1}` },
          { v: last - s - 1, why: `Take away ${s}, not ${s + 1}` },
          { v: last + s, why: 'It goes down, not up' },
          { v: last - 2 * s, why: 'That skips one' },
          { v: last, why: 'That is the last number again' },
        ],
        step: s,
      };
    }
    case 'times': {
      const r = d === 3 ? pick(rng, [2, 3, 3]) : 2;
      const a = r === 3 ? randInt(rng, 1, d === 3 ? 12 : 4) : randInt(rng, 1, d === 3 ? 31 : 12);
      const len = r === 3 ? 4 : d === 3 ? 5 : 4;
      const terms = Array.from({ length: len }, (_, i) => a * r ** i);
      const last = terms[len - 1];
      const next = last * r;
      if (next > lim) return null;
      const prevGap = last - terms[len - 2];
      return {
        terms,
        next,
        rule: `×${r} each time`,
        gaps: terms.slice(1).map(() => `×${r}`),
        why: [`Each number is ${r === 2 ? 'double' : 'three times'} the one before.`, `So ${last} × ${r} = ${next}.`],
        pool: [
          { v: last + prevGap, why: `It doesn't add ${prevGap} each time — it multiplies` },
          { v: last + r, why: `Not +${r}: it is ×${r}` },
          { v: next + 1, why: `${last} × ${r} is ${next}` },
          { v: next - 1, why: `${last} × ${r} is ${next}` },
          { v: last * (r + 1), why: `×${r}, not ×${r + 1}` },
          { v: last * 2 === next ? last * 3 : last * 2, why: `It's ×${r}` },
        ],
        step: Math.max(1, Math.round(last / 4)),
      };
    }
    case 'alternate': {
      const p = randInt(rng, 1, 5);
      let q = randInt(rng, 2, 7);
      if (q === p) q = p + 2;
      const down = d === 2 && chance(rng, 0.3);
      const steps = down ? [p + q, -q] : [p, q];
      const a = randInt(rng, 1, 30);
      const len = 5;
      const terms = [a];
      for (let i = 1; i < len; i++) terms.push(terms[i - 1] + steps[(i - 1) % 2]);
      const nextStep = steps[(len - 1) % 2];
      const other = steps[len % 2];
      const last = terms[len - 1];
      if (Math.min(...terms, last + nextStep) < 0) return null;
      return {
        terms,
        next: last + nextStep,
        rule: `${sgn(steps[0])}, ${sgn(steps[1])}, ${sgn(steps[0])}, ${sgn(steps[1])}…`,
        gaps: diffs(terms).map(sgn),
        why: [`The jumps take turns: ${sgn(steps[0])}, then ${sgn(steps[1])}.`, `Next is ${sgn(nextStep)}: ${last} ${nextStep >= 0 ? '+' : '−'} ${Math.abs(nextStep)} = ${last + nextStep}.`],
        pool: [
          { v: last + other, why: `The jumps take turns — next is ${sgn(nextStep)}` },
          { v: last + p + q, why: 'Only one jump at a time' },
          { v: last + nextStep + 1, why: 'Check the jump again' },
          { v: last + nextStep - 1, why: 'Check the jump again' },
          { v: last, why: 'That is the last number again' },
        ],
        step: 1,
      };
    }
    case 'square': {
      const k0 = randInt(rng, 1, 9);
      const off = chance(rng, 0.4) ? 0 : randInt(rng, 1, 12);
      const terms = Array.from({ length: 5 }, (_, i) => (k0 + i) ** 2 + off);
      const k = k0 + 5;
      const last = terms[4];
      const g = diffs(terms);
      const next = k * k + off;
      return {
        terms,
        next,
        rule: off ? 'jumps grow by 2 each time' : 'square numbers (1×1, 2×2, 3×3…)',
        gaps: g.map(sgn),
        why: [
          `The jumps grow by 2: ${g.join(', ')}…`,
          `Next jump is ${g[3] + 2}: ${last} + ${g[3] + 2} = ${next}.`,
          ...(off ? [] : [`They are ${k0}×${k0}, ${k0 + 1}×${k0 + 1}… so ${k}×${k} = ${next}.`]),
        ],
        pool: [
          { v: last + g[3], why: 'The jumps keep growing' },
          { v: last + g[3] + 1, why: 'The jumps grow by 2 each time' },
          { v: last + g[3] + 3, why: 'The jumps grow by 2 each time' },
          { v: last * 2, why: 'It does not double' },
          { v: next + 1, why: `The next jump is ${g[3] + 2}` },
        ],
        step: 2,
      };
    }
    case 'tri':
    case 'grow': {
      // tri: 1, 3, 6, 10 (jumps 2, 3, 4…); grow: any start, jumps s, s+1, s+2… (or +2 each)
      const ti = randInt(rng, 1, 8);
      const a = v === 'tri' ? (ti * (ti + 1)) / 2 : randInt(rng, 1, 60);
      const s0 = v === 'tri' ? ti + 1 : randInt(rng, 1, 8);
      const inc = v === 'tri' ? 1 : pick(rng, [1, 1, 2]);
      const terms = [a];
      for (let i = 0; i < 4; i++) terms.push(terms[i] + s0 + i * inc);
      const g = diffs(terms);
      const nj = g[3] + inc;
      const last = terms[4];
      return {
        terms,
        next: last + nj,
        rule: v === 'tri' ? 'jumps grow by 1 (triangle numbers)' : `jumps grow by ${inc}`,
        gaps: g.map(sgn),
        why: [`Look at the jumps: ${g.join(', ')}.`, `Each jump is ${inc} bigger than the last. Next jump: ${nj}.`, `${last} + ${nj} = ${last + nj}.`],
        pool: [
          { v: last + g[3], why: 'The jumps keep growing' },
          { v: last + nj + inc, why: `The next jump is ${nj}` },
          { v: last + nj - 1, why: `The next jump is ${nj}` },
          { v: last + nj + 1, why: `The next jump is ${nj}` },
          { v: last + g[0], why: 'The jumps keep growing' },
        ],
        step: 1,
      };
    }
    case 'fib': {
      const a = randInt(rng, 1, 9);
      const b = randInt(rng, a, a + 9);
      const terms = [a, b];
      for (let i = 2; i < 6; i++) terms.push(terms[i - 1] + terms[i - 2]);
      const last = terms[5];
      const prev = terms[4];
      return {
        terms,
        next: last + prev,
        rule: 'add the two numbers before',
        gaps: [],
        why: [`Each number is the two before it added up.`, `${terms[2]} = ${a} + ${b}, ${terms[3]} = ${b} + ${terms[2]}…`, `So ${prev} + ${last} = ${last + prev}.`],
        pool: [
          { v: last + (last - prev), why: 'Add the two numbers before it' },
          { v: last * 2, why: 'Add the two numbers before it — not double' },
          { v: last + prev + 1, why: `${prev} + ${last} = ${last + prev}` },
          { v: last + prev - 1, why: `${prev} + ${last} = ${last + prev}` },
          { v: last + terms[3], why: 'Use the LAST two numbers' },
        ],
        step: 1,
      };
    }
    case 'zip': {
      // Two sequences taking turns: a, x, a+p, x+q, a+2p, x+2q, ?
      const a = randInt(rng, 1, 10);
      const x = randInt(rng, 10, 40);
      const p = randInt(rng, 1, 5);
      let q = pick(rng, [5, 10, -1, -2, 3]);
      if (q === p) q = p + 4;
      if (x + 3 * q < 0) q = 2;
      const terms = [a, x, a + p, x + q, a + 2 * p, x + 2 * q];
      return {
        terms,
        next: a + 3 * p,
        rule: `two patterns take turns (${sgn(p)} and ${sgn(q)})`,
        gaps: [],
        why: [
          `Two patterns take turns! Look at every other number.`,
          `${a}, ${a + p}, ${a + 2 * p}… goes ${sgn(p)}. ${x}, ${x + q}, ${x + 2 * q}… goes ${sgn(q)}.`,
          `The next number belongs to the first one: ${a + 2 * p} + ${p} = ${a + 3 * p}.`,
        ],
        pool: [
          { v: x + 3 * q, why: 'That continues the OTHER pattern' },
          { v: x + 2 * q + (x + 2 * q - (a + 2 * p)), why: 'Look at every other number' },
          { v: a + 3 * p + 1, why: `${a + 2 * p} + ${p} = ${a + 3 * p}` },
          { v: a + 3 * p - 1, why: `${a + 2 * p} + ${p} = ${a + 3 * p}` },
          { v: a + 2 * p, why: 'That number is already there' },
        ],
        step: 1,
      };
    }
  }
}

function seqVisual(terms: number[], gaps?: string[]): VisualSpec {
  const cols = terms.length + 1;
  const cell = Math.min(62, Math.floor(392 / cols));
  const w = cols * cell + 8;
  const top = gaps ? 34 : 6;
  const g = grid(4, top, 1, cols, cell, {
    id: 'seq',
    cells: terms.map((v, c) => ({ r: 0, c, label: String(v) })),
    unknown: [{ r: 0, c: cols - 1 }],
  });
  const nodes: VisualNode[] = [g];
  if (gaps) {
    gaps.forEach((s, i) => nodes.push(text(4 + (i + 1) * cell, 16, s, { id: `gap${i}`, size: 15, fill: 'purple' })));
  }
  return spec(w, top + cell + 6, nodes, `Numbers: ${terms.join(', ')}, then a question mark.`);
}

function generate(d: Difficulty, rng: Rng): Puzzle {
  for (let tries = 0; ; tries++) {
    const variant = pick(rng, BY_D[d]);
    const b = build(variant, d, rng);
    if (!b || b.next < 0 || b.next > LIMIT[d] || b.terms.some((t) => t < 0 || t > LIMIT[d])) {
      if (tries > 50) throw new Error('seq-number: generator stuck');
      continue;
    }
    const keypad = d === 3 && chance(rng, 0.4);
    const answer: AnswerSpec = keypad
      ? { kind: 'number', answer: b.next }
      : numberOptions(rng, b.next, b.pool, OPTION_COUNT[d], { min: 0, max: LIMIT[d] + 50, step: b.step });
    const visual = seqVisual(b.terms);
    const explanation: ExplainStep[] = [
      { text: b.gaps.length ? 'Look at the jumps between the numbers.' : 'Look closely at how the numbers are made.', visual: b.gaps.length ? seqVisual(b.terms, b.gaps) : visual, highlight: b.gaps.map((_, i) => `gap${i}`) },
      ...b.why.slice(0, 3).map((t) => ({ text: t })),
    ];
    return {
      id: puzzleId('seq-number', d, `${variant}|${b.terms.join(',')}`),
      family: 'seq-number',
      difficulty: d,
      prompt: 'What number comes next?',
      visual,
      answer,
      explanation,
      rule: b.rule,
      variant,
    };
  }
}

// ---------------------------------------------------------------------------------------------
// Independent validator
// ---------------------------------------------------------------------------------------------

/** Every rule the validator knows, each returning its prediction for the next term or null. */
export function fitSequence(t: number[]): Array<{ rule: string; next: number }> {
  const out: Array<{ rule: string; next: number }> = [];
  const k = t.length;
  const g = diffs(t);
  if (k >= 3 && g.every((x) => x === g[0])) out.push({ rule: 'arith', next: t[k - 1] + g[0] });
  if (k >= 3 && t[0] !== 0) {
    const r = t[1] / t[0];
    if (Number.isInteger(r) && Math.abs(r) >= 2 && t.every((v, i) => i === 0 || v === t[i - 1] * r)) out.push({ rule: 'geom', next: t[k - 1] * r });
  }
  if (g.length >= 4 && g.every((x, i) => i < 2 || x === g[i - 2])) out.push({ rule: 'alt2', next: t[k - 1] + g[g.length - 2] });
  if (g.length >= 3) {
    const dd = diffs(g);
    if (dd.every((x) => x === dd[0])) out.push({ rule: 'second', next: t[k - 1] + g[g.length - 1] + dd[0] });
  }
  if (k >= 4 && t.every((v, i) => i < 2 || v === t[i - 1] + t[i - 2])) out.push({ rule: 'fib', next: t[k - 1] + t[k - 2] });
  if (k >= 6) {
    const ev = t.filter((_, i) => i % 2 === 0);
    const od = t.filter((_, i) => i % 2 === 1);
    const ge = diffs(ev);
    const go = diffs(od);
    if (ev.length >= 3 && od.length >= 3 && ge.every((x) => x === ge[0]) && go.every((x) => x === go[0])) {
      out.push({ rule: 'zip', next: k % 2 === 0 ? ev[ev.length - 1] + ge[0] : od[od.length - 1] + go[0] });
    }
  }
  return out;
}

function readTerms(p: Puzzle): number[] | null {
  const g = p.visual.nodes.find((n) => n.t === 'grid' && n.id === 'seq');
  if (!g || g.t !== 'grid') return null;
  const cells = (g.cells ?? []).slice().sort((a, b) => a.c - b.c);
  const vals = cells.map((c) => Number(c.label));
  return vals.every((v) => Number.isFinite(v)) ? vals : null;
}

function validate(p: Puzzle): string[] {
  const t = readTerms(p);
  if (!t) return ['cannot read terms'];
  const fits = fitSequence(t);
  if (!fits.length) return [`no rule fits ${t.join(',')}`];
  const preds = new Set(fits.map((f) => f.next));
  if (preds.size !== 1) return [`ambiguous: ${fits.map((f) => `${f.rule}→${f.next}`).join(' ')}`];
  const next = fits[0].next;
  if (p.answer.kind === 'number') return p.answer.answer === next ? [] : [`keypad answer ${p.answer.answer} ≠ ${next}`];
  if (p.answer.kind !== 'choice') return ['unexpected answer kind'];
  return checkTextChoice(p.answer, String(next));
}

export const seqNumber: PuzzleFamily = {
  id: 'seq-number',
  title: 'Number Trains',
  emoji: '🔢',
  group: 'number',
  variants: VARIANTS,
  generate,
  validate,
};
