/**
 * One look for every mic surface (docs/UX-V3.md §4.1): the TopBar chip and the panel under the
 * problem both derive what a 7-year-old sees from the same inputs, so every app shows identical
 * states. Pure function + a small hook that adds the UI-side watchdogs (thinking > 2 s →
 * "say it again"; long silence while he types → "can't hear you").
 */
import { useEffect, useRef, useState } from 'react';
import type { UseVoiceInputResult, VoiceLoadProgress } from '../types';

export type MicLookId =
  | 'off' // talking is off
  | 'tap' // talking is on but the mic is not open (needs a tap)
  | 'arming' // getting the ears ready (permission prompt, engine starting, model download)
  | 'listening'
  | 'hearing'
  | 'thinking'
  | 'heard-ok'
  | 'heard-wrong'
  | 'unsure'
  | 'cant-hear'
  | 'error';

/** What the app judged the last utterance to be; shown in the panel. */
export type HeardChip = {
  kind: 'ok' | 'wrong' | 'unsure' | 'partial';
  text: string;
  /** Bump to show the same chip again (a second "say it again"). */
  id?: number;
};

export interface MicLookInput {
  on: boolean;
  status: UseVoiceInputResult['status'];
  error: UseVoiceInputResult['error'];
  heard?: HeardChip | null;
  /** The heard chip is still fresh (ok: 900 ms, unsure: 1500 ms; wrong: while present). */
  heardFresh?: boolean;
  /** UI watchdog fired: "thinking" lasted too long, or the engine timed out. */
  timedOut?: boolean;
  cantHear?: boolean;
}

export function computeMicLook(i: MicLookInput): MicLookId {
  if (!i.on) return 'off';
  if (i.status === 'error' || i.error) return 'error';
  if (i.status === 'hearing') return 'hearing';
  if (i.heard && i.heardFresh) {
    if (i.heard.kind === 'ok') return 'heard-ok';
    if (i.heard.kind === 'wrong') return 'heard-wrong';
    return 'unsure';
  }
  if (i.status === 'loading') return 'arming';
  if (i.status === 'processing') return i.timedOut ? 'unsure' : 'thinking';
  if (i.timedOut && i.status === 'listening') return 'unsure';
  if (i.status === 'listening') return i.cantHear ? 'cant-hear' : 'listening';
  return 'tap';
}

/** 0..1 while an on-device model is still on its way, else null. */
export function loadFraction(p: VoiceLoadProgress | null, modelState?: string): number | null {
  if (modelState === 'failed' || modelState === 'ready') return null;
  if (!p) return modelState === 'loading' ? 0 : null;
  if (p.phase === 'done' || p.fraction >= 1) return null;
  return Math.max(0, Math.min(1, p.fraction));
}

/** Meter bar height factor from a 0..1 level (spec §4.1): clamp((level × 4) ^ 0.7, 0.1, 1). */
export function meterHeight(level: number): number {
  const h = Math.pow(Math.max(0, level) * 4, 0.7);
  return Math.max(0.1, Math.min(1, h));
}

export const THINKING_MAX_MS = 2000;
export const HEARD_OK_MS = 900;
export const UNSURE_MS = 1500;
export const CANT_HEAR_MS = 15000;

function heardKey(h: HeardChip | null | undefined): string {
  return h ? `${h.kind}:${h.text}:${h.id ?? ''}` : '';
}

/**
 * The look plus UI watchdogs. `typed` = answers typed this round (for "can't hear you": only
 * after ≥ 3 typed answers, ≥ 15 s in, and no sound from him at all since this surface mounted).
 */
export function useMicLook(
  voice: Pick<UseVoiceInputResult, 'status' | 'error' | 'level'>,
  on: boolean,
  heard?: HeardChip | null,
  typed?: number,
  timeoutAt?: number,
): MicLookId {
  const { status } = voice;
  const [now, setNow] = useState(() => Date.now());
  const heardAt = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const thinkingSince = useRef<number | null>(null);
  const mountedAt = useRef<number>(Date.now());
  const everSpoke = useRef(false);

  const key = heardKey(heard);
  if (key !== heardAt.current.key) heardAt.current = { key, at: Date.now() };

  if (status === 'processing') {
    if (thinkingSince.current === null) thinkingSince.current = Date.now();
  } else thinkingSince.current = null;

  // "Can't hear you" is only for a mic that has NEVER picked him up this round, not for a kid who
  // simply prefers typing after he spoke earlier.
  if (status === 'hearing' || voice.level > 0.05) everSpoke.current = true;

  // Re-render at the next deadline so fresh/expired transitions happen on time.
  useEffect(() => {
    const deadlines: number[] = [];
    if (heard && heardAt.current.at) {
      if (heard.kind === 'ok') deadlines.push(heardAt.current.at + HEARD_OK_MS);
      else if (heard.kind !== 'wrong') deadlines.push(heardAt.current.at + UNSURE_MS);
    }
    if (thinkingSince.current !== null) deadlines.push(thinkingSince.current + THINKING_MAX_MS);
    if (timeoutAt) deadlines.push(timeoutAt + UNSURE_MS);
    if (status === 'listening' && (typed ?? 0) >= 3 && !everSpoke.current) deadlines.push(mountedAt.current + CANT_HEAR_MS);
    const t = Date.now();
    const next = deadlines.filter((d) => d > t).sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const id = setTimeout(() => setNow(Date.now()), next - t + 15);
    return () => clearTimeout(id);
  }, [key, status, typed, timeoutAt, now, heard]);

  const t = Math.max(now, Date.now());
  let heardFresh = false;
  if (heard) {
    const age = t - heardAt.current.at;
    heardFresh = heard.kind === 'wrong' ? true : heard.kind === 'ok' ? age < HEARD_OK_MS : age < UNSURE_MS;
  }
  const thinkingTooLong = thinkingSince.current !== null && t - thinkingSince.current >= THINKING_MAX_MS;
  const engineTimeout = !!timeoutAt && t - timeoutAt < UNSURE_MS;
  const cantHear = status === 'listening' && (typed ?? 0) >= 3 && !everSpoke.current && t - mountedAt.current >= CANT_HEAR_MS;
  return computeMicLook({ on, status, error: voice.error, heard, heardFresh, timedOut: thinkingTooLong || engineTimeout, cantHear });
}
