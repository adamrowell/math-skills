import { AppHome, beginPlay, sfx } from '../../core';
import { masteryStore } from '../../drill';
import type { Mode } from './logic';
import { UNLOCK_STARS } from './logic';
import { isNameUnlocked, isStageUnlocked, progressStore, recommendedStage, starsOf } from './progress';
import { primeSpeech } from './speech';
import { PACKS, masteryId, packOf, stagesOf } from './stages';
import type { PackId } from './types';

interface Props {
  onBack: () => void;
  onPlay: (mode: Mode, stageId: string) => void;
  onExplore: (stageId: string) => void;
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

const NOUN: Record<PackId, string> = { us: 'states', world: 'places', countries: 'countries' };

export function MapsHome({ onBack, onPlay, onExplore }: Props) {
  const progress = progressStore.useStore();
  const mastery = masteryStore('maps').useStore();
  const packId = progress.pack;
  const pack = packOf(packId);
  const stages = stagesOf(packId);
  const rec = recommendedStage(progress, packId);
  const recStars = starsOf(progress, 'find', rec.id);

  const allTargets = [...new Set(stages.flatMap((s) => s.targets))];
  const mastered = allTargets.filter((id) => (mastery.facts[masteryId(pack.map, id)]?.box ?? 0) >= 4).length;

  const setPack = (id: PackId) => {
    sfx.play('click');
    progressStore.update((p) => ({ ...p, pack: id }));
  };
  const play = (mode: Mode, stageId: string) => {
    sfx.unlock();
    primeSpeech();
    onPlay(mode, stageId);
  };

  // Stage buttons play right away (like format cards), with the PLAY-gesture sequence.
  const playNow = (mode: Mode, stageId: string, title: string) => {
    beginPlay({ app: 'maps', label: `${mode === 'find' ? 'Find it' : 'Name it'} · ${title}`, route: `/maps/${mode}/${stageId}` });
    play(mode, stageId);
  };

  const packs = (
    <div className="mp-packs" role="tablist" aria-label="Maps">
      {PACKS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={p.id === packId}
          className={`mp-pack${p.id === packId ? ' is-on' : ''}`}
          onClick={() => setPack(p.id)}
          data-testid={`pack-${p.id}`}
        >
          <span className="k-emoji mp-pack__emoji">{p.emoji}</span>
          <span>{p.title}</span>
        </button>
      ))}
    </div>
  );

  const levels = (
    <ol className="mp-levels">
      {stages.map((s, i) => {
        const open = isStageUnlocked(progress, s);
        const fs = starsOf(progress, 'find', s.id);
        const nameOpen = isNameUnlocked(progress, s);
        const ns = starsOf(progress, 'name', s.id);
        const prev = stages[i - 1];
        return (
          <li key={s.id} className={`mp-level${open ? '' : ' is-locked'}`} data-testid={`stage-${s.id}`} data-locked={open ? undefined : '1'}>
            <div className="mp-level__head">
              <span className="k-emoji mp-level__emoji">{open ? s.emoji : '🔒'}</span>
              <div className="mp-level__info">
                <div className="mp-level__title">{s.title}</div>
                <div className="mp-level__meta">
                  {open ? (
                    <>
                      {s.targets.length} {NOUN[packId]} <Stars n={fs} testId={`stars-${s.id}`} />
                    </>
                  ) : (
                    <>
                      Get <span className="mp-star is-on">★★</span> on {prev?.title}
                    </>
                  )}
                </div>
              </div>
            </div>
            {open && (
              <div className="mp-level__btns">
                <button type="button" className="mp-mode mp-mode--find" onClick={() => playNow('find', s.id, s.title)} data-testid={`find-${s.id}`}>
                  <span className="k-emoji">👆</span> Find it
                </button>
                <button
                  type="button"
                  className={`mp-mode mp-mode--name${nameOpen ? '' : ' is-locked'}`}
                  onClick={() => nameOpen && playNow('name', s.id, s.title)}
                  aria-disabled={!nameOpen}
                  data-testid={`name-${s.id}`}
                  title={nameOpen ? undefined : `Get ${UNLOCK_STARS} stars in Find it`}
                >
                  {nameOpen ? (
                    <>
                      <span className="k-emoji">🏷️</span> Name it {ns > 0 && <Stars n={ns} />}
                    </>
                  ) : (
                    <>
                      <span className="k-emoji">🔒</span> Name it
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

  return (
    <AppHome
      appId="maps"
      title="Maps"
      emoji="🗺️"
      onBack={onBack}
      testId="maps-home"
      className="mp-screen mp-home"
      topRight={null}
      hero={{
        levelChip: (
          <>
            <span className="k-emoji">{pack.emoji}</span> {rec.title} <Stars n={recStars} />
          </>
        ),
        subtitle: packId === 'world' ? 'Find the land and the water!' : `Find the ${NOUN[packId]} on the map!`,
        bestLine:
          mastered > 0 ? (
            <span className="mp-mastered" data-testid="mastered">
              <span className="k-emoji">{packId === 'world' ? '🌊' : '🌟'}</span> <b className="k-num">{mastered}</b>
              <span className="mp-mastered__of">
                /{allTargets.length} {NOUN[packId]} learned
              </span>
            </span>
          ) : undefined,
      }}
      playLabel={`Find it · ${rec.title}`}
      playRoute={`/maps/find/${rec.id}`}
      onPlay={() => play('find', rec.id)}
      levelSection="stages"
      more={[
        { id: 'packs', title: 'Which map', node: packs },
        {
          id: 'explore',
          title: 'Just look',
          node: (
            <button type="button" className="mp-explore-btn" onClick={() => onExplore(pack.exploreStage)} data-testid="explore">
              <span className="k-emoji">👀</span> Explore the map
            </button>
          ),
        },
        { id: 'stages', title: 'Levels', node: levels },
      ]}
    />
  );
}
