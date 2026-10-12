/**
 * Pure game rules for Maps: target scheduling, choice building, points, stars.
 * (Kept free of React/storage so it is unit-tested in logic.test.ts.)
 */
import type { FactMastery, SpeedThresholds } from '../../drill';
import { masteryScore } from '../../drill/mastery';

export type Rng = () => number;

export const FIND_SPEED: SpeedThresholds = { fastMs: 4000, okMs: 8000 };
export const NAME_SPEED: SpeedThresholds = { fastMs: 3000, okMs: 6000 };
export const MISS_PENALTY = 5;

export interface Candidate {
  id: string;
  prior: number;
}

export interface PickInput {
  candidates: Candidate[];
  mastery: Record<string, FactMastery | undefined>;
  /** Ids asked so far this round, oldest first. */
  asked: string[];
  /** Ids missed this round and not yet answered right since. */
  missed: Set<string>;
  /** Comeback queue: id → question index at which it should come back. */
  comeback: Map<string, number>;
  /** Index of the question being picked. */
  index: number;
  speed: SpeedThresholds;
  rng: Rng;
}

/**
 * Weighted pick: prior × (1 + 3·(1 − mastery)) × missBoost × recency.
 * Missed regions come back 3–5 questions later. With enough candidates a round never repeats.
 */
export function pickTarget(inp: PickInput): string {
  const { candidates, mastery, asked, missed, comeback, index, speed, rng } = inp;
  if (candidates.length === 0) throw new Error('no candidates');
  if (candidates.length === 1) return candidates[0].id;
  const last = asked[asked.length - 1];

  for (const [id, due] of comeback) {
    if (due <= index && id !== last && candidates.some((c) => c.id === id)) return id;
  }

  const n = candidates.length;
  const noRepeat = n >= 12;
  const block = Math.min(Math.ceil(n / 2), 4);
  const recent = asked.slice(-block);
  const weights = candidates.map((c) => {
    if (c.id === last) return 0;
    if (noRepeat && asked.includes(c.id)) return 0;
    let w = c.prior * (1 + 3 * (1 - masteryScore(mastery[c.id], speed)));
    if (missed.has(c.id)) w *= 3;
    if (recent.includes(c.id)) w *= 0.15;
    return w;
  });
  let total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    // Everything blocked (tiny set, long round): allow anything but the last one.
    for (let i = 0; i < n; i++) weights[i] = candidates[i].id === last ? 0 : 1;
    total = weights.reduce((a, b) => a + b, 0);
  }
  let r = rng() * total;
  for (let i = 0; i < n; i++) {
    r -= weights[i];
    if (r < 0 && weights[i] > 0) return candidates[i].id;
  }
  for (let i = n - 1; i >= 0; i--) if (weights[i] > 0) return candidates[i].id;
  return candidates[0].id;
}

/** Schedule a missed id to come back 3–5 questions later. */
export function scheduleComeback(comeback: Map<string, number>, id: string, index: number, rng: Rng): void {
  comeback.set(id, index + 3 + Math.floor(rng() * 3));
}

export interface Point {
  id: string;
  x: number;
  y: number;
}

/**
 * Three choices for Name-it: the answer, its nearest neighbour (a real test) and one more
 * from the nearer half, shuffled.
 */
export function buildChoices(answer: Point, pool: Point[], rng: Rng, count = 3): string[] {
  const others = pool
    .filter((p) => p.id !== answer.id)
    .map((p) => ({ id: p.id, d: Math.hypot(p.x - answer.x, p.y - answer.y) }))
    .sort((a, b) => a.d - b.d);
  const picks: string[] = [];
  if (others.length) picks.push(others[0].id);
  const near = others.slice(1, Math.max(2, Math.ceil(others.length / 2)));
  while (picks.length < count - 1 && near.length) picks.push(near.splice(Math.floor(rng() * near.length), 1)[0].id);
  const rest = others.filter((o) => !picks.includes(o.id));
  while (picks.length < count - 1 && rest.length) picks.push(rest.splice(Math.floor(rng() * rest.length), 1)[0].id);
  const all = [answer.id, ...picks];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

export type Mode = 'find' | 'name';

/**
 * Points for a correct answer.
 *   Find:  first try  8 + 8·prior (+8 ≤ 4 s, +4 ≤ 8 s); after one miss +5; after the reveal 0.
 *   Name:  first try  5 + 4·prior (+4 ≤ 3 s, +2 ≤ 6 s);  after one miss +2; after the reveal 0.
 * First-try points are multiplied by the combo multiplier.
 */
export function answerPoints(opts: { mode: Mode; prior: number; ms: number; misses: number; comboMult: number }): number {
  const { mode, prior, ms, misses, comboMult } = opts;
  if (misses >= 2) return 0;
  if (misses === 1) return mode === 'find' ? 5 : 2;
  const speed = mode === 'find' ? FIND_SPEED : NAME_SPEED;
  const base = mode === 'find' ? 8 + 8 * prior : 5 + 4 * prior;
  const bonus = ms <= speed.fastMs ? (mode === 'find' ? 8 : 4) : ms <= speed.okMs ? (mode === 'find' ? 4 : 2) : 0;
  return Math.round((base + bonus) * comboMult);
}

/** A miss costs 5, but a round's total never goes below zero. */
export function missPenalty(roundPoints: number): number {
  return Math.min(MISS_PENALTY, Math.max(0, roundPoints));
}

export function comboMultiplier(combo: number): number {
  return combo >= 20 ? 1.5 : combo >= 10 ? 1.3 : combo >= 5 ? 1.15 : 1;
}

/** Stars for a round: first-try right out of the round length. */
export function starsFor(firstTry: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const f = firstTry / total;
  if (f >= 1) return 3;
  if (f >= 0.75) return 2;
  if (f >= 0.5) return 1;
  return 0;
}

/** Stars needed on a stage (Find it) to unlock the next stage and that stage's Name-it mode. */
export const UNLOCK_STARS = 2;
