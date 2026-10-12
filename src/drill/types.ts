/**
 * Fast-facts drill engine contracts (frozen — see docs/DESIGN.md §1.0.4, §1.1, §3.5).
 *
 * The Drill builder implements these in src/drill/**. Each fast-facts app
 * (multiplication, division, addition, mixed) supplies a FactGenerator and a home screen.
 */

import type { AppId } from '../core/types';
import type { VoiceHypothesis } from '../voice/types';

// ---------------------------------------------------------------------------
// Facts & generators
// ---------------------------------------------------------------------------

export type FactOp = '×' | '÷' | '+' | '−';

export interface SpeedThresholds {
  /** ≤ fastMs → +10 speed bonus */
  fastMs: number;
  /** ≤ okMs → +6; ≤ 2·okMs → +3; else 0 */
  okMs: number;
}

export interface Fact {
  /** Stable id used as the mastery key, e.g. 'mul:7x8', 'div:56/8', 'add:2d2d-carry'. */
  id: string;
  /** Display text, e.g. '7 × 8'. */
  prompt: string;
  answer: number;
  operands: number[];
  op: FactOp;
  /** Difficulty prior 0.1..2.0 (docs §1.1 table). Drives both selection weight and the difficulty bonus. */
  prior: number;
  /** Mastery grid coordinates, when the generator has a grid. */
  row?: number;
  col?: number;
  /** Per-fact override of the generator's speed thresholds (Mixed uses this). */
  speed?: SpeedThresholds;
  /** Mirror fact that receives half-strength mastery updates (7×8 ↔ 8×7). */
  mirrorId?: string;
  tags?: string[];
}

export interface FactSetDescriptor {
  /** 'all' | 'easy' | 'hard' | 'weak' | 'table-7' ... */
  id: string;
  title: string;
  emoji?: string;
  /** Short chip label, e.g. '×7'. */
  chip?: string;
  description?: string;
  /** Points multiplier for this set (easy sets pay less, hard/tricky a bit more). Default 1. */
  pointsMult?: number;
  /** Sets that earn the first-round-of-the-day bonus. */
  bonusEligible?: boolean;
}

export interface MasteryGridSpec {
  rows: number[];
  cols: number[];
  rowLabel: (row: number) => string;
  colLabel: (col: number) => string;
  /** Fact id at a cell, or null for an empty cell. */
  cellFactId: (row: number, col: number) => string | null;
  /** Set id to practise when a row header is tapped (e.g. 'table-7'). */
  rowSetId?: (row: number) => string | undefined;
  colSetId?: (col: number) => string | undefined;
}

export interface FactGenerator {
  appId: AppId;
  /** Every fact the generator can ask (used for grid + weak-set computation). */
  allFacts: () => Fact[];
  sets: () => FactSetDescriptor[];
  /**
   * Facts for a set. `mastery` lets dynamic sets ('weak') choose. For bucket generators
   * (Addition) this returns one template Fact per bucket; `instantiate` creates the concrete problem.
   */
  factsForSet: (setId: string, mastery: MasteryState) => Fact[];
  /** Turn a template/bucket fact into a concrete problem. Identity for table facts. */
  instantiate?: (fact: Fact, rng: () => number) => Fact;
  grid?: MasteryGridSpec;
  speed: SpeedThresholds;
  /** Voice matcher ceiling for this app (144 for ×, 198 for 2-digit +). */
  maxPlausible: number;
  /** Optional one-time seeding from another app's mastery (Division ← Multiplication). */
  seedMastery?: (own: MasteryState, read: (appId: AppId) => MasteryState | null) => MasteryState;
}

// ---------------------------------------------------------------------------
// Mastery (key ms2:mastery:<appId>:v1)
// ---------------------------------------------------------------------------

export type LeitnerBox = 0 | 1 | 2 | 3 | 4 | 5;

export interface FactMastery {
  box: LeitnerBox;
  attempts: number;
  correct: number;
  /** EMA of correct-answer times, ms (α = 0.3). 0 when never correct. */
  avgMs: number;
  bestMs: number;
  lastSeen: number;
  lastWrong: number;
}

export interface MasteryState {
  version: 1;
  facts: Record<string, FactMastery>;
  seededFrom?: AppId;
}

export type SpeedTier = 'fast' | 'ok' | 'slow' | 'none';

export interface MasteryUpdate {
  factId: string;
  correct: boolean;
  ms: number;
  tier: SpeedTier;
  /** true → apply the half-strength mirror rule. */
  mirror?: boolean;
}

/** 0..1: 0.7·box/5 + 0.3·speedScore (docs §1.1). */
export type MasteryScoreFn = (m: FactMastery | undefined, speed: SpeedThresholds) => number;

export type ApplyMasteryFn = (state: MasteryState, update: MasteryUpdate, now: number) => MasteryState;

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export interface SchedulerInput {
  facts: Fact[];
  mastery: MasteryState;
  speed: SpeedThresholds;
  /** Ids of recently asked facts, most recent last (recency penalty: last 3 → 0, next 3 → 0.3). */
  recent: string[];
  /** factId → wrong count this session (wrongBoost ×4 until answered correctly twice since). */
  sessionWrong: Record<string, number>;
  /** factId → correct count since the last wrong this session. */
  sessionRecovered: Record<string, number>;
  /** Comeback queue: [factId, dueAtQuestionIndex]; preempts sampling when due. */
  comeback: Array<{ factId: string; dueAt: number }>;
  questionIndex: number;
  rng?: () => number;
}

export interface SchedulerPick {
  fact: Fact;
  /** For diagnostics / tests. */
  weight: number;
  viaComeback: boolean;
}

export type PickNextFact = (input: SchedulerInput) => SchedulerPick;

/** prior × (1 + 3·(1 − mastery)) × wrongBoost × recency */
export type WeightForFact = (
  fact: Fact,
  mastery: FactMastery | undefined,
  speed: SpeedThresholds,
  sessionWrongCount: number,
  sessionRecoveredCount: number,
  recencyIndex: number | null,
) => number;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ScoreInput {
  fact: Fact;
  ms: number;
  /** Combo AFTER counting this correct answer. */
  combo: number;
  /** 1 = first try; > 1 (the retype) scores 0. */
  attempt: number;
  speed: SpeedThresholds;
  /** Set multiplier (FactSetDescriptor.pointsMult). Default 1. */
  pointsMult?: number;
  /** Leitner box of the fact before this answer (gold facts pay less). */
  box?: number;
}

export interface ScoreBreakdown {
  base: number;
  speed: number;
  difficulty: number;
  comboMultiplier: number;
  setMultiplier: number;
}

export interface ScoreResult {
  points: number;
  tier: SpeedTier;
  breakdown: ScoreBreakdown;
}

export type ScoreAnswer = (input: ScoreInput) => ScoreResult;

export interface RoundBonuses {
  /** +50 when a PB is set. */
  newBest: number;
  /** +25 when accuracy ≥ 95 % with ≥ 15 answers. */
  sharpShooter: number;
  /** +40 when accuracy = 100 % with ≥ 10 answers. */
  perfect: number;
  /** First real round of the day on a full/hard set. */
  firstRound: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export type RoundFormatId = 'sprint60' | 'challenge20' | 'practice';

export interface RoundFormat {
  id: RoundFormatId;
  title: string;
  emoji: string;
  description: string;
  /** Sprint: fixed duration. */
  durationMs?: number;
  /** Challenge / Practice: fixed count. */
  questionCount?: number;
  /** Which number is the PB for this format. */
  bestMetric: 'correctCount' | 'elapsedMs' | 'none';
  /** Show the timer bar / stopwatch. */
  showTimer: boolean;
}

export interface RoundConfig {
  appId: AppId;
  format: RoundFormat;
  setId: string;
}

export type AnswerVia = 'keypad' | 'keyboard' | 'voice';

export interface AnswerEvent {
  factId: string;
  prompt: string;
  answer: number;
  correct: boolean;
  /** Problem shown → accepted/judged, ms. */
  ms: number;
  attempt: number;
  via: AnswerVia;
  points: number;
  /** Combo after this answer. */
  combo: number;
  tier: SpeedTier;
  /** Typed/heard value when wrong. */
  given?: number;
}

export type RoundStatus = 'ready' | 'running' | 'retype' | 'paused' | 'finished';

export interface RoundState {
  status: RoundStatus;
  config: RoundConfig;
  current: Fact | null;
  /** Typed digits for the current problem. */
  input: string;
  questionIndex: number;
  elapsedMs: number;
  /** Sprint only. */
  remainingMs: number | null;
  answered: AnswerEvent[];
  correctCount: number;
  wrongCount: number;
  combo: number;
  bestCombo: number;
  points: number;
  /** Points multiplier of the set being played (shown as a chip when ≠ 1). */
  pointsMult: number;
  lastVerdict: 'correct' | 'wrong' | null;
  /** Latest voice text to show in the heard bubble (cleared on next problem). */
  heard: string | null;
  /** Spoken-prefix buffer awaiting the rest ("fifty" … "six"). */
  pendingPartial: string | null;
  bonuses: RoundBonuses | null;
  /**
   * Personal best. `eligible` false → the round did not qualify (e.g. a Race with wrong
   * answers), so nothing was recorded and the summary says how to set one.
   */
  best: { key: string; value: number; isNewBest: boolean; previous: number | null; eligible: boolean } | null;
  /** How the round ended: 'complete' (clock/count) or 'quit' (stopped early). */
  endReason: 'complete' | 'quit' | null;
}

export interface UseDrillRoundOptions {
  generator: FactGenerator;
  format: RoundFormat;
  setId: string;
  /** Called once when the round finishes (after rewards/mastery are persisted). */
  onFinished?: (state: RoundState) => void;
}

export interface UseDrillRound {
  state: RoundState;
  /** Starts the timer and shows the first problem. Call from the tap handler (unlocks audio/mic). */
  start: () => void;
  typeDigit: (digit: string, via?: AnswerVia) => void;
  backspace: () => void;
  clear: () => void;
  /** Explicit submit (Enter / ✓): judges whatever is typed. */
  submit: () => void;
  /** Feed a voice hypothesis; the hook runs matchNumberAnswer against the current fact. */
  onVoiceTranscript: (hyp: VoiceHypothesis) => void;
  pause: () => void;
  resume: () => void;
  /** End early (TopBar back). Points already credited stay. */
  end: () => void;
  /** Reset to 'ready' with the same config (summary → Again). */
  reset: () => void;
}

export type UseDrillRoundHook = (options: UseDrillRoundOptions) => UseDrillRound;

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export interface DrillScreenProps {
  generator: FactGenerator;
  format: RoundFormat;
  setId: string;
  /** Title for TopBar / summary, e.g. 'Sprint 60 · ×7'. */
  title: string;
  onExit: () => void;
  /** Summary → Again re-runs the same config (default) or lets the app pick. */
  onAgain?: () => void;
}

export interface MasteryGridProps {
  generator: FactGenerator;
  mastery: MasteryState;
  onCell?: (fact: Fact, mastery: FactMastery | undefined) => void;
  onRowHeader?: (row: number, setId: string | undefined) => void;
  onColHeader?: (col: number, setId: string | undefined) => void;
  /** Highlight these fact ids (e.g. facts that moved up a box this round). */
  highlight?: string[];
}

export interface RoundPickerProps {
  formats: RoundFormat[];
  sets: FactSetDescriptor[];
  selectedSetId: string;
  onSelectSet: (setId: string) => void;
  onStart: (format: RoundFormat, setId: string) => void;
  /** Best values keyed by `${formatId}:${setId}` for display. */
  bests: Record<string, number | null>;
}
