import confetti from 'canvas-confetti';
import type { CelebrationKind } from '../types';

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

let loopEnd = 0;

const COLORS = ['#7C5CFF', '#3D7BFF', '#FFC43D', '#22C55E', '#FF5A5F', '#F43F8E'];

/** Clear any confetti still falling (route changes). */
export function clearCelebration(): void {
  loopEnd = 0;
  try {
    confetti.reset();
  } catch {
    /* optional */
  }
}

/** Confetti bursts. No-op with prefers-reduced-motion. */
export function celebrate(kind: CelebrationKind = 'small'): void {
  if (reducedMotion()) return;
  try {
    if (kind === 'small') {
      void confetti({ particleCount: 40, spread: 60, startVelocity: 35, origin: { y: 0.65 }, colors: COLORS, disableForReducedMotion: true });
      return;
    }
    const duration = kind === 'big' ? 1200 : 2500;
    loopEnd = Date.now() + duration;
    const frame = () => {
      void confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
      void confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
      if (Date.now() < loopEnd) requestAnimationFrame(frame);
    };
    void confetti({ particleCount: 90, spread: 100, origin: { y: 0.55 }, colors: COLORS, disableForReducedMotion: true });
    frame();
  } catch {
    /* optional */
  }
}
