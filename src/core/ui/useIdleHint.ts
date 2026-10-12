/**
 * Idle hint (UX-V3 §3.2): after `after` ms with no pointerdown/keydown on a screen with a primary
 * action, show a pointing hand at the target. Cancels on any input; re-arms after 10 s; at most
 * 3 shows per screen visit; off under prefers-reduced-motion.
 */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

const REARM_MS = 10_000;
const MAX_SHOWS = 3;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function useIdleHint(ref: RefObject<HTMLElement | null>, { after = 5000, on = true }: { after?: number; on?: boolean } = {}): boolean {
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    if (!on || reducedMotion()) {
      setShowing(false);
      return;
    }
    let shows = 0;
    let up = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = (ms: number) => {
      if (timer) clearTimeout(timer);
      if (shows >= MAX_SHOWS) return;
      timer = setTimeout(() => {
        if (!ref.current || document.visibilityState === 'hidden') {
          arm(after);
          return;
        }
        shows += 1;
        up = true;
        setShowing(true);
      }, ms);
    };
    const onInput = () => {
      // After a hint was seen, wait longer before nagging again.
      arm(up ? REARM_MS : after);
      up = false;
      setShowing(false);
    };
    arm(after);
    window.addEventListener('pointerdown', onInput, true);
    window.addEventListener('keydown', onInput, true);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointerdown', onInput, true);
      window.removeEventListener('keydown', onInput, true);
      setShowing(false);
    };
  }, [ref, after, on]);

  // The target's glow pulses faster while the hand is up.
  useEffect(() => {
    const el = ref.current;
    if (!el || !showing) return;
    el.classList.add('is-idle-hint');
    return () => el.classList.remove('is-idle-hint');
  }, [ref, showing]);
  return showing;
}
