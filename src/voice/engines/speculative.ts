/**
 * Speculative (pre-endpoint) decoding for number answers.
 *
 * The worklet streams the open utterance (10 ms frames + a voiced/quiet flag each). When the
 * child goes quiet, the engine decodes the audio so far right away instead of waiting for the
 * 350 ms endpoint. The result may ACCEPT the expected answer early only when all of these hold:
 *
 *   1. the full constrained answer set competed (same trie search as the final decode) and the
 *      expected answer won by the normal accept margin + SPEC.extraMargin (≥ SPEC.minMargin);
 *   2. the speech it decoded is complete: at most SPEC.maxVoicedAfter voiced frames arrived after
 *      the snapshot (the child did not go on), and the child has been quiet for SPEC.quietMs;
 *   3. the answer cannot still become a different answer ("risky", see isRisky):
 *        - a spoken prefix of another plausible answer ("fifty" of 56, "one hundred" of 108,
 *          "one" of 144), or
 *        - a unit that is the start of a teen / -ty word ("six" → "six…teen" / "six…ty",
 *          also "three-teen", "five-teen", "two…ty" as children say them), alone or after
 *          "one hundred".
 *      A child may pause 200–350 ms inside such a word, and a soft unstressed "-teen" can stay
 *      under the VAD threshold; only the endpoint (350 ms of quiet) can tell. Risky answers are
 *      NEVER accepted early. Their decode still starts before the endpoint — once the audio
 *      holds exactly what the endpoint segment will hold (speech + 200 ms) — and is reused at
 *      the endpoint only when no speech followed it (LiveUtterance.matchesSegment);
 *   4. the utterance is short (long ones need the free transcript: "7 times 8 is 56").
 *
 * Everything else (wrong, unclear, risky) is decided at the endpoint as before — but when a
 * speculative result already covers all the speech, it is reused instead of decoding again.
 */
import { isSpokenPrefix } from '../match/numbers';
import type { AsrScore } from './asrProtocol';

export const SPEC = {
  /** Frames of speech before the first speculative decode. */
  minVoicedFrames: 15,
  /** Quiet frames that trigger a decode (a quiet onset). */
  triggerQuietFrames: 2,
  /** A result covers the speech if at most this many voiced frames arrived after its snapshot. */
  maxVoicedAfter: 1,
  /** Extra log-prob margin required on top of the adaptive accept margin… */
  extraMargin: 0.5,
  /** …and never less than this (stress sweep: a "four" cut 100 ms short won "5" by 1.99). */
  minMargin: 2.0,
  /** Quiet tail before an early accept. */
  quietMs: 90,
  /**
   * Trailing quiet frames the endpoint segment keeps (capture.worklet.js finish(): 200 ms).
   * A snapshot with this much quiet and no speech after it is the endpoint segment, sample
   * for sample.
   */
  segmentQuietFrames: 20,
  /** Longer utterances (first → last voiced frame) go through the full decode (free transcript). */
  maxSpeechMs: 1800,
  /** At most this many speculative decodes per utterance (intermittent noise, long answers). */
  maxJobs: 3,
  /** A new speculative decode needs this many new voiced frames since the last snapshot. */
  minNewVoiced: 8,
};

/** Units whose spoken form starts a teen / -ty word: six → six-teen / six-ty, three → "three-teen". */
const EXTENDABLE = new Set([2, 3, 4, 5, 6, 7, 8, 9]);

/** "six", "one hundred six": the last word could still grow into a teen / -ty. */
export function isExtendable(n: number): boolean {
  return EXTENDABLE.has(n % 100) && (n < 10 || n > 100);
}

const FRAME = 160;

export interface SpecResult {
  /** Frames in the snapshot that was decoded. */
  snapFrames: number;
  ranked: AsrScore[];
  margin: number;
  /** The full worker result (for reuse at the endpoint). */
  raw: unknown;
  doneAt: number;
  sentAt?: number;
}

/** The utterance being spoken, as streamed by the worklet. */
export class LiveUtterance {
  private buf = new Float32Array(FRAME * 200);
  readonly flags: number[] = [];
  lastVoiced = -1;
  firstVoiced = -1;
  voiced = 0;
  /** `voiced` when the last speculative snapshot was taken. */
  snapVoiced = 0;
  /** Quiet frames inside the last speculative snapshot. */
  snapQuiet = 0;
  accepted = false;
  /** The endpoint arrived (the segment is being judged). */
  ended = false;
  spec: SpecResult | null = null;
  /** The speculative decode running in the worker (`id`: its worker job, for cancelling). */
  inflight: { snapFrames: number; p: Promise<SpecResult | null>; id?: number } | null = null;
  jobs = 0;
  /** Snapshot length that should be decoded as soon as the worker is free. */
  wantSnap = 0;
  /** performance.now() of the last streamed chunk. */
  lastChunkAt = 0;
  /** A decode must hold this many quiet frames after the speech (risky answers: the endpoint segment's 20). */
  needSnapQuiet = 0;

  constructor(
    readonly id: number,
    readonly epoch: number,
  ) {}

  get nFrames(): number {
    return this.flags.length;
  }

  /** First → last voiced frame, ms (wall clock: pauses inside the utterance count). */
  get spanMs(): number {
    return this.firstVoiced < 0 ? 0 : (this.lastVoiced - this.firstVoiced + 1) * 10;
  }

  /**
   * Separate bursts of speech: voiced runs (≥ minRun frames) split by ≥ minGap quiet frames.
   * "six" is one burst; "six … teen", "um … six" are two.
   */
  islands(minGap = 12, minRun = 3): number {
    let n = 0;
    let run = 0;
    let counted = false;
    let gap = Infinity;
    for (const f of this.flags) {
      if (!f) {
        gap++;
        continue;
      }
      if (gap >= minGap) {
        run = 0;
        counted = false;
      }
      gap = 0;
      if (++run >= minRun && !counted) {
        n++;
        counted = true;
      }
    }
    return n;
  }

  /** Trailing quiet frames. */
  get quietFrames(): number {
    return this.nFrames - 1 - this.lastVoiced;
  }

  append(audio: Float32Array, flags: Uint8Array, from: number): boolean {
    if (from !== this.nFrames) return false; // out of sync (should not happen): stop speculating
    const need = (this.nFrames + flags.length) * FRAME;
    if (need > this.buf.length) {
      const nb = new Float32Array(Math.max(need, this.buf.length * 2));
      nb.set(this.buf.subarray(0, this.nFrames * FRAME));
      this.buf = nb;
    }
    this.buf.set(audio.subarray(0, flags.length * FRAME), this.nFrames * FRAME);
    for (let i = 0; i < flags.length; i++) {
      this.flags.push(flags[i]);
      if (flags[i]) {
        this.lastVoiced = this.nFrames - 1;
        if (this.firstVoiced < 0) this.firstVoiced = this.lastVoiced;
        this.voiced++;
      }
    }
    return true;
  }

  /** Copy of the first `frames` frames (transferable). */
  snapshot(frames = this.nFrames): Float32Array {
    return this.buf.slice(0, frames * FRAME);
  }

  /** Quiet frames at the end of the first `snapFrames` frames. */
  quietIn(snapFrames: number): number {
    let i = Math.min(snapFrames, this.flags.length) - 1;
    while (i >= 0 && !this.flags[i]) i--;
    return snapFrames - 1 - i;
  }

  voicedAfter(snapFrames: number): number {
    let n = 0;
    for (let i = snapFrames; i < this.flags.length; i++) n += this.flags[i];
    return n;
  }

  /** Does a decode of the first `snapFrames` frames contain all the speech so far? */
  covers(snapFrames: number): boolean {
    return this.voicedAfter(snapFrames) <= SPEC.maxVoicedAfter;
  }

  /** Covers the speech and holds the silence `needSnapQuiet` asks for. */
  satisfies(snapFrames: number): boolean {
    // Until that much silence exists there is nothing better to decode.
    return this.covers(snapFrames) && (this.quietIn(snapFrames) >= this.needSnapQuiet || this.quietFrames < this.needSnapQuiet);
  }

  /**
   * Is a decode of the first `snapFrames` frames a decode of the endpoint segment itself? No
   * voiced frame after it, and it already holds the 200 ms of quiet the segment keeps — so a
   * soft "-teen" under the VAD threshold is in it exactly as it would be at the endpoint.
   */
  matchesSegment(snapFrames: number): boolean {
    return this.voicedAfter(snapFrames) === 0 && this.quietIn(snapFrames) >= SPEC.segmentQuietFrames;
  }
}

/** Is `n` the spoken start of another candidate ("fifty" → 56, "one" → 144)? */
export function isGrowable(n: number, cands: readonly string[]): boolean {
  for (const c of cands) {
    if (!/^\d+$/.test(c)) continue;
    if (isSpokenPrefix(n, Number(c))) return true;
  }
  return false;
}

const growCache = new Map<string, boolean>();
function growableCached(n: number, cands: readonly string[]): boolean {
  const key = `${n}|${cands.length}|${cands[cands.length - 1] ?? ''}`;
  let v = growCache.get(key);
  if (v === undefined) {
    v = isGrowable(n, cands);
    growCache.set(key, v);
    if (growCache.size > 500) growCache.clear();
  }
  return v;
}

/** Could `n` still turn into a different answer if the child goes on (prefix or teen / -ty)? */
export function isRisky(n: number, cands: readonly string[]): boolean {
  return isExtendable(n) || growableCached(n, cands);
}

export type SpecVerdict =
  | { kind: 'accept' }
  /** Acceptable once the child has been quiet for `quietMs`. */
  | { kind: 'wait'; quietMs: number }
  | { kind: 'no'; reason: string };

/**
 * May a speculative result accept `expected` now?
 * `quietMs` = the child's current trailing silence; `voicedAfter` = voiced frames after the
 * snapshot; `speechMs` = first → last voiced frame.
 */
export function specVerdict(
  r: { ranked: AsrScore[]; margin: number },
  expected: string,
  cands: readonly string[],
  o: { acceptMargin: number; minTopLp: number; quietMs: number; voicedAfter: number; speechMs: number },
): SpecVerdict {
  const top = r.ranked[0];
  if (!top || top.cand !== expected) return { kind: 'no', reason: 'not-expected' };
  if (r.margin < Math.max(o.acceptMargin + SPEC.extraMargin, SPEC.minMargin)) return { kind: 'no', reason: 'margin' };
  if (top.lp < o.minTopLp) return { kind: 'no', reason: 'low-lp' };
  if (o.speechMs > SPEC.maxSpeechMs) return { kind: 'no', reason: 'long' };
  if (o.voicedAfter > SPEC.maxVoicedAfter) return { kind: 'no', reason: 'speech-went-on' };
  if (!/^\d+$/.test(expected)) return { kind: 'no', reason: 'not-a-number' };
  const n = Number(expected);
  if (growableCached(n, cands)) return { kind: 'no', reason: 'prefix' };
  if (isExtendable(n)) return { kind: 'no', reason: 'extendable' };
  if (o.quietMs < SPEC.quietMs) return { kind: 'wait', quietMs: SPEC.quietMs };
  return { kind: 'accept' };
}
