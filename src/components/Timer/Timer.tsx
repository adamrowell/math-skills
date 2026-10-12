import { config } from '../../config/gameConfig';
import './Timer.css';

interface TimerProps {
  timeRemaining: number;
}

export function Timer({ timeRemaining }: TimerProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isWarning = timeRemaining <= config.warningThreshold;
  const isCritical = timeRemaining <= 30;

  return (
    <div
      className={`timer ${isWarning ? 'timer--warning' : ''} ${isCritical ? 'timer--critical' : ''}`}
    >
      <span className="timer__icon">⏱️</span>
      <span className="timer__time">
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
