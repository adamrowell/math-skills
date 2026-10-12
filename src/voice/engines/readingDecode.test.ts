import { describe, expect, it } from 'vitest';
import { decideWord, wordNeighbours } from './readingDecode';
import type { WordDecodeFeatures } from './readingDecode';

const base: WordDecodeFeatures = {
  target: 'cat',
  lpTarget: -10,
  bestNeighbour: 'hat',
  lpNeighbour: -13,
  lpGarbage: -18,
  free: 'Cat.',
  lpFree: -10.5,
  freeMatches: true,
  freeOther: null,
  freeSim: 0,
  neighbours: [],
};

describe('reading word decision', () => {
  it('accepts a clear read', () => expect(decideWord(base).verdict).toBe('correct'));
  it('accepts when only the scorer is sure (free transcript misheard a sound-alike)', () => {
    expect(decideWord({ ...base, free: 'Cad.', freeMatches: false, freeOther: 'cad', freeSim: 0.7, freeVoicing: true, lpFree: -9 }).verdict).toBe('correct');
  });
  it('the model naming a different close word vetoes (target "sad", it heard "Said.")', () => {
    expect(decideWord({ ...base, target: 'sad', free: 'Said.', freeMatches: false, freeOther: 'said', freeSim: 0.7, lpFree: -8 }).verdict).not.toBe('correct');
  });
  it('rejects when a sound-alike word fits better', () => {
    expect(decideWord({ ...base, lpNeighbour: -8, free: 'Hat.', freeMatches: false, freeOther: 'hat', freeSim: 0.6, lpFree: -8 }).verdict).not.toBe('correct');
  });
  it('rejects fillers', () => {
    expect(decideWord({ ...base, lpGarbage: -9, free: 'Um.', freeMatches: false, lpFree: -9 }).verdict).not.toBe('correct');
  });
  it('a clearly different word is never accepted, and says "not quite" when sure', () => {
    const f = { ...base, target: 'to', free: 'Cake.', freeMatches: false, freeOther: 'cake', freeSim: 0.1, lpTarget: -12, lpFree: -8, lpNeighbour: -16, vocabOther: 'cake', vocabMargin: -5 };
    const d = decideWord(f);
    expect(d.verdict).toBe('wrong');
    expect(d.text).toBe('cake');
    expect(decideWord({ ...f, lpFree: -11.5 }).verdict).not.toBe('wrong');
  });
});

describe('sound-alike competitors', () => {
  it('includes real minimal pairs and excludes the target group', () => {
    const n = wordNeighbours('cat', new Set(['cat']));
    expect(n).toContain('hat');
    expect(n).not.toContain('cat');
    const t = wordNeighbours('to', new Set(['to', 'two', 'too']));
    expect(t).not.toContain('two');
    expect(t).not.toContain('too');
  });
});
