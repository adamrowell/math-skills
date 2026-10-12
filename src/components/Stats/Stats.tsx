import { GameStats } from '../../hooks/useGameState';
import './Stats.css';

interface StatsProps {
  stats: GameStats;
  puzzlePiecesCompleted: number;
  puzzlePiecesTotal: number;
  targetPerMinute: number;
}

export function Stats({
  stats,
  puzzlePiecesCompleted,
  puzzlePiecesTotal,
  targetPerMinute,
}: StatsProps) {
  const isOnPace = stats.answersPerMinute >= targetPerMinute;

  return (
    <div className="stats">
      <div className="stats__item stats__item--correct">
        <span className="stats__label">Correct</span>
        <span className="stats__value">{stats.correct}</span>
      </div>

      <div className="stats__item stats__item--progress">
        <span className="stats__label">Progress</span>
        <span className="stats__value">
          {puzzlePiecesCompleted}/{puzzlePiecesTotal}
        </span>
      </div>

      <div className={`stats__item stats__item--pace ${isOnPace ? 'stats__item--on-pace' : ''}`}>
        <span className="stats__label">Per min</span>
        <span className="stats__value">
          {stats.answersPerMinute}
          <span className="stats__target">/{targetPerMinute}</span>
        </span>
      </div>

      <div className="stats__item stats__item--accuracy">
        <span className="stats__label">Accuracy</span>
        <span className="stats__value">{stats.accuracy}%</span>
      </div>
    </div>
  );
}
