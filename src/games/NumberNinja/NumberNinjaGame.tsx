import { useState, useEffect, useCallback, useRef } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './NumberNinjaGame.css';

interface FallingNumber {
  id: number;
  value: number;
  x: number;
  y: number;
  speed: number;
  isCorrect: boolean;
}

interface NumberNinjaGameProps {
  onBack: () => void;
}

const GAME_WIDTH = 600;
const GAME_HEIGHT = 450;
const PLAYER_WIDTH = 80;
const NUMBER_WIDTH = 60;
const INITIAL_FALL_SPEED = 1.2;

export function NumberNinjaGame({ onBack }: NumberNinjaGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [playerX, setPlayerX] = useState(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
  const [fallingNumbers, setFallingNumbers] = useState<FallingNumber[]>([]);
  const [_targetAnswer, setTargetAnswer] = useState(0);
  const [currentProblem, setCurrentProblem] = useState({ num1: 0, num2: 0, operator: '+' });
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Stats
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('numberNinja_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playerXRef = useRef(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
  const isMouseDown = useRef(false);

  // Generate new problem
  const generateProblem = useCallback(() => {
    let operators: string[] = ['+'];
    if (level >= 3) operators.push('-');
    if (level >= 5) operators.push('×');

    const operator = operators[Math.floor(Math.random() * operators.length)];
    const maxNum = Math.min(5 + level * 2, 20);

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

    setCurrentProblem({ num1, num2, operator });
    setTargetAnswer(answer);
    return answer;
  }, [level]);

  // Spawn falling number
  const spawnNumber = useCallback((value: number, isCorrect: boolean) => {
    const x = Math.random() * (GAME_WIDTH - NUMBER_WIDTH);
    const speed = INITIAL_FALL_SPEED + level * 0.2;

    setFallingNumbers(prev => [...prev, {
      id: Date.now() + Math.random(),
      value,
      x,
      y: -30,
      speed,
      isCorrect,
    }]);
  }, [level]);

  // Generate wrong answers
  const generateWrongAnswers = useCallback((correct: number) => {
    const wrongs: number[] = [];
    const range = Math.max(5, Math.floor(correct * 0.3));

    while (wrongs.length < 3) {
      const offset = Math.floor(Math.random() * range * 2) - range;
      const wrong = correct + offset;
      if (wrong !== correct && wrong > 0 && !wrongs.includes(wrong)) {
        wrongs.push(wrong);
      }
    }
    return wrongs;
  }, []);

  // Start new round
  const startRound = useCallback(() => {
    const answer = generateProblem();
    const wrongAnswers = generateWrongAnswers(answer);
    setFallingNumbers([]);
    setShowFeedback(null);

    // Spawn correct and wrong answers
    setTimeout(() => spawnNumber(answer, true), 300);
    wrongAnswers.forEach((num, i) => {
      setTimeout(() => spawnNumber(num, false), 600 + i * 600);
    });
  }, [generateProblem, generateWrongAnswers, spawnNumber]);

  // Start game
  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setPlayerX(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
    playerXRef.current = GAME_WIDTH / 2 - PLAYER_WIDTH / 2;
    setFallingNumbers([]);
    setShowFeedback(null);
    setGameStatus('playing');
  }, []);

  // Initialize first round
  useEffect(() => {
    if (gameStatus === 'playing' && fallingNumbers.length === 0 && !showFeedback) {
      startRound();
    }
  }, [gameStatus, fallingNumbers.length, showFeedback, startRound]);

  // Mouse/touch position handler - INSTANT response
  const handlePointerMove = useCallback((clientX: number) => {
    if (gameStatus !== 'playing' || !gameAreaRef.current) return;

    const rect = gameAreaRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const newX = Math.max(0, Math.min(GAME_WIDTH - PLAYER_WIDTH, relativeX - PLAYER_WIDTH / 2));

    playerXRef.current = newX;
    setPlayerX(newX);
  }, [gameStatus]);

  // Mouse events
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMouseDown.current || gameStatus === 'playing') {
      handlePointerMove(e.clientX);
    }
  }, [handlePointerMove, gameStatus]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isMouseDown.current = true;
    handlePointerMove(e.clientX);
  }, [handlePointerMove]);

  const handleMouseUp = useCallback(() => {
    isMouseDown.current = false;
  }, []);

  // Touch events
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      e.preventDefault();
      handlePointerMove(e.touches[0].clientX);
    }
  }, [handlePointerMove]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientX);
    }
  }, [handlePointerMove]);

  // Click to jump to position
  const handleClick = useCallback((e: React.MouseEvent) => {
    handlePointerMove(e.clientX);
  }, [handlePointerMove]);

  // Keyboard controls - also instant
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const keysPressed = new Set<string>();
    const KEYBOARD_SPEED = 12;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) {
        e.preventDefault();
        keysPressed.add(e.key.toLowerCase());
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase());
    };

    const moveLoop = () => {
      let newX = playerXRef.current;

      if (keysPressed.has('arrowleft') || keysPressed.has('a')) {
        newX = Math.max(0, newX - KEYBOARD_SPEED);
      }
      if (keysPressed.has('arrowright') || keysPressed.has('d')) {
        newX = Math.min(GAME_WIDTH - PLAYER_WIDTH, newX + KEYBOARD_SPEED);
      }

      if (newX !== playerXRef.current) {
        playerXRef.current = newX;
        setPlayerX(newX);
      }

      requestAnimationFrame(moveLoop);
    };

    const animId = requestAnimationFrame(moveLoop);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStatus]);

  // Game loop
  useEffect(() => {
    if (gameStatus !== 'playing') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const gameLoop = () => {
      setFallingNumbers(prev => {
        const updated = prev.map(num => ({
          ...num,
          y: num.y + num.speed,
        }));

        // Check for player catches
        const caught = updated.find(num => {
          const numCenterX = num.x + NUMBER_WIDTH / 2;
          const playerCenterX = playerXRef.current + PLAYER_WIDTH / 2;
          const distance = Math.abs(numCenterX - playerCenterX);
          return num.y >= GAME_HEIGHT - 100 && num.y <= GAME_HEIGHT - 50 && distance < (PLAYER_WIDTH + NUMBER_WIDTH) / 2;
        });

        if (caught) {
          setTotalAnswers(ta => ta + 1);

          if (caught.isCorrect) {
            audioManager.playCorrect();
            setShowFeedback('correct');
            setCorrectAnswers(ca => ca + 1);
            setStreak(s => s + 1);
            const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
            setScore(s => s + (100 + level * 20) * streakMultiplier);

            if ((correctAnswers + 1) % 5 === 0) {
              setLevel(l => l + 1);
              audioManager.playLevelUp();
            }

            setTimeout(startRound, 600);
          } else {
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
          }

          return [];
        }

        // Remove numbers that fell off screen
        const filtered = updated.filter(num => num.y < GAME_HEIGHT + 50);

        // If all numbers fell off and correct answer was missed
        if (filtered.length === 0 && prev.length > 0 && prev.some(n => n.isCorrect)) {
          audioManager.playWrong();
          setShowFeedback('wrong');
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

        return filtered;
      });

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameStatus, streak, correctAnswers, level, startRound]);

  // Save high score
  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('numberNinja_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  // Render start screen
  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Number Ninja"
        gameEmoji="🥷"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="number-ninja__start">
          <h1 className="number-ninja__title">🥷 Number Ninja</h1>
          <p className="number-ninja__description">
            Catch falling numbers with lightning reflexes!<br />
            Find the correct answer and catch it!
          </p>

          <div className="number-ninja__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Move your mouse or touch to control the ninja</li>
              <li>Keyboard: Arrow Keys or A/D work too!</li>
              <li>Catch the number that equals the answer</li>
              <li>Avoid wrong numbers - they cost a life!</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="number-ninja__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="number-ninja__start-button" onClick={startGame}>
            🥷 Start Catching!
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
      gameName="Number Ninja"
      gameEmoji="🥷"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="number-ninja">
        {/* Problem display */}
        <div className="number-ninja__problem">
          {currentProblem.num1} {currentProblem.operator} {currentProblem.num2} = ?
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`number-ninja__feedback number-ninja__feedback--${showFeedback}`}>
            {showFeedback === 'correct' ? '✓ Correct!' : '✗ Wrong!'}
          </div>
        )}

        {/* Game area */}
        <div
          ref={gameAreaRef}
          className="number-ninja__game-area"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          {/* Falling numbers */}
          {fallingNumbers.map(num => (
            <div
              key={num.id}
              className={`number-ninja__falling-number ${num.isCorrect ? 'number-ninja__falling-number--correct' : ''}`}
              style={{
                left: num.x,
                top: num.y,
              }}
            >
              {num.value}
            </div>
          ))}

          {/* Player */}
          <div
            className="number-ninja__player"
            style={{
              left: playerX,
              bottom: 20,
            }}
          >
            🥷
          </div>
        </div>

        {/* Controls hint */}
        <div className="number-ninja__controls">
          Move mouse/touch or use ← A / D →
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
