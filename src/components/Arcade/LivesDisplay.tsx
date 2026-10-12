import { useState, useEffect } from 'react';
import './LivesDisplay.css';

interface LivesDisplayProps {
  lives: number;
  maxLives?: number;
  icon?: string;
  size?: 'small' | 'medium' | 'large';
}

export function LivesDisplay({
  lives,
  maxLives = 3,
  icon = '❤️',
  size = 'medium',
}: LivesDisplayProps) {
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);

  // Animate when a life is lost
  useEffect(() => {
    if (lives < maxLives) {
      setAnimatingIndex(lives);
      const timer = setTimeout(() => setAnimatingIndex(null), 500);
      return () => clearTimeout(timer);
    }
  }, [lives, maxLives]);

  return (
    <div className={`lives-display lives-display--${size}`}>
      <div className="lives-display__hearts">
        {Array.from({ length: maxLives }, (_, i) => (
          <span
            key={i}
            className={`lives-display__heart ${
              i < lives ? 'lives-display__heart--active' : 'lives-display__heart--lost'
            } ${animatingIndex === i ? 'lives-display__heart--animating' : ''}`}
          >
            {i < lives ? icon : '🖤'}
          </span>
        ))}
      </div>
      {lives <= 1 && lives > 0 && (
        <span className="lives-display__warning">Last life!</span>
      )}
    </div>
  );
}
