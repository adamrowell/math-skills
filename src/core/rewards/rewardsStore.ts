/**
 * Points, bank, ranks, trophies, bests, daily goal (docs/DESIGN.md §1.0.6–1.0.9).
 * Points are credited per answer, so the parent's balance is always consistent.
 */
import type {
  AppId,
  BestResult,
  PointsEvent,
  PointsKind,
  RankInfo,
  Redemption,
  RewardGoal,
  RewardsApi,
  RewardsState,
  TrophyId,
} from '../types';
import { createPersistedStore } from '../store/persist';
import { dateKey, dayStart, lastNDays, thisWeekKeys, yesterdayKey } from '../time/dateKey';
import { getSettings } from '../settings/settingsStore';
import { rankFor } from './ranks';
import { toast } from '../ui/toastStore';

export const INITIAL_REWARDS: RewardsState = {
  version: 1,
  events: [],
  dayTotals: {},
  lifetime: 0,
  redeemed: 0,
  redemptions: [],
  trophies: {},
  goalStreak: 0,
  lastGoalDate: null,
  bests: {},
  rewardGoal: null,
  lastRoundDate: null,
  roundDates: {},
  mixDate: null,
};

/** Bonus for the first round of the day in each app. */
export const FIRST_ROUND_POINTS = 50;
/** Bonus for playing 3 different apps in a day. */
export const MIX_BONUS_POINTS = 100;
export const MIX_BONUS_APPS = 3;
/** After this many points in one app today, that app pays half (try another app!). */
export const APP_SOFT_CAP = 1500;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finiteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Repair nested fields (the store already fixed wrong-typed top-level ones). */
export function sanitizeRewards(s: RewardsState): RewardsState {
  const numMap = (o: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (isObj(o)) for (const [k, v] of Object.entries(o)) if (finiteNum(v)) out[k] = v;
    return out;
  };
  return {
    ...s,
    version: 1,
    events: s.events.filter((e) => isObj(e) && finiteNum(e.points) && finiteNum(e.ts)),
    dayTotals: numMap(s.dayTotals),
    trophies: numMap(s.trophies),
    bests: numMap(s.bests),
    redemptions: s.redemptions.filter((r) => isObj(r) && finiteNum(r.points) && finiteNum(r.ts)),
    lifetime: Math.max(0, s.lifetime),
    redeemed: Math.max(0, s.redeemed),
    goalStreak: Math.max(0, s.goalStreak),
    lastGoalDate: typeof s.lastGoalDate === 'string' ? s.lastGoalDate : null,
    lastRoundDate: typeof s.lastRoundDate === 'string' ? s.lastRoundDate : null,
    roundDates: Object.fromEntries(
      Object.entries(isObj(s.roundDates) ? s.roundDates : {}).filter(([, v]) => typeof v === 'string'),
    ) as RewardsState['roundDates'],
    mixDate: typeof s.mixDate === 'string' ? s.mixDate : null,
    rewardGoal: isObj(s.rewardGoal) && finiteNum(s.rewardGoal.targetPoints) && finiteNum(s.rewardGoal.startPoints) ? s.rewardGoal : null,
  };
}

export const rewardsStore = createPersistedStore<RewardsState>({
  key: 'ms2:rewards:v1',
  version: 1,
  initial: INITIAL_REWARDS,
  sanitize: sanitizeRewards,
});

const EVENT_DAYS = 60;
const MAX_EVENTS = 4000;

let idSeq = 0;
const newId = () => `${Date.now().toString(36)}-${(idSeq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function compact(events: PointsEvent[]): PointsEvent[] {
  const cutoff = dayStart(-EVENT_DAYS);
  let out = events;
  if (out.length && out[0].ts < cutoff) out = out.filter((e) => e.ts >= cutoff);
  if (out.length > MAX_EVENTS) out = out.slice(out.length - MAX_EVENTS);
  return out;
}

/** Goal streak as it stands today (a missed day breaks it). */
export function currentGoalStreak(s: RewardsState = rewardsStore.get()): number {
  if (!s.lastGoalDate) return 0;
  const today = dateKey();
  return s.lastGoalDate === today || s.lastGoalDate === yesterdayKey() ? s.goalStreak : 0;
}

export function dayTotalsFor(keys: string[], s: RewardsState = rewardsStore.get()): number[] {
  return keys.map((k) => s.dayTotals[k] ?? 0);
}

export const rewards: RewardsApi = {
  addPoints(appId: AppId, points: number, kind: PointsKind, note?: string): PointsEvent {
    const ev: PointsEvent = { id: newId(), ts: Date.now(), appId, points: Math.round(points), kind, note };
    if (ev.points === 0) return ev;
    const k = dateKey(ev.ts);
    rewardsStore.update((s) => ({
      ...s,
      events: compact([...s.events, ev]),
      dayTotals: { ...s.dayTotals, [k]: (s.dayTotals[k] ?? 0) + ev.points },
      lifetime: Math.max(0, s.lifetime + ev.points),
    }));
    return ev;
  },
  today: () => rewardsStore.get().dayTotals[dateKey()] ?? 0,
  thisWeek: () => dayTotalsFor(thisWeekKeys()).reduce((a, b) => a + b, 0),
  lifetime: () => rewardsStore.get().lifetime,
  bank: () => {
    const s = rewardsStore.get();
    return Math.max(0, s.lifetime - s.redeemed);
  },
  rank: (): RankInfo => rankFor(rewardsStore.get().lifetime),
  redeem(points: number, note: string): Redemption {
    const r: Redemption = { id: newId(), ts: Date.now(), points: Math.max(0, Math.round(points)), note: note.trim() };
    rewardsStore.update((s) => ({
      ...s,
      redeemed: s.redeemed + r.points,
      redemptions: [r, ...s.redemptions].slice(0, 500),
    }));
    return r;
  },
  unlockTrophy(id: TrophyId): boolean {
    if (rewardsStore.get().trophies[id]) return false;
    rewardsStore.update((s) => ({ ...s, trophies: { ...s.trophies, [id]: Date.now() } }));
    return true;
  },
  hasTrophy: (id: TrophyId) => Boolean(rewardsStore.get().trophies[id]),
  recordBest(key: string, value: number, higherIsBetter: boolean): BestResult {
    const prev = rewardsStore.get().bests[key];
    const previous = typeof prev === 'number' ? prev : null;
    const isNewBest = previous === null || (higherIsBetter ? value > previous : value < previous);
    if (isNewBest) rewardsStore.update((s) => ({ ...s, bests: { ...s.bests, [key]: value } }));
    return { isNewBest, previous, value };
  },
  getBest(key: string): number | null {
    const v = rewardsStore.get().bests[key];
    return typeof v === 'number' ? v : null;
  },
  setRewardGoal(goal: Omit<RewardGoal, 'startPoints' | 'startedAt'> | null): void {
    rewardsStore.update((s) => ({
      ...s,
      rewardGoal: goal ? { ...goal, startPoints: s.lifetime, startedAt: Date.now() } : null,
    }));
  },
  firstRoundAvailable: (appId?: AppId) => firstRoundAvailableIn(rewardsStore.get(), appId),
  claimFirstRound(appId?: AppId): boolean {
    const today = dateKey();
    const s0 = rewardsStore.get();
    if (!firstRoundAvailableIn(s0, appId)) return false;
    rewardsStore.update((s) => ({
      ...s,
      lastRoundDate: today,
      roundDates: appId ? { ...(s.roundDates ?? {}), [appId]: today } : s.roundDates,
    }));
    const s1 = rewardsStore.get();
    if (appId && s1.mixDate !== today && appsPlayedToday(s1).length >= MIX_BONUS_APPS) {
      rewardsStore.update((s) => ({ ...s, mixDate: today }));
      rewards.addPoints(appId, MIX_BONUS_POINTS, 'bonus', 'Mix it up: 3 apps today');
      setTimeout(() => toast.show(`Mix it up! 3 apps today +${MIX_BONUS_POINTS}`, { emoji: '🌈', kind: 'success', durationMs: 3000 }), 600);
    }
    return true;
  },
  checkDailyGoal(): boolean {
    const s = rewardsStore.get();
    const today = dateKey();
    if (s.lastGoalDate === today) return false;
    if ((s.dayTotals[today] ?? 0) < getSettings().dailyGoal) return false;
    const streak = s.lastGoalDate === yesterdayKey() ? s.goalStreak + 1 : 1;
    rewardsStore.update((p) => ({ ...p, goalStreak: streak, lastGoalDate: today }));
    return true;
  },
  importState(state: RewardsState): void {
    rewardsStore.set(rewardsStore.hydrate({ ...INITIAL_REWARDS, ...state, version: 1 }));
  },
};

/** First-round bonus still waiting today for this app (without an app: any app at all today). */
export function firstRoundAvailableIn(s: RewardsState, appId?: AppId): boolean {
  const today = dateKey();
  if (!appId) return s.lastRoundDate !== today;
  return (s.roundDates ?? {})[appId] !== today;
}

/** Apps that have claimed their first-round bonus today. */
export function appsPlayedToday(s: RewardsState = rewardsStore.get()): AppId[] {
  const today = dateKey();
  return (Object.entries(s.roundDates ?? {}) as Array<[AppId, string]>).filter(([, d]) => d === today).map(([a]) => a);
}

/** Points earned in one app today. */
export function appPointsToday(appId: AppId, s: RewardsState = rewardsStore.get()): number {
  const start = dayStart(0);
  let n = 0;
  for (const e of s.events) if (e.appId === appId && e.ts >= start) n += e.points;
  return n;
}

/** Points earned per app over the given day keys (events only cover the last 60 days). */
export function pointsByApp(days: string[], s: RewardsState = rewardsStore.get()): Partial<Record<AppId, number>> {
  const keys = new Set(days);
  const out: Partial<Record<AppId, number>> = {};
  for (const e of s.events) if (keys.has(dateKey(e.ts))) out[e.appId] = (out[e.appId] ?? 0) + e.points;
  return out;
}

/** 1 normally; 0.5 once this app has paid APP_SOFT_CAP points today. */
export function softCapFactor(appId: AppId, s: RewardsState = rewardsStore.get()): number {
  return appPointsToday(appId, s) >= APP_SOFT_CAP ? 0.5 : 1;
}

/** Reactive snapshot for components. */
export function useRewards(): RewardsState {
  return rewardsStore.useStore();
}

export function todayPoints(s: RewardsState): number {
  return s.dayTotals[dateKey()] ?? 0;
}

export function weekPoints(s: RewardsState): number {
  return dayTotalsFor(thisWeekKeys(), s).reduce((a, b) => a + b, 0);
}

export function last7(s: RewardsState): Array<{ key: string; points: number }> {
  return lastNDays(7).map((key) => ({ key, points: s.dayTotals[key] ?? 0 }));
}
