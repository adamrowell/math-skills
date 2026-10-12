import { useState, useEffect, useCallback, useRef } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './EquationInvadersGame.css';

interface Invader {
  id: number;
  value: number;
  x: number;
  y: number;
  isCorrect: boolean;
}

interface EquationInvadersGameProps {
  onBack: () => void;
}

const GAME_WIDTH = 600;
const GAME_HEIGHT = 450;

export function EquationInvadersGame({ onBack }: EquationInvadersGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [invaders, setInvaders] = useState<Invader[]>([]);
  const [currentProblem, setCurrentProblem] = useState({ num1: 0, num2: 0, operator: '+', answer: 0 });
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Stats
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('equationInvaders_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const animationFrameRef = useRef<number | null>(null);
  const nextIdRef = useRef(0);

  // Generate new problem
  const generateProblem = useCallback(() => {
    let ops: string[] = ['+'];
    if (level >= 3) ops.push('-');
    if (level >= 5) ops.push('×');
    const operator = ops[Math.floor(Math.random() * ops.length)];

    const maxNum = Math.min(5 + level * 2, 15);

    let num1, num2, answer;
    if (operator === '+') {
      num1 = Math.floor(Math.random() * maxNum) + 1;
      num2 = Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      answer = num1 + num2;
    } else if (operator === '-') {
      num2 = Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      num1 = num2 + Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      answer = num1 - num2;
    } else {
      num1 = Math.floor(Math.random() * Math.min(5 + level, 10)) + 1;
      num2 = Math.floor(Math.random() * 5) + 1;
      answer = num1 * num2;
    }

    return { num1, num2, operator, answer };
  }, [level]);

  // Generate wrong answers
  const generateWrongAnswers = useCallback((correct: number) => {
    const wrongs: number[] = [];
    const range = Math.max(5, Math.floor(correct * 0.4));

    while (wrongs.length < 4) {
      const offset = Math.floor(Math.random() * range * 2) - range;
      const wrong = correct + offset;
      if (wrong !== correct && wrong > 0 && !wrongs.includes(wrong)) {
        wrongs.push(wrong);
      }
    }
    return wrongs;
  }, []);

  // Create invaders for new round
  const createInvaders = useCallback((answer: number) => {
    const wrongAnswers = generateWrongAnswers(answer);
    const allAnswers = [answer, ...wrongAnswers];

    // Shuffle
    for (let i = allAnswers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
    }

    // Create invaders spread across width
    const newInvaders: Invader[] = allAnswers.map((value, index) => {
      const spacing = GAME_WIDTH / (allAnswers.length + 1);
      return {
        id: nextIdRef.current++,
        value,
        x: spacing * (index + 1) - 40,
        y: -60 - Math.random() * 100, // Stagger start positions
        isCorrect: value === answer,
      };
    });

    return newInvaders;
  }, [generateWrongAnswers]);

  // Start new round
  const startRound = useCallback(() => {
    const problem = generateProblem();
    setCurrentProblem(problem);
    setInvaders(createInvaders(problem.answer));
    setShowFeedback(null);
  }, [generateProblem, createInvaders]);

  // Start game - NO DELAY
  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setShowFeedback(null);
    nextIdRef.current = 0;
    setGameStatus('playing');

    // Start first round immediately
    const problem = generateProblem();
    setCurrentProblem(problem);
    setInvaders(createInvaders(problem.answer));
  }, [generateProblem, createInvaders]);

  // Game loop
  useEffect(() => {
    if (gameStatus !== 'playing') {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const gameLoop = () => {
      setInvaders(prev => {
        // Move invaders down
        const speed = 0.5 + level * 0.1;
        const updated = prev.map(inv => ({
          ...inv,
          y: inv.y + speed,
        }));

        // Check if any reached bottom
        const reachedBottom = updated.find(inv => inv.y >= GAME_HEIGHT - 50);
        if (reachedBottom) {
          // Only lose life if correct answer reached bottom
          if (reachedBottom.isCorrect) {
            audioManager.playWrong();
            setShowFeedback('wrong');
            setStreak(0);
            setLives(l => {
              const newLives = l - 1;
              if (newLives <= 0) {
                setTimeout(() => setGameStatus('gameover'), 1000);
              } else {
                setTimeout(startRound, 1000);
              }
              return newLives;
            });
            return [];
          }
          // Remove wrong answers that hit bottom
          return updated.filter(inv => inv.y < GAME_HEIGHT - 50);
        }

        return updated;
      });

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameStatus, level, startRound]);

  // Handle shoot
  const shootInvader = useCallback((invader: Invader) => {
    if (showFeedback) return; // Ignore clicks during feedback

    setTotalAnswers(ta => ta + 1);

    if (invader.isCorrect) {
      // Correct!
      audioManager.play('laser');
      audioManager.playCorrect();
      setShowFeedback('correct');
      setCorrectAnswers(ca => ca + 1);
      setStreak(s => s + 1);

      const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      const points = (100 + level * 30) * streakMultiplier;
      setScore(s => s + points);

      // Clear all invaders
      setInvaders([]);

      // Level up every 5 correct
      if ((correctAnswers + 1) % 5 === 0) {
        setLevel(l => l + 1);
        audioManager.playLevelUp();
      }

      // Start next round
      setTimeout(startRound, 600);
    } else {
      // Wrong!
      audioManager.playWrong();
      setShowFeedback('wrong');
      setStreak(0);

      // Remove the clicked invader
      setInvaders(prev => prev.filter(inv => inv.id !== invader.id));

      // Clear feedback after a moment
      setTimeout(() => setShowFeedback(null), 500);
    }
  }, [showFeedback, streak, correctAnswers, level, startRound]);

  // Save high score
  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('equationInvaders_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  // Render start screen
  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Equation Invaders"
        gameEmoji="👾"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="equation-invaders__start">
          <h1 className="equation-invaders__title">👾 Equation Invaders</h1>
          <p className="equation-invaders__description">
            Defend Earth from alien numbers!<br />
            Shoot the invader with the correct answer.
          </p>

          <div className="equation-invaders__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Multiple aliens fall with different numbers</li>
              <li>Read the equation at the top</li>
              <li>Click the alien with the correct answer!</li>
              <li>Don't let the right answer reach the bottom!</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="equation-invaders__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="equation-invaders__start-button" onClick={startGame}>
            👾 Start Defending!
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
  return (
    <ArcadeGameLayout
      gameName="Equation Invaders"
      gameEmoji="👾"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="equation-invaders">
        {/* Problem display */}
        <div className="equation-invaders__problem">
          {currentProblem.num1} {currentProblem.operator} {currentProblem.num2} = ?
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`equation-invaders__feedback equation-invaders__feedback--${showFeedback}`}>
            {showFeedback === 'correct' ? '✓ Correct!' : '✗ Try again!'}
          </div>
        )}

        {/* Game area */}
        <div className="equation-invaders__game-area" style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
          {invaders.map(invader => (
            <div
              key={invader.id}
              className="equation-invaders__invader"
              style={{
                left: invader.x,
                top: invader.y,
              }}
              onClick={() => shootInvader(invader)}
            >
              <div className="equation-invaders__alien">👾</div>
              <div className="equation-invaders__value">{invader.value}</div>
            </div>
          ))}

          {/* Defense line */}
          <div className="equation-invaders__defense-line" />
        </div>

        <div className="equation-invaders__help">
          Click the alien with the answer to {currentProblem.num1} {currentProblem.operator} {currentProblem.num2}
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
