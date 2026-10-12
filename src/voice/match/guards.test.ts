/** Anti-guessing and adaptation guards for the voice matcher. */
import { beforeEach, describe, expect, it } from 'vitest';
import { matchNumberAnswer } from './numbers';
import { matchNumberHypothesis } from './hypothesis';
import { clearCorrections, getAcceptMargin, noteScoredUtterance, recordCorrection } from './corrections';

const hyp = (text: string, isFinal = true) => ({ text, isFinal, engine: 'webspeech' as const, utteranceId: 1 });

describe('counting sweeps are never accepted', () => {
  it.each([
    ['fifty one fifty two fifty three fifty four fifty five fifty six', 56],
    ['48 49 50 51 52 53 54 55 56', 56],
    ['7 14 21 28 35 42', 42],
    ['thirty thirty one thirty two thirty three thirty four thirty five thirty six', 36],
  ])('%s (expected %d)', (text, expected) => {
    expect(matchNumberAnswer(text, { expected, maxPlausible: 144 }).verdict).toBe('unclear');
    expect(matchNumberHypothesis(hyp(text, false), { expected, maxPlausible: 144 }).verdict).toBe('unclear');
    expect(matchNumberHypothesis(hyp(text, true), { expected, maxPlausible: 144 }).verdict).toBe('unclear');
  });

  it('an interim with two numbers does not early-accept, but a self-correction final does', () => {
    expect(matchNumberHypothesis(hyp('fifty four fifty six', false), { expected: 56, maxPlausible: 144 }).verdict).toBe('unclear');
    expect(matchNumberHypothesis(hyp('fifty four no fifty six', true), { expected: 56, maxPlausible: 144 }).verdict).toBe('correct');
  });

  it('a count that starts on the operands is still a count (0 × 1 → "zero one two three")', () => {
    for (const [a, b] of [[0, 1], [1, 0], [1, 2], [2, 3]]) {
      const opts = { expected: a * b, maxPlausible: 144, operands: [a, b] };
      expect(matchNumberHypothesis(hyp('zero one two three', true), opts).verdict).toBe('unclear');
      expect(matchNumberHypothesis(hyp('one two three four', true), opts).verdict).toBe('unclear');
    }
    expect(matchNumberAnswer('3 4 12', { expected: 12, operands: [3, 4] }).verdict).toBe('correct');
  });

  it('reading the question back is still fine', () => {
    expect(matchNumberAnswer('seven times eight is fifty six', { expected: 56, operands: [7, 8] }).verdict).toBe('correct');
    expect(matchNumberAnswer('7 8 56', { expected: 56, operands: [7, 8] }).verdict).toBe('correct');
  });
});

describe('learned aliases never learn fillers', () => {
  beforeEach(() => clearCorrections());

  it('"um" twice then typing 56 does not make "um" mean 56', () => {
    recordCorrection('um', 56);
    recordCorrection('um', 56);
    expect(matchNumberAnswer('um', { expected: 56 }).verdict).toBe('unclear');
  });

  it("'I don't know' is never learned", () => {
    recordCorrection("I don't know", 42);
    recordCorrection("I don't know", 42);
    expect(matchNumberAnswer("I don't know.", { expected: 42 }).verdict).toBe('unclear');
  });

  it('a sound-alike mishearing is learned after two corrections', () => {
    recordCorrection('lifty fix', 56);
    expect(matchNumberAnswer('lifty fix', { expected: 56 }).verdict).toBe('unclear');
    recordCorrection('lifty fix', 56);
    expect(matchNumberAnswer('lifty fix', { expected: 56 }).verdict).toBe('correct');
    // …and only for that answer.
    expect(matchNumberAnswer('lifty fix', { expected: 54 }).verdict).toBe('unclear');
  });
});

describe('accept margin adapts the right way', () => {
  beforeEach(() => clearCorrections());

  it('a confident answer to an earlier question does not make the engine stricter', () => {
    for (let i = 0; i < 4; i++) {
      noteScoredUtterance('56', '56', 6, 56); // previous question, answered by voice
      noteScoredUtterance('', '24', 0.1, 24); // this question: unsure
      recordCorrection('', 24);
    }
    expect(getAcceptMargin()).toBeLessThanOrEqual(1);
  });

  it('near misses on the typed answer lower the bar', () => {
    const start = getAcceptMargin();
    for (let i = 0; i < 3; i++) {
      noteScoredUtterance('', '24', 0.6, 24);
      recordCorrection('', 24);
    }
    expect(getAcceptMargin()).toBeLessThan(start);
  });
});
