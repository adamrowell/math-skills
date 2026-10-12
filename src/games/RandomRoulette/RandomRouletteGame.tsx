import { useState, useEffect, useCallback } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './RandomRouletteGame.css';

interface RandomRouletteGameProps {
  onBack: () => void;
}

export function RandomRouletteGame({ onBack }: RandomRouletteGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [currentNumber, setCurrentNumber] = useState(50);
  const [nextNumber, setNextNumber] = useState(50);
  const [isRevealing, setIsRevealing] = useState(false);
  const [rangeMin, setRangeMin] = useState(1);
  const [rangeMax, setRangeMax] = useState(100);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('randomRoulette_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const generateNumber = useCallback(() => {
    const min = rangeMin;
    const max = rangeMax;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }, [rangeMin, rangeMax]);

  const startRound = useCallback(() => {
    setCurrentNumber(generateNumber());
    setNextNumber(generateNumber());
    setIsRevealing(false);
  }, [generateNumber]);

  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setRangeMin(1);
    setRangeMax(100);
    setGameStatus('playing');
  }, []);

  useEffect(() => {
    if (gameStatus === 'playing' && currentNumber === 50 && nextNumber === 50) {
      startRound();
    }
  }, [gameStatus, currentNumber, nextNumber, startRound]);

  useEffect(() => {
    const newMax = Math.min(100 + level * 50, 1000);
    setRangeMax(newMax);
  }, [level]);

  const handleGuess = useCallback((guess: 'higher' | 'lower') => {
    setIsRevealing(true);
    setTotalAnswers(ta => ta + 1);

    setTimeout(() => {
      const isCorrect = (guess === 'higher' && nextNumber > currentNumber) ||
                       (guess === 'lower' && nextNumber < currentNumber) ||
                       nextNumber === currentNumber;

      if (isCorrect) {
        audioManager.playCorrect();
        setCorrectAnswers(ca => ca + 1);
        setStreak(s => s + 1);

        const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
        const points = (100 + level * 25) * streakMultiplier;
        setScore(s => s + points);

        if ((correctAnswers + 1) % 5 === 0) {
          setLevel(l => l + 1);
          audioManager.playLevelUp();
        }

        setTimeout(() => {
          setCurrentNumber(nextNumber);
          setNextNumber(generateNumber());
          setIsRevealing(false);
        }, 1000);
      } else {
        audioManager.playWrong();
        setStreak(0);
        setLives(l => {
          const newLives = l - 1;
          if (newLives <= 0) {
            setGameStatus('gameover');
          } else {
            setTimeout(startRound, 1000);
          }
          return newLives;
        });
      }
    }, 500);
  }, [currentNumber, nextNumber, streak, correctAnswers, level, generateNumber, startRound]);

  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('randomRoulette_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Random Roulette"
        gameEmoji="🎰"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="random-roulette__start">
          <h1 className="random-roulette__title">🎰 Random Roulette</h1>
          <p className="random-roulette__description">
            Will the next number be higher or lower?<br />
            Use your intuition and probability skills!
          </p>

          <div className="random-roulette__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Look at the current number</li>
              <li>Guess if the next number will be higher or lower</li>
              <li>Build your streak for bonus points!</li>
              <li>Number range increases as you level up</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="random-roulette__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="random-roulette__start-button" onClick={startGame}>
            🎰 Start Guessing!
          </button>
        </div>
      </ArcadeGameLayout>
    );
  }

  if (gameStatus === 'gameover') {
    return (
      <GameOverOverlay
        score={score}
        highScore={highScore}
        isNewHighScore={score > highScore}
        level={level}
        correctAnswers={correctAnswers}
        totalAnswers={totalAnswers}
        onPlayAgain={startGame}
        onBack={onBack}
      />
    );
  }

  return (
    <ArcadeGameLayout
      gameName="Random Roulette"
      gameEmoji="🎰"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="random-roulette">
        <div className="random-roulette__range">
          Range: {rangeMin} - {rangeMax}
        </div>

        <div className="random-roulette__cards">
          <div className="random-roulette__card random-roulette__card--current">
            <div className="random-roulette__label">Current</div>
            <div className="random-roulette__number">{currentNumber}</div>
          </div>

          <div className="random-roulette__vs">VS</div>

          <div className={`random-roulette__card random-roulette__card--next ${isRevealing ? 'random-roulette__card--reveal' : ''}`}>
            <div className="random-roulette__label">Next</div>
            <div className="random-roulette__number">
              {isRevealing ? nextNumber : '?'}
            </div>
          </div>
        </div>

        <div className="random-roulette__buttons">
          <button
            className="random-roulette__button random-roulette__button--lower"
            onClick={() => handleGuess('lower')}
            disabled={isRevealing}
          >
            ⬇️ Lower
          </button>
          <button
            className="random-roulette__button random-roulette__button--higher"
            onClick={() => handleGuess('higher')}
            disabled={isRevealing}
          >
            ⬆️ Higher
          </button>
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
