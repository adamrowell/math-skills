/**
 * "Turn your phone sideways 🔄" — a banner on phone-portrait screens that need width (Maps round).
 * CSS decides visibility (phone + portrait), so it disappears the moment the phone rotates. It never
 * blocks the screen: the map stays tappable underneath, and the banner hides itself after a while
 * or on ✕ (rotation lock is common on a child's phone).
 */
import { useEffect, useState } from 'react';
import './platform.css';

export function RotateHint({ text = 'Turn your phone sideways', hideAfterMs = 5000 }: { text?: string; hideAfterMs?: number }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHidden(true), hideAfterMs);
    return () => clearTimeout(t);
  }, [hideAfterMs]);
  if (hidden) return null;
  return (
    <div className="pf-rotate" role="status" data-testid="rotate-hint">
      <span className="pf-rotate__phone k-emoji" aria-hidden="true">
        📱
      </span>
      <span className="pf-rotate__text">
        {text} <span className="k-emoji">🔄</span>
      </span>
      <button type="button" className="pf-rotate__x" onClick={() => setHidden(true)} aria-label="Hide" data-testid="rotate-dismiss">
        ✕
      </button>
    </div>
  );
}
