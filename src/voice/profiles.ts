import type { VadProfiles, VoicePrefs } from './types';

export const DEFAULT_VOICE_PREFS: VoicePrefs = {
  version: 1,
  engine: 'auto',
  autoStart: true,
  showHeard: true,
};

/**
 * VAD tuning per mode (docs/DESIGN.md §3.4).
 * number: 350 ms of silence ends an answer — fast, and a split "fifty … six" is merged by
 * the drill's partial buffer. sentence: 900 ms so a reading pause does not cut the sentence.
 */
export const VAD_PROFILES: VadProfiles = {
  number: { minSpeechMs: 120, endSilenceMs: 350, maxUtteranceMs: 4000, preRollMs: 300, minSegmentMs: 1000 },
  word: { minSpeechMs: 120, endSilenceMs: 400, maxUtteranceMs: 3000, preRollMs: 300, minSegmentMs: 1000 },
  sentence: { minSpeechMs: 200, endSilenceMs: 900, maxUtteranceMs: 15000, preRollMs: 300, minSegmentMs: 1000 },
};
