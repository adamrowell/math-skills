/**
 * PLAY on a home screen is the user gesture (docs/UX-V3.md §2.3): the home marks the route it is
 * about to open, and the round screen consumes the mark on mount to skip its ready card.
 */
const KEY = 'ms2:autostart';
const MAX_AGE_MS = 3000;
/** Repeat consumes of the same route inside this window still say yes (React StrictMode remounts). */
const REPEAT_MS = 1500;
/** `markAutostart()` without a route: the next round screen to mount, whatever its route. */
export const ANY_ROUTE = '*';

type Mark = { route: string; t: number };

function norm(route: string): string {
  if (route === ANY_ROUTE) return route;
  const r = route.replace(/^#/, '');
  const p = r.startsWith('/') ? r : `/${r}`;
  return p.replace(/\/+$/, '') || '/';
}

let memory: Mark | null = null;
let consumed: Mark | null = null;

export function markAutostart(route: string = ANY_ROUTE): void {
  const v = { route: norm(route), t: Date.now() };
  memory = v;
  consumed = null;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* in-memory fallback */
  }
}

export function clearAutostart(): void {
  memory = null;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** The current hash route, normalised ('#/a/b/' → '/a/b'). */
export function currentRoute(): string {
  return norm(window.location.hash || '/');
}

/** True once when `route` (default: the current hash route) was marked < 3 s ago; the mark is cleared on read. */
export function consumeAutostart(route: string = currentRoute()): boolean {
  const r = norm(route);
  if (consumed && consumed.route === r && Date.now() - consumed.t < REPEAT_MS) return true;
  let v: Mark | null = memory;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) v = JSON.parse(raw) as Mark;
  } catch {
    /* ignore */
  }
  if (!v || typeof v.t !== 'number' || typeof v.route !== 'string') return false;
  const ok = (v.route === r || v.route === ANY_ROUTE) && Date.now() - v.t < MAX_AGE_MS;
  if (!ok) return false;
  clearAutostart();
  consumed = { route: r, t: Date.now() };
  for (const l of consumeListeners) l(r);
  return true;
}

const consumeListeners = new Set<(route: string) => void>();
/** Called with the route each time an autostart is consumed (feeds "Continue"). */
export function onAutostartConsumed(l: (route: string) => void): () => void {
  consumeListeners.add(l);
  return () => consumeListeners.delete(l);
}
