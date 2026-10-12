import { useState } from 'react';
import { BigButton, TopBar, sfx } from '../../core';
import { PictureArt } from './art';
import { formatTime } from './game';
import { LEVELS } from './levels';
import type { Picture } from './pictures';
import { PICTURES } from './pictures';
import { galleryStore } from './store';

interface Props {
  onBack: () => void;
  /** Draw this picture (at the current level, or Medium when it is not in the Easy set). */
  onDraw: (pic: Picture) => void;
}

export function Gallery({ onBack, onDraw }: Props) {
  const g = galleryStore.useStore();
  const [open, setOpen] = useState<Picture | null>(null);
  const drawn = PICTURES.filter((p) => g.entries[p.id]).length;
  const entry = open ? g.entries[open.id] : undefined;

  return (
    <div className="k-screen co-gallery" style={{ ['--k-app' as string]: 'var(--k-app-coordinates)' }} data-testid="co-gallery">
      <TopBar
        onBack={onBack}
        title={
          <>
            <span className="k-emoji">🖼️</span> My Pictures
          </>
        }
        center={
          <span className="co-gallery__count k-num">
            {drawn}/{PICTURES.length}
          </span>
        }
      />
      <main className="co-gallery__grid">
        {PICTURES.map((p, i) => {
          const e = g.entries[p.id];
          if (!e)
            return (
              <button
                key={p.id}
                type="button"
                className="co-card is-mystery"
                onClick={() => {
                  sfx.play('click');
                  onDraw(p);
                }}
                data-testid={`card-${p.id}`}
                aria-label={`Mystery picture ${i + 1}. Tap to draw it.`}
              >
                <div className="co-card__q">?</div>
                <div className="co-card__name">Mystery #{i + 1}</div>
              </button>
            );
          return (
            <button
              key={p.id}
              type="button"
              className="co-card"
              onClick={() => {
                sfx.play('click');
                setOpen(p);
              }}
              data-testid={`card-${p.id}`}
            >
              <PictureArt pic={p} className="co-card__art" grid={false} />
              <div className="co-card__name">{p.name}</div>
              {e.count > 1 && <div className="co-card__badge k-num">×{e.count}</div>}
            </button>
          );
        })}
      </main>

      {open && entry && (
        <div className="co-sheet" onClick={() => setOpen(null)} data-testid="picture-sheet">
          <div className="co-sheet__card co-sheet__card--pic" onClick={(e) => e.stopPropagation()}>
            <div className="co-sheet__title">
              <span className="k-emoji">{open.emoji}</span> {open.name}
            </div>
            <PictureArt pic={open} className="co-sheet__art" />
            <div className="co-sheet__facts">
              <span>
                Drawn <b className="k-num">{entry.count}×</b>
              </span>
              <span>
                Fastest <b className="k-num">{formatTime(entry.bestMs)}</b>
              </span>
              <span>
                Fewest misses <b className="k-num">{entry.bestMisses}</b>
              </span>
            </div>
            <div className="co-sheet__levels">
              {LEVELS.map((l) => (
                <span key={l.id} className={`co-lvl-badge${entry.levels.includes(l.id) ? ' is-done' : ''}`}>
                  <span className="k-emoji">{entry.levels.includes(l.id) ? l.emoji : '·'}</span> {l.name}
                </span>
              ))}
            </div>
            <BigButton size="xl" onClick={() => onDraw(open)} data-testid="draw-again">
              Draw again <span className="k-emoji">✏️</span>
            </BigButton>
            <BigButton size="lg" variant="ghost" onClick={() => setOpen(null)} data-testid="close-sheet">
              Close
            </BigButton>
          </div>
        </div>
      )}
    </div>
  );
}
