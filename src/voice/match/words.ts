/**
 * Word and sentence matching for the reading apps.
 *
 * matchWord(transcript, target, alternates?)
 *   correct  — the target, an alternate, a homophone (to/two/too, there/their/they're …),
 *              or a word with an identical sounds-like key (knight/night, grey/gray).
 *   unclear  — something close but not the same (cat/cut, bed/red), noise, fillers, or a long
 *              ramble. Safe default: the child just tries again.
 *   wrong    — a short, clearly different word (target "house", heard "dog").
 *
 * alignSentence(transcript, words)
 *   DP alignment (LCS with fuzzy word similarity) so skipped / inserted words do not shift
 *   everything after them. Each target word gets hit / close / miss.
 */
import type { AlignSentence, AlignedWord, MatchWord, WordMatchOptions, WordMatchResult } from '../types';
import { normalizeTranscript, numberToWords, stringSimilarity } from './normalize';
import { phoneticKey } from './phonetic';

const HOMOPHONE_GROUPS: string[][] = [
  ['to', 'two', 'too'], ['for', 'four', 'fore'], ['there', 'their', 'theyre'], ['by', 'buy', 'bye'],
  ['see', 'sea'], ['be', 'bee'], ['no', 'know'], ['new', 'knew'], ['one', 'won'], ['eight', 'ate'],
  ['right', 'write'], ['red', 'read'], ['read', 'reed'], ['blue', 'blew'], ['hear', 'here'], ['son', 'sun'],
  ['flower', 'flour'], ['meet', 'meat'], ['week', 'weak'], ['wear', 'where'], ['pair', 'pear'], ['our', 'hour'],
  ['i', 'eye'], ['deer', 'dear'], ['tail', 'tale'], ['mail', 'male'], ['sale', 'sail'], ['road', 'rode'],
  ['made', 'maid'], ['your', 'youre'], ['whole', 'hole'], ['night', 'knight'], ['not', 'knot'],
  ['plain', 'plane'], ['rain', 'reign'], ['so', 'sew', 'sow'], ['wait', 'weight'], ['ant', 'aunt'],
  ['bare', 'bear'], ['cent', 'sent', 'scent'], ['hi', 'high'], ['peace', 'piece'], ['nose', 'knows'],
  ['wood', 'would'], ['steal', 'steel'], ['way', 'weigh'], ['which', 'witch'], ['wore', 'war'],
  ['tow', 'toe'], ['roll', 'role'], ['hair', 'hare'], ['ball', 'bawl'], ['bored', 'board'], ['fair', 'fare'],
  ['flu', 'flew'], ['grate', 'great'], ['heal', 'heel'], ['him', 'hymn'], ['in', 'inn'], ['knit', 'nit'],
  ['knew', 'gnu'], ['loan', 'lone'], ['oh', 'owe'], ['pail', 'pale'], ['real', 'reel'], ['seem', 'seam'],
  ['stair', 'stare'], ['tea', 'tee'], ['threw', 'through'], ['wail', 'whale'], ['weather', 'whether'],
  ['ok', 'okay'], ['mom', 'mum', 'mam'], ['grey', 'gray'], ['yeah', 'yea'], ['dew', 'do', 'due'],
  ['ate', 'eight'], ['hey', 'hay'], ['bean', 'been'], ['need', 'knead'], ['rap', 'wrap'],
  ['ring', 'wring'], ['rest', 'wrest'], ['night', 'nite'], ['through', 'thru'], ['cereal', 'serial'],
  ['allowed', 'aloud'], ['berry', 'bury'], ['cell', 'sell'], ['chews', 'choose'], ['days', 'daze'],
  ['find', 'fined'], ['guessed', 'guest'], ['missed', 'mist'], ['passed', 'past'], ['prince', 'prints'],
  ['rows', 'rose'], ['some', 'sum'], ['tide', 'tied'], ['toad', 'towed'], ['wait', 'weight'], ['won', 'one'],
];

const HOMOPHONES = new Map<string, Set<string>>();
for (const g of HOMOPHONE_GROUPS) {
  for (const w of g) {
    const s = HOMOPHONES.get(w) ?? new Set<string>();
    g.forEach((x) => s.add(x));
    HOMOPHONES.set(w, s);
  }
}

export function homophonesOf(word: string): string[] {
  return [...(HOMOPHONES.get(word) ?? [])].filter((w) => w !== word);
}

const NOISE = new Set(['um', 'umm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'hmm', 'hm', 'mm', 'mmm', 'ah', 'ahh', 'oh', 'eh', 'huh', 'the', 'a']);

/** Normalised word tokens, with digit strings spelled out ("2" → "two"). */
export function wordTokens(text: string): string[] {
  const n = normalizeTranscript(text);
  if (!n) return [];
  const out: string[] = [];
  for (const t of n.split(' ')) {
    if (/^\d+$/.test(t)) {
      const v = parseInt(t, 10);
      if (v < 1_000_000) out.push(...numberToWords(v).split(' '));
    } else out.push(t);
  }
  return out;
}

function normWord(w: string): string {
  return wordTokens(w).join(' ');
}

/**
 * Similarity of a heard token (or token span) to the target, 0..1.
 * 1 = same / homophone / alternate; 0.95 = same sounds-like key.
 */
export function wordSimilarity(heard: string, target: string, accept?: Set<string>): number {
  if (!heard || !target) return 0;
  if (heard === target) return 1;
  if (accept?.has(heard)) return 1;
  const hk = phoneticKey(heard.replace(/ /g, ''));
  const tk = phoneticKey(target.replace(/ /g, ''));
  if (hk && hk === tk) return 0.95;
  const keySim = stringSimilarity(hk, tk);
  const spellSim = stringSimilarity(heard.replace(/ /g, ''), target.replace(/ /g, ''));
  let sim = Math.max(keySim, spellSim * 0.95);
  // Different first sound is the classic minimal pair (bed/red, cat/hat): weigh it down.
  if (hk[0] !== tk[0]) sim *= 0.8;
  return Math.max(0, Math.min(0.94, sim));
}

function splitVowel(w: string): [string, string, string] | null {
  const m = /^([^aeiouy]*)([aeiouy]+)([^aeiouy]*e?)$/.exec(w);
  return m ? [m[1], m[2], m[3]] : null;
}

/**
 * Two one-syllable words that differ only in the vowel sound (said/sad, bed/bad, pen/pan,
 * men/man, sit/set). Children's short vowels — and the recognizer's — blur these, so hearing
 * the other one is "almost", never a confident "wrong" (docs/UX-V3.md §4.1).
 */
export function vowelMinimalPair(a: string, b: string): boolean {
  if (!a || !b || a === b || a.length > 6 || b.length > 6) return false;
  const x = splitVowel(a);
  const y = splitVowel(b);
  if (!x || !y) return false;
  if (x[0] !== y[0] || x[2] !== y[2] || !x[2]) return false;
  return x[1] !== y[1];
}

/** Similarity needed to count as a hit — stricter for short words, where one sound is the whole word. */
export function hitThreshold(target: string): number {
  const len = target.replace(/ /g, '').length;
  if (len <= 4) return 0.95; // sound-alike key or better
  if (len <= 6) return 0.92;
  return 0.88;
}

function buildAcceptSet(target: string, opts: WordMatchOptions): Set<string> {
  const set = new Set<string>([target]);
  if (opts.allowHomophones !== false) {
    homophonesOf(target).forEach((h) => set.add(h));
    // digit/word equivalence ("two" ↔ "2" handled by wordTokens), and number homophones.
  }
  for (const a of opts.alternates ?? []) {
    const n = normWord(a);
    if (n) set.add(n);
  }
  return set;
}

export const matchWord: MatchWord = (transcript, targetRaw, options): WordMatchResult => {
  const opts: WordMatchOptions = Array.isArray(options) ? { alternates: options } : options ?? {};
  const target = normWord(targetRaw);
  const toks = wordTokens(transcript ?? '');
  const normalized = toks.join(' ');
  if (!target) return { verdict: 'unclear', similarity: 0, normalized };
  const content = toks.filter((t) => !NOISE.has(t) || target.split(' ').includes(t));
  if (!content.length) return { verdict: 'unclear', similarity: 0, normalized };

  const accept = buildAcceptSet(target, opts);
  const tLen = target.split(' ').length;

  // Candidate spans: single tokens, plus spans of the target's word count and ±1 joined
  // ("ice cream" / "icecream", "pop corn" → "popcorn").
  let bestSim = -1;
  let bestHeard = '';
  const spans = new Set<string>();
  for (let n = 1; n <= Math.min(3, Math.max(1, tLen + 1)); n++) {
    for (let i = 0; i + n <= content.length; i++) {
      const span = content.slice(i, i + n);
      spans.add(span.join(' '));
      if (n > 1) spans.add(span.join(''));
    }
  }
  for (const s of spans) {
    const cmpTarget = s.includes(' ') || tLen === 1 ? target : target.replace(/ /g, '');
    const sim = wordSimilarity(s, cmpTarget, accept) ;
    const simJoined = tLen > 1 && !s.includes(' ') ? wordSimilarity(s, target.replace(/ /g, ''), new Set([...accept].map((a) => a.replace(/ /g, '')))) : sim;
    const v = Math.max(sim, simJoined);
    if (v > bestSim) {
      bestSim = v;
      bestHeard = s;
    }
  }
  const similarity = Math.max(0, bestSim);
  if (similarity >= hitThreshold(target)) {
    return { verdict: 'correct', heard: bestHeard, similarity: similarity >= 0.95 ? Math.max(similarity, 0.95) : similarity, normalized };
  }
  // A short, clear, different word → wrong. Long rambles or near-misses → unclear.
  if (similarity < 0.5 && content.length <= 3 && content.every((t) => /^[a-z]{2,}$/.test(t))) {
    return { verdict: 'wrong', heard: bestHeard || content[content.length - 1], similarity, normalized };
  }
  const almost = content.some((t) => vowelMinimalPair(t, target));
  return { verdict: 'unclear', heard: bestHeard || undefined, similarity, normalized, ...(almost ? { almost: true } : {}) };
};

/** Words in a sentence string → normalised word list (punctuation stripped). */
export function sentenceWords(sentence: string): string[] {
  return wordTokens(sentence);
}

const CLOSE_MIN = 0.6;

export const alignSentence: AlignSentence = (transcript, wordsRaw) => {
  const targets = wordsRaw.map((w) => normWord(w));
  const heard = wordTokens(transcript ?? '').filter((t) => !NOISE.has(t) || targets.includes(t));
  const n = targets.length;
  const m = heard.length;
  const accepts = targets.map((t) => buildAcceptSet(t, {}));
  const sim: number[][] = targets.map((t, i) => heard.map((h) => (t ? wordSimilarity(h, t, accepts[i]) : 0)));
  // dp[i][j]: best total score aligning first i targets with first j heard tokens.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = sim[i - 1][j - 1];
      const diag = s >= CLOSE_MIN ? dp[i - 1][j - 1] + s : -Infinity;
      dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], diag);
    }
  }
  const pairs = new Map<number, number>(); // target index → heard index
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const s = sim[i - 1][j - 1];
    if (s >= CLOSE_MIN && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + s)) < 1e-9) {
      pairs.set(i - 1, j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  const used = new Set(pairs.values());
  const words: AlignedWord[] = wordsRaw.map((raw, k) => {
    if (!targets[k]) return { word: raw, status: 'hit', similarity: 1 }; // punctuation-only token
    const idx = pairs.get(k);
    if (idx === undefined) return { word: raw, status: 'miss', similarity: 0 };
    const s = sim[k][idx];
    const status = s >= hitThreshold(targets[k]) ? 'hit' : 'close';
    return { word: raw, status, heard: heard[idx], similarity: s };
  });
  const score = words.reduce((a, w) => a + (w.status === 'hit' ? 1 : w.status === 'close' ? 0.5 : 0), 0);
  const hitRatio = words.length ? score / words.length : 0;
  return {
    words,
    hitRatio,
    isComplete: hitRatio >= 0.9,
    extra: heard.filter((_, k) => !used.has(k)),
  };
};
