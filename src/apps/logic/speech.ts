/** Tiny speechSynthesis wrapper (a copy of the Maps one — no cross-app imports): reads prompts and Brain Coach steps. Silently does nothing where unsupported. */

let voice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined && voice !== null) return voice;
  try {
    const all = window.speechSynthesis.getVoices();
    if (!all.length) return null;
    const en = all.filter((v) => /^en[-_]US/i.test(v.lang));
    const pool = en.length ? en : all.filter((v) => /^en/i.test(v.lang));
    voice =
      pool.find((v) => /samantha|allison|ava|google us english/i.test(v.name)) ?? pool.find((v) => v.localService) ?? pool[0] ?? null;
    return voice;
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

export function speak(text: string, opts: { rate?: number } = {}): void {
  if (!canSpeak()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-US';
    u.rate = opts.rate ?? 0.95;
    u.pitch = 1.05;
    u.volume = 1;
    synth.speak(u);
  } catch {
    /* optional */
  }
}

export function stopSpeaking(): void {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* optional */
  }
}

/**
 * iOS only lets speechSynthesis start from a user gesture; speaking a silent utterance inside the
 * tap that starts a round unlocks it for the rest of the session.
 */
let primed = false;
export function primeSpeech(): void {
  if (primed || !canSpeak()) return;
  primed = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    pickVoice();
  } catch {
    /* optional */
  }
}
