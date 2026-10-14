/**
 * The PLAY tap (UX-V3 §2.3). Runs inside the user gesture:
 *   sfx.unlock → armMic (when voice is on and already allowed) → markAutostart → rememberLast.
 * The caller navigates right after; the round screen consumes the autostart and counts down.
 */
import { armMic, micGranted, voiceImplemented } from '../../voice';
import type { VoiceMode } from '../../voice';
import { sfx } from '../sound/sfx';
import { getSettings } from '../settings/settingsStore';
import { markAutostart } from '../router/autostart';
import { rememberLast } from './last';
import type { AppId } from '../types';

/** Apps that never listen (tap-only). */
const NO_MIC = new Set<AppId>(['coordinates', 'maps', 'flags', 'landmarks', 'logic']);
const MODE: Partial<Record<AppId, VoiceMode>> = { words: 'word', sentences: 'sentence' };

/** Open the mic inside the gesture so the round screen can start listening without another tap. */
export function armMicIfAllowed(app?: AppId): void {
  const s = getSettings();
  if (!s.voice.enabled || !voiceImplemented || (app && NO_MIC.has(app))) return;
  // First run (permission never answered): the round screen's MicStep asks instead.
  if (!micGranted()) return;
  try {
    void armMic((app && MODE[app]) || 'number').catch(() => {});
  } catch {
    /* the mic is optional */
  }
}

export interface BeginPlay {
  app: AppId;
  /** What Continue will say, e.g. "Sprint 60 · All". */
  label: string;
  /** The round route the caller is about to open; omitted = whichever round screen mounts next. */
  route?: string;
  /** Route the hub's Continue should open next time (default: the round route that autostarted). */
  continueRoute?: string;
}

let persistAsked = false;
/**
 * Points are a real reward: ask the browser once to keep this site's storage (Safari may otherwise
 * clear it after 7 days without a visit). Silently ignored where unsupported or refused.
 */
export function requestPersistentStorage(): void {
  if (persistAsked) return;
  persistAsked = true;
  try {
    const st = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!st?.persist) return;
    void st
      .persisted()
      .then((already) => (already ? true : st.persist()))
      .catch(() => {});
  } catch {
    /* old engines */
  }
}

export function beginPlay({ app, label, route, continueRoute }: BeginPlay): void {
  sfx.unlock();
  requestPersistentStorage();
  armMicIfAllowed(app);
  markAutostart(route);
  rememberLast(app, label, continueRoute);
}

/** Wraps a "start a round" callback with the PLAY-gesture sequence (format cards inside More). */
export function playStarter(app: AppId, label: string, go: () => void, route?: string): () => void {
  return () => {
    beginPlay({ app, label, route });
    go();
  };
}
