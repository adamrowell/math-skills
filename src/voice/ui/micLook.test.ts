import { describe, expect, it } from 'vitest';
import { computeMicLook, meterHeight } from './micLook';
import { inferenceBudgetMs } from '../engines/onDevice';

describe('computeMicLook', () => {
  const base = { on: true, status: 'listening' as const, error: null };
  it('off / error / arming', () => {
    expect(computeMicLook({ ...base, on: false })).toBe('off');
    expect(computeMicLook({ ...base, status: 'error' })).toBe('error');
    expect(computeMicLook({ ...base, status: 'loading' })).toBe('arming');
    expect(computeMicLook({ ...base, status: 'ready' })).toBe('tap');
  });
  it('thinking turns into "say it again" after the watchdog', () => {
    expect(computeMicLook({ ...base, status: 'processing' })).toBe('thinking');
    expect(computeMicLook({ ...base, status: 'processing', timedOut: true })).toBe('unsure');
  });
  it('heard chips while fresh; hearing wins', () => {
    expect(computeMicLook({ ...base, heard: { kind: 'ok', text: '56' }, heardFresh: true })).toBe('heard-ok');
    expect(computeMicLook({ ...base, heard: { kind: 'wrong', text: '54' }, heardFresh: true })).toBe('heard-wrong');
    expect(computeMicLook({ ...base, heard: { kind: 'ok', text: '56' }, heardFresh: false })).toBe('listening');
    expect(computeMicLook({ ...base, status: 'hearing', heard: { kind: 'ok', text: '56' }, heardFresh: true })).toBe('hearing');
    expect(computeMicLook({ ...base, cantHear: true })).toBe('cant-hear');
  });
  it('meter height', () => {
    expect(meterHeight(0)).toBe(0.1);
    expect(meterHeight(1)).toBe(1);
    expect(meterHeight(0.1)).toBeGreaterThan(0.4);
  });
  it('inference budget: 2 s numbers, 3 s words, ≤ 4 s sentences', () => {
    expect(inferenceBudgetMs('number', 900)).toBe(2000);
    expect(inferenceBudgetMs('sentence', 10000)).toBe(4000);
  });
});
