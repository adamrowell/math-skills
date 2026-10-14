/**
 * Round scheduling + adaptive difficulty (docs/GEO-LOGIC.md §E.2–E.3). Pure: no React, no storage.
 *
 * Variety rules for a 10-puzzle round:
 *   ≥ 6 different families · never the same family twice in a row · ≤ 2 per family ·
 *   never the same variant twice · never a puzzle id from `seen` (the last 300 served).
 * Family weight = (1 + 3·(1 − mastery)) × recency × group balance × (1.5 if never played).
 */
import type { ChoiceAnswer, Difficulty, FamilyId, LogicMode, LogicProgress, Puzzle, PuzzleFamily, Rng } from './types';
import { FAST_MS, OK_MS, ROUND_LENGTH } from './types';
import { mulberry32, shuffled } from './rng';
import type { MasteryState } from '../../../drill';
import { masteryScore } from '../../../drill/mastery';

export const SEEN_CAP = 300;
export const MIN_FAMILIES = 6;
export const MAX_PER_FAMILY = 2;

export const factId = (f: FamilyId, d: Difficulty) => `${f}:${d}`;
export const speedFor = (d: Difficulty) => ({ fastMs: FAST_MS[d], okMs: OK_MS[d] });

/** Mean mastery of a family over the difficulties he has a box for (0 when unseen). */
export function familyMastery(m: MasteryState, f: FamilyId): number {
  const vals: number[] = [];
  for (const d of [1, 2, 3] as Difficulty[]) {
    const e = m.facts[factId(f, d)];
    if (e && e.box > 0) vals.push(masteryScore(e, speedFor(d)));
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function everPlayed(m: MasteryState, f: FamilyId): boolean {
  return ([1, 2, 3] as Difficulty[]).some((d) => (m.facts[factId(f, d)]?.attempts ?? 0) > 0);
}

export function levelOf(p: LogicProgress, f: FamilyId): Difficulty {
  const l = p.level[f];
  return l === 2 || l === 3 ? l : 1;
}

export function difficultyFor(mode: LogicMode, p: LogicProgress, f: FamilyId): Difficulty {
  return mode === 'easy' ? 1 : mode === 'medium' ? 2 : mode === 'hard' ? 3 : levelOf(p, f);
}

/** 2 up / 1 down per family, adaptive mode only. */
export function adapt(p: LogicProgress, f: FamilyId, misses: 0 | 1 | 2, mode: LogicMode): LogicProgress {
  if (mode !== 'adaptive') return p;
  let lvl = levelOf(p, f);
  let st = p.streak[f] ?? 0;
  if (misses === 0) {
    st += 1;
    if (st >= 2) {
      if (lvl < 3) lvl = (lvl + 1) as Difficulty;
      st = lvl === 3 ? Math.min(st, 2) : 0;
    }
  } else if (misses === 1) st = 0;
  else {
    lvl = Math.max(1, lvl - 1) as Difficulty;
    st = 0;
  }
  return { ...p, level: { ...p.level, [f]: lvl }, streak: { ...p.streak, [f]: st } };
}

/** Shuffle a choice answer's options (letter options like A–F stay in order). */
export function shuffleChoice(a: ChoiceAnswer, rng: Rng): ChoiceAnswer {
  if (a.options.every((o) => o.text !== undefined && /^[A-F]$/.test(o.text))) return a;
  const idx = shuffled(
    rng,
    a.options.map((_, i) => i),
  );
  return { ...a, options: idx.map((i) => a.options[i]), answerIndex: idx.indexOf(a.answerIndex) };
}

export interface RoundOptions {
  families: PuzzleFamily[];
  mode: LogicMode;
  progress: LogicProgress;
  mastery: MasteryState;
  rng: Rng;
  /** Single-family practice (Brain Map tile). */
  only?: FamilyId;
  length?: number;
}

export interface Round {
  readonly length: number;
  /** Puzzles served so far. */
  readonly served: Puzzle[];
  /** The next puzzle (null when the round is full). */
  next: () => Puzzle | null;
  /** Update the adaptive levels this round uses (after each answer). */
  setProgress: (p: LogicProgress) => void;
}

export function familyWeight(
  f: PuzzleFamily,
  used: FamilyId[],
  groupsUsed: Map<string, number>,
  mastery: MasteryState,
): number {
  const count = used.filter((u) => u === f.id).length;
  if (count >= MAX_PER_FAMILY) return 0;
  const last2 = used.slice(-2);
  const last4 = used.slice(-4);
  let w = 1 + 3 * (1 - familyMastery(mastery, f.id));
  if (last2.includes(f.id)) return 0;
  if (last4.includes(f.id)) w *= 0.4;
  if ((groupsUsed.get(f.group) ?? 0) >= 3) w *= 0.6;
  if (!everPlayed(mastery, f.id)) w *= 1.5;
  return w;
}

export function createRound(o: RoundOptions): Round {
  const length = o.length ?? ROUND_LENGTH;
  let progress = o.progress;
  const seen = new Set(o.progress.seen);
  const served: Puzzle[] = [];
  const used: FamilyId[] = [];
  const variants = new Set<string>();
  const groups = new Map<string, number>();
  const pool = o.only ? o.families.filter((f) => f.id === o.only) : o.families;
  if (!pool.length) throw new Error('no families to play');

  const pickFamily = (exclude: Set<FamilyId>): PuzzleFamily | null => {
    if (o.only) return pool[0];
    const remaining = length - used.length;
    const distinct = new Set(used).size;
    const mustBeNew = distinct + remaining <= Math.min(MIN_FAMILIES, pool.length);
    const cand = pool.filter((f) => !exclude.has(f.id) && (!mustBeNew || !used.includes(f.id)));
    let ws = cand.map((f) => familyWeight(f, used, groups, o.mastery));
    if (ws.every((w) => w <= 0)) ws = cand.map((f) => (f.id === used[used.length - 1] && cand.length > 1 ? 0 : 1));
    const total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let r = o.rng() * total;
    for (let i = 0; i < cand.length; i++) {
      r -= ws[i];
      if (r < 0 && ws[i] > 0) return cand[i];
    }
    return cand.find((_, i) => ws[i] > 0) ?? null;
  };

  const tryFamily = (f: PuzzleFamily): Puzzle | null => {
    const d = difficultyFor(o.mode, progress, f.id);
    let fallback: Puzzle | null = null;
    for (let t = 0; t < 20; t++) {
      const seed = Math.floor(o.rng() * 2 ** 32);
      let p: Puzzle;
      try {
        p = f.generate(d, mulberry32(seed));
      } catch {
        continue;
      }
      if (f.validate(p).length > 0) {
        if (import.meta.env?.DEV) console.warn('[logic] invalid puzzle rejected', p.id, f.validate(p));
        continue;
      }
      const vKey = `${f.id}:${p.variant}`;
      const variantClash = variants.has(vKey) && !(o.only && used.length >= f.variants.length);
      if (!seen.has(p.id) && !variantClash) return p;
      if (!seen.has(p.id) && !served.some((s) => s.id === p.id)) fallback ??= p;
    }
    return o.only ? fallback : null;
  };

  return {
    length,
    served,
    setProgress: (p) => {
      progress = p;
    },
    next: () => {
      if (served.length >= length) return null;
      const tried = new Set<FamilyId>();
      for (let k = 0; k < pool.length + 1; k++) {
        const f = pickFamily(tried);
        if (!f) break;
        tried.add(f.id);
        const p = tryFamily(f);
        if (!p) continue;
        const out: Puzzle = p.answer.kind === 'choice' ? { ...p, answer: shuffleChoice(p.answer, o.rng) } : p;
        served.push(out);
        used.push(f.id);
        variants.add(`${f.id}:${p.variant}`);
        groups.set(f.group, (groups.get(f.group) ?? 0) + 1);
        seen.add(p.id);
        return out;
      }
      return null;
    },
  };
}

/** Append served ids to `seen`, newest last, capped. */
export function withSeen(p: LogicProgress, ids: string[]): LogicProgress {
  const seen = [...p.seen.filter((s) => !ids.includes(s)), ...ids].slice(-SEEN_CAP);
  return { ...p, seen };
}
