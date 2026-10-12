/**
 * Big Adding FactGenerator (docs/DESIGN.md §1.3). Mastery is per *skill bucket*, not per problem:
 * the scheduler picks a bucket by weight, then `instantiate` makes fresh numbers in it, so
 * "47 + 38" and "26 + 57" both train (and score) the "carry the 1" skill.
 *
 * Buckets are finer than the spec's six so the scheduler's recency rule (the last 3 asked are
 * skipped) does not turn a tiny pool into a fixed rotation: with ten skills, the weights decide.
 * As the easy skills turn gold their weight falls ×4, so rounds lean into regrouping by themselves.
 */
import type { Fact, FactGenerator, FactSetDescriptor, SpeedThresholds } from '../../drill';
import { ProblemMemory } from './problemMemory';

const SPEED: SpeedThresholds = { fastMs: 5000, okMs: 10000 };
const QUICK: SpeedThresholds = { fastMs: 3000, okMs: 6000 };

export type SkillGroup = 'warmup' | 'nocarry' | 'carry' | 'big';

export interface Skill {
  id: string;
  name: string;
  example: string;
  prior: number;
  group: SkillGroup;
  speed?: SpeedThresholds;
  /** [a, b] with a the bigger/2-digit number. */
  make: (rng: () => number) => [number, number];
}

const ri = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** Draw until `ok`; the constraints below always have solutions, the cap is belt and braces. */
function draw(_rng: () => number, gen: () => [number, number], ok: (a: number, b: number) => boolean): [number, number] {
  for (let i = 0; i < 200; i++) {
    const [a, b] = gen();
    if (ok(a, b)) return [a, b];
  }
  return gen();
}

const ones = (n: number) => n % 10;
const tens = (n: number) => Math.floor(n / 10);

export const SKILLS: Skill[] = [
  {
    id: 'add:1d-bridge',
    name: 'Past ten',
    example: '8 + 7',
    prior: 0.5,
    group: 'warmup',
    speed: QUICK,
    make: (rng) => draw(rng, () => [ri(rng, 2, 9), ri(rng, 2, 9)], (a, b) => a + b >= 11),
  },
  {
    id: 'add:2d1d',
    name: 'Add a small number',
    example: '43 + 5',
    prior: 0.7,
    group: 'warmup',
    speed: QUICK,
    make: (rng) => draw(rng, () => [ri(rng, 11, 98), ri(rng, 2, 9)], (a, b) => ones(a) >= 1 && ones(a) + b <= 9),
  },
  {
    id: 'add:2d-tens',
    name: 'Add tens',
    example: '46 + 30',
    prior: 0.6,
    group: 'nocarry',
    speed: QUICK,
    make: (rng) => draw(rng, () => [ri(rng, 11, 89), ri(rng, 1, 8) * 10], (a, b) => ones(a) >= 1 && a + b <= 99),
  },
  {
    id: 'add:2d1d-carry',
    name: 'Small number, carry',
    example: '47 + 8',
    prior: 1.0,
    group: 'warmup',
    make: (rng) => draw(rng, () => [ri(rng, 11, 89), ri(rng, 3, 9)], (a, b) => ones(a) >= 2 && ones(a) + b >= 10),
  },
  {
    id: 'add:2d2d',
    name: 'Two big numbers',
    example: '32 + 45',
    prior: 1.1,
    group: 'nocarry',
    make: (rng) =>
      draw(
        rng,
        () => [ri(rng, 11, 88), ri(rng, 11, 88)],
        (a, b) => a + b <= 99 && ones(a) + ones(b) <= 9 && ones(a) + ones(b) >= 2 && ones(a) > 0 && ones(b) > 0,
      ),
  },
  {
    id: 'add:2d2d-carry',
    name: 'Carry the 1',
    example: '27 + 35',
    prior: 1.5,
    group: 'carry',
    make: (rng) =>
      draw(
        rng,
        () => [ri(rng, 11, 89), ri(rng, 11, 89)],
        (a, b) => a + b <= 99 && ones(a) + ones(b) >= 10 && ones(a) + ones(b) <= 13,
      ),
  },
  {
    id: 'add:2d2d-carry-big',
    name: 'Tricky carry',
    example: '38 + 46',
    prior: 1.7,
    group: 'carry',
    make: (rng) =>
      draw(rng, () => [ri(rng, 15, 89), ri(rng, 15, 89)], (a, b) => a + b <= 99 && ones(a) + ones(b) >= 14),
  },
  {
    id: 'add:big',
    name: 'Past 100',
    example: '62 + 53',
    prior: 1.4,
    group: 'big',
    make: (rng) =>
      draw(
        rng,
        () => [ri(rng, 21, 98), ri(rng, 21, 98)],
        (a, b) => tens(a) + tens(b) >= 10 && ones(a) + ones(b) <= 9 && ones(a) + ones(b) >= 1,
      ),
  },
  {
    id: 'add:big-carry',
    name: 'Past 100 + carry',
    example: '78 + 65',
    prior: 1.9,
    group: 'big',
    make: (rng) =>
      draw(rng, () => [ri(rng, 21, 99), ri(rng, 21, 99)], (a, b) => a + b >= 100 && ones(a) + ones(b) >= 10),
  },
];

const skillById = new Map(SKILLS.map((s) => [s.id, s]));
export const skillFor = (id: string) => skillById.get(id);

const templates: Fact[] = SKILLS.map((s) => ({
  id: s.id,
  prompt: s.example,
  answer: s.example.split('+').reduce((t, x) => t + Number(x), 0),
  operands: s.example.split('+').map((x) => Number(x)),
  op: '+',
  prior: s.prior,
  speed: s.speed,
  tags: [s.group],
}));

const SETS: FactSetDescriptor[] = [
  { id: 'all', title: 'Everything', emoji: '🌈', chip: 'All', description: 'A bit of everything, carries more often', pointsMult: 1, bonusEligible: true },
  { id: 'warmup', title: 'Warm up', emoji: '🌤️', chip: 'Warm up', description: 'Add a 1-digit number', pointsMult: 0.6 },
  { id: 'nocarry', title: 'No carry', emoji: '🙂', chip: 'No carry', description: '2-digit numbers, no carrying', pointsMult: 0.8 },
  { id: 'carry', title: 'Carry', emoji: '💪', chip: 'Carry', description: 'Carry the 1 to the tens', pointsMult: 1.2, bonusEligible: true },
  { id: 'big', title: 'Big sums', emoji: '🚀', chip: 'Big sums', description: 'Answers past 100', pointsMult: 1.2, bonusEligible: true },
];

/** Make a concrete problem from a skill. The bigger number usually comes first. */
export function makeProblem(template: Fact, rng: () => number): Fact {
  const s = skillById.get(template.id);
  if (!s) return template;
  let [a, b] = s.make(rng);
  const swap = s.group === 'warmup' || s.id === 'add:2d-tens' ? rng() < 0.2 : rng() < 0.5;
  if (swap) [a, b] = [b, a];
  return { ...template, prompt: `${a} + ${b}`, answer: a + b, operands: [a, b] };
}

/** The round summary looks facts up by id: show the real problem he missed, not the example. */
const memory = new ProblemMemory('addition');

export const additionGenerator: FactGenerator = {
  appId: 'addition',
  allFacts: () => memory.overlay(templates),
  sets: () => SETS,
  factsForSet(setId) {
    memory.reset();
    if (setId === 'all') return templates;
    const t = templates.filter((f) => f.tags?.[0] === setId);
    return t.length ? t : templates;
  },
  instantiate: (t, rng) => memory.shown(makeProblem(t, rng)),
  speed: SPEED,
  maxPlausible: 198,
};

export function setChip(setId: string): string {
  return SETS.find((s) => s.id === setId)?.chip ?? 'All';
}

/** Which practice set trains a skill. */
export const setForSkill = (id: string) => skillById.get(id)?.group ?? 'all';
