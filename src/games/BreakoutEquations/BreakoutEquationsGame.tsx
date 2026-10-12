import { useState, useEffect, useCallback, useRef } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './BreakoutEquationsGame.css';

interface Brick {
  id: number;
  value: number;
  x: number;
  y: number;
  isCorrect: boolean;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
}

interface BreakoutEquationsGameProps {
  onBack: () => void;
}

const GAME_WIDTH = 600;
const GAME_HEIGHT = 450;
const BRICK_WIDTH = 80;
const BRICK_HEIGHT = 40;
const CANNON_WIDTH = 80;
const BULLET_SPEED = 8;

export function BreakoutEquationsGame({ onBack }: BreakoutEquationsGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [bricks, setBricks] = useState<Brick[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [cannonX, setCannonX] = useState(GAME_WIDTH / 2 - CANNON_WIDTH / 2);
  const [currentProblem, setCurrentProblem] = useState({ num1: 0, num2: 0, operator: '+', answer: 0 });
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('breakoutEquations_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const nextBrickIdRef = useRef(0);
  const nextBulletIdRef = useRef(0);
  const cannonXRef = useRef(GAME_WIDTH / 2 - CANNON_WIDTH / 2);

  // Generate problem
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

  // Generate wrong answer
  const generateWrongAnswer = useCallback((correct: number) => {
    const range = Math.max(5, Math.floor(correct * 0.4));
    let wrong;
    do {
      const offset = Math.floor(Math.random() * range * 2) - range;
      wrong = correct + offset;
    } while (wrong === correct || wrong < 1);
    return wrong;
  }, []);

  // Create bricks for new round
  const createBricks = useCallback((answer: number) => {
    const wrongAnswers = [
      generateWrongAnswer(answer),
      generateWrongAnswer(answer),
      generateWrongAnswer(answer),
    ];
    // Make sure we don't have duplicates
    while (wrongAnswers.includes(answer) || new Set(wrongAnswers).size !== wrongAnswers.length) {
      wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)] = generateWrongAnswer(answer);
    }

    const allAnswers = [answer, ...wrongAnswers];
    // Shuffle
    for (let i = allAnswers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
    }

    const newBricks: Brick[] = allAnswers.map((value, index) => ({
      id: nextBrickIdRef.current++,
      value,
      x: index * (BRICK_WIDTH + 30) + 60,
      y: 50 + Math.random() * 50,
      isCorrect: value === answer,
    }));

    return newBricks;
  }, [generateWrongAnswer]);

  // Start new round
  const startRound = useCallback(() => {
    const problem = generateProblem();
    setCurrentProblem(problem);
    setBricks(createBricks(problem.answer));
    setBullets([]);
    setShowFeedback(null);
  }, [generateProblem, createBricks]);

  // Start game
  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setCannonX(GAME_WIDTH / 2 - CANNON_WIDTH / 2);
    cannonXRef.current = GAME_WIDTH / 2 - CANNON_WIDTH / 2;
    setBullets([]);
    setShowFeedback(null);
    nextBrickIdRef.current = 0;
    nextBulletIdRef.current = 0;
    setGameStatus('playing');
  }, []);

  // Initialize first round
  useEffect(() => {
    if (gameStatus === 'playing' && bricks.length === 0 && !showFeedback) {
      startRound();
    }
  }, [gameStatus, bricks.length, showFeedback, startRound]);

  // Mouse movement
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!gameAreaRef.current || gameStatus !== 'playing') return;
    const rect = gameAreaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - CANNON_WIDTH / 2;
    const newX = Math.max(0, Math.min(GAME_WIDTH - CANNON_WIDTH, x));
    cannonXRef.current = newX;
    setCannonX(newX);
  }, [gameStatus]);

  // Touch movement
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!gameAreaRef.current || gameStatus !== 'playing') return;
    if (e.touches.length === 0) return;
    const rect = gameAreaRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left - CANNON_WIDTH / 2;
    const newX = Math.max(0, Math.min(GAME_WIDTH - CANNON_WIDTH, x));
    cannonXRef.current = newX;
    setCannonX(newX);
  }, [gameStatus]);

  // Fire bullet
  const fireBullet = useCallback(() => {
    if (gameStatus !== 'playing' || showFeedback) return;

    audioManager.play('laser');
    const bullet: Bullet = {
      id: nextBulletIdRef.current++,
      x: cannonXRef.current + CANNON_WIDTH / 2 - 5,
      y: GAME_HEIGHT - 60,
    };
    setBullets(prev => [...prev, bullet]);
  }, [gameStatus, showFeedback]);

  // Click to fire
  const handleClick = useCallback(() => {
    fireBullet();
  }, [fireBullet]);

  // Game loop - move bullets and check collisions
  useEffect(() => {
    if (gameStatus !== 'playing') {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const gameLoop = () => {
      setBullets(prevBullets => {
        // Move bullets up
        const movedBullets = prevBullets.map(b => ({
          ...b,
          y: b.y - BULLET_SPEED,
        })).filter(b => b.y > -20); // Remove bullets that go off screen

        // Check collisions with bricks
        let hitBrick: Brick | null = null;
        let hitBulletId: number | null = null;

        for (const bullet of movedBullets) {
          for (const brick of bricks) {
            if (
              bullet.x >= brick.x &&
              bullet.x <= brick.x + BRICK_WIDTH &&
              bullet.y >= brick.y &&
              bullet.y <= brick.y + BRICK_HEIGHT
            ) {
              hitBrick = brick;
              hitBulletId = bullet.id;
              break;
            }
          }
          if (hitBrick) break;
        }

        if (hitBrick && hitBulletId !== null) {
          setTotalAnswers(ta => ta + 1);

          if (hitBrick.isCorrect) {
            // Correct!
            audioManager.playCorrect();
            setShowFeedback('correct');
            setCorrectAnswers(ca => ca + 1);
            setStreak(s => s + 1);

            const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
            setScore(s => s + (100 + level * 20) * streakMultiplier);

            // Remove all bricks
            setBricks([]);

            // Level up every 5 correct
            if ((correctAnswers + 1) % 5 === 0) {
              setLevel(l => l + 1);
              audioManager.playLevelUp();
            }

            // Next round after delay
            setTimeout(startRound, 800);
          } else {
            // Wrong!
            audioManager.playWrong();
            setShowFeedback('wrong');
            setStreak(0);

            // Remove hit brick
            setBricks(prev => prev.filter(b => b.id !== hitBrick!.id));

            // Lose a life
            setLives(l => {
              const newLives = l - 1;
              if (newLives <= 0) {
                setTimeout(() => setGameStatus('gameover'), 1000);
              } else {
                setTimeout(() => setShowFeedback(null), 500);
              }
              return newLives;
            });
          }

          // Remove the bullet that hit
          return movedBullets.filter(b => b.id !== hitBulletId);
        }

        return movedBullets;
      });

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameStatus, bricks, streak, correctAnswers, level, startRound]);

  // Save high score
  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('breakoutEquations_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout gameName="Breakout Equations" gameEmoji="🧱" score={0} lives={3} level={1} streak={0} onBack={onBack} showScore={false} showLives={false} showLevel={false}>
        <div className="breakout__start">
          <h1 className="breakout__title">🧱 Breakout Equations</h1>
          <p className="breakout__description">
            Shoot the correct answer!<br />
            Control your cannon with the mouse.
          </p>
          <div className="breakout__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Move mouse to aim the cannon</li>
              <li>Click to shoot bullets!</li>
              <li>Hit the brick with the correct answer</li>
              <li>Avoid hitting wrong answers - they cost a life!</li>
            </ul>
          </div>
          {highScore > 0 && <div className="breakout__high-score">High Score: {highScore.toLocaleString()}</div>}
          <button className="breakout__start-button" onClick={startGame}>🎯 Start Shooting!</button>
        </div>
      </ArcadeGameLayout>
    );
  }

  if (gameStatus === 'gameover') {
    return <GameOverOverlay score={score} highScore={highScore} isNewHighScore={score > highScore} level={level} correctAnswers={correctAnswers} totalAnswers={totalAnswers} onPlayAgain={startGame} onBack={onBack} />;
  }

  return (
    <ArcadeGameLayout gameName="Breakout Equations" gameEmoji="🧱" score={score} lives={lives} level={level} streak={streak} onBack={onBack} onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')} isPaused={gameStatus === 'paused'}>
      <div className="breakout">
        {/* Problem display */}
        <div className="breakout__problem">
          {currentProblem.num1} {currentProblem.operator} {currentProblem.num2} = ?
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`breakout__feedback breakout__feedback--${showFeedback}`}>
            {showFeedback === 'correct' ? '✓ Correct!' : '✗ Wrong!'}
          </div>
        )}

        {/* Game area */}
        <div
          ref={gameAreaRef}
          className="breakout__game-area"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onClick={handleClick}
        >
          {/* Bricks */}
          {bricks.map(brick => (
            <div
              key={brick.id}
              className="breakout__brick"
              style={{
                left: brick.x,
                top: brick.y,
                width: BRICK_WIDTH,
                height: BRICK_HEIGHT,
              }}
            >
              {brick.value}
            </div>
          ))}

          {/* Bullets */}
          {bullets.map(bullet => (
            <div
              key={bullet.id}
              className="breakout__bullet"
              style={{
                left: bullet.x,
                top: bullet.y,
              }}
            />
          ))}

          {/* Cannon */}
          <div
            className="breakout__cannon"
            style={{
              left: cannonX,
              bottom: 20,
            }}
          >
            <div className="breakout__cannon-barrel" />
            <div className="breakout__cannon-base">🔫</div>
          </div>
        </div>

        <div className="breakout__help">
          Move mouse to aim, click to shoot!
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
