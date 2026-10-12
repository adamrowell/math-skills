import { ReactNode } from 'react';
import { ScoreDisplay } from './ScoreDisplay';
import { LivesDisplay } from './LivesDisplay';
import { LevelBadge } from './LevelBadge';
import './ArcadeGameLayout.css';

interface ArcadeGameLayoutProps {
  gameName: string;
  gameEmoji: string;
  score: number;
  lives: number;
  maxLives?: number;
  level: number;
  levelName?: string;
  streak?: number;
  children: ReactNode;
  onBack: () => void;
  onPause?: () => void;
  isPaused?: boolean;
  showScore?: boolean;
  showLives?: boolean;
  showLevel?: boolean;
  headerExtra?: ReactNode;
  footerContent?: ReactNode;
  className?: string;
}

export function ArcadeGameLayout({
  gameName,
  gameEmoji,
  score,
  lives,
  maxLives = 3,
  level,
  levelName,
  streak = 0,
  children,
  onBack,
  onPause,
  isPaused = false,
  showScore = true,
  showLives = true,
  showLevel = true,
  headerExtra,
  footerContent,
  className = '',
}: ArcadeGameLayoutProps) {
  return (
    <div className={`arcade-game-layout ${className}`}>
      {/* Header */}
      <header className="arcade-game-layout__header">
        <div className="arcade-game-layout__header-left">
          <button className="arcade-game-layout__back" onClick={() => onBack()}>
            ← Back
          </button>
          <div className="arcade-game-layout__title">
            <span className="arcade-game-layout__emoji">{gameEmoji}</span>
            <span className="arcade-game-layout__name">{gameName}</span>
          </div>
        </div>

        <div className="arcade-game-layout__header-center">
          {showScore && <ScoreDisplay score={score} streak={streak} />}
        </div>

        <div className="arcade-game-layout__header-right">
          {showLevel && <LevelBadge level={level} name={levelName} />}
          {showLives && <LivesDisplay lives={lives} maxLives={maxLives} />}
          {onPause && (
            <button className="arcade-game-layout__pause" onClick={onPause}>
              {isPaused ? '▶️' : '⏸️'}
            </button>
          )}
          {headerExtra}
        </div>
      </header>

      {/* Main game area */}
      <main className="arcade-game-layout__main">
        {children}
      </main>

      {/* Footer (optional) */}
      {footerContent && (
        <footer className="arcade-game-layout__footer">
          {footerContent}
        </footer>
      )}

      {/* Pause overlay */}
      {isPaused && (
        <div className="arcade-game-layout__pause-overlay">
          <div className="arcade-game-layout__pause-content">
            <h2>⏸️ PAUSED</h2>
            <p>Press Resume to continue</p>
            <button onClick={onPause}>▶️ Resume</button>
          </div>
        </div>
      )}
    </div>
  );
}
