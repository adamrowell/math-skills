/** Multiplication FactGenerator: a × b for a, b ∈ 0..12 (docs/DESIGN.md §1.1). */
import type { Fact, FactGenerator, FactSetDescriptor, MasteryState } from '../../drill';
import { masteryScore } from '../../drill';

const SPEED = { fastMs: 2000, okMs: 4000 };
const NOTORIOUS = new Set(['6x7', '7x8', '6x8', '7x9', '8x9', '6x9']);

/** Difficulty prior for a × b (order-independent). */
export function prior(a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const has = (n: number) => lo === n || hi === n;
  if (lo === 0) return 0.1;
  if (lo === 1) return 0.15;
  if (has(10)) return 0.4;
  if (lo === 2) return 0.5;
  if (has(5)) {
    const other = lo === 5 ? hi : lo;
    return other <= 5 ? 0.7 : 0.9;
  }
  if (NOTORIOUS.has(`${lo}x${hi}`)) return 1.9;
  // 12s are hard but should not crowd out 6–9 for a young learner (~15% of an "All" round).
  if (hi === 12 && lo >= 6) return 1.4; // 6..9 × 12, 11 × 12, 12 × 12
  if (has(11)) return lo === 11 ? 1.2 : 0.6; // 11×11 is tricky; 3..9 × 11 is a pattern
  if (lo === hi && lo >= 6 && lo <= 9) return 1.3;
  if (hi === 12 && (lo === 3 || lo === 4)) return 1.0;
  if (lo <= 4 && hi <= 4) return 0.9; // 3×3, 3×4, 4×4
  if (lo <= 4) return 1.2; // 3s & 4s with 6..9
  if (hi <= 9) return 1.6;
  return 1.3;
}

const facts: Fact[] = [];
const byId = new Map<string, Fact>();
for (let a = 0; a <= 12; a++) {
  for (let b = 0; b <= 12; b++) {
    const f: Fact = {
      id: `mul:${a}x${b}`,
      prompt: `${a} × ${b}`,
      answer: a * b,
      operands: [a, b],
      op: '×',
      prior: prior(a, b),
      row: a,
      col: b,
      mirrorId: a !== b ? `mul:${b}x${a}` : undefined,
    };
    facts.push(f);
    byId.set(f.id, f);
  }
}

export function factById(id: string): Fact | undefined {
  return byId.get(id);
}

const inRange = (n: number, lo: number, hi: number) => n >= lo && n <= hi;

/** Facts where either operand is in `tables` and the other in `others` (both orders). */
function tableFacts(tables: number[], others: (n: number) => boolean = () => true): Fact[] {
  const t = new Set(tables);
  return facts.filter(
    (f) => (t.has(f.operands[0]) && others(f.operands[1])) || (t.has(f.operands[1]) && others(f.operands[0])),
  );
}

/** Easy tables pay half; single tables a bit less than mixed sets (anti-farming). */
const EASY_TABLES = new Set([2, 5, 10]);

const SETS: FactSetDescriptor[] = [
  { id: 'all', title: 'Everything', emoji: '🌈', chip: 'All', description: 'All tables, hard ones more often', pointsMult: 1, bonusEligible: true },
  { id: 'hard', title: 'Tough ones', emoji: '💪', chip: '6–9', description: '6s, 7s, 8s and 9s', pointsMult: 1.2, bonusEligible: true },
  { id: 'weak', title: 'My tricky ones', emoji: '🎯', chip: 'Tricky', description: 'The facts you miss most', pointsMult: 1.2, bonusEligible: true },
  { id: 'easy', title: 'Warm up', emoji: '🌤️', chip: '2·5·10', description: '2s, 5s and 10s', pointsMult: 0.5 },
  { id: 'threes-fours', title: '3s & 4s', emoji: '🧱', chip: '3·4', pointsMult: 1 },
  { id: 'elevens-twelves', title: '11s & 12s', emoji: '🗼', chip: '11·12', pointsMult: 1 },
  ...Array.from({ length: 11 }, (_, i) => {
    const n = i + 2;
    return { id: `table-${n}`, title: `${n} times table`, chip: `×${n}`, pointsMult: EASY_TABLES.has(n) ? 0.5 : 0.8 };
  }),
];

export function setPointsMult(setId: string): number {
  return SETS.find((s) => s.id === setId)?.pointsMult ?? 1;
}

function weakSet(mastery: MasteryState): Fact[] {
  // Lowest mastery among facts 2..12 (0s/1s are never "tricky"); prefer facts actually missed.
  const pool = facts.filter((f) => f.operands[0] >= 2 && f.operands[1] >= 2);
  const scored = pool
    .map((f) => {
      const m = mastery.facts[f.id];
      const missed = m ? m.attempts - m.correct : 0;
      return { f, s: masteryScore(m, SPEED) - Math.min(0.3, missed * 0.05) - f.prior * 0.05 };
    })
    .sort((a, b) => a.s - b.s);
  return scored.slice(0, 20).map((x) => x.f);
}

export const multiplicationGenerator: FactGenerator = {
  appId: 'multiplication',
  allFacts: () => facts,
  sets: () => SETS,
  factsForSet(setId: string, mastery: MasteryState): Fact[] {
    switch (setId) {
      case 'all':
        return facts;
      case 'hard':
        return tableFacts([6, 7, 8, 9], (n) => n >= 2);
      case 'easy':
        return tableFacts([2, 5, 10], (n) => n >= 1);
      case 'threes-fours':
        return tableFacts([3, 4], (n) => n >= 2);
      case 'elevens-twelves':
        return tableFacts([11, 12], (n) => n >= 2);
      case 'weak':
        return weakSet(mastery);
      default: {
        const m = /^table-(\d+)$/.exec(setId);
        const n = m ? Number(m[1]) : NaN;
        if (inRange(n, 0, 12)) {
          // N × 2..12 and mirrors: 0s and 1s are too easy to practise on purpose.
          return tableFacts([n], (o) => o >= 2);
        }
        return facts;
      }
    }
  },
  grid: {
    rows: Array.from({ length: 12 }, (_, i) => i + 1),
    cols: Array.from({ length: 12 }, (_, i) => i + 1),
    rowLabel: (r) => String(r),
    colLabel: (c) => String(c),
    cellFactId: (r, c) => `mul:${r}x${c}`,
    // The 1s are shown for completeness but are not something to practise.
    rowSetId: (r) => (r >= 2 ? `table-${r}` : undefined),
    colSetId: (c) => (c >= 2 ? `table-${c}` : undefined),
  },
  speed: SPEED,
  maxPlausible: 144,
};

export function setTitle(setId: string): string {
  return SETS.find((s) => s.id === setId)?.title ?? 'Everything';
}

export function setChip(setId: string): string {
  return SETS.find((s) => s.id === setId)?.chip ?? 'All';
}
