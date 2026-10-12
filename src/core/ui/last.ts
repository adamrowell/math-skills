/**
 * "What did he play last" (ms2:ui:last:v1) — feeds the hub's Continue button (UX-V3 §2.1).
 * Written when a round actually autostarts, so the stored route is always a real round route.
 */
import { createPersistedStore } from '../store/persist';
import { onAutostartConsumed } from '../router/autostart';
import type { AppId } from '../types';

export interface LastPlayed {
  version: 1;
  app: AppId | null;
  route: string | null;
  /** e.g. "Sprint 60" / "Level 2". */
  label: string;
  t: number;
}

export const lastStore = createPersistedStore<LastPlayed>({
  key: 'ms2:ui:last:v1',
  version: 1,
  initial: { version: 1, app: null, route: null, label: '', t: 0 },
});

let pending: { app: AppId; label: string; route?: string; t: number } | null = null;

/** Called by the PLAY tap; committed when the round screen consumes the autostart. */
export function rememberLast(app: AppId, label: string, continueRoute?: string): void {
  pending = { app, label, route: continueRoute, t: Date.now() };
}

onAutostartConsumed((route) => {
  if (!pending || Date.now() - pending.t > 5000) return;
  const seg = route.split('/')[1];
  if (seg !== pending.app) return;
  const p = pending;
  pending = null;
  lastStore.set({ version: 1, app: p.app, route: p.route ?? route, label: p.label, t: Date.now() });
});

export function useLastPlayed(): LastPlayed {
  return lastStore.useStore();
}
