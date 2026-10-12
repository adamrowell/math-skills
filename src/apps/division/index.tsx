import { useEffect } from 'react';
import { back } from '../../core';
import type { AppProps } from '../../core';
import { DrillScreen, formatById, gridStats, masteryStore, readMastery } from '../../drill';
import type { RoundFormat } from '../../drill';
import { divisionGenerator, setChip } from './facts';
import { FactsHome, ProgressStrip } from './FactsHome';
import { GridScreen } from './GridScreen';

const VALID_SET = (id: string) => divisionGenerator.sets().some((s) => s.id === id);

/** One-time: start the division grid from Times Tables mastery (docs §1.2). */
function seedOnce() {
  const store = masteryStore('division');
  const own = store.get();
  if (own.seededFrom || Object.keys(own.facts).length) return;
  const seeded = divisionGenerator.seedMastery?.(own, (id) => readMastery(id));
  if (seeded && seeded !== own) store.set(seeded);
}

function GridTile({ onOpen }: { onOpen: () => void }) {
  const mastery = masteryStore('division').useStore();
  const g = gridStats(divisionGenerator, mastery);
  return (
    <ProgressStrip
      emoji="🌟"
      text={
        <>
          <span className="k-num">{g.gold}</span>/{g.total} gold · My grid
        </>
      }
      onOpen={onOpen}
      testId="open-grid"
    />
  );
}

/** Routes: '' → home · 'play/<format>/<set>' → round · 'grid' → mastery grid. */
export default function DivisionApp({ segments, navigate }: AppProps) {
  const [view, a, b] = segments;
  const play = (f: RoundFormat, setId: string) => navigate(`/division/play/${f.id}/${setId}`);
  const format = view === 'play' ? formatById(a ?? '') : undefined;
  const setId = b && VALID_SET(b) ? b : 'all';
  const unknown = (view === 'play' && !format) || (view !== undefined && view !== 'play' && view !== 'grid');

  useEffect(seedOnce, []);
  useEffect(() => {
    if (unknown) navigate('/division', { replace: true });
  }, [unknown, navigate]);

  if (view === 'play' && format) {
    return (
      <DrillScreen
        key={`${format.id}/${setId}`}
        generator={divisionGenerator}
        format={format}
        setId={setId}
        title={`${format.title} · ${setChip(setId)}`}
        onExit={() => back('/division')}
      />
    );
  }
  if (view === 'grid') return <GridScreen onBack={() => back('/division')} onPlay={play} />;
  return (
    <FactsHome
      generator={divisionGenerator}
      title="Division"
      emoji="➗"
      chip={setChip}
      onBack={() => back('/')}
      onPlay={play}
      primarySets={['all', 'easy', 'hard', 'weak']}
      progressTile={<GridTile onOpen={() => navigate('/division/grid')} />}
    />
  );
}
