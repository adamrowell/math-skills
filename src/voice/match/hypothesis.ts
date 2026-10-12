/**
 * Judge a whole VoiceHypothesis (text + alternatives + interim flag) — the safe way to
 * consume voice results. Consumers may call matchNumberAnswer(hyp.text, …) directly, but
 * this helper adds the rules that need the hypothesis context:
 *
 *  - Interim results (Web Speech) can only ever be 'correct' (early accept) or 'unclear'.
 *    They never say 'wrong', and do not early-accept answers a child could still be in the
 *    middle of saying (expected 50 while he is saying "fifty six…").
 *  - Alternatives (Web Speech maxAlternatives) can rescue an 'unclear' top result, but never
 *    override a clearly-heard different number.
 */
import type { NumberMatchOptions, NumberMatchResult, VoiceHypothesis, WordMatchOptions, WordMatchResult } from '../types';
import { answerNumbers, matchNumberAnswer, isSpokenPrefix } from './numbers';
import { matchWord } from './words';

function couldStillGrow(expected: number, maxPlausible: number): boolean {
  // Is `expected` itself a spoken prefix of some other plausible answer?
  for (const longer of [expected + 1, expected + 5, expected + 9, expected + 44, expected + 99]) {
    if (longer <= maxPlausible && isSpokenPrefix(expected, longer)) return true;
  }
  return false;
}

export function matchNumberHypothesis(hyp: VoiceHypothesis, options: NumberMatchOptions): NumberMatchResult {
  const opts: NumberMatchOptions = { ...options, confidence: options.confidence ?? hyp.confidence };
  const top = matchNumberAnswer(hyp.text, opts);
  if (!hyp.isFinal) {
    // Early accept only a lone answer: an interim with several numbers may be a sweep in progress.
    const single = answerNumbers(top.candidates, options.operands, top.normalized).length <= 1 || top.viaAlias === true;
    if (top.verdict === 'correct' && single && !couldStillGrow(options.expected, options.maxPlausible ?? 1000)) return top;
    return { ...top, verdict: 'unclear', reason: top.verdict === 'correct' ? 'interim-may-grow' : 'interim' };
  }
  if (top.verdict !== 'unclear' || !hyp.alternatives?.length) return top;
  for (const alt of hyp.alternatives) {
    const r = matchNumberAnswer(alt, { ...opts, confidence: undefined });
    if (r.verdict === 'correct') return { ...r, reason: 'alternative' };
  }
  return top;
}

export function matchWordHypothesis(hyp: VoiceHypothesis, target: string, options?: WordMatchOptions | string[]): WordMatchResult {
  const top = matchWord(hyp.text, target, options);
  if (top.verdict === 'correct') return top;
  for (const alt of hyp.alternatives ?? []) {
    const r = matchWord(alt, target, options);
    if (r.verdict === 'correct') return r;
  }
  if (!hyp.isFinal) return { ...top, verdict: 'unclear' };
  // On-device reading decode: not accepted, closest competitor is a vowel minimal pair.
  if (top.verdict === 'unclear' && hyp.almost && !top.almost) return { ...top, heard: top.heard ?? hyp.almost, almost: true };
  return top;
}
