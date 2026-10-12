/** Speculative (pre-endpoint) accept rules: engines/speculative.ts. */
import { describe, expect, it } from 'vitest';
import { LiveUtterance, SPEC, isExtendable, isGrowable, isRisky, specVerdict } from './speculative';

const CANDS = [...Array.from({ length: 145 }, (_, i) => String(i)), 'Um', 'Hmm'];
const base = { acceptMargin: 1, minTopLp: -40, quietMs: 200, voicedAfter: 0, speechMs: 600 };
const res = (cand: string, margin = 4, lp = -3) => ({ ranked: [{ cand, lp }, { cand: 'x', lp: lp - margin }], margin });

describe('specVerdict', () => {
  it('accepts a complete, clearly-won expected answer after a short quiet tail', () => {
    expect(specVerdict(res('56'), '56', CANDS, base).kind).toBe('accept');
    expect(specVerdict(res('12'), '12', CANDS, { ...base, quietMs: SPEC.quietMs }).kind).toBe('accept');
  });

  it('never accepts anything but the expected answer', () => {
    expect(specVerdict(res('54'), '56', CANDS, base)).toMatchObject({ kind: 'no', reason: 'not-expected' });
    expect(specVerdict(res('Um'), '56', CANDS, base).kind).toBe('no');
  });

  it('needs the accept margin plus extra headroom', () => {
    expect(specVerdict(res('56', 1.2), '56', CANDS, base)).toMatchObject({ kind: 'no', reason: 'margin' });
    expect(specVerdict(res('56', Math.max(1 + SPEC.extraMargin, SPEC.minMargin)), '56', CANDS, base).kind).toBe('accept');
    expect(specVerdict(res('56', 1.99), '56', CANDS, { ...base, acceptMargin: 0.5 })).toMatchObject({ kind: 'no', reason: 'margin' });
    expect(specVerdict(res('56', 4, -60), '56', CANDS, base)).toMatchObject({ kind: 'no', reason: 'low-lp' });
  });

  it('a spoken prefix of another plausible answer always waits for the endpoint', () => {
    for (const p of ['50', '20', '90', '100', '1']) expect(specVerdict(res(p), p, CANDS, base)).toMatchObject({ kind: 'no', reason: 'prefix' });
    // …but only when the longer answer is plausible here.
    expect(specVerdict(res('12'), '12', CANDS, base).kind).toBe('accept');
  });

  it('a unit that starts a teen / -ty word is never accepted early, however long the quiet', () => {
    // "six … teen" with a 200–320 ms pause, soft "-teen" under the VAD threshold: only the endpoint can tell.
    for (const p of ['2', '3', '4', '5', '6', '7', '8', '9', '102', '103', '105', '106', '108', '109']) {
      expect(specVerdict(res(p, 9), p, CANDS, { ...base, quietMs: 2000 })).toMatchObject({ kind: 'no', reason: 'extendable' });
    }
  });

  it('waits when the child is not quiet long enough yet, refuses when speech went on or is long', () => {
    expect(specVerdict(res('56'), '56', CANDS, { ...base, quietMs: 40 })).toMatchObject({ kind: 'wait' });
    expect(specVerdict(res('56'), '56', CANDS, { ...base, voicedAfter: SPEC.maxVoicedAfter + 1 })).toMatchObject({ kind: 'no', reason: 'speech-went-on' });
    expect(specVerdict(res('56'), '56', CANDS, { ...base, speechMs: SPEC.maxSpeechMs + 10 })).toMatchObject({ kind: 'no', reason: 'long' });
  });
});

describe('growable / extendable', () => {
  it('tens, hundreds and "one" (→ one hundred …) are growable within 0..144', () => {
    expect(isGrowable(50, CANDS)).toBe(true);
    expect(isGrowable(100, CANDS)).toBe(true);
    expect(isGrowable(1, CANDS)).toBe(true);
    expect(isGrowable(56, CANDS)).toBe(false);
    expect(isGrowable(144, CANDS)).toBe(false);
    expect(isGrowable(3, CANDS)).toBe(false);
  });
  it('units that can become a teen / -ty (three-teen, five-teen, two…ty included)', () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9, 102, 103, 104, 105, 108].every(isExtendable)).toBe(true);
    expect([0, 1, 10, 12, 14, 56, 64, 96, 100, 110, 144].some(isExtendable)).toBe(false);
  });
  it('risky = growable or extendable', () => {
    expect(['1', '6', '50', '100', '107', '140'].every((c) => isRisky(Number(c), CANDS))).toBe(true);
    expect(['0', '10', '12', '16', '19', '56', '72', '144'].some((c) => isRisky(Number(c), CANDS))).toBe(false);
  });
});

describe('LiveUtterance', () => {
  const chunk = (flags: number[]) => [new Float32Array(flags.length * 160).fill(0.1), Uint8Array.from(flags)] as const;

  it('tracks voiced frames, trailing quiet and coverage of a snapshot', () => {
    const u = new LiveUtterance(1, 0);
    const [a1, f1] = chunk([0, 1, 1, 1, 1]);
    expect(u.append(a1, f1, 0)).toBe(true);
    const [a2, f2] = chunk([1, 0, 0]);
    expect(u.append(a2, f2, 5)).toBe(true);
    expect(u.nFrames).toBe(8);
    expect(u.voiced).toBe(5);
    expect(u.quietFrames).toBe(2);
    expect(u.covers(8)).toBe(true);
    expect(u.covers(6)).toBe(true); // ≤ 1 voiced frame after
    expect(u.covers(4)).toBe(false);
    expect(u.quietIn(8)).toBe(2);
    expect(u.snapshot(8).length).toBe(8 * 160);
    // Out-of-order chunk → refused.
    expect(u.append(a2, f2, 3)).toBe(false);
  });

  it('a decode that lacks the silence needSnapQuiet asks for is not "satisfying" once that silence exists', () => {
    const u = new LiveUtterance(1, 0);
    const [a, f] = chunk([1, 1, 1, 0, 0]);
    u.append(a, f, 0);
    u.needSnapQuiet = 4;
    expect(u.satisfies(5)).toBe(true); // only 2 quiet frames exist yet: nothing better to decode
    const [b, g] = chunk([0, 0, 0]);
    u.append(b, g, 5);
    expect(u.satisfies(5)).toBe(false);
    expect(u.satisfies(8)).toBe(true);
  });

  it('matchesSegment: speech + the 200 ms the endpoint keeps, and nothing said after it', () => {
    const u = new LiveUtterance(1, 0);
    const [a, f] = chunk([0, 1, 1, 1, ...Array(SPEC.segmentQuietFrames).fill(0)]);
    u.append(a, f, 0);
    const seg = 4 + SPEC.segmentQuietFrames;
    expect(u.matchesSegment(seg)).toBe(true);
    expect(u.matchesSegment(seg - 1)).toBe(false); // too little quiet: a soft "-teen" may be cut
    // "six" … 250 ms … "teen": one voiced frame after the snapshot is enough to refuse it.
    const [b, g] = chunk([0, 0, 0, 0, 0, 1]);
    u.append(b, g, seg);
    expect(u.matchesSegment(seg)).toBe(false);
    expect(u.covers(seg)).toBe(true); // (the looser rule for answers that cannot grow)
  });

  it('islands: separate bursts of speech', () => {
    const mk = (fl: number[]) => {
      const u = new LiveUtterance(1, 0);
      const [a, f] = chunk(fl);
      u.append(a, f, 0);
      return u.islands();
    };
    const q = (n: number) => Array(n).fill(0);
    expect(mk([...q(5), 1, 1, 1, 1, 1, ...q(20)])).toBe(1);
    expect(mk([1, 1, 1, ...q(5), 1, 1, 1, 1])).toBe(1); // a dip inside a word
    expect(mk([1, 1, 1, 1, ...q(20), 1, 1, 1, 1, ...q(3)])).toBe(2); // "six … teen"
    expect(mk([1, 1, 1, 1, ...q(20), 1])).toBe(1); // a click is not a burst
  });

  it('spanMs counts the pauses between words', () => {
    const u = new LiveUtterance(1, 0);
    const [a, f] = chunk([0, 0, 1, 1, 0, 0, 0, 0, 1, 0]);
    u.append(a, f, 0);
    expect(u.voiced).toBe(3);
    expect(u.spanMs).toBe(70);
  });
});
