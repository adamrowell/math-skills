import { Fragment } from 'react';
import type { Fact, FactMastery, MasteryState } from '../../drill';
import { divId, divisionFactById } from './facts';

interface Props {
  mastery: MasteryState;
  onCell: (fact: Fact, m: FactMastery | undefined) => void;
  onRow: (divisor: number) => void;
}

const N = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * 12 × 12 division heat map: row = divide by, column = answer. A learned cell shows the number
 * being divided (row 7, column 8 → 56), so the grid reads "56 ÷ 7 = 8".
 */
export function DivisionGrid({ mastery, onCell, onRow }: Props) {
  return (
    <div
      className="dr-grid ff-grid"
      style={{ gridTemplateColumns: `minmax(28px, 1fr) repeat(12, minmax(0, 1fr))` }}
      role="grid"
      aria-label="Division grid"
      data-testid="mastery-grid"
    >
      <div className="dr-grid__corner" aria-hidden="true">
        ÷
      </div>
      {N.map((c) => (
        <div key={`c${c}`} className="dr-grid__head is-static" aria-hidden="true">
          {c}
        </div>
      ))}
      {N.map((r) => (
        <Fragment key={`r${r}`}>
          {r >= 2 ? (
            <button type="button" className="dr-grid__head" onClick={() => onRow(r)} data-testid="grid-row-head" aria-label={`Practise divide by ${r}`}>
              {r}
            </button>
          ) : (
            <div className="dr-grid__head is-static" aria-hidden="true">
              {r}
            </div>
          )}
          {N.map((c) => {
            const id = divId(r, c);
            const fact = divisionFactById(id);
            if (!fact) return <div key={id} className="dr-cell is-empty" />;
            const m = mastery.facts[id];
            const box = m ? m.box : -1;
            const earned = box >= 3;
            return (
              <button
                key={id}
                type="button"
                className={`dr-cell dr-cell--b${box}`}
                onClick={() => onCell(fact, m)}
                aria-label={`${fact.prompt}${earned ? ` = ${fact.answer}` : ''}, level ${Math.max(0, box)} of 5`}
                data-testid="grid-cell"
              >
                {earned ? r * c : ''}
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
