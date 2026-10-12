import { memo } from 'react';
import { Timer } from '../Timer/Timer';
import './GameHeader.css';

interface GameHeaderProps {
  gameName: string;
  gameEmoji?: string;
  levelName?: string;
  levelEmoji?: string;
  levelColor?: string;
  timeRemaining?: number;
  showTimer?: boolean;
  onBack: () => void;
  onPause?: () => void;
  onFullscreen?: () => void;
  isPaused?: boolean;
  isFullscreen?: boolean;
  // Voice indicator
  showVoice?: boolean;
  isListening?: boolean;
  voiceSuccess?: boolean;
  transcript?: string;
  // Stats to show in header
  stats?: {
    correct?: number;
    progress?: string;
    streak?: number;
    accuracy?: number;
  };
  children?: React.ReactNode;
}

export const GameHeader = memo(function GameHeader({
  gameName,
  gameEmoji,
  levelName,
  levelEmoji,
  levelColor,
  timeRemaining,
  showTimer = true,
  onBack,
  onPause,
  onFullscreen,
  isPaused = false,
  isFullscreen = false,
  showVoice = false,
  isListening = false,
  voiceSuccess = false,
  transcript,
  stats,
  children,
}: GameHeaderProps) {
  return (
    <header className="game-header-shared">
      <div className="game-header-shared__left">
        <button className="game-header-shared__back-btn" onClick={() => onBack()}>
          <span className="game-header-shared__back-arrow">←</span>
          <span className="game-header-shared__back-text">Back</span>
        </button>

        <div className="game-header-shared__title">
          {gameEmoji && <span className="game-header-shared__game-emoji">{gameEmoji}</span>}
          <span className="game-header-shared__game-name">{gameName}</span>
        </div>

        {levelName && (
          <span
            className="game-header-shared__level-badge"
            style={levelColor ? { backgroundColor: levelColor } : undefined}
          >
            {levelEmoji && <span className="game-header-shared__level-emoji">{levelEmoji}</span>}
            <span className="game-header-shared__level-name">{levelName}</span>
          </span>
        )}
      </div>

      <div className="game-header-shared__center">
        {/* Stats in center if provided */}
        {stats && (
          <div className="game-header-shared__stats">
            {stats.correct !== undefined && (
              <div className="game-header-shared__stat">
                <span className="game-header-shared__stat-value">{stats.correct}</span>
                <span className="game-header-shared__stat-label">Correct</span>
              </div>
            )}
            {stats.progress && (
              <div className="game-header-shared__stat">
                <span className="game-header-shared__stat-value">{stats.progress}</span>
                <span className="game-header-shared__stat-label">Progress</span>
              </div>
            )}
            {stats.streak !== undefined && (
              <div className="game-header-shared__stat">
                <span className="game-header-shared__stat-value">{stats.streak}</span>
                <span className="game-header-shared__stat-label">Streak</span>
              </div>
            )}
            {stats.accuracy !== undefined && (
              <div className="game-header-shared__stat">
                <span className="game-header-shared__stat-value">{stats.accuracy}%</span>
                <span className="game-header-shared__stat-label">Accuracy</span>
              </div>
            )}
          </div>
        )}
        {children}
      </div>

      <div className="game-header-shared__right">
        {/* Voice indicator */}
        {showVoice && (
          <div className={`game-header-shared__voice ${isListening ? 'game-header-shared__voice--active' : ''} ${voiceSuccess ? 'game-header-shared__voice--success' : ''}`}>
            <span className="game-header-shared__voice-icon">🎤</span>
            {transcript && <span className="game-header-shared__voice-text">{transcript}</span>}
          </div>
        )}

        {/* Timer */}
        {showTimer && timeRemaining !== undefined && (
          <Timer timeRemaining={timeRemaining} />
        )}

        {/* Fullscreen button */}
        {onFullscreen && (
          <button className="game-header-shared__icon-btn" onClick={onFullscreen} title="Toggle fullscreen">
            {isFullscreen ? '\u26F6' : '\u26F6'}
          </button>
        )}

        {/* Pause button */}
        {onPause && (
          <button
            className={`game-header-shared__pause-btn ${isPaused ? 'game-header-shared__pause-btn--paused' : ''}`}
            onClick={onPause}
          >
            {isPaused ? '▶' : '⏸'}
          </button>
        )}
      </div>
    </header>
  );
});

export default GameHeader;
