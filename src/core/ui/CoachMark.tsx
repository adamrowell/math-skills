/**
 * Coach mark (UX-V3 §3.1): dark scrim with a rounded cut-out over the target, a speech bubble with a
 * bouncing 👆 and a ghost "Got it". The whole overlay is click-through: ANY tap dismisses it and still
 * does what it would have done (a kid who taps "Times Tables" instead of the highlighted button still
 * gets Times Tables). Escape dismisses too.
 */
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { subscribeToasts, toastSnapshot } from './toastStore';
import './coach.css';

const PAD = 12;

type Rect = { top: number; left: number; width: number; height: number };

function measure(el: HTMLElement | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

export interface CoachMarkProps {
  target: RefObject<HTMLElement | null>;
  text: string;
  onDismiss: () => void;
  /** Extra condition (e.g. not during a countdown). */
  show?: boolean;
}

export function CoachMark({ target, text, onDismiss, show = true }: CoachMarkProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const toasts = useSyncExternalStore(subscribeToasts, toastSnapshot, toastSnapshot);
  const active = show && toasts.length === 0;

  useLayoutEffect(() => {
    if (!active) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setRect(measure(target.current)));
    };
    // Bring the target into view first (phones), then measure.
    try {
      target.current?.scrollIntoView({ block: 'nearest' });
    } catch {
      /* old engines */
    }
    setRect(measure(target.current));
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    // Entrance animations move the target with transforms, which ResizeObserver does not see.
    document.addEventListener('animationend', update, true);
    document.addEventListener('transitionend', update, true);
    const ro = typeof ResizeObserver !== 'undefined' && target.current ? new ResizeObserver(update) : null;
    if (ro && target.current) ro.observe(target.current);
    const t = setInterval(update, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('animationend', update, true);
      document.removeEventListener('transitionend', update, true);
    };
  }, [active, target]);

  // Escape dismisses; any press dismisses, and the press still reaches whatever is under it.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    const onDown = (e: Event) => {
      // "Got it" dismisses on its own click (dismissing on pointerdown would drop the click on the card below).
      if (e.target instanceof Element && e.target.closest('.k-coach__ok')) return;
      onDismiss();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [active, onDismiss]);

  if (!active || !rect) return null;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const below = rect.top + rect.height / 2 < vh * 0.55;
  const bubbleTop = below ? rect.top + rect.height + 18 : undefined;
  const bubbleBottom = below ? undefined : vh - rect.top + 18;
  const cx = Math.max(24, Math.min(vw - 24, rect.left + rect.width / 2));
  const bubbleW = Math.min(440, vw - 32);
  const bubbleLeft = Math.max(16, Math.min(vw - 16 - bubbleW, cx - bubbleW / 2));
  const arrowX = cx - bubbleLeft;
  const dismiss = (e: { stopPropagation: () => void; preventDefault: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
    onDismiss();
  };
  const r = rect;
  return createPortal(
    <div className="k-coach" data-testid="coach" role="dialog" aria-label={text}>
      {/* Purely visual: taps go through to the page (the document pointerdown listener dismisses). */}
      <div className="k-coach__hole" style={{ top: r.top, left: r.left, width: r.width, height: r.height }} />
      <div
        className={`k-coach__bubble${below ? ' is-below' : ' is-above'}`}
        style={{ top: bubbleTop, bottom: bubbleBottom, left: bubbleLeft, width: bubbleW, ['--arrow-x' as string]: `${arrowX}px` }}
      >
        <span className="k-emoji k-coach__hand" aria-hidden="true">
          {below ? '👆' : '👇'}
        </span>
        <span className="k-coach__text">{text}</span>
        <button type="button" className="k-coach__ok" onClick={dismiss} data-testid="coach-ok">
          Got it
        </button>
      </div>
    </div>,
    document.body,
  );
}
