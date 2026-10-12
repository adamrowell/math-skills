/** Messages between the main thread and asr.worker.ts. */

export type AsrDevice = 'wasm' | 'webgpu';

export interface AsrModelSpec {
  /** Which family; selects the model class + decoder prefix. */
  family: 'moonshine' | 'whisper';
  id: string;
  revision?: string;
  dtype: 'q8' | 'fp32' | 'fp16' | 'q4';
  /** Approximate download, bytes (progress estimate before sizes are known). */
  approxBytes: number;
}

export const MODELS = {
  'moonshine-base': {
    family: 'moonshine',
    id: 'onnx-community/moonshine-base-ONNX',
    revision: 'b1e9b6aae3c3c7298f10c3798393fdf38e8fbbad',
    dtype: 'q8',
    approxBytes: 65_000_000,
  },
  'moonshine-tiny': {
    family: 'moonshine',
    id: 'onnx-community/moonshine-tiny-ONNX',
    revision: 'a6da1241cd305dcd64eab1edbd615f2bb9aabb95',
    dtype: 'q8',
    approxBytes: 31_000_000,
  },
  'whisper-tiny.en': {
    family: 'whisper',
    id: 'onnx-community/whisper-tiny.en',
    dtype: 'q8',
    approxBytes: 42_000_000,
  },
} as const satisfies Record<string, AsrModelSpec>;

export type AsrModelKey = keyof typeof MODELS;

export type ToWorker =
  | { type: 'load'; model: AsrModelSpec; device: AsrDevice; wasmBase: string | null }
  | {
      type: 'recognize';
      id: number;
      audio: Float32Array;
      /** Closed answer set for trie-constrained scoring (strings: "56", "cat"). */
      candidates?: string[];
      /** Candidates that must be scored even if the beam pruned them (the expected answer). */
      mustScore?: string[];
      /** Run the free (unconstrained) decode: 'never' | 'always' | 'if-unsure' (margin < unsureMargin). */
      freeDecode: 'never' | 'always' | 'if-unsure';
      unsureMargin?: number;
      /** Also run the free decode when the winner is one of these (non-answer candidates). */
      freeIfTop?: string[];
      /** Word mode: free-decode first and add the words heard as extra competitors. */
      addFreeWords?: boolean;
      /** Long-form decode via generate() (sentences). */
      longForm?: boolean;
      /**
       * Reading apps: exact texts to teacher-force score (e.g. " Cat.", " cat", " The cat sat.").
       * Each is tokenised as-is + EOT; results come back in `textScores` in the same order.
       */
      scoreTexts?: string[];
      /** Also score the free transcript (as " " + text) and return it as `freeLp`. */
      scoreFree?: boolean;
      /** Debug / A-B: decode without the KV cache (re-runs the full prefix every step). */
      legacyDecode?: boolean;
    }
  /**
   * Abandon these recognize jobs (stale speculative decodes). A queued job is skipped; a running
   * one stops at its next decoder step. Either way the job answers with an error 'cancelled'.
   */
  | { type: 'cancel'; ids: number[] }
  | { type: 'dispose' };

export interface AsrScore {
  cand: string;
  lp: number;
}

export type FromWorker =
  | { type: 'progress'; file?: string; loaded: number; total: number; status: string }
  | { type: 'ready'; device: AsrDevice; loadMs: number; warmMs: number }
  | {
      type: 'result';
      id: number;
      /** Free-decoded transcript ('' when not run). */
      text: string;
      /** Top constrained candidates, best first (≤ 5), with total log-probs. */
      ranked: AsrScore[];
      /** Scores of mustScore candidates. */
      forced: AsrScore[];
      margin: number;
      /** Log-probs of `scoreTexts`, same order (reading apps). */
      textScores?: number[];
      /** Log-prob of the free transcript when `scoreFree` was set and it was decoded. */
      freeLp?: number;
      audioMs: number;
      encMs: number;
      scoreMs: number;
      freeMs: number;
      totalMs: number;
      /** Wall-clock (performance.timeOrigin-based, ms) when the worker received / started / finished the job. */
      recvAt?: number;
      startAt?: number;
      doneAt?: number;
    }
  | { type: 'error'; id?: number; phase: 'load' | 'recognize'; message: string };
