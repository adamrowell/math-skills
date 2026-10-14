/**
 * Pure rules for the Flags app (docs/GEO-LOGIC.md §C): levels, distractors, the spotter grid,
 * points and sticker collection. No React, no storage — unit-tested in logic.test.ts.
 */
import { answerPoints } from '../maps/logic';
import type { Rng } from '../maps/logic';
import { FLAGS, TWINS } from './data/flags';
import type { FlagDef } from './data/flags';

export type LevelId = 'famous' | 'world' | 'lookalikes' | 'all';
export type FlagMode = 'find' | 'which';

export interface LevelDef {
  id: LevelId;
  title: string;
  emoji: string;
  /** Country codes (alpha-2) asked on this level. */
  flags: string[];
}

const tier = (...t: number[]) => FLAGS.filter((x) => t.includes(x.tier)).map((x) => x.cc);

/** Tier-3 flags plus every flag that shares a look-alike group with one of them. */
function lookalikeLevel(): string[] {
  const t3 = FLAGS.filter((x) => x.tier === 3);
  const groups = new Set(t3.flatMap((x) => x.groups));
  return FLAGS.filter((x) => x.tier === 3 || x.groups.some((g) => groups.has(g))).map((x) => x.cc);
}

export const LEVELS: LevelDef[] = [
  { id: 'famous', title: 'Famous Flags', emoji: '⭐', flags: tier(1) },
  { id: 'world', title: 'World Flags', emoji: '🌍', flags: tier(1, 2) },
  { id: 'lookalikes', title: 'Look-alikes', emoji: '👯', flags: lookalikeLevel() },
  { id: 'all', title: 'All Flags', emoji: '🏆', flags: FLAGS.map((x) => x.cc) },
];

/**
 * Countries far too small to find on a world map, even zoomed (Monaco, Andorra, Bahrain, Qatar):
 * left out of Find it (still in Which flag?, Spotter and the album, where the flag is the point).
 */
export const TOO_SMALL_TO_FIND: ReadonlySet<string> = new Set(['mc', 'ad', 'bh', 'qa']);

/** The flags asked in Find it on a level. */
export const findFlags = (level: LevelDef): string[] => level.flags.filter((cc) => !TOO_SMALL_TO_FIND.has(cc));

export const levelById = (id: string): LevelDef | undefined => LEVELS.find((l) => l.id === id);

export const ROUND_LENGTH = 12;
export const UNLOCK_STARS = 2;
export const SPOTTER_SECONDS = 45;
export const SPOTTER_CELLS = 6;
export const SPOTTER_MISS = 5;
/** Find it with the name hidden ("Whose flag is this?") pays half again. */
export const NAME_HIDDEN_BONUS = 1.5;

function shuffle<T>(a: T[], rng: Rng): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const sharedColors = (a: FlagDef, b: FlagDef) => [...new Set(a.colors)].filter((c) => b.colors.includes(c)).length;

/** Flags that share a look-alike group with `f`. */
export function lookalikesOf(f: FlagDef, pool: readonly FlagDef[]): FlagDef[] {
  return pool.filter((o) => o.cc !== f.cc && o.groups.some((g) => f.groups.includes(g)));
}

/**
 * Four (or `count`) flags for "Which flag?": the answer, 1–2 look-alikes, then flags with ≥ 2 shared
 * colours, then the same continent, then anything. Never a flag that was wrong in the last
 * questions (`avoid`), never the answer twice. Shuffled.
 */
export function buildFlagChoices(answer: FlagDef, pool: readonly FlagDef[], rng: Rng, avoid: readonly string[] = [], count = 4): string[] {
  const others = pool.filter((o) => o.cc !== answer.cc && o.cc !== TWINS[answer.cc] && !avoid.includes(o.cc));
  const picked: FlagDef[] = [];
  const take = (list: FlagDef[], n: number) => {
    for (const x of shuffle(list, rng)) {
      if (picked.length >= count - 1 || n <= 0) break;
      if (!picked.includes(x)) {
        picked.push(x);
        n--;
      }
    }
  };
  const look = lookalikesOf(answer, others);
  take(look, look.length >= 2 && rng() < 0.6 ? 2 : 1);
  take(others.filter((o) => sharedColors(o, answer) >= 2), count);
  take(others.filter((o) => o.continent === answer.continent), count);
  take(others, count);
  // A tiny pool after `avoid`: fall back to the whole pool.
  if (picked.length < count - 1) take(pool.filter((o) => o.cc !== answer.cc && o.cc !== TWINS[answer.cc]), count);
  return shuffle([answer.cc, ...picked.map((p) => p.cc)], rng);
}

/**
 * Spotter grid: `cells` distinct flags including the target and (when one exists) one look-alike.
 * The target never sits in `prevCell` (the cell it was in last time).
 */
export function spotterGrid(target: FlagDef, pool: readonly FlagDef[], rng: Rng, prevCell = -1, cells = SPOTTER_CELLS): { flags: string[]; cell: number } {
  const others = pool.filter((o) => o.cc !== target.cc && o.cc !== TWINS[target.cc]);
  const look = shuffle(lookalikesOf(target, others), rng);
  const similar = shuffle(others.filter((o) => sharedColors(o, target) >= 2 && !look.includes(o)), rng);
  const pick: FlagDef[] = [];
  if (look.length) pick.push(look[0]);
  else if (similar.length) pick.push(similar[0]);
  for (const o of shuffle(others, rng)) {
    if (pick.length >= cells - 1) break;
    if (!pick.includes(o)) pick.push(o);
  }
  const rest = shuffle(pick.map((p) => p.cc), rng);
  const slots = Array.from({ length: Math.min(cells, rest.length + 1) }, (_, i) => i).filter((i) => i !== prevCell);
  const cell = slots[Math.floor(rng() * slots.length)];
  rest.splice(cell, 0, target.cc);
  return { flags: rest, cell };
}

/** Spotter target: weighted away from the last few targets. */
export function pickSpotterTarget(pool: readonly FlagDef[], recent: readonly string[], rng: Rng): FlagDef {
  const fresh = pool.filter((p) => !recent.slice(-Math.min(6, pool.length - 1)).includes(p.cc));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(rng() * from.length)];
}

/** Spotter: +6, +2 more when ≤ 1.5 s. A wrong tap costs SPOTTER_MISS (random tapping loses points). */
export function spotterPoints(ms: number): number {
  return 6 + (ms <= 1500 ? 2 : 0);
}

/** Peeking at the hidden name ("👀 Name?") pays this share of the normal points. */
export const PEEK_FACTOR = 0.7;

/**
 * Find it (taps the country): as Maps Find it; name hidden pays × 1.5 on a first try, and a peek at
 * the hidden name pays × 0.7 instead.
 */
export function findPoints(opts: { prior: number; ms: number; misses: number; comboMult: number; nameHidden: boolean; peeked?: boolean }): number {
  const base = answerPoints({ mode: 'find', prior: opts.prior, ms: opts.ms, misses: opts.misses, comboMult: opts.comboMult });
  if (opts.nameHidden && opts.peeked) return Math.round(base * PEEK_FACTOR);
  return opts.nameHidden && opts.misses === 0 ? Math.round(base * NAME_HIDDEN_BONUS) : base;
}

/** Which flag? (choices): as Maps Name it. */
export function whichPoints(opts: { prior: number; ms: number; misses: number; comboMult: number }): number {
  return answerPoints({ mode: 'name', ...opts });
}

/** Difficulty prior for scoring (higher = harder = more points). */
export const flagPrior = (f: FlagDef) => (f.tier === 1 ? 0.7 : f.tier === 2 ? 1.0 : 1.3);

/**
 * Sticker rule: collected the first time it is answered first-try in Find it, or the second
 * first-try in Which flag?. Returns the new which-hit count and whether it is collected now.
 */
export function collectAfter(opts: { mode: FlagMode; firstTry: boolean; already: boolean; whichHits: number }): { collect: boolean; whichHits: number } {
  const { mode, firstTry, already } = opts;
  const whichHits = mode === 'which' && firstTry ? opts.whichHits + 1 : opts.whichHits;
  if (already || !firstTry) return { collect: false, whichHits };
  return { collect: mode === 'find' || whichHits >= 2, whichHits };
}

/** Mastery ids (one store for the app). */
export const findKey = (cc: string) => `find:${cc}`;
export const whichKey = (cc: string) => `which:${cc}`;
