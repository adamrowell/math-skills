import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { GameStats } from '../../hooks/useGameState';
import { LevelConfig } from '../../config/gameConfig';
import './WinScreen.css';

interface WinScreenProps {
  stats: GameStats;
  level: LevelConfig;
  timeRemaining: number;
  isWin: boolean;
  onPlayAgain: () => void;
  onChangeLevel: () => void;
}

export function WinScreen({
  stats,
  level,
  timeRemaining,
  isWin,
  onPlayAgain,
  onChangeLevel,
}: WinScreenProps) {
  // Trigger confetti on win
  useEffect(() => {
    if (isWin) {
      const duration = 3000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) =>
        Math.random() * (max - min) + min;

      const confettiInterval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(confettiInterval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          particleCount,
          startVelocity: 30,
          spread: 360,
          origin: {
            x: randomInRange(0.1, 0.9),
            y: Math.random() - 0.2,
          },
          colors: ['#667eea', '#764ba2', '#4CAF50', '#FF9800', '#E91E63'],
        });
      }, 250);

      return () => clearInterval(confettiInterval);
    }
  }, [isWin]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeUsed = Math.floor((600 - timeRemaining) / 60); // Assuming 10 min total

  return (
    <div className={`win-screen ${isWin ? 'win-screen--win' : 'win-screen--lose'}`}>
      <div className="win-screen__content">
        <div className="win-screen__header">
          {isWin ? (
            <>
              <span className="win-screen__emoji">🎉</span>
              <h1 className="win-screen__title">You Did It!</h1>
              <span className="win-screen__emoji">🎉</span>
            </>
          ) : (
            <>
              <span className="win-screen__emoji">⏰</span>
              <h1 className="win-screen__title">Time's Up!</h1>
              <span className="win-screen__emoji">⏰</span>
            </>
          )}
        </div>

        <p className="win-screen__subtitle">
          {isWin
            ? `Amazing work on ${level.name} level!`
            : `Great effort on ${level.name} level! Try again?`}
        </p>

        <div className="win-screen__stats">
          <div className="win-screen__stat">
            <span className="win-screen__stat-icon">✓</span>
            <span className="win-screen__stat-value">{stats.correct}</span>
            <span className="win-screen__stat-label">Correct</span>
          </div>

          <div className="win-screen__stat">
            <span className="win-screen__stat-icon">📊</span>
            <span className="win-screen__stat-value">{stats.accuracy}%</span>
            <span className="win-screen__stat-label">Accuracy</span>
          </div>

          <div className="win-screen__stat">
            <span className="win-screen__stat-icon">⚡</span>
            <span className="win-screen__stat-value">{stats.answersPerMinute}</span>
            <span className="win-screen__stat-label">Per Minute</span>
          </div>

          {isWin && (
            <div className="win-screen__stat">
              <span className="win-screen__stat-icon">⏱️</span>
              <span className="win-screen__stat-value">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
              <span className="win-screen__stat-label">Time Left</span>
            </div>
          )}

          <div className="win-screen__stat">
            <span className="win-screen__stat-icon">🧮</span>
            <span className="win-screen__stat-value">{stats.total}</span>
            <span className="win-screen__stat-label">Total Problems</span>
          </div>

          <div className="win-screen__stat">
            <span className="win-screen__stat-icon">⌛</span>
            <span className="win-screen__stat-value">{timeUsed}+ min</span>
            <span className="win-screen__stat-label">Time Played</span>
          </div>
        </div>

        {isWin && stats.accuracy === 100 && (
          <div className="win-screen__badge">
            <span className="win-screen__badge-emoji">🌟</span>
            <span className="win-screen__badge-text">Perfect Score!</span>
            <span className="win-screen__badge-emoji">🌟</span>
          </div>
        )}

        {isWin && stats.answersPerMinute >= level.targetCorrectPerMinute * 1.5 && (
          <div className="win-screen__badge win-screen__badge--speed">
            <span className="win-screen__badge-emoji">🚀</span>
            <span className="win-screen__badge-text">Speed Demon!</span>
            <span className="win-screen__badge-emoji">🚀</span>
          </div>
        )}

        <div className="win-screen__actions">
          <button className="win-screen__button win-screen__button--primary" onClick={onPlayAgain}>
            Play Again
          </button>
          <button
            className="win-screen__button win-screen__button--secondary"
            onClick={onChangeLevel}
          >
            Change Level
          </button>
        </div>
      </div>
    </div>
  );
}
