import './ReadingControls.css';

interface ReadingControlsProps {
  onHearWord: () => void;
  onSkip: () => void;
  disabled?: boolean;
  isSkipping?: boolean;
  showingHint?: boolean;
  wrongAttempts?: number;
}

export function ReadingControls({
  onHearWord,
  onSkip,
  disabled = false,
  isSkipping = false,
  showingHint = false,
  wrongAttempts = 0,
}: ReadingControlsProps) {
  // Show pulsing hint after 2+ wrong attempts
  const shouldPulse = wrongAttempts >= 2 && !showingHint && !isSkipping;

  return (
    <div className="reading-controls">
      <button
        className={`reading-controls__button reading-controls__button--hear ${
          showingHint ? 'reading-controls__button--active' : ''
        } ${shouldPulse ? 'reading-controls__button--pulse-hint' : ''}`}
        onClick={onHearWord}
        disabled={disabled || isSkipping}
        title="Hear the word pronounced"
      >
        <span className="reading-controls__icon">🔊</span>
        <span className="reading-controls__label">Hear Word</span>
        {shouldPulse && <span className="reading-controls__hint-badge">Try me!</span>}
      </button>

      <button
        className={`reading-controls__button reading-controls__button--skip ${
          isSkipping ? 'reading-controls__button--skipping' : ''
        }`}
        onClick={onSkip}
        disabled={disabled || isSkipping}
        title="Skip this word (it will be read to you)"
      >
        <span className="reading-controls__icon">⏭️</span>
        <span className="reading-controls__label">
          {isSkipping ? 'Learning...' : 'Skip'}
        </span>
      </button>

      <div className="reading-controls__tip">
        <span className="reading-controls__tip-icon">💡</span>
        <span className="reading-controls__tip-text">
          Say the word out loud when you're ready!
        </span>
      </div>
    </div>
  );
}
