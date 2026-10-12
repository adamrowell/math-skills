/**
 * Voice module public barrel (contract: ./types.ts, docs/DESIGN.md §3.3–3.4).
 *
 * Consumers import ONLY from here.
 *
 * Typical number drill:
 *   const voice = useVoiceInput({
 *     enabled: settings.voice.enabled && voiceImplemented && roundRunning,
 *     mode: 'number',
 *     bias: { numbers: [fact.answer] },          // ← lets the on-device scorer force-score it
 *     onTranscript: (h) => {
 *       const r = matchNumberHypothesis(h, { expected: fact.answer, operands: [a, b] });
 *       // r.verdict: 'correct' | 'wrong' | 'unclear' (r.partial → prepend h.text to next final)
 *     },
 *   });
 *   onClick={() => { void voice.start(); startRound(); }}   // start() inside the tap
 */
export * from './types';

export const voiceImplemented = true;

export { DEFAULT_VOICE_PREFS, VAD_PROFILES } from './profiles';
export { useVoiceInput, useVoiceState } from './useVoiceInput';

export { matchNumberAnswer, parseNumbers, parseSingleNumber, isSpokenPrefix } from './match/numbers';
export { matchWord, alignSentence, homophonesOf, wordSimilarity, sentenceWords } from './match/words';
export { matchNumberHypothesis, matchWordHypothesis } from './match/hypothesis';
export { normalizeTranscript, numberToWords } from './match/normalize';
export { phoneticKey } from './match/phonetic';
export { recordCorrection, getCorrections, clearCorrections, getAcceptMargin } from './match/corrections';

export { MicChip } from './ui/MicChip';
export type { MicChipProps } from './ui/MicChip';
export { MicPanel, Meter } from './ui/MicPanel';
export type { MicPanelProps } from './ui/MicPanel';
export { MicTest } from './ui/MicTest';
export { MicReadyNote } from './ui/MicReadyNote';
export { computeMicLook, useMicLook, meterHeight } from './ui/micLook';
export type { HeardChip, MicLookId } from './ui/micLook';
export { heardChipFor } from './ui/heard';

import { getVoiceManager, voicePrefsStore, micGranted as micGrantedImpl } from './manager';
import type { MatchVerdict, VoiceEnginePreference, VoiceMode } from './types';
export { voicePrefsStore };

/**
 * Call synchronously inside the PLAY tap (docs/UX-V3.md §2.3): opens the mic now so the round
 * screen, mounted after navigation and outside the gesture, starts listening without another
 * tap. The open session is handed to the next start() within 5 s, else released. Never throws.
 */
export function armMic(mode: VoiceMode = 'number'): Promise<void> {
  try {
    getVoiceManager().arm(mode);
  } catch {
    /* the mic is optional */
  }
  return Promise.resolve();
}

/** Last known microphone permission (persisted). Never prompts. */
export function micGranted(): boolean {
  return micGrantedImpl();
}
export type { OnDeviceHypothesis } from './engines/onDevice';

/** Start downloading/warming the on-device model at idle (hub mount). Never throws. */
export function preloadVoice(pref?: VoiceEnginePreference): Promise<void> {
  return getVoiceManager()
    .preload(pref)
    .catch(() => {});
}

/** On-device model state right now (no subscription). */
export function voiceModelState(): 'idle' | 'loading' | 'ready' | 'failed' {
  return getVoiceManager().getSnapshot().modelState;
}

/** Try the model download again after a failure (parent "Download again", next hub visit). */
export function retryVoicePreload(): Promise<void> {
  return getVoiceManager()
    .retryPreload()
    .catch(() => {});
}

/** Change the engine preference (persisted); switches immediately if listening. */
export function setVoiceEngine(pref: VoiceEnginePreference): void {
  getVoiceManager().setEngine(pref);
}

/** Ignore mic input for `ms` — call when playing a sound effect while listening. */
export function suppressVoice(ms: number): void {
  getVoiceManager().suppress(ms);
}

/** Release the mic from anywhere (e.g. leaving a screen). */
export function stopVoice(): void {
  getVoiceManager().stop();
}

/** Attach the consumer's verdict to the diagnostics sample for that utterance. */
export function recordVoiceVerdict(utteranceId: number, verdict: MatchVerdict): void {
  getVoiceManager().recordVerdict(utteranceId, verdict);
}

/** Parent-area diagnostics: engine, backend, model, latencies, last 20 transcripts. */
export function getVoiceDiagnostics() {
  return getVoiceManager().diagnostics();
}

export function getVoiceCapabilities() {
  return getVoiceManager().capabilities();
}
