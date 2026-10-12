import type { Settings } from '../types';
import { createPersistedStore } from '../store/persist';

export const DEFAULT_SETTINGS: Settings = {
  version: 2,
  kidName: '',
  soundOn: true,
  dailyGoal: 500,
  voice: { enabled: true },
  showHiddenApps: false,
  workbookEntry: 'ones',
};

export const settingsStore = createPersistedStore<Settings>({
  key: 'ms2:settings:v1',
  version: 2,
  initial: DEFAULT_SETTINGS,
  // v1 → v2: the points economy was retuned; move the old default goal (300) to the new one.
  migrate: (raw, found) => {
    if (found !== 1 || !raw || typeof raw !== 'object') return undefined;
    const r = raw as Partial<Settings>;
    const goal = typeof r.dailyGoal === 'number' && r.dailyGoal !== 300 ? r.dailyGoal : DEFAULT_SETTINGS.dailyGoal;
    return sanitizeSettings({ ...r, dailyGoal: goal, version: 2 });
  },
  sanitize: (s) => sanitizeSettings(s),
});

/** Coerce anything settings-shaped into valid Settings (imported files, old versions). */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const voice = r.voice && typeof r.voice === 'object' ? (r.voice as Record<string, unknown>) : {};
  const goal = typeof r.dailyGoal === 'number' && Number.isFinite(r.dailyGoal) ? r.dailyGoal : d.dailyGoal;
  return {
    ...d,
    ...r,
    version: 2,
    kidName: typeof r.kidName === 'string' ? r.kidName : d.kidName,
    soundOn: typeof r.soundOn === 'boolean' ? r.soundOn : d.soundOn,
    dailyGoal: Math.max(100, Math.min(10000, Math.round(goal))),
    voice: { ...d.voice, ...voice, enabled: typeof voice.enabled === 'boolean' ? voice.enabled : d.voice.enabled },
    showHiddenApps: typeof r.showHiddenApps === 'boolean' ? r.showHiddenApps : d.showHiddenApps,
    workbookEntry: r.workbookEntry === 'ltr' ? 'ltr' : 'ones',
  } as Settings;
}

export function useSettings(): Settings {
  return settingsStore.useStore();
}

export function updateSettings(patch: Partial<Settings>): void {
  settingsStore.update((s) => ({ ...s, ...patch }));
}

export function getSettings(): Settings {
  return settingsStore.get();
}
