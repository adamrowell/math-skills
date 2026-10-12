/**
 * Web Speech API engine (Chrome → Google servers, Safari → Siri/Dictation servers).
 * No download, so it bridges the first rounds while the on-device model loads, and is the
 * fallback where on-device inference cannot run.
 *
 * - interimResults + maxAlternatives 5; every alternative is passed along.
 * - Desktop: continuous mode. iOS/Safari: single-shot + auto-restart (continuous mode on iOS
 *   repeats and concatenates results).
 * - Auto-restart on 'end' while listening, with back-off; gives up (error) after repeated
 *   immediate failures so the UI can show "tap to retry" instead of spinning.
 * - start() calls recognition.start() synchronously — keep it inside the user's tap.
 */
import type { VoiceEngine, VoiceEngineStartOptions, VoiceLoadProgress, VoiceStatus } from '../types';
import { voiceError } from '../audio/capture';
import { getAudioContext } from '../../core/sound/audioContext';

/* Minimal typings for the (prefixed) Web Speech API. */
interface SRAlternative {
  transcript: string;
  confidence: number;
}
interface SRResult {
  readonly isFinal: boolean;
  readonly length: number;
  [i: number]: SRAlternative;
}
interface SREvent extends Event {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [i: number]: SRResult };
}
interface SRErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}
interface SR extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}
type SRCtor = new () => SR;

export function getSpeechRecognitionCtor(): SRCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isIOSLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome\/|Chromium\/|CriOS\/|Edg\//.test(ua);
}

let utteranceSeq = 1;

export class WebSpeechEngine implements VoiceEngine {
  readonly kind = 'webspeech' as const;
  private rec: SR | null = null;
  private opts: VoiceEngineStartOptions | null = null;
  private _status: VoiceStatus = 'off';
  private listening = false;
  private restarts: number[] = [];
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private currentId = utteranceSeq;
  private lastFinal = { text: '', at: 0 };
  private speechEndAt = 0;
  private fatal = false;
  /**
   * Question epoch: bumped whenever the bias (expected answer) changes. Each utterance is
   * stamped with the epoch of its first result; results of an utterance that began under an
   * older question are dropped, so a late final is never judged against the next question.
   */
  private epoch = 0;
  private uttEpoch: number | null = null;
  private lastResultAt = 0;
  private biasKey = '';
  /** Honesty rule: audio confirmed flowing (onaudiostart / onsoundstart / a result). */
  private audioConfirmed = false;
  private watchTimer: ReturnType<typeof setTimeout> | null = null;
  /** Last speech event (sound/speech start, interim result) for the synthetic level meter. */
  private lastSpeechEventAt = 0;
  private levelTimer: ReturnType<typeof setInterval> | null = null;
  private analyser: { stream: MediaStream; node: AnalyserNode; src: MediaStreamAudioSourceNode; buf: Float32Array } | null = null;
  private analyserGen = 0;
  /** Watchdog: an utterance whose final never arrives (interim, then silence). */
  private finalTimer: ReturnType<typeof setTimeout> | null = null;
  /** How long start() waits for onstart before giving up (W3). Set by the manager. */
  startTimeoutMs = 1500;

  get status(): VoiceStatus {
    return this._status;
  }

  isAvailable(): boolean {
    return getSpeechRecognitionCtor() !== null;
  }

  load(onProgress?: (p: VoiceLoadProgress) => void): Promise<void> {
    onProgress?.({ engine: 'webspeech', phase: 'done', loaded: 0, total: 0, fraction: 1 });
    return Promise.resolve();
  }

  private setStatus(s: VoiceStatus): void {
    this._status = s;
    this.opts?.onStatus(s);
  }

  /** True between speech start and the final result. */
  get midUtterance(): boolean {
    return this._status === 'hearing' || this._status === 'processing';
  }

  private static keyOf(opts: VoiceEngineStartOptions | null): string {
    try {
      return JSON.stringify(opts?.bias ?? null);
    } catch {
      return '';
    }
  }

  start(opts: VoiceEngineStartOptions): Promise<void> {
    this.noteBias(opts);
    this.opts = opts;
    if (this.listening && this.rec) return Promise.resolve();
    const C = getSpeechRecognitionCtor();
    if (!C) return Promise.reject(voiceError('unsupported', 'Speech recognition is not supported in this browser', false));
    this.listening = true;
    this.fatal = false;
    this.restarts = [];
    this.audioConfirmed = false;
    this.setStatus('loading');
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const rec = this.create(C, () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      }, (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
      this.rec = rec;
      try {
        rec.start(); // synchronous inside the gesture
      } catch (e) {
        settled = true;
        this.listening = false;
        reject(voiceError('unknown', (e as Error)?.message ?? 'Could not start speech recognition', true));
        return;
      }
      // W3 (docs/UX-V3.md §4.3): no onstart in time (or onstart but no audio) → let the
      // manager fall back instead of showing a listening ear that hears nothing.
      this.clearWatch();
      this.watchTimer = setTimeout(() => {
        this.watchTimer = null;
        if (this.rec !== rec || !this.listening) return;
        if (!settled || !this.audioConfirmed) {
          const err = voiceError('unknown', settled ? 'Speech recognition started but hears no audio' : 'Speech recognition did not start', true);
          const wasSettled = settled;
          settled = true;
          if (!wasSettled) reject(err);
          else this.opts?.onError({ ...err, engine: 'webspeech' });
        }
      }, this.startTimeoutMs + 1000);
      this.startLevel();
    });
  }

  private clearWatch(): void {
    if (this.watchTimer) clearTimeout(this.watchTimer);
    this.watchTimer = null;
  }

  /** Audio is flowing: now (and only now) the engine is listening. */
  private confirmAudio(): void {
    if (this.audioConfirmed) return;
    this.audioConfirmed = true;
    this.clearWatch();
    if (this.listening && this._status !== 'hearing') this.setStatus('listening');
  }

  private noteSpeechEvent(): void {
    this.lastSpeechEventAt = performance.now();
  }

  /**
   * Level meter for Web Speech (which reports no audio level). Desktop/Android: an AnalyserNode
   * on a second mic track. iOS: no second track (it can starve the recognizer), so the meter is
   * driven by the recognizer's own sound/speech/result events instead.
   */
  private startLevel(): void {
    if (this.levelTimer) return;
    this.levelTimer = setInterval(() => {
      const o = this.opts;
      if (!o?.onLevel) return;
      let level = 0;
      const a = this.analyser;
      if (a) {
        a.node.getFloatTimeDomainData(a.buf);
        let sum = 0;
        for (let i = 0; i < a.buf.length; i++) sum += a.buf[i] * a.buf[i];
        level = Math.min(1, Math.sqrt(sum / a.buf.length) * 6);
      }
      const since = performance.now() - this.lastSpeechEventAt;
      if ((this._status === 'hearing' && since < 2500) || since < 400) {
        // Synthetic motion while speech events flow: 60–100 % on the meter.
        const t = performance.now() / 1000;
        const synth = 0.12 + 0.13 * (0.5 + 0.5 * Math.sin(t * 11) * Math.sin(t * 4.3 + 1));
        level = Math.max(level, synth);
      }
      o.onLevel(level);
    }, 50);
    if (!isIOSLike()) void this.openAnalyser();
  }

  private async openAnalyser(): Promise<void> {
    const gen = ++this.analyserGen;
    try {
      const md = navigator.mediaDevices;
      const ctx = getAudioContext();
      if (!md?.getUserMedia || !ctx) return;
      // Only when the mic is already allowed: never a second permission prompt.
      const perm = await navigator.permissions?.query({ name: 'microphone' as PermissionName }).catch(() => null);
      if (!perm || perm.state !== 'granted') return;
      const stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (gen !== this.analyserGen || !this.listening) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 1024;
      src.connect(node);
      this.analyser = { stream, node, src, buf: new Float32Array(node.fftSize) };
    } catch {
      /* the synthetic meter still moves */
    }
  }

  private stopLevel(): void {
    if (this.levelTimer) clearInterval(this.levelTimer);
    this.levelTimer = null;
    this.analyserGen++;
    const a = this.analyser;
    this.analyser = null;
    if (a) {
      try {
        a.src.disconnect();
      } catch {
        /* ignore */
      }
      a.stream.getTracks().forEach((t) => t.stop());
    }
  }

  /** Back from the background (iOS kills recognition there): restart if we should be listening. */
  resume(): void {
    if (!this.listening || !this.rec) return;
    this.restarts = [];
    try {
      this.rec.start();
    } catch {
      /* already running */
    }
  }

  private create(C: SRCtor, onStarted: () => void, onFailed: (e: ReturnType<typeof voiceError>) => void): SR {
    const rec = new C();
    rec.lang = 'en-US';
    const ios = isIOSLike() || isSafari();
    rec.continuous = !ios;
    rec.interimResults = true;
    rec.maxAlternatives = 5;

    // Browsers without onaudiostart (or test doubles): onstart is the confirmation.
    const hasAudioStart = 'onaudiostart' in rec;
    rec.onstart = () => {
      this.uttEpoch = null;
      onStarted();
      if (!hasAudioStart) this.confirmAudio();
      else if (this.audioConfirmed && this.listening) this.setStatus('listening');
    };
    rec.onaudiostart = () => this.confirmAudio();
    rec.onsoundstart = () => {
      this.confirmAudio();
      this.noteSpeechEvent();
    };
    rec.onspeechstart = () => {
      this.confirmAudio();
      this.noteSpeechEvent();
      this.setStatus('hearing');
    };
    rec.onspeechend = () => {
      this.speechEndAt = performance.now();
    };
    rec.onresult = (e) => {
      const opts = this.opts;
      if (!opts) return;
      this.confirmAudio();
      this.noteSpeechEvent();
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res || !res.length) continue;
        const text = (res[0].transcript ?? '').trim();
        if (!text) continue;
        const alternatives: string[] = [];
        for (let k = 1; k < res.length; k++) {
          const t = (res[k]?.transcript ?? '').trim();
          if (t && t !== text && !alternatives.includes(t)) alternatives.push(t);
        }
        const now = performance.now();
        // A new utterance starts after a final, a session restart, or a long silence (a final
        // that never came, e.g. an aborted interim).
        if (this.uttEpoch === null || now - this.lastResultAt > 2000) this.uttEpoch = this.epoch;
        this.lastResultAt = now;
        const stale = this.uttEpoch !== this.epoch;
        if (res.isFinal) {
          // iOS sometimes delivers the same final twice.
          if (text === this.lastFinal.text && now - this.lastFinal.at < 800) continue;
          this.lastFinal = { text, at: now };
        } else {
          this.setStatus('hearing');
          this.armFinalWatch();
        }
        if (stale) {
          // Spoken for an earlier question: never judge it against this one.
          if (res.isFinal) {
            this.currentId = ++utteranceSeq;
            this.uttEpoch = null;
            this.speechEndAt = 0;
            if (this.listening) this.setStatus('listening');
          }
          continue;
        }
        opts.onHypothesis({
          text,
          isFinal: res.isFinal,
          confidence: res[0].confidence,
          engine: 'webspeech',
          alternatives: alternatives.length ? alternatives : undefined,
          latencyMs: res.isFinal && this.speechEndAt ? Math.max(0, Math.round(now - this.speechEndAt)) : undefined,
          utteranceId: this.currentId,
        });
        if (res.isFinal) {
          this.clearFinalWatch();
          this.currentId = ++utteranceSeq;
          this.uttEpoch = null;
          this.speechEndAt = 0;
          if (this.listening) this.setStatus('listening');
        }
      }
    };
    rec.onerror = (e) => {
      const code = e.error;
      if (code === 'no-speech' || code === 'aborted') return; // normal; onend restarts
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        this.fatal = true;
        const err = voiceError('permission-denied', 'Speech recognition permission was denied (on iPad: Settings → Siri & Dictation)', true);
        onFailed(err);
        this.opts?.onError({ ...err, engine: 'webspeech' });
        return;
      }
      if (code === 'audio-capture') {
        this.fatal = true;
        const err = voiceError('no-mic', 'No microphone available', true);
        onFailed(err);
        this.opts?.onError({ ...err, engine: 'webspeech' });
        return;
      }
      if (code === 'network') {
        // Transient; onend will retry with back-off.
        return;
      }
    };
    rec.onend = () => {
      if (this.rec === rec) this.uttEpoch = null;
      if (!this.listening || this.rec !== rec) return;
      if (this.fatal) {
        this.listening = false;
        this.setStatus('error');
        return;
      }
      this.clearFinalWatch();
      // Backgrounded (iOS ends recognition): resume() restarts it on return.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      // Back-off when the service keeps ending immediately (offline, quota).
      const now = performance.now();
      this.restarts = this.restarts.filter((t) => now - t < 5000);
      this.restarts.push(now);
      if (this.restarts.length > 8) {
        this.listening = false;
        this.setStatus('error');
        this.opts?.onError(voiceError('unknown', 'Speech recognition keeps stopping', true));
        return;
      }
      const delay = this.restarts.length > 3 ? 400 : 60;
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (!this.listening || this.rec !== rec) return;
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }, delay);
    };
    return rec;
  }

  private noteBias(opts: VoiceEngineStartOptions): void {
    const k = WebSpeechEngine.keyOf(opts);
    if (k !== this.biasKey) {
      this.biasKey = k;
      this.epoch++;
    }
  }

  update(opts: VoiceEngineStartOptions): void {
    this.noteBias(opts);
    this.opts = opts;
  }

  /** Interim results, then nothing: drop the utterance after 2.5 s so the ear never hangs. */
  private armFinalWatch(): void {
    this.clearFinalWatch();
    this.finalTimer = setTimeout(() => {
      this.finalTimer = null;
      if (!this.listening || this._status !== 'hearing') return;
      this.currentId = ++utteranceSeq;
      this.uttEpoch = null;
      this.speechEndAt = 0;
      this.setStatus('listening');
      this.opts?.onTimeout?.('stall');
    }, 2500);
  }

  private clearFinalWatch(): void {
    if (this.finalTimer) clearTimeout(this.finalTimer);
    this.finalTimer = null;
  }

  stop(): void {
    this.clearWatch();
    this.clearFinalWatch();
    this.stopLevel();
    this.audioConfirmed = false;
    this.listening = false;
    this.opts = null;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
    this._status = 'off';
  }

  dispose(): void {
    this.stop();
  }
}
