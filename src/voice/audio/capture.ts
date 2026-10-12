/**
 * Microphone capture for the on-device engines.
 *
 * - Uses the shell's single shared AudioContext (src/core/sound/audioContext) so iOS keeps
 *   one audio session for sfx + mic; it is created/resumed inside the user's tap.
 * - One MediaStream for the whole round; released by stop() (restores iOS speaker volume).
 * - VAD + 16 kHz resampling run in an AudioWorklet (capture.worklet.js), so endpointing is
 *   sample-accurate even while React renders confetti.
 */
import { getAudioContext, unlockAudio } from '../../core/sound/audioContext';
import type { VadProfile, VoiceError } from '../types';

export interface CaptureCallbacks {
  onLevel?: (rms: number) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  /** speechMs = voiced frames; spanMs = first → last voiced frame (wall clock, includes pauses). */
  onSegment: (audio: Float32Array, info: { speechMs: number; spanMs: number; reason: string; endedAt: number; endMsgAt: number }) => void;
  onDrop?: (reason: string) => void;
  onEnded?: () => void;
  /**
   * Streaming (see setStreaming): frames appended to the open utterance, with a voiced(1) /
   * quiet(0) flag per 10 ms frame. `from` = index of the first frame within the utterance.
   */
  onChunk?: (audio: Float32Array, flags: Uint8Array, from: number) => void;
}

const WORKLET_URL = new URL('./capture.worklet.js', import.meta.url).href;

const loadedContexts = new WeakSet<BaseAudioContext>();

export function voiceError(code: VoiceError['code'], message: string, recoverable = true): VoiceError {
  return { code, message, recoverable };
}

/** Map a getUserMedia failure to a contract error. */
export function mapMediaError(err: unknown): VoiceError {
  const name = (err as { name?: string })?.name ?? '';
  const msg = (err as { message?: string })?.message ?? String(err);
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return voiceError('permission-denied', 'Microphone permission was denied', true);
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return voiceError('no-mic', 'No microphone found', true);
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return voiceError('no-mic', 'The microphone is busy or unavailable', true);
  }
  return voiceError('audio-failed', msg || 'Could not open the microphone', true);
}

export class MicCapture {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  private cb: CaptureCallbacks | null = null;
  private profile: VadProfile | null = null;
  private lastEndAt = 0;
  private lastEndMsgAt = 0;
  private streaming = false;
  private starting: Promise<void> | null = null;
  /** Bumped by start() and stop(): an async start that finishes after a stop() must not keep the mic. */
  private gen = 0;
  /** The worklet has delivered at least one frame since the graph was built (honesty rule). */
  private framed = false;
  private frameWaiters: (() => void)[] = [];
  /** A stream opened early by armMic() inside the PLAY tap, adopted by the next start(). */
  private static armed: { stream: MediaStream; at: number; timer: ReturnType<typeof setTimeout> } | null = null;

  /**
   * Open the mic now (inside a tap) and keep the stream for the next start(), at most `keepMs`.
   * Returns false when getUserMedia is unavailable. Never throws.
   */
  static arm(keepMs = 5000): boolean {
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) return false;
    if (MicCapture.armed) return true;
    unlockAudio();
    try {
      void md
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
        .then((stream) => {
          if (MicCapture.armed) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          const timer = setTimeout(() => MicCapture.disarm(), keepMs);
          MicCapture.armed = { stream, at: performance.now(), timer };
        })
        .catch(() => {});
    } catch {
      return false;
    }
    return true;
  }

  /** Release an armed stream nobody adopted. */
  static disarm(): void {
    const a = MicCapture.armed;
    MicCapture.armed = null;
    if (!a) return;
    clearTimeout(a.timer);
    a.stream.getTracks().forEach((t) => t.stop());
  }

  private static takeArmed(): MediaStream | null {
    const a = MicCapture.armed;
    MicCapture.armed = null;
    if (!a) return null;
    clearTimeout(a.timer);
    if (!a.stream.getAudioTracks().some((t) => t.readyState === 'live')) return null;
    return a.stream;
  }

  /** Resolves true once the worklet delivers audio, false after `ms` without any. */
  waitForAudio(ms: number): Promise<boolean> {
    if (this.framed) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(t);
        resolve(true);
      };
      const t = setTimeout(() => {
        this.frameWaiters = this.frameWaiters.filter((w) => w !== done);
        resolve(this.framed);
      }, ms);
      this.frameWaiters.push(done);
    });
  }

  get hasAudio(): boolean {
    return this.framed;
  }

  get active(): boolean {
    return !!this.stream && this.stream.getAudioTracks().some((t) => t.readyState === 'live');
  }

  /**
   * Begin capturing. Call synchronously from a user gesture the first time: the
   * AudioContext is unlocked and getUserMedia is invoked before the first await.
   */
  start(cb: CaptureCallbacks, profile: VadProfile): Promise<void> {
    this.cb = cb;
    this.profile = profile;
    if (this.active && this.node) {
      this.configure(profile);
      return Promise.resolve();
    }
    if (this.starting) return this.starting;
    unlockAudio();
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) {
      return Promise.reject(
        voiceError(
          typeof window !== 'undefined' && !window.isSecureContext ? 'insecure-context' : 'unsupported',
          'Microphone is not available in this browser',
          false,
        ),
      );
    }
    const gen = ++this.gen;
    const abandoned = () => gen !== this.gen;
    this.framed = false;
    const early = MicCapture.takeArmed();
    const gum = early
      ? Promise.resolve(early)
      : md.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
    const p: Promise<void> = (async () => {
      let stream: MediaStream;
      try {
        stream = await gum;
      } catch (e) {
        throw mapMediaError(e);
      }
      if (abandoned()) {
        // stop() ran while the permission prompt / device open was pending: release it now.
        stream.getTracks().forEach((t) => t.stop());
        throw voiceError('aborted', 'Microphone start was cancelled', true);
      }
      try {
        const ctx = getAudioContext();
        if (!ctx) throw voiceError('audio-failed', 'Web Audio is not available', false);
        if (ctx.state !== 'running') await ctx.resume().catch(() => {});
        if (!ctx.audioWorklet) throw voiceError('unsupported', 'AudioWorklet is not supported', false);
        if (!loadedContexts.has(ctx)) {
          await ctx.audioWorklet.addModule(WORKLET_URL);
          loadedContexts.add(ctx);
        }
        if (abandoned()) throw voiceError('aborted', 'Microphone start was cancelled', true);
        this.stream = stream;
        this.source = ctx.createMediaStreamSource(stream);
        this.node = new AudioWorkletNode(ctx, 'voice-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        // Keep the graph pulled without making sound.
        this.sink = ctx.createGain();
        this.sink.gain.value = 0;
        this.source.connect(this.node);
        this.node.connect(this.sink);
        this.sink.connect(ctx.destination);
        this.node.port.onmessage = (e: MessageEvent) => this.onMessage(e.data);
        this.configure(this.profile ?? profile);
        stream.getAudioTracks().forEach((t) => {
          t.onended = () => this.cb?.onEnded?.();
        });
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        // An abandoned start must not tear down the graph of a newer start().
        if (!abandoned()) this.teardown();
        if ((e as VoiceError)?.code) throw e;
        throw voiceError('audio-failed', (e as Error)?.message ?? 'Audio setup failed', true);
      }
    })().finally(() => {
      if (this.starting === p) this.starting = null;
    });
    this.starting = p;
    return p;
  }

  configure(profile: VadProfile): void {
    this.profile = profile;
    this.node?.port.postMessage({ type: 'config', profile, stream: this.streaming });
  }

  /** Stream the open utterance's frames (onChunk) while speech is ongoing. */
  setStreaming(on: boolean): void {
    if (on === this.streaming) return;
    this.streaming = on;
    if (this.profile) this.configure(this.profile);
  }

  /** Ignore audio entirely (true) or resume (false). */
  pause(on: boolean): void {
    this.node?.port.postMessage({ type: 'pause', on });
  }

  /** Ignore new speech starts for `ms` (e.g. while a sound effect plays). */
  suppress(ms: number): void {
    this.node?.port.postMessage({ type: 'suppress', ms });
  }

  /** Re-resume the shared context (iOS interruption / tab return). */
  resume(): void {
    const ctx = getAudioContext();
    if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
  }

  stop(): void {
    this.gen++;
    this.starting = null;
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.teardown();
  }

  private teardown(): void {
    this.framed = false;
    try {
      this.source?.disconnect();
      this.node?.disconnect();
      this.sink?.disconnect();
      if (this.node) this.node.port.onmessage = null;
    } catch {
      /* ignore */
    }
    this.stream = null;
    this.source = null;
    this.node = null;
    this.sink = null;
  }

  private onMessage(m: { type: string; rms?: number; audio?: Float32Array; speechMs?: number; spanMs?: number; reason?: string; flags?: Uint8Array; from?: number }): void {
    const cb = this.cb;
    if (!cb) return;
    switch (m.type) {
      case 'level':
        if (!this.framed) {
          this.framed = true;
          const w = this.frameWaiters;
          this.frameWaiters = [];
          w.forEach((f) => f());
        }
        cb.onLevel?.(Math.min(1, (m.rms ?? 0) * 6));
        break;
      case 'start':
        cb.onSpeechStart?.();
        break;
      case 'end':
        // The worklet detected silence `endSilenceMs` ago (or hit the max length).
        this.lastEndMsgAt = performance.now();
        this.lastEndAt = this.lastEndMsgAt - (m.reason === 'max' ? 0 : (this.profile?.endSilenceMs ?? 0));
        cb.onSpeechEnd?.();
        break;
      case 'segment':
        if (m.audio) cb.onSegment(m.audio, { speechMs: m.speechMs ?? 0, spanMs: m.spanMs ?? m.speechMs ?? 0, reason: m.reason ?? 'silence', endedAt: this.lastEndAt || performance.now(), endMsgAt: this.lastEndMsgAt || performance.now() });
        break;
      case 'drop':
        cb.onDrop?.(m.reason ?? 'short');
        break;
      case 'chunk':
        if (m.audio && m.flags) cb.onChunk?.(m.audio, m.flags, m.from ?? 0);
        break;
    }
  }
}
