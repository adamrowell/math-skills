/**
 * Mixed Blitz (docs/DESIGN.md §1.4): ×, ÷, + and − in one fast round.
 *
 * How it plugs into the drill engine: the round's "facts" are 20 op *slots*
 * (7 × · 5 ÷ · 5 + · 3 −, all equal weight → op shares 35/25/25/15 %). `instantiate` turns a slot
 * into a real problem chosen by the shared scheduler from that operation's own app mastery
 * (Times Tables, Division, Big Adding), so his weak facts come up here too. The engine stores
 * results under the real fact id ('mul:7x8') in Mixed's mastery, and `startSync` copies each
 * result back into the source app, so mastery flows both ways.
 *
 * Escalation: the first few questions lean easy (warm-up), then the pool tilts toward the hard
 * facts as the round goes on, so the points per answer climb.
 */
import type { AppId } from '../../core';
import type { Fact, FactGenerator, FactSetDescriptor, MasteryState, SpeedThresholds } from '../../drill';
import { applyMastery, masteryStore, pickNextFact, speedTier } from '../../drill';
import { multiplicationGenerator } from '../multiplication/facts';
import { divisionGenerator } from '../division/facts';
import { additionGenerator, makeProblem } from '../addition/facts';
import { makeSubtraction, subTemplates, SUB_SPEED } from './subtraction';

type Op = 'mul' | 'div' | 'add' | 'sub';

const SLOT_COUNTS: Record<Op, number> = { mul: 7, div: 5, add: 5, sub: 3 };
const OP_SYMBOL: Record<Op, Fact['op']> = { mul: '×', div: '÷', add: '+', sub: '−' };

const slots: Fact[] = (Object.keys(SLOT_COUNTS) as Op[]).flatMap((op) =>
  Array.from({ length: SLOT_COUNTS[op] }, (_, i) => ({
    id: `mix:${op}${i}`,
    prompt: OP_SYMBOL[op],
    answer: 0,
    operands: [],
    op: OP_SYMBOL[op],
    prior: 1,
    tags: [op],
  })),
);

const SETS: FactSetDescriptor[] = [
  { id: 'all', title: 'Everything', emoji: '🌀', chip: '× ÷ + −', description: 'All four, mixed up', pointsMult: 1, bonusEligible: true },
  { id: 'times-divide', title: 'Times & divide', emoji: '✖️', chip: '× ÷', description: 'Times tables and division', pointsMult: 1, bonusEligible: true },
  { id: 'plus-minus', title: 'Plus & minus', emoji: '➕', chip: '+ −', description: 'Adding and taking away', pointsMult: 1, bonusEligible: true },
];

const SOURCE: Record<Exclude<Op, 'sub'>, AppId> = { mul: 'multiplication', div: 'division', add: 'addition' };

/** Pools per op: drop the trivia (×0, ×1, ÷1, 0 ÷ n); this is a speed game on real facts. */
const POOLS: Record<Op, Fact[]> = {
  mul: multiplicationGenerator.allFacts().filter((f) => f.operands[0] >= 2 && f.operands[1] >= 2),
  div: divisionGenerator.allFacts().filter((f) => f.operands[1] >= 2 && f.answer >= 1),
  add: additionGenerator.allFacts().filter((f) => f.id !== 'add:1d-bridge'),
  sub: subTemplates,
};
const SPEEDS: Record<Op, SpeedThresholds> = {
  mul: multiplicationGenerator.speed,
  div: divisionGenerator.speed,
  add: additionGenerator.speed,
  sub: SUB_SPEED,
};

const opOf = (factId: string): Op | null => {
  const p = factId.slice(0, 4);
  return p === 'mul:' ? 'mul' : p === 'div:' ? 'div' : p === 'add:' ? 'add' : p === 'sub:' ? 'sub' : null;
};

/** Per-round state (reset in factsForSet, which the engine calls at round start). */
const round = {
  n: 0,
  recent: { mul: [] as string[], div: [] as string[], add: [] as string[], sub: [] as string[] },
  comeback: [] as Array<{ factId: string; dueAt: number }>,
  shown: new Map<string, Fact>(),
  missed: new Map<string, Fact>(),
};

/** Warm-up → normal → hot: exponent applied to each fact's prior when choosing. */
export function heatFor(n: number): number {
  if (n < 4) return -0.8;
  if (n < 10) return 0;
  if (n < 20) return 0.5;
  return 0.9;
}

function mastery(op: Op): MasteryState {
  const own = masteryStore('mixed').get();
  if (op === 'sub') return own;
  try {
    return masteryStore(SOURCE[op]).get();
  } catch {
    return own;
  }
}

function choose(op: Op, rng: () => number): Fact {
  const heat = heatFor(round.n);
  let pool = POOLS[op];
  // Warm-up: no answers past 100 for the first few.
  if (heat < 0 && op === 'add') pool = pool.filter((f) => !f.id.startsWith('add:big'));
  const tilted = pool.map((f) => ({ ...f, prior: Math.pow(f.prior, 1 + heat) }));
  const pick = pickNextFact({
    facts: tilted,
    mastery: mastery(op),
    speed: SPEEDS[op],
    recent: round.recent[op],
    sessionWrong: {},
    sessionRecovered: {},
    comeback: [],
    questionIndex: round.n,
    rng,
  });
  round.recent[op] = [...round.recent[op], pick.fact.id].slice(-12);
  const base = pool.find((f) => f.id === pick.fact.id) ?? pick.fact;
  return concrete(op, base, rng);
}

function concrete(op: Op, base: Fact, rng: () => number): Fact {
  // The source app's speed thresholds travel with the fact (scoring + mastery tiers).
  const f = op === 'add' ? makeProblem(base, rng) : op === 'sub' ? makeSubtraction(base, rng) : base;
  return { ...f, speed: f.speed ?? SPEEDS[op] };
}

function instantiate(slot: Fact, rng: () => number): Fact {
  const n = round.n++;
  const due = round.comeback.find((c) => c.dueAt <= n);
  let f: Fact | null = null;
  if (due) {
    round.comeback = round.comeback.filter((c) => c !== due);
    const prev = round.missed.get(due.factId);
    // Same question again (a bucket fact: the same numbers).
    if (prev) f = prev;
  }
  if (!f) {
    const op = (slot.tags?.[0] as Op) ?? 'mul';
    f = choose(op, rng);
  }
  round.shown.set(f.id, f);
  return f;
}

// ---- mastery sync + comeback ---------------------------------------------------------------

let prevMixed: MasteryState | null = null;
let syncing = false;

/** Mixed results → the source app's mastery, and wrong answers → comeback 3–5 questions later. */
export function startSync() {
  if (syncing) return;
  syncing = true;
  const store = masteryStore('mixed');
  prevMixed = store.get();
  store.subscribe(() => {
    const next = store.get();
    const prev = prevMixed;
    prevMixed = next;
    if (!prev || prev === next) return;
    for (const [id, m] of Object.entries(next.facts)) {
      const p = prev.facts[id];
      if (p && p.attempts === m.attempts) continue;
      const op = opOf(id);
      if (!op) continue;
      const correct = m.correct > (p?.correct ?? 0);
      if (!correct) {
        const f = round.shown.get(id);
        if (f) {
          round.missed.set(id, f);
          round.comeback = round.comeback.filter((c) => c.factId !== id);
          round.comeback.push({ factId: id, dueAt: round.n + 2 + Math.floor(Math.random() * 3) });
        }
      }
      if (op === 'sub') continue;
      // Recover the answer time from the EMA (avg = 0.7·prev + 0.3·ms).
      const ms = correct ? (p && p.avgMs > 0 ? Math.max(0, (m.avgMs - 0.7 * p.avgMs) / 0.3) : m.avgMs) : 0;
      const shown = round.shown.get(id);
      const speed = shown?.speed ?? SPEEDS[op];
      const tier = correct ? speedTier(ms, speed) : 'none';
      try {
        const src = masteryStore(SOURCE[op]);
        let s = applyMastery(src.get(), { factId: id, correct, ms, tier }, Date.now());
        const mirror = shown?.mirrorId;
        if (mirror) s = applyMastery(s, { factId: mirror, correct, ms, tier, mirror: true }, Date.now());
        src.set(s);
      } catch {
        /* source app mastery is a bonus */
      }
    }
  });
}

export const mixedGenerator: FactGenerator = {
  appId: 'mixed',
  // Slots + every real fact, so the round summary can name the facts he missed / levelled up.
  allFacts: () => [...slots, ...POOLS.mul, ...POOLS.div, ...round.missed.values()],
  sets: () => SETS,
  factsForSet(setId) {
    round.n = 0;
    round.recent = { mul: [], div: [], add: [], sub: [] };
    round.comeback = [];
    round.shown = new Map();
    round.missed = new Map();
    startSync();
    if (setId === 'times-divide') return slots.filter((s) => s.tags?.[0] === 'mul' || s.tags?.[0] === 'div');
    if (setId === 'plus-minus') return slots.filter((s) => s.tags?.[0] === 'add' || s.tags?.[0] === 'sub');
    return slots;
  },
  instantiate,
  speed: { fastMs: 3000, okMs: 6000 },
  maxPlausible: 198,
};

export function setChip(setId: string): string {
  return SETS.find((s) => s.id === setId)?.chip ?? '× ÷ + −';
}

/** Per operation for the home screen: share of the round and how many of its facts are strong (box ≥ 4). */
export function mixSummary(
  mixed: MasteryState,
  sources: Partial<Record<AppId, MasteryState>>,
): Array<{ op: Op; symbol: Fact['op']; share: number; strong: number; total: number }> {
  const totalSlots = Object.values(SLOT_COUNTS).reduce((a, b) => a + b, 0);
  return (Object.keys(SLOT_COUNTS) as Op[]).map((op) => {
    const src = op === 'sub' ? undefined : sources[SOURCE[op]];
    const pool = POOLS[op];
    const strong = pool.filter((f) => Math.max(mixed.facts[f.id]?.box ?? 0, src?.facts[f.id]?.box ?? 0) >= 4).length;
    return { op, symbol: OP_SYMBOL[op], share: Math.round((SLOT_COUNTS[op] / totalSlots) * 100), strong, total: pool.length };
  });
}
