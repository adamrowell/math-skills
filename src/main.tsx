import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import App, { RootErrorBoundary } from './App.tsx';
import { APPS } from './apps/registry';
import './styles/phone.css'; // phone overrides, keep last (UX-V3 §6)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);

// Warm enabled app chunks when idle so the first tap is instant.
const preload = () => APPS.forEach((a) => a.enabled && a.load && void a.load().catch(() => {}));
const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
if (ric) ric(preload);
else setTimeout(preload, 1500);

// The app loaded, so public/404.html's redirect worked: reset its loop guard.
try {
  sessionStorage.removeItem('ms404');
} catch {
  /* storage blocked */
}
