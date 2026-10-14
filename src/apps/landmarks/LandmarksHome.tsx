import { AppHome, beginPlay, sfx } from '../../core';
import { primeSpeech } from '../maps/speech';
import { LANDMARKS } from './data/landmarks';
import { LEVELS, UNLOCK_STARS, landmarksOf, levelById } from './levels';
import { isUnlocked, progressStore, recommendedLevel, starsOf } from './progress';

interface Props {
  onBack: () => void;
  onPlay: (levelId: string) => void;
  onPassport: () => void;
  onGallery: () => void;
  onCredits: () => void;
}

function Stars({ n, testId }: { n: number; testId?: string }) {
  return (
    <span className="mp-stars" aria-label={`${n} of 3 stars`} data-testid={testId} data-stars={n}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`mp-star${i < n ? ' is-on' : ''}`}>
          ★
        </span>
      ))}
    </span>
  );
}

export function LandmarksHome({ onBack, onPlay, onPassport, onGallery, onCredits }: Props) {
  const progress = progressStore.useStore();
  const rec = recommendedLevel(progress);
  const stamps = Object.keys(progress.stamps).length;

  const play = (id: string) => {
    sfx.unlock();
    primeSpeech();
    onPlay(id);
  };
  const playNow = (id: string, title: string) => {
    beginPlay({ app: 'landmarks', label: `Find it · ${title}`, route: `/landmarks/find/${id}` });
    play(id);
  };

  const levels = (
    <ol className="mp-levels lm-levels">
      {LEVELS.map((l) => {
        const open = isUnlocked(progress, l);
        const n = landmarksOf(l).length;
        const after = l.after ? levelById(l.after) : undefined;
        return (
          <li key={l.id} className={`mp-level${open ? '' : ' is-locked'}`} data-testid={`level-${l.id}`} data-locked={open ? undefined : '1'}>
            <div className="mp-level__head">
              <span className="k-emoji mp-level__emoji">{open ? l.emoji : '🔒'}</span>
              <div className="mp-level__info">
                <div className="mp-level__title">{l.title}</div>
                <div className="mp-level__meta">
                  {open ? (
                    <>
                      {n} places · {l.blurb} <Stars n={starsOf(progress, l.id)} testId={`stars-${l.id}`} />
                    </>
                  ) : (
                    <>
                      Get <span className="mp-star is-on">{'★'.repeat(UNLOCK_STARS)}</span> on {after?.title}
                    </>
                  )}
                </div>
              </div>
            </div>
            {open && (
              <div className="mp-level__btns">
                <button type="button" className="mp-mode mp-mode--find" onClick={() => playNow(l.id, l.title)} data-testid={`play-${l.id}`}>
                  <span className="k-emoji">👆</span> Find it
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );

  const passport = (
    <div className="lm-more-row">
      <button type="button" className="mp-explore-btn" onClick={onPassport} data-testid="passport">
        <span className="k-emoji">🛂</span> My passport · <b className="k-num">{stamps}</b>/{LANDMARKS.length}
      </button>
    </div>
  );
  const look = (
    <div className="lm-more-row">
      <button type="button" className="mp-explore-btn" onClick={onGallery} data-testid="gallery">
        <span className="k-emoji">👀</span> Look at the photos
      </button>
      <button type="button" className="lm-credits-link" onClick={onCredits} data-testid="credits">
        Photo credits
      </button>
    </div>
  );

  return (
    <AppHome
      appId="landmarks"
      title="Landmarks"
      emoji="🗼"
      onBack={onBack}
      testId="landmarks-home"
      className="mp-screen mp-home lm-home"
      topRight={null}
      hero={{
        levelChip: (
          <>
            <span className="k-emoji">{rec.emoji}</span> {rec.title} <Stars n={starsOf(progress, rec.id)} />
          </>
        ),
        subtitle: rec.map === 'us' ? 'See the photo, tap the state!' : 'See the photo, tap the country!',
        bestLine:
          stamps > 0 ? (
            <span className="mp-mastered" data-testid="stamps">
              <span className="k-emoji">🛂</span> <b className="k-num">{stamps}</b>
              <span className="mp-mastered__of">/{LANDMARKS.length} stamps</span>
            </span>
          ) : undefined,
      }}
      playLabel={`Find it · ${rec.title}`}
      playRoute={`/landmarks/find/${rec.id}`}
      onPlay={() => play(rec.id)}
      levelSection="levels"
      more={[
        { id: 'passport', title: 'Passport', node: passport },
        { id: 'levels', title: 'Levels', node: levels },
        { id: 'look', title: 'Just look', node: look },
      ]}
    />
  );
}
