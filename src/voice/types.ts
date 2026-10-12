/**
 * Voice engine contract (frozen — see docs/DESIGN.md §3.3 / §3.4).
 *
 * Consumers (drill, reading apps, hub) import ONLY from `src/voice/index.ts`.
 * The voice builder implements these types; other builders code against them.
 */

// ---------------------------------------------------------------------------
// Engines & status
// ---------------------------------------------------------------------------

/** Which recognizer produced a result / is selected. */
export type VoiceEngineKind = 'webspeech' | 'moonshine' | 'whisper';

/** `'auto'` = moonshine → whisper → webspeech, with webspeech bridging while a model loads. */
export type VoiceEnginePreference = VoiceEngineKind | 'auto';

export type VoiceStatus =
  | 'off' // not started (or stopped)
  | 'loading' // downloading / initialising / warming an on-device model
  | 'ready' // model loaded, mic not open
  | 'listening' // mic open, waiting for speech
  | 'hearing' // speech detected, accumulating
  | 'processing' // running inference on a finished segment
  | 'error';

/** What the recognizer is tuned for; affects VAD timing and normalisation. */
export type VoiceMode = 'number' | 'word' | 'sentence';

export interface VoiceLoadProgress {
  engine: VoiceEngineKind;
  phase: 'download' | 'init' | 'warmup' | 'done';
  /** Current file being fetched (on-device engines). */
  file?: string;
  loaded: number;
  total: number;
  /** 0..1 overall estimate across all files/phases. */
  fraction: number;
}

export type VoiceErrorCode =
  | 'unsupported' // no engine can run here
  | 'insecure-context' // http:// on a non-localhost origin — mic unavailable
  | 'permission-denied'
  | 'no-mic'
  | 'load-failed' // model download / init failed
  | 'audio-failed' // AudioContext / worklet failure
  | 'inference-failed'
  | 'aborted' // stopped while starting (navigated away during the permission prompt): not a failure
  | 'unknown';

export interface VoiceError {
  code: VoiceErrorCode;
  message: string;
  engine?: VoiceEngineKind;
  /** true → UI may offer "Tap to retry"; false → hide the mic. */
  recoverable: boolean;
}

export interface VoiceCapabilities {
  secureContext: boolean;
  webspeech: boolean;
  /** WASM/WebGPU on-device inference possible (worker + WebAssembly available). */
  onDevice: boolean;
  webgpu: boolean;
  audioWorklet: boolean;
}

// ---------------------------------------------------------------------------
// Hypotheses
// ---------------------------------------------------------------------------

export interface VoiceHypothesis {
  /** Raw recognizer text (not normalised). */
  text: string;
  /** Interim results (Web Speech only) are false; on-device engines emit finals only. */
  isFinal: boolean;
  /** 0..1 when the engine provides one (Web Speech). Undefined for on-device engines. */
  confidence?: number;
  engine: VoiceEngineKind;
  /** Length of the speech segment, ms (on-device). */
  durationMs?: number;
  /** End of speech → hypothesis delivered, ms. */
  latencyMs?: number;
  /** Other alternatives (Web Speech `maxAlternatives`), best first, excluding `text`. */
  alternatives?: string[];
  /** Monotonic id of the utterance; interim + final of the same utterance share it. */
  utteranceId: number;
  /**
   * Reading (on-device): not accepted, and the closest competitor differs from the target only
   * in its vowel (said/sad, bed/bad, pen/pan). The consumer says "Almost — say it again".
   */
  almost?: string;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseVoiceInputOptions {
  /** When false the hook releases the mic and ignores results. */
  enabled: boolean;
  mode: VoiceMode;
  onTranscript: (hyp: VoiceHypothesis) => void;
  /** Overrides the persisted preference for this consumer. */
  preferredEngine?: VoiceEnginePreference;
  /** Mic level 0..1 at ~20 Hz for a meter. */
  onLevel?: (rms: number) => void;
  /** Optional bias hints (Web Speech grammars / decoder prompt). Engines may ignore. */
  bias?: { numbers?: number[]; words?: string[] };
  onError?: (err: VoiceError) => void;
  onStatus?: (status: VoiceStatus) => void;
}

export interface UseVoiceInputResult {
  status: VoiceStatus;
  /** Engine currently producing results (may differ from preference while loading). */
  engine: VoiceEngineKind | null;
  error: VoiceError | null;
  loadProgress: VoiceLoadProgress | null;
  /** Latest mic level 0..1 (also delivered via onLevel). */
  level: number;
  isSupported: boolean;
  capabilities: VoiceCapabilities;
  /**
   * Open the mic and start recognising. MUST be called synchronously inside a user
   * gesture handler the first time (Safari). Resolves once listening (or rejects with VoiceError).
   */
  start: () => Promise<void>;
  /** Release the mic. Idempotent. */
  stop: () => void;
  /** Change engine preference (persisted). Takes effect on next start, or immediately if listening. */
  setEngine: (pref: VoiceEnginePreference) => void;
  /** Download + warm the preferred on-device model without opening the mic. Safe to call at idle. */
  preload: () => Promise<void>;
}

export type UseVoiceInput = (options: UseVoiceInputOptions) => UseVoiceInputResult;

// ---------------------------------------------------------------------------
// Imperative engine interface (internal to the voice module; exported for tests)
// ---------------------------------------------------------------------------

export interface VoiceEngineStartOptions {
  mode: VoiceMode;
  onHypothesis: (hyp: VoiceHypothesis) => void;
  onLevel?: (rms: number) => void;
  onStatus: (status: VoiceStatus) => void;
  onError: (err: VoiceError) => void;
  bias?: UseVoiceInputOptions['bias'];
  /**
   * Watchdog W1 (docs/UX-V3.md §4.3): a finished utterance produced nothing in time (inference
   * stalled / failed, or a Web Speech final never came). The segment was dropped and the engine
   * is listening again; the UI shows "say it again".
   */
  onTimeout?: (why: 'stall' | 'failed') => void;
}

export interface VoiceEngine {
  readonly kind: VoiceEngineKind;
  readonly status: VoiceStatus;
  /** Resolve capability without side effects. */
  isAvailable(): boolean;
  /** Download / init / warm up. No-op for webspeech. */
  load(onProgress?: (p: VoiceLoadProgress) => void): Promise<void>;
  start(opts: VoiceEngineStartOptions): Promise<void>;
  stop(): void;
  /** Free model memory. The engine must be re-`load`ed afterwards. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// VAD / audio tuning (per mode) — exported so tests and the diagnostics panel can show them
// ---------------------------------------------------------------------------

export interface VadProfile {
  /** Speech must exceed the threshold for this long to count as started. */
  minSpeechMs: number;
  /** Silence after speech that ends the utterance. */
  endSilenceMs: number;
  /** Hard cap on an utterance. */
  maxUtteranceMs: number;
  /** Audio kept before detected speech start. */
  preRollMs: number;
  /** Segments shorter than this are padded with silence before inference. */
  minSegmentMs: number;
}

export type VadProfiles = Record<VoiceMode, VadProfile>;

// ---------------------------------------------------------------------------
// Matchers (pure functions)
// ---------------------------------------------------------------------------

export type MatchVerdict = 'correct' | 'wrong' | 'unclear';

export interface NumberMatchOptions {
  expected: number;
  /** Numbers above this are treated as noise → 'unclear'. Default 1000. */
  maxPlausible?: number;
  /** The problem's operands, e.g. [7, 8]; an exact echo of them is 'unclear', not 'wrong'. */
  operands?: number[];
  /** Default false; negative candidates → 'unclear' unless allowed. */
  allowNegative?: boolean;
  /** Web Speech only: a 'wrong' verdict with confidence below this becomes 'unclear'. Default 0.5. */
  minConfidence?: number;
  confidence?: number;
}

export interface NumberMatchResult {
  verdict: MatchVerdict;
  /** The number judged (last candidate), when any was parsed. */
  heard?: number;
  /** All numbers parsed from the transcript, in order. */
  candidates: number[];
  /** Normalised transcript used for matching. */
  normalized: string;
  /**
   * True when `heard` is a spoken prefix of `expected` (said "fifty" of "fifty-six").
   * Verdict is 'unclear'; the caller should keep the text and prepend it to the next final.
   */
  partial?: boolean;
  /** Set when a learned alias produced the verdict. */
  viaAlias?: boolean;
  reason?: string;
}

export type MatchNumberAnswer = (transcript: string, options: NumberMatchOptions) => NumberMatchResult;

export interface WordMatchOptions {
  /** Accepted alternates / known mispronunciations from the word data. */
  alternates?: string[];
  /** Default true: homophones of the target are accepted. */
  allowHomophones?: boolean;
}

export interface WordMatchResult {
  verdict: MatchVerdict;
  /** The best-matching token heard. */
  heard?: string;
  /** 0..1 similarity of `heard` to the target (1 = exact or homophone). */
  similarity: number;
  normalized: string;
  /** 'unclear' because `heard` differs from the target only in its vowel (said/sad, bed/bad). */
  almost?: boolean;
}

export type MatchWord = (transcript: string, target: string, options?: WordMatchOptions | string[]) => WordMatchResult;

export type AlignedWordStatus = 'hit' | 'close' | 'miss';

export interface AlignedWord {
  word: string;
  status: AlignedWordStatus;
  heard?: string;
  similarity: number;
}

export interface SentenceAlignment {
  words: AlignedWord[];
  /** hits / words (close counts as 0.5). */
  hitRatio: number;
  /** hitRatio ≥ 0.9 */
  isComplete: boolean;
  /** Tokens heard that matched nothing (for diagnostics). */
  extra: string[];
}

export type AlignSentence = (transcript: string, words: string[]) => SentenceAlignment;

// ---------------------------------------------------------------------------
// Adaptation (learned aliases)
// ---------------------------------------------------------------------------

export interface CorrectionEntry {
  /** Normalised transcript text. */
  text: string;
  answer: number | string;
  count: number;
  firstAt: number;
  lastAt: number;
}

/** Record that an 'unclear' transcript was followed by the child typing/choosing `answer`. */
export type RecordCorrection = (transcript: string, answer: number | string) => void;

// ---------------------------------------------------------------------------
// Persisted preferences (key ms2:voice:prefs:v1)
// ---------------------------------------------------------------------------

export interface VoicePrefs {
  version: 1;
  engine: VoiceEnginePreference;
  /** Open the mic automatically when a round starts (the start tap is the gesture). */
  autoStart: boolean;
  /** Show the "heard …" bubble. */
  showHeard: boolean;
}

export interface VoiceDiagnosticsSample {
  ts: number;
  engine: VoiceEngineKind;
  text: string;
  latencyMs?: number;
  durationMs?: number;
  verdict?: MatchVerdict;
}
