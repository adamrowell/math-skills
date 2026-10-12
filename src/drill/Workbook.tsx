/**
 * Workbook (vertical) layout for multi-digit + and − (docs/UX-V3.md §5): digit columns,
 * operator column, a rule, and one answer box per column filled ones-first.
 * Carry / borrow marks are cosmetic taps (never scored); the retype card shows them
 * automatically with the right answer in green.
 */
import { useEffect, useState } from 'react';
import { sfx } from '../core';
import type { Fact } from './types';
import { borrows, carries, digitCells, workbookColumns } from './columns';
import type { EntryOrder } from './columns';
import './workbook.css';

export interface WorkbookProps {
  fact: Fact;
  input: string;
  order: EntryOrder;
  /** Widest answer the generator can produce (digits). */
  answerDigits: number;
  /** play: empty boxes; retype: the answer shown in green under what he types; correct: all green. */
  mode: 'play' | 'retype' | 'correct';
}

const SLOTS_AFTER_MS = 3000;

export function Workbook({ fact, input, order, answerDigits, mode }: WorkbookProps) {
  const n = workbookColumns(fact, answerDigits);
  const [a, b] = fact.operands;
  const isAdd = fact.op === '+';
  const top = digitCells(a, n);
  const bottom = digitCells(b, n);
  const typed = digitCells(input, n);
  const answer = digitCells(fact.answer, n);
  const auto = mode === 'retype';

  // Cosmetic marks the kid toggles (keyed by column from the right). Cleared per problem via `key`.
  const [marks, setMarks] = useState<Record<number, boolean>>({});
  const [slotsTimeUp, setSlotsTimeUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlotsTimeUp(true), SLOTS_AFTER_MS);
    return () => clearTimeout(t);
  }, []);
  const slotsOn = mode === 'play' && (input.length > 0 || slotsTimeUp);

  const carry = isAdd ? carries(a, b, n) : null;
  const borrow = !isAdd ? borrows(a, b, n) : null;
  const toggle = (col: number) => {
    sfx.play('pop');
    setMarks((m) => ({ ...m, [col]: !m[col] }));
  };

  // Subtraction: tapping a top digit (not ones) lends 1 to the column on its right.
  const lentAt = (col: number) => (auto ? Boolean(borrow?.lent[col]) : Boolean(marks[col]));
  const gotAt = (col: number) => (auto ? Boolean(borrow?.got[col]) : Boolean(marks[col + 1]));

  const nextBox = order === 'ones' ? n - 1 - input.length : n - 1;
  const hundredsDashedFrom = Math.max(String(a).length, String(b).length); // extra carry column(s)

  const cols = Array.from({ length: n }, (_, i) => i); // left → right
  const fromRight = (i: number) => n - 1 - i;

  return (
    <div
      className={`wb wb--${mode}`}
      data-testid="workbook"
      data-cols={n}
      data-op={isAdd ? 'add' : 'sub'}
      style={{ ['--wb-n' as string]: n }}
      aria-hidden="true"
    >
      {/* Carry row */}
      <span className="wb-cell wb-op" />
      {cols.map((i) => {
        const c = fromRight(i);
        if (isAdd) {
          if (c === 0) return <span key={i} className="wb-cell wb-carry" />;
          const shown = auto ? Boolean(carry?.[c]) : Boolean(marks[c]);
          if (mode !== 'play')
            return (
              <span key={i} className="wb-cell wb-carry" data-testid={shown ? 'wb-carry-mark' : undefined}>
                {shown ? '1' : ''}
              </span>
            );
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              className={`wb-cell wb-carry wb-carry--slot${slotsOn ? ' is-on' : ''}${shown ? ' is-set' : ''}`}
              data-testid={`wb-carry-${c}`}
              onClick={() => toggle(c)}
            >
              {shown ? '1' : ''}
            </button>
          );
        }
        // Subtraction: the lowered digit above a lending column.
        const lent = lentAt(c);
        const nt = auto ? borrow?.newTop[c] : Number(top[i]) - 1;
        return (
          <span key={i} className="wb-cell wb-carry" data-testid={lent ? 'wb-borrow-mark' : undefined}>
            {lent && top[i] !== '' ? String(nt) : ''}
          </span>
        );
      })}

      {/* Top operand */}
      <span className="wb-cell wb-op" />
      {cols.map((i) => {
        const c = fromRight(i);
        const d = top[i];
        if (isAdd || d === '')
          return (
            <span key={i} className="wb-cell wb-digit">
              {d}
            </span>
          );
        const struck = lentAt(c);
        const got = gotAt(c);
        const canLend = mode === 'play' && c > 0 && Number(d) > 0;
        const content = (
          <>
            {got && <span className="wb-got">1</span>}
            <span className={struck ? 'wb-struck' : undefined}>{d}</span>
          </>
        );
        return canLend ? (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            className="wb-cell wb-digit wb-digit--tap"
            data-testid={`wb-borrow-${c}`}
            onClick={() => toggle(c)}
          >
            {content}
          </button>
        ) : (
          <span key={i} className="wb-cell wb-digit">
            {content}
          </span>
        );
      })}

      {/* Bottom operand with the operator */}
      <span className="wb-cell wb-op wb-op--sign">{isAdd ? '+' : '−'}</span>
      {cols.map((i) => (
        <span key={i} className="wb-cell wb-digit">
          {bottom[i]}
        </span>
      ))}

      <span className="wb-rule" />

      {/* Answer boxes */}
      <span className="wb-cell wb-op" />
      {cols.map((i) => {
        const c = fromRight(i);
        const t = typed[i];
        const ghost = mode === 'retype' && !t ? answer[i] : '';
        const active = mode === 'play' && i === nextBox && input.length < n;
        const extra = c >= hundredsDashedFrom && !t && !ghost;
        const cls = [
          'wb-box',
          t ? 'is-filled' : '',
          ghost ? 'is-ghost' : '',
          active ? 'is-next' : '',
          extra ? 'is-extra' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <span key={i} className={cls} data-testid={`wb-box-${c}`}>
            {t || ghost}
            {active && <span className="dr-caret wb-caret" />}
          </span>
        );
      })}
    </div>
  );
}
