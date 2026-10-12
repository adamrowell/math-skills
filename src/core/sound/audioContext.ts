/**
 * One shared AudioContext, created and resumed inside a user gesture (iOS requirement).
 * The shell calls unlockAudio() on every pointerdown/keydown, and on visibility return.
 */
type AC = typeof AudioContext;

let ctx: AudioContext | null = null;

function ctor(): AC | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AC; webkitAudioContext?: AC };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function getAudioContext(): AudioContext | null {
  return ctx;
}

/** Create/resume the context. Must be called from a gesture handler the first time. Idempotent. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const C = ctor();
      if (!C) return;
      ctx = new C();
      // iOS: play a silent buffer inside the gesture to fully unlock output.
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
    if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
      void ctx.resume().catch(() => {});
    }
  } catch {
    /* audio is optional */
  }
}

export function isAudioUnlocked(): boolean {
  return ctx !== null && ctx.state === 'running';
}
