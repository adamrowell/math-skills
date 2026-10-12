/**
 * Read Sentences — pure state logic (unit-tested).
 *
 * Each word is todo → hit (read on the first pass) / miss (skipped or misread) → hit on a re-read,
 * or helped (he tapped it to hear it). Every final transcript is aligned against the words he
 * has not read yet, so a pause in the middle, a restart from the beginning, or re-reading just the
 * orange words all work the same way.
 */
import { alignSentence, sentenceWords } from '../../voice';

export type WordState = 'todo' | 'hit' | 'reread' | 'miss' | 'helped';

export interface SentenceState {
  /** Display tokens ("cat." keeps its punctuation). */
  tokens: string[];
  /** Normalised words, same length as tokens. */
  words: string[];
  states: WordState[];
}

export function initSentence(text: string): SentenceState {
  const tokens = text.split(/\s+/).filter(Boolean);
  const words = tokens.map((t) => sentenceWords(t).join(' '));
  return { tokens, words, states: tokens.map((_, i) => (words[i] ? 'todo' : 'hit')) };
}

/** Indices still to be read (todo or miss), in order. */
export function pending(s: SentenceState): number[] {
  return s.states.map((st, i) => (st === 'todo' || st === 'miss' ? i : -1)).filter((i) => i >= 0);
}

export function isDone(s: SentenceState): boolean {
  return pending(s).length === 0;
}

/** First pass over (no todo words left) but some words still need reading. */
export function inRetry(s: SentenceState): boolean {
  return !s.states.includes('todo') && s.states.includes('miss');
}

export function isClean(s: SentenceState): boolean {
  return s.states.every((st) => st === 'hit');
}

export interface ApplyResult {
  next: SentenceState;
  /** Newly read on the first pass / on a re-read. */
  firstHits: number[];
  rereadHits: number[];
  /** Newly marked as skipped. */
  newMisses: number[];
}

/** Apply one final transcript. */
export function applyTranscript(s: SentenceState, transcript: string): ApplyResult {
  const idx = pending(s);
  const out: ApplyResult = { next: s, firstHits: [], rereadHits: [], newMisses: [] };
  if (!idx.length || !transcript.trim()) return out;
  const a = alignSentence(transcript, idx.map((i) => s.words[i]));
  const states = [...s.states];
  let maxHit = -1;
  a.words.forEach((w, k) => {
    if (w.status !== 'hit') return;
    const i = idx[k];
    if (states[i] === 'todo') {
      states[i] = 'hit';
      out.firstHits.push(i);
    } else {
      states[i] = 'reread';
      out.rereadHits.push(i);
    }
    maxHit = Math.max(maxHit, i);
  });
  // Words before the last one he read, still not read, were skipped.
  for (let i = 0; i < maxHit; i++) {
    if (states[i] === 'todo') {
      states[i] = 'miss';
      out.newMisses.push(i);
    }
  }
  out.next = { ...s, states };
  return out;
}

/** Tapped a word to hear it: no points for that word. */
export function helpWord(s: SentenceState, i: number): SentenceState {
  if (s.states[i] !== 'todo' && s.states[i] !== 'miss') return s;
  const states = [...s.states];
  states[i] = 'helped';
  return { ...s, states };
}

/** Heard the whole sentence: everything unread becomes a re-read (small points). */
export function heardAll(s: SentenceState): SentenceState {
  return { ...s, states: s.states.map((st) => (st === 'todo' ? 'miss' : st)) };
}

/** First-pass word count (for stars / words per minute). */
export function firstPassCount(s: SentenceState): number {
  return s.states.filter((st, i) => st === 'hit' && s.words[i]).length;
}

export function wordCount(s: SentenceState): number {
  return s.words.filter(Boolean).length;
}
