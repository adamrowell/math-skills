import type { MatchVerdict } from '../types';
import type { HeardChip } from './micLook';

/**
 * The panel chip for what the app made of the last utterance.
 *   correct → `✓ 56` (shows the accepted answer), wrong → `I heard 54`, unclear → `❓ Say it again?`,
 *   a spoken prefix of the answer ("fifty…") → partial.
 * Returns null when nothing was heard.
 */
export function heardChipFor(p: {
  verdict: MatchVerdict | null | undefined;
  /** What to show: the accepted answer / the wrong number / the raw transcript. */
  text: string | number | null | undefined;
  partial?: boolean;
  /** A minimal pair (said/sad): "Almost — say it again". */
  almost?: boolean;
  /** Bump to re-show an identical chip. */
  id?: number;
}): HeardChip | null {
  if (p.text === null || p.text === undefined || p.text === '') return null;
  const text = String(p.text);
  const id = p.id;
  if (p.partial) return { kind: 'partial', text, id };
  if (p.verdict === 'correct') return { kind: 'ok', text, id };
  if (p.verdict === 'wrong') return { kind: 'wrong', text, id };
  if (p.almost) return { kind: 'unsure', text: 'Almost — say it again', id };
  return { kind: 'unsure', text, id };
}
