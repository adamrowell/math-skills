import { describe, expect, it } from 'vitest';
import {
  addDigit,
  borrows,
  carries,
  couldGrowTyped,
  digitCells,
  layoutFor,
  onTrack,
  removeDigit,
  workbookColumns,
} from './columns';
import type { Fact } from './types';
import { additionGenerator, makeProblem } from '../apps/addition/facts';
import { makeSubtraction, subTemplates } from '../apps/mixed/subtraction';

const f = (op: Fact['op'], a: number, b: number, answer: number) => ({ op, operands: [a, b], answer });

describe('layoutFor', () => {
  it('uses the workbook for 2-digit + and −', () => {
    expect(layoutFor(f('+', 47, 38, 85))).toBe('workbook');
    expect(layoutFor(f('+', 43, 5, 48))).toBe('workbook');
    expect(layoutFor(f('+', 5, 43, 48))).toBe('workbook');
    expect(layoutFor(f('−', 72, 38, 34))).toBe('workbook');
    expect(layoutFor(f('−', 43, 7, 36))).toBe('workbook');
  });
  it('keeps single-digit facts, teen subtraction and × ÷ horizontal', () => {
    expect(layoutFor(f('+', 8, 7, 15))).toBe('horizontal');
    expect(layoutFor(f('−', 15, 7, 8))).toBe('horizontal');
    expect(layoutFor(f('×', 12, 11, 132))).toBe('horizontal');
    expect(layoutFor(f('÷', 56, 8, 7))).toBe('horizontal');
    expect(layoutFor(null)).toBe('horizontal');
  });
});

describe('workbookColumns', () => {
  it('Big Adding always offers the hundreds box', () => {
    expect(workbookColumns(f('+', 47, 38, 85), 3)).toBe(3);
    expect(workbookColumns(f('+', 78, 65, 143), 3)).toBe(3);
    expect(workbookColumns(f('+', 43, 5, 48), 3)).toBe(3);
  });
  it('subtraction within 100 has 2 boxes', () => {
    expect(workbookColumns(f('−', 72, 38, 34), 3)).toBe(2);
    expect(workbookColumns(f('−', 40, 35, 5), 3)).toBe(2);
  });
  it('fits every generated problem', () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const t of additionGenerator.allFacts()) {
      for (let i = 0; i < 50; i++) {
        const p = makeProblem(t, rng);
        if (layoutFor(p) !== 'workbook') continue;
        expect(String(p.answer).length).toBeLessThanOrEqual(workbookColumns(p, 3));
      }
    }
    for (const t of subTemplates) {
      for (let i = 0; i < 50; i++) {
        const p = makeSubtraction(t, rng);
        if (layoutFor(p) !== 'workbook') continue;
        expect(workbookColumns(p, 3)).toBe(2);
      }
    }
  });
});

describe('digits, carries, borrows', () => {
  it('right-aligns digits with blank leading cells', () => {
    expect(digitCells(47, 3)).toEqual(['', '4', '7']);
    expect(digitCells(5, 3)).toEqual(['', '', '5']);
    expect(digitCells('', 2)).toEqual(['', '']);
    expect(digitCells(143, 3)).toEqual(['1', '4', '3']);
  });
  it('carries into the tens and hundreds', () => {
    expect(carries(47, 38, 3)).toEqual([false, true, false]);
    expect(carries(32, 45, 3)).toEqual([false, false, false]);
    expect(carries(78, 65, 3)).toEqual([false, true, true]);
    expect(carries(62, 53, 3)).toEqual([false, false, true]);
  });
  it('borrows from the tens', () => {
    const b = borrows(72, 38, 2);
    expect(b.lent).toEqual([false, true]);
    expect(b.got).toEqual([true, false]);
    expect(b.newTop[1]).toBe(6);
    expect(borrows(76, 34, 2).lent).toEqual([false, false]);
  });
  it('chains borrows across a zero', () => {
    const b = borrows(103, 7, 3);
    expect(b.lent).toEqual([false, true, true]);
    expect(b.got).toEqual([true, true, false]);
    expect(b.newTop).toEqual([3, 9, 0]);
  });
});

describe('ones-first entry', () => {
  it('fills right to left and backspaces the last typed digit', () => {
    let s = '';
    s = addDigit(s, '5', 'ones');
    s = addDigit(s, '9', 'ones');
    expect(s).toBe('95');
    expect(removeDigit(s, 'ones')).toBe('5');
    expect(addDigit('9', '5', 'ltr')).toBe('95');
    expect(removeDigit('95', 'ltr')).toBe('9');
  });
  it('is on track while the typed digits end the answer', () => {
    expect(onTrack('95', '5', 'ones')).toBe(true);
    expect(onTrack('95', '9', 'ones')).toBe(false);
    expect(onTrack('105', '05', 'ones')).toBe(true);
    expect(onTrack('95', '9', 'ltr')).toBe(true);
  });
  it('knows when a wrong entry could still grow on the left', () => {
    expect(couldGrowTyped('63', 'ones', 198, 3)).toBe(true); // → 163
    expect(couldGrowTyped('99', 'ones', 198, 3)).toBe(false); // 199 > 198
    expect(couldGrowTyped('143', 'ones', 198, 3)).toBe(false);
    expect(couldGrowTyped('4', 'ones', 198, 2)).toBe(true);
    expect(couldGrowTyped('63', 'ones', 198, 2)).toBe(false);
  });
});
