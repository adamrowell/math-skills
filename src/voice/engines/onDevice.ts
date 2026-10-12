/**
 * On-device engine (Moonshine / Whisper via transformers.js in a Web Worker).
 *
 * Mic → AudioWorklet VAD (16 kHz) → segment → worker (encoder + trie-constrained scoring of
 * the answer set) → decision → VoiceHypothesis.
 *
 * Decision rules (numbers), from the ASR benchmark (119/120 accepted, 0/120 false accepts):
 *   - commit the top candidate only when it beats the runner-up by ≥ acceptMargin
 *     (adaptive per child, 1.0 → 0.5);
 *   - report a *different* number with high confidence only when margin ≥ 3, otherwise with
 *     confidence 0.45 so the matcher turns a would-be 'wrong' into 'unclear';
 *   - when unsure, fall back to the free transcript only if it agrees with the top choice.
 */
import type {
  VoiceEngine,
  VoiceEngineKind,
  VoiceEngineStartOptions,
  VoiceHypothesis,
  VoiceLoadProgress,
  VoiceMode,
  VoiceStatus,
} from '../types';
import { MicCapture, voiceError } from '../audio/capture';
import { MODELS, type AsrDevice, type AsrModelKey, type AsrModelSpec, type FromWorker, type ToWorker } from './asrProtocol';
import { getAcceptMargin, noteScoredUtterance, resetScoredUtterances } from '../match/corrections';
import { parseNumbers } from '../match/numbers';
import { normalizeTranscript } from '../match/normalize';
import { VAD_PROFILES } from '../profiles';
import { decodeReadingSentence, decodeReadingWord } from './readingDecode';
import { LiveUtterance, SPEC, isExtendable, isRisky, specVerdict, type SpecResult } from './speculative';

/** Extra fields the on-device engine attaches to every hypothesis (diagnostics / tuning). */
export interface OnDeviceHypothesis extends VoiceHypothesis {
  /** Winning constrained candidate and its margin over the runner-up (log-prob). */
  top?: string;
  margin?: number;
  /** Log-prob of the winner (very low = probably not an answer at all). */
  topLp?: number;
  /** Free (unconstrained) transcript, when it was decoded. */
  freeText?: string;
  /** Pure model time in the worker, ms. */
  inferenceMs?: number;
  ranked?: { cand: string; lp: number }[];
  /** Latency breakdown (main-thread performance.now() ms): VAD end, worker receive/start/done, delivered. */
  trace?: Record<string, number>;
  /** Accepted before the endpoint from a speculative decode (engines/speculative.ts). */
  speculative?: boolean;
}

type WorkerResult = Extract<FromWorker, { type: 'result' }>;

/** Dev A/B: ?asrLegacy=1 decodes without the KV cache. */
const LEGACY_DECODE = (() => {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('asrLegacy') === '1';
  } catch {
    return false;
  }
})();

/** Speculative decoding on/off (dev A/B: ?voiceSpec=0). */
function speculationEnabled(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('voiceSpec') !== '0';
  } catch {
    return true;
  }
}

/**
 * Non-answers scored alongside the numbers ("null hypotheses"). When one of them wins, the
 * child said something that is not a number (or nothing): unclear, never a forced number.
 */
export const NUMBER_GARBAGE = ['Hmm', 'Um', 'Uh', "I don't know", 'What', 'Okay', 'Yes', 'No', 'Wait'];
/** Safety net only: a winner this improbable is a forced fit of noise. */
export const MIN_TOP_LP = -40;
/** A different number is reported confidently (can become 'wrong') only above this margin. */
export const WRONG_MARGIN = 3;
export const WORD_ACCEPT_MARGIN = 1.0;
/**
 * Teen / -ty look-alikes ("sixteen" ↔ "sixty" ↔ "six", "nineteen" ↔ "ninety" ↔ "nine"): the
 * winner must beat its own look-alikes by at least this much to count. Below it the answer is
 * 'unclear' (the child says it again), never accepted, never called wrong. Adversarial TTS sweep:
 * teen/-ty mix-ups won by 0.02–1.97; ~10% of genuine look-alike answers fall below it.
 */
export const PARTNER_MARGIN = 2.0;

/** Numbers a child's "6" is easily confused with, and back: 6 ↔ 16 ↔ 60 (also 106 ↔ 116 ↔ 160). */
export function teenTyPartners(n: number): number[] {
  const h = n - (n % 100);
  const r = n % 100;
  if (r >= 3 && r <= 9) return [h + r + 10, h + r * 10];
  if (r >= 13 && r <= 19) return [h + r - 10, h + (r - 10) * 10];
  if (r >= 30 && r <= 90 && r % 10 === 0) return [h + r / 10, h + r / 10 + 10];
  return [];
}

/** How far `top` is above its best-scoring teen / -ty look-alike (Infinity when none scored close). */
export function partnerMargin(ranked: { cand: string; lp: number }[]): number {
  const top = ranked[0];
  if (!top || !/^\d+$/.test(top.cand)) return Infinity;
  const ps = new Set(teenTyPartners(Number(top.cand)).map(String));
  let best = -Infinity;
  for (const x of ranked.slice(1)) if (ps.has(x.cand) && x.lp > best) best = x.lp;
  return top.lp - best;
}

/** Words that may come with a confirmed unit ("um … six", "it's six"). */
const AGREE_FILLERS = new Set(['um', 'umm', 'uh', 'er', 'erm', 'hmm', 'hm', 'mm', 'ah', 'oh', 'its', 'it', 'is', 'the', 'answer', 'i', 'think', 'so', 'okay', 'ok', 'well', 'like']);

/** The free transcript says exactly `cand` and nothing else ("Nine t", "Three, ten" do not). */
export function freeSaysOnly(free: string, cand: string): boolean {
  const nums = parseNumbers(free).candidates;
  if (nums.length !== 1 || String(nums[0]) !== cand) return false;
  return normalizeTranscript(free)
    .split(' ')
    .filter(Boolean)
    .every((w) => AGREE_FILLERS.has(w) || parseNumbers(w).candidates.length === 1);
}

/** An equation or self-correction around several numbers ("seven times eight is fifty six", "54 no 56"). */
const MULTI_NUMBER_CONTEXT = /\b(times|x|plus|minus|take away|divided|multiplied|is|equals|makes|no|not|wait|actually|i mean)\b/i;
/** Word mode: a different word must win by this much before the child hears "not quite". */
export const WORD_WRONG_MARGIN = 3;

let utteranceSeq = 1000;

function canUseWorkers(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
}

/**
 * Where public/ort/ is served. Built app: chunks live in <app>/assets/, so '../ort/' relative
 * to this module is right at any deploy path (GitHub Pages /<repo>/, subfolders) and for any
 * page. Dev server: '<BASE_URL>ort/' from the origin.
 */
export function ortWasmBase(): string {
  try {
    if (import.meta.env?.DEV) {
      const base = (import.meta.env.BASE_URL as string | undefined) ?? '/';
      return new URL(`${base.startsWith('/') ? base : '/'}`.replace(/\/?$/, '/') + 'ort/', location.origin).href;
    }
    return new URL(/* @vite-ignore */ '../ort/', import.meta.url).href;
  } catch {
    return new URL('ort/', document.baseURI).href;
  }
}

/**
 * How long one finished utterance may take to decode before watchdog W1 drops it. Numbers: 2 s
 * (the measured p99 is ~0.4 s); words: 3 s (two decode passes). Sentences decode several passes over a
 * longer clip, so they get 2 s plus half the speech length, capped at 4 s.
 */
export function inferenceBudgetMs(mode: VoiceMode, speechMs: number): number {
  if (mode === 'number') return 2000;
  // Reading words may take a second, pitch-lowered pass; the panel still says "say it again"
  // at 2 s (UI watchdog) and a late accept simply wins.
  if (mode === 'word') return 3000;
  return Math.min(4000, 2000 + Math.max(0, speechMs) * 0.5);
}

/** Test hook: `window.__asrTestStallMs = 2500` delays every decode (watchdog e2e). */
function testStallMs(): number {
  const v = (globalThis as { __asrTestStallMs?: unknown }).__asrTestStallMs;
  return typeof v === 'number' && v > 0 ? v : 0;
}

export class OnDeviceEngine implements VoiceEngine {
  readonly kind: VoiceEngineKind;
  private spec: AsrModelSpec;
  private device: AsrDevice;
  private worker: Worker | null = null;
  private loadPromise: Promise<void> | null = null;
  private ready = false;
  private _status: VoiceStatus = 'off';
  private capture = new MicCapture();
  private opts: VoiceEngineStartOptions | null = null;
  private pending = new Map<number, { resolve: (r: Extract<FromWorker, { type: 'result' }>) => void; reject: (e: Error) => void }>();
  private reqId = 0;
  private busy = false;
  private queue: { audio: Float32Array; speechMs: number; endedAt: number; epoch: number; trace: Record<string, number>; live: LiveUtterance | null }[] = [];
  /** Worker jobs in flight (final + speculative); speculative jobs only start when it is 0. */
  private inflight = 0;
  /** The utterance being spoken (number mode, streamed by the worklet). */
  private live: LiveUtterance | null = null;
  private readonly speculate = speculationEnabled();
  /**
   * Question epoch (bumped when the bias/expected answer changes). A segment is stamped with
   * the epoch current when its speech STARTED; segments spoken for an earlier question are
   * dropped instead of being scored against the next one.
   */
  private epoch = 0;
  private speechEpoch: number | null = null;
  private biasKey = '';
  private progressFiles = new Map<string, { loaded: number; total: number }>();
  private onProgress: ((p: VoiceLoadProgress) => void) | null = null;
  /** Ordered list of candidates for number mode, rebuilt when the plausible range changes. */
  private numberCands: string[] = [];
  private numberMax = -1;
  backend: AsrDevice | null = null;
  lastLoadMs = 0;
  lastWarmMs = 0;

  constructor(kind: 'moonshine' | 'whisper', modelKey?: AsrModelKey, device: AsrDevice = 'wasm') {
    this.kind = kind;
    this.spec = MODELS[modelKey ?? (kind === 'moonshine' ? 'moonshine-base' : 'whisper-tiny.en')];
    // Dev A/B: ?asrDtype=fp32|fp16|q4 (e.g. to compare WebGPU precisions).
    try {
      const dt = new URLSearchParams(globalThis.location?.search ?? '').get('asrDtype');
      if (dt === 'fp32' || dt === 'fp16' || dt === 'q4' || dt === 'q8') this.spec = { ...this.spec, dtype: dt };
    } catch {
      /* non-DOM */
    }
    this.device = device;
  }

  get status(): VoiceStatus {
    return this._status;
  }

  private session = 0;

  get isReady(): boolean {
    return this.ready;
  }

  get modelId(): string {
    return this.spec.id;
  }

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.isSecureContext !== false &&
      canUseWorkers() &&
      typeof AudioWorkletNode !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    );
  }

  private setStatus(s: VoiceStatus): void {
    this._status = s;
    this.opts?.onStatus(s);
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('./asr.worker.ts', import.meta.url), { type: 'module', name: 'asr' });
    w.onmessage = (e: MessageEvent<FromWorker>) => this.onWorkerMessage(e.data);
    w.onerror = (e) => {
      const err = new Error(e.message || 'ASR worker crashed');
      this.failAll(err);
      this.worker = null;
      this.ready = false;
      this.loadPromise = null;
    };
    this.worker = w;
    return w;
  }

  private loadResolve: (() => void) | null = null;
  private loadReject: ((e: Error) => void) | null = null;

  load(onProgress?: (p: VoiceLoadProgress) => void): Promise<void> {
    if (onProgress) this.onProgress = onProgress;
    if (this.ready) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;
    if (!canUseWorkers()) return Promise.reject(voiceError('unsupported', 'On-device voice is not supported here', false));
    this.progressFiles.clear();
    this.emitProgress('download');
    this.loadPromise = new Promise<void>((resolve, reject) => {
      this.loadResolve = resolve;
      this.loadReject = reject;
      const msg: ToWorker = { type: 'load', model: this.spec, device: this.device, wasmBase: this.device === 'wasm' ? ortWasmBase() : null };
      this.ensureWorker().postMessage(msg);
    });
    this.loadPromise.catch(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  /** W5: give up on a stalled download (a fresh worker is made by the next load()). */
  abortLoad(message: string): void {
    const reject = this.loadReject;
    if (!reject) return;
    this.loadResolve = this.loadReject = null;
    this.worker?.terminate();
    this.worker = null;
    this.loadPromise = null;
    reject(Object.assign(new Error(message), voiceError('load-failed', message, true), { stalled: true }));
  }

  private emitProgress(phase: VoiceLoadProgress['phase'], file?: string): void {
    let loaded = 0;
    let total = 0;
    for (const f of this.progressFiles.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    const denom = Math.max(total, this.spec.approxBytes);
    const dl = denom ? Math.min(1, loaded / denom) : 0;
    const fraction = phase === 'done' ? 1 : phase === 'warmup' ? 0.97 : phase === 'init' ? 0.92 : dl * 0.9;
    this.onProgress?.({ engine: this.kind, phase, file, loaded, total: denom, fraction });
  }

  private onWorkerMessage(m: FromWorker): void {
    switch (m.type) {
      case 'progress': {
        if (m.file) {
          const prev = this.progressFiles.get(m.file) ?? { loaded: 0, total: 0 };
          const total = m.total || prev.total;
          const loaded = m.status === 'done' ? Math.max(prev.loaded, total) : m.loaded || prev.loaded;
          this.progressFiles.set(m.file, { loaded, total });
        }
        const all = [...this.progressFiles.values()];
        const doneDl = all.length > 0 && all.every((f) => f.total > 0 && f.loaded >= f.total) && all.length >= 3;
        this.emitProgress(doneDl ? 'init' : 'download', m.file);
        break;
      }
      case 'ready':
        this.ready = true;
        this.backend = m.device;
        this.lastLoadMs = m.loadMs;
        this.lastWarmMs = m.warmMs;
        this.emitProgress('done');
        this.loadResolve?.();
        this.loadResolve = this.loadReject = null;
        break;
      case 'result': {
        const p = this.pending.get(m.id);
        if (p) {
          this.pending.delete(m.id);
          p.resolve(m);
        }
        break;
      }
      case 'error':
        if (m.phase === 'load') {
          this.loadReject?.(Object.assign(new Error(m.message), voiceError('load-failed', `Voice model failed to load: ${m.message}`, true)));
          this.loadResolve = this.loadReject = null;
          // A fresh worker for the next attempt.
          this.worker?.terminate();
          this.worker = null;
        } else if (m.id !== undefined) {
          const p = this.pending.get(m.id);
          if (p) {
            this.pending.delete(m.id);
            p.reject(new Error(m.message));
          }
        }
        break;
    }
  }

  private failAll(err: Error): void {
    this.pending.forEach((p) => p.reject(err));
    this.pending.clear();
    this.loadReject?.(Object.assign(err, voiceError('load-failed', err.message, true)));
    this.loadResolve = this.loadReject = null;
  }

  /** Run one clip through the worker (also used by the dev lab / tests without a mic). */
  async recognizeClip(
    audio: Float32Array,
    req: Omit<Extract<ToWorker, { type: 'recognize' }>, 'type' | 'id' | 'audio'>,
    onId?: (id: number) => void,
  ): Promise<Extract<FromWorker, { type: 'result' }>> {
    await this.load();
    const id = ++this.reqId;
    onId?.(id);
    const w = this.ensureWorker();
    this.inflight++;
    const p = new Promise<WorkerResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: ToWorker = { type: 'recognize', id, audio, ...req, ...(LEGACY_DECODE ? { legacyDecode: true } : {}) };
      w.postMessage(msg, [audio.buffer]);
    });
    const done = () => {
      this.inflight = Math.max(0, this.inflight - 1);
      // The worker is free: a speculative decode may be waiting for it.
      queueMicrotask(() => this.kickSpec());
    };
    p.then(done, done);
    return p;
  }

  private noteBias(opts: VoiceEngineStartOptions): void {
    let k = '';
    try {
      k = JSON.stringify(opts.bias ?? null);
    } catch {
      /* ignore */
    }
    if (k !== this.biasKey) {
      this.biasKey = k;
      this.epoch++;
      // The question changed: a speculative decode of the old answer is wasted work.
      this.cancelSpec(this.live);
      resetScoredUtterances();
    }
  }

  async start(opts: VoiceEngineStartOptions): Promise<void> {
    this.noteBias(opts);
    this.opts = opts;
    // update() swaps `opts` on every question (bias changes) while the model may still be
    // loading, so "stopped meanwhile" is tracked with a session token, not opts identity.
    const session = ++this.session;
    const profile = VAD_PROFILES[opts.mode];
    // Capture first: getUserMedia must be called inside the user's tap.
    const cap = this.capture.start(
      {
        onLevel: (rms) => this.opts?.onLevel?.(rms),
        onSpeechStart: () => {
          this.speechEpoch = this.epoch;
          this.live = this.speculate && this.opts?.mode === 'number' ? new LiveUtterance(++utteranceSeq, this.epoch) : null;
          // "six", "fifty", "one hundred eight" are never accepted early (engines/speculative.ts):
          // decode once the audio is the endpoint segment itself, so the endpoint can reuse it.
          const exp = this.opts?.bias?.numbers?.[0];
          if (this.live && typeof exp === 'number' && isRisky(exp, this.numberCandidates(this.opts?.bias?.numbers))) {
            this.live.needSnapQuiet = SPEC.segmentQuietFrames;
          }
          if (!this.busy) this.setStatus('hearing');
        },
        onChunk: (audio, flags, from) => this.onChunk(audio, flags, from),
        onSpeechEnd: () => {
          if (!this.live?.accepted) this.setStatus('processing');
        },
        onSegment: (audio, info) => {
          const epoch = this.speechEpoch ?? this.epoch;
          this.speechEpoch = null;
          const live = this.live;
          this.live = null;
          if (live) live.ended = true;
          // Wall-clock length (pauses count): "seven times eight is fifty six" is long even
          // though its voiced frames add up to less than SPEC.maxSpeechMs.
          const speechMs = Math.max(info.speechMs, info.spanMs ?? 0);
          if (live?.accepted) {
            // Already accepted before the endpoint: the rest of the utterance is silence.
            if (!this.busy && this.opts) this.setStatus('listening');
            return;
          }
          this.enqueue(audio, speechMs, info.endedAt, epoch, { vadEnd: info.endedAt, endMsg: info.endMsgAt, seg: performance.now() }, live);
        },
        onDrop: () => {
          this.speechEpoch = null;
          this.cancelSpec(this.live);
          this.live = null;
          if (!this.busy) this.setStatus('listening');
        },
        onEnded: () => {
          // iOS ends the mic track when the app is backgrounded: release quietly and let
          // the manager re-arm it on return. A track ending in the foreground is an error.
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            this.capture.stop();
            return;
          }
          this.opts?.onError(voiceError('no-mic', 'The microphone stopped', true));
          this.stop();
        },
      },
      profile,
    );
    this.capture.setStreaming(this.speculate && opts.mode === 'number');
    if (!this.ready) {
      this.setStatus('loading');
      await Promise.all([cap, this.load()]);
    } else {
      this.setStatus('loading');
      await cap;
    }
    if (this.session !== session || !this.opts) return; // stopped (or restarted) meanwhile
    // Honesty rule (docs/UX-V3.md §4.2): "listening" only once audio frames actually arrive.
    if (!(await this.capture.waitForAudio(1500))) {
      this.capture.resume();
      if (!(await this.capture.waitForAudio(2000))) {
        if (this.session !== session || !this.opts) return;
        const err = voiceError('audio-failed', 'The microphone is not sending any sound', true);
        this.stop();
        throw err;
      }
    }
    if (this.session !== session || !this.opts) return;
    this.setStatus('listening');
  }

  /** Mode / bias changed while listening (next question, other app). */
  update(opts: VoiceEngineStartOptions): void {
    const modeChanged = !this.opts || this.opts.mode !== opts.mode;
    this.noteBias(opts);
    this.opts = opts;
    if (modeChanged) {
      this.capture.setStreaming(this.speculate && opts.mode === 'number');
      this.capture.configure(VAD_PROFILES[opts.mode]);
    }
  }

  /** Ignore speech starts for `ms` (sound effects). */
  suppress(ms: number): void {
    this.capture.suppress(ms);
  }

  resumeAudio(): void {
    this.capture.resume();
  }

  get capturing(): boolean {
    return this.capture.active;
  }

  stop(): void {
    this.session++;
    this.opts = null;
    this.queue = [];
    this.cancelSpec(this.live);
    this.live = null;
    this.capture.stop();
    this._status = this.ready ? 'ready' : 'off';
  }

  dispose(): void {
    this.stop();
    if (this.worker) {
      this.worker.postMessage({ type: 'dispose' } satisfies ToWorker);
      const w = this.worker;
      setTimeout(() => w.terminate(), 500);
    }
    this.worker = null;
    this.ready = false;
    this.loadPromise = null;
    this._status = 'off';
  }

  // -------------------------------------------------------------------------
  private enqueue(
    audio: Float32Array,
    speechMs: number,
    endedAt: number,
    epoch: number,
    trace: Record<string, number> = {},
    live: LiveUtterance | null = null,
  ): void {
    if (epoch !== this.epoch) {
      // Started under an earlier question: not an answer to this one.
      if (!this.busy && this.opts) this.setStatus('listening');
      return;
    }
    // Keep at most one waiting segment: a kid who repeats himself wants the latest.
    this.queue = [...this.queue.slice(-1), { audio, speechMs, endedAt, epoch, trace, live }];
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.busy) return;
    let next = this.queue.shift();
    while (next && next.epoch !== this.epoch) next = this.queue.shift();
    if (!next) {
      if (this.opts) this.setStatus('listening');
      return;
    }
    const opts = this.opts;
    if (!opts) return;
    this.busy = true;
    this.setStatus('processing');
    // Watchdog W1 (docs/UX-V3.md §4.3): never sit in "thinking". A stalled or failed decode
    // drops the segment, cancels the worker job and goes back to listening ("say it again").
    const ids: number[] = [];
    const budget = inferenceBudgetMs(opts.mode, next.speechMs);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stall = new Promise<'stall'>((resolve) => {
      timer = setTimeout(() => resolve('stall'), budget);
    });
    try {
      const testStall = testStallMs();
      let dead = false;
      const work = (async () => {
        if (testStall) await new Promise((r) => setTimeout(r, testStall));
        if (dead) throw new Error('timeout');
        return this.recognizeForMode(next.audio, next.speechMs, next.endedAt, opts, next.trace, next.live, (id) => {
          ids.push(id);
          // Started after the watchdog fired: drop it straight away.
          if (dead) queueMicrotask(() => this.dropJobs([id], null));
        });
      })();
      work.catch(() => {});
      const hyp = await Promise.race([work, stall]);
      if (hyp === 'stall') {
        dead = true;
        this.dropJobs(ids, next.live);
        if (this.opts === opts) opts.onTimeout?.('stall');
      } else {
        if (hyp.trace) hyp.trace.emit = performance.now();
        if (this.opts === opts && next.epoch === this.epoch && hyp) opts.onHypothesis(hyp);
      }
    } catch (e) {
      // A failed decode is a "say it again", not a broken mic.
      console.warn('voice: recognition failed', (e as Error)?.message);
      if (this.opts === opts) opts.onTimeout?.('failed');
    } finally {
      if (timer) clearTimeout(timer);
      this.busy = false;
      if (this.opts) this.setStatus(this.queue.length ? 'processing' : 'listening');
      if (this.queue.length) void this.pump();
    }
  }

  /** Forget (and ask the worker to skip) jobs whose answer is no longer wanted. */
  private dropJobs(ids: number[], live: LiveUtterance | null): void {
    this.cancelSpec(live);
    const drop = ids.filter((id) => this.pending.has(id));
    for (const id of drop) {
      const p = this.pending.get(id);
      this.pending.delete(id);
      p?.reject(new Error('timeout'));
    }
    if (drop.length && this.worker) this.worker.postMessage({ type: 'cancel', ids: drop } satisfies ToWorker);
  }

  private numberCandidates(bias?: number[]): string[] {
    const maxBias = Math.max(0, ...(bias ?? []).filter((n) => Number.isFinite(n) && n >= 0));
    const max = Math.min(999, Math.max(144, maxBias <= 200 ? Math.max(maxBias, 144) : maxBias + 20));
    if (max !== this.numberMax) {
      this.numberMax = max;
      this.numberCands = [...Array.from({ length: max + 1 }, (_, i) => String(i)), ...NUMBER_GARBAGE];
    }
    return this.numberCands;
  }

  // -------------------------------------------------------------------------
  // Speculative decoding (engines/speculative.ts)
  // -------------------------------------------------------------------------
  private onChunk(audio: Float32Array, flags: Uint8Array, from: number): void {
    const u = this.live;
    if (!u || !this.opts || this.opts.mode !== 'number') return;
    if (!u.append(audio, flags, from)) {
      this.live = null;
      return;
    }
    u.lastChunkAt = performance.now();
    if (u.accepted || u.epoch !== this.epoch) return;
    // The child went on after the snapshot being decoded: that result is stale, free the worker.
    if (u.inflight && !u.covers(u.inflight.snapFrames)) this.cancelSpec(u);
    this.checkSpec(u);
    if (u.accepted) return;
    if (u.voiced >= SPEC.minVoicedFrames && u.quietFrames >= Math.max(SPEC.triggerQuietFrames, u.needSnapQuiet)) {
      // Quiet onset: decode what was said unless a decode already covers it (and holds the
      // silence `needSnapQuiet` asks for, once that much silence exists).
      const covered = (u.spec && u.satisfies(u.spec.snapFrames)) || (u.inflight && u.satisfies(u.inflight.snapFrames));
      // Bounded work: long utterances can never be accepted early, intermittent noise must not
      // keep the worker busy, and a re-decode needs new speech (or the silence it lacked).
      const worth =
        u.jobs < SPEC.maxJobs &&
        u.spanMs <= SPEC.maxSpeechMs &&
        (u.jobs === 0 || u.voiced - u.snapVoiced >= SPEC.minNewVoiced || u.snapQuiet < u.needSnapQuiet);
      if (!covered && worth) {
        u.wantSnap = u.nFrames;
        this.kickSpec();
      }
    }
  }

  /** Abandon the utterance's in-flight speculative decode (the worker drops it at its next step). */
  private cancelSpec(u: LiveUtterance | null): void {
    const f = u?.inflight;
    if (!u || !f) return;
    u.inflight = null;
    if (f.id !== undefined && this.worker) this.worker.postMessage({ type: 'cancel', ids: [f.id] } satisfies ToWorker);
  }

  /** Start the wanted speculative decode if the worker is idle (never queue behind another job). */
  private kickSpec(): void {
    const u = this.live;
    const opts = this.opts;
    if (!u || !opts || !u.wantSnap || u.accepted || u.ended || this.inflight > 0 || !this.ready) return;
    if (u.epoch !== this.epoch || opts.mode !== 'number') return;
    u.wantSnap = 0;
    // Everything said so far plus ≤ 200 ms of the silence after it.
    const snapFrames = Math.min(u.nFrames, u.lastVoiced + 1 + 20);
    if (u.spec && u.spec.snapFrames >= snapFrames) return;
    const cands = this.numberCandidates(opts.bias?.numbers);
    const must = (opts.bias?.numbers ?? []).map((n) => String(n)).filter((c) => cands.includes(c));
    const sentAt = performance.now();
    u.jobs++;
    u.snapVoiced = u.voiced;
    u.snapQuiet = u.quietIn(snapFrames);
    const job: { snapFrames: number; p: Promise<SpecResult | null>; id?: number } = { snapFrames, p: Promise.resolve(null) };
    const p = this.recognizeClip(u.snapshot(snapFrames), { candidates: cands, mustScore: must, freeDecode: 'never' }, (id) => (job.id = id)).then(
      (r): SpecResult => {
        const res: SpecResult = { snapFrames, ranked: r.ranked, margin: r.margin, raw: r, doneAt: performance.now(), sentAt };
        if (!u.spec || u.spec.snapFrames <= snapFrames) u.spec = res;
        if (u.inflight === job) u.inflight = null;
        // A result whose top could still grow ("six" → "sixteen") is only reusable as the
        // endpoint segment: ask for that decode (it starts at 200 ms of quiet).
        const top = r.ranked[0]?.cand;
        if (top && /^\d+$/.test(top) && isRisky(Number(top), cands)) u.needSnapQuiet = SPEC.segmentQuietFrames;
        this.checkSpec(u);
        return res;
      },
      () => {
        if (u.inflight === job) u.inflight = null;
        return null;
      },
    );
    job.p = p;
    u.inflight = job;
  }

  /** Accept the expected answer from the latest speculative result when it is safe (specVerdict). */
  private checkSpec(u: LiveUtterance): void {
    const opts = this.opts;
    const sr = u.spec;
    if (!sr || !opts || u.accepted || u.ended || u.epoch !== this.epoch || opts.mode !== 'number') return;
    const cands = this.numberCandidates(opts.bias?.numbers);
    const must = (opts.bias?.numbers ?? []).map((n) => String(n)).filter((c) => cands.includes(c));
    const top = sr.ranked[0];
    if (!top || !must.includes(top.cand)) return;
    const thr = getAcceptMargin();
    const v = specVerdict(sr, top.cand, cands, {
      acceptMargin: thr,
      minTopLp: MIN_TOP_LP,
      quietMs: u.quietFrames * 10,
      voicedAfter: u.voicedAfter(sr.snapFrames),
      speechMs: u.spanMs,
    });
    if (v.kind !== 'accept') return;
    // The same decision rules as at the endpoint (teen / -ty look-alikes) must agree.
    if (partnerMargin(sr.ranked) < PARTNER_MARGIN) return;
    u.accepted = true;
    const now = performance.now();
    // Speech end ≈ the last voiced frame: the last chunk minus the quiet frames after it.
    const speechEnd = (u.lastChunkAt || now) - u.quietFrames * 10;
    const r = sr.raw as WorkerResult;
    const trace: Record<string, number> = { sent: sr.sentAt ?? now, specJobs: u.jobs, specAudioMs: sr.snapFrames * 10 };
    this.traceResult(trace, r);
    const base = { isFinal: true as const, engine: this.kind, durationMs: u.nFrames * 10, utteranceId: u.id };
    const hyp = this.decideNumber(r, must, thr, base, Math.round(now - speechEnd), trace);
    hyp.speculative = true;
    trace.emit = performance.now();
    this.setStatus('listening');
    opts.onHypothesis(hyp);
  }

  private needsFree(r: WorkerResult, thr: number, speechMs: number): boolean {
    const top = r.ranked[0];
    return !top || r.margin < thr || NUMBER_GARBAGE.includes(top.cand) || speechMs > SPEC.maxSpeechMs;
  }

  private traceResult(trace: Record<string, number>, r: WorkerResult): void {
    trace.recv = performance.now();
    const o = performance.timeOrigin;
    if (r.recvAt) trace.wRecv = r.recvAt - o;
    if (r.startAt) trace.wStart = r.startAt - o;
    if (r.doneAt) trace.wDone = r.doneAt - o;
    trace.enc = r.encMs;
    trace.score = r.scoreMs;
    trace.free = r.freeMs;
  }

  /** Number decision rules (see the file header). */
  private decideNumber(
    r: WorkerResult,
    must: string[],
    thr: number,
    base: { isFinal: true; engine: VoiceEngineKind; durationMs: number; utteranceId: number },
    latencyMs: number,
    trace?: Record<string, number>,
    /** Accept the expected answer only when the free transcript says exactly it too. */
    needFreeAgreement = false,
  ): OnDeviceHypothesis {
    const top = r.ranked[0];
    const free = r.text;
    const freeNums = free ? parseNumbers(free).candidates : [];
    let text = '';
    let confidence = 0.3;
    const pm = partnerMargin(r.ranked);
    if (freeNums.length >= 2) {
      // "seven times eight is fifty six" — a single-number trie cannot represent it. Only an
      // equation / self-correction, or a transcript ending on the scorer's own pick, though:
      // "One thumb through the eighteen" (said 118) must not count as 18.
      const last = String(freeNums[freeNums.length - 1]);
      // A two-burst unit ("three … tee" → "Three, three.") is never settled by several numbers.
      if (!needFreeAgreement && (MULTI_NUMBER_CONTEXT.test(free) || (top && top.cand === last && pm >= PARTNER_MARGIN))) {
        text = free;
        confidence = 0.6;
      }
    } else if (top && NUMBER_GARBAGE.includes(top.cand)) {
      // "Um, fifty six": the trie cannot spell a filler + number, the free decode can.
      // Low confidence: it may confirm the expected answer but never asserts 'wrong'.
      text = free;
      confidence = 0.3;
    } else if (top && pm < PARTNER_MARGIN) {
      // "sixteen" vs "sixty" too close to call: unclear (never accepted, never 'wrong'), and the
      // free transcript cannot settle it either (it mishears the same way).
      text = '';
      confidence = 0.3;
    } else if (top && r.margin >= thr && top.lp >= MIN_TOP_LP) {
      text = top.cand;
      const isExpected = must.includes(top.cand);
      confidence = isExpected ? 0.95 : r.margin >= WRONG_MARGIN && top.lp >= MIN_TOP_LP / 2 ? 0.9 : 0.45;
      if (isExpected && needFreeAgreement && !freeSaysOnly(free, top.cand)) {
        // "three … teen": the trie can only spell "three"; the free transcript did not confirm it.
        text = '';
        confidence = 0.3;
      }
    } else if (free && needFreeAgreement) {
      text = '';
    } else if (free) {
      const p = freeNums.length === 1 ? freeNums[0] : null;
      // Only pass the free transcript on when it does not contradict the scorer.
      text = p === null || (top && String(p) === top.cand) ? free : '';
      confidence = 0.3;
    }
    if (top) noteScoredUtterance(text, top.cand, r.margin, must[0]);
    return {
      ...base,
      text,
      confidence,
      latencyMs,
      top: top?.cand,
      margin: r.margin,
      topLp: top?.lp,
      freeText: free,
      inferenceMs: Math.round(r.totalMs),
      ranked: r.ranked,
      trace,
    };
  }

  /** Recognise one segment and turn the scores into a hypothesis per the decision rules. */
  async recognizeForMode(
    audio: Float32Array,
    speechMs: number,
    endedAt: number,
    opts: Pick<VoiceEngineStartOptions, 'mode' | 'bias'>,
    trace?: Record<string, number>,
    live?: LiveUtterance | null,
    onJob?: (id: number) => void,
  ): Promise<OnDeviceHypothesis> {
    const mode: VoiceMode = opts.mode;
    const durationMs = Math.round((audio.length / 16000) * 1000);
    const base = { isFinal: true as const, engine: this.kind, durationMs, utteranceId: live?.id ?? ++utteranceSeq };

    if (mode === 'number') {
      const cands = this.numberCandidates(opts.bias?.numbers);
      const must = (opts.bias?.numbers ?? []).map((n) => String(n)).filter((c) => cands.includes(c));
      const thr = getAcceptMargin();
      if (trace) trace.sent = performance.now();
      // A speculative decode that already covers all the speech is as good as a new one,
      // unless the decision needs the free transcript (unsure, filler, long utterance).
      let r: WorkerResult | null = null;
      // "six … teen", "three … tee": a unit that starts a teen word, said in two bursts. The
      // trie can only spell the unit, so the free transcript must confirm it ("um … six" does).
      const needFreeAgreement = !!live && must.some((c) => isExtendable(Number(c))) && live.islands(8) >= 2;
      if (live) {
        // A risky expected answer ("six", "fifty") or a risky heard one is only judged on the
        // endpoint segment itself (speech + 200 ms, nothing said after): a shorter decode may
        // have cut a soft "-teen" or a "… six" off.
        const expRisky = must.some((c) => isRisky(Number(c), cands));
        const reusable = (snap: number, top?: string) =>
          expRisky || (top !== undefined && /^\d+$/.test(top) && isRisky(Number(top), cands)) ? live.matchesSegment(snap) : live.covers(snap);
        if (live.inflight) {
          if (reusable(live.inflight.snapFrames) || (!expRisky && live.covers(live.inflight.snapFrames))) await live.inflight.p;
          else this.cancelSpec(live);
        }
        const sr = live.spec;
        if (sr && reusable(sr.snapFrames, sr.ranked[0]?.cand) && !this.needsFree(sr.raw as WorkerResult, thr, speechMs) && !(needFreeAgreement && sr.ranked[0] && must.includes(sr.ranked[0].cand))) {
          r = sr.raw as WorkerResult;
          if (trace) trace.reused = 1;
        }
      }
      if (!r) {
        r = await this.recognizeClip(
          audio,
          {
          candidates: cands,
          mustScore: must,
          freeDecode: speechMs > SPEC.maxSpeechMs || needFreeAgreement ? 'always' : 'if-unsure',
          unsureMargin: thr,
          freeIfTop: NUMBER_GARBAGE,
          },
          onJob,
        );
      }
      const latencyMs = Math.round(performance.now() - endedAt);
      if (trace) this.traceResult(trace, r);
      return this.decideNumber(r, must, thr, base, latencyMs, trace, needFreeAgreement);
    }

    if (mode === 'word' && opts.bias?.words?.length) {
      // Reading apps: score the target against sound-alike words, fillers and the free
      // transcript (engines/readingDecode.ts).
      return decodeReadingWord((a, req) => this.recognizeClip(a, req, onJob), audio, opts.bias.words, base, endedAt);
    }

    if (mode === 'sentence' && opts.bias?.words?.length) {
      return decodeReadingSentence((a, req) => this.recognizeClip(a, req, onJob), audio, opts.bias.words.join(' '), base, endedAt);
    }

    // Free transcription (sentences, or words without a target).
    const r = await this.recognizeClip(audio, { freeDecode: 'always', longForm: mode === 'sentence' }, onJob);
    const latencyMs = Math.round(performance.now() - endedAt);
    if (!r.text) return { ...base, text: '', latencyMs, inferenceMs: Math.round(r.totalMs) };
    return { ...base, text: r.text, latencyMs, freeText: r.text, inferenceMs: Math.round(r.totalMs) };
  }
}
