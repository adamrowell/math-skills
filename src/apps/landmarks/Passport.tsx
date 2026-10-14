/** Explorer passport (docs/GEO-LOGIC.md §D.7): a page per part of the world, a stamp per landmark. */
import { useState } from 'react';
import { TopBar, sfx, useTodayPoints } from '../../core';
import { speak } from '../maps/speech';
import { ISO } from './data/iso';
import type { HintGroup } from './data/iso';
import { LANDMARKS } from './data/landmarks';
import type { LandmarkDef } from './data/landmarks';
import { Photo } from './Photo';
import { progressStore } from './progress';

const PAGES: Array<{ id: string; title: string; emoji: string; groups: HintGroup[] }> = [
  { id: 'na', title: 'North America', emoji: '🦅', groups: ['North America'] },
  { id: 'sa', title: 'South America', emoji: '🦜', groups: ['South America'] },
  { id: 'eu', title: 'Europe', emoji: '🏰', groups: ['Europe', 'Europe and Asia'] },
  { id: 'af', title: 'Africa', emoji: '🦁', groups: ['Africa'] },
  { id: 'as', title: 'Asia', emoji: '🐼', groups: ['Asia'] },
  { id: 'oc', title: 'Oceania', emoji: '🦘', groups: ['Oceania'] },
];

const pageOf = (l: LandmarkDef) => PAGES.find((p) => p.groups.includes(ISO[l.cc]?.group))?.id ?? 'eu';

export function Passport({ onBack }: { onBack: () => void }) {
  const today = useTodayPoints();
  const p = progressStore.useStore();
  const [open, setOpen] = useState<LandmarkDef | null>(null);
  const total = Object.keys(p.stamps).length;

  const tap = (l: LandmarkDef) => {
    sfx.play('click');
    setOpen(l);
    speak(p.stamps[l.id] ? `${l.name}. ${l.fact}` : `${l.name}. Find it to get the stamp!`);
  };

  return (
    <div className="k-screen lm-screen lm-passport" style={{ ['--k-app' as string]: 'var(--k-app-landmarks)' }} data-testid="passport-screen">
      <TopBar
        onBack={onBack}
        title={
          <>
            <span className="k-emoji">🛂</span> Passport
          </>
        }
        points={today}
      />
      <div className="lm-scroll">
        <header className="lm-passport__head">
          <div className="lm-passport__count" data-testid="stamp-count" data-n={total}>
            <b className="k-num">{total}</b>/{LANDMARKS.length} stamps
          </div>
          <div className="lm-passport__bar" aria-hidden="true">
            <span style={{ width: `${(100 * total) / LANDMARKS.length}%` }} />
          </div>
        </header>
        {PAGES.map((page) => {
          const list = LANDMARKS.filter((l) => pageOf(l) === page.id);
          const got = list.filter((l) => p.stamps[l.id]).length;
          const countries = [...new Set(list.map((l) => l.cc))].filter((cc) => p.countries[cc]);
          return (
            <section key={page.id} className="lm-page" data-testid={`page-${page.id}`}>
              <h2 className="lm-page__title">
                <span className="k-emoji">{page.emoji}</span> {page.title}{' '}
                <span className="lm-page__n k-num">
                  {got}/{list.length}
                </span>
              </h2>
              {countries.length > 0 && (
                <div className="lm-page__done">
                  {countries.map((cc) => (
                    <span key={cc} className="lm-page__chip">
                      <span className="k-emoji">🎉</span> {ISO[cc].name.replace('United States of America', 'United States')}
                    </span>
                  ))}
                </div>
              )}
              <div className="lm-stamps">
                {list.map((l) => {
                  const has = Boolean(p.stamps[l.id]);
                  return (
                    <button
                      type="button"
                      key={l.id}
                      className={`lm-stamp${has ? ' is-on' : ''}`}
                      onClick={() => tap(l)}
                      data-testid={`stamp-${l.id}`}
                      data-on={has ? '1' : undefined}
                    >
                      <Photo id={l.id} alt={l.name} thumb />
                      {has && (
                        <span className="lm-stamp__ink" aria-hidden="true">
                          ✓
                        </span>
                      )}
                      <span className="lm-stamp__name">{l.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {open && <FactSheet l={open} stamped={Boolean(p.stamps[open.id])} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function FactSheet({ l, stamped, onClose }: { l: LandmarkDef; stamped?: boolean; onClose: () => void }) {
  return (
    <div className="lm-sheet" role="dialog" aria-label={l.name} onClick={onClose} data-testid="fact-sheet">
      <div className="lm-sheet__card" onClick={(e) => e.stopPropagation()}>
        <Photo id={l.id} alt={l.name} eager />
        <div className="lm-sheet__body">
          <h3>
            {l.name} {stamped !== undefined && <span className="k-emoji">{stamped ? '🛂' : '❔'}</span>}
          </h3>
          <div className="lm-sheet__where">
            <span className="k-emoji">📍</span> {ISO[l.cc]?.name.replace('United States of America', 'United States')}
          </div>
          <p>{l.fact}</p>
          <div className="lm-sheet__btns">
            <button type="button" className="lm-fact__say" onClick={() => speak(`${l.name}. ${l.fact}`)} aria-label="Read it">
              <span className="k-emoji">🔊</span>
            </button>
            <button type="button" className="k-btn k-btn--app" onClick={onClose} data-testid="sheet-close">
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
