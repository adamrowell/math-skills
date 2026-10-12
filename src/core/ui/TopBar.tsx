import type { ComboFlameProps, TopBarProps } from '../types';
import './ui.css';

export function ComboFlame({ combo, multiplier }: ComboFlameProps) {
  if (combo < 2) return null;
  const level = combo >= 20 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1 : 0;
  return (
    <div className={`k-combo k-combo--l${level}`} data-testid="combo" aria-label={`Combo ${combo}`}>
      <span className="k-emoji k-combo__flame" key={level}>
        🔥
      </span>
      <span className="k-num k-combo__count" key={combo}>
        {combo}
      </span>
      {multiplier >= 1.5 && <span className="k-combo__mult">{multiplier}×</span>}
    </div>
  );
}

export function TopBar({ title, onBack, center, right, points, combo, comboMultiplier }: TopBarProps) {
  return (
    <header className="k-topbar k-noselect">
      <button type="button" className="k-topbar__back" onClick={onBack} aria-label="Back" data-testid="back">
        <span aria-hidden="true">←</span>
      </button>
      {title && <div className="k-topbar__title">{title}</div>}
      <div className="k-topbar__center">{center}</div>
      <div className="k-topbar__right">
        {combo !== undefined && <ComboFlame combo={combo} multiplier={comboMultiplier ?? 1} />}
        {right}
        {points !== undefined && (
          <div className="k-chip k-chip--points" data-testid="points-today" aria-label={`${points} points today`}>
            <span className="k-emoji">⭐</span>
            <span className="k-num">{points.toLocaleString()}</span>
          </div>
        )}
      </div>
    </header>
  );
}
