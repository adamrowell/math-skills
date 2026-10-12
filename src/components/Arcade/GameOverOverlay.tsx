import { useEffect } from 'react';
import { audioManager } from '../../utils/audioManager';
import './GameOverOverlay.css';

interface GameOverOverlayProps {
  score: number;
  highScore?: number;
  isNewHighScore?: boolean;
  level: number;
  correctAnswers: number;
  totalAnswers: number;
  onPlayAgain: () => void;
  onBack: () => void;
  title?: string;
  subtitle?: string;
}

export function GameOverOverlay({
  score,
  highScore = 0,
  isNewHighScore = false,
  level,
  correctAnswers,
  totalAnswers,
  onPlayAgain,
  onBack,
  title = 'GAME OVER',
  subtitle,
}: GameOverOverlayProps) {
  const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  // Play game over sound on mount
  useEffect(() => {
    if (isNewHighScore) {
      audioManager.playLevelUp();
    } else {
      audioManager.playGameOver();
    }
  }, [isNewHighScore]);

  return (
    <div className="game-over-overlay">
      <div className="game-over-overlay__content">
        <h1 className="game-over-overlay__title">{title}</h1>
        {subtitle && <p className="game-over-overlay__subtitle">{subtitle}</p>}

        {isNewHighScore && (
          <div className="game-over-overlay__new-record">
            <span className="game-over-overlay__new-record-icon">🏆</span>
            <span className="game-over-overlay__new-record-text">NEW HIGH SCORE!</span>
          </div>
        )}

        <div className="game-over-overlay__stats">
          <div className="game-over-overlay__stat game-over-overlay__stat--score">
            <span className="game-over-overlay__stat-label">Score</span>
            <span className="game-over-overlay__stat-value">{score.toLocaleString()}</span>
          </div>

          {highScore > 0 && !isNewHighScore && (
            <div className="game-over-overlay__stat">
              <span className="game-over-overlay__stat-label">High Score</span>
              <span className="game-over-overlay__stat-value">{highScore.toLocaleString()}</span>
            </div>
          )}

          <div className="game-over-overlay__stat">
            <span className="game-over-overlay__stat-label">Level Reached</span>
            <span className="game-over-overlay__stat-value">{level}</span>
          </div>

          <div className="game-over-overlay__stat">
            <span className="game-over-overlay__stat-label">Correct Answers</span>
            <span className="game-over-overlay__stat-value">
              {correctAnswers}/{totalAnswers}
            </span>
          </div>

          <div className="game-over-overlay__stat">
            <span className="game-over-overlay__stat-label">Accuracy</span>
            <span className={`game-over-overlay__stat-value ${accuracy >= 80 ? 'game-over-overlay__stat-value--good' : ''}`}>
              {accuracy}%
            </span>
          </div>
        </div>

        <div className="game-over-overlay__actions">
          <button
            className="game-over-overlay__button game-over-overlay__button--primary"
            onClick={onPlayAgain}
          >
            🔄 Play Again
          </button>
          <button
            className="game-over-overlay__button game-over-overlay__button--secondary"
            onClick={() => onBack()}
          >
            ← Back to Games
          </button>
        </div>
      </div>
    </div>
  );
}
