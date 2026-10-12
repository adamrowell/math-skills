/**
 * Spoken-number parsing and the expected-answer-aware number matcher.
 *
 * Safety first: a 7-year-old must never get points for an answer he did not say, and
 * should rarely be told "wrong" because the recognizer misheard him. So:
 *   - Homophones that are also common English words ("for", "to", "won", "ate", "free",
 *     "tree", "sex", "oh") only count as numbers when the utterance contains nothing
 *     else that is a number, or when they complete a compound ("sixty for" → 64,
 *     "won hundred" → 100). "I want to go" is not 2.
 *   - The verdict is judged on the LAST number heard ("7 times 8 is 56", "54… no, 56").
 *   - Echoing the question ("seven times eight", "seven eight") is 'unclear', never 'wrong'.
 *   - A spoken prefix of the answer ("fifty" of 56, "one hundred" of 108) is 'unclear' +
 *     partial, so the caller can merge it with what comes next.
 *   - 'wrong' needs a clearly parsed, plausible, different number, and (when the engine
 *     reports one) confidence ≥ minConfidence.
 */
import type { MatchNumberAnswer, NumberMatchOptions, NumberMatchResult } from '../types';
import { normalizeTranscript } from './normalize';
import { lookupAlias } from './corrections';

type Kind = 'unit' | 'teen' | 'tens' | 'digits';

const STRONG: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // Child pronunciations / ASR spellings that are not ordinary English words.
  wun: 1, twee: 3, fwee: 3, thwee: 3, foh: 4, fowr: 4, fiv: 5, fife: 5, siks: 6, sicks: 6, seben: 7,
  sebben: 7, sevin: 7, nyne: 9, tenn: 10, leven: 11, elven: 11, twelf: 12, twelv: 12,
  thirdteen: 13, fourteeen: 14, fiveteen: 15, fiteen: 15, fifeteen: 15, sixtine: 16,
  twenny: 20, tweny: 20, twendy: 20, thirdy: 30, tirty: 30, firty: 30, fourty: 40, fordy: 40, forthy: 40,
  fitty: 50, fiddy: 50, fifdy: 50, fivty: 50, sixdy: 60, sixtie: 60, sebenty: 70, sevendy: 70,
  eighdy: 80, eigthy: 80, aidy: 80, ninedy: 90, nindy: 90, ninty: 90,
};

/** Homophones that are also real words — numeric only in a number-only context or in a compound. */
const WEAK: Record<string, number> = {
  oh: 0, o: 0, nought: 0, naught: 0,
  won: 1, wan: 1,
  to: 2, too: 2, tu: 2, tew: 2,
  tree: 3, free: 3,
  for: 4, fore: 4,
  hive: 5,
  sex: 6,
  ate: 8, ait: 8,
  nein: 9, mine: 9, nyan: 9,
  tin: 10,
};

const HUNDRED = new Set(['hundred', 'hundreds', 'hunnerd', 'hunderd', 'hundrid', 'hundert', 'hundered']);
const THOUSAND = new Set(['thousand', 'thousands']);
const NEG = new Set(['negative', 'minus']);

/** Words that may surround an answer without changing it ("um, it's fifty six"). */
const FILLERS = new Set([
  'um', 'umm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'hmm', 'hm', 'mm', 'mmm', 'ah', 'ahh', 'eh',
  'is', 'its', 'it', 'the', 'answer', 'equals', 'equal', 'makes', 'i', 'think', 'say', 'says', 'said',
  'that', 'maybe', 'well', 'okay', 'ok', 'so', 'like', 'im', 'yeah', 'yes', 'yep', 'and', 'a', 'an',
  'times', 'x', 'multiplied', 'by', 'divided', 'plus', 'minus', 'negative', 'what', 'whats', 'got',
  'get', 'gets', 'be', 'would', 'will', 'hey', 'oh', 'o', 'wait', 'no', 'not', 'nope', 'actually',
  'thats', 'number', 'answers', 'are', 'was',
]);

const TENS_GLUE = /^(twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety)(one|two|three|four|five|six|seven|eight|nine)$/;

function kindOf(v: number): Kind {
  if (v < 10) return 'unit';
  if (v < 20) return 'teen';
  return v % 10 === 0 && v < 100 ? 'tens' : 'digits';
}

interface Tok {
  t: string;
  /** numeric value when the token is a number word/digits (strong or weak). */
  v?: number;
  weak?: boolean;
  digits?: boolean;
}

function splitTokens(normalized: string): Tok[] {
  const out: Tok[] = [];
  for (const raw of normalized.split(' ')) {
    if (!raw) continue;
    const glue = TENS_GLUE.exec(raw);
    const parts = glue ? [glue[1], glue[2]] : [raw];
    for (const t of parts) {
      if (/^\d+$/.test(t)) {
        // Very long digit runs are not answers ("1 2 3 4 5 6" read out, phone numbers).
        out.push({ t, v: t.length > 6 ? Number.NaN : parseInt(t, 10), digits: true });
      } else if (t in STRONG) out.push({ t, v: STRONG[t] });
      else if (t in WEAK) out.push({ t, v: WEAK[t], weak: true });
      else out.push({ t });
    }
  }
  return out;
}

export interface ParsedNumbers {
  normalized: string;
  candidates: number[];
}

/**
 * Parse every number in a transcript, left to right, combining compounds.
 * "seven times eight is fifty six" → [7, 8, 56]; "a hundred and forty four" → [144];
 * "sixty for" → [64]; "for" → [4]; "I want to go" → [].
 */
export function parseNumbers(text: string): ParsedNumbers {
  const normalized = normalizeTranscript(text);
  const toks = splitTokens(normalized);
  if (!toks.length) return { normalized, candidates: [] };

  const hasStrong = toks.some((k) => k.v !== undefined && !k.weak) || toks.some((k) => HUNDRED.has(k.t));
  const onlyNumberish = toks.every(
    (k) => k.v !== undefined || HUNDRED.has(k.t) || THOUSAND.has(k.t) || FILLERS.has(k.t),
  );
  // Weak homophones count on their own only when the utterance is otherwise number-free.
  const weakStandalone = !hasStrong && onlyNumberish;

  const candidates: number[] = [];
  let cur: number | null = null;
  let last: Kind | 'hundred' | 'and' | 'done' | 'one-oh' | null = null;
  let neg = false;
  let curNeg = false;

  const emit = () => {
    if (cur !== null && Number.isFinite(cur)) candidates.push(curNeg ? -cur : cur);
    cur = null;
    last = null;
    curNeg = false;
  };

  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    const next = toks[i + 1];

    if (HUNDRED.has(tk.t)) {
      if (cur === null) {
        cur = 100;
        curNeg = neg;
        neg = false;
      } else if (cur >= 1 && cur <= 9 && (last === 'unit' || last === 'done')) cur *= 100;
      else if (cur >= 10 && cur <= 99 && last !== 'hundred') {
        // "twelve hundred" style
        cur *= 100;
      } else {
        emit();
        cur = 100;
      }
      last = 'hundred';
      continue;
    }
    if (THOUSAND.has(tk.t)) {
      if (cur === null) cur = 1000;
      else if (cur < 1000) cur *= 1000;
      else {
        emit();
        cur = 1000;
      }
      last = 'hundred';
      continue;
    }
    if ((tk.t === 'and' || tk.t === 'n') && last === 'hundred' && next && (next.v !== undefined)) {
      last = 'and';
      continue;
    }
    if (tk.t === 'a' && next && (HUNDRED.has(next.t) || THOUSAND.has(next.t))) {
      emit();
      continue;
    }

    let v = tk.v;
    if (v !== undefined && tk.weak && !weakStandalone) {
      // A weak homophone is numeric only when it completes a compound.
      const afterTens = last === 'tens' && v >= 1 && v <= 9;
      const afterHundred = (last === 'hundred' || last === 'and') && v < 100;
      const beforeHundred = !!next && HUNDRED.has(next.t) && v >= 1 && v <= 9;
      const oneOh = last === 'unit' && cur === 1 && v === 0;
      const afterOneOh = last === 'one-oh' && v >= 1 && v <= 9;
      if (!(afterTens || afterHundred || beforeHundred || oneOh || afterOneOh)) v = undefined;
    }
    if (v === undefined) {
      if (NEG.has(tk.t)) {
        // "minus 3" at the start / after a non-number = negative; "8 minus 3" = operator.
        const prevIsNum = cur !== null;
        emit();
        if (!prevIsNum || tk.t === 'negative') neg = true;
        continue;
      }
      emit();
      neg = false;
      continue;
    }
    if (Number.isNaN(v)) {
      emit();
      continue;
    }
    const isDigits = tk.digits === true;
    const kind = kindOf(v);

    if (cur === null) {
      cur = v;
      // "100" said as digits behaves like "one hundred" (so "100 8" → 108).
      last = isDigits && v >= 100 && v < 1000 && v % 100 === 0 ? 'hundred' : kind;
      curNeg = neg;
      neg = false;
      continue;
    }
    if (last === 'tens' && v >= 1 && v <= 9 && (kind === 'unit')) {
      cur += v;
      last = 'done';
      continue;
    }
    if ((last === 'hundred' || last === 'and') && v < 100 && cur % 100 === 0) {
      cur += v;
      last = kind === 'tens' ? 'tens' : 'done';
      continue;
    }
    // Colloquial "one forty four" (144) / "one twenty" (120) / "one oh eight" (108).
    if (cur === 1 && last === 'unit' && v >= 20 && v <= 99) {
      cur = 100 + v;
      last = kind === 'tens' ? 'tens' : 'done';
      continue;
    }
    if (cur === 1 && last === 'unit' && v === 0 && !isDigits && next && next.v !== undefined && next.v >= 1 && next.v <= 9) {
      cur = 100;
      last = 'one-oh';
      continue;
    }
    if (last === 'one-oh' && v >= 1 && v <= 9) {
      cur += v;
      last = 'done';
      continue;
    }
    emit();
    cur = v;
    last = kind;
  }
  emit();
  return { normalized, candidates };
}

/** The single number an utterance means, or null when it holds zero or several. */
export function parseSingleNumber(text: string): number | null {
  const { candidates } = parseNumbers(text);
  return candidates.length === 1 ? candidates[0] : null;
}

/** True when `heard` is what a child says first on the way to `expected` ("fifty" → 56). */
export function isSpokenPrefix(heard: number, expected: number): boolean {
  if (heard <= 0 || heard >= expected) return false;
  // tens: 50 → 51..59
  if (heard >= 20 && heard < 100 && heard % 10 === 0 && expected < heard + 10) return true;
  // hundreds: 100 → 101..199, 300 → 301..399
  if (heard >= 100 && heard % 100 === 0 && expected < heard + 100) return true;
  // hundred + tens: 140 → 141..149
  if (heard > 100 && heard % 10 === 0 && heard % 100 >= 20 && expected < heard + 10 && Math.floor(expected / 100) === Math.floor(heard / 100)) return true;
  // colloquial "one … forty four"
  if (heard >= 1 && heard <= 9 && expected >= heard * 100 && expected < heard * 100 + 100) return true;
  return false;
}

function sameSeq(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** The candidates are the question read back (in order, or reversed), or a leading part of it. */
function isOperandEcho(cands: number[], operands: number[] | undefined): boolean {
  if (!operands || !operands.length || !cands.length) return false;
  const fwd = operands;
  const rev = [...operands].reverse();
  if (sameSeq(cands, fwd) || sameSeq(cands, rev)) return true;
  if (cands.length < operands.length) {
    return sameSeq(cands, fwd.slice(0, cands.length)) || sameSeq(cands, rev.slice(0, cands.length));
  }
  return false;
}

/**
 * The numbers that could be the child's answer: a leading read-back of the question
 * ("seven times eight is …") is removed. "7 8 56" → [56]; "54 no 56" → [54, 56].
 */
export function answerNumbers(candidates: number[], operands: number[] | undefined, normalized = ''): number[] {
  if (operands && operands.length && candidates.length > operands.length) {
    const head = candidates.slice(0, operands.length);
    if (sameSeq(head, operands) || sameSeq(head, [...operands].reverse())) return candidates.slice(operands.length);
  }
  // "six times nine is 54": the child restated a problem (maybe misread); its two operands are not answers.
  if (candidates.length > 2 && OPERATOR_WORD.test(normalized)) return candidates.slice(2);
  return candidates;
}

const OPERATOR_WORD = /\b(times|x|multiplied|plus|minus|divided|take away|add)\b/;

/**
 * 3+ numbers with one constant non-zero step ("0 1 2 3", "7 14 21"): counting, even when its
 * first numbers happen to equal the operands (0 × 1 → "zero one two three"). A read-back
 * such as "7 8 56" or "3 4 12" is never a constant-step run.
 */
export function isCountingRun(c: number[]): boolean {
  if (c.length < 3) return false;
  const step = c[1] - c[0];
  if (step === 0) return false;
  for (let i = 2; i < c.length; i++) if (c[i] - c[i - 1] !== step) return false;
  return true;
}

/** Most numbers a final answer may contain (a self-correction like "54… no, 56"). */
export const MAX_ANSWER_NUMBERS = 2;

export const matchNumberAnswer: MatchNumberAnswer = (transcript: string, options: NumberMatchOptions): NumberMatchResult => {
  const { expected, operands, allowNegative = false, maxPlausible = 1000, minConfidence = 0.5, confidence } = options;
  const { normalized, candidates } = parseNumbers(transcript ?? '');

  const unclear = (reason: string, extra: Partial<NumberMatchResult> = {}, allowAlias = true): NumberMatchResult => {
    // Learned alias: this exact text was twice followed by typing the expected answer.
    const alias = allowAlias ? lookupAlias(normalized) : undefined;
    if (alias !== undefined && String(alias) === String(expected)) {
      return { verdict: 'correct', heard: expected, candidates, normalized, viaAlias: true, reason: 'alias' };
    }
    return { verdict: 'unclear', candidates, normalized, reason, ...extra };
  };

  if (!candidates.length) return unclear(normalized ? 'no-number' : 'empty');

  const heard = candidates[candidates.length - 1];
  const echo = isOperandEcho(candidates, operands);
  // Counting or skip-counting until the answer goes by ("51 52 53 54 55 56", "7 14 21 … 42")
  // is guessing, not answering: never accept it (and never call it wrong).
  if ((!echo && answerNumbers(candidates, operands, normalized).length > MAX_ANSWER_NUMBERS) || isCountingRun(candidates)) {
    return unclear('number-list', { heard }, false);
  }

  if (heard === expected && !(echo && candidates.length >= (operands?.length ?? 0) && candidates.length > 1)) {
    return { verdict: 'correct', heard, candidates, normalized, reason: 'match' };
  }
  if (echo) return unclear('operand-echo', { heard });
  if (heard < 0 && !allowNegative) return unclear('negative', { heard });
  if (Math.abs(heard) > maxPlausible) return unclear('implausible', { heard });
  if (isSpokenPrefix(heard, expected)) return unclear('prefix', { heard, partial: true });
  // A confidence of 0 means "not reported" in some browsers (Safari, Chrome interims).
  if (confidence !== undefined && confidence > 0 && confidence < minConfidence) {
    return unclear('low-confidence', { heard });
  }
  return { verdict: 'wrong', heard, candidates, normalized, reason: 'different-number' };
};
