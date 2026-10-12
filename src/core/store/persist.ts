/**
 * Versioned localStorage stores with an in-memory fallback (docs/DESIGN.md §3.6).
 * Every storage access is wrapped in try/catch: private mode, blocked storage or a full
 * quota never break the app — the store just keeps working in memory.
 */
import { useSyncExternalStore } from 'react';
import type { PersistedStore, PersistedStoreOptions } from '../types';

let probed: boolean | null = null;

function getStorage(): Storage | null {
  try {
    const s = window.localStorage;
    if (probed === null) {
      const k = 'ms2:__probe';
      s.setItem(k, '1');
      s.removeItem(k);
      probed = true;
    }
    return probed ? s : null;
  } catch {
    probed = false;
    return null;
  }
}

export const persist = {
  /** false when localStorage is unavailable (progress lives in memory only). */
  get available(): boolean {
    return getStorage() !== null;
  },
};

const flushers = new Set<() => void>();

/** Write every pending store now (pagehide / visibility hidden). */
export function flushAllStores(): void {
  flushers.forEach((f) => f());
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readRaw(key: string): unknown {
  const s = getStorage();
  if (!s) return undefined;
  try {
    const txt = s.getItem(key);
    if (txt == null) return undefined;
    return JSON.parse(txt) as unknown;
  } catch {
    return undefined;
  }
}

function kindOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * Top-level shape check against `initial`: a field whose kind differs (null where an object is
 * expected, an object where an array is expected, a string where a number is expected …) falls
 * back to the initial value. Fields whose initial value is null accept anything.
 */
export function conformToInitial<T>(value: Record<string, unknown>, initial: T): T {
  if (!isObject(initial)) return value as T;
  const out: Record<string, unknown> = { ...(initial as Record<string, unknown>), ...value };
  for (const [k, init] of Object.entries(initial as Record<string, unknown>)) {
    if (init === null || init === undefined) continue;
    const v = out[k];
    if (kindOf(v) !== kindOf(init) || (typeof v === 'number' && !Number.isFinite(v))) out[k] = init;
  }
  return out as T;
}

export function createPersistedStore<T>(opts: PersistedStoreOptions<T>): PersistedStore<T> {
  const { key, version, initial, migrate, sanitize } = opts;

  const finish = (v: T): T => {
    let out = isObject(v) ? conformToInitial(v as Record<string, unknown>, initial) : v;
    if (sanitize) {
      try {
        out = sanitize(out);
      } catch {
        return initial;
      }
    }
    return out;
  };

  const hydrate = (raw: unknown): T => {
    if (raw === undefined) return initial;
    const found = isObject(raw) && typeof raw.version === 'number' ? raw.version : null;
    if (found === version && isObject(raw) && isObject(initial)) {
      // Fill fields added since the data was written; repair wrong-typed ones.
      return finish(raw as T);
    }
    if (found === version) return kindOf(raw) === kindOf(initial) ? finish(raw as T) : initial;
    if (migrate) {
      try {
        const m = migrate(raw, found);
        if (m !== undefined) return finish(m);
      } catch {
        /* fall through to reset */
      }
    }
    return initial;
  };

  let state: T = hydrate(readRaw(key));
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const write = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!dirty) return;
    dirty = false;
    const s = getStorage();
    if (!s) return;
    try {
      s.setItem(key, JSON.stringify(state));
    } catch {
      /* quota / blocked: keep in memory */
    }
  };

  const emit = () => listeners.forEach((l) => l());

  const set = (next: T) => {
    if (Object.is(next, state)) return;
    state = next;
    dirty = true;
    if (!timer) timer = setTimeout(write, 250);
    emit();
  };

  flushers.add(write);

  // Another tab changed the same key → adopt it.
  try {
    window.addEventListener('storage', (e) => {
      if (e.key !== key || e.newValue == null) return;
      try {
        state = hydrate(JSON.parse(e.newValue));
        emit();
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* non-browser */
  }

  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const get = () => state;

  function useStore<S = T>(selector?: (s: T) => S): S {
    const snap = () => (selector ? selector(state) : (state as unknown as S));
    return useSyncExternalStore(subscribe, snap, snap);
  }

  return {
    get,
    set,
    hydrate,
    update: (fn) => set(fn(state)),
    subscribe,
    useStore,
    flush: write,
  };
}
