/**
 * Per-app home UI memory (ms2:ui:<app>:v1): last chosen set/level and whether "More ways to play"
 * is open. One store per app so fields written by different components never clobber each other.
 */
import { createPersistedStore } from '../store/persist';
import type { AppId, PersistedStore } from '../types';

export interface AppUiState {
  version: 1;
  setId: string;
  moreOpen: boolean;
}

const stores = new Map<AppId, PersistedStore<AppUiState>>();

export function appUiStore(appId: AppId): PersistedStore<AppUiState> {
  let s = stores.get(appId);
  if (!s) {
    s = createPersistedStore<AppUiState>({
      key: `ms2:ui:${appId}:v1`,
      version: 1,
      initial: { version: 1, setId: 'all', moreOpen: false },
    });
    stores.set(appId, s);
  }
  return s;
}
