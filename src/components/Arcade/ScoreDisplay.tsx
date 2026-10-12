import { useState, useEffect, useRef } from 'react';
import './ScoreDisplay.css';

interface ScoreDisplayProps {
  score: number;
  streak?: number;
  showStreak?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function ScoreDisplay({
  score,
  streak = 0,
  showStreak = true,
  size = 'medium',
}: ScoreDisplayProps) {
  const [displayScore, setDisplayScore] = useState(score);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousScoreRef = useRef(score);

  // Animate score changes
  useEffect(() => {
    if (score !== previousScoreRef.current) {
      setIsAnimating(true);

      // Animate from previous score to new score
      const diff = score - previousScoreRef.current;
      const steps = Math.min(20, Math.abs(diff));
      const increment = diff / steps;
      let current = previousScoreRef.current;
      let step = 0;

      const animate = () => {
        step++;
        current += increment;
        setDisplayScore(Math.round(current));

        if (step < steps) {
          requestAnimationFrame(animate);
        } else {
          setDisplayScore(score);
          previousScoreRef.current = score;
          setTimeout(() => setIsAnimating(false), 200);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [score]);

  const streakMultiplier = streak >= 20 ? 5 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1;

  return (
    <div className={`score-display score-display--${size} ${isAnimating ? 'score-display--animating' : ''}`}>
      <div className="score-display__main">
        <span className="score-display__label">SCORE</span>
        <span className="score-display__value">{displayScore.toLocaleString()}</span>
      </div>
      {showStreak && streak > 1 && (
        <div className={`score-display__streak score-display__streak--${streakMultiplier}x`}>
          <span className="score-display__streak-icon">🔥</span>
          <span className="score-display__streak-value">{streak}</span>
          {streakMultiplier > 1 && (
            <span className="score-display__streak-multiplier">{streakMultiplier}x</span>
          )}
        </div>
      )}
    </div>
  );
}
