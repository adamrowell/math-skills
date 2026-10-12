/** Core barrel — the only import path apps use for shell services and shared UI. */
export * from './types';

export { createPersistedStore, persist, flushAllStores } from './store/persist';
export { dateKey, lastNDays, thisWeekKeys, shortDayName } from './time/dateKey';
export { settingsStore, useSettings, updateSettings, getSettings, DEFAULT_SETTINGS } from './settings/settingsStore';
export {
  rewards,
  rewardsStore,
  useRewards,
  todayPoints,
  weekPoints,
  last7,
  currentGoalStreak,
  INITIAL_REWARDS,
  firstRoundAvailableIn,
  appsPlayedToday,
  appPointsToday,
  pointsByApp,
  softCapFactor,
  FIRST_ROUND_POINTS,
  MIX_BONUS_POINTS,
  MIX_BONUS_APPS,
  APP_SOFT_CAP,
} from './rewards/rewardsStore';
export { RANKS, rankFor } from './rewards/ranks';
export { TROPHIES, trophyDef } from './rewards/trophies';
export { awardTrophy, checkLifetimeTrophies, checkGoalAndAnnounce } from './rewards/award';
export { sfx } from './sound/sfx';
export { getAudioContext, unlockAudio } from './sound/audioContext';
export { useHashRoute, navigate, back } from './router/useHashRoute';

export { Keypad } from './ui/Keypad';
export { TopBar, ComboFlame } from './ui/TopBar';
export { BigButton } from './ui/BigButton';
export { PointsBurst } from './ui/PointsBurst';
export { ProgressRing } from './ui/ProgressRing';
export { RoundSummary } from './ui/RoundSummary';
export { ToastHost } from './ui/Toast';
export { toast } from './ui/toastStore';
export { celebrate, clearCelebration } from './ui/Celebration';
export { PlayButton } from './ui/PlayButton';
export type { PlayButtonProps, PlayButtonVariant } from './ui/PlayButton';
export { AppHome, HomeMicToggle } from './ui/AppHome';
export type { AppHomeProps, AppHomeMore } from './ui/AppHome';
export { appUiStore } from './ui/appUi';
export type { AppUiState } from './ui/appUi';
export { CoachMark } from './ui/CoachMark';
export { coachStore, coachDone, resetCoach, useCoachPending } from './ui/coach';
export type { CoachStep } from './ui/coach';
export { IdleHint } from './ui/IdleHint';
export { useIdleHint } from './ui/useIdleHint';
export { beginPlay, armMicIfAllowed, playStarter } from './ui/startPlay';
export { lastStore, rememberLast, useLastPlayed } from './ui/last';
export type { LastPlayed } from './ui/last';
export { markAutostart, consumeAutostart, clearAutostart, currentRoute } from './router/autostart';

import { rewardsStore, todayPoints } from './rewards/rewardsStore';
/** Points earned today (reactive). */
export function useTodayPoints(): number {
  return rewardsStore.useStore(todayPoints);
}
