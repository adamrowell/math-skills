import { useState } from 'react';
import { TopBar, sfx, useTodayPoints } from '../../core';
import { speak } from '../maps/speech';
import { FLAGS, FLAG_BY_CC } from './data/flags';
import { Flag } from './Flag';
import { progressStore } from './progress';

interface Props {
  onBack: () => void;
}

const TIER_TITLE = { 1: 'Famous flags', 2: 'World flags', 3: 'Look-alikes' } as const;

/** The sticker album (docs/GEO-LOGIC.md §C.6): every flag he has earned, gold when mastered. */
export function Album({ onBack }: Props) {
  const today = useTodayPoints();
  const p = progressStore.useStore();
  const [open, setOpen] = useState<string | null>(null);
  const got = FLAGS.filter((f) => p.collected[f.cc]).length;
  const gold = FLAGS.filter((f) => p.gold[f.cc]).length;
  const sel = open ? FLAG_BY_CC.get(open) : undefined;

  const show = (cc: string) => {
    sfx.play('pop', 0.7);
    setOpen(cc);
    const f = FLAG_BY_CC.get(cc);
    if (f) speak(`${f.name}. ${f.fact}`);
  };

  return (
    <div className="k-screen fl-screen fl-album" style={{ ['--k-app' as string]: 'var(--k-app-flags)' }} data-testid="flags-album">
      <TopBar
        onBack={onBack}
        title={
          <>
            <span className="k-emoji">📒</span> Sticker Album
          </>
        }
        points={today}
      />
      <div className="fl-album__head" data-testid="album-count" data-collected={got} data-gold={gold}>
        <span>
          <span className="k-emoji">🏳️</span> <b className="k-num">{got}</b>/{FLAGS.length} collected
        </span>
        <span>
          <span className="k-emoji">⭐</span> <b className="k-num">{gold}</b> gold
        </span>
      </div>
      <main className="fl-album__body">
        {([1, 2, 3] as const).map((tier) => (
          <section key={tier} className="fl-album__page">
            <h2 className="fl-album__title">{TIER_TITLE[tier]}</h2>
            <div className="fl-album__grid">
              {FLAGS.filter((f) => f.tier === tier).map((f) => {
                const has = Boolean(p.collected[f.cc]);
                const isGold = Boolean(p.gold[f.cc]);
                return has ? (
                  <button
                    type="button"
                    key={f.cc}
                    className={`fl-sticker is-got${isGold ? ' is-gold' : ''}`}
                    data-testid="album-slot"
                    data-cc={f.cc}
                    data-got="1"
                    onClick={() => show(f.cc)}
                    aria-label={f.name}
                  >
                    <Flag cc={f.cc} alt="" />
                    <span className="fl-sticker__name">{f.name}</span>
                  </button>
                ) : (
                  <div key={f.cc} className="fl-sticker is-empty" data-testid="album-slot" data-cc={f.cc} aria-label="Not collected yet">
                    <span className="fl-sticker__q">?</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <p className="fl-album__how">
          Get a flag right first try in <b>Find it</b> to win its sticker. Know it really well and its frame turns <b>gold</b>!
        </p>
      </main>
      {sel && (
        <div className="fl-sheet" role="dialog" aria-label={sel.name} onClick={() => setOpen(null)} data-testid="album-detail">
          <div className={`fl-sheet__card${p.gold[sel.cc] ? ' is-gold' : ''}`} onClick={(e) => e.stopPropagation()}>
            <Flag cc={sel.cc} className="fl-flag--big" />
            <div className="fl-sheet__name">{sel.name}</div>
            <div className="fl-sheet__fact">{sel.fact}</div>
            <div className="fl-sheet__btns">
              <button type="button" className="mp-say" aria-label="Say it" onClick={() => speak(`${sel.name}. ${sel.fact}`)}>
                <span className="k-emoji">🔊</span>
              </button>
              <button type="button" className="k-btn k-btn--app" onClick={() => setOpen(null)} data-testid="album-close">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
