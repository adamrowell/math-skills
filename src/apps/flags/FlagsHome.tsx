import { AppHome, beginPlay, sfx } from '../../core';
import { primeSpeech } from '../maps/speech';
import { FLAGS } from './data/flags';
import { Flag } from './Flag';
import { LEVELS, UNLOCK_STARS } from './logic';
import type { FlagMode, LevelId } from './logic';
import { isLevelUnlocked, isSpotterUnlocked, isWhichUnlocked, progressStore, recommendedLevel, starsOf } from './progress';

interface Props {
  onBack: () => void;
  navigate: (route: string) => void;
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

export function FlagsHome({ onBack, navigate }: Props) {
  const p = progressStore.useStore();
  const rec = recommendedLevel(p);
  const collected = FLAGS.filter((f) => p.collected[f.cc]).length;
  const spotterOpen = isSpotterUnlocked(p);
  const spotterBest = p.plays.spotter ? true : false;

  const go = (route: string) => {
    sfx.unlock();
    primeSpeech();
    navigate(route);
  };
  const playNow = (mode: FlagMode, level: LevelId, title: string) => {
    beginPlay({ app: 'flags', label: `${mode === 'find' ? 'Find it' : 'Which flag?'} · ${title}`, route: `/flags/${mode}/${level}` });
    go(`/flags/${mode}/${level}`);
  };

  // A few of the stickers he has, as the hero decoration (or the famous ones when new).
  const show = (collected ? FLAGS.filter((f) => p.collected[f.cc]) : FLAGS.filter((f) => f.tier === 1)).slice(-5).map((f) => f.cc);

  const levels = (
    <ol className="mp-levels">
      {LEVELS.map((l, i) => {
        const open = isLevelUnlocked(p, l);
        const fs = starsOf(p, 'find', l.id);
        const whichOpen = isWhichUnlocked(p, l.id);
        const ws = starsOf(p, 'which', l.id);
        const got = l.flags.filter((cc) => p.collected[cc]).length;
        return (
          <li key={l.id} className={`mp-level${open ? '' : ' is-locked'}`} data-testid={`level-${l.id}`} data-locked={open ? undefined : '1'}>
            <div className="mp-level__head">
              <span className="k-emoji mp-level__emoji">{open ? l.emoji : '🔒'}</span>
              <div className="mp-level__info">
                <div className="mp-level__title">{l.title}</div>
                <div className="mp-level__meta">
                  {open ? (
                    <>
                      {got}/{l.flags.length} flags <Stars n={fs} testId={`stars-${l.id}`} />
                    </>
                  ) : (
                    <>
                      Get <span className="mp-star is-on">★★</span> on {LEVELS[i - 1]?.title}
                    </>
                  )}
                </div>
              </div>
            </div>
            {open && (
              <div className="mp-level__btns">
                <button type="button" className="mp-mode mp-mode--find" onClick={() => playNow('find', l.id, l.title)} data-testid={`find-${l.id}`}>
                  <span className="k-emoji">👆</span> Find it
                </button>
                <button
                  type="button"
                  className={`mp-mode mp-mode--name${whichOpen ? '' : ' is-locked'}`}
                  onClick={() => whichOpen && playNow('which', l.id, l.title)}
                  aria-disabled={!whichOpen}
                  data-testid={`which-${l.id}`}
                  title={whichOpen ? undefined : `Get ${UNLOCK_STARS} stars in Find it`}
                >
                  {whichOpen ? (
                    <>
                      <span className="k-emoji">🤔</span> Which flag? {ws > 0 && <Stars n={ws} />}
                    </>
                  ) : (
                    <>
                      <span className="k-emoji">🔒</span> Which flag?
                    </>
                  )}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );

  const extras = (
    <div className="fl-extras">
      <button type="button" className="fl-extra" onClick={() => go('/flags/album')} data-testid="open-album">
        <span className="k-emoji fl-extra__emoji">📒</span>
        <span>
          <b>Sticker Album</b>
          <span className="fl-extra__sub">
            {collected}/{FLAGS.length} collected
          </span>
        </span>
      </button>
      <button
        type="button"
        className={`fl-extra${spotterOpen ? '' : ' is-locked'}`}
        aria-disabled={!spotterOpen}
        onClick={() => {
          if (!spotterOpen) return;
          beginPlay({ app: 'flags', label: 'Flag Spotter', route: '/flags/spotter' });
          go('/flags/spotter');
        }}
        data-testid="open-spotter"
      >
        <span className="k-emoji fl-extra__emoji">{spotterOpen ? '⚡' : '🔒'}</span>
        <span>
          <b>Flag Spotter</b>
          <span className="fl-extra__sub">{spotterOpen ? (spotterBest ? '45 seconds — beat your best!' : '45 seconds — how many?') : 'Get ★★ in Which flag? (Famous)'}</span>
        </span>
      </button>
    </div>
  );

  return (
    <AppHome
      appId="flags"
      title="Flags"
      emoji="🏳️"
      onBack={onBack}
      testId="flags-home"
      className="fl-screen fl-home"
      topRight={null}
      hero={{
        levelChip: (
          <>
            <span className="k-emoji">{rec.emoji}</span> {rec.title} <Stars n={starsOf(p, 'find', rec.id)} />
          </>
        ),
        subtitle: 'See the flag, find the country!',
        above: (
          <div className="fl-hero-flags" aria-hidden="true">
            {show.map((cc, i) => (
              <span key={cc} className="fl-hero-flag" style={{ ['--i' as string]: i }}>
                <Flag cc={cc} alt="" />
              </span>
            ))}
          </div>
        ),
        bestLine:
          collected > 0 ? (
            <span className="mp-mastered" data-testid="collected">
              <span className="k-emoji">🏳️</span> <b className="k-num">{collected}</b>
              <span className="mp-mastered__of">/{FLAGS.length} stickers</span>
            </span>
          ) : undefined,
      }}
      playLabel={`Find it · ${rec.title}`}
      playRoute={`/flags/find/${rec.id}`}
      onPlay={() => go(`/flags/find/${rec.id}`)}
      levelSection="levels"
      more={[
        { id: 'extras', title: 'More fun', node: extras },
        { id: 'levels', title: 'Levels', node: levels },
      ]}
    />
  );
}
