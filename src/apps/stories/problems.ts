/**
 * Story Problems bank (docs/UX-V3.md §7.1).
 *
 * Five levels, each a handful of templates. A template ("join:L1") is the unit of mastery (Leitner
 * boxes via src/drill); `makeStory()` turns it into a concrete story with a hint, a number sentence,
 * a worked answer and (for small numbers) an emoji picture he can count.
 * Every answer is a whole number 1..100; nothing negative, nothing fractional.
 */
import type { Fact } from '../../drill';
import { NAMES, THINGS, nowAnswer, nowQuestion, plural, startLine } from './things';
import type { Theme, Thing } from './things';
import { SEEDS } from './seeds';

export type LevelId = 1 | 2 | 3 | 4 | 5;
export type Kind = 'join' | 'take' | 'more' | 'groups' | 'share' | 'skip' | 'missing' | 'twostep';

export type Pic =
  | { kind: 'join'; emoji: string; parts: number[] }
  | { kind: 'take'; emoji: string; total: number; away: number }
  | { kind: 'compare'; emoji: string; rows: Array<{ label: string; count: number }> }
  | { kind: 'groups'; emoji: string; groups: number; each: number }
  | { kind: 'share'; emoji: string; total: number; groups: number }
  | { kind: 'seq'; items: Array<number | null> };

export interface Story {
  /** Unique enough to avoid an immediate repeat: `join:L1:diamonds:3+2`. */
  key: string;
  templateId: string;
  level: LevelId;
  kind: Kind;
  theme: Theme;
  /** 1–3 short sentences, each shown on its own line. */
  sentences: string[];
  /** The question line (bold). */
  question: string;
  answer: number;
  /** Numbers in the story (voice echo guard: saying "3" from "3 apples" is not an answer). */
  operands: number[];
  /** First-miss hint in words. */
  hint: string;
  /** Number sentence with the box, e.g. `3 + 2 = ☐` (shown with the hint). */
  sentence: string;
  /** Worked answer lines, e.g. ['3 + 2 = 5'] or two steps. */
  worked: string[];
  /** "Mia has 5 apples now." */
  answerLine: string;
  /** Emoji picture (shown under the text when `showPic`, always in the worked answer). */
  pic: Pic | null;
  showPic: boolean;
  /** What "🔊 Read it to me" says. */
  speech: string;
  /** Picture emoji for the summary chip. */
  emoji: string;
}

export interface TemplateDef {
  id: string;
  kind: Kind;
  title: string;
  /** Difficulty prior (selection weight + points). */
  prior: number;
}

export interface LevelDef {
  id: LevelId;
  title: string;
  emoji: string;
  blurb: string;
  /** Example number sentence on the level card. */
  example: string;
  templates: TemplateDef[];
}

export const STORIES_PER_ROUND = 8;
export const MAX_ANSWER = 100;

const T = (level: LevelId, kind: Kind, title: string, prior: number): TemplateDef => ({ id: `${kind}:L${level}`, kind, title, prior });

export const LEVELS: LevelDef[] = [
  {
    id: 1, title: 'Within 20', emoji: '🍎', blurb: 'Add, take away, count on', example: '3 + 2 = ?',
    templates: [T(1, 'join', 'Get more', 0.4), T(1, 'take', 'Take away', 0.5), T(1, 'more', 'How many more', 0.7), T(1, 'skip', 'Count by 2s, 5s, 10s', 0.5)],
  },
  {
    id: 2, title: 'Within 100', emoji: '💯', blurb: 'Big numbers, no carrying', example: '42 + 15 = ?',
    templates: [T(2, 'join', 'Get more', 0.7), T(2, 'take', 'Take away', 0.8), T(2, 'more', 'How many more', 1), T(2, 'missing', 'Missing number', 0.7)],
  },
  {
    id: 3, title: 'Carry & borrow', emoji: '🧱', blurb: 'Big numbers that regroup', example: '38 + 25 = ?',
    templates: [T(3, 'join', 'Get more', 1.1), T(3, 'take', 'Take away', 1.3), T(3, 'more', 'How many more', 1.4)],
  },
  {
    id: 4, title: 'Groups & sharing', emoji: '🎁', blurb: 'Bags of, share between', example: '3 bags of 4 = ?',
    templates: [T(4, 'groups', 'Equal groups', 1), T(4, 'share', 'Share fairly', 1.2), T(4, 'skip', 'Count by 3s, 4s', 0.9)],
  },
  {
    id: 5, title: 'Two steps', emoji: '🧗', blurb: 'Two things happen', example: '20 + 5 − 8 = ?',
    templates: [T(5, 'twostep', 'Two steps', 1.6)],
  },
];

export function isLevelId(n: unknown): n is LevelId {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

export function levelDef(level: LevelId): LevelDef {
  return LEVELS[level - 1];
}

/** Templates as drill "facts" so the shared scheduler and mastery store can drive them. */
export function templateFacts(level: LevelId): Fact[] {
  return levelDef(level).templates.map((t) => ({
    id: t.id,
    prompt: t.title,
    answer: 0,
    operands: [],
    op: '+',
    prior: t.prior,
    tags: [`L${level}`],
  }));
}

export function templateById(id: string): TemplateDef | undefined {
  for (const l of LEVELS) {
    const t = l.templates.find((x) => x.id === id);
    if (t) return t;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

type Rng = () => number;
const ri = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <X>(rng: Rng, xs: readonly X[]): X => xs[Math.floor(rng() * xs.length)];
const ones = (n: number) => n % 10;

function twoNames(rng: Rng): [string, string] {
  const a = pick(rng, NAMES);
  let b = pick(rng, NAMES);
  for (let i = 0; i < 6 && b === a; i++) b = pick(rng, NAMES);
  if (b === a) b = NAMES[(NAMES.indexOf(a) + 1) % NAMES.length];
  return [a, b];
}

function thingFor(rng: Rng, needBig: boolean, filter?: (t: Thing) => boolean): Thing {
  const pool = THINGS.filter((t) => (!needBig || t.big) && (!filter || filter(t)));
  return pick(rng, pool);
}

/** Pictures are for counting: only when every quantity is small. */
const PIC_MAX = 20;

// ---------------------------------------------------------------------------
// Story builders
// ---------------------------------------------------------------------------

interface Built {
  sentences: string[];
  question: string;
  answer: number;
  operands: number[];
  hint: string;
  sentence: string;
  worked: string[];
  answerLine: string;
  pic: Pic | null;
  thing: Thing | null;
  keyPart: string;
}

function joinStory(rng: Rng, a: number, b: number, big: boolean): Built {
  const t = thingFor(rng, big);
  const [n] = twoNames(rng);
  const s = a + b;
  return {
    sentences: [startLine(t, n, a), t.gain(n, b)],
    question: nowQuestion(t, n),
    answer: s,
    operands: [a, b],
    hint: `${n} starts with ${a}, then gets ${b} more. Put them together!`,
    sentence: `${a} + ${b} = ☐`,
    worked: [...regroupAdd(a, b), `${a} + ${b} = ${s}`],
    answerLine: nowAnswer(t, n, s),
    pic: Math.max(a, b, s) <= PIC_MAX ? { kind: 'join', emoji: t.emoji, parts: [a, b] } : null,
    thing: t,
    keyPart: `${t.id}:${a}+${b}`,
  };
}

function takeStory(rng: Rng, a: number, b: number, big: boolean): Built {
  const t = thingFor(rng, big);
  const [n, m] = twoNames(rng);
  const d = a - b;
  const giveAway = t.owned && t.id !== 'points' && rng() < 0.3;
  const second = giveAway ? `${n} gives ${b} to ${m}.` : t.lose(n, b);
  return {
    sentences: [startLine(t, n, a), second],
    question: nowQuestion(t, n, 'left'),
    answer: d,
    operands: [a, b],
    hint: `${n} had ${a}. ${b} went away. Take ${b} away from ${a}!`,
    sentence: `${a} − ${b} = ☐`,
    worked: [...regroupSub(a, b), `${a} − ${b} = ${d}`],
    answerLine: nowAnswer(t, n, d, 'left'),
    pic: a <= PIC_MAX ? { kind: 'take', emoji: t.emoji, total: a, away: b } : null,
    thing: t,
    keyPart: `${t.id}:${a}-${b}`,
  };
}

function moreStory(rng: Rng, a: number, b: number, big: boolean): Built {
  const t = thingFor(rng, big);
  const [n, m] = twoNames(rng);
  const d = a - b;
  const verb = t.owned ? 'has' : 'sees';
  const verbQ = t.owned ? 'have' : 'see';
  // Two phrasings: compare two kids, or "needs N to …".
  if (t.owned && rng() < 0.35) {
    return {
      sentences: [`${n} needs ${plural(a, t.one, t.many)} to win a prize.`, `${n} has ${b} so far.`],
      question: `How many more ${t.many} does ${n} need?`,
      answer: d,
      operands: [a, b],
      hint: `Count up from ${b} to ${a}. Or take ${b} away from ${a}!`,
      sentence: `${b} + ☐ = ${a}`,
      worked: [...regroupSub(a, b), `${a} − ${b} = ${d}`, `${b} + ${d} = ${a}`],
      answerLine: `${n} needs ${d} more.`,
      pic: a <= PIC_MAX ? { kind: 'compare', emoji: t.emoji, rows: [{ label: 'Prize', count: a }, { label: n, count: b }] } : null,
      thing: t,
      keyPart: `${t.id}:need${a}-${b}`,
    };
  }
  return {
    sentences: [`${n} ${verb} ${plural(a, t.one, t.many)}.`, `${m} ${verb} ${plural(b, t.one, t.many)}.`],
    question: `How many more ${t.many} does ${n} ${verbQ} than ${m}?`,
    answer: d,
    operands: [a, b],
    hint: `Line them up! How many extra does ${n} ${verbQ}? Take ${b} away from ${a}.`,
    sentence: `${a} − ${b} = ☐`,
    worked: [...regroupSub(a, b), `${a} − ${b} = ${d}`],
    answerLine: `${n} ${verb} ${d} more than ${m}.`,
    pic: a <= PIC_MAX ? { kind: 'compare', emoji: t.emoji, rows: [{ label: n, count: a }, { label: m, count: b }] } : null,
    thing: t,
    keyPart: `${t.id}:cmp${a}-${b}`,
  };
}

function groupsStory(rng: Rng, g: number, k: number): Built {
  const t = thingFor(rng, false, (x) => (x.owned && x.id !== 'points') || x.id === 'fish' || x.id === 'frogs');
  const [n] = twoNames(rng);
  const [h1, hN] = t.holder;
  const s = g * k;
  return {
    sentences: [`${n} has ${plural(g, h1, hN)}.`, `Each ${h1} has ${plural(k, t.one, t.many)}.`],
    question: `How many ${t.many} are there in all?`,
    answer: s,
    operands: [g, k],
    hint: `${g} groups of ${k}. Count by ${k}s, ${g} times!`,
    sentence: `${g} × ${k} = ☐`,
    worked: [Array.from({ length: g }, (_, i) => String((i + 1) * k)).join(', '), `${g} × ${k} = ${s}`],
    answerLine: `There are ${plural(s, t.one, t.many)} in all.`,
    pic: { kind: 'groups', emoji: t.emoji, groups: g, each: k },
    thing: t,
    keyPart: `${t.id}:${g}x${k}`,
  };
}

function shareStory(rng: Rng, g: number, k: number): Built {
  const t = thingFor(rng, false, (x) => x.owned && x.id !== 'points');
  const [n] = twoNames(rng);
  const total = g * k;
  const [h1, hN] = t.holder;
  const friends = !t.container || rng() < 0.5;
  return {
    sentences: friends
      ? [`${n} has ${plural(total, t.one, t.many)}.`, `${n} shares them fairly with ${g} friends.`]
      : [`${n} has ${plural(total, t.one, t.many)}.`, `${n} puts them into ${plural(g, h1, hN)}, the same in each.`],
    question: friends ? `How many ${t.many} does each friend get?` : `How many ${t.many} go in each ${h1}?`,
    answer: k,
    operands: [total, g],
    hint: `Deal them out one at a time into ${g} groups. How many in each?`,
    sentence: `${total} ÷ ${g} = ☐`,
    worked: [`${g} × ${k} = ${total}`, `${total} ÷ ${g} = ${k}`],
    answerLine: friends ? `Each friend gets ${plural(k, t.one, t.many)}.` : `Each ${h1} gets ${plural(k, t.one, t.many)}.`,
    pic: { kind: 'share', emoji: t.emoji, total, groups: g },
    thing: t,
    keyPart: `${t.id}:${total}/${g}`,
  };
}

const SKIP_LEADS: Array<(n: string, step: number) => string> = [
  (n, s) => `${n} counts by ${s}s.`,
  (_n, s) => `A frog 🐸 hops ${s} at a time.`,
  (n, s) => `${n} stacks blocks 🧱 ${s} at a time.`,
  (_n, s) => `A rocket 🚀 climbs ${s} miles every second.`,
  (n, s) => `${n} scores ${s} points each time.`,
];

function seqStory(rng: Rng, start: number, step: number, len: number, hole: number, down = false): Built {
  const [n] = twoNames(rng);
  const items = Array.from({ length: len }, (_, i) => (down ? start - i * step : start + i * step));
  const answer = items[hole];
  const shown = items.map((v, i) => (i === hole ? null : v));
  const next = hole === len - 1;
  const lead = down ? `${n} counts back by ${step}s.` : step === 1 ? `${n} counts up, 1 at a time.` : pick(rng, SKIP_LEADS)(n, step);
  const prev = items[hole - 1] ?? items[hole + 1];
  return {
    sentences: [lead],
    question: next ? 'What number comes next?' : 'What number is missing?',
    answer,
    operands: items.filter((_, i) => i !== hole),
    hint: hole > 0 ? `Start at ${prev} and ${down ? 'go back' : 'jump'} ${step} more.` : `Go back ${step} from ${items[1]}.`,
    sentence: shown.map((v) => (v === null ? '☐' : String(v))).join(', '),
    worked: [hole > 0 ? `${prev} ${down ? '−' : '+'} ${step} = ${answer}` : `${items[1]} − ${step} = ${answer}`, items.join(', ')],
    answerLine: `The number is ${answer}.`,
    pic: { kind: 'seq', items: shown },
    thing: null,
    keyPart: `seq:${items.join(',')}:${hole}`,
  };
}

function twoStepStory(rng: Rng): Built {
  const shape = pick(rng, ['gain-lose', 'lose-gain', 'three', 'groups-plus'] as const);
  const [n, m] = twoNames(rng);
  if (shape === 'groups-plus') {
    const t = thingFor(rng, false, (x) => Boolean(x.container));
    const g = ri(rng, 2, 5);
    const k = ri(rng, 2, 5);
    const c = ri(rng, 2, 9);
    const s = g * k + c;
    const [h1, hN] = t.holder;
    return {
      sentences: [`${n} has ${plural(g, h1, hN)} with ${plural(k, t.one, t.many)} in each.`, `${n} also has ${c} more on the table.`],
      question: `How many ${t.many} does ${n} have in all?`,
      answer: s,
      operands: [g, k, c],
      hint: `First: ${g} groups of ${k}. Then add the ${c} on the table.`,
      sentence: `${g} × ${k} + ${c} = ☐`,
      worked: [`${g} × ${k} = ${g * k}`, `${g * k} + ${c} = ${s}`],
      answerLine: `${n} has ${plural(s, t.one, t.many)} in all.`,
      pic: null,
      thing: t,
      keyPart: `${t.id}:${g}x${k}+${c}`,
    };
  }
  const t = thingFor(rng, true);
  if (shape === 'three') {
    const a = ri(rng, 5, 30);
    const b = ri(rng, 5, 30);
    const c = ri(rng, 2, Math.min(30, MAX_ANSWER - a - b));
    const s = a + b + c;
    const verb = t.owned ? 'has' : 'sees';
    return {
      sentences: [`${n} ${verb} ${plural(a, t.one, t.many)}.`, `${m} ${verb} ${plural(b, t.one, t.many)}.`, `Their friend ${verb} ${plural(c, t.one, t.many)}.`],
      question: `How many ${t.many} is that all together?`,
      answer: s,
      operands: [a, b, c],
      hint: `Add two of them first, then add the last one.`,
      sentence: `${a} + ${b} + ${c} = ☐`,
      worked: [`${a} + ${b} = ${a + b}`, `${a + b} + ${c} = ${s}`],
      answerLine: `That is ${plural(s, t.one, t.many)} all together.`,
      pic: null,
      thing: t,
      keyPart: `${t.id}:${a}+${b}+${c}`,
    };
  }
  if (shape === 'gain-lose') {
    const a = ri(rng, 10, 60);
    const b = ri(rng, 5, Math.min(30, MAX_ANSWER - a));
    const c = ri(rng, 2, a + b - 1);
    const s = a + b - c;
    return {
      sentences: [startLine(t, n, a), t.gain(n, b), `Then: ${lowerFirst(t.lose(n, c))}`],
      question: nowQuestion(t, n),
      answer: s,
      operands: [a, b, c],
      hint: `First add the ${b} more. Then take away the ${c}.`,
      sentence: `${a} + ${b} − ${c} = ☐`,
      worked: [`${a} + ${b} = ${a + b}`, `${a + b} − ${c} = ${s}`],
      answerLine: nowAnswer(t, n, s),
      pic: null,
      thing: t,
      keyPart: `${t.id}:${a}+${b}-${c}`,
    };
  }
  const a = ri(rng, 15, 70);
  const b = ri(rng, 2, a - 1);
  const c = ri(rng, 2, Math.min(30, MAX_ANSWER - (a - b)));
  const s = a - b + c;
  return {
    sentences: [startLine(t, n, a), t.lose(n, b), `Then: ${lowerFirst(t.gain(n, c))}`],
    question: nowQuestion(t, n),
    answer: s,
    operands: [a, b, c],
    hint: `First take away the ${b}. Then add the ${c} more.`,
    sentence: `${a} − ${b} + ${c} = ☐`,
    worked: [`${a} − ${b} = ${a - b}`, `${a - b} + ${c} = ${s}`],
    answerLine: nowAnswer(t, n, s),
    pic: null,
    thing: t,
    keyPart: `${t.id}:${a}-${b}+${c}`,
  };
}

function lowerFirst(s: string): string {
  // Keep names capitalised ("Then: Mia mines 3 more."); only lower a leading article/number word.
  return /^(A|An|The|Pop)\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Tens-and-ones steps for a regrouping sum (L3 worked answers). */
function regroupAdd(a: number, b: number): string[] {
  if (a < 10 || ones(a) + ones(b) < 10) return [];
  if (b < 10) {
    // Make the next ten: 56 + 6 → 56 + 4 = 60, 60 + 2 = 62.
    const up = 10 - ones(a);
    return [`${a} + ${up} = ${a + up}`, `${a + up} + ${b - up} = ${a + b}`];
  }
  const t = a - ones(a) + (b - ones(b));
  const o = ones(a) + ones(b);
  return [`${a - ones(a)} + ${b - ones(b)} = ${t}`, `${ones(a)} + ${ones(b)} = ${o}`, `${t} + ${o} = ${t + o}`];
}

/** Count-back steps for a borrowing difference (L3 worked answers). */
function regroupSub(a: number, b: number): string[] {
  if (a < 10 || ones(b) <= ones(a)) return [];
  if (b < 10) {
    // Back to the ten: 62 − 7 → 62 − 2 = 60, 60 − 5 = 55.
    const down = ones(a);
    return down === 0 ? [] : [`${a} − ${down} = ${a - down}`, `${a - down} − ${b - down} = ${a - b}`];
  }
  const tens = b - ones(b);
  const mid = a - tens;
  return [`${a} − ${tens} = ${mid}`, `${mid} − ${ones(b)} = ${mid - ones(b)}`];
}

// ---------------------------------------------------------------------------
// Number choices per level
// ---------------------------------------------------------------------------

function joinNums(rng: Rng, level: LevelId): [number, number] {
  if (level === 1) {
    const a = ri(rng, 2, 10);
    const b = ri(rng, 1, Math.min(10, 20 - a));
    return [a, b];
  }
  if (level === 2) {
    // within 100, no carry
    for (;;) {
      const a = ri(rng, 11, 78);
      const b = rng() < 0.3 ? ri(rng, 2, 9) : ri(rng, 10, 89 - (a - ones(a)));
      if (ones(a) + ones(b) <= 9 && a + b <= 99 && b >= 2) return [a, b];
    }
  }
  // level 3: carry
  for (;;) {
    const a = ri(rng, 15, 79);
    const b = ri(rng, 6, 59);
    if (ones(a) + ones(b) >= 10 && a + b <= 99) return [a, b];
  }
}

function takeNums(rng: Rng, level: LevelId): [number, number] {
  if (level === 1) {
    const a = ri(rng, 4, 20);
    const b = ri(rng, 1, Math.min(10, a - 1));
    return [a, b];
  }
  if (level === 2) {
    for (;;) {
      const a = ri(rng, 25, 99);
      const b = rng() < 0.3 ? ri(rng, 1, 9) : ri(rng, 11, a - 10);
      if (ones(b) <= ones(a) && b < a && a - b >= 2) return [a, b];
    }
  }
  for (;;) {
    const a = ri(rng, 21, 95);
    const b = ri(rng, 6, a - 2);
    if (ones(b) > ones(a) && a - b >= 2) return [a, b];
  }
}

function moreNums(rng: Rng, level: LevelId): [number, number] {
  if (level === 1) {
    const a = ri(rng, 4, 15);
    const b = ri(rng, 1, a - 1);
    return [a, b];
  }
  return takeNums(rng, level);
}

function skipSeq(rng: Rng, level: LevelId): Built {
  if (level === 1) {
    const step = pick(rng, [1, 2, 2, 5, 5, 10]);
    const start = step === 1 ? ri(rng, 3, 14) : step === 2 ? pick(rng, [2, 4, 6]) : step;
    return seqStory(rng, start, step, 5, 4);
  }
  if (level === 2) {
    // L2 "missing": tens off the decade, 5s, or counting back by 10s; hole anywhere but first.
    const mode = pick(rng, ['tens', 'fives', 'back'] as const);
    if (mode === 'back') return seqStory(rng, ri(rng, 6, 9) * 10 + ri(rng, 0, 9), 10, 5, ri(rng, 1, 4), true);
    if (mode === 'tens') return seqStory(rng, ri(rng, 1, 5) * 10 + ri(rng, 1, 9), 10, 5, ri(rng, 1, 4));
    return seqStory(rng, ri(rng, 2, 10) * 5, 5, 5, ri(rng, 1, 4));
  }
  // level 4: count by 3s/4s (and 2s/5s) from the step
  const step = pick(rng, [2, 3, 3, 4, 4, 5]);
  return seqStory(rng, step, step, 5, ri(rng, 2, 4));
}

function build(templateId: string, rng: Rng): Built {
  const t = templateById(templateId);
  if (!t) throw new Error(`unknown story template ${templateId}`);
  const level = Number(templateId.split(':L')[1]) as LevelId;
  const big = level >= 2;
  switch (t.kind) {
    case 'join': {
      const [a, b] = joinNums(rng, level);
      return joinStory(rng, a, b, big);
    }
    case 'take': {
      const [a, b] = takeNums(rng, level);
      return takeStory(rng, a, b, big);
    }
    case 'more': {
      const [a, b] = moreNums(rng, level);
      return moreStory(rng, a, b, big);
    }
    case 'groups':
      return groupsStory(rng, ri(rng, 2, 5), ri(rng, 2, 5));
    case 'share':
      return shareStory(rng, ri(rng, 2, 5), ri(rng, 2, 5));
    case 'skip':
    case 'missing':
      return skipSeq(rng, level);
    case 'twostep':
      return twoStepStory(rng);
  }
}

function speechFor(sentences: string[], question: string, pic: Pic | null): string {
  // Emoji are read out loud by some voices ("red apple"); strip them. Sequences read "blank".
  const strip = (s: string) => s.replace(/\p{Extended_Pictographic}️?/gu, '').replace(/\s+/g, ' ').trim();
  const seq = pic?.kind === 'seq' ? pic.items.map((v) => (v === null ? 'blank' : String(v))).join(', ') + '.' : '';
  return [...sentences.map(strip), seq, strip(question)].filter(Boolean).join(' ');
}

/** Make a concrete story for a template. Level-1/2 add/take templates sometimes use a hand-written seed. */
export function makeStory(templateId: string, rng: Rng = Math.random): Story {
  const t = templateById(templateId);
  if (!t) throw new Error(`unknown story template ${templateId}`);
  const level = Number(templateId.split(':L')[1]) as LevelId;
  const seeds = SEEDS.filter((s) => s.templateId === templateId);
  if (seeds.length && rng() < 0.25) {
    const s = pick(rng, seeds);
    return {
      ...s,
      level,
      kind: t.kind,
      key: `seed:${s.id}`,
      showPic: Boolean(s.pic) && level <= 2,
      speech: speechFor(s.sentences, s.question, s.pic),
    };
  }
  const b = build(templateId, rng);
  const smallPic = b.pic !== null && (b.pic.kind === 'seq' || level <= 2 || level === 4);
  return {
    key: `${templateId}:${b.keyPart}`,
    templateId,
    level,
    kind: t.kind,
    theme: b.thing?.theme ?? 'sports',
    sentences: b.sentences,
    question: b.question,
    answer: b.answer,
    operands: b.operands,
    hint: b.hint,
    sentence: b.sentence,
    worked: b.worked,
    answerLine: b.answerLine,
    pic: b.pic,
    showPic: smallPic,
    speech: speechFor(b.sentences, b.question, b.pic),
    emoji: b.thing?.emoji ?? '🔢',
  };
}

export const ALL_TEMPLATE_IDS = LEVELS.flatMap((l) => l.templates.map((t) => t.id));
