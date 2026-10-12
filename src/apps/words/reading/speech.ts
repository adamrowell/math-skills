/**
 * "Tap to hear it" — the browser's text-to-speech (speechSynthesis), tuned for a young reader.
 *
 * While it talks, the microphone must not hear it (it would read the word for him), so the
 * caller gets the speaking window and the voice engine is told to ignore speech meanwhile.
 */
import { suppressVoice, voiceImplemented } from '../../../voice';

let chosen: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (chosen !== undefined && chosen !== null) return chosen;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
    const prefer = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Karen', 'Moira', 'Daniel'];
    chosen =
      prefer.map((n) => en.find((v) => v.name.includes(n))).find(Boolean) ??
      en.find((v) => /en[-_]US/i.test(v.lang) && v.localService) ??
      en.find((v) => /en[-_]US/i.test(v.lang)) ??
      en[0] ??
      null;
    return chosen;
  } catch {
    return null;
  }
}

export function canSpeak(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  } catch {
    return false;
  }
}

/** Window (performance.now() ms) during which the app itself was talking. */
export const speakingWindow = { start: 0, end: 0 };

/** Rough length of an utterance so the mic can ignore it even if `onend` never fires (iOS). */
function estimateMs(text: string, rate: number): number {
  return Math.round((350 + text.length * 75) / rate);
}

/**
 * Say `text`. Returns a promise that resolves when done (or after a timeout).
 * Mic input is suppressed for the duration (+ a short tail).
 */
export function speak(text: string, opts: { rate?: number } = {}): Promise<void> {
  const rate = opts.rate ?? 0.85;
  const est = estimateMs(text, rate);
  const now = performance.now();
  speakingWindow.start = now;
  speakingWindow.end = now + est + 500;
  try {
    if (voiceImplemented) suppressVoice(est + 500);
  } catch {
    /* optional */
  }
  if (!canSpeak()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // The real end is known now: a short tail for the room echo.
      speakingWindow.end = performance.now() + 300;
      resolve();
    };
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = v?.lang ?? 'en-US';
      u.rate = rate;
      u.pitch = 1.05;
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
      setTimeout(finish, est + 1500);
    } catch {
      finish();
    }
  });
}

/** Was this hypothesis (arriving now) possibly the app's own voice? */
export function heardDuringSpeech(latencyMs?: number, durationMs?: number): boolean {
  if (speakingWindow.end === 0) return false; // never talked
  const now = performance.now();
  const end = now - (latencyMs ?? 0);
  const start = end - (durationMs ?? 400);
  return start < speakingWindow.end && end > speakingWindow.start - 200;
}

export function stopSpeaking(): void {
  try {
    if (canSpeak()) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

// Voices load asynchronously in Chrome.
try {
  if (canSpeak()) window.speechSynthesis.onvoiceschanged = () => {
    chosen = undefined;
    pickVoice();
  };
} catch {
  /* ignore */
}
