/** Subtraction within 100 for Mixed Blitz: skill buckets with fresh numbers each time (like Big Adding). */
import type { Fact, SpeedThresholds } from '../../drill';

const QUICK: SpeedThresholds = { fastMs: 3000, okMs: 6000 };
export const SUB_SPEED: SpeedThresholds = { fastMs: 5000, okMs: 10000 };

interface SubSkill {
  id: string;
  example: string;
  prior: number;
  speed?: SpeedThresholds;
  make: (rng: () => number) => [number, number];
}

const ri = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const ones = (n: number) => n % 10;

function draw(gen: () => [number, number], ok: (a: number, b: number) => boolean): [number, number] {
  for (let i = 0; i < 200; i++) {
    const p = gen();
    if (ok(p[0], p[1])) return p;
  }
  return gen();
}

const SKILLS: SubSkill[] = [
  { id: 'sub:teen', example: '15 − 7', prior: 0.8, speed: QUICK, make: (r) => draw(() => [ri(r, 11, 18), ri(r, 2, 9)], (a, b) => a - b < 10 && a - b >= 2) },
  { id: 'sub:2d1d', example: '47 − 3', prior: 0.6, speed: QUICK, make: (r) => draw(() => [ri(r, 21, 99), ri(r, 2, 9)], (a, b) => ones(a) >= b) },
  { id: 'sub:tens', example: '86 − 40', prior: 0.6, speed: QUICK, make: (r) => draw(() => [ri(r, 31, 99), ri(r, 1, 8) * 10], (a, b) => a - b >= 11 && ones(a) > 0) },
  { id: 'sub:2d1d-borrow', example: '43 − 7', prior: 1.1, make: (r) => draw(() => [ri(r, 21, 99), ri(r, 3, 9)], (a, b) => ones(a) < b) },
  {
    id: 'sub:2d2d',
    example: '76 − 34',
    prior: 1.1,
    make: (r) => draw(() => [ri(r, 31, 99), ri(r, 11, 89)], (a, b) => a - b >= 11 && ones(a) >= ones(b) && ones(b) > 0),
  },
  {
    id: 'sub:2d2d-borrow',
    example: '72 − 38',
    prior: 1.6,
    make: (r) => draw(() => [ri(r, 31, 99), ri(r, 12, 89)], (a, b) => a - b >= 5 && ones(a) < ones(b)),
  },
];

const byId = new Map(SKILLS.map((s) => [s.id, s]));

export const subTemplates: Fact[] = SKILLS.map((s) => {
  const [a, b] = s.example.split('−').map((x) => Number(x));
  return { id: s.id, prompt: s.example, answer: a - b, operands: [a, b], op: '−', prior: s.prior, speed: s.speed ?? SUB_SPEED };
});

export function makeSubtraction(t: Fact, rng: () => number): Fact {
  const s = byId.get(t.id);
  if (!s) return t;
  const [a, b] = s.make(rng);
  return { ...t, prompt: `${a} − ${b}`, answer: a - b, operands: [a, b] };
}
