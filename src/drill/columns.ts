/**
 * Workbook (vertical) layout maths for multi-digit + and − (docs/UX-V3.md §5).
 * Pure functions: which facts use the workbook, how wide the grid is, digit columns,
 * carries/borrows, and the ones-first entry rules used by useDrillRound.
 */
import type { Fact } from './types';

export type EntryOrder = 'ones' | 'ltr';
export type ProblemLayout = 'horizontal' | 'workbook';

/**
 * Workbook for + / − with a 2-digit operand. Teen subtraction facts ("15 − 7": a 1-digit
 * answer from a teen) stay horizontal like "8 + 7"; × ÷ always horizontal.
 */
export function layoutFor(fact: Pick<Fact, 'op' | 'operands'> | null | undefined): ProblemLayout {
  if (!fact || fact.operands.length !== 2) return 'horizontal';
  const [a, b] = fact.operands;
  if (fact.op === '+') return Math.max(a, b) >= 10 ? 'workbook' : 'horizontal';
  if (fact.op === '−') return a >= 20 || b >= 10 ? 'workbook' : 'horizontal';
  return 'horizontal';
}

const len = (n: number) => String(Math.abs(Math.trunc(n))).length;

/**
 * Number of digit columns (= answer boxes). Addition always offers the extra carry column the
 * generator could need (so the boxes never leak whether this answer passes 100); subtraction
 * never needs more columns than the top number.
 */
export function workbookColumns(fact: Pick<Fact, 'op' | 'operands' | 'answer'>, answerDigits: number): number {
  const [a, b] = fact.operands;
  const widest = Math.max(len(a), len(b));
  if (fact.op === '−') return Math.max(widest, len(fact.answer));
  return Math.max(widest, len(fact.answer), Math.min(answerDigits, widest + 1));
}

/** Digits right-aligned into `n` cells; leading cells are '' (never "0"). Index 0 = left-most. */
export function digitCells(value: string | number, n: number): string[] {
  const s = String(value);
  const cells = new Array<string>(n).fill('');
  for (let i = 0; i < Math.min(s.length, n); i++) cells[n - 1 - i] = s[s.length - 1 - i];
  return cells;
}

/**
 * Carries for a + b, by column index from the right: `carry[i]` true when a 1 is carried INTO
 * column i (so carry[0] is always false). Length = `n`.
 */
export function carries(a: number, b: number, n: number): boolean[] {
  const out = new Array<boolean>(n).fill(false);
  let c = 0;
  for (let i = 0; i < n; i++) {
    const s = (Math.floor(a / 10 ** i) % 10) + (Math.floor(b / 10 ** i) % 10) + c;
    c = s >= 10 ? 1 : 0;
    if (i + 1 < n) out[i + 1] = c === 1;
  }
  return out;
}

export interface BorrowMarks {
  /** Column (from the right) whose top digit is crossed out and lowered by 1. */
  lent: boolean[];
  /** Column (from the right) that received 10 (small 1 before its top digit). */
  got: boolean[];
  /** The new top digit after lending (only meaningful where lent[i]). */
  newTop: number[];
}

/** Standard column subtraction borrow marks for a − b (a ≥ b), by column from the right. */
export function borrows(a: number, b: number, n: number): BorrowMarks {
  const top = Array.from({ length: n }, (_, i) => Math.floor(a / 10 ** i) % 10);
  const bot = Array.from({ length: n }, (_, i) => Math.floor(b / 10 ** i) % 10);
  const lent = new Array<boolean>(n).fill(false);
  const got = new Array<boolean>(n).fill(false);
  const cur = [...top];
  for (let i = 0; i < n; i++) {
    if (cur[i] >= bot[i]) continue;
    // Find the nearest column to the left that can lend; zeros in between become 9.
    let j = i + 1;
    while (j < n && cur[j] === 0) j++;
    if (j >= n) break; // a < b: not a valid problem for marks
    for (let k = j; k > i; k--) {
      cur[k] -= 1;
      lent[k] = true;
      cur[k - 1] += 10;
      got[k - 1] = true;
    }
  }
  return { lent, got, newTop: cur.map((d) => (d >= 10 ? d - 10 : d)) };
}

/** Add a typed digit: ones-first prepends (fills right to left), ltr appends. */
export function addDigit(input: string, digit: string, order: EntryOrder): string {
  return order === 'ones' ? digit + input : input + digit;
}

/** Remove the most recently typed digit. */
export function removeDigit(input: string, order: EntryOrder): string {
  return order === 'ones' ? input.slice(1) : input.slice(0, -1);
}

/** Is `typed` a correct-so-far partial of `answer` (ones-first: its right end)? */
export function onTrack(answer: string, typed: string, order: EntryOrder): boolean {
  return order === 'ones' ? answer.endsWith(typed) : answer.startsWith(typed);
}

/**
 * Could `typed` still become a different plausible answer with one more digit? Ones-first adds
 * a digit on the LEFT ("63" → "163"), so the smallest growth is 10^len + typed.
 */
export function couldGrowTyped(typed: string, order: EntryOrder, maxPlausible: number, maxLen: number): boolean {
  if (typed.length >= Math.min(maxLen, String(maxPlausible).length)) return false;
  if (order === 'ones') return 10 ** typed.length + Number(typed) <= maxPlausible;
  return Number(typed) * 10 <= maxPlausible;
}
