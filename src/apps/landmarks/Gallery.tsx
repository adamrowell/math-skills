/** "Just look": every photo of the unlocked levels with its name; tap = hear it + the fact. Free, no points. */
import { useState } from 'react';
import { TopBar, sfx, useTodayPoints } from '../../core';
import { speak } from '../maps/speech';
import type { LandmarkDef } from './data/landmarks';
import { LEVELS, landmarksOf } from './levels';
import { FactSheet } from './Passport';
import { Photo } from './Photo';
import { isUnlocked, progressStore } from './progress';

export function Gallery({ onBack, onCredits }: { onBack: () => void; onCredits: () => void }) {
  const today = useTodayPoints();
  const p = progressStore.useStore();
  const [open, setOpen] = useState<LandmarkDef | null>(null);
  const seen = new Set<string>();
  const list = LEVELS.filter((l) => isUnlocked(p, l))
    .flatMap(landmarksOf)
    .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
  const locked = LEVELS.some((l) => !isUnlocked(p, l));

  return (
    <div className="k-screen lm-screen lm-gallery" style={{ ['--k-app' as string]: 'var(--k-app-landmarks)' }} data-testid="gallery-screen">
      <TopBar
        onBack={onBack}
        title={
          <>
            <span className="k-emoji">👀</span> Just look
          </>
        }
        points={today}
      />
      <div className="lm-scroll">
        <div className="lm-gallery__grid">
          {list.map((l) => (
            <button
              type="button"
              key={l.id}
              className="lm-gallery__item"
              data-testid={`look-${l.id}`}
              onClick={() => {
                sfx.play('click');
                setOpen(l);
                speak(`${l.name}. ${l.fact}`);
              }}
            >
              <Photo id={l.id} alt={l.name} />
              <span className="lm-gallery__name">{l.name}</span>
            </button>
          ))}
        </div>
        {locked && (
          <p className="lm-gallery__more">
            <span className="k-emoji">🔒</span> More photos open with new levels.
          </p>
        )}
        <button type="button" className="lm-credits-link" onClick={onCredits}>
          Photo credits
        </button>
      </div>
      {open && <FactSheet l={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
