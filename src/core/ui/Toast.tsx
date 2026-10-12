import { useSyncExternalStore } from 'react';
import { subscribeToasts, toastSnapshot } from './toastStore';
import './ui.css';

/** Rendered once by the shell. */
export function ToastHost() {
  const list = useSyncExternalStore(subscribeToasts, toastSnapshot, toastSnapshot);
  return (
    <div className="k-toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`k-toast k-toast--${t.kind}`}>
          {t.emoji && <span className="k-emoji k-toast__emoji">{t.emoji}</span>}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
