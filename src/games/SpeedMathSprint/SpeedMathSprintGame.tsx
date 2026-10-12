import { useState, useEffect, useCallback } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './SpeedMathSprintGame.css';

interface SpeedMathSprintGameProps {
  onBack: () => void;
}

export function SpeedMathSprintGame({ onBack }: SpeedMathSprintGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [problem, setProblem] = useState({ num1: 0, num2: 0, operator: '+', answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [raceProgress, setRaceProgress] = useState(0);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('speedMathSprint_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  // EASIER problems for kids - start with addition only, small numbers
  const generateProblem = useCallback(() => {
    // Levels 1-2: addition only
    // Levels 3-4: add subtraction
    // Levels 5+: add multiplication (simple)
    let ops: string[] = ['+'];
    if (level >= 3) ops.push('-');
    if (level >= 5) ops.push('×');
    const op = ops[Math.floor(Math.random() * ops.length)];

    // Much smaller numbers - start with 1-10, grow slowly
    const maxNum = Math.min(5 + level * 3, 20);

    let num1, num2, answer;
    if (op === '+') {
      // Simple addition: 1-10 + 1-10 at level 1
      num1 = Math.floor(Math.random() * maxNum) + 1;
      num2 = Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      answer = num1 + num2;
    } else if (op === '-') {
      // Subtraction: small numbers, positive result
      num2 = Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      num1 = num2 + Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      answer = num1 - num2;
    } else {
      // Multiplication: 1-5 × 1-5 to start
      num1 = Math.floor(Math.random() * Math.min(5 + level, 10)) + 1;
      num2 = Math.floor(Math.random() * 5) + 1;
      answer = num1 * num2;
    }

    setProblem({ num1, num2, operator: op, answer });
    setUserInput('');
  }, [level]);

  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setTimeRemaining(90); // More time! 90 seconds instead of 60
    setRaceProgress(0);
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
          setGameStatus('gameover');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus]);

  const submitAnswer = useCallback(() => {
    const userAnswer = parseInt(userInput, 10);
    setTotalAnswers(ta => ta + 1);

    if (userAnswer === problem.answer) {
      audioManager.playCorrect();
      setCorrectAnswers(ca => ca + 1);
      setStreak(s => s + 1);

      const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      const points = (50 + level * 15) * streakMultiplier;
      setScore(s => s + points);
      setRaceProgress(p => Math.min(100, p + 5));

      if ((correctAnswers + 1) % 10 === 0) {
        setLevel(l => l + 1);
        audioManager.playLevelUp();
      }

      if (raceProgress >= 95) {
        setGameStatus('gameover');
      } else {
        generateProblem();
      }
    } else {
      audioManager.playWrong();
      setStreak(0);
      setRaceProgress(p => Math.max(0, p - 2));
      generateProblem();
    }
  }, [userInput, problem.answer, streak, correctAnswers, level, raceProgress, generateProblem]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userInput.length > 0) {
      submitAnswer();
    }
  };

  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('speedMathSprint_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Speed Math Sprint"
        gameEmoji="🏃"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="speed-sprint__start">
          <h1 className="speed-sprint__title">🏃 Speed Math Sprint</h1>
          <p className="speed-sprint__description">
            Race to the finish line!<br />
            Solve problems as fast as you can in 60 seconds.
          </p>

          <div className="speed-sprint__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Solve as many problems as possible in 60 seconds</li>
              <li>Each correct answer moves you forward in the race</li>
              <li>Wrong answers slow you down</li>
              <li>Reach the finish line or get the highest score!</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="speed-sprint__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="speed-sprint__start-button" onClick={startGame}>
            🏃 Start Racing!
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
        title={raceProgress >= 95 ? 'VICTORY!' : 'TIME\'S UP!'}
        subtitle={raceProgress >= 95 ? 'You reached the finish line!' : undefined}
      />
    );
  }

  return (
    <ArcadeGameLayout
      gameName="Speed Math Sprint"
      gameEmoji="🏃"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="speed-sprint">
        <div className="speed-sprint__timer" style={{ color: timeRemaining <= 10 ? '#ff4444' : '#fff' }}>
          ⏱️ {timeRemaining}s
        </div>

        <div className="speed-sprint__race-track">
          <div className="speed-sprint__track">
            <div
              className="speed-sprint__runner"
              style={{ left: `${raceProgress}%` }}
            >
              🏃
            </div>
            <div className="speed-sprint__finish">🏁</div>
          </div>
          <div className="speed-sprint__progress-bar">
            <div
              className="speed-sprint__progress-fill"
              style={{ width: `${raceProgress}%` }}
            />
          </div>
        </div>

        <div className="speed-sprint__problem">
          {problem.num1} {problem.operator} {problem.num2} = ?
        </div>

        <div className="speed-sprint__input-area">
          <input
            type="number"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="speed-sprint__input"
            placeholder="Answer..."
            autoFocus
          />
          <button
            className="speed-sprint__submit"
            onClick={submitAnswer}
            disabled={userInput.length === 0}
          >
            →
          </button>
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
