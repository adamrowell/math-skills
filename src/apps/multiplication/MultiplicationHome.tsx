import { gridStats, masteryStore } from '../../drill';
import type { RoundFormat } from '../../drill';
import { FactsHome, ProgressStrip } from '../division/FactsHome';
import { multiplicationGenerator, setChip } from './facts';
import './multiplication.css';

interface Props {
  onBack: () => void;
  onPlay: (format: RoundFormat, setId: string) => void;
  onGrid: () => void;
}

function GridStrip({ onOpen }: { onOpen: () => void }) {
  const mastery = masteryStore('multiplication').useStore();
  const g = gridStats(multiplicationGenerator, mastery);
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

export function MultiplicationHome({ onBack, onPlay, onGrid }: Props) {
  return (
    <FactsHome
      generator={multiplicationGenerator}
      title="Times Tables"
      emoji="✖️"
      chip={setChip}
      onBack={onBack}
      onPlay={onPlay}
      primarySets={['all', 'easy', 'hard', 'weak']}
      progressTile={<GridStrip onOpen={onGrid} />}
    />
  );
}
