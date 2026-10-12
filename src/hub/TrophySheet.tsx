/** Bottom sheet opened from the hub's 🏆 chip: points totals + the trophy shelf (UX-V3 §2.1). */
import { useEffect } from 'react';
import { TROPHIES } from '../core';
import type { RewardsState } from '../core';

export function TrophySheet({
  rewards,
  today,
  week,
  bank,
  streak,
  onClose,
}: {
  rewards: RewardsState;
  today: number;
  week: number;
  bank: number;
  streak: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const got = Object.keys(rewards.trophies).length;
  return (
    <div className="hub-sheet" role="dialog" aria-label="My trophies" data-testid="trophy-sheet" onClick={onClose}>
      <div className="hub-sheet__card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="k-sheet-close" onClick={onClose} aria-label="Close" data-testid="sheet-close">
          ✕
        </button>
        <div className="hub-sheet__totals">
          <div className="hub-kv">
            <span className="k-emoji">⭐</span> Today <b className="k-num">{today.toLocaleString()}</b>
          </div>
          <div className="hub-kv">
            <span className="k-emoji">📅</span> This week{' '}
            <b className="k-num" data-testid="hub-week">
              {week.toLocaleString()}
            </b>
          </div>
          <div className="hub-kv">
            <span className="k-emoji">💰</span> Saved up{' '}
            <b className="k-num" data-testid="hub-bank">
              {bank.toLocaleString()}
            </b>
          </div>
          {streak > 0 && (
            <div className="hub-kv hub-kv--streak">
              <span className="k-emoji">🔥</span> {streak} day{streak === 1 ? '' : 's'} in a row
            </div>
          )}
        </div>
        <h2 className="hub-section-title">
          <span className="k-emoji">🏆</span> Trophies{' '}
          <span className="hub-section-count k-num">
            {got}/{TROPHIES.length}
          </span>
        </h2>
        <div className="hub-shelf">
          {TROPHIES.map((t) => {
            const has = Boolean(rewards.trophies[t.id]);
            return (
              <div key={t.id} className={`hub-trophy${has ? ' is-got' : ''}`} title={`${t.title}: ${t.description}`}>
                <span className="k-emoji hub-trophy__emoji">{has ? t.emoji : '🔒'}</span>
                <span className="hub-trophy__name">{t.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
