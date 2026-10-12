import { useState, useEffect, useCallback } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './ProbabilityPlaygroundGame.css';

interface ProbabilityPlaygroundGameProps {
  onBack: () => void;
}

type GameMode = 'coin' | 'dice' | 'cards';

export function ProbabilityPlaygroundGame({ onBack }: ProbabilityPlaygroundGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [mode, setMode] = useState<GameMode>('coin');
  const [question, setQuestion] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(20);

  // Stats
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('probabilityPlayground_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Generate problem
  const generateProblem = useCallback(() => {
    const modes: GameMode[] = level >= 3 ? ['coin', 'dice', 'cards'] : level >= 2 ? ['coin', 'dice'] : ['coin'];
    const selectedMode = modes[Math.floor(Math.random() * modes.length)];
    setMode(selectedMode);

    let q = '';
    let answer = '';
    let opts: string[] = [];

    if (selectedMode === 'coin') {
      const flips = Math.min(2 + Math.floor(level / 2), 5);
      const heads = Math.floor(Math.random() * (flips + 1));
      q = `Flip ${flips} coin${flips > 1 ? 's' : ''}. What's P(exactly ${heads} heads)?`;

      // Calculate binomial probability
      const combinations = (n: number, k: number) => {
        if (k === 0 || k === n) return 1;
        let result = 1;
        for (let i = 0; i < k; i++) {
          result *= (n - i) / (i + 1);
        }
        return Math.round(result);
      };

      const numerator = combinations(flips, heads);
      const denominator = Math.pow(2, flips);
      answer = `${numerator}/${denominator}`;

      // Generate wrong answers
      opts = [answer];
      while (opts.length < 4) {
        const wrongNum = Math.max(1, numerator + Math.floor(Math.random() * 3) - 1);
        const wrongAns = `${wrongNum}/${denominator}`;
        if (!opts.includes(wrongAns)) opts.push(wrongAns);
      }
    } else if (selectedMode === 'dice') {
      const targetSum = 2 + Math.floor(Math.random() * 10);
      q = `Roll 2 dice. What's P(sum = ${targetSum})?`;

      // Count combinations
      let count = 0;
      for (let i = 1; i <= 6; i++) {
        for (let j = 1; j <= 6; j++) {
          if (i + j === targetSum) count++;
        }
      }

      answer = `${count}/36`;
      opts = [answer];
      while (opts.length < 4) {
        const wrongCount = Math.max(0, Math.min(36, count + Math.floor(Math.random() * 5) - 2));
        const wrongAns = `${wrongCount}/36`;
        if (!opts.includes(wrongAns) && wrongCount > 0) opts.push(wrongAns);
      }
    } else { // cards
      const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
      const suit = suits[Math.floor(Math.random() * suits.length)];
      q = `Draw 1 card from a deck. What's P(${suit})?`;
      answer = '13/52';
      opts = ['13/52', '1/4', '12/52', '14/52'];
    }

    setQuestion(q);
    setCorrectAnswer(answer);
    setOptions(opts.sort(() => Math.random() - 0.5));
    setTimeRemaining(20);
  }, [level]);

  // Start game
  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setGameStatus('playing');
  }, []);

  // Initialize first round
  useEffect(() => {
    if (gameStatus === 'playing' && question === '') {
      generateProblem();
    }
  }, [gameStatus, question, generateProblem]);

  // Timer
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
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, generateProblem]);

  // Handle answer
  const handleAnswer = useCallback((answer: string) => {
    setTotalAnswers(ta => ta + 1);

    if (answer === correctAnswer) {
      audioManager.playCorrect();
      setCorrectAnswers(ca => ca + 1);
      setStreak(s => s + 1);

      const timeBonus = timeRemaining * 10;
      const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      const points = (150 + timeBonus + level * 25) * streakMultiplier;
      setScore(s => s + points);

      if ((correctAnswers + 1) % 4 === 0) {
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
  }, [correctAnswer, timeRemaining, streak, correctAnswers, level, generateProblem]);

  // Save high score
  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('probabilityPlayground_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  // Render start screen
  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Probability Playground"
        gameEmoji="🎲"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="probability__start">
          <h1 className="probability__title">🎲 Probability Playground</h1>
          <p className="probability__description">
            Master chance and odds!<br />
            Calculate probabilities with coins, dice, and cards.
          </p>

          <div className="probability__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Read the probability question carefully</li>
              <li>Choose the correct probability fraction</li>
              <li>Faster answers earn bonus points!</li>
              <li>Unlock new modes as you level up</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="probability__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="probability__start-button" onClick={startGame}>
            🎲 Start Playing!
          </button>
        </div>
      </ArcadeGameLayout>
    );
  }

  // Render game over
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

  // Render game
  const modeEmoji = mode === 'coin' ? '🪙' : mode === 'dice' ? '🎲' : '🃏';

  return (
    <ArcadeGameLayout
      gameName="Probability Playground"
      gameEmoji="🎲"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="probability">
        <div className="probability__timer" style={{ color: timeRemaining <= 5 ? '#ff4444' : '#fff' }}>
          ⏱️ {timeRemaining}s
        </div>

        <div className="probability__question">
          <div className="probability__mode">{modeEmoji}</div>
          <div className="probability__question-text">{question}</div>
        </div>

        <div className="probability__options">
          {options.map((option, i) => (
            <button
              key={i}
              className="probability__option"
              onClick={() => handleAnswer(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
