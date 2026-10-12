/** Division FactGenerator: (b·q) ÷ b for b ∈ 1..12, q ∈ 0..12 (docs/DESIGN.md §1.2). */
import type { AppId } from '../../core';
import type { Fact, FactGenerator, FactMastery, FactSetDescriptor, LeitnerBox, MasteryState } from '../../drill';
import { masteryScore } from '../../drill';
import { prior as multPrior } from '../multiplication/facts';

const SPEED = { fastMs: 3000, okMs: 6000 };

/** Prior for (b·q) ÷ b: the multiplication prior, with the trivia (÷1, 0 ÷ b, b ÷ b) rare. */
export function divPrior(b: number, q: number): number {
  if (b === 1) return 0.1;
  if (q === 0) return 0.1;
  if (q === 1) return 0.25;
  return multPrior(b, q);
}

export const divId = (b: number, q: number) => `div:${b * q}/${b}`;

const facts: Fact[] = [];
for (let b = 1; b <= 12; b++) {
  for (let q = 0; q <= 12; q++) {
    facts.push({
      id: divId(b, q),
      prompt: `${b * q} ÷ ${b}`,
      answer: q,
      operands: [b * q, b],
      op: '÷',
      prior: divPrior(b, q),
      row: b,
      col: q,
    });
  }
}
const byId = new Map(facts.map((f) => [f.id, f]));
export const divisionFactById = (id: string) => byId.get(id);

const EASY = new Set([2, 5, 10]);

const SETS: FactSetDescriptor[] = [
  { id: 'all', title: 'Everything', emoji: '🌈', chip: 'All', description: 'All of them, hard ones more often', pointsMult: 1, bonusEligible: true },
  { id: 'hard', title: 'Tough ones', emoji: '💪', chip: '÷6–9', description: 'Divide by 6, 7, 8 and 9', pointsMult: 1.2, bonusEligible: true },
  { id: 'weak', title: 'My tricky ones', emoji: '🎯', chip: 'Tricky', description: 'The ones you miss most', pointsMult: 1.2, bonusEligible: true },
  { id: 'easy', title: 'Warm up', emoji: '🌤️', chip: '÷2·5·10', description: 'Divide by 2, 5 and 10', pointsMult: 0.5 },
  { id: 'threes-fours', title: '÷3 & ÷4', emoji: '🧱', chip: '÷3·4', pointsMult: 1 },
  { id: 'elevens-twelves', title: '÷11 & ÷12', emoji: '🗼', chip: '÷11·12', pointsMult: 1 },
  ...Array.from({ length: 11 }, (_, i) => {
    const n = i + 2;
    return { id: `table-${n}`, title: `Divide by ${n}`, chip: `÷${n}`, pointsMult: EASY.has(n) ? 0.5 : 0.8 };
  }),
];

/** Divide by one of `divisors`, quotient 1..12 (plus a rare 0). */
const byDivisor = (divisors: number[], minQ = 1) => {
  const d = new Set(divisors);
  return facts.filter((f) => d.has(f.operands[1]) && f.answer >= minQ);
};

function weakSet(mastery: MasteryState): Fact[] {
  const pool = facts.filter((f) => f.operands[1] >= 2 && f.answer >= 2);
  return pool
    .map((f) => {
      const m = mastery.facts[f.id];
      const missed = m ? m.attempts - m.correct : 0;
      return { f, s: masteryScore(m, SPEED) - Math.min(0.3, missed * 0.05) - f.prior * 0.05 };
    })
    .sort((a, b) => a.s - b.s)
    .slice(0, 20)
    .map((x) => x.f);
}

/**
 * First use: start from what he already knows in Times Tables. Weak 6×7 → weak 42÷7 and 42÷6;
 * box = max(0, multBox − 1) (taking the weaker of a×b / b×a).
 */
export function seedFromMultiplication(own: MasteryState, read: (appId: AppId) => MasteryState | null): MasteryState {
  if (own.seededFrom || Object.keys(own.facts).length) return own;
  const mult = read('multiplication');
  if (!mult) return { ...own, seededFrom: 'multiplication' };
  const out: Record<string, FactMastery> = {};
  for (const f of facts) {
    const b = f.operands[1];
    const q = f.answer;
    const m1 = mult.facts[`mul:${b}x${q}`];
    const m2 = mult.facts[`mul:${q}x${b}`];
    const boxes = [m1?.box, m2?.box].filter((x): x is LeitnerBox => typeof x === 'number');
    if (!boxes.length) continue;
    const box = Math.max(0, Math.min(...boxes) - 1) as LeitnerBox;
    if (box === 0) continue;
    out[f.id] = { box, attempts: 0, correct: 0, avgMs: 0, bestMs: 0, lastSeen: 0, lastWrong: 0 };
  }
  return { version: 1, facts: out, seededFrom: 'multiplication' };
}

export const divisionGenerator: FactGenerator = {
  appId: 'division',
  allFacts: () => facts,
  sets: () => SETS,
  factsForSet(setId, mastery) {
    switch (setId) {
      case 'all':
        return facts;
      case 'hard':
        return byDivisor([6, 7, 8, 9], 2);
      case 'easy':
        return byDivisor([2, 5, 10], 1);
      case 'threes-fours':
        return byDivisor([3, 4], 2);
      case 'elevens-twelves':
        return byDivisor([11, 12], 2);
      case 'weak':
        return weakSet(mastery);
      default: {
        const m = /^table-(\d+)$/.exec(setId);
        const n = m ? Number(m[1]) : NaN;
        if (n >= 2 && n <= 12) return byDivisor([n], 1);
        return facts;
      }
    }
  },
  grid: {
    rows: Array.from({ length: 12 }, (_, i) => i + 1),
    cols: Array.from({ length: 12 }, (_, i) => i + 1),
    rowLabel: (r) => `÷${r}`,
    colLabel: (c) => String(c),
    cellFactId: (r, c) => divId(r, c),
    rowSetId: (r) => (r >= 2 ? `table-${r}` : undefined),
  },
  speed: SPEED,
  // Answers are 0..12; anything bigger he says is an echo of the question, not an answer.
  maxPlausible: 12,
  seedMastery: seedFromMultiplication,
};

export function setChip(setId: string): string {
  return SETS.find((s) => s.id === setId)?.chip ?? 'All';
}
