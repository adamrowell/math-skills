import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import type { PointsBurstHandle } from '../types';
import './ui.css';

interface Burst {
  id: number;
  text: string;
  x: number;
  y: number;
  kind: 'pos' | 'neg' | 'big' | 'shout';
}

/** Where a burst starts: just above the anchor's top edge (never behind the problem text). */
function anchorPoint(anchor?: HTMLElement | null): { x: number; y: number } {
  if (!anchor) return { x: window.innerWidth / 2, y: window.innerHeight / 3 };
  const r = anchor.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: Math.max(56, r.top + 8) };
}

/** Floating '+N' numbers. Mount once per screen and call ref.burst(n, anchorEl). */
export const PointsBurst = forwardRef<PointsBurstHandle>(function PointsBurst(_props, ref) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seq = useRef(0);

  const add = useCallback((b: Omit<Burst, 'id'>, ms: number) => {
    const id = ++seq.current;
    setBursts((list) => [...list.slice(-5), { ...b, id }]);
    setTimeout(() => setBursts((list) => list.filter((i) => i.id !== id)), ms);
  }, []);

  const burst = useCallback(
    (amount: number, anchor?: HTMLElement | null) => {
      const { x, y } = anchorPoint(anchor);
      add(
        {
          text: `${amount >= 0 ? '+' : '−'}${Math.abs(amount)}`,
          x: x + (Math.random() * 60 - 30),
          y,
          kind: amount < 0 ? 'neg' : amount >= 30 ? 'big' : 'pos',
        },
        950,
      );
    },
    [add],
  );

  const shout = useCallback(
    (text: string, anchor?: HTMLElement | null) => {
      // Straddle the card's top edge: big enough to feel, never over the problem text.
      const { x, y } = anchorPoint(anchor);
      add({ text, x, y: Math.max(60, y - 18), kind: 'shout' }, 1300);
    },
    [add],
  );

  useImperativeHandle(ref, () => ({ burst, shout }), [burst, shout]);

  return (
    <div className="k-bursts" aria-hidden="true">
      {bursts.map((b) => (
        <span key={b.id} className={`k-burst k-num is-${b.kind}`} style={{ left: b.x, top: b.y }} data-testid="burst">
          {b.text}
        </span>
      ))}
    </div>
  );
});
