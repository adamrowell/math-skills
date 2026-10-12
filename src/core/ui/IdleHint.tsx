import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useIdleHint } from './useIdleHint';
import './coach.css';

export interface IdleHintProps {
  target: RefObject<HTMLElement | null>;
  /** Off while something else is going on (coach mark up, countdown, busy). */
  on?: boolean;
  after?: number;
}

/** A bobbing 👆 anchored to the bottom-right of `target` when he has not touched anything for a while. */
export function IdleHint({ target, on = true, after = 5000 }: IdleHintProps) {
  const showing = useIdleHint(target, { after, on });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!showing) return;
    const place = () => {
      const r = target.current?.getBoundingClientRect();
      if (!r) return;
      const x = Math.min(window.innerWidth - 48, r.right - 34);
      const y = Math.min(window.innerHeight - 48, r.bottom - 14);
      setPos({ x, y });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [showing, target]);
  if (!showing || !pos) return null;
  return createPortal(
    <span className="k-emoji k-idle-hand" style={{ left: pos.x, top: pos.y }} data-testid="idle-hint" aria-hidden="true">
      👆
    </span>,
    document.body,
  );
}
