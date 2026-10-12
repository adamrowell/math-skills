import { useState, useEffect, useCallback, useRef } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './MathMuncherGame.css';

interface Position {
  x: number;
  y: number;
}

interface NumberCell {
  value: number;
  isCorrect: boolean;
  isMunched: boolean;
}

interface MathMuncherGameProps {
  onBack: () => void;
}

const GRID_WIDTH = 8;
const GRID_HEIGHT = 6;

export function MathMuncherGame({ onBack }: MathMuncherGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [playerPos, setPlayerPos] = useState<Position>({ x: 0, y: 0 });
  const [grid, setGrid] = useState<(NumberCell | null)[][]>([]);
  const [currentProblem, setCurrentProblem] = useState({ num1: 0, num2: 0, operator: '+', answer: 0 });
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [correctRemaining, setCorrectRemaining] = useState(0);

  // Stats
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('mathMuncher_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const gameAreaRef = useRef<HTMLDivElement>(null);

  // Generate problem
  const generateProblem = useCallback(() => {
    let operators: string[] = ['+'];
    if (level >= 3) operators.push('-');
    if (level >= 5) operators.push('×');
    const operator = operators[Math.floor(Math.random() * operators.length)];

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
  const generateWrongAnswer = useCallback((correct: number) => {
    const range = Math.max(5, Math.floor(correct * 0.4));
    let wrong;
    do {
      const offset = Math.floor(Math.random() * range * 2) - range;
      wrong = correct + offset;
    } while (wrong === correct || wrong < 1);
    return wrong;
  }, []);

  // Create grid with numbers
  const createGrid = useCallback((answer: number) => {
    // Create empty grid
    const newGrid: (NumberCell | null)[][] = Array(GRID_HEIGHT)
      .fill(null)
      .map(() => Array(GRID_WIDTH).fill(null));

    // Place numbers randomly across the grid
    const numCorrect = Math.min(3 + Math.floor(level / 2), 6);
    const numWrong = Math.min(4 + level, 12);
    let correctPlaced = 0;
    let wrongPlaced = 0;

    // Fill grid with numbers
    const positions: Position[] = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        // Don't place on player start
        if (x === 0 && y === 0) continue;
        positions.push({ x, y });
      }
    }

    // Shuffle positions
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Place correct answers
    for (let i = 0; i < positions.length && correctPlaced < numCorrect; i++) {
      const pos = positions[i];
      newGrid[pos.y][pos.x] = { value: answer, isCorrect: true, isMunched: false };
      correctPlaced++;
    }

    // Place wrong answers
    for (let i = correctPlaced; i < positions.length && wrongPlaced < numWrong; i++) {
      const pos = positions[i];
      if (newGrid[pos.y][pos.x] === null) {
        newGrid[pos.y][pos.x] = { value: generateWrongAnswer(answer), isCorrect: false, isMunched: false };
        wrongPlaced++;
      }
    }

    return { grid: newGrid, correctCount: correctPlaced };
  }, [level, generateWrongAnswer]);

  // Start new round
  const startRound = useCallback(() => {
    const problem = generateProblem();
    setCurrentProblem(problem);
    const { grid: newGrid, correctCount } = createGrid(problem.answer);
    setGrid(newGrid);
    setCorrectRemaining(correctCount);
    setPlayerPos({ x: 0, y: 0 });
    setShowFeedback(null);
  }, [generateProblem, createGrid]);

  // Start game
  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setShowFeedback(null);
    setGameStatus('playing');
  }, []);

  // Initialize first round
  useEffect(() => {
    if (gameStatus === 'playing' && grid.length === 0) {
      startRound();
    }
  }, [gameStatus, grid.length, startRound]);

  // Move player and check for munching
  const movePlayer = useCallback((newX: number, newY: number) => {
    if (showFeedback) return; // Ignore moves during feedback

    // Bounds check
    if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) return;

    setPlayerPos({ x: newX, y: newY });

    // Check if there's a number to munch
    const cell = grid[newY]?.[newX];
    if (cell && !cell.isMunched) {
      setTotalAnswers(ta => ta + 1);

      if (cell.isCorrect) {
        // Correct!
        audioManager.play('chomp');
        audioManager.playCorrect();
        setShowFeedback('correct');
        setCorrectAnswers(ca => ca + 1);
        setStreak(s => s + 1);

        const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
        setScore(s => s + (100 + level * 20) * streakMultiplier);

        // Mark as munched
        setGrid(prev => {
          const newGrid = prev.map(row => row.map(c => c ? { ...c } : null));
          newGrid[newY][newX] = { ...cell, isMunched: true };
          return newGrid;
        });

        // Check if all correct munched
        const newRemaining = correctRemaining - 1;
        setCorrectRemaining(newRemaining);

        if (newRemaining === 0) {
          // Level complete!
          if ((correctAnswers + 1) % 5 === 0) {
            setLevel(l => l + 1);
            audioManager.playLevelUp();
          }
          setTimeout(startRound, 800);
        } else {
          setTimeout(() => setShowFeedback(null), 400);
        }
      } else {
        // Wrong!
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
    }
  }, [showFeedback, grid, streak, correctRemaining, correctAnswers, level, startRound]);

  // Keyboard controls
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      let newX = playerPos.x;
      let newY = playerPos.y;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        newY = playerPos.y - 1;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        newY = playerPos.y + 1;
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        newX = playerPos.x - 1;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        newX = playerPos.x + 1;
      }

      if (newX !== playerPos.x || newY !== playerPos.y) {
        movePlayer(newX, newY);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus, playerPos, movePlayer]);

  // Click/touch to move
  const handleCellClick = useCallback((x: number, y: number) => {
    if (gameStatus !== 'playing' || showFeedback) return;

    // Only allow clicking adjacent cells
    const dx = Math.abs(x - playerPos.x);
    const dy = Math.abs(y - playerPos.y);

    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
      movePlayer(x, y);
    }
  }, [gameStatus, showFeedback, playerPos, movePlayer]);

  // Save high score
  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('mathMuncher_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  // Render start screen
  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Math Muncher"
        gameEmoji="😋"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="math-muncher__start">
          <h1 className="math-muncher__title">😋 Math Muncher</h1>
          <p className="math-muncher__description">
            Munch your way through the grid!<br />
            Eat only the correct answers.
          </p>

          <div className="math-muncher__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Move with Arrow Keys, WASD, or click adjacent cells</li>
              <li>Look at the math problem at the top</li>
              <li>Move over numbers that equal the answer</li>
              <li>Avoid wrong numbers - they cost a life!</li>
              <li>Munch all correct answers to advance</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="math-muncher__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="math-muncher__start-button" onClick={startGame}>
            😋 Start Munching!
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
      gameName="Math Muncher"
      gameEmoji="😋"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="math-muncher">
        {/* Problem display */}
        <div className="math-muncher__problem">
          {currentProblem.num1} {currentProblem.operator} {currentProblem.num2} = ?
          <span className="math-muncher__remaining">({correctRemaining} left)</span>
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`math-muncher__feedback math-muncher__feedback--${showFeedback}`}>
            {showFeedback === 'correct' ? '✓ Yum!' : '✗ Yuck!'}
          </div>
        )}

        {/* Game grid */}
        <div
          ref={gameAreaRef}
          className="math-muncher__grid"
          style={{
            gridTemplateColumns: `repeat(${GRID_WIDTH}, 1fr)`,
          }}
        >
          {grid.map((row, y) =>
            row.map((cell, x) => {
              const isPlayer = x === playerPos.x && y === playerPos.y;
              const isAdjacent =
                (Math.abs(x - playerPos.x) === 1 && y === playerPos.y) ||
                (Math.abs(y - playerPos.y) === 1 && x === playerPos.x);

              return (
                <div
                  key={`${x}-${y}`}
                  className={`math-muncher__cell ${isPlayer ? 'math-muncher__cell--player' : ''} ${isAdjacent && !showFeedback ? 'math-muncher__cell--clickable' : ''} ${cell?.isMunched ? 'math-muncher__cell--munched' : ''}`}
                  onClick={() => handleCellClick(x, y)}
                >
                  {isPlayer ? (
                    <span className="math-muncher__player">😋</span>
                  ) : cell && !cell.isMunched ? (
                    <span className="math-muncher__number">{cell.value}</span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Controls hint */}
        <div className="math-muncher__controls">
          Arrow Keys / WASD / Click adjacent cells to move
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
