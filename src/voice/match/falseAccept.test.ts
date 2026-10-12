/**
 * Every reading word against the whole closed vocabulary (plus the reading words themselves):
 * a different real word must never be accepted as the target unless it is a true homophone
 * or a listed alternate. Guards the sounds-like key against collisions like now/no, of/off.
 */
import { describe, expect, it } from 'vitest';
import { matchWord, homophonesOf } from './words';
import { WORD_VOCAB } from './vocab';
import { WORD_LEVELS } from '../../data/reading/words';

describe('reading words: no false accepts across the vocabulary', () => {
  it('no different vocabulary word is accepted for any reading word', () => {
    const entries = WORD_LEVELS.flatMap((l) => l.words);
    const vocab = Array.from(new Set([...WORD_VOCAB, ...entries.map((e) => e[0].toLowerCase())]));
    const bad: string[] = [];
    for (const [w, , alts] of entries) {
      const target = w.toLowerCase();
      const ok = new Set([target, ...homophonesOf(target), ...(alts ?? []).map((a) => a.toLowerCase())]);
      for (const v of vocab) {
        if (ok.has(v) || homophonesOf(v).includes(target)) continue;
        if (matchWord(v, target, alts).verdict === 'correct') bad.push(`${target}←${v}`);
      }
    }
    expect(Array.from(new Set(bad))).toEqual([]);
  });
});
