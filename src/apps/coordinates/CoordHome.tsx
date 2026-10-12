import { AppHome, sfx, toast } from '../../core';
import { PictureArt } from './art';
import type { Level, LevelId } from './levels';
import { LEVELS, levelById } from './levels';
import { PICTURES } from './pictures';
import { drawnCount, galleryStore, totalDrawings } from './store';

interface Props {
  onBack: () => void;
  onDraw: (level: Level) => void;
  onGallery: () => void;
}

export function CoordHome({ onBack, onDraw, onGallery }: Props) {
  const g = galleryStore.useStore();
  const level = levelById(g.level) ?? LEVELS[1];
  const drawn = drawnCount(g);
  const totalDone = totalDrawings(g);
  const recent = PICTURES.filter((p) => g.entries[p.id])
    .sort((a, b) => (g.entries[b.id]?.lastAt ?? 0) - (g.entries[a.id]?.lastAt ?? 0))
    .slice(0, 6);

  const pick = (l: Level) => {
    if (totalDone < l.unlockAt) {
      sfx.play('wrong', 0.5);
      toast.show(`Draw ${l.unlockAt - totalDone} more picture${l.unlockAt - totalDone === 1 ? '' : 's'} to unlock ${l.name}!`, { emoji: '🔒' });
      return;
    }
    sfx.play('click');
    galleryStore.update((s) => ({ ...s, level: l.id as LevelId }));
  };

  const levels = (
    <section className="co-levels" aria-label="Level">
      {LEVELS.map((l) => {
        const locked = totalDone < l.unlockAt;
        const on = l.id === level.id;
        return (
          <button
            key={l.id}
            type="button"
            className={`co-level${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
            onClick={() => pick(l)}
            aria-pressed={on}
            data-testid={`level-${l.id}`}
          >
            <span className="k-emoji co-level__emoji">{locked ? '🔒' : l.emoji}</span>
            <span className="co-level__name">{l.name}</span>
            <span className="co-level__blurb">{locked ? `Draw ${l.unlockAt} pictures` : l.blurb}</span>
          </button>
        );
      })}
    </section>
  );

  const gallery = (
    <button type="button" className="co-gallery-strip" onClick={onGallery} data-testid="open-gallery">
      <div className="co-gallery-strip__head">
        <span className="k-emoji">🖼️</span> My pictures{' '}
        <b className="k-num" data-testid="gallery-count">
          {drawn}/{PICTURES.length}
        </b>
        <span className="co-gallery-strip__go">›</span>
      </div>
      <div className="co-gallery-strip__row">
        {recent.length === 0 && <div className="co-gallery-strip__empty">Your drawings will show up here.</div>}
        {recent.map((p) => (
          <PictureArt key={p.id} pic={p} grid={false} className="co-gallery-strip__art" />
        ))}
      </div>
    </button>
  );

  return (
    <AppHome
      appId="coordinates"
      title="Dot Drawing"
      emoji="📍"
      onBack={onBack}
      testId="co-home"
      className="co-home"
      topRight={null}
      hero={{
        levelChip: (
          <>
            <span className="k-emoji">{level.emoji}</span> Mystery picture · {level.name}
          </>
        ),
        subtitle: 'Tap the dots. Make a picture!',
        bestLine:
          drawn > 0 ? (
            <>
              <span className="k-emoji">🖼️</span> {drawn} picture{drawn === 1 ? '' : 's'} drawn
            </>
          ) : undefined,
        below: (
          <div className="co-howto" aria-label="How to play">
            <div className="co-howto__pt k-num">
              (<span className="co-x">3</span>, <span className="co-y">7</span>)
            </div>
            <div className="co-howto__steps">
              <div>
                <span className="co-x">3</span> → go <b>across</b>
              </div>
              <div>
                <span className="co-y">7</span> ↑ go <b>up</b>
              </div>
              <div className="co-howto__tap">Tap the dot!</div>
            </div>
          </div>
        ),
      }}
      playLabel={level.name}
      continueRoute={`/coordinates/play/${level.id}/mystery`}
      onPlay={() => onDraw(level)}
      more={[
        { id: 'levels', title: 'How hard', node: levels },
        { id: 'gallery', title: 'My pictures', node: gallery },
      ]}
      levelSection="levels"
    />
  );
}
