import { describe, expect, it } from 'vitest';
import { applyTranscript, heardAll, helpWord, inRetry, initSentence, isClean, isDone, pending } from './sentenceLogic';
import { bumpItem, isUnlocked, pickRound, starsFor, suggestedLevel } from '../words/reading/progress';
import type { ReadingProgress } from '../words/reading/progress';
import { wordPoints } from '../words/reading/rewards';
import { chunks } from '../words/wordUtil';
import { WORD_LEVELS } from '../../data/reading/words';
import { SENTENCE_LEVELS } from '../../data/reading/sentences';

describe('sentence reading state', () => {
  it('a clean read hits every word', () => {
    const r = applyTranscript(initSentence('The cat sat on the mat.'), 'the cat sat on the mat');
    expect(r.firstHits).toHaveLength(6);
    expect(isDone(r.next)).toBe(true);
    expect(isClean(r.next)).toBe(true);
  });
  it('a pause in the middle keeps the rest on the first pass', () => {
    const s = initSentence('I like to play with my dog.');
    const a = applyTranscript(s, 'I like to play');
    expect(a.firstHits).toEqual([0, 1, 2, 3]);
    expect(a.newMisses).toEqual([]);
    expect(inRetry(a.next)).toBe(false);
    const b = applyTranscript(a.next, 'with my dog');
    expect(isClean(b.next)).toBe(true);
  });
  it('a skipped word turns orange and is re-read for fewer points', () => {
    const a = applyTranscript(initSentence('The big dog ran fast.'), 'the dog ran fast');
    expect(a.newMisses).toEqual([1]);
    expect(inRetry(a.next)).toBe(true);
    expect(pending(a.next)).toEqual([1]);
    const b = applyTranscript(a.next, 'big');
    expect(b.rereadHits).toEqual([1]);
    expect(isDone(b.next)).toBe(true);
    expect(isClean(b.next)).toBe(false);
  });
  it('restarting from the beginning only scores the unread words', () => {
    const a = applyTranscript(initSentence('We go to the park.'), 'we go');
    const b = applyTranscript(a.next, 'we go to the park');
    expect(b.firstHits).toEqual([2, 3, 4]);
    expect(isClean(b.next)).toBe(true);
  });
  it('a wrong word is not a hit', () => {
    const a = applyTranscript(initSentence('The cat sat.'), 'the hat sat');
    expect(a.next.states[1]).toBe('miss');
  });
  it('noise does nothing', () => {
    const s = initSentence('The cat sat.');
    expect(applyTranscript(s, '').next).toBe(s);
    expect(applyTranscript(s, 'um').firstHits).toEqual([]);
  });
  it('help: tapped word scores nothing, hearing all makes the rest re-reads', () => {
    let s = initSentence('A fox ran.');
    s = helpWord(s, 1);
    expect(s.states[1]).toBe('helped');
    s = heardAll(s);
    expect(s.states).toEqual(['miss', 'helped', 'miss']);
    const r = applyTranscript(s, 'a fox ran');
    expect(r.firstHits).toEqual([]);
    expect(r.rereadHits).toEqual([0, 2]);
  });
});

describe('reading progress', () => {
  const ids = ['a', 'b', 'c'];
  const base: ReadingProgress = { version: 1, levels: {}, items: {}, lastLevel: null };
  it('stars', () => {
    expect(starsFor(15, 15)).toBe(3);
    expect(starsFor(13, 15)).toBe(2);
    expect(starsFor(10, 15)).toBe(1);
    expect(starsFor(9, 15)).toBe(0);
  });
  it('levels unlock with a star on the previous one, or all at once', () => {
    expect(isUnlocked(ids, 0, base)).toBe(true);
    expect(isUnlocked(ids, 1, base)).toBe(false);
    const p = { ...base, levels: { a: { best: 10, stars: 1 as const, plays: 1 } } };
    expect(isUnlocked(ids, 1, p)).toBe(true);
    expect(isUnlocked(ids, 2, p)).toBe(false);
    expect(isUnlocked(ids, 2, { ...base, unlockAll: true })).toBe(true);
    expect(suggestedLevel(ids, p)).toBe('b');
  });
  it('boxes move up on first-try reads and down on help', () => {
    let m = bumpItem(undefined, 'first', 1);
    m = bumpItem(m, 'first', 2);
    expect(m.box).toBe(2);
    expect(bumpItem(m, 'helped', 3).box).toBe(0);
  });
  it('pickRound returns distinct items', () => {
    const r = pickRound(WORD_LEVELS[0].words, (w) => w[0], base, 15);
    expect(new Set(r.map((w) => w[0])).size).toBe(15);
  });
  it('points: first try > second try > heard it; fast + combo pay more', () => {
    const first = wordPoints({ prior: 1, attempt: 1, helped: false, ms: 5000, combo: 1 });
    const fast = wordPoints({ prior: 1, attempt: 1, helped: false, ms: 1000, combo: 1 });
    const second = wordPoints({ prior: 1, attempt: 2, helped: false, ms: 1000, combo: 0 });
    const helped = wordPoints({ prior: 1, attempt: 1, helped: true, ms: 1000, combo: 0 });
    expect(fast).toBeGreaterThan(first);
    expect(first).toBeGreaterThan(second);
    expect(second).toBeGreaterThan(helped);
    expect(wordPoints({ prior: 1, attempt: 1, helped: false, ms: 1000, combo: 10 })).toBeGreaterThan(fast);
  });
  it('syllable chunks', () => {
    expect(chunks('kitten')).toBe('kit · ten');
    expect(chunks('cat')).toBe('c a t');
  });
});

describe('reading data', () => {
  it('every word has a sentence that uses it', () => {
    for (const l of WORD_LEVELS) {
      expect(l.words.length).toBeGreaterThanOrEqual(20);
      for (const [w, s] of l.words) {
        expect(w).toMatch(/^[a-z]+$/);
        expect(s.length).toBeGreaterThan(5);
      }
    }
  });
  it('sentences are 3–12 words', () => {
    for (const l of SENTENCE_LEVELS) {
      expect(l.sentences.length).toBeGreaterThanOrEqual(10);
      for (const s of l.sentences) {
        const n = s.split(/\s+/).length;
        expect(n, s).toBeGreaterThanOrEqual(3);
        expect(n, s).toBeLessThanOrEqual(12);
      }
    }
  });
});
