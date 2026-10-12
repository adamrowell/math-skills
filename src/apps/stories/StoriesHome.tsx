import { AppHome, sfx, toast } from '../../core';
import { canSpeak } from '../words/reading/speech';
import { LEVELS, levelDef } from './problems';
import type { LevelDef, LevelId } from './problems';
import { UNLOCK_STARS, progressStore, selectLevel, setAutoRead } from './progress';
import './stories.css';

interface Props {
  onBack: () => void;
  onPlay: (level: LevelId) => void;
}

function StarRow({ n }: { n: number }) {
  return (
    <span className="st-stars st-stars--sm" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`st-star${i <= n ? ' is-on' : ''}`}>
          {i <= n ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

export function StoriesHome({ onBack, onPlay }: Props) {
  const progress = progressStore.useStore();
  const cur = levelDef(progress.level);
  const curStars = progress.stars[cur.id] ?? 0;

  // Choosing a level never starts a round: it updates the level chip (UX-V3 §2.2).
  const tapLevel = (l: LevelDef) => {
    sfx.unlock();
    if (l.id > progress.unlocked) {
      sfx.play('wrong', 0.4);
      toast.show(`Get ${'★'.repeat(UNLOCK_STARS)} on Level ${progress.unlocked} to unlock!`, { emoji: '🔒', durationMs: 2400 });
      return;
    }
    sfx.play('click');
    selectLevel(l.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const levels = (
    <section className="st-levels" aria-label="Levels">
      {LEVELS.map((l) => {
        const locked = l.id > progress.unlocked;
        const isCur = l.id === progress.level;
        return (
          <button
            key={l.id}
            type="button"
            className={`st-level${locked ? ' is-locked' : ''}${isCur ? ' is-current' : ''}`}
            onClick={() => tapLevel(l)}
            data-testid={`level-${l.id}`}
            aria-pressed={isCur}
            aria-label={`Level ${l.id}: ${l.title}${locked ? ' (locked)' : ''}`}
          >
            <span className="st-level__num k-num">{locked ? <span className="k-emoji">🔒</span> : l.id}</span>
            <span className="st-level__body">
              <span className="st-level__title">
                <span className="k-emoji">{l.emoji}</span> {l.title}
              </span>
              <span className="st-level__blurb">
                {l.blurb} · <span className="k-num">{l.example}</span>
              </span>
            </span>
            {!locked && <StarRow n={progress.stars[l.id] ?? 0} />}
          </button>
        );
      })}
    </section>
  );

  const reader = canSpeak() ? (
    <label className="st-toggle" data-testid="autoread">
      <input type="checkbox" checked={progress.autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
      <span className="st-toggle__ui" aria-hidden="true" />
      <span>
        <span className="k-emoji">🔊</span> Always read the story to me
      </span>
    </label>
  ) : (
    <p className="st-note">This browser can’t read out loud.</p>
  );

  return (
    <AppHome
      appId="stories"
      title="Story Problems"
      emoji="📚"
      onBack={onBack}
      className="st-home"
      hero={{
        above: (
          <div className="st-hero__sample" aria-hidden="true">
            <span className="k-emoji">🍎🍎🍎</span> + <span className="k-emoji">🍎🍎</span> = <span className="st-hero__q">?</span>
          </div>
        ),
        levelChip: (
          <>
            <span className="k-emoji">{cur.emoji}</span> Level {cur.id} · {cur.title} <StarRow n={curStars} />
          </>
        ),
        subtitle: '8 stories. Read, think, type.',
      }}
      playLabel={`Level ${cur.id}`}
      playRoute={`/stories/play/${cur.id}`}
      onPlay={() => onPlay(cur.id)}
      more={[
        { id: 'levels', title: 'Levels', node: levels },
        { id: 'reading', title: 'Reading help', node: reader },
      ]}
      levelSection="levels"
    />
  );
}
