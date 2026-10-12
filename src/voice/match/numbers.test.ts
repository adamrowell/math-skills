import { describe, expect, it, beforeEach } from 'vitest';
import { matchNumberAnswer, parseNumbers, parseSingleNumber, isSpokenPrefix } from './numbers';
import { matchNumberHypothesis } from './hypothesis';
import { recordCorrection, clearCorrections, lookupAlias } from './corrections';
import { normalizeTranscript, numberToWords } from './normalize';
import type { VoiceHypothesis } from '../types';

beforeEach(() => clearCorrections());

describe('parseNumbers — single answers', () => {
  const cases: [string, number][] = [
    ['56', 56],
    ['fifty six', 56],
    ['Fifty-six.', 56],
    ['fifty-six!', 56],
    ['FIFTY SIX', 56],
    ['fiftysix', 56],
    ['seventy-two', 72],
    ['sixty for', 64],
    ['sixty fore', 64],
    ['fifty sex', 56],
    ['twenty to', 22],
    ['thirty won', 31],
    ['forty ate', 48],
    ['ninety nine', 99],
    ['a hundred and forty four', 144],
    ['one hundred forty four', 144],
    ['one hundred and forty-four', 144],
    ['hundred and eight', 108],
    ['one hundred eight', 108],
    ['one oh eight', 108],
    ['one forty four', 144],
    ['one twenty', 120],
    ['a hundred', 100],
    ['one hundred', 100],
    ['won hundred', 100],
    ['132', 132],
    ['1,000', 1000],
    ['zero', 0],
    ['0', 0],
    ['twelve', 12],
    ['twelf', 12],
    ['leven', 11],
    ['fourty', 40],
    ['fourty two', 42],
    ['fitty', 50],
    ['fiddy six', 56],
    ['twenny one', 21],
    ['thirdy six', 36],
    ['eighty one', 81],
    ['nineteen', 19],
    ['fourteen', 14],
    ['forty', 40],
    ['it\'s 56', 56],
    ['um fifty six', 56],
    ['the answer is 42', 42],
    ['I think it\'s seventy two', 72],
    ['50 6', 56],
    ['100 8', 108],
    ['100 and 44', 144],
  ];
  for (const [text, n] of cases) {
    it(`"${text}" → ${n}`, () => {
      const { candidates } = parseNumbers(text);
      expect(candidates[candidates.length - 1]).toBe(n);
    });
  }
});

describe('parseNumbers — weak homophones only count in number context', () => {
  const standalone: [string, number][] = [
    ['for', 4], ['four', 4], ['fore', 4], ['to', 2], ['too', 2], ['won', 1], ['ate', 8], ['eight', 8],
    ['tree', 3], ['free', 3], ['sex', 6], ['sicks', 6], ['siks', 6], ['oh', 0], ['tin', 10], ['nein', 9],
    ['it\'s ate', 8], ['um for', 4], ['Ate.', 8], ['To.', 2],
  ];
  for (const [text, n] of standalone) {
    it(`"${text}" → ${n}`, () => expect(parseSingleNumber(text)).toBe(n));
  }
  const notNumbers = ['I want to go', 'for real', 'what did you eat', 'go to sleep', 'I won the game', 'free time', 'hello', '', '   ', 'um', 'uh huh'];
  for (const text of notNumbers) {
    it(`"${text}" → no number`, () => expect(parseNumbers(text).candidates).toEqual([]));
  }
  it('"56 for sure" keeps 56 (for is not 4 here)', () => {
    expect(parseNumbers('56 for sure').candidates).toEqual([56]);
  });
});

describe('parseNumbers — multiple numbers', () => {
  it('seven times eight is fifty six', () => expect(parseNumbers('seven times eight is fifty six').candidates).toEqual([7, 8, 56]));
  it('7x8=56', () => expect(parseNumbers('7x8=56').candidates).toEqual([7, 8, 56]));
  it('7 × 8 = 56', () => expect(parseNumbers('7 × 8 = 56').candidates).toEqual([7, 8, 56]));
  it('54 no 56', () => expect(parseNumbers('54 no 56').candidates).toEqual([54, 56]));
  it('seven eight', () => expect(parseNumbers('seven eight').candidates).toEqual([7, 8]));
  it('five six (two numbers, not 56)', () => expect(parseNumbers('five six').candidates).toEqual([5, 6]));
  it('six five (not 65)', () => expect(parseNumbers('six five').candidates).toEqual([6, 5]));
  it('very long digit strings are ignored', () => expect(parseNumbers('1234567890').candidates).toEqual([]));
  it('minus 3', () => expect(parseNumbers('minus 3').candidates).toEqual([-3]));
  it('negative four', () => expect(parseNumbers('negative four').candidates).toEqual([-4]));
  it('8 minus 3 is 5 (operator, not negative)', () => expect(parseNumbers('8 minus 3 is 5').candidates).toEqual([8, 3, 5]));
});

describe('matchNumberAnswer — correct', () => {
  const ok: [string, number, number[]?][] = [
    ['56', 56], ['fifty six', 56], ['fifty-six', 56], ['Fifty six.', 56], ['fifty sex', 56], ['sixty for', 64],
    ['ate', 8], ['for', 4], ['to', 2], ['won', 1], ['tree', 3], ['a hundred and forty four', 144],
    ['one forty four', 144], ['7 times 8 is 56', 56, [7, 8]], ['seven times eight equals fifty six', 56, [7, 8]],
    ['54 no wait 56', 56], ['um 72', 72], ['zero', 0], ['oh', 0], ['nine', 9], ['eight', 8, [1, 8]], ['eight', 8, [8, 1]],
    ['seven', 7, [7, 1]], ['twelve', 12, [3, 4]], ['one hundred twenty', 120], ['hundred and eight', 108],
    ['one hundred', 100], ['ten', 10], ['tin', 10], ['fourty two', 42], ['one twenty one', 121], ['eighty one', 81],
  ];
  for (const [text, expected, operands] of ok) {
    it(`"${text}" accepts ${expected}`, () => {
      expect(matchNumberAnswer(text, { expected, operands }).verdict).toBe('correct');
    });
  }
});

describe('matchNumberAnswer — must NOT accept (wrong)', () => {
  const wrong: [string, number, number][] = [
    ['65', 56, 65], ['sixty five', 56, 65], ['forty', 14, 40], ['fourteen', 40, 14], ['fifteen', 50, 15],
    ['fifty', 15, 50], ['54', 56, 54], ['fifty four', 56, 54], ['48', 42, 48], ['forty eight', 42, 48],
    ['72', 27, 72], ['twenty seven', 72, 27], ['eighty one', 18, 81], ['eighteen', 81, 18], ['six', 9, 6],
    ['nine', 6, 9], ['144', 121, 144], ['one hundred twenty one', 144, 121], ['sixty three', 36, 63],
    ['thirty six', 63, 36], ['13', 30, 13], ['thirty', 13, 30], ['twelve', 20, 12], ['twenty', 12, 20],
    ['ate', 6, 8], ['for', 5, 4], ['56', 65, 56], ['seven times eight is 54', 56, 54], ['9', 7, 9],
  ];
  for (const [text, expected, heard] of wrong) {
    it(`"${text}" vs ${expected} → wrong (heard ${heard})`, () => {
      const r = matchNumberAnswer(text, { expected });
      expect(r.verdict).toBe('wrong');
      expect(r.heard).toBe(heard);
    });
  }
});

describe('matchNumberAnswer — unclear (never wrong, never correct)', () => {
  it('empty', () => expect(matchNumberAnswer('', { expected: 56 }).verdict).toBe('unclear'));
  it('um', () => expect(matchNumberAnswer('um', { expected: 56 }).verdict).toBe('unclear'));
  it('chatter', () => expect(matchNumberAnswer('I want to go outside', { expected: 2 }).verdict).toBe('unclear'));
  it('operand echo "seven times eight"', () => {
    const r = matchNumberAnswer('seven times eight', { expected: 56, operands: [7, 8] });
    expect(r.verdict).toBe('unclear');
    expect(r.reason).toBe('operand-echo');
  });
  it('operand echo "seven eight"', () => expect(matchNumberAnswer('seven eight', { expected: 56, operands: [7, 8] }).verdict).toBe('unclear'));
  it('operand echo reversed "8 times 7"', () => expect(matchNumberAnswer('8 times 7', { expected: 56, operands: [7, 8] }).verdict).toBe('unclear'));
  it('reading the first operand "seven"', () => expect(matchNumberAnswer('seven', { expected: 56, operands: [7, 8] }).verdict).toBe('unclear'));
  it('full echo is not accepted even when the answer equals an operand ("one times eight" for 1×8)', () => {
    expect(matchNumberAnswer('one times eight', { expected: 8, operands: [1, 8] }).verdict).toBe('unclear');
  });
  it('prefix "fifty" of 56 is partial', () => {
    const r = matchNumberAnswer('fifty', { expected: 56 });
    expect(r.verdict).toBe('unclear');
    expect(r.partial).toBe(true);
  });
  it('prefix "one hundred" of 108 is partial', () => expect(matchNumberAnswer('one hundred', { expected: 108 }).partial).toBe(true));
  it('prefix "one hundred forty" of 144 is partial', () => expect(matchNumberAnswer('one hundred forty', { expected: 144 }).partial).toBe(true));
  it('prefix "one" of 144 (colloquial one-forty-four) is partial', () => expect(matchNumberAnswer('one', { expected: 144 }).partial).toBe(true));
  it('"sixty" of 56 is NOT a prefix → wrong', () => expect(matchNumberAnswer('sixty', { expected: 56 }).verdict).toBe('wrong'));
  it('implausible 5000', () => expect(matchNumberAnswer('5000', { expected: 56 }).verdict).toBe('unclear'));
  it('maxPlausible respected', () => expect(matchNumberAnswer('200', { expected: 56, maxPlausible: 144 }).verdict).toBe('unclear'));
  it('negative not allowed', () => expect(matchNumberAnswer('minus 4', { expected: 4 }).verdict).toBe('unclear'));
  it('negative allowed', () => expect(matchNumberAnswer('minus 4', { expected: -4, allowNegative: true }).verdict).toBe('correct'));
  it('low confidence wrong → unclear', () => expect(matchNumberAnswer('54', { expected: 56, confidence: 0.3 }).verdict).toBe('unclear'));
  it('confidence 0 (unreported) does not downgrade', () => expect(matchNumberAnswer('54', { expected: 56, confidence: 0 }).verdict).toBe('wrong'));
  it('low confidence correct stays correct', () => expect(matchNumberAnswer('56', { expected: 56, confidence: 0.2 }).verdict).toBe('correct'));
  it('minConfidence custom', () => expect(matchNumberAnswer('54', { expected: 56, confidence: 0.6, minConfidence: 0.7 }).verdict).toBe('unclear'));
  it('normalized is reported', () => expect(matchNumberAnswer('Fifty-Six!', { expected: 56 }).normalized).toBe('fifty six'));
});

describe('matchNumberHypothesis', () => {
  const hyp = (text: string, extra: Partial<VoiceHypothesis> = {}): VoiceHypothesis => ({ text, isFinal: true, engine: 'webspeech', utteranceId: 1, ...extra });
  it('interim correct is accepted early', () => expect(matchNumberHypothesis(hyp('56', { isFinal: false }), { expected: 56 }).verdict).toBe('correct'));
  it('interim never says wrong', () => expect(matchNumberHypothesis(hyp('54', { isFinal: false }), { expected: 56 }).verdict).toBe('unclear'));
  it('interim "fifty" is not accepted for 50 (he may be saying 56)', () => expect(matchNumberHypothesis(hyp('50', { isFinal: false }), { expected: 50 }).verdict).toBe('unclear'));
  it('final "fifty" accepted for 50', () => expect(matchNumberHypothesis(hyp('50'), { expected: 50 }).verdict).toBe('correct'));
  it('interim "100" not accepted for 100', () => expect(matchNumberHypothesis(hyp('100', { isFinal: false }), { expected: 100 }).verdict).toBe('unclear'));
  it('alternative rescues unclear top', () => expect(matchNumberHypothesis(hyp('fifty sticks', { alternatives: ['56'] }), { expected: 56 }).verdict).toBe('correct'));
  it('alternative never overrides a clear wrong', () => expect(matchNumberHypothesis(hyp('54', { alternatives: ['56'] }), { expected: 56 }).verdict).toBe('wrong'));
  it('hyp confidence is applied', () => expect(matchNumberHypothesis(hyp('54', { confidence: 0.45, engine: 'moonshine' }), { expected: 56 }).verdict).toBe('unclear'));
});

describe('learned aliases (adaptation)', () => {
  it('activates after two corrections and only for that answer', () => {
    expect(matchNumberAnswer('fifty sticks', { expected: 56 }).verdict).toBe('unclear');
    recordCorrection('fifty sticks', 56);
    expect(matchNumberAnswer('fifty sticks', { expected: 56 }).verdict).toBe('unclear');
    recordCorrection('Fifty sticks!', 56);
    const r = matchNumberAnswer('fifty sticks', { expected: 56 });
    expect(r.verdict).toBe('correct');
    expect(r.viaAlias).toBe(true);
    // Never makes a different expected answer correct, never makes it wrong.
    expect(matchNumberAnswer('fifty sticks', { expected: 57 }).verdict).toBe('unclear');
  });
  it('does not learn from digit strings or empty text', () => {
    recordCorrection('56', 56);
    recordCorrection('56', 56);
    recordCorrection('', 56);
    expect(lookupAlias('56')).toBeUndefined();
  });
  it('conflicting corrections do not activate', () => {
    recordCorrection('blah', 12);
    recordCorrection('blah', 12);
    recordCorrection('blah', 20);
    recordCorrection('blah', 20);
    expect(lookupAlias('blah')).toBeUndefined();
  });
  it('an alias never overrides a clearly heard different number', () => {
    recordCorrection('fifty four', 56);
    recordCorrection('fifty four', 56);
    expect(matchNumberAnswer('fifty four', { expected: 56 }).verdict).toBe('wrong');
  });
});

describe('helpers', () => {
  it('numberToWords', () => {
    expect(numberToWords(56)).toBe('fifty six');
    expect(numberToWords(144)).toBe('one hundred forty four');
    expect(numberToWords(0)).toBe('zero');
    expect(numberToWords(1000)).toBe('one thousand');
  });
  it('normalizeTranscript', () => {
    expect(normalizeTranscript("It's 7x8!")).toBe('its 7 x 8');
    expect(normalizeTranscript('1,000')).toBe('1000');
  });
  it('isSpokenPrefix', () => {
    expect(isSpokenPrefix(50, 56)).toBe(true);
    expect(isSpokenPrefix(50, 50)).toBe(false);
    expect(isSpokenPrefix(50, 60)).toBe(false);
    expect(isSpokenPrefix(100, 144)).toBe(true);
    expect(isSpokenPrefix(5, 56)).toBe(false);
    expect(isSpokenPrefix(40, 14)).toBe(false);
  });
  it('round-trips 0..200 through words', () => {
    for (let n = 0; n <= 200; n++) {
      expect(parseSingleNumber(numberToWords(n))).toBe(n);
      expect(parseSingleNumber(String(n))).toBe(n);
      expect(matchNumberAnswer(numberToWords(n), { expected: n }).verdict).toBe('correct');
    }
  });
  it('never accepts a different number for any pair in 0..144 (digits and words)', () => {
    for (let a = 0; a <= 144; a += 1) {
      for (const b of [a + 1, a - 1, a + 10, a - 10, Number(String(a).split('').reverse().join(''))]) {
        if (b < 0 || b === a || b > 144) continue;
        expect(matchNumberAnswer(String(b), { expected: a }).verdict).not.toBe('correct');
        expect(matchNumberAnswer(numberToWords(b), { expected: a }).verdict).not.toBe('correct');
      }
    }
  });
});
