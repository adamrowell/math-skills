import { useEffect, useState } from 'react';
import { BigButton, TopBar, sfx, useTodayPoints } from '../../core';
import { PRACTICE, formatSeconds, gridStats, masteryStore } from '../../drill';
import type { Fact, FactMastery, RoundFormat } from '../../drill';
import { divisionGenerator } from './facts';
import { DivisionGrid } from './DivisionGrid';
import './facts-home.css';

interface Props {
  onBack: () => void;
  onPlay: (format: RoundFormat, setId: string) => void;
}

const LEVELS = ['New', 'Started', 'Learning', 'Good', 'Great', 'Gold'];

export function GridScreen({ onBack, onPlay }: Props) {
  const today = useTodayPoints();
  const mastery = masteryStore('division').useStore();
  const [sel, setSel] = useState<{ fact: Fact; m: FactMastery | undefined } | null>(null);
  // The fact card closes with ✕, a tap outside, Escape, or the Back arrow.
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel]);
  const g = gridStats(divisionGenerator, mastery);
  const box = sel?.m?.box ?? -1;
  const practice = (n: number) => {
    if (n < 2) return;
    sfx.play('click');
    onPlay(PRACTICE, `table-${n}`);
  };

  return (
    <div className="k-screen ff-screen" style={{ ['--k-app' as string]: 'var(--k-app-division)' }} data-testid="division-grid">
      <TopBar
        onBack={() => (sel ? setSel(null) : onBack())}
        title={
          <>
            <span className="k-emoji">🌟</span> My Grid
          </>
        }
        points={today}
      />
      <main className="ff-grid-main">
        <div className="ff-grid-side">
          <div className="ff-grid-score" data-testid="grid-score">
            <b className="k-num">{g.gold}</b> gold · <b className="k-num">{g.learning}</b> strong · of {g.total}
          </div>
          <div className="ff-legend" aria-hidden="true">
            <span className="ff-legend__item">
              <span className="dr-cell dr-cell--b-1" /> new
            </span>
            <span className="ff-legend__item">
              <span className="dr-cell dr-cell--b0" /> oops
            </span>
            <span className="ff-legend__item">
              <span className="dr-cell dr-cell--b1" />
              <span className="dr-cell dr-cell--b3" /> learning
            </span>
            <span className="ff-legend__item">
              <span className="dr-cell dr-cell--b5" /> gold
            </span>
          </div>
          <div className="ff-grid-hint">Rows: divide by · columns: the answer. Tap a row number to practise it.</div>
        </div>
        <DivisionGrid
          mastery={mastery}
          onCell={(fact, m) => {
            sfx.play('pop');
            setSel({ fact, m });
          }}
          onRow={practice}
        />
        {sel && (
          <div className="ff-cellinfo" data-testid="cell-info" onClick={() => setSel(null)}>
            <div className="ff-cellinfo__card" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="k-sheet-close" onClick={() => setSel(null)} aria-label="Close" data-testid="cell-info-close">
                ✕
              </button>
              <div className="ff-cellinfo__fact k-num">
                {sel.fact.prompt} = {sel.fact.answer}
              </div>
              <div className="ff-cellinfo__stars" aria-label={`Level ${Math.max(0, box)} of 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={`k-emoji${i < box ? '' : ' is-dim'}`}>
                    ⭐
                  </span>
                ))}
              </div>
              <div className="ff-cellinfo__level">{LEVELS[Math.max(0, box)]}</div>
              <div className="ff-cellinfo__stats">
                {sel.m && sel.m.attempts > 0 ? (
                  <>
                    Right {sel.m.correct} of {sel.m.attempts}
                    {sel.m.bestMs > 0 && <> · fastest {formatSeconds(sel.m.bestMs)}</>}
                  </>
                ) : (
                  'Not tried yet'
                )}
              </div>
              {sel.fact.operands[1] >= 2 && (
                <BigButton size="lg" onClick={() => practice(sel.fact.operands[1])}>
                  Practise ÷{sel.fact.operands[1]}
                </BigButton>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
