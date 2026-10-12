/**
 * Voice for the reading apps: opens the mic from the GO tap, keeps it open through the round,
 * retargets the recognizer on every new word / sentence (bias), and drops anything that
 * may have been the app's own "hear it" voice.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { updateSettings, useSettings } from '../../../core';
import { useVoiceInput, useVoiceState, voiceImplemented } from '../../../voice';
import type { UseVoiceInputResult, VoiceHypothesis, VoiceMode } from '../../../voice';
import { heardDuringSpeech } from './speech';

export interface ReadingVoice {
  voice: UseVoiceInputResult;
  /** Voice can work on this device (secure context + some engine). */
  supported: boolean;
  /** The mic is (or is about to be) listening. */
  live: boolean;
  /** On-device model download / warm-up 0..1 while it is still on its way, else null. */
  brain: number | null;
  /** Call from a tap handler. Turns voice on in settings when it was off. */
  start: () => void;
  stop: () => void;
  error: string | null;
}

export function useReadingVoice(opts: {
  active: boolean;
  mode: VoiceMode;
  words: string[];
  onHypothesis: (h: VoiceHypothesis) => void;
}): ReadingVoice {
  const settings = useSettings();
  const { modelState } = useVoiceState();
  const cbRef = useRef(opts.onHypothesis);
  useEffect(() => {
    cbRef.current = opts.onHypothesis;
  });
  const enabled = voiceImplemented && settings.voice.enabled && opts.active;
  const wordsKey = opts.words.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bias = useMemo(() => (opts.words.length ? { words: opts.words } : undefined), [wordsKey]);
  const voice = useVoiceInput({
    enabled,
    mode: opts.mode,
    bias,
    onTranscript: (h) => {
      if (heardDuringSpeech(h.latencyMs, h.durationMs)) return;
      cbRef.current(h);
    },
  });
  const supported = voiceImplemented && voice.isSupported && !(voice.error && !voice.error.recoverable);

  const start = useCallback(() => {
    if (!voiceImplemented) return;
    if (!settings.voice.enabled) {
      // Render synchronously so the hook sees enabled=true, then open the mic inside the tap.
      flushSync(() => updateSettings({ voice: { ...settings.voice, enabled: true, askedMic: true } }));
    } else if (!settings.voice.askedMic) {
      updateSettings({ voice: { ...settings.voice, askedMic: true } });
    }
    try {
      void voice.start().catch(() => {});
    } catch {
      /* shown through voice.error */
    }
  }, [settings.voice, voice]);

  const stopRef = useRef(voice.stop);
  useEffect(() => {
    stopRef.current = voice.stop;
  });
  const stop = useCallback(() => stopRef.current(), []);
  useEffect(() => () => stopRef.current(), []);

  const p = voice.loadProgress;
  const brain =
    modelState === 'loading' && p && p.phase !== 'done' && p.fraction < 1 ? Math.max(0, Math.min(1, p.fraction)) : modelState === 'loading' && !p ? 0 : null;

  const s = voice.status;
  const live = enabled && (s === 'listening' || s === 'hearing' || s === 'processing' || s === 'loading');
  let error: string | null = null;
  if (voice.error) {
    const c = voice.error.code;
    error =
      c === 'permission-denied'
        ? 'The microphone is blocked. A grown-up can allow it in Settings.'
        : c === 'insecure-context' || c === 'unsupported'
          ? 'Talking does not work in this browser.'
          : c === 'no-mic'
            ? 'No microphone found.'
            : 'The microphone stopped. Tap to try again.';
  }
  return { voice, supported, live, brain, start, stop, error };
}
