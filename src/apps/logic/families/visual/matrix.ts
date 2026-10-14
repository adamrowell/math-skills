/**
 * matrix — a 3×3 grid of pictures with one missing. Each attribute (shape, look, count, turn)
 * follows a row rule, a column rule, a "one of each" (Latin) rule or, at hard, "first + second =
 * third" on counts. The validator re-infers every attribute's rule from the 8 visible cells.
 */
import type { Difficulty, ExplainStep, GridCell, Puzzle, PuzzleFamily, Rng, ShapeKind, VisualSpec } from '../../engine/types';
import { OPTION_COUNT } from '../../engine/types';
import { grid, KIND_NAME, KINDS_ALL, KINDS_EASY, pick, randInt, sample, shuffle, spec } from '../../engine/shapes';
import { byId, checkVisualChoice, choice, clip, finish, generateValid, pickWrong, pickWrongFair, type Wrong } from './common';
import { drawTerm, LOOKS, lookKey, lookOf, lookWord, MID, plural, readTerm, termWord, TURN_KINDS, type Term } from './term';

const ID = 'matrix' as const;
const CELL = 76;
const K = 1.15;
const PAD = 4;

type Attr = 'kind' | 'look' | 'count' | 'rot' | 'size';
type RuleKind = 'const' | 'row' | 'col' | 'latin' | 'sum';

const VARIANTS: Record<Difficulty, string[]> = {
  1: ['shape-row-look-col', 'look-row-shape-col', 'count-col'],
  2: ['latin-shape', 'latin-look', 'row-col-count'],
  3: ['graeco-latin', 'sum', 'turn-col', 'latin-count'],
};

type Grid3<T> = T[][];
const build = <T>(f: (r: number, c: number) => T): Grid3<T> => [0, 1, 2].map((r) => [0, 1, 2].map((c) => f(r, c)));

interface Plan {
  variant: string;
  cells: Grid3<Term>;
  rules: Partial<Record<Attr, RuleKind>>;
  rule: string;
}

const plan = (d: Difficulty, rng: Rng): Plan => {
  const variant = pick(VARIANTS[d], rng);
  const kinds = sample(d === 1 ? KINDS_EASY : KINDS_ALL, 3, rng);
  // Small counting-size shapes (and the thin arms of crosses and stars) barely show a dotted fill,
  // so it would look white: no dots on counting grids, and never dotted next to plain white.
  const small = ['count-col', 'row-col-count', 'sum', 'latin-count'].includes(variant);
  const lookPool = small ? LOOKS.filter((l) => l.pattern !== 'dotted') : LOOKS;
  let looks = sample(lookPool, 3, rng);
  while (looks.some((l) => l.pattern === 'dotted') && looks.some((l) => l.fill === 'white')) looks = sample(lookPool, 3, rng);
  const base: Term = { kind: pick(KINDS_ALL, rng), look: looks[0], size: MID, rot: 0, count: 1 };
  const latin = (r: number, c: number, dir: 1 | -1) => (((r + dir * c) % 3) + 3) % 3;
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
  switch (variant) {
    case 'shape-row-look-col':
      return {
        variant,
        cells: build((r, c) => ({ ...base, kind: kinds[r], look: looks[c] })),
        rules: { kind: 'row', look: 'col' },
        rule: 'shape by row, colour by column',
      };
    case 'look-row-shape-col':
      return {
        variant,
        cells: build((r, c) => ({ ...base, look: looks[r], kind: kinds[c] })),
        rules: { look: 'row', kind: 'col' },
        rule: 'colour by row, shape by column',
      };
    case 'count-col': {
      const counts = pick([[1, 2, 3], [3, 2, 1], [2, 3, 4], [1, 3, 5]], rng);
      return {
        variant,
        cells: build((r, c) => ({ ...base, kind: kinds[r], count: counts[c], size: -1 })),
        rules: { kind: 'row', count: 'col' },
        rule: `shape by row, ${counts.join('-')} by column`,
      };
    }
    case 'latin-shape':
      return {
        variant,
        cells: build((r, c) => ({ ...base, kind: kinds[latin(r, c, dir)], look: looks[r] })),
        rules: { kind: 'latin', look: 'row' },
        rule: 'one of each shape in every row and column; colour by row',
      };
    case 'latin-look':
      return {
        variant,
        cells: build((r, c) => ({ ...base, look: looks[latin(r, c, dir)], kind: kinds[c] })),
        rules: { look: 'latin', kind: 'col' },
        rule: 'one of each colour in every row and column; shape by column',
      };
    case 'row-col-count': {
      const counts = pick([[1, 2, 3], [3, 2, 1], [2, 3, 4], [4, 3, 2]], rng);
      return {
        variant,
        cells: build((r, c) => ({ ...base, kind: kinds[r], look: looks[c], count: counts[c], size: -1 })),
        rules: { kind: 'row', look: 'col', count: 'col' },
        rule: 'shape by row; colour and count by column',
      };
    }
    case 'graeco-latin':
      return {
        variant,
        cells: build((r, c) => ({ ...base, kind: kinds[latin(r, c, 1)], look: looks[latin(r, c, -1)] })),
        rules: { kind: 'latin', look: 'latin' },
        rule: 'one of each shape and one of each colour in every row and column',
      };
    case 'sum': {
      const rows = shuffle(
        [
          [1, 2],
          [2, 1],
          [1, 3],
          [3, 1],
          [2, 2],
          [2, 3],
          [3, 2],
          [1, 4],
          [4, 1],
          [1, 1],
        ],
        rng,
      ).slice(0, 3);
      const kind = pick(['circle', 'star', 'square', 'heart'] as ShapeKind[], rng);
      return {
        variant,
        cells: build((r, c) => ({ ...base, kind, size: -1, look: looks[r], count: c < 2 ? rows[r][c] : rows[r][0] + rows[r][1] })),
        rules: { count: 'sum', look: 'row' },
        rule: 'in each row, first + second = third',
      };
    }
    case 'turn-col': {
      const kind = pick(TURN_KINDS, rng);
      const start = pick([0, 90, 180, 270], rng);
      const step = pick([90, -90, 45], rng);
      return {
        variant,
        cells: build((r, c) => ({ ...base, kind, look: looks[latin(r, c, dir)], rot: (((start + c * step) % 360) + 360) % 360 })),
        rules: { rot: 'col', look: 'latin' },
        rule: 'turn by column; one of each colour in every row and column',
      };
    }
    default: {
      const counts = sample([1, 2, 3, 4], 3, rng);
      return {
        variant: 'latin-count',
        cells: build((r, c) => ({ ...base, size: -1, count: counts[latin(r, c, 1)], kind: kinds[latin(r, c, -1)], look: looks[r] })),
        rules: { count: 'latin', kind: 'latin', look: 'row' },
        rule: 'one of each count and each shape in every row and column; colour by row',
      };
    }
  }
};

const value = (t: Term, a: Attr): string => (a === 'look' ? lookKey(t.look) : String(t[a]));
const setValue = (t: Term, a: Attr, v: string): Term =>
  a === 'look' ? { ...t, look: lookOf(v) } : a === 'kind' ? { ...t, kind: v as ShapeKind } : { ...t, [a]: Number(v) };

/** Options are drawn exactly like a grid cell, so they compare one-to-one with the grid. */
const optionVisual = (t: Term): VisualSpec => spec(CELL, CELL, [drawTerm(t, CELL / 2, CELL / 2, K)], termWord(t, ['count']));

const ATTRS: Attr[] = ['kind', 'look', 'count', 'rot', 'size'];

/**
 * Every rule that fits the 8 known values of one attribute, with its prediction for the hole.
 * `vals[r][c]` is null at the hole.
 */
export const matrixFits = (vals: Grid3<string | null>, numeric: boolean): Array<{ rule: RuleKind; next: string }> => {
  let hr = -1;
  let hc = -1;
  vals.forEach((row, r) => row.forEach((v, c) => v === null && ((hr = r), (hc = c))));
  const known = vals.flatMap((row, r) => row.map((v, c) => ({ r, c, v }))).filter((x) => x.v !== null) as Array<{ r: number; c: number; v: string }>;
  const out: Array<{ rule: RuleKind; next: string }> = [];
  const distinct = new Set(known.map((k) => k.v));
  if (distinct.size === 1) out.push({ rule: 'const', next: known[0].v });
  const lineConst = (key: 'r' | 'c') =>
    [0, 1, 2].every((i) => new Set(known.filter((k) => k[key] === i).map((k) => k.v)).size <= 1);
  if (distinct.size > 1 && lineConst('r')) out.push({ rule: 'row', next: known.find((k) => k.r === hr)!.v });
  if (distinct.size > 1 && lineConst('c')) out.push({ rule: 'col', next: known.find((k) => k.c === hc)!.v });
  const lineAllDiff = (key: 'r' | 'c') =>
    [0, 1, 2].every((i) => {
      const vs = known.filter((k) => k[key] === i).map((k) => k.v);
      return new Set(vs).size === vs.length;
    });
  if (distinct.size === 3 && lineAllDiff('r') && lineAllDiff('c')) {
    const inRow = new Set(known.filter((k) => k.r === hr).map((k) => k.v));
    const missing = [...distinct].filter((v) => !inRow.has(v));
    const inCol = new Set(known.filter((k) => k.c === hc).map((k) => k.v));
    if (missing.length === 1 && !inCol.has(missing[0])) out.push({ rule: 'latin', next: missing[0] });
  }
  if (numeric && distinct.size > 1) {
    // first + second = third in every complete row; the hole's row gives the prediction.
    const full = [0, 1, 2].filter((r) => r !== hr);
    if (full.every((r) => Number(vals[r][0]) + Number(vals[r][1]) === Number(vals[r][2]))) {
      const row = vals[hr].map(Number);
      const next = hc === 2 ? row[0] + row[1] : hc === 1 ? row[2] - row[0] : row[2] - row[1];
      if (next >= 1) out.push({ rule: 'sum', next: String(next) });
    }
  }
  return out;
};

const RULE_TEXT = (a: Attr, rule: RuleKind, ans: Term): string => {
  const what = a === 'kind' ? 'shape' : a === 'look' ? 'colour' : a === 'count' ? 'number' : 'turn';
  const v = a === 'kind' ? KIND_NAME[ans.kind] : a === 'look' ? lookWord(ans.look) : a === 'count' ? String(ans.count) : 'that way';
  switch (rule) {
    case 'row':
      return `Each row has its own ${what}. This row's ${what} is ${v}.`;
    case 'col':
      return a === 'rot' ? 'Each column points its own way. Copy the last column.' : `Each column has its own ${what}. This column's is ${v}.`;
    case 'latin':
      return `Every row has one of each ${what}. The missing ${what} is ${v}.`;
    case 'sum':
      return `In each row, first + second = third. Here that makes ${v}.`;
    default:
      return `The ${what} is always ${v}.`;
  }
};

const attempt = (d: Difficulty, rng: Rng): Puzzle | null => {
  const pl = plan(d, rng);
  const hole = d === 1 || pl.variant === 'sum' ? { r: 2, c: 2 } : rng() < 0.6 ? { r: 2, c: 2 } : { r: randInt(0, 2, rng), c: randInt(0, 2, rng) };
  const ans = pl.cells[hole.r][hole.c];
  const cells: GridCell[] = [];
  pl.cells.forEach((row, r) =>
    row.forEach((t, c) => {
      if (r === hole.r && c === hole.c) return;
      cells.push({ r, c, node: drawTerm(t, CELL / 2, CELL / 2, K, `m${r}${c}`) });
    }),
  );
  const g = grid(PAD, PAD, 3, 3, CELL, { id: 'mx', cells, unknown: [hole] });
  const visual = spec(CELL * 3 + PAD * 2, CELL * 3 + PAD * 2, [g], '3 by 3 grid of pictures with one missing');

  // Distractors: each attribute wrong once, the neighbours.
  const pool: Wrong[] = [];
  const attrs = Object.keys(pl.rules) as Attr[];
  for (const a of shuffle(attrs, rng)) {
    const seen = [...new Set(pl.cells.flat().map((t) => value(t, a)))].filter((v) => v !== value(ans, a));
    for (const v of shuffle(seen, rng)) pool.push({ visual: optionVisual(setValue(ans, a, v)), why: `the ${a === 'look' ? 'colour' : a === 'kind' ? 'shape' : a === 'count' ? 'number' : 'turn'} is wrong` });
    if (a === 'count') {
      if (ans.count + 1 <= 6) pool.push({ visual: optionVisual({ ...ans, count: ans.count + 1 }), why: 'one too many' });
      if (ans.count - 1 >= 1) pool.push({ visual: optionVisual({ ...ans, count: ans.count - 1 }), why: 'one too few' });
    }
    if (a === 'rot') pool.push({ visual: optionVisual({ ...ans, rot: (ans.rot + 180) % 360 }), why: 'it points the wrong way' });
  }
  const neighbours: Array<[number, number, string]> = [
    [hole.r - 1, hole.c, 'that is the picture above'],
    [hole.r, hole.c - 1, 'that is the picture to the left'],
    [hole.r + 1, hole.c, 'that is the picture below'],
    [hole.r, hole.c + 1, 'that is the picture to the right'],
  ];
  const near: Wrong[] = neighbours
    .filter(([r, c]) => r >= 0 && r < 3 && c >= 0 && c < 3)
    .map(([r, c, why]) => ({ visual: optionVisual(pl.cells[r][c]), why }));
  const fillKinds = KINDS_ALL.filter((k) => !pl.cells.flat().some((t) => t.kind === k));
  const fillers: Wrong[] = shuffle(fillKinds, rng)
    .slice(0, 2)
    .map((k) => ({ visual: optionVisual({ ...ans, kind: k }), why: `there are no ${plural(KIND_NAME[k])} in the grid` }));
  // Easy: a 2×2 "factorial" set (wrong first rule, wrong second rule, both wrong), so the answer is
  // never the option that has the most in common with the others ("most typical" shortcut).
  const factorial: Wrong[] = [];
  if (d === 1 && attrs.length === 2) {
    const [a1, a2] = shuffle(attrs, rng);
    const other = (a: Attr) => pick([...new Set(pl.cells.flat().map((t) => value(t, a)))].filter((v) => v !== value(ans, a)), rng);
    const v1 = other(a1);
    const v2 = other(a2);
    const say = (a: Attr) => (a === 'look' ? 'colour' : a === 'kind' ? 'shape' : 'number');
    factorial.push(
      { visual: optionVisual(setValue(ans, a1, v1)), why: `the ${say(a1)} is wrong` },
      { visual: optionVisual(setValue(ans, a2, v2)), why: `the ${say(a2)} is wrong` },
      { visual: optionVisual(setValue(setValue(ans, a1, v1), a2, v2)), why: `the ${say(a1)} and the ${say(a2)} are wrong` },
    );
  }
  const wrong = (d === 1 ? pickWrong : (a: VisualSpec, p: Wrong[], k: number) => pickWrongFair(a, p, k, rng))(optionVisual(ans), [...factorial, ...shuffle([...pool.slice(0, 4), ...near.slice(0, 2)], rng), ...pool.slice(4), ...near.slice(2), ...fillers], OPTION_COUNT[d]);
  if (!wrong) return null;

  const explanation: ExplainStep[] = attrs.slice(0, 3).map((a) => ({
    text: clip(RULE_TEXT(a, pl.rules[a]!, ans)),
    visual,
  }));
  explanation.push({ text: clip(`So the missing picture is the ${termWord(ans, 'count' in pl.rules ? ['count'] : [])}.`), visual: optionVisual(ans) });

  return finish(ID, d, {
    prompt: 'Which picture fills the empty square?',
    visual,
    answer: choice(rng, optionVisual(ans), wrong),
    explanation: explanation.slice(-4),
    rule: pl.rule,
    variant: pl.variant,
  });
};

export const deriveMatrix = (p: Puzzle): { next: Term | null; errs: string[] } => {
  const g = byId(p.visual.nodes, 'mx');
  if (!g || g.t !== 'grid' || !g.unknown || g.unknown.length !== 1) return { next: null, errs: ['no matrix grid'] };
  const hole = g.unknown[0];
  const terms: Grid3<Term | null> = build(() => null);
  for (const c of g.cells ?? []) terms[c.r][c.c] = readTerm(c.node, K);
  const knownCount = terms.flat().filter(Boolean).length;
  if (knownCount !== 8 || terms[hole.r][hole.c] !== null) return { next: null, errs: ['matrix must show 8 pictures'] };
  let next: Term = { ...(terms.flat().find(Boolean) as Term) };
  const errs: string[] = [];
  for (const a of ATTRS) {
    const vals = terms.map((row) => row.map((t) => (t ? value(t, a) : null)));
    const fits = matrixFits(vals, a === 'count');
    const preds = new Set(fits.map((f) => f.next));
    if (preds.size !== 1) errs.push(`attribute ${a}: ${preds.size ? 'ambiguous' : 'no rule'} (${fits.map((f) => f.rule).join(',')})`);
    else next = setValue(next, a, [...preds][0]);
  }
  if (next.count > 6) errs.push('count too big');
  return { next: errs.length ? null : next, errs };
};

export const validateMatrix = (p: Puzzle): string[] => {
  const { next, errs } = deriveMatrix(p);
  if (!next) return errs;
  return checkVisualChoice(p, optionVisual(next));
};

export const matrix: PuzzleFamily = {
  id: ID,
  title: 'Picture grids',
  emoji: '🔲',
  group: 'shape',
  variants: [...VARIANTS[1], ...VARIANTS[2], ...VARIANTS[3]],
  generate: (d, rng) => generateValid(() => attempt(d, rng), validateMatrix),
  validate: validateMatrix,
};
