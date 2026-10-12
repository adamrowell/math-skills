import { describe, expect, it } from 'vitest';
import { ALL_TEMPLATE_IDS, LEVELS, MAX_ANSWER, makeStory } from './problems';
import type { Story } from './problems';
import { SEEDS } from './seeds';
import { firstTryPoints, secondTryPoints, starsFor } from './scoring';

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Evaluate a worked line like `38 + 25 = 63` or `20 + 5 − 8 = 17` exactly. */
function lineHolds(line: string): boolean {
  if (!line.includes('=')) return true;
  const [l, r] = line.split('=');
  const expr = l.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  if (!/^[0-9+\-*/ ]+$/.test(expr)) throw new Error(`bad expr ${expr}`);
  return (Function(`"use strict"; return (${expr});`)() as number) === Number(r.trim());
}

function check(s: Story) {
  expect(Number.isInteger(s.answer)).toBe(true);
  expect(s.answer).toBeGreaterThanOrEqual(1);
  expect(s.answer).toBeLessThanOrEqual(MAX_ANSWER);
  for (const n of s.operands) {
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(MAX_ANSWER);
  }
  // Worked lines are true arithmetic and the final line ends with the answer.
  for (const w of s.worked) expect(lineHolds(w), `${s.key}: ${w}`).toBe(true);
  expect(s.worked.some((w) => w.endsWith(`= ${s.answer}`) || w.split(', ').includes(String(s.answer)))).toBe(true);
  // Number sentence: replacing the box with the answer makes it true (sequences excepted).
  if (s.kind !== 'skip' && s.kind !== 'missing') {
    const filled = s.sentence.replace('☐', String(s.answer));
    const [l, r] = filled.split('=');
    const ev = (x: string) => Function(`"use strict"; return (${x.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/')});`)() as number;
    expect(ev(l), `${s.key}: ${filled}`).toBe(ev(r));
  } else {
    expect(s.pic?.kind).toBe('seq');
    const items = s.pic && s.pic.kind === 'seq' ? s.pic.items : [];
    const full = items.map((v) => (v === null ? s.answer : v));
    const step = full[1] - full[0];
    expect(step).not.toBe(0);
    full.forEach((v, i) => i > 0 && expect(v - full[i - 1]).toBe(step));
    expect(full.every((v) => v >= 1)).toBe(true);
  }
  expect(s.sentences.length).toBeGreaterThanOrEqual(1);
  expect(s.sentences.length).toBeLessThanOrEqual(3);
  expect(s.question.endsWith('?')).toBe(true);
  expect(s.speech).not.toMatch(/\p{Extended_Pictographic}/u);
  // No "1 apples", no "undefined"/"NaN" leaking into text.
  const text = [...s.sentences, s.question, s.answerLine, s.hint].join(' ');
  expect(text).not.toMatch(/undefined|NaN|\b1 (?!of\b|more\b)[a-z]+s\b/);
  if (s.pic && s.pic.kind !== 'seq' && s.showPic) {
    const counts = s.pic.kind === 'join' ? s.pic.parts : s.pic.kind === 'take' ? [s.pic.total] : s.pic.kind === 'compare' ? s.pic.rows.map((r) => r.count) : [s.pic.groups * (s.pic.kind === 'groups' ? s.pic.each : 1)];
    for (const c of counts) expect(c).toBeLessThanOrEqual(25);
  }
}

describe('stories generator', () => {
  it('every template produces valid stories (property test, 400 seeds each)', () => {
    for (const id of ALL_TEMPLATE_IDS) {
      for (let seed = 1; seed <= 400; seed++) check(makeStory(id, rng(seed * 7919 + id.length)));
    }
  });

  it('respects level number ranges', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed);
      for (const id of ['join:L1', 'take:L1', 'more:L1']) {
        const s = makeStory(id, r);
        expect(Math.max(s.answer, ...s.operands)).toBeLessThanOrEqual(20);
      }
      const j2 = makeStory('join:L2', r);
      if (!j2.key.startsWith('seed:')) expect((j2.operands[0] % 10) + (j2.operands[1] % 10)).toBeLessThan(10);
      const j3 = makeStory('join:L3', r);
      expect((j3.operands[0] % 10) + (j3.operands[1] % 10)).toBeGreaterThanOrEqual(10);
      const t3 = makeStory('take:L3', r);
      expect(t3.operands[1] % 10).toBeGreaterThan(t3.operands[0] % 10);
      const g4 = makeStory('groups:L4', r);
      expect(g4.answer).toBeLessThanOrEqual(25);
      const s4 = makeStory('share:L4', r);
      expect(s4.operands[0] % s4.operands[1]).toBe(0);
    }
  });

  it('L1–L2 small stories show a picture, L3/L5 do not before the hint', () => {
    const r = rng(42);
    for (let i = 0; i < 100; i++) {
      expect(makeStory('join:L1', r).showPic).toBe(true);
      expect(makeStory('join:L3', r).showPic).toBe(false);
      expect(makeStory('twostep:L5', r).showPic).toBe(false);
    }
  });

  it('ported seeds are valid', () => {
    expect(SEEDS.length).toBeGreaterThanOrEqual(15);
    for (const s of SEEDS) {
      expect(s.worked.every(lineHolds)).toBe(true);
      expect(s.answer).toBeGreaterThan(0);
      expect(ALL_TEMPLATE_IDS).toContain(s.templateId);
    }
  });

  it('five levels with templates', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5]);
    expect(LEVELS.every((l) => l.templates.length > 0)).toBe(true);
  });
});

describe('stories scoring', () => {
  it('speed, combo and second try', () => {
    expect(firstTryPoints(0.4, 5000, 1).points).toBe(Math.round(22 * 1.5));
    expect(firstTryPoints(0.4, 20000, 1).points).toBe(Math.round(22 * 1.2));
    expect(firstTryPoints(0.4, 60000, 1).points).toBe(22);
    expect(firstTryPoints(0.4, 60000, 5).points).toBe(Math.round(22 * 1.15));
    expect(secondTryPoints(0.4)).toBe(11);
  });
  it('stars', () => {
    expect(starsFor(8, 8, 8)).toBe(3);
    expect(starsFor(6, 8, 8)).toBe(2);
    expect(starsFor(5, 8, 8)).toBe(1);
    expect(starsFor(5, 5, 8)).toBe(0);
  });
});
