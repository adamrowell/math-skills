import type { VoiceError } from '../types';

type Platform = 'ios-app' | 'ios' | 'chrome' | 'other';
function platform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);
  if (ios) return (navigator as { standalone?: boolean }).standalone ? 'ios-app' : 'ios';
  if (/Chrome\/|CriOS\/|Edg\//.test(ua)) return 'chrome';
  return 'other';
}

/** The two-line fix for this platform (grown-up reads it). */
export function fixSteps(err: VoiceError | null): string[] {
  if (err?.code === 'insecure-context') return ['This page needs a secure address (https://).', 'Open the app from its https:// link.'];
  if (err?.code === 'unsupported') return ['This browser cannot listen.', 'Try Safari on iPad/iPhone or Chrome on a computer.'];
  if (err?.code === 'no-mic' || err?.code === 'audio-failed') return ['Check that no other app is using the microphone.', 'Then tap Try again.'];
  switch (platform()) {
    case 'ios-app':
      return ['Open Settings → Safari → Microphone → Allow.', 'Still blocked? Remove the app from the Home Screen and add it again.'];
    case 'ios':
      return ['Tap “aA” in the address bar → Website Settings → Microphone → Allow.', 'Then tap Try again.'];
    case 'chrome':
      return ['Tap the lock icon next to the address → Microphone → Allow.', 'Then tap Try again.'];
    default:
      return ["Allow the microphone in this browser's site settings.", 'Then tap Try again.'];
  }
}

