/**
 * Brain Map (docs/GEO-LOGIC.md §E.3): one tile per family with three dots (easy / medium / hard)
 * coloured by mastery box, and the adaptive level. A tile starts a practice round of that family.
 */
import { TopBar, sfx, useTodayPoints } from '../../../core';
import type { CSSProperties } from 'react';
import { masteryStore } from '../../../drill';
import type { Difficulty, FamilyId } from '../engine/types';
import { FAMILY_IDS } from '../engine/types';
import { byId } from '../engine/registry';
import { factId, levelOf } from '../engine/session';
import { progressStore } from '../progress';
import { familyEmoji, familyTitle } from './familyInfo';

const boxTone = (box: number | undefined) => (box === undefined ? 'none' : box >= 4 ? 'gold' : box >= 2 ? 'good' : box >= 1 ? 'start' : 'tried');
const D_LABEL: Record<Difficulty, string> = { 1: 'easy', 2: 'medium', 3: 'hard' };

export function BrainMapGrid({ onPick, compact }: { onPick: (f: FamilyId) => void; compact?: boolean }) {
  const mastery = masteryStore('logic').useStore();
  const progress = progressStore.useStore();
  return (
    <div className={`lg-map${compact ? ' lg-map--compact' : ''}`} data-testid="brain-map">
      {FAMILY_IDS.map((f) => {
        const ready = Boolean(byId(f));
        const lvl = levelOf(progress, f);
        return (
          <button
            key={f}
            type="button"
            className={`lg-tile${ready ? '' : ' is-soon'}`}
            disabled={!ready}
            data-testid={`tile-${f}`}
            onClick={() => {
              sfx.play('click');
              onPick(f);
            }}
            aria-label={`${familyTitle(f)}${ready ? `, level ${lvl}` : ', coming soon'}`}
          >
            <span className="lg-tile__emoji k-emoji" aria-hidden="true">
              {familyEmoji(f)}
            </span>
            <span className="lg-tile__title">{familyTitle(f)}</span>
            <span className="lg-tile__dots" aria-hidden="true">
              {([1, 2, 3] as Difficulty[]).map((d) => {
                const e = mastery.facts[factId(f, d)];
                return <span key={d} className={`lg-tile__dot is-${boxTone(e && e.attempts > 0 ? e.box : undefined)}`} title={D_LABEL[d]} />;
              })}
            </span>
            {ready && progress.level[f] && <span className="lg-tile__lvl">L{lvl}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function BrainMap({ onBack, onPick }: { onBack: () => void; onPick: (f: FamilyId) => void }) {
  const today = useTodayPoints();
  const style = { ['--k-app' as string]: 'var(--k-app-logic)' } as CSSProperties;
  return (
    <div className="k-screen lg-screen lg-mapscreen" style={style} data-testid="logic-map">
      <TopBar
        onBack={onBack}
        title={
          <>
            <span className="k-emoji">🗺️</span> Brain Map
          </>
        }
        points={today}
      />
      <main className="lg-mapscreen__main">
        <p className="lg-mapscreen__sub">Tap a puzzle to practise just that kind (half points).</p>
        <div className="lg-legend" aria-hidden="true">
          <span>
            <i className="lg-tile__dot is-none" /> not yet
          </span>
          <span>
            <i className="lg-tile__dot is-start" /> learning
          </span>
          <span>
            <i className="lg-tile__dot is-good" /> good
          </span>
          <span>
            <i className="lg-tile__dot is-gold" /> mastered
          </span>
          <span>· dots = easy, medium, hard</span>
        </div>
        <BrainMapGrid onPick={onPick} />
      </main>
    </div>
  );
}
