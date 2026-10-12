import { useCallback, useEffect, useRef, useState } from 'react';
import type { RankInfo, RoundSummaryProps } from '../types';
import { trophyDef } from '../rewards/trophies';
import { BigButton } from './BigButton';
import { PlayButton } from './PlayButton';
import { IdleHint } from './IdleHint';
import './ui.css';

function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function RankUpOverlay({ info, onDone }: { info: RankInfo; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <button type="button" className="k-rankup" onClick={onDone} data-testid="rank-up">
      <div className="k-rankup__label">New rank!</div>
      <div className="k-emoji k-rankup__emoji">{info.rank.emoji}</div>
      <div className="k-rankup__name">{info.rank.name}</div>
    </button>
  );
}

export function RoundSummary({
  title,
  emoji = '🏁',
  stats,
  pointsEarned,
  best,
  trophies,
  rankUp,
  bestNote,
  bonusLines,
  onAgain,
  onHome,
  children,
}: RoundSummaryProps) {
  const shown = useCountUp(pointsEarned);
  // Kid-proofing: ignore taps for a moment so keypad-mashing at the buzzer doesn't skip the summary.
  const [armed, setArmed] = useState(false);
  const [showRank, setShowRank] = useState(Boolean(rankUp));
  const hideRank = useCallback(() => setShowRank(false), []);
  const againRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="k-summary-wrap" data-testid="round-summary">
      <div className="k-summary">
        <div className="k-summary__head">
          <span className="k-emoji k-summary__emoji">{emoji}</span>
          <h2 className="k-summary__title">{title}</h2>
        </div>

        <div className="k-summary__points" aria-label={`${pointsEarned} points earned`}>
          <span className="k-emoji">⭐</span>
          <span className="k-num" data-testid="summary-points">
            +{shown.toLocaleString()}
          </span>
        </div>
        {bonusLines && bonusLines.length > 0 && (
          <div className="k-summary__bonuses" data-testid="summary-bonuses">
            {bonusLines.map((b) => (
              <span key={b.label} className="k-chip k-chip--bonus">
                {b.emoji && <span className="k-emoji">{b.emoji}</span>} {b.label} <b className="k-num">+{b.points}</b>
              </span>
            ))}
          </div>
        )}

        {best && (
          <div className={`k-summary__best${best.isNewBest ? ' is-new' : ''}`} data-testid="summary-best">
            {best.isNewBest ? (
              <>
                <span className="k-emoji">🏆</span> New best! <b className="k-num">{best.value}</b>
                {best.previous !== null && best.previous !== undefined && (
                  <span className="k-summary__prev"> (was {best.previous})</span>
                )}
              </>
            ) : (
              <>
                {best.label}: <b className="k-num">{best.value}</b>
              </>
            )}
          </div>
        )}

        <div className="k-summary__stats">
          {stats.map((s) => (
            <div key={s.label} className={`k-stat${s.highlight ? ' is-hl' : ''}`}>
              <div className="k-stat__value k-num">
                {s.emoji && <span className="k-emoji">{s.emoji} </span>}
                {s.value}
              </div>
              <div className="k-stat__label">{s.label}</div>
            </div>
          ))}
        </div>

        {bestNote && (
          <div className="k-summary__note" data-testid="summary-best-note">
            {bestNote}
          </div>
        )}

        {trophies && trophies.length > 0 && (
          <div className="k-summary__trophies" data-testid="summary-trophies">
            {trophies.map((id) => {
              const t = trophyDef(id);
              return (
                <div key={id} className={`k-trophy-pop${trophies.length > 2 ? ' k-trophy-pop--mini' : ''}`} title={t.description}>
                  <span className="k-emoji">{t.emoji}</span>
                  <span>{t.title}</span>
                </div>
              );
            })}
            {trophies.length > 2 && <div className="k-summary__trophies-label">{trophies.length} new trophies!</div>}
          </div>
        )}

        {children}

        <div className="k-summary__actions">
          <PlayButton ref={againRef} variant="again" onClick={() => armed && onAgain()} data-testid="again" className="k-summary__again" />
          <BigButton size="lg" variant="ghost" onClick={() => armed && onHome()} data-testid="home" aria-disabled={!armed}>
            Home
          </BigButton>
        </div>
      </div>
      {showRank && rankUp && <RankUpOverlay info={rankUp} onDone={hideRank} />}
      <IdleHint target={againRef} on={armed && !(showRank && rankUp)} />
    </div>
  );
}
