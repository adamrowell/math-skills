import { describe, expect, it } from 'vitest';
import { matchWord, alignSentence, wordSimilarity, vowelMinimalPair } from './words';
import { matchWordHypothesis } from './hypothesis';
import { phoneticKey } from './phonetic';
import { makeWordDistractors } from './distractors';

describe('phoneticKey', () => {
  const same: [string, string][] = [
    ['night', 'knight'], ['right', 'write'], ['gray', 'grey'], ['see', 'sea'], ['new', 'knew'], ['rode', 'road'],
    ['tail', 'tale'], ['meet', 'meat'], ['plain', 'plane'], ['made', 'maid'], ['phone', 'fone'], ['lamb', 'lam'],
    ['wrap', 'rap'], ['sail', 'sale'], ['week', 'weak'],
  ];
  for (const [a, b] of same) it(`${a} ≈ ${b}`, () => expect(phoneticKey(a)).toBe(phoneticKey(b)));
  const diff: [string, string][] = [
    ['cat', 'cut'], ['cat', 'hat'], ['bed', 'red'], ['bit', 'bat'], ['ship', 'chip'], ['pin', 'pen'], ['sit', 'seat'],
    ['hop', 'hope'], ['cap', 'cape'], ['dog', 'dig'], ['fan', 'van'], ['thin', 'tin'], ['ball', 'bell'], ['big', 'pig'],
  ];
  for (const [a, b] of diff) it(`${a} ≠ ${b}`, () => expect(phoneticKey(a)).not.toBe(phoneticKey(b)));
});

describe('matchWord — correct', () => {
  const ok: [string, string, string[]?][] = [
    ['cat', 'cat'], ['Cat.', 'cat'], ['CAT!', 'cat'], ['the cat', 'cat'], ['um cat', 'cat'], ['two', 'to'], ['2', 'two'],
    ['too', 'two'], ['their', 'there'], ["they're", 'there'], ['knight', 'night'], ['eight', 'ate'], ['8', 'eight'],
    ['read', 'red'], ['sea', 'see'], ['grey', 'gray'], ['ice cream', 'ice cream'], ['icecream', 'ice cream'],
    ['dun', 'done', ['dun']], ['elephant', 'elephant'], ['Because.', 'because'], ['jumped', 'jumped'],
    ['the word is house', 'house'], ['blew', 'blue'], ['four', 'for'],
  ];
  for (const [heard, target, alts] of ok) {
    it(`"${heard}" reads "${target}"`, () => expect(matchWord(heard, target, alts).verdict).toBe('correct'));
  }
  it('homophones can be disabled', () => expect(matchWord('two', 'to', { allowHomophones: false }).verdict).not.toBe('correct'));
  it('alternates as options object', () => expect(matchWord('dun', 'done', { alternates: ['dun'] }).verdict).toBe('correct'));
});

describe('matchWord — never accepts minimal pairs', () => {
  const pairs: [string, string][] = [
    ['cut', 'cat'], ['hat', 'cat'], ['bed', 'red'], ['bat', 'bit'], ['chip', 'ship'], ['pen', 'pin'], ['seat', 'sit'],
    ['hope', 'hop'], ['cape', 'cap'], ['dig', 'dog'], ['van', 'fan'], ['tin', 'thin'], ['bell', 'ball'], ['pig', 'big'],
    ['cats', 'cat'], ['jump', 'jumped'], ['then', 'than'], ['where', 'were'], ['what', 'want'], ['house', 'horse'],
    ['play', 'plays'], ['were', 'we'], ['form', 'from'], ['quite', 'quiet'], ['thought', 'though'],
  ];
  for (const [heard, target] of pairs) {
    it(`"${heard}" does not read "${target}"`, () => expect(matchWord(heard, target).verdict).not.toBe('correct'));
  }
});

describe('matchWord — wrong vs unclear', () => {
  it('a clearly different short word is wrong', () => expect(matchWord('dog', 'house').verdict).toBe('wrong'));
  it('noise is unclear', () => expect(matchWord('um', 'house').verdict).toBe('unclear'));
  it('empty is unclear', () => expect(matchWord('', 'house').verdict).toBe('unclear'));
  it('a long ramble without the word is unclear, not wrong', () => expect(matchWord('I do not know what that says mom', 'house').verdict).toBe('unclear'));
  it('near miss is unclear', () => expect(matchWord('hat', 'cat').verdict).toBe('unclear'));
  it('similarity exposed', () => {
    expect(matchWord('cat', 'cat').similarity).toBe(1);
    expect(wordSimilarity('knight', 'night')).toBeGreaterThanOrEqual(0.95);
    expect(wordSimilarity('dog', 'house')).toBeLessThan(0.5);
  });
});

describe('alignSentence', () => {
  it('perfect read', () => {
    const r = alignSentence('the cat sat on the mat', ['The', 'cat', 'sat', 'on', 'the', 'mat.']);
    expect(r.hitRatio).toBe(1);
    expect(r.isComplete).toBe(true);
    expect(r.words.every((w) => w.status === 'hit')).toBe(true);
  });
  it('skipped word', () => {
    const r = alignSentence('the cat on the mat', ['The', 'cat', 'sat', 'on', 'the', 'mat']);
    expect(r.words[2].status).toBe('miss');
    expect(r.words[3].status).toBe('hit');
    expect(r.isComplete).toBe(false);
  });
  it('inserted words are extra, alignment unaffected', () => {
    const r = alignSentence('um the big cat sat', ['The', 'cat', 'sat']);
    expect(r.hitRatio).toBe(1);
    expect(r.extra).toContain('big');
  });
  it('red ball vs bed ball is not complete', () => {
    const r = alignSentence('bed ball', ['red', 'ball']);
    expect(r.words[0].status).not.toBe('hit');
    expect(r.isComplete).toBe(false);
  });
  it('homophones count', () => {
    const r = alignSentence('I went too the park', ['I', 'went', 'to', 'the', 'park']);
    expect(r.isComplete).toBe(true);
  });
  it('numbers as digits', () => {
    const r = alignSentence('I am 8 years old', ['I', 'am', 'eight', 'years', 'old.']);
    expect(r.hitRatio).toBe(1);
  });
  it('empty transcript → all miss', () => {
    const r = alignSentence('', ['Hold', 'my', 'hand']);
    expect(r.hitRatio).toBe(0);
    expect(r.words.every((w) => w.status === 'miss')).toBe(true);
  });
  it('reordered words are not all hits', () => {
    const r = alignSentence('mat the on sat cat the', ['The', 'cat', 'sat', 'on', 'the', 'mat']);
    expect(r.isComplete).toBe(false);
  });
});

describe('makeWordDistractors', () => {
  it('produces sound-alikes that exclude the target and homophones', () => {
    const d = makeWordDistractors('cat', ['cat']);
    expect(d).not.toContain('cat');
    expect(d.length).toBeGreaterThan(6);
    expect(d.some((w) => w.endsWith('at'))).toBe(true);
    expect(d.some((w) => w.startsWith('c') && w !== 'cat')).toBe(true);
  });
  it('handles multi-syllable words', () => {
    const d = makeWordDistractors('better');
    expect(d.length).toBeGreaterThan(3);
    expect(d).not.toContain('better');
  });
});

describe('vowel minimal pairs (said/sad, bed/bad) are "almost", never correct or wrong', () => {
  const pairs: [string, string][] = [['sad', 'said'], ['said', 'sad'], ['bed', 'bad'], ['bad', 'bed'], ['pen', 'pan'], ['man', 'men'], ['sit', 'set']];
  for (const [target, heard] of pairs) {
    it(`${heard} for ${target}`, () => {
      const r = matchWord(heard, target);
      expect(r.verdict).toBe('unclear');
      expect(r.almost).toBe(true);
    });
  }
  it('pairs are detected', () => {
    expect(vowelMinimalPair('sad', 'said')).toBe(true);
    expect(vowelMinimalPair('bed', 'red')).toBe(false);
    expect(vowelMinimalPair('cat', 'cap')).toBe(false);
  });
  it('a hypothesis carrying an on-device "almost" is unclear + almost', () => {
    const r = matchWordHypothesis({ text: '', isFinal: true, engine: 'moonshine', utteranceId: 1, almost: 'bad' }, 'bed');
    expect(r.verdict).toBe('unclear');
    expect(r.almost).toBe(true);
  });
});
