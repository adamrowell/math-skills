/**
 * Voice manager — one per page. Owns the engines, the mic and the model, so every screen
 * shares a single loaded model and a single open microphone.
 *
 * Engine policy for preference 'auto' (docs/DESIGN.md §3.4, ASR research §6):
 *   1. On-device Moonshine (base, q8, WASM) whenever it can run here.
 *   2. While it is downloading/warming, Web Speech bridges (if the browser has it) so the
 *      mic works on the very first round. On desktop it hot-swaps to on-device mid-round,
 *      between utterances; on iPad/iPhone the swap waits for the next start() (next round),
 *      because Web Speech and getUserMedia fight over the iOS audio session.
 *   3. If the model fails to load: Web Speech; if that is missing too: Whisper tiny.en.
 */
import { createPersistedStore } from '../core/store/persist';
import { unlockAudio } from '../core/sound/audioContext';
import { noteModelLoad, preferSmallSpeechModel } from '../platform/device';
import type {
  MatchVerdict,
  VoiceCapabilities,
  VoiceDiagnosticsSample,
  VoiceEngineKind,
  VoiceEnginePreference,
  VoiceEngineStartOptions,
  VoiceError,
  VoiceHypothesis,
  VoiceLoadProgress,
  VoiceMode,
  VoicePrefs,
  VoiceStatus,
  UseVoiceInputOptions,
} from './types';
import { DEFAULT_VOICE_PREFS } from './profiles';
import { OnDeviceEngine, type OnDeviceHypothesis } from './engines/onDevice';
import { WebSpeechEngine, getSpeechRecognitionCtor, isIOSLike } from './engines/webspeech';
import { MicCapture, voiceError } from './audio/capture';
import { getAcceptMargin } from './match/corrections';
import type { AsrDevice, AsrModelKey } from './engines/asrProtocol';

export const voicePrefsStore = createPersistedStore<VoicePrefs>({
  key: 'ms2:voice:prefs:v1',
  version: 1,
  initial: DEFAULT_VOICE_PREFS,
});

export interface VoiceSnapshot {
  status: VoiceStatus;
  engine: VoiceEngineKind | null;
  error: VoiceError | null;
  loadProgress: VoiceLoadProgress | null;
  level: number;
  /** On-device model state, independent of which engine is listening. */
  modelState: 'idle' | 'loading' | 'ready' | 'failed';
  /** performance-independent ms timestamp (Date.now) of the last watchdog W1 timeout, 0 = none. */
  timeoutAt: number;
  /** Date.now() of the last automatic engine switch after repeated timeouts, 0 = none. */
  switchedAt: number;
}

/** Last known microphone permission (persisted; never prompts). */
interface MicPermStore {
  version: 1;
  granted: boolean;
}
export const micPermStore = createPersistedStore<MicPermStore>({
  key: 'ms2:voice:mic:v1',
  version: 1,
  initial: { version: 1, granted: false },
});

function noteMicGranted(granted: boolean): void {
  try {
    if (micPermStore.get().granted !== granted) micPermStore.set({ version: 1, granted });
  } catch {
    /* storage optional */
  }
}

/** Refresh the cached permission from the Permissions API (Chrome, Safari ≥ 16). */
function syncMicPermission(): void {
  try {
    void navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((st) => {
        const apply = () => {
          if (st.state === 'granted') noteMicGranted(true);
          else if (st.state === 'denied') noteMicGranted(false);
        };
        apply();
        st.onchange = apply;
      })
      .catch(() => {});
  } catch {
    /* not supported */
  }
}

/** Consecutive W1 timeouts before switching engine. */
const SWITCH_AFTER = 3;
/** W5: no download progress for this long → retry once, then give up. */
const DOWNLOAD_STALL_MS = 20000;
/**
 * Arming watchdog: "Getting my ears ready" may never wait silently. If the mic is still not
 * listening this long after arming began AND nothing has downloaded for this long, show the
 * error row ("Mic stopped working · Try again · I'll type"). A later 'listening' clears it.
 */
const ARM_MAX_MS = 10000;
/** While the permission prompt may be up (never granted on this device). */
const ARM_MAX_PROMPT_MS = 20000;

export interface VoiceConsumer {
  id: number;
  mode: VoiceMode;
  bias?: UseVoiceInputOptions['bias'];
  preferredEngine?: VoiceEnginePreference;
  onTranscript: (h: VoiceHypothesis) => void;
  onLevel?: (rms: number) => void;
  onError?: (e: VoiceError) => void;
  onStatus?: (s: VoiceStatus) => void;
}

export function detectCapabilities(): VoiceCapabilities {
  if (typeof window === 'undefined') {
    return { secureContext: false, webspeech: false, onDevice: false, webgpu: false, audioWorklet: false };
  }
  const secureContext = window.isSecureContext !== false;
  const audioWorklet = typeof AudioWorkletNode !== 'undefined';
  const onDevice =
    secureContext &&
    audioWorklet &&
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;
  return {
    secureContext,
    webspeech: getSpeechRecognitionCtor() !== null,
    onDevice,
    webgpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
    audioWorklet,
  };
}

/** Dev/test overrides via URL: ?asrModel=moonshine-tiny&asrDevice=webgpu */
function urlOverride(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

class VoiceManager {
  private snap: VoiceSnapshot = { status: 'off', engine: null, error: null, loadProgress: null, level: 0, modelState: 'idle', timeoutAt: 0, switchedAt: 0 };
  private timeouts = 0;
  /** The on-device engine stalled repeatedly this page session: prefer Web Speech ('auto'). */
  private onDeviceStalled = false;
  private armTimer: ReturnType<typeof setTimeout> | null = null;
  private armedConsumer: VoiceConsumer | null = null;
  private listeners = new Set<() => void>();
  private caps: VoiceCapabilities | null = null;
  private webspeech = new WebSpeechEngine();
  private moonshine: OnDeviceEngine | null = null;
  private whisper: OnDeviceEngine | null = null;
  private active: VoiceConsumer | null = null;
  private current: 'webspeech' | 'ondevice' | null = null;
  private onDeviceBroken = false;
  /** Web Speech refused (Siri & Dictation off, Screen Time): use the on-device engine instead. */
  private webspeechBroken = false;
  private swapTimer: ReturnType<typeof setInterval> | null = null;
  private samples: VoiceDiagnosticsSample[] = [];
  private lastHyp: OnDeviceHypothesis | null = null;
  private levelThrottle = 0;

  constructor() {
    if (typeof window === 'undefined') return;
    syncMicPermission();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      this.onDevice().resumeAudio();
      // W6: Web Speech ends while backgrounded; restart it on return.
      if (this.current === 'webspeech' && this.active) this.webspeech.resume();
      // iOS can kill the mic track while backgrounded: re-arm it.
      if (this.current === 'ondevice' && this.active && !this.onDevice().capturing && this.snap.status !== 'error') {
        void this.startOnDevice(this.active).catch(() => {});
      }
    };
    try {
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('pageshow', onVisible);
      window.addEventListener('pointerdown', () => this.onDevice().resumeAudio(), { passive: true, capture: true });
    } catch {
      /* non-DOM */
    }
  }

  // ---- store plumbing ------------------------------------------------------
  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getSnapshot = (): VoiceSnapshot => this.snap;

  private loadingSince = 0;
  private progressAt = 0;
  private modelReadyAt = 0;
  private armWatch: ReturnType<typeof setInterval> | null = null;

  private patch(p: Partial<VoiceSnapshot>): void {
    const was = this.snap.status;
    if (p.loadProgress && p.loadProgress !== this.snap.loadProgress) this.progressAt = Date.now();
    if (p.modelState && p.modelState !== 'loading' && this.snap.modelState === 'loading') this.modelReadyAt = Date.now();
    this.snap = { ...this.snap, ...p };
    if (this.snap.status === 'loading' && was !== 'loading') {
      this.loadingSince = Date.now();
      this.startArmWatch();
    } else if (this.snap.status !== 'loading') this.stopArmWatch();
    this.listeners.forEach((l) => l());
  }

  private startArmWatch(): void {
    if (this.armWatch || typeof setInterval === 'undefined') return;
    this.armWatch = setInterval(() => {
      if (this.snap.status !== 'loading' || !this.active) {
        this.stopArmWatch();
        return;
      }
      // A model that is still downloading or starting up has its own watchdog (W5) and its own
      // failure path; this one is for a mic that never delivers audio once everything is loaded.
      if (this.snap.modelState === 'loading') return;
      const now = Date.now();
      const limit = micGranted() ? ARM_MAX_MS : ARM_MAX_PROMPT_MS;
      if (now - Math.max(this.loadingSince, this.modelReadyAt) < limit || now - this.progressAt < ARM_MAX_MS) return;
      this.stopArmWatch();
      this.fail(voiceError('audio-failed', 'The microphone did not start', true));
    }, 1000);
  }

  private stopArmWatch(): void {
    if (this.armWatch) clearInterval(this.armWatch);
    this.armWatch = null;
  }

  capabilities(): VoiceCapabilities {
    if (!this.caps) this.caps = detectCapabilities();
    return this.caps;
  }

  get prefs(): VoicePrefs {
    return voicePrefsStore.get();
  }

  // ---- engines ----------------------------------------------------------------
  onDevice(kind: 'moonshine' | 'whisper' = 'moonshine'): OnDeviceEngine {
    const device = (urlOverride('asrDevice') as AsrDevice | null) === 'webgpu' ? 'webgpu' : 'wasm';
    if (kind === 'whisper') {
      if (!this.whisper) this.whisper = new OnDeviceEngine('whisper', 'whisper-tiny.en', device);
      return this.whisper;
    }
    if (!this.moonshine) {
      const key = urlOverride('asrModel') as AsrModelKey | null;
      this.moonshine = new OnDeviceEngine('moonshine', key === 'moonshine-tiny' || (!key && preferSmallSpeechModel()) ? 'moonshine-tiny' : 'moonshine-base', device);
    }
    return this.moonshine;
  }

  private preferredOnDevice(pref: VoiceEnginePreference): OnDeviceEngine {
    if (pref === 'whisper') return this.onDevice('whisper');
    if (pref === 'auto' && this.onDeviceBroken && !this.capabilities().webspeech) return this.onDevice('whisper');
    return this.onDevice('moonshine');
  }

  private effectivePref(c?: VoiceConsumer | null): VoiceEnginePreference {
    return c?.preferredEngine ?? this.prefs.engine ?? 'auto';
  }

  /** Download + warm the on-device model without opening the mic. */
  preload(pref?: VoiceEnginePreference): Promise<void> {
    const p = pref ?? this.effectivePref(this.active);
    if (p === 'webspeech') return Promise.resolve();
    const caps = this.capabilities();
    if (!caps.onDevice) return Promise.resolve();
    const eng = this.preferredOnDevice(p);
    if (eng.isReady) return Promise.resolve();
    if (this.snap.modelState !== 'loading') this.patch({ modelState: 'loading' });
    try {
      void (navigator.storage as StorageManager | undefined)?.persist?.().catch(() => false);
    } catch {
      /* ignore */
    }
    return this.loadWithWatchdog(eng)
      .then(() => {
        this.patch({ modelState: 'ready', loadProgress: { ...(this.snap.loadProgress ?? { engine: eng.kind, loaded: 0, total: 0 }), phase: 'done', fraction: 1 } });
        this.maybeSwapToOnDevice();
      })
      .catch((e: unknown) => {
        this.onDeviceBroken = true;
        // Clear the progress so no "loading 0%" sticks around; the browser's ears keep working.
        this.patch({ modelState: 'failed', loadProgress: null });
        throw e;
      });
  }

  /**
   * W5: a download that stops making progress for 20 s is restarted once; a second stall fails
   * (the browser's ears keep working; the hub retries next visit).
   */
  private loadWithWatchdog(eng: OnDeviceEngine): Promise<void> {
    const attempt = (retry: boolean): Promise<void> => {
      let last = Date.now();
      let lastFrac = -1;
      const watch = setInterval(() => {
        const p = this.snap.loadProgress;
        if (!p || p.phase !== 'download') {
          last = Date.now();
          return;
        }
        if (p.fraction !== lastFrac) {
          lastFrac = p.fraction;
          last = Date.now();
          return;
        }
        if (Date.now() - last > DOWNLOAD_STALL_MS) {
          clearInterval(watch);
          eng.abortLoad('The voice model download stalled');
        }
      }, 1000);
      noteModelLoad('start'); // platform: remember an out-of-memory kill mid-load (→ smaller model)
      return eng
        .load((lp) => this.patch({ loadProgress: lp }))
        .then(() => noteModelLoad('done'), (e: unknown) => {
          noteModelLoad('failed');
          throw e;
        })
        .finally(() => clearInterval(watch))
        .catch((e: unknown) => {
          if (retry && (e as { stalled?: boolean })?.stalled) return attempt(false);
          throw e;
        });
    };
    return attempt(true);
  }

  /** "Download again" (parent) or a later hub visit after a failed download. */
  retryPreload(): Promise<void> {
    if (this.snap.modelState !== 'failed') return this.preload();
    this.onDeviceBroken = false;
    this.patch({ modelState: 'idle', loadProgress: null });
    return this.preload();
  }

  // ---- lifecycle ----------------------------------------------------------------
  /**
   * Begin listening for `c`. Everything that needs the user gesture (AudioContext unlock,
   * getUserMedia, SpeechRecognition.start) happens synchronously before the first await.
   */
  start(c: VoiceConsumer): Promise<void> {
    unlockAudio();
    const prev = this.active;
    this.active = c;
    const caps = this.capabilities();
    if (!caps.secureContext) {
      const err = voiceError('insecure-context', 'The microphone needs https:// (or localhost)', false);
      this.fail(err);
      return Promise.reject(err);
    }
    // Already listening (next question / other consumer): just retarget.
    if (prev && this.current && this.isListeningStatus()) {
      this.update(c);
      return Promise.resolve();
    }
    const pref = this.effectivePref(c);
    const speechOk = caps.webspeech && !this.webspeechBroken;
    const wantOnDevice =
      (pref !== 'webspeech' || this.webspeechBroken) &&
      caps.onDevice &&
      !((this.onDeviceBroken || this.onDeviceStalled) && pref === 'auto' && speechOk);
    if (c !== this.armedConsumer) this.disarm(false);
    this.webspeech.startTimeoutMs = micGranted() ? 1500 : 20000;
    if (wantOnDevice) {
      const eng = this.preferredOnDevice(pref);
      if (eng.isReady || !speechOk || pref !== 'auto') {
        return this.startOnDevice(c);
      }
      // Bridge with Web Speech while the model loads.
      void this.preload(pref).catch(() => {});
      return this.startWebSpeech(c);
    }
    if (speechOk) return this.startWebSpeech(c);
    if (caps.onDevice) return this.startOnDevice(c);
    if (caps.webspeech) return this.startWebSpeech(c);
    const err = voiceError('unsupported', 'Voice input is not supported in this browser', false);
    this.fail(err);
    return Promise.reject(err);
  }

  private isListeningStatus(): boolean {
    const s = this.snap.status;
    return s === 'listening' || s === 'hearing' || s === 'processing' || s === 'loading';
  }

  private engineOpts(c: VoiceConsumer, engine: VoiceEngineKind): VoiceEngineStartOptions {
    return {
      mode: c.mode,
      bias: c.bias,
      onHypothesis: (h) => this.onHypothesis(c, h),
      onLevel: (rms) => this.onLevel(c, rms),
      onStatus: (s) => {
        if (this.active !== c) return;
        if (s === 'listening') noteMicGranted(true);
        if (this.snap.status !== s || this.snap.engine !== engine) this.patch({ status: s, engine, error: s === 'error' ? this.snap.error : null });
        c.onStatus?.(s);
      },
      onError: (e) => this.onEngineError(c, { ...e, engine }),
      onTimeout: (why) => this.onTimeout(c, engine, why),
    };
  }

  /** W1: a finished utterance timed out. Three in a row → switch engine. */
  private onTimeout(c: VoiceConsumer, engine: VoiceEngineKind, why: 'stall' | 'failed'): void {
    if (this.active !== c) return;
    this.timeouts++;
    this.patch({ timeoutAt: Date.now() });
    this.samples.push({ ts: Date.now(), engine, text: `[timeout: ${why}]` });
    if (this.samples.length > 20) this.samples.shift();
    try {
      window.dispatchEvent(new CustomEvent('voice:timeout', { detail: { engine, why, count: this.timeouts } }));
    } catch {
      /* non-DOM */
    }
    if (this.timeouts < SWITCH_AFTER) return;
    this.timeouts = 0;
    const caps = this.capabilities();
    if (this.current === 'ondevice' && caps.webspeech && !this.webspeechBroken) {
      this.onDeviceStalled = true;
      this.patch({ switchedAt: Date.now() });
      void this.startWebSpeech(c).catch(() => {});
    } else if (this.current === 'webspeech' && caps.onDevice && !this.onDeviceBroken) {
      this.patch({ switchedAt: Date.now() });
      void this.startOnDevice(c).catch(() => {});
    }
  }

  // ---- arming (PLAY tap → round screen) --------------------------------------------
  /**
   * Open the mic inside the PLAY tap so the round screen (mounted after navigation, outside the
   * gesture) can start listening. The session is held by a placeholder consumer for ≤ 5 s and
   * handed to the next start() as is.
   */
  arm(mode: VoiceMode = 'number'): void {
    if (this.active && this.current) return; // already listening
    const caps = this.capabilities();
    if (!caps.secureContext) return;
    const c: VoiceConsumer = { id: -1, mode, onTranscript: () => {} };
    this.armedConsumer = c;
    if (this.armTimer) clearTimeout(this.armTimer);
    this.armTimer = setTimeout(() => this.disarm(true), 5000);
    void this.start(c).catch(() => {});
  }

  private disarm(stopIfHeld: boolean): void {
    if (this.armTimer) clearTimeout(this.armTimer);
    this.armTimer = null;
    const c = this.armedConsumer;
    this.armedConsumer = null;
    if (stopIfHeld && c && this.active === c) this.stop();
    MicCapture.disarm();
  }

  private startWebSpeech(c: VoiceConsumer): Promise<void> {
    this.stopOnDeviceCapture();
    this.current = 'webspeech';
    // Honesty rule: 'listening' only after the engine confirms audio (engine reports it).
    this.patch({ engine: 'webspeech', status: 'loading', error: null });
    const p = this.webspeech.start(this.engineOpts(c, 'webspeech'));
    return p.catch((e: VoiceError) => {
      // Already handled through onError (switched engine, stopped or retargeted): nothing to do.
      if (this.current !== 'webspeech' || this.active !== c) return;
      if (this.fallBackFromWebSpeech(c, e)) return this.startOnDevice(c);
      this.fail(e);
      throw e;
    });
  }

  /**
   * Web Speech said no (Siri & Dictation off, Screen Time, no service): when the on-device
   * engine can run here, switch to it (it only needs the mic permission). Returns true when
   * the caller should start on-device instead of failing.
   */
  private fallBackFromWebSpeech(c: VoiceConsumer, e: VoiceError): boolean {
    if (e.code !== 'permission-denied' && e.code !== 'no-mic' && e.code !== 'unknown') return false;
    if (e.code === 'permission-denied' || e.code === 'no-mic') this.webspeechBroken = true;
    const caps = this.capabilities();
    if (!caps.onDevice || this.active !== c || this.current !== 'webspeech') return false;
    if (this.effectivePref(c) === 'webspeech' && e.code === 'unknown') return false;
    return true;
  }

  private startOnDevice(c: VoiceConsumer): Promise<void> {
    const eng = this.preferredOnDevice(this.effectivePref(c));
    this.webspeech.stop();
    this.current = 'ondevice';
    if (!eng.isReady) {
      this.patch({ engine: eng.kind, status: 'loading', error: null, modelState: 'loading' });
    } else this.patch({ engine: eng.kind, error: null });
    const p = eng.start(this.engineOpts(c, eng.kind));
    if (!eng.isReady) {
      // Surface download progress while start() waits for the model.
      this.loadWithWatchdog(eng).then(
        () => this.patch({ modelState: 'ready' }),
        () => {
          this.onDeviceBroken = true;
          this.patch({ modelState: 'failed', loadProgress: null });
        },
      );
    }
    return p.catch((e: VoiceError) => {
      if (e?.code === 'aborted') throw e; // stopped while starting: not an error to show
      // The model could not load: the browser's speech service can still listen.
      if (
        e?.code === 'load-failed' &&
        this.active === c &&
        this.current === 'ondevice' &&
        this.effectivePref(c) === 'auto' &&
        this.capabilities().webspeech &&
        !this.webspeechBroken
      ) {
        return this.startWebSpeech(c);
      }
      this.fail({ ...e, engine: eng.kind, recoverable: e.recoverable ?? true });
      throw e;
    });
  }

  private stopOnDeviceCapture(): void {
    this.moonshine?.stop();
    this.whisper?.stop();
  }

  /** Desktop: once the model is ready, move a Web Speech session to on-device between utterances. */
  private maybeSwapToOnDevice(): void {
    if (this.current !== 'webspeech' || !this.active) return;
    if (this.effectivePref(this.active) !== 'auto') return;
    if (this.onDeviceStalled) return;
    if (isIOSLike()) return; // next round
    if (this.swapTimer) return;
    let waited = 0;
    this.swapTimer = setInterval(() => {
      waited += 100;
      if (this.current !== 'webspeech' || !this.active) {
        this.clearSwap();
        return;
      }
      if (this.webspeech.midUtterance && waited < 4000) return;
      this.clearSwap();
      const c = this.active;
      void this.startOnDevice(c).catch(() => {
        // Fall back to Web Speech again; on-device stays marked broken.
        this.onDeviceBroken = true;
        if (this.active === c) void this.startWebSpeech(c).catch(() => {});
      });
    }, 100);
  }

  private clearSwap(): void {
    if (this.swapTimer) clearInterval(this.swapTimer);
    this.swapTimer = null;
  }

  /** Mode / bias / callbacks changed. */
  update(c: VoiceConsumer): void {
    if (this.active && this.active.id !== c.id) return;
    this.active = c;
    if (this.current === 'webspeech') this.webspeech.update(this.engineOpts(c, 'webspeech'));
    else if (this.current === 'ondevice') {
      const eng = this.preferredOnDevice(this.effectivePref(c));
      eng.update(this.engineOpts(c, eng.kind));
    }
  }

  /** Consumer unmounted / disabled: release the mic if it was the active one. */
  release(id: number): void {
    if (this.active?.id === id) this.stop();
  }

  stop(): void {
    this.clearSwap();
    this.active = null;
    this.current = null;
    this.webspeech.stop();
    this.stopOnDeviceCapture();
    this.patch({ status: this.snap.modelState === 'ready' ? 'ready' : 'off', level: 0, error: null });
  }

  setEngine(pref: VoiceEnginePreference): void {
    voicePrefsStore.update((p) => ({ ...p, engine: pref }));
    if (pref !== 'auto' && pref !== 'webspeech') this.onDeviceBroken = false;
    if (pref === 'webspeech') this.webspeechBroken = false;
    const c = this.active;
    if (c && this.current) {
      // Switch immediately (not inside a gesture: the mic permission is already granted).
      this.stop();
      void this.start(c).catch(() => {});
    }
  }

  /** Ignore speech for `ms` (call when playing a sound effect while listening). */
  suppress(ms: number): void {
    this.moonshine?.suppress(ms);
    this.whisper?.suppress(ms);
  }

  // ---- events -------------------------------------------------------------------
  private onHypothesis(c: VoiceConsumer, h: VoiceHypothesis): void {
    if (this.active !== c) return;
    // Test/diagnostics hook (latency e2e): only when a page installed window.__voiceTrace = [].
    const hook = (globalThis as { __voiceTrace?: unknown[] }).__voiceTrace;
    if (Array.isArray(hook)) hook.push({ at: performance.now(), text: h.text, isFinal: h.isFinal, latencyMs: h.latencyMs, speculative: (h as OnDeviceHypothesis).speculative ?? false });
    if (h.isFinal) {
      if (h.text) this.timeouts = 0;
      this.lastHyp = h as OnDeviceHypothesis;
      const sample: VoiceDiagnosticsSample & { utteranceId: number } = {
        ts: Date.now(),
        engine: h.engine,
        text: h.text,
        latencyMs: h.latencyMs,
        durationMs: h.durationMs,
        utteranceId: h.utteranceId,
      };
      this.samples.push(sample);
      if (this.samples.length > 20) this.samples.shift();
    }
    try {
      c.onTranscript(h);
    } catch (e) {
      console.error('voice: onTranscript threw', e);
    }
  }

  private onLevel(c: VoiceConsumer, rms: number): void {
    if (this.active !== c) return;
    c.onLevel?.(rms);
    const now = performance.now();
    if (now - this.levelThrottle > 45) {
      this.levelThrottle = now;
      this.patch({ level: rms });
    }
  }

  private onEngineError(c: VoiceConsumer, e: VoiceError): void {
    if (this.active !== c) return;
    if (e.code === 'aborted') return;
    if (e.engine === 'webspeech' && this.fallBackFromWebSpeech(c, e)) {
      void this.startOnDevice(c).catch(() => {});
      return;
    }
    this.fail(e);
  }

  private fail(e: VoiceError): void {
    if (e.code === 'permission-denied') noteMicGranted(false);
    this.patch({ status: 'error', error: e });
    this.active?.onError?.(e);
    this.active?.onStatus?.('error');
  }

  // ---- diagnostics --------------------------------------------------------------
  recordVerdict(utteranceId: number, verdict: MatchVerdict): void {
    for (let i = this.samples.length - 1; i >= 0; i--) {
      const s = this.samples[i] as VoiceDiagnosticsSample & { utteranceId?: number };
      if (s.utteranceId === utteranceId) {
        s.verdict = verdict;
        return;
      }
    }
  }

  diagnostics() {
    const m = this.moonshine ?? this.whisper;
    const lat = this.samples.map((s) => s.latencyMs).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
    const pct = (q: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : undefined);
    return {
      engine: this.snap.engine,
      status: this.snap.status,
      modelState: this.snap.modelState,
      model: m?.modelId ?? null,
      backend: m?.backend ?? null,
      loadMs: m?.lastLoadMs ?? null,
      warmMs: m?.lastWarmMs ?? null,
      acceptMargin: getAcceptMargin(),
      capabilities: this.capabilities(),
      latencyP50: pct(0.5),
      latencyP90: pct(0.9),
      samples: this.samples.slice(),
      last: this.lastHyp,
    };
  }
}

/** Last known mic permission (persisted); never prompts. */
export function micGranted(): boolean {
  try {
    return micPermStore.get().granted;
  } catch {
    return false;
  }
}

let instance: VoiceManager | null = null;
export function getVoiceManager(): VoiceManager {
  if (!instance) instance = new VoiceManager();
  return instance;
}
export type { VoiceManager };
