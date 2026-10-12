/**
 * Tiny hash router: '#/multiplication/play/sprint60/all'.
 * Each navigate() pushes a history entry tagged with our depth so back() knows whether
 * history.back() stays inside the app.
 */
import { useCallback, useSyncExternalStore } from 'react';
import type { HashRoute } from '../types';

interface NavState {
  ms2: number;
}

function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  if (!h || h === '/') return '/';
  const p = h.startsWith('/') ? h : `/${h}`;
  return p.replace(/\/+$/, '') || '/';
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function depth(): number {
  const st = window.history.state as NavState | null;
  return st && typeof st.ms2 === 'number' ? st.ms2 : 0;
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  try {
    if (depth() === 0) window.history.replaceState({ ms2: 0 } satisfies NavState, '');
  } catch {
    /* ignore */
  }
  window.addEventListener('popstate', emit);
  window.addEventListener('hashchange', emit);
}

function subscribe(l: () => void) {
  install();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function navigate(to: string, opts?: { replace?: boolean }): void {
  const path = to.startsWith('/') ? to : `/${to}`;
  if (path === currentPath() && !opts?.replace) return;
  const url = `#${path}`;
  try {
    if (opts?.replace) window.history.replaceState({ ms2: depth() } satisfies NavState, '', url);
    else window.history.pushState({ ms2: depth() + 1 } satisfies NavState, '', url);
  } catch {
    window.location.hash = url;
  }
  emit();
}

/** history.back() while the previous entry is ours, else replace with `fallback`. */
export function back(fallback = '/'): void {
  if (depth() > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

export function useHashRoute(): HashRoute {
  const path = useSyncExternalStore(subscribe, currentPath, () => '/');
  const nav = useCallback((to: string, o?: { replace?: boolean }) => navigate(to, o), []);
  return {
    path,
    segments: path === '/' ? [] : path.slice(1).split('/').map(decodeURIComponent),
    navigate: nav,
    back: () => back(),
  };
}
