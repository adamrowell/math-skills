/**
 * Reading-app decode path (Read Words / Read Sentences).
 *
 * Plain transcription of a single word is unreliable for children (≈ 60 % of correctly
 * read words came back as the right word). Instead, like the number scorer, we ask the model
 * how well the audio fits the TARGET and compare that with how well it fits the alternatives:
 *
 *   target    — the word (+ homophones / alternates), in the spellings Moonshine emits
 *               (" Cat.", " cat", " Cat!" …), teacher-forced → lpTarget
 *   neighbours — real words that sound similar (cat → hat, cut, cot, cap, can …) and
 *               minimal-pair onset/vowel/coda swaps → lpNeighbour (best one)
 *   garbage   — fillers (um, hmm, what?) → lpGarbage
 *   free      — the unconstrained greedy transcript and its own score → lpFree
 *
 * Accept when the target beats every neighbour and the garbage path by a margin and is
 * close enough to the free transcript (the model's own best guess). The free transcript also
 * gives a second, independent signal through matchWord's phonetic tolerance.
 */
import type { OnDeviceHypothesis } from './onDevice';
import type { FromWorker, ToWorker } from './asrProtocol';
import { homophonesOf, matchWord, vowelMinimalPair, wordSimilarity, wordTokens, alignSentence } from '../match/words';
import { WORD_VOCAB } from '../match/vocab';
import { phoneticKey } from '../match/phonetic';
import { ALL_READING_WORDS } from '../../data/reading/words';

type Recognize = (
  audio: Float32Array,
  req: Omit<Extract<ToWorker, { type: 'recognize' }>, 'type' | 'id' | 'audio'>,
) => Promise<Extract<FromWorker, { type: 'result' }>>;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Common short words not in the lists that kids (or the model) say instead. */
const EXTRA_COMMON = (
  'am at an as on in it if is us up so no go me be he we she my by why who how hi oh ok yes yeah ' +
  'bad dad pad cab tab lab cot cut hut bit bet but bug beg bag big pit pet pot put tip top tap ' +
  'hum hem him ham hip hop hug hog dip den din dim dug dot fat fit fig fog fun gas gap got hat hen ' +
  'kit lid lot mad men mix nod pal pen rib rid rug sip sob sun son ten tin tub van vet wet win yum zap ' +
  'chip chop shop ship tin thin then than tick tack back pack sack sick rock luck lock duck dock deck ' +
  'came come cane can cone cake cape coat cot cut kite kit bike bite like line lime lake late rate ' +
  'three tree free feet fit seat sit read red rode road raid ride rid made mad mud ' +
  'were where wear what want went won one when win then them they the there their'
)
  .split(' ')
  .filter(Boolean);

let vocab: string[] | null = null;
function readingVocab(): string[] {
  if (!vocab) vocab = Array.from(new Set([...WORD_VOCAB, ...ALL_READING_WORDS, ...EXTRA_COMMON])).filter((w) => /^[a-z]+$/.test(w));
  return vocab;
}
let vocabSet: Set<string> | null = null;
function readingVocabSet(): Set<string> {
  if (!vocabSet) vocabSet = new Set(readingVocab());
  return vocabSet;
}

const GARBAGE = [' Um.', ' Hmm.', ' Oh.', ' What?', " I don't know."];
/** Filler sounds: covered by the garbage path, never a "different word". */
const FILLERS = new Set(['um', 'umm', 'uh', 'hmm', 'hm', 'huh', 'oh', 'ah', 'eh', 'mm', 'yeah', 'yum', 'er']);

/** Spellings Moonshine produces for a lone word. */
function wordForms(w: string): string[] {
  const C = cap(w);
  return [` ${C}.`, ` ${C}`, ` ${w}.`, ` ${C}!`];
}
function neighbourForms(w: string): string[] {
  const C = cap(w);
  return [` ${C}.`, ` ${C}`];
}

const VOICING: Record<string, string> = { p: 'b', b: 'p', t: 'd', d: 't', k: 'g', g: 'k', s: 'z', z: 's', f: 'v', v: 'f', ck: 'g' };
/**
 * cap/cab, sat/sad, jet/jed, cup/cub: words that differ only in the voicing of the last
 * consonant. Children (and the recognizer) blur these; they do not count as a misread.
 */
export function voicingVariant(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) return false;
  const ma = /^(.*?)(ck|[a-z])$/.exec(a);
  const mb = /^(.*?)(ck|[a-z])$/.exec(b);
  if (!ma || !mb || ma[1] !== mb[1]) return false;
  return VOICING[ma[2]] === mb[2] || VOICING[mb[2]] === ma[2];
}

/** Split off the initial consonants: "frog" → ["fr", "og"]. */
function onsetRime(w: string): [string, string] {
  const m = /^([^aeiouy]*)(.*)$/.exec(w);
  return m ? [m[1], m[2]] : ['', w];
}

/**
 * Sound-alike competitors for `target`: real words that share its rime (cat → hat, bat, mat —
 * the classic beginning-reader slip), the closest-sounding real words overall (cut, cot, cap,
 * can). Final-consonant voicing variants (cap/cab) are not competitors.
 */
export function wordNeighbours(target: string, group: Set<string>, max = 14): string[] {
  const tKey = phoneticKey(target);
  const inGroup = (w: string) => group.has(w) || (!!tKey && phoneticKey(w) === tKey);
  const [tOn, tRime] = onsetRime(target);
  const scored: { w: string; s: number }[] = [];
  const rhymes: { w: string; s: number }[] = [];
  for (const w of readingVocab()) {
    if (inGroup(w) || FILLERS.has(w) || Math.abs(w.length - target.length) > 3 || voicingVariant(w, target)) continue;
    const s = wordSimilarity(w, target);
    const [on, rime] = onsetRime(w);
    if (rime === tRime && on !== tOn && tRime.length >= 2) rhymes.push({ w, s });
    else if (s >= 0.34) scored.push({ w, s });
  }
  scored.sort((a, b) => b.s - a.s);
  rhymes.sort((a, b) => b.s - a.s);
  const out: string[] = [];
  const add = (w: string) => {
    if (!out.includes(w) && !inGroup(w)) out.push(w);
  };
  rhymes.slice(0, 5).forEach((x) => add(x.w));
  for (const x of scored) {
    if (out.length >= max - 2) break;
    add(x.w);
  }
  return out;
}

const logSumExp = (xs: number[]) => {
  const m = Math.max(...xs);
  return m === -Infinity ? m : m + Math.log(xs.reduce((a, x) => a + Math.exp(x - m), 0));
};

export interface WordDecodeFeatures {
  target: string;
  lpTarget: number;
  bestNeighbour: string | null;
  lpNeighbour: number;
  lpGarbage: number;
  free: string;
  lpFree: number | null;
  /** Score of saying nothing at all. */
  lpEmpty?: number;
  /** Best other word from the whole reading vocabulary, and the target's lead over it. */
  vocabOther?: string | null;
  vocabMargin?: number;
  /** Features of the pitch-lowered second pass (diagnostics). */
  second?: WordDecodeFeatures;
  freeMatches: boolean;
  /** Free transcript is one clear word that is not the target. */
  freeOther: string | null;
  /** Sound-alike similarity of the free word to the target (0..1). */
  freeSim: number;
  /** The free word only differs from the target in final-consonant voicing (cap/cab). */
  freeVoicing?: boolean;
  neighbours: { w: string; lp: number; real: boolean }[];
}

/**
 * Decision thresholds (log-prob nats), tuned on `say` clips in 6 voices incl. pitch-raised
 * "kid" voices (tests/words-voice.spec.ts dumps the features; see READING notes there).
 */
export const READ_WORD = {
  /** Target must be at least as likely as the best sound-alike real word (+ this). */
  neighbourMargin: 0,
  /** Non-words (minimal-pair swaps like "cag") only win when clearly better. */
  nonWordPenalty: 1.0,
  /** … and beat the filler path by this much. */
  garbageMargin: 0,
  /** Target may trail the model's own free transcript by at most this much … */
  freeGap: 5,
  /** … or by this much when the free transcript independently reads as the target. */
  freeGapAgree: 8,
  /** Free transcript agrees: accept unless a neighbour is ahead by more than this. */
  agreeNeighbour: -3,
  /** A clearly different free word (not a sound-alike) this much more likely → not the target. */
  vetoGap: 1,
  /** Sound-alike threshold (wordSimilarity) below which the free word is "clearly different". */
  differentSim: 0.5,
  /**
   * Target vs the best other word of the whole reading vocabulary (trie beam, no
   * punctuation forms, so it is a coarser signal): only a clear loss vetoes.
   */
  vocabMargin: -3,
  /** … stricter when the free transcript came back empty (no independent evidence at all). */
  vocabMarginNoFree: -1,
  /** 'wrong' ("not quite") needs the free word to beat the target by this much. */
  wrongGap: 3,
};

export function decideWord(f: WordDecodeFeatures): { verdict: 'correct' | 'wrong' | 'unclear'; text: string; confidence: number; margin: number } {
  const T = READ_WORD;
  const mN = f.lpTarget - f.lpNeighbour;
  const mG = f.lpTarget - f.lpGarbage;
  const freeAhead = f.lpFree === null ? 0 : f.lpFree - f.lpTarget; // ≥ ~0 usually
  const margin = Math.min(mN, mG);
  const clearlyOther = !!f.freeOther && f.freeSim < T.differentSim;
  // The model's own transcript names a different word (said vs sad, ship vs sheep): even a
  // close one vetoes when it is more likely than the target. Voicing blurs (cap/cab) don't.
  const otherWord = !!f.freeOther && !f.freeVoicing;
  const veto = (otherWord && freeAhead > T.vetoGap) || (f.vocabMargin ?? 8) < (f.lpFree === null ? T.vocabMarginNoFree : T.vocabMargin);
  if (!veto && mN >= T.neighbourMargin && mG >= T.garbageMargin && freeAhead <= (f.freeMatches ? T.freeGapAgree : T.freeGap)) {
    return { verdict: 'correct', text: f.target, confidence: 0.92, margin };
  }
  // Second signal: the free transcript reads as the target and the scorer does not object.
  if (f.freeMatches && mN >= T.agreeNeighbour && mG >= 0) return { verdict: 'correct', text: f.target, confidence: 0.8, margin };
  // A clearly different word (the model's own transcript, not a sound-alike): "not quite".
  // Both the free transcript and the vocabulary scorer must name the same other word, by a lot.
  if (clearlyOther && freeAhead >= T.wrongGap && f.vocabOther === f.freeOther && (f.vocabMargin ?? 0) <= -T.wrongGap) {
    return { verdict: 'wrong', text: f.freeOther as string, confidence: 0.7, margin };
  }
  return { verdict: 'unclear', text: '', confidence: 0.4, margin };
}

/** Score one segment against a target word; returns a hypothesis whose text is the target when accepted. */
/**
 * Slow down + lower the pitch by `factor` (linear-interpolated resample, played back at 16 kHz).
 * Children's voices sit well above the adult speech the model mostly learned from; a
 * lowered copy is a second chance when the first pass was not sure.
 */
export function lowerPitch(audio: Float32Array, factor = 1.22): Float32Array {
  const n = Math.floor(audio.length * factor);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / factor;
    const k = Math.floor(x);
    const t = x - k;
    out[i] = (audio[k] ?? 0) * (1 - t) + (audio[k + 1] ?? 0) * t;
  }
  return out;
}

export async function decodeReadingWord(
  recognize: Recognize,
  audio: Float32Array,
  biasWords: string[],
  base: Pick<OnDeviceHypothesis, 'isFinal' | 'engine' | 'durationMs' | 'utteranceId'>,
  endedAt: number,
): Promise<OnDeviceHypothesis & { features?: WordDecodeFeatures; pass?: number }> {
  // The worker takes ownership of the buffer it is sent: make the second-chance copies first.
  const copies = PITCH_PASSES.map((f) => lowerPitch(audio, f));
  const first = await scoreReadingWord(recognize, audio, biasWords, base, endedAt);
  if (accepted(first)) return { ...first, pass: 1 };
  let features = first.features;
  for (let i = 0; i < copies.length; i++) {
    const next = await scoreReadingWord(recognize, copies[i], biasWords, base, endedAt);
    // Only a clean accept on a lowered copy overrides the first pass.
    if (accepted(next)) return { ...next, pass: i + 2, latencyMs: Math.round(performance.now() - endedAt) };
    if (features && next.features && i === 0) features = { ...features, second: next.features };
  }
  return { ...first, pass: 1, latencyMs: Math.round(performance.now() - endedAt), features };
}

/** Second-chance resample factors, tried in order only while nothing was accepted. */
export const PITCH_PASSES = [1.22];

function accepted(h: { text: string; top?: string; features?: WordDecodeFeatures }): boolean {
  return !!h.text && h.top === h.features?.target;
}

async function scoreReadingWord(
  recognize: Recognize,
  audio: Float32Array,
  biasWords: string[],
  base: Pick<OnDeviceHypothesis, 'isFinal' | 'engine' | 'durationMs' | 'utteranceId'>,
  endedAt: number,
): Promise<OnDeviceHypothesis & { features?: WordDecodeFeatures }> {
  const target = wordTokens(biasWords[0]).join(' ');
  const group = new Set<string>();
  for (const w of biasWords) {
    const n = wordTokens(w).join(' ');
    if (!n) continue;
    group.add(n);
    homophonesOf(n).forEach((h) => group.add(h));
  }
  const groupList = [...group];
  const neighbours = target.includes(' ') ? [] : wordNeighbours(target, group);
  const texts: string[] = [];
  const owner: string[] = [];
  const add = (t: string, o: string) => {
    texts.push(t);
    owner.push(o);
  };
  for (const g of groupList) for (const f of wordForms(g)) add(f, `T:${g}`);
  for (const n of neighbours) for (const f of neighbourForms(n)) add(f, `N:${n}`);
  // A filler that IS the word ("what", "oh") is not garbage for that target.
  for (const g of GARBAGE) if (!group.has(wordTokens(g).join(' '))) add(g, 'G');
  // "Nothing was said" (EOT straight away): stands in for the free transcript when it is empty.
  add('', 'E');
  // Whole reading vocabulary (trie-constrained beam): did he say some OTHER word on the lists?
  const vocabCands = [...groupList, ...readingVocab().filter((w) => !group.has(w) && !FILLERS.has(w))];
  const r = await recognize(audio, { candidates: vocabCands, mustScore: groupList, freeDecode: 'always', scoreTexts: texts, scoreFree: true });
  const tKey = phoneticKey(target);
  const sameSound = (w: string) => group.has(w) || (!!tKey && phoneticKey(w) === tKey) || voicingVariant(w, target);
  const lpTrieTarget = Math.max(-Infinity, ...r.forced.map((x) => x.lp));
  const otherTop = r.ranked.find((x) => !sameSound(x.cand));
  const lps = r.textScores ?? [];
  const tLps: number[] = [];
  const gLps: number[] = [];
  let lpEmpty = -Infinity;
  const nBest = new Map<string, number>();
  owner.forEach((o, i) => {
    const lp = lps[i] ?? -Infinity;
    if (o.startsWith('T:')) tLps.push(lp);
    else if (o === 'G') gLps.push(lp);
    else if (o === 'E') lpEmpty = lp;
    else {
      const w = o.slice(2);
      nBest.set(w, Math.max(nBest.get(w) ?? -Infinity, lp));
    }
  });
  const lpTarget = logSumExp(tLps);
  const vocabSet = readingVocabSet();
  const ranked = [...nBest.entries()].map(([w, lp]) => ({ w, lp, real: vocabSet.has(w) })).sort((a, b) => b.lp - a.lp);
  // Best competitor; made-up minimal-pair swaps carry a penalty.
  const lpNeighbour = Math.max(-Infinity, ...ranked.map((x) => x.lp - (x.real ? 0 : READ_WORD.nonWordPenalty)));
  const free = (r.text ?? '').trim();
  const freeToks = wordTokens(free).filter((t) => !['um', 'uh', 'hmm', 'oh', 'the', 'a'].includes(t));
  const freeMatches = !!free && matchWord(free, target, { alternates: groupList }).verdict === 'correct';
  const freeOther = !freeMatches && freeToks.length === 1 && freeToks[0].length >= 2 ? freeToks[0] : null;
  const features: WordDecodeFeatures = {
    target,
    lpTarget,
    bestNeighbour: ranked[0]?.w ?? null,
    lpNeighbour,
    lpGarbage: Math.max(...gLps, -Infinity),
    free,
    // An empty free transcript means "nothing said" was the model's best guess: compare to that.
    lpFree: free ? (r.freeLp ?? null) : null,
    lpEmpty,
    vocabOther: otherTop?.cand ?? null,
    vocabMargin: otherTop ? lpTrieTarget - otherTop.lp : 8,
    freeMatches,
    freeOther,
    freeSim: freeOther ? wordSimilarity(freeOther, target) : 0,
    freeVoicing: freeOther ? voicingVariant(freeOther, target) : false,
    neighbours: ranked.slice(0, 6),
  };
  const d = decideWord(features);
  // Not accepted, and what beat the target is the same word with another vowel (said/sad).
  let almost: string | undefined;
  if (d.verdict === 'unclear') {
    if (freeOther && vowelMinimalPair(freeOther, target)) almost = freeOther;
    else if (ranked[0] && ranked[0].real && ranked[0].lp >= lpTarget && vowelMinimalPair(ranked[0].w, target)) almost = ranked[0].w;
  }
  return {
    ...base,
    ...(almost ? { almost } : {}),
    text: d.text,
    confidence: d.confidence,
    latencyMs: Math.round(performance.now() - endedAt),
    top: d.verdict === 'correct' ? target : (ranked[0]?.w ?? undefined),
    margin: d.margin,
    topLp: lpTarget,
    freeText: free,
    inferenceMs: Math.round(r.totalMs),
    ranked: [{ cand: target, lp: lpTarget }, ...ranked.slice(0, 4).map((x) => ({ cand: x.w, lp: x.lp }))],
    features,
  };
}

// ---------------------------------------------------------------------------
// Sentences
// ---------------------------------------------------------------------------

export interface SentenceDecodeFeatures {
  lpTarget: number;
  lpFree: number | null;
  free: string;
  perWord: number;
}

/**
 * Sentence mode with a target: free transcript (long-form) + a teacher-forced score of the
 * target sentence. When the target is about as likely as the model's own transcript, every
 * word was read and small transcription slips are forgiven; otherwise the free transcript is
 * aligned word by word (the app's alignSentence) so skipped words stay missed.
 */
export const READ_SENTENCE = {
  /**
   * Allowed shortfall of the target vs the free transcript: base + perWord·n, capped (nats).
   * Tuned on say clips: whole reads ≤ ~0 typically (≤ 3 for kid voices), a skipped word ≥ 2.2.
   * Above it the free transcript is aligned word by word instead (so nothing is lost).
   */
  baseGap: 1.5,
  perWordGap: 0.1,
  maxGap: 2.1,
};

export async function decodeReadingSentence(
  recognize: Recognize,
  audio: Float32Array,
  targetText: string,
  base: Pick<OnDeviceHypothesis, 'isFinal' | 'engine' | 'durationMs' | 'utteranceId'>,
  endedAt: number,
): Promise<OnDeviceHypothesis & { sentence?: SentenceDecodeFeatures }> {
  const words = targetText.split(/\s+/).filter(Boolean);
  const plain = words.join(' ').replace(/[^A-Za-z' ,.!?-]/g, '');
  const firstCap = cap(plain);
  const bare = firstCap.replace(/[.!?]+$/, '');
  const texts = [` ${bare}.`, ` ${bare}!`, ` ${bare}?`, ` ${bare}`, ` ${bare.replace(/,/g, '')}.`];
  const r = await recognize(audio, { freeDecode: 'always', longForm: true, scoreTexts: texts, scoreFree: true });
  const lpTarget = logSumExp(r.textScores ?? [-Infinity]);
  const free = (r.text ?? '').trim();
  const lpFree = r.freeLp ?? null;
  const n = Math.max(1, words.length);
  const gap = lpFree === null ? Infinity : lpFree - lpTarget;
  const allowed = Math.min(READ_SENTENCE.maxGap, READ_SENTENCE.baseGap + READ_SENTENCE.perWordGap * n);
  // Only trust the forced score when the free transcript already covers most of the sentence
  // (guards against a forced fit of a half-read sentence).
  const coverage = free ? alignSentence(free, words).hitRatio : 0;
  const accept = gap <= allowed && coverage >= 0.5;
  return {
    ...base,
    text: accept ? bare : free,
    confidence: accept ? 0.9 : 0.5,
    latencyMs: Math.round(performance.now() - endedAt),
    freeText: free,
    inferenceMs: Math.round(r.totalMs),
    margin: -gap,
    topLp: lpTarget,
    sentence: { lpTarget, lpFree, free, perWord: gap / n },
  };
}
