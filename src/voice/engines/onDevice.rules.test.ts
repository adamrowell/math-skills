/** Number decision rules of the on-device engine that do not need the model (engines/onDevice.ts). */
import { describe, expect, it } from 'vitest';
import { PARTNER_MARGIN, freeSaysOnly, partnerMargin, teenTyPartners } from './onDevice';

describe('teen / -ty look-alikes', () => {
  it('pairs a unit with its teen and its -ty, and back', () => {
    expect(teenTyPartners(6)).toEqual([16, 60]);
    expect(teenTyPartners(16)).toEqual([6, 60]);
    expect(teenTyPartners(60)).toEqual([6, 16]);
    expect(teenTyPartners(19)).toEqual([9, 90]);
    expect(teenTyPartners(106)).toEqual([116, 160]);
    expect(teenTyPartners(56)).toEqual([]);
    expect(teenTyPartners(12)).toEqual([]);
  });

  it('measures the winner against its look-alikes only', () => {
    // said 60, heard "16" by 1.1 over "60": too close to call.
    expect(partnerMargin([{ cand: '16', lp: -2 }, { cand: '60', lp: -3.1 }, { cand: '6', lp: -9 }])).toBeCloseTo(1.1);
    expect(partnerMargin([{ cand: '16', lp: -2 }, { cand: '60', lp: -3.1 }])).toBeLessThan(PARTNER_MARGIN);
    // A non-partner runner-up does not count.
    expect(partnerMargin([{ cand: '56', lp: -2 }, { cand: '54', lp: -2.5 }])).toBe(Infinity);
    expect(partnerMargin([{ cand: '7', lp: -2 }, { cand: '5', lp: -2.5 }, { cand: '70', lp: -6 }])).toBeCloseTo(4);
    expect(partnerMargin([{ cand: 'Um', lp: -2 }, { cand: '6', lp: -2.5 }])).toBe(Infinity);
  });
});

describe('two-burst unit answers need the free transcript to say only that number', () => {
  it('confirms "um … six", refuses "nine t" / "three, ten" / "threeteen"', () => {
    expect(freeSaysOnly('Um, six.', '6')).toBe(true);
    expect(freeSaysOnly("It's 6.", '6')).toBe(true);
    expect(freeSaysOnly('One hundred six.', '106')).toBe(true);
    expect(freeSaysOnly('Nine t', '9')).toBe(false);
    expect(freeSaysOnly('Three, ten.', '3')).toBe(false);
    expect(freeSaysOnly('Threeteen.', '3')).toBe(false);
    expect(freeSaysOnly('Sixteen.', '6')).toBe(false);
  });
});
