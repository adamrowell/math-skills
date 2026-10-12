/**
 * Device heuristics for iPhone/iPad (builder E). Safari exposes no RAM figure
 * (navigator.deviceMemory is Chromium-only), so we combine what we can see.
 */

const CRASH_KEY = 'ms2:asr-loading';
let hideHooked = false;

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports "Macintosh" — touch points give it away.
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

export function isIPhone(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPod/.test(navigator.userAgent);
}

/** Home-Screen web app (iOS standalone or installed PWA). */
export function isStandalone(): boolean {
  try {
    return (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/**
 * True when the bigger speech model risks the tab being killed for memory:
 *  - Chromium tells us RAM: < 4 GB;
 *  - older/smaller iPhones (≤ 375 pt wide screen: SE, 8, mini — 2–4 GB RAM);
 *  - or the previous model load never finished (the tab was reloaded/killed mid-load).
 */
export function preferSmallSpeechModel(): boolean {
  try {
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    if (typeof mem === 'number' && mem > 0 && mem < 4) return true;
    if (isIPhone() && Math.min(screen.width, screen.height) <= 375) return true;
    return localStorage.getItem(CRASH_KEY) === 'crashed';
  } catch {
    return false;
  }
}

/** Bracket a model load so a crash during it is remembered (see preferSmallSpeechModel). */
export function noteModelLoad(phase: 'start' | 'done' | 'failed'): void {
  try {
    if (phase === 'start') {
      // A normal close/navigation fires pagehide; an out-of-memory kill does not.
      if (!hideHooked) {
        hideHooked = true;
        addEventListener('pagehide', () => {
          try {
            if (localStorage.getItem(CRASH_KEY) === 'start') localStorage.removeItem(CRASH_KEY);
          } catch {
            /* ignore */
          }
        });
      }
      // A 'start' still present from the last visit means that load never finished.
      if (localStorage.getItem(CRASH_KEY) === 'start') localStorage.setItem(CRASH_KEY, 'crashed');
      else if (localStorage.getItem(CRASH_KEY) !== 'crashed') localStorage.setItem(CRASH_KEY, 'start');
    } else if (phase === 'done') {
      if (localStorage.getItem(CRASH_KEY) !== 'crashed') localStorage.removeItem(CRASH_KEY);
    } else {
      localStorage.removeItem(CRASH_KEY);
    }
  } catch {
    /* storage blocked */
  }
}
