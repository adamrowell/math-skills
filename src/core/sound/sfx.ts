/**
 * WebAudio-synthesised sound effects: zero decode latency, reliable on iOS after the first tap.
 */
import type { Sfx, SoundName } from '../types';
import { getSettings } from '../settings/settingsStore';
import { getAudioContext, isAudioUnlocked, unlockAudio } from './audioContext';

type Wave = OscillatorType;

interface Note {
  f: number;
  /** End frequency for a glide. */
  f2?: number;
  t: number; // start offset s
  d: number; // duration s
  w?: Wave;
  g?: number; // relative gain
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;

const SOUNDS: Record<SoundName, Note[]> = {
  correct: [
    { f: 880, t: 0, d: 0.07, w: 'triangle' },
    { f: 1318.5, t: 0.06, d: 0.1, w: 'triangle' },
  ],
  wrong: [{ f: 240, f2: 150, t: 0, d: 0.2, w: 'sine', g: 1.2 }],
  combo: [
    { f: C5, t: 0, d: 0.06, w: 'square', g: 0.35 },
    { f: E5, t: 0.05, d: 0.06, w: 'square', g: 0.35 },
    { f: G5, t: 0.1, d: 0.06, w: 'square', g: 0.35 },
    { f: C6, t: 0.15, d: 0.12, w: 'square', g: 0.35 },
  ],
  tick: [{ f: 1200, t: 0, d: 0.03, w: 'square', g: 0.25 }],
  points: [{ f: G6, t: 0, d: 0.05, w: 'sine', g: 0.6 }],
  roundEnd: [
    { f: G5, t: 0, d: 0.1, w: 'triangle' },
    { f: C6, t: 0.09, d: 0.18, w: 'triangle' },
  ],
  pb: [
    { f: C5, t: 0, d: 0.1, w: 'square', g: 0.35 },
    { f: E5, t: 0.1, d: 0.1, w: 'square', g: 0.35 },
    { f: G5, t: 0.2, d: 0.1, w: 'square', g: 0.35 },
    { f: C6, t: 0.3, d: 0.35, w: 'square', g: 0.35 },
    { f: E6, t: 0.3, d: 0.35, w: 'triangle', g: 0.5 },
  ],
  trophy: [
    { f: E6, t: 0, d: 0.25, w: 'sine', g: 0.8 },
    { f: G6, t: 0.08, d: 0.3, w: 'sine', g: 0.6 },
    { f: C6 * 2, t: 0.16, d: 0.35, w: 'sine', g: 0.5 },
  ],
  rankUp: [
    { f: C5, t: 0, d: 0.12, w: 'square', g: 0.3 },
    { f: G5, t: 0.12, d: 0.12, w: 'square', g: 0.3 },
    { f: C6, t: 0.24, d: 0.12, w: 'square', g: 0.3 },
    { f: E6, t: 0.36, d: 0.12, w: 'square', g: 0.3 },
    { f: G6, t: 0.48, d: 0.4, w: 'triangle', g: 0.6 },
  ],
  click: [{ f: 700, t: 0, d: 0.025, w: 'triangle', g: 0.4 }],
  pop: [{ f: 400, f2: 900, t: 0, d: 0.06, w: 'sine', g: 0.7 }],
};

const MASTER = 0.5;

function playNotes(notes: Note[], gain: number): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime + 0.005;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = n.w ?? 'sine';
    const t0 = now + n.t;
    const t1 = t0 + n.d;
    osc.frequency.setValueAtTime(n.f, t0);
    if (n.f2) osc.frequency.exponentialRampToValueAtTime(n.f2, t1);
    const peak = MASTER * gain * (n.g ?? 1) * 0.6;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

export const sfx: Sfx = {
  play(name: SoundName, gain = 1) {
    try {
      if (!getSettings().soundOn) return;
      playNotes(SOUNDS[name], gain);
    } catch {
      /* never let sound break the game */
    }
  },
  unlock: unlockAudio,
  isUnlocked: isAudioUnlocked,
};
