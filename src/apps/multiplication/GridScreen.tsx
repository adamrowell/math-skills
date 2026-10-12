import { useEffect, useState } from 'react';
import { BigButton, TopBar, sfx, useTodayPoints } from '../../core';
import { MasteryGrid, PRACTICE, gridStats, masteryStore, formatSeconds } from '../../drill';
import type { Fact, FactMastery, RoundFormat } from '../../drill';
import { multiplicationGenerator } from './facts';
import './multiplication.css';

interface Props {
  onBack: () => void;
  onPlay: (format: RoundFormat, setId: string) => void;
}

const LEVELS = ['New', 'Started', 'Learning', 'Good', 'Great', 'Gold'];

export function GridScreen({ onBack, onPlay }: Props) {
  const today = useTodayPoints();
  const mastery = masteryStore('multiplication').useStore();
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
  const g = gridStats(multiplicationGenerator, mastery);

  const practice = (setId: string | undefined) => {
    if (!setId) return;
    sfx.play('click');
    onPlay(PRACTICE, setId);
  };

  const box = sel?.m?.box ?? -1;

  return (
    <div className="k-screen mu-gridscreen" style={{ ['--k-app' as string]: 'var(--k-app-multiplication)' }}>
      <TopBar
        onBack={() => (sel ? setSel(null) : onBack())}
        title={
          <>
            <span className="k-emoji">🌟</span> My Grid
          </>
        }
        points={today}
      />
      <main className="mu-grid-main">
        <div className="mu-grid-side">
          <div className="mu-grid-score" data-testid="grid-score">
            <b className="k-num">{g.gold}</b> gold · <b className="k-num">{g.learning}</b> strong · of {g.total}
          </div>
          <div className="mu-legend" aria-hidden="true">
            <span className="mu-legend__item">
              <span className="dr-cell dr-cell--b-1" /> new
            </span>
            <span className="mu-legend__item">
              <span className="dr-cell dr-cell--b0" /> oops
            </span>
            <span className="mu-legend__item">
              <span className="dr-cell dr-cell--b1" />
              <span className="dr-cell dr-cell--b3" /> learning
            </span>
            <span className="mu-legend__item">
              <span className="dr-cell dr-cell--b5" /> gold
            </span>
          </div>
          <div className="mu-grid-hint">Tap a number on the edge to practise that table</div>
        </div>
        <MasteryGrid
          generator={multiplicationGenerator}
          mastery={mastery}
          onCell={(fact, m) => {
            sfx.play('pop');
            setSel({ fact, m });
          }}
          onRowHeader={(_r, setId) => practice(setId)}
          onColHeader={(_c, setId) => practice(setId)}
        />

        {sel && (
          <div className="mu-cellinfo" data-testid="cell-info" onClick={() => setSel(null)}>
            <div className="mu-cellinfo__card" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="k-sheet-close" onClick={() => setSel(null)} aria-label="Close" data-testid="cell-info-close">
                ✕
              </button>
              <div className="mu-cellinfo__fact k-num">
                {sel.fact.prompt} = {sel.fact.answer}
              </div>
              <div className="mu-cellinfo__stars" aria-label={`Level ${Math.max(0, box)} of 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={`k-emoji${i < box ? '' : ' is-dim'}`}>
                    ⭐
                  </span>
                ))}
              </div>
              <div className="mu-cellinfo__level">{LEVELS[Math.max(0, box)]}</div>
              {sel.m && sel.m.attempts > 0 ? (
                <div className="mu-cellinfo__stats">
                  Right {sel.m.correct} of {sel.m.attempts}
                  {sel.m.bestMs > 0 && <> · fastest {formatSeconds(sel.m.bestMs)}</>}
                </div>
              ) : (
                <div className="mu-cellinfo__stats">Not tried yet</div>
              )}
              {(() => {
                // Practise the harder table of the two (7 × 1 → the 7s; 1 × 1 → nothing to practise).
                const n = Math.max(...sel.fact.operands);
                const setId = multiplicationGenerator.grid?.rowSetId?.(n);
                return setId ? (
                  <BigButton size="lg" onClick={() => practice(setId)}>
                    Practise ×{n}
                  </BigButton>
                ) : null;
              })()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
