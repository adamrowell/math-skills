/* global sampleRate, currentTime, registerProcessor, AudioWorkletProcessor */
/**
 * Voice capture worklet: anti-alias low-pass → resample to 16 kHz → 10 ms energy VAD with
 * an adaptive noise floor → pre-roll ring buffer → whole utterance posted as one
 * transferable Float32Array.
 *
 * Messages in  (port): {type:'config', profile:{minSpeechMs,endSilenceMs,maxUtteranceMs,preRollMs}}
 *                      {type:'pause', on:boolean}   — ignore audio (e.g. while sfx play)
 *                      {type:'suppress', ms:number} — ignore speech starts for ms
 *                      {type:'reset'}
 * Messages out (port): {type:'level', rms}             ~20 Hz
 *                      {type:'start'}                   speech started
 *                      {type:'end', reason}             speech ended (segment follows)
 *                      {type:'segment', audio, speechMs, spanMs, reason}
 *                      {type:'drop', reason, speechMs}  too short / noise
 *                      {type:'chunk', audio, flags, from} while speech is open (when streaming is
 *                        on): the frames appended to the utterance since the last chunk, every
 *                        20 ms, with a voiced(1)/quiet(0) flag per 10 ms frame — lets the engine
 *                        decode speculatively before the endpoint.
 */
const OUT_RATE = 16000;
const FRAME = 160; // 10 ms @ 16 kHz

function biquadLowpass(fs, fc, q) {
  const w0 = (2 * Math.PI * fc) / fs;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cos) / 2 / a0,
    b1: (1 - cos) / a0,
    b2: (1 - cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
    x1: 0, x2: 0, y1: 0, y2: 0,
  };
}

function runBiquad(f, x) {
  const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
  f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y;
  return y;
}

class VoiceCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / OUT_RATE;
    this.passthrough = Math.abs(this.ratio - 1) < 1e-6;
    // Two cascaded biquads ≈ 4th-order low-pass at 7 kHz (below the 8 kHz Nyquist of 16 kHz).
    this.lp1 = biquadLowpass(sampleRate, 7000, 0.541);
    this.lp2 = biquadLowpass(sampleRate, 7000, 1.307);
    this.pos = 0; // fractional read position into the input stream, in input samples
    this.prev = 0; // previous filtered input sample (for linear interpolation)
    this.frame = new Float32Array(FRAME);
    this.fn = 0;
    this.profile = { minSpeechMs: 120, endSilenceMs: 350, maxUtteranceMs: 4000, preRollMs: 300 };
    this.paused = false;
    this.stream = false;
    this.suppressFrames = 0;
    // Minimum statistics (noise under speech): the quietest 10 ms frame of each 100 ms block,
    // over the last 2.5 s. A steady fan / TV bed never dips below its own level, speech does.
    this.blockMins = [];
    this.blockMin = Infinity;
    this.blockN = 0;
    this.resetVad();
    this.port.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === 'config' && m.profile) {
        this.profile = Object.assign({}, this.profile, m.profile);
        if (typeof m.stream === 'boolean') this.stream = m.stream;
      }
      else if (m.type === 'pause') { this.paused = !!m.on; if (this.paused) this.resetVad(); }
      else if (m.type === 'suppress') this.suppressFrames = Math.ceil((m.ms || 0) / 10);
      else if (m.type === 'reset') this.resetVad();
    };
  }

  resetVad() {
    this.floor = this.floor || 0.003;
    this.speech = false;
    this.loud = 0;
    this.quiet = 0;
    this.voicedFrames = 0;
    this.levelCount = 0;
    this.levelMax = 0;
    const preFrames = Math.ceil((this.profile ? this.profile.preRollMs : 300) / 10) + 4;
    this.ring = new Array(preFrames);
    this.ringN = 0;
    this.seg = [];
    this.flags = [];
    this.sent = 0;
  }

  /** Streaming: post the frames added since the last chunk (≥ 2 frames, or `force`). */
  flushChunk(force) {
    if (!this.stream || !this.speech) return;
    const n = this.seg.length - this.sent;
    if (n <= 0 || (n < 2 && !force)) return;
    const audio = new Float32Array(n * FRAME);
    const flags = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      audio.set(this.seg[this.sent + i], i * FRAME);
      flags[i] = this.flags[this.sent + i];
    }
    this.port.postMessage({ type: 'chunk', audio, flags, from: this.sent }, [audio.buffer, flags.buffer]);
    this.sent += n;
  }

  pushOut(sample) {
    this.frame[this.fn++] = sample;
    if (this.fn === FRAME) {
      this.fn = 0;
      this.onFrame(this.frame.slice());
    }
  }

  onFrame(f) {
    let s = 0;
    for (let i = 0; i < FRAME; i++) s += f[i] * f[i];
    const rms = Math.sqrt(s / FRAME);

    // ~20 Hz level meter (max over 5 frames)
    this.levelMax = Math.max(this.levelMax, rms);
    if (++this.levelCount >= 5) {
      this.port.postMessage({ type: 'level', rms: this.levelMax });
      this.levelCount = 0;
      this.levelMax = 0;
    }
    if (this.paused) return;
    if (this.suppressFrames > 0) this.suppressFrames--;
    this.trackNoise(rms);

    const p = this.profile;
    if (!this.speech) {
      // Track the noise floor only while nobody is talking.
      this.floor = 0.95 * this.floor + 0.05 * Math.min(rms, this.floor * 3 + 1e-4);
      if (this.floor < 0.0005) this.floor = 0.0005;
      this.ring[this.ringN++ % this.ring.length] = f;
      const on = rms > Math.max(0.01, this.floor * 4);
      this.loud = on && this.suppressFrames === 0 ? this.loud + 1 : 0;
      if (this.loud >= 3) {
        this.speech = true;
        this.quiet = 0;
        this.voicedFrames = this.loud;
        // pre-roll (includes the 3 trigger frames)
        const n = Math.min(this.ringN, this.ring.length, Math.ceil(p.preRollMs / 10) + 3);
        this.seg = [];
        this.flags = [];
        this.sent = 0;
        for (let k = n; k >= 1; k--) {
          this.seg.push(this.ring[(this.ringN - k) % this.ring.length]);
          this.flags.push(k <= 3 ? 1 : 0);
        }
        this.port.postMessage({ type: 'start' });
        this.flushChunk(true);
      }
      return;
    }
    this.seg.push(f);
    const off = rms < Math.max(0.006, this.floor * 2.5);
    this.flags.push(off ? 0 : 1);
    if (off) this.quiet++;
    else { this.quiet = 0; this.voicedFrames++; }
    // A quiet onset goes out at once (the engine decodes on it); otherwise every 20 ms.
    this.flushChunk(off && this.quiet <= 2);
    const endFrames = Math.ceil(p.endSilenceMs / 10);
    const tooLong = this.seg.length * 10 >= p.maxUtteranceMs;
    if (this.quiet >= endFrames || tooLong) this.finish(tooLong ? 'max' : 'silence');
  }

  /**
   * Continuous background noise (fan, TV, chatter) louder than the absolute speech threshold
   * would otherwise keep the VAD "in speech" forever: every utterance would run to the max
   * length with the answer buried in it. When even the quietest frames of the last 2.5 s stay
   * well above the floor, raise the floor to that level (both thresholds follow it).
   */
  trackNoise(rms) {
    if (rms < this.blockMin) this.blockMin = rms;
    if (++this.blockN < 10) return;
    this.blockMins.push(this.blockMin);
    if (this.blockMins.length > 25) this.blockMins.shift();
    this.blockMin = Infinity;
    this.blockN = 0;
    if (this.blockMins.length < 25) return;
    let est = Infinity;
    for (const m of this.blockMins) if (m < est) est = m;
    if (est > 0.004 && est > this.floor * 1.5) this.floor = est;
  }

  finish(reason) {
    const speechMs = this.voicedFrames * 10;
    // Wall-clock span from the first to the last voiced frame ("seven times eight is fifty six"
    // has pauses, so its voiced-frame count understates how long it is).
    let firstV = -1;
    let lastV = -1;
    for (let i = 0; i < this.flags.length; i++) if (this.flags[i]) { if (firstV < 0) firstV = i; lastV = i; }
    const spanMs = firstV >= 0 ? (lastV - firstV + 1) * 10 : speechMs;
    this.port.postMessage({ type: 'end', reason });
    // Keep at most 200 ms of the trailing silence.
    const trailing = Math.max(0, this.quiet - 20);
    const frames = this.seg.slice(0, this.seg.length - trailing);
    this.speech = false;
    this.loud = 0;
    this.quiet = 0;
    this.seg = [];
    this.flags = [];
    this.sent = 0;
    this.ringN = 0;
    if (speechMs < this.profile.minSpeechMs) {
      this.port.postMessage({ type: 'drop', reason: 'short', speechMs });
      return;
    }
    const audio = new Float32Array(frames.length * FRAME);
    frames.forEach((fr, i) => audio.set(fr, i * FRAME));
    this.port.postMessage({ type: 'segment', audio, speechMs, spanMs, reason, t: currentTime }, [audio.buffer]);
  }

  process(inputs) {
    const input = inputs[0];
    const ch = input && input[0];
    if (!ch) return true;
    if (this.passthrough) {
      for (let i = 0; i < ch.length; i++) this.pushOut(ch[i]);
      return true;
    }
    // Low-pass every input sample, then linearly interpolate output samples at `ratio` steps.
    for (let i = 0; i < ch.length; i++) {
      const x = runBiquad(this.lp2, runBiquad(this.lp1, ch[i]));
      // Output samples whose position falls in (i-1, i]
      while (this.pos <= 1) {
        const y = this.prev + (x - this.prev) * this.pos;
        this.pushOut(y);
        this.pos += this.ratio;
      }
      this.pos -= 1;
      this.prev = x;
    }
    return true;
  }
}

registerProcessor('voice-capture', VoiceCaptureProcessor);
