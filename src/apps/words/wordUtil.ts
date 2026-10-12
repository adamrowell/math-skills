/** Read Words helpers. */

export const ROUND_SIZE = 15;

/** "kitten" → "kit · ten" for the not-quite hint (simple vowel-group split). */
export function chunks(word: string): string {
  if (word.length <= 4) return word.split('').join(' ');
  const m = word.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy](?=[^aeiouy]))?/g);
  if (!m || m.join('') !== word.slice(0, m.join('').length)) return word;
  const rest = word.slice(m.join('').length);
  const parts = [...m];
  if (rest) parts[parts.length - 1] += rest;
  if (parts.length > 1 && parts[parts.length - 1] === 'e') parts.splice(-2, 2, parts[parts.length - 2] + 'e');
  return parts.join(' · ');
}
