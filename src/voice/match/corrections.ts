/**
 * Per-device adaptation (docs/DESIGN.md §1.0.3):
 *
 * 1. Learned aliases. When a voice transcript was judged 'unclear' and the child then
 *    typed the answer, the consumer calls recordCorrection(transcript, answer). After the
 *    same normalised text has been followed by the same answer twice, that exact text
 *    accepts that exact answer from then on — and nothing else (an alias never turns a
 *    clearly-heard different number into a correct one, and never produces 'wrong').
 *
 * 2. Acceptance margin. The on-device engine scores every possible answer and only
 *    commits when the winner beats the runner-up by `acceptMargin` (log-prob). When the
 *    child keeps typing exactly the answer the engine had on top but was not sure about,
 *    the margin is lowered a step (1.0 → 0.5 floor), so a soft-spoken child gets fewer
 *    "say it again" moments. A typed answer that disagrees with a confident top choice
 *    raises it again.
 *
 * Stored in localStorage (`ms2:voice:corrections:v1`), capped, try/catch everywhere via
 * the shell's persisted store (in-memory fallback when storage is blocked).
 */
import { createPersistedStore } from '../../core/store/persist';
import type { CorrectionEntry, RecordCorrection } from '../types';
import { normalizeTranscript, numberToWords, stringSimilarity } from './normalize';
import { phoneticKey } from './phonetic';

export const ALIAS_ACTIVATION_COUNT = 2;
const MAX_ENTRIES = 300;
/** Learned phrases expire when not used for this long. */
const ALIAS_TTL_MS = 60 * 24 * 3600 * 1000;
/** At most this many learned phrases per answer (the most recent win). */
const MAX_PER_ANSWER = 4;
/** A phrase must sound at least this much like the answer to be learnable. */
export const MIN_ALIAS_SIMILARITY = 0.5;

/**
 * Never learned as an alias: fillers, "I don't know", "what", and the engine's own non-answer
 * candidates. Saying "um" twice and typing 56 must not make "um" mean 56.
 */
const NON_ANSWER = new Set([
  'um', 'umm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'hmm', 'hm', 'mm', 'mmm', 'ah', 'ahh', 'eh', 'oh', 'o',
  'i', 'dont', 'do', 'not', 'know', 'idk', 'no', 'yes', 'yeah', 'yep', 'nope', 'what', 'whats', 'wait',
  'okay', 'ok', 'huh', 'the', 'a', 'an', 'it', 'its', 'is', 'and', 'so', 'like', 'well', 'maybe', 'think',
  'answer', 'hello', 'hi', 'help', 'again', 'sorry', 'oops', 'you', 'me', 'that', 'this', 'thing',
]);

/** The words a child would say for `answer` ("fifty six" for 56). */
function spokenForm(answer: number | string): string {
  return typeof answer === 'number' ? numberToWords(answer) : normalizeTranscript(String(answer));
}

function phraseKey(text: string): string {
  return text
    .split(' ')
    .map((w) => phoneticKey(w))
    .join('');
}

/** Is `text` something worth learning as "his way of saying `answer`"? */
export function isLearnableAlias(text: string, answer: number | string): boolean {
  const tokens = text.split(' ').filter(Boolean);
  if (!tokens.length) return false;
  if (text.replace(/[^a-z]/g, '').length < 3) return false;
  if (tokens.every((t) => NON_ANSWER.has(t))) return false;
  const a = phraseKey(text);
  const b = phraseKey(spokenForm(answer));
  if (!a || !b) return false;
  return stringSimilarity(a, b) >= MIN_ALIAS_SIMILARITY;
}
export const DEFAULT_ACCEPT_MARGIN = 1.0;
export const MIN_ACCEPT_MARGIN = 0.5;
const MAX_ACCEPT_MARGIN = 1.5;

interface CorrectionsState {
  version: 1;
  entries: CorrectionEntry[];
  /** On-device engine: winner-vs-runner-up log-prob margin needed to commit. */
  acceptMargin: number;
  nearMisses: number;
}

const INITIAL: CorrectionsState = { version: 1, entries: [], acceptMargin: DEFAULT_ACCEPT_MARGIN, nearMisses: 0 };

export const correctionsStore = createPersistedStore<CorrectionsState>({
  key: 'ms2:voice:corrections:v1',
  version: 1,
  initial: INITIAL,
  sanitize: (s) => ({
    ...s,
    entries: s.entries.filter(
      (e) => e && typeof e.text === 'string' && (typeof e.answer === 'number' || typeof e.answer === 'string') && typeof e.count === 'number',
    ),
  }),
});

/** Recent on-device scoring results so a later typed answer can be related back to them. */
interface RecentScore {
  text: string;
  top: string;
  margin: number;
  ts: number;
  /** The answer the engine was told to expect when it scored this utterance. */
  expected?: string;
}
const recent: RecentScore[] = [];

/** Non-answer candidates the on-device scorer uses (kept in sync with NUMBER_GARBAGE). */
const GARBAGE_TOPS = new Set(['hmm', 'um', 'uh', 'i dont know', 'what', 'okay', 'yes', 'no', 'wait']);

/** Called by the on-device engine for every scored utterance. */
export function noteScoredUtterance(text: string, top: string, margin: number, expected?: string | number): void {
  recent.push({
    text: normalizeTranscript(text),
    top,
    margin,
    ts: Date.now(),
    expected: expected === undefined ? undefined : String(expected),
  });
  if (recent.length > 12) recent.shift();
}

/** The question changed: utterances scored so far belong to the old one. */
export function resetScoredUtterances(): void {
  recent.length = 0;
}

export function getAcceptMargin(): number {
  const m = correctionsStore.get().acceptMargin;
  return Number.isFinite(m) ? Math.min(MAX_ACCEPT_MARGIN, Math.max(MIN_ACCEPT_MARGIN, m)) : DEFAULT_ACCEPT_MARGIN;
}

function adaptMargin(answer: string): void {
  const cutoff = Date.now() - 20_000;
  // Only utterances scored for THIS answer say anything about how well we hear him.
  const rel = recent.filter((r) => r.ts >= cutoff && (r.expected === undefined || r.expected === answer));
  if (!rel.length) return;
  const margin = getAcceptMargin();
  const nearMiss = rel.some((r) => r.top === answer && r.margin < margin && r.margin >= 0.2);
  const confidentOther = rel.some(
    (r) => r.top !== answer && r.margin >= 3 && !GARBAGE_TOPS.has(normalizeTranscript(r.top)),
  );
  if (nearMiss) {
    correctionsStore.update((s) => {
      const n = s.nearMisses + 1;
      // Every 3 near misses → lower the bar by 0.15 (never below the floor).
      if (n >= 3) return { ...s, nearMisses: 0, acceptMargin: Math.max(MIN_ACCEPT_MARGIN, +(margin - 0.15).toFixed(2)) };
      return { ...s, nearMisses: n };
    });
  } else if (confidentOther) {
    // The engine was confidently wrong about this child → be a bit stricter.
    correctionsStore.update((s) => ({ ...s, nearMisses: 0, acceptMargin: Math.min(MAX_ACCEPT_MARGIN, +(margin + 0.25).toFixed(2)) }));
  }
  recent.length = 0;
}

export const recordCorrection: RecordCorrection = (transcript, answer) => {
  const text = normalizeTranscript(transcript ?? '');
  const ans = typeof answer === 'number' ? answer : String(answer).trim().toLowerCase();
  adaptMargin(String(ans));
  if (!text || text.length > 80) return;
  // Never learn an alias from text that already IS the answer, or from a digit string.
  if (text === String(ans) || /^\d+$/.test(text)) return;
  // Never learn fillers ("um", "I don't know") or text that sounds nothing like the answer.
  if (!isLearnableAlias(text, ans)) return;
  const now = Date.now();
  correctionsStore.update((s) => {
    let entries = s.entries.filter((e) => now - e.lastAt < ALIAS_TTL_MS);
    const i = entries.findIndex((e) => e.text === text && String(e.answer) === String(ans));
    if (i >= 0) entries[i] = { ...entries[i], count: entries[i].count + 1, lastAt: now };
    else entries.push({ text, answer: ans, count: 1, firstAt: now, lastAt: now });
    entries.sort((a, b) => b.lastAt - a.lastAt);
    // Cap phrases per answer (most recent first).
    const perAnswer = new Map<string, number>();
    entries = entries.filter((e) => {
      const k = String(e.answer);
      const n = (perAnswer.get(k) ?? 0) + 1;
      perAnswer.set(k, n);
      return n <= MAX_PER_ANSWER;
    });
    return { ...s, entries: entries.slice(0, MAX_ENTRIES) };
  });
};

/**
 * The answer this exact normalised text was learned to mean, if active. When the same text
 * was corrected to two different answers, the most-confirmed one wins only if it leads by 2.
 */
export function lookupAlias(normalized: string): number | string | undefined {
  if (!normalized) return undefined;
  let best: CorrectionEntry | undefined;
  let second = 0;
  const now = Date.now();
  for (const e of correctionsStore.get().entries) {
    if (e.text !== normalized || now - e.lastAt >= ALIAS_TTL_MS) continue;
    // Entries learned by older builds may be fillers: never honour those.
    if (!isLearnableAlias(e.text, e.answer)) continue;
    if (!best || e.count > best.count) {
      second = best ? best.count : second;
      best = e;
    } else if (e.count > second) second = e.count;
  }
  if (!best || best.count < ALIAS_ACTIVATION_COUNT) return undefined;
  if (second > 0 && best.count - second < 2) return undefined;
  return best.answer;
}

export function getCorrections(): CorrectionEntry[] {
  return correctionsStore.get().entries.slice();
}

export function clearCorrections(): void {
  recent.length = 0;
  correctionsStore.set({ ...INITIAL, entries: [] });
}
