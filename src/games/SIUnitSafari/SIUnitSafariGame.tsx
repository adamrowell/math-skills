import { useState, useEffect, useCallback } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './SIUnitSafariGame.css';

interface SIUnitSafariGameProps {
  onBack: () => void;
}

const CONVERSIONS = [
  { from: 1000, fromUnit: 'meters', toUnit: 'kilometers', answer: 1, category: 'length' },
  { from: 100, fromUnit: 'centimeters', toUnit: 'meters', answer: 1, category: 'length' },
  { from: 1000, fromUnit: 'millimeters', toUnit: 'meters', answer: 1, category: 'length' },
  { from: 1000, fromUnit: 'grams', toUnit: 'kilograms', answer: 1, category: 'mass' },
  { from: 1000, fromUnit: 'milligrams', toUnit: 'grams', answer: 1, category: 'mass' },
  { from: 1000, fromUnit: 'milliliters', toUnit: 'liters', answer: 1, category: 'volume' },
  { from: 100, fromUnit: 'centiliters', toUnit: 'liters', answer: 1, category: 'volume' },
  { from: 60, fromUnit: 'seconds', toUnit: 'minutes', answer: 1, category: 'time' },
  { from: 60, fromUnit: 'minutes', toUnit: 'hours', answer: 1, category: 'time' },
  { from: 1000, fromUnit: 'watts', toUnit: 'kilowatts', answer: 1, category: 'power' },
];

export function SIUnitSafariGame({ onBack }: SIUnitSafariGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [problem, setProblem] = useState({ value: 0, fromUnit: '', toUnit: '', answer: 0, category: '' });
  const [userInput, setUserInput] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(15);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('siUnitSafari_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const generateProblem = useCallback(() => {
    const template = CONVERSIONS[Math.floor(Math.random() * CONVERSIONS.length)];
    const multiplier = Math.floor(Math.random() * 10) + 1;
    const value = template.from * multiplier;
    const answer = template.answer * multiplier;

    setProblem({
      value,
      fromUnit: template.fromUnit,
      toUnit: template.toUnit,
      answer,
      category: template.category,
    });
    setUserInput('');
    setTimeRemaining(15);
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setGameStatus('playing');
  }, []);

  useEffect(() => {
    if (gameStatus === 'playing' && problem.answer === 0) {
      generateProblem();
    }
  }, [gameStatus, problem.answer, generateProblem]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          audioManager.playWrong();
          setStreak(0);
          setTotalAnswers(ta => ta + 1);
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              setGameStatus('gameover');
            } else {
              generateProblem();
            }
            return newLives;
          });
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, generateProblem]);

  const submitAnswer = useCallback(() => {
    const userAnswer = parseFloat(userInput);
    setTotalAnswers(ta => ta + 1);

    if (Math.abs(userAnswer - problem.answer) < 0.01) {
      audioManager.playCorrect();
      setCorrectAnswers(ca => ca + 1);
      setStreak(s => s + 1);

      const timeBonus = timeRemaining * 10;
      const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      const points = (100 + timeBonus + level * 20) * streakMultiplier;
      setScore(s => s + points);

      if ((correctAnswers + 1) % 5 === 0) {
        setLevel(l => l + 1);
        audioManager.playLevelUp();
      }

      generateProblem();
    } else {
      audioManager.playWrong();
      setStreak(0);
      setLives(l => {
        const newLives = l - 1;
        if (newLives <= 0) {
          setGameStatus('gameover');
        } else {
          generateProblem();
        }
        return newLives;
      });
    }
  }, [userInput, problem.answer, timeRemaining, streak, correctAnswers, level, generateProblem]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userInput.length > 0) {
      submitAnswer();
    }
  };

  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('siUnitSafari_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      length: '📏',
      mass: '⚖️',
      volume: '🧪',
      time: '⏰',
      power: '⚡',
    };
    return emojis[category] || '📊';
  };

  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout gameName="SI Unit Safari" gameEmoji="📏" score={0} lives={3} level={1} streak={0} onBack={onBack} showScore={false} showLives={false} showLevel={false}>
        <div className="si-unit__start">
          <h1 className="si-unit__title">📏 SI Unit Safari</h1>
          <p className="si-unit__description">Master metric conversions!<br />Convert between units like a scientist.</p>
          <div className="si-unit__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Convert between metric units</li>
              <li>Type your answer in the target unit</li>
              <li>Remember: kilo = 1000, centi = 1/100, milli = 1/1000</li>
              <li>Faster answers earn bonus points!</li>
            </ul>
          </div>
          {highScore > 0 && <div className="si-unit__high-score">High Score: {highScore.toLocaleString()}</div>}
          <button className="si-unit__start-button" onClick={startGame}>📏 Start Converting!</button>
        </div>
      </ArcadeGameLayout>
    );
  }

  if (gameStatus === 'gameover') {
    return <GameOverOverlay score={score} highScore={highScore} isNewHighScore={score > highScore} level={level} correctAnswers={correctAnswers} totalAnswers={totalAnswers} onPlayAgain={startGame} onBack={onBack} />;
  }

  return (
    <ArcadeGameLayout gameName="SI Unit Safari" gameEmoji="📏" score={score} lives={lives} level={level} streak={streak} onBack={onBack} onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')} isPaused={gameStatus === 'paused'}>
      <div className="si-unit">
        <div className="si-unit__timer" style={{ color: timeRemaining <= 5 ? '#ff4444' : '#fff' }}>
          ⏱️ {timeRemaining}s
        </div>

        <div className="si-unit__category">
          {getCategoryEmoji(problem.category)} {problem.category.toUpperCase()}
        </div>

        <div className="si-unit__conversion">
          <div className="si-unit__from">
            <div className="si-unit__value">{problem.value.toLocaleString()}</div>
            <div className="si-unit__unit">{problem.fromUnit}</div>
          </div>

          <div className="si-unit__arrow">→</div>

          <div className="si-unit__to">
            <div className="si-unit__question">?</div>
            <div className="si-unit__unit">{problem.toUnit}</div>
          </div>
        </div>

        <div className="si-unit__input-area">
          <input
            type="number"
            step="any"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="si-unit__input"
            placeholder="Your answer..."
            autoFocus
          />
          <button className="si-unit__submit" onClick={submitAnswer} disabled={userInput.length === 0}>
            ✓ Submit
          </button>
        </div>

        <div className="si-unit__reference">
          💡 kilo = ×1000 | centi = ÷100 | milli = ÷1000
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
