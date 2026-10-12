import { useState, useEffect, useCallback, useRef } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import { generateMathProblem, generateWrongAnswers, shuffleArray, MathProblem } from '../../config/arcadeConfig';
import './MathSnakeGame.css';

interface Position {
  x: number;
  y: number;
}

interface FoodItem {
  position: Position;
  value: number;
  isCorrect: boolean;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface MathSnakeGameProps {
  onBack: () => void;
}

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SPEED = 350; // SLOWER for kids - 350ms per move instead of 200
const SPEED_INCREASE = 10; // ms faster per level
const MIN_SPEED = 150; // Never too fast

export function MathSnakeGame({ onBack }: MathSnakeGameProps) {
  // Game state
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [, setDirection] = useState<Direction>('RIGHT');
  const [food, setFood] = useState<FoodItem[]>([]);
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);

  // Stats
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('mathSnake_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Refs
  const gameLoopRef = useRef<number | null>(null);
  const directionRef = useRef<Direction>('RIGHT');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate current speed based on level
  const getSpeed = useCallback(() => {
    return Math.max(MIN_SPEED, INITIAL_SPEED - (level - 1) * SPEED_INCREASE);
  }, [level]);

  // Generate new food items
  const generateFood = useCallback((snakeBody: Position[], problem: MathProblem) => {
    const wrongAnswers = generateWrongAnswers(problem.answer, 4);
    const allAnswers = shuffleArray([problem.answer, ...wrongAnswers]);

    const newFood: FoodItem[] = [];
    const occupiedPositions = new Set(snakeBody.map(p => `${p.x},${p.y}`));

    for (const value of allAnswers) {
      let position: Position;
      let attempts = 0;

      do {
        position = {
          x: Math.floor(Math.random() * GRID_SIZE),
          y: Math.floor(Math.random() * GRID_SIZE),
        };
        attempts++;
      } while (
        (occupiedPositions.has(`${position.x},${position.y}`) ||
          newFood.some(f => f.position.x === position.x && f.position.y === position.y)) &&
        attempts < 100
      );

      occupiedPositions.add(`${position.x},${position.y}`);
      newFood.push({
        position,
        value,
        isCorrect: value === problem.answer,
      });
    }

    return newFood;
  }, []);

  // Start game
  const startGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }];
    const problem = generateMathProblem(1);

    setSnake(initialSnake);
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setCurrentProblem(problem);
    setFood(generateFood(initialSnake, problem));
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setGameStatus('playing');
  }, [generateFood]);

  // Handle eating food
  const eatFood = useCallback((foodItem: FoodItem) => {
    setTotalAnswers(prev => prev + 1);

    if (foodItem.isCorrect) {
      // Correct answer!
      audioManager.playCorrect();
      setCorrectAnswers(prev => prev + 1);
      setStreak(prev => prev + 1);

      // Calculate score with streak multiplier
      const streakMultiplier = streak >= 20 ? 5 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      const points = 100 * streakMultiplier;
      setScore(prev => prev + points);

      // Grow snake
      setSnake(prev => [...prev, prev[prev.length - 1]]);

      // Level up every 5 correct answers
      if ((correctAnswers + 1) % 5 === 0) {
        setLevel(prev => {
          audioManager.playLevelUp();
          return prev + 1;
        });
      }

      // Generate new problem
      const newProblem = generateMathProblem(Math.min(level, 5));
      setCurrentProblem(newProblem);
      setFood(() => {
        // Generate new food items for the new problem
        return generateFood(snake, newProblem);
      });
    } else {
      // Wrong answer!
      audioManager.playWrong();
      setStreak(0);
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameStatus('gameover');
        }
        return newLives;
      });

      // Shrink snake if possible
      if (snake.length > 1) {
        setSnake(prev => prev.slice(0, -1));
      }

      // Remove the eaten wrong food and replace with new one
      setFood(() => generateFood(snake, currentProblem!));
    }
  }, [correctAnswers, currentProblem, generateFood, level, snake, streak]);

  // Game loop
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const moveSnake = () => {
      setSnake(prevSnake => {
        const head = prevSnake[0];
        const dir = directionRef.current;

        let newHead: Position;
        switch (dir) {
          case 'UP':
            newHead = { x: head.x, y: head.y - 1 };
            break;
          case 'DOWN':
            newHead = { x: head.x, y: head.y + 1 };
            break;
          case 'LEFT':
            newHead = { x: head.x - 1, y: head.y };
            break;
          case 'RIGHT':
            newHead = { x: head.x + 1, y: head.y };
            break;
          default:
            newHead = head;
        }

        // Check wall collision
        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          audioManager.playWrong();
          setLives(prev => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              setGameStatus('gameover');
            }
            return newLives;
          });
          // Reset snake position
          return [{ x: 10, y: 10 }];
        }

        // Check self collision
        if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          audioManager.playWrong();
          setLives(prev => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              setGameStatus('gameover');
            }
            return newLives;
          });
          // Reset snake position but keep length
          return [{ x: 10, y: 10 }, ...prevSnake.slice(1)];
        }

        // Check food collision
        const eatenFood = food.find(f => f.position.x === newHead.x && f.position.y === newHead.y);
        if (eatenFood) {
          eatFood(eatenFood);
        }

        // Move snake
        const newSnake = [newHead, ...prevSnake.slice(0, -1)];
        return newSnake;
      });
    };

    gameLoopRef.current = window.setInterval(moveSnake, getSpeed());

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameStatus, food, eatFood, getSpeed]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStatus !== 'playing') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (directionRef.current !== 'DOWN') {
            directionRef.current = 'UP';
            setDirection('UP');
          }
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (directionRef.current !== 'UP') {
            directionRef.current = 'DOWN';
            setDirection('DOWN');
          }
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (directionRef.current !== 'RIGHT') {
            directionRef.current = 'LEFT';
            setDirection('LEFT');
          }
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (directionRef.current !== 'LEFT') {
            directionRef.current = 'RIGHT';
            setDirection('RIGHT');
          }
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus]);

  // Save high score
  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('mathSnake_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  // Draw game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw food
    food.forEach(item => {
      const x = item.position.x * CELL_SIZE;
      const y = item.position.y * CELL_SIZE;

      // Food background
      ctx.fillStyle = item.isCorrect ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)';
      ctx.beginPath();
      ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.fill();

      // Food number
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.value.toString(), x + CELL_SIZE / 2, y + CELL_SIZE / 2);
    });

    // Draw snake
    snake.forEach((segment, index) => {
      const x = segment.x * CELL_SIZE;
      const y = segment.y * CELL_SIZE;

      // Gradient color from head to tail
      const hue = 120 + (index / snake.length) * 60;
      ctx.fillStyle = `hsl(${hue}, 70%, ${50 - index * 2}%)`;

      if (index === 0) {
        // Head
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 2 - 1, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = 'white';
        const eyeOffset = CELL_SIZE / 4;
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE / 2 - eyeOffset / 2, y + CELL_SIZE / 3, 3, 0, Math.PI * 2);
        ctx.arc(x + CELL_SIZE / 2 + eyeOffset / 2, y + CELL_SIZE / 3, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE / 2 - eyeOffset / 2, y + CELL_SIZE / 3, 1.5, 0, Math.PI * 2);
        ctx.arc(x + CELL_SIZE / 2 + eyeOffset / 2, y + CELL_SIZE / 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Body
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
        ctx.fill();
      }
    });
  }, [snake, food]);

  // Touch controls
  const handleTouchControl = (dir: Direction) => {
    if (gameStatus !== 'playing') return;

    if (
      (dir === 'UP' && directionRef.current !== 'DOWN') ||
      (dir === 'DOWN' && directionRef.current !== 'UP') ||
      (dir === 'LEFT' && directionRef.current !== 'RIGHT') ||
      (dir === 'RIGHT' && directionRef.current !== 'LEFT')
    ) {
      directionRef.current = dir;
      setDirection(dir);
    }
  };

  // Render start screen
  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Math Snake"
        gameEmoji="🐍"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="math-snake__start">
          <h1 className="math-snake__title">🐍 Math Snake</h1>
          <p className="math-snake__description">
            Guide your snake to eat the correct answer!<br />
            Wrong answers shrink your snake and cost a life.
          </p>

          <div className="math-snake__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Use arrow keys or WASD to move</li>
              <li>Eat the number that equals the equation</li>
              <li>Snake grows when you eat correct answers</li>
              <li>Snake shrinks and you lose a life on wrong answers</li>
              <li>Speed increases as you level up</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="math-snake__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="math-snake__start-button" onClick={startGame}>
            🎮 Start Game
          </button>
        </div>
      </ArcadeGameLayout>
    );
  }

  // Render game over screen
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
      gameName="Math Snake"
      gameEmoji="🐍"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="math-snake">
        {/* Problem display */}
        {currentProblem && (
          <div className="math-snake__problem">
            <span className="math-snake__problem-text">{currentProblem.display}</span>
          </div>
        )}

        {/* Game canvas */}
        <div className="math-snake__game-area">
          <canvas
            ref={canvasRef}
            width={GRID_SIZE * CELL_SIZE}
            height={GRID_SIZE * CELL_SIZE}
            className="math-snake__canvas"
          />
        </div>

        {/* Touch controls */}
        <div className="math-snake__controls">
          <button
            className="math-snake__control math-snake__control--up"
            onClick={() => handleTouchControl('UP')}
          >
            ▲
          </button>
          <div className="math-snake__control-row">
            <button
              className="math-snake__control math-snake__control--left"
              onClick={() => handleTouchControl('LEFT')}
            >
              ◀
            </button>
            <button
              className="math-snake__control math-snake__control--right"
              onClick={() => handleTouchControl('RIGHT')}
            >
              ▶
            </button>
          </div>
          <button
            className="math-snake__control math-snake__control--down"
            onClick={() => handleTouchControl('DOWN')}
          >
            ▼
          </button>
        </div>

        {/* Snake length indicator */}
        <div className="math-snake__length">
          Length: {snake.length}
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
