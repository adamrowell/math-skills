/**
 * Core contracts (frozen — see docs/DESIGN.md §3.3).
 *
 * The Shell builder implements these in src/core/** and src/hub/**.
 * The Drill/Multiplication builder imports them via `src/core` (barrel) only.
 */

import type { ComponentType, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// App registry & routing
// ---------------------------------------------------------------------------

export type AppId =
  | 'multiplication'
  | 'division'
  | 'addition'
  | 'mixed'
  | 'coordinates'
  | 'algebra'
  | 'words'
  | 'sentences'
  | 'maps'
  | 'stories';

export type AppGroup = 'math' | 'reading' | 'world';
export type InputKind = 'keypad' | 'voice' | 'pointer';

export interface AppProps {
  /** Hash segments after the app id: `#/multiplication/play/sprint60/all` → ['play','sprint60','all']. */
  segments: string[];
  /** Navigate within the app or elsewhere. `to` is a path like '/multiplication/grid' (leading slash, no '#'). */
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  goHome: () => void;
}

export interface AppDefinition {
  id: AppId;
  title: string;
  emoji: string;
  /** CSS custom property name for the app hue, e.g. '--k-app-multiplication'. */
  color: string;
  tagline: string;
  group: AppGroup;
  /** Hidden apps are absent from the hub and their routes redirect home. */
  enabled: boolean;
  input: InputKind[];
  /** Lazy module whose default export renders the app. Undefined while unbuilt. */
  load?: () => Promise<{ default: ComponentType<AppProps> }>;
}

export interface HashRoute {
  /** '/multiplication/grid' (always starts with '/'; '/' is the hub). */
  path: string;
  /** ['multiplication', 'grid'] — empty for the hub. */
  segments: string[];
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  /** history.back() when the previous entry is ours, else navigate('/'). */
  back: () => void;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export interface PersistedStoreOptions<T> {
  /** 'ms2:<name>:v<version>' */
  key: string;
  version: number;
  initial: T;
  /** Receives any older/foreign shape found under the key; return a valid T or undefined to reset. */
  migrate?: (raw: unknown, foundVersion: number | null) => T | undefined;
  /**
   * Repair a hydrated value (wrong-typed nested fields from an old build, a partial write or an
   * imported file). Runs after the generic top-level type check. Throwing resets to `initial`.
   */
  sanitize?: (value: T) => T;
}

export interface PersistedStore<T> {
  get: () => T;
  set: (next: T) => void;
  update: (fn: (prev: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
  /** React binding via useSyncExternalStore; optional selector for cheap re-renders. */
  useStore: <S = T>(selector?: (state: T) => S) => S;
  /** Force the debounced write now (called on pagehide by the shell). */
  flush: () => void;
  /** Validate/repair a raw stored value exactly as hydration would (used by Import). */
  hydrate: (raw: unknown) => T;
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

/** Local calendar date 'YYYY-MM-DD'. */
export type DateKey = string;

export type PointsKind = 'answer' | 'bonus' | 'trophy' | 'goal' | 'adjust';

export interface PointsEvent {
  id: string;
  ts: number;
  appId: AppId;
  points: number;
  kind: PointsKind;
  note?: string;
}

export interface Redemption {
  id: string;
  ts: number;
  points: number;
  note: string;
}

export type TrophyId =
  | 'first-round'
  | 'combo-10'
  | 'combo-25'
  | 'combo-50'
  | 'speed-demon'
  | 'sharp-shooter'
  | 'perfect-20'
  | 'table-tamer'
  | 'grid-master'
  | 'goal-7'
  | 'goal-30'
  | 'thousand-club'
  | 'ten-k-club';

export interface TrophyDef {
  id: TrophyId;
  title: string;
  emoji: string;
  description: string;
}

export interface RankDef {
  name: string;
  emoji: string;
  /** Lifetime points required. */
  threshold: number;
}

export interface RankInfo {
  rank: RankDef;
  index: number;
  next: RankDef | null;
  /** 0..1 progress from this rank to the next (1 at max rank). */
  progress: number;
  pointsToNext: number;
}

export interface RewardGoal {
  title: string;
  emoji: string;
  targetPoints: number;
  /** Points at the moment the goal was set; progress = lifetime - startPoints. */
  startPoints: number;
  startedAt: number;
}

export interface RewardsState {
  version: 1;
  /** Recent events (≤ 60 days); older ones are compacted into dayTotals. */
  events: PointsEvent[];
  dayTotals: Record<DateKey, number>;
  lifetime: number;
  redeemed: number;
  redemptions: Redemption[];
  /** TrophyId → unlockedAt (ms). */
  trophies: Partial<Record<TrophyId, number>>;
  /** Consecutive days the daily goal was hit. */
  goalStreak: number;
  lastGoalDate: DateKey | null;
  /** Personal bests, e.g. 'multiplication:sprint60:all' → 23. */
  bests: Record<string, number>;
  rewardGoal: RewardGoal | null;
  /** Date the first-round-of-the-day bonus was last paid (any app). */
  lastRoundDate: DateKey | null;
  /** Per app: date its first-round-of-the-day bonus was last paid. */
  roundDates?: Partial<Record<AppId, DateKey>>;
  /** Date the "Mix it up" (3 different apps today) bonus was last paid. */
  mixDate?: DateKey | null;
}

export interface BestResult {
  isNewBest: boolean;
  previous: number | null;
  value: number;
}

export interface RewardsApi {
  addPoints: (appId: AppId, points: number, kind: PointsKind, note?: string) => PointsEvent;
  today: () => number;
  thisWeek: () => number;
  lifetime: () => number;
  /** lifetime − redeemed */
  bank: () => number;
  rank: () => RankInfo;
  redeem: (points: number, note: string) => Redemption;
  /** Returns true when newly unlocked (caller shows the toast). */
  unlockTrophy: (id: TrophyId) => boolean;
  hasTrophy: (id: TrophyId) => boolean;
  recordBest: (key: string, value: number, higherIsBetter: boolean) => BestResult;
  getBest: (key: string) => number | null;
  setRewardGoal: (goal: Omit<RewardGoal, 'startPoints' | 'startedAt'> | null) => void;
  /** True when today's first-round bonus has not been paid yet for this app (does not claim it). */
  firstRoundAvailable: (appId?: AppId) => boolean;
  /**
   * Claim today's first-round bonus for this app; true when it was still available.
   * The third different app claimed in a day also pays the +100 "Mix it up" bonus (with a toast).
   */
  claimFirstRound: (appId?: AppId) => boolean;
  /** Checks goal state after points are added; returns true the moment today's goal is first reached. */
  checkDailyGoal: () => boolean;
  /** Debug/parent: replace the whole state (import). */
  importState: (state: RewardsState) => void;
}

// ---------------------------------------------------------------------------
// Settings (key ms2:settings:v1)
// ---------------------------------------------------------------------------

export interface Settings {
  version: 2;
  kidName: string;
  soundOn: boolean;
  /** Points per day; 200..3000, default 500. */
  dailyGoal: number;
  voice: {
    enabled: boolean;
    /** The mic permission prompt has been answered on this device (granted or "not now"). */
    askedMic?: boolean;
  };
  /** Dev/parent: list disabled apps on the hub (routes still work). */
  showHiddenApps: boolean;
  /** Workbook (vertical) + / − entry order: ones box first (default) or left to right (UX-V3 §5.2). */
  workbookEntry?: 'ones' | 'ltr';
}

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

export type SoundName =
  | 'correct'
  | 'wrong'
  | 'combo'
  | 'tick'
  | 'points'
  | 'roundEnd'
  | 'pb'
  | 'trophy'
  | 'rankUp'
  | 'click'
  | 'pop';

export interface Sfx {
  /** Fire-and-forget; silently no-ops before unlock or when soundOn is false. */
  play: (name: SoundName, gain?: number) => void;
  /** Call from a pointerdown/click handler; idempotent. */
  unlock: () => void;
  isUnlocked: () => boolean;
}

// ---------------------------------------------------------------------------
// Shared UI props
// ---------------------------------------------------------------------------

export interface KeypadProps {
  value: string;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  /** Explicit submit (Enter / ✓). Drills auto-accept, so this mostly triggers a 'wrong' check. */
  onSubmit: () => void;
  disabled?: boolean;
  /** Show a '−' key (Algebra L5+). */
  allowMinus?: boolean;
  onMinus?: () => void;
  /** Bind window keydown for digits/Backspace/Enter/Escape. Default true. */
  keyboard?: boolean;
  size?: 'md' | 'lg';
  /** Accessible label for the whole pad. */
  label?: string;
  /** Answers auto-submit: hide the ✓ key and make 0 double-width (Enter still works). */
  hideSubmit?: boolean;
}

export interface TopBarProps {
  title?: ReactNode;
  onBack: () => void;
  /** Centre slot: timer bar, stopwatch or 'n / 20'. */
  center?: ReactNode;
  /** Right slot: mic chip etc. */
  right?: ReactNode;
  /** Points today; shown as '⭐ 240'. */
  points?: number;
  /** Current combo; renders ComboFlame when ≥ 2. */
  combo?: number;
  comboMultiplier?: number;
}

export interface ComboFlameProps {
  combo: number;
  multiplier: number;
}

export interface PointsBurstHandle {
  /** Spawn a floating '+N' (or '−N') near the anchor element or screen centre. */
  burst: (amount: number, anchor?: HTMLElement | null) => void;
  /** Spawn a big floating word ("DOUBLE!") above the anchor. */
  shout: (text: string, anchor?: HTMLElement | null) => void;
}

export type CelebrationKind = 'small' | 'big' | 'pb' | 'rankUp';

export interface RoundSummaryStat {
  label: string;
  value: string | number;
  emoji?: string;
  highlight?: boolean;
}

export interface RoundSummaryProps {
  title: string;
  emoji?: string;
  stats: RoundSummaryStat[];
  pointsEarned: number;
  /** PB block: label + value, `isNewBest` triggers the fanfare styling. */
  best?: { label: string; value: string | number; isNewBest: boolean; previous?: string | number | null };
  trophies?: TrophyId[];
  rankUp?: RankInfo | null;
  /** Extra line under the best block (e.g. "Get them all right to set a record!"). */
  bestNote?: string;
  /** Round bonuses, shown as small chips under the points. */
  bonusLines?: Array<{ label: string; points: number; emoji?: string }>;
  onAgain: () => void;
  onHome: () => void;
  /** Extra content (e.g. facts that moved up a box). */
  children?: ReactNode;
}

export interface ProgressRingProps {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  color?: string;
}

export interface ToastApi {
  show: (message: string, opts?: { emoji?: string; durationMs?: number; kind?: 'info' | 'success' | 'trophy' }) => void;
}
