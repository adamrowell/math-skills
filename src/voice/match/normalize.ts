/**
 * Transcript normalisation shared by every matcher.
 *
 * ASR output is messy: "Fifty-six.", "56!", "1,000", "7x8", "It's… fifty six?".
 * normalizeTranscript() lowercases, splits glued digit/letter runs, turns hyphens and
 * punctuation into spaces and collapses whitespace. Digits stay digits — number parsing
 * and word matching each decide how to treat them.
 */

export const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
] as const;

export const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;

/** 56 → "fifty six" (space separated; no "and"). Works for 0..999 999. */
export function numberToWords(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (n < 0) return `minus ${numberToWords(-n)}`;
  n = Math.floor(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
  if (n < 1000) {
    const r = n % 100;
    return `${ONES[Math.floor(n / 100)]} hundred${r ? ` ${numberToWords(r)}` : ''}`;
  }
  const r = n % 1000;
  return `${numberToWords(Math.floor(n / 1000))} thousand${r ? ` ${numberToWords(r)}` : ''}`;
}

/**
 * Lowercase, strip punctuation, split "7x8" / "56th" / "8s", keep digits as digits.
 * "1,000" → "1000"; "fifty-six." → "fifty six"; "it's" → "its".
 */
export function normalizeTranscript(raw: string): string {
  if (!raw) return '';
  let s = String(raw).toLowerCase();
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[’‘`´]/g, "'");
  s = s.replace(/(\d),(?=\d{3}\b)/g, '$1'); // 1,000 → 1000
  s = s.replace(/(\d)\.(\d)/g, '$1 point $2');
  s = s.replace(/[×*]/g, ' times ');
  s = s.replace(/÷/g, ' divided by ');
  s = s.replace(/\+/g, ' plus ');
  s = s.replace(/=/g, ' equals ');
  // "7x8" → "7 x 8"; "56th" → "56 th"; "x8" etc.
  s = s.replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2');
  s = s.replace(/'/g, ''); // it's → its, don't → dont
  s = s.replace(/[^a-z0-9]+/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

export function tokenize(raw: string): string[] {
  const n = normalizeTranscript(raw);
  return n ? n.split(' ') : [];
}

/** Classic Levenshtein distance (small strings only). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** 1 − distance/maxLen, in 0..1. */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const m = Math.max(a.length, b.length);
  return m === 0 ? 1 : 1 - levenshtein(a, b) / m;
}
