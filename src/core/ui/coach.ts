/** First-time tour state (UX-V3 §3.1): each of the three coach marks shows once per device. */
import { createPersistedStore, persist } from '../store/persist';

export type CoachStep = 'hub' | 'home' | 'play';
export interface CoachState {
  version: 1;
  hub: boolean;
  home: boolean;
  play: boolean;
}

export const coachStore = createPersistedStore<CoachState>({
  key: 'ms2:coach:v1',
  version: 1,
  initial: { version: 1, hub: false, home: false, play: false },
});

export function coachDone(step: CoachStep): void {
  if (coachStore.get()[step]) return;
  coachStore.update((s) => ({ ...s, [step]: true }));
  coachStore.flush(); // a reload right after must not show it again
}

/** Grown-ups → "Show the tips again". */
export function resetCoach(): void {
  coachStore.set({ version: 1, hub: false, home: false, play: false });
}

/** Without storage the tour could never be marked seen: skip it rather than show it every visit. */
export function useCoachPending(step: CoachStep): boolean {
  const done = coachStore.useStore((s) => s[step]);
  return !done && persist.available;
}
