/**
 * Minimal-pair distractors for constrained word scoring. When the reading app asks
 * "is this child saying *cat*?", the on-device scorer compares "cat" against sound-alikes
 * (hat, bat, cut, cot, cap, can …). The target must beat all of them by a margin before the
 * engine reports it, which is what keeps "bed" from being accepted for "red".
 */
const ONSETS = ['b', 'c', 'd', 'f', 'g', 'h', 'l', 'm', 'n', 'p', 'r', 's', 't', 'w', 'sh', 'ch', 'th', 'bl', 'st', 'tr'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ee', 'oa', 'ai', 'oo'];
const CODAS = ['t', 'd', 'p', 'b', 'g', 'k', 'n', 'm', 's', 'ck', 'ng', 'sh', 'st', 'nd'];

/** A few stable common words to anchor unrelated speech. */
const ANCHORS = ['the', 'and', 'yes', 'no', 'what', 'um'];

function split(word: string): { onset: string; vowel: string; coda: string } | null {
  const m = /^([^aeiou]*)([aeiouy]+)([^aeiouy]*)(e?)$/.exec(word);
  if (!m) return null;
  return { onset: m[1], vowel: m[2], coda: m[3] + m[4] };
}

export function makeWordDistractors(target: string, exclude: Iterable<string> = [], max = 14): string[] {
  const t = target.toLowerCase().trim();
  const ex = new Set<string>([t, ...[...exclude].map((x) => x.toLowerCase())]);
  const out: string[] = [];
  const add = (w: string) => {
    if (w && !ex.has(w) && !out.includes(w) && /^[a-z]+$/.test(w)) out.push(w);
  };
  if (!t.includes(' ')) {
    const p = split(t);
    if (p) {
      // Interleave onset / vowel / coda swaps so every position is represented.
      const on = ONSETS.filter((o) => o !== p.onset).map((o) => o + p.vowel + p.coda);
      const vo = VOWELS.filter((v) => v !== p.vowel).map((v) => p.onset + v + p.coda);
      const co = CODAS.filter((c) => c !== p.coda).map((c) => p.onset + p.vowel + c);
      const n = Math.max(on.length, vo.length, co.length);
      for (let i = 0; i < n && out.length < max - ANCHORS.length; i++) {
        if (on[i]) add(on[i]);
        if (vo[i]) add(vo[i]);
        if (co[i]) add(co[i]);
      }
    } else {
      // Multi-syllable: drop / change the ending and the first letter.
      add(t.slice(0, -1));
      add(t + 's');
      add(t.replace(/^[^aeiou]+/, 'b'));
      add(t.replace(/^[^aeiou]+/, 's'));
      add(t.replace(/ing$/, 'ed'));
      add(t.replace(/ed$/, 'ing'));
    }
  }
  ANCHORS.forEach(add);
  return out.slice(0, max);
}
