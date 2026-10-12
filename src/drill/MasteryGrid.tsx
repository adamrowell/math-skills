import { Fragment } from 'react';
import type { MasteryGridProps } from './types';
import './drill.css';

/** Generic heat-map grid: grey (new) → blue (learning) → gold (mastered). */
export function MasteryGrid({ generator, mastery, onCell, onRowHeader, onColHeader, highlight }: MasteryGridProps) {
  const grid = generator.grid;
  if (!grid) return null;
  const all = new Map(generator.allFacts().map((f) => [f.id, f]));
  const hl = new Set(highlight ?? []);
  const cols = grid.cols.length;

  return (
    <div
      className="dr-grid"
      style={{ gridTemplateColumns: `minmax(28px, 1fr) repeat(${cols}, minmax(0, 1fr))` }}
      role="grid"
      aria-label="Mastery grid"
      data-testid="mastery-grid"
    >
      <div className="dr-grid__corner" aria-hidden="true">
        ×
      </div>
      {grid.cols.map((c) => {
        const set = grid.colSetId?.(c);
        return set || !grid.colSetId ? (
          <button
            key={`c${c}`}
            type="button"
            className="dr-grid__head"
            onClick={() => onColHeader?.(c, set)}
            data-testid="grid-col-head"
          >
            {grid.colLabel(c)}
          </button>
        ) : (
          <div key={`c${c}`} className="dr-grid__head is-static" aria-hidden="true">
            {grid.colLabel(c)}
          </div>
        );
      })}
      {grid.rows.map((rr) => (
        <Fragment key={`r${rr}`}>
          {grid.rowSetId?.(rr) || !grid.rowSetId ? (
            <button
              type="button"
              className="dr-grid__head"
              onClick={() => onRowHeader?.(rr, grid.rowSetId?.(rr))}
              data-testid="grid-row-head"
            >
              {grid.rowLabel(rr)}
            </button>
          ) : (
            <div className="dr-grid__head is-static" aria-hidden="true">
              {grid.rowLabel(rr)}
            </div>
          )}
          {grid.cols.map((c) => {
            const id = grid.cellFactId(rr, c);
            const fact = id ? all.get(id) : undefined;
            if (!fact || !id) return <div key={`${rr}-${c}`} className="dr-cell is-empty" />;
            const m = mastery.facts[id];
            const box = m ? m.box : -1;
            const earned = box >= 3;
            return (
              <button
                key={id}
                type="button"
                className={`dr-cell dr-cell--b${box}${hl.has(id) ? ' is-hl' : ''}`}
                onClick={() => onCell?.(fact, m)}
                aria-label={`${fact.prompt}${earned ? ` = ${fact.answer}` : ''}, level ${Math.max(0, box)} of 5`}
                data-testid="grid-cell"
              >
                {earned ? fact.answer : box === 5 ? '★' : ''}
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
