import { AppHome, BigButton, sfx } from '../../../core';
import type { FamilyId, LogicMode } from '../engine/types';
import { MODE_EMOJI, MODE_LABEL, progressStore, setMode } from '../progress';
import { uiStore } from '../uiStore';
import { BrainMapGrid } from './BrainMap';

interface Props {
  onBack: () => void;
  onPlay: (mode: LogicMode) => void;
  onFamily: (f: FamilyId) => void;
  onMap: () => void;
  onGallery: () => void;
}

const MODES: Array<{ id: LogicMode; sub: string }> = [
  { id: 'adaptive', sub: 'Gets harder as you get better' },
  { id: 'easy', sub: 'Warm up' },
  { id: 'medium', sub: 'Think hard' },
  { id: 'hard', sub: 'Big brain' },
];

export function LogicHome({ onBack, onPlay, onFamily, onMap, onGallery }: Props) {
  const progress = progressStore.useStore();
  const galleryLevel = uiStore.useStore((u) => u.galleryLevel);
  const mode = progress.mode;
  const best = progress.best[mode];

  const modes = (
    <div className="lg-modes" role="radiogroup" aria-label="Level">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={mode === m.id}
          className={`lg-mode${mode === m.id ? ' is-on' : ''}`}
          data-testid={`mode-${m.id}`}
          onClick={() => {
            sfx.play('click');
            setMode(m.id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="k-emoji lg-mode__emoji">{MODE_EMOJI[m.id]}</span>
          <span className="lg-mode__t">{MODE_LABEL[m.id]}</span>
          <span className="lg-mode__s">{m.sub}</span>
        </button>
      ))}
    </div>
  );

  const brain = (
    <div className="lg-home-map">
      <BrainMapGrid onPick={onFamily} compact />
      <BigButton size="md" variant="ghost" onClick={onMap} data-testid="open-map">
        <span className="k-emoji">🗺️</span> Open the Brain Map
      </BigButton>
    </div>
  );

  const gallery = (
    <div className="lg-gallery-pick">
      <p className="lg-gallery-pick__t">One of every kind of puzzle — just for fun, no points.</p>
      <div className="lg-gallery-pick__row">
        {([1, 2, 3] as const).map((d) => (
          <button
            key={d}
            type="button"
            className={`lg-mode lg-mode--mini${galleryLevel === d ? ' is-on' : ''}`}
            aria-pressed={galleryLevel === d}
            onClick={() => uiStore.update((u) => ({ ...u, galleryLevel: d }))}
          >
            {d === 1 ? '🌱 Easy' : d === 2 ? '🌟 Medium' : '🔥 Hard'}
          </button>
        ))}
      </div>
      <BigButton size="md" onClick={onGallery} data-testid="open-gallery">
        <span className="k-emoji">👀</span> Show me one of each
      </BigButton>
    </div>
  );

  return (
    <AppHome
      appId="logic"
      title="Brain Puzzles"
      emoji="🧠"
      onBack={onBack}
      className="lg-home"
      topRight={null}
      hero={{
        levelChip: (
          <>
            <span className="k-emoji">{MODE_EMOJI[mode]}</span> {MODE_LABEL[mode]} · 10 puzzles
          </>
        ),
        subtitle: 'Patterns, puzzles, brain teasers!',
        bestLine: best ? <>🏅 Best {best}/10 first try</> : undefined,
      }}
      playLabel={`Brain Puzzles · ${MODE_LABEL[mode]}`}
      playRoute={`/logic/play/${mode}`}
      onPlay={() => onPlay(mode)}
      more={[
        { id: 'modes', title: 'Level', node: modes },
        { id: 'brain', title: 'Brain map', node: brain },
        { id: 'gallery', title: 'Peek at every puzzle', node: gallery },
      ]}
      levelSection="modes"
    />
  );
}
