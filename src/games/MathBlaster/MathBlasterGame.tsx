import { useState, useEffect, useCallback, useRef } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './MathBlasterGame.css';

interface Enemy {
  id: number;
  problem: string;
  answer: number;
  x: number;
  y: number;
}

interface MathBlasterGameProps {
  onBack: () => void;
}

const GAME_WIDTH = 600;
const GAME_HEIGHT = 500;

// Speed settings for level selector
const SPEED_PRESETS = {
  slow: { baseSpeed: 0.3, spawnInterval: 4500, label: 'Slow', emoji: '🐢' },
  medium: { baseSpeed: 0.5, spawnInterval: 3500, label: 'Medium', emoji: '🚶' },
  fast: { baseSpeed: 0.8, spawnInterval: 2500, label: 'Fast', emoji: '🏃' },
};

type SpeedLevel = keyof typeof SPEED_PRESETS;

export function MathBlasterGame({ onBack }: MathBlasterGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [userInput, setUserInput] = useState('');
  const [nextId, setNextId] = useState(0);
  const [speedLevel, setSpeedLevel] = useState<SpeedLevel>('medium');

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('mathBlaster_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const animationFrameRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSubmitTimerRef = useRef<number | null>(null);

  // Voice recognition state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Calculate current speed based on level and speed preset
  // Speed increases every 10 questions
  const getCurrentSpeed = useCallback(() => {
    const preset = SPEED_PRESETS[speedLevel];
    const speedMultiplier = 1 + Math.floor(questionsAnswered / 10) * 0.15;
    return preset.baseSpeed * speedMultiplier;
  }, [speedLevel, questionsAnswered]);

  const getCurrentSpawnInterval = useCallback(() => {
    const preset = SPEED_PRESETS[speedLevel];
    const reductionPerTen = 200; // ms faster every 10 questions
    return Math.max(1500, preset.spawnInterval - Math.floor(questionsAnswered / 10) * reductionPerTen);
  }, [speedLevel, questionsAnswered]);

  // EASIER problems for kids - small numbers, gradual difficulty
  const generateProblem = useCallback(() => {
    // Levels 1-2: addition only
    // Levels 3-4: add subtraction
    // Levels 5+: add multiplication (simple)
    let ops: string[] = ['+'];
    if (level >= 3) ops.push('-');
    if (level >= 5) ops.push('×');
    const op = ops[Math.floor(Math.random() * ops.length)];

    // Much smaller numbers - start with 1-10
    const maxNum = Math.min(5 + level * 2, 15);

    let num1, num2, answer;
    if (op === '+') {
      num1 = Math.floor(Math.random() * maxNum) + 1;
      num2 = Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      answer = num1 + num2;
    } else if (op === '-') {
      num2 = Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      num1 = num2 + Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      answer = num1 - num2;
    } else {
      num1 = Math.floor(Math.random() * Math.min(5 + level, 10)) + 1;
      num2 = Math.floor(Math.random() * 5) + 1;
      answer = num1 * num2;
    }

    return { problem: `${num1} ${op} ${num2}`, answer };
  }, [level]);

  const spawnEnemy = useCallback(() => {
    const { problem, answer } = generateProblem();
    const x = Math.random() * (GAME_WIDTH - 100);

    setEnemies(prev => [...prev, {
      id: nextId,
      problem,
      answer,
      x,
      y: -50,
    }]);
    setNextId(id => id + 1);
  }, [generateProblem, nextId]);

  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setQuestionsAnswered(0);
    setEnemies([]);
    setUserInput('');
    setNextId(0);
    setGameStatus('playing');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Auto-submit when answer is correct (after 0.25s delay)
  const checkAutoSubmit = useCallback((input: string) => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
    }

    const userAnswer = parseInt(input, 10);
    if (isNaN(userAnswer)) return;

    const hasMatch = enemies.some(e => e.answer === userAnswer);
    if (hasMatch) {
      autoSubmitTimerRef.current = window.setTimeout(() => {
        // Re-check that the answer is still valid
        setEnemies(currentEnemies => {
          const hit = currentEnemies.find(e => e.answer === userAnswer);
          if (hit) {
            audioManager.play('laser');
            audioManager.playCorrect();
            setCorrectAnswers(ca => ca + 1);
            setTotalAnswers(ta => ta + 1);
            setQuestionsAnswered(qa => qa + 1);
            setStreak(s => s + 1);
            setScore(s => s + (100 + level * 30) * (streak >= 10 ? 3 : streak >= 5 ? 2 : 1));

            if ((correctAnswers + 1) % 10 === 0) {
              setLevel(l => l + 1);
              audioManager.playLevelUp();
            }

            setUserInput('');
            return currentEnemies.filter(e => e.id !== hit.id);
          }
          return currentEnemies;
        });
      }, 250);
    }
  }, [enemies, streak, correctAnswers, level]);

  // Speech recognition setup
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim();

      // Extract numbers from speech
      const numbers = transcript.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        const spokenNumber = numbers[numbers.length - 1];
        setUserInput(spokenNumber);
        checkAutoSubmit(spokenNumber);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening && gameStatus === 'playing') {
        try {
          recognition.start();
        } catch (e) {
          // Ignore
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      // Ignore
    }
  }, [checkAutoSubmit, isListening, gameStatus]);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Start speech recognition when game starts
  useEffect(() => {
    if (gameStatus === 'playing') {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }
    return () => stopSpeechRecognition();
  }, [gameStatus]);

  useEffect(() => {
    if (gameStatus !== 'playing') {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const spawnInterval = setInterval(spawnEnemy, getCurrentSpawnInterval());

    const gameLoop = () => {
      const speed = getCurrentSpeed();
      setEnemies(prev => {
        const updated = prev.map(enemy => ({
          ...enemy,
          y: enemy.y + speed,
        }));

        const reachedBottom = updated.find(e => e.y >= GAME_HEIGHT);
        if (reachedBottom) {
          audioManager.playWrong();
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) setGameStatus('gameover');
            return newLives;
          });
          return updated.filter(e => e.y < GAME_HEIGHT);
        }

        return updated;
      });

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      clearInterval(spawnInterval);
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, [gameStatus, spawnEnemy, getCurrentSpeed, getCurrentSpawnInterval]);

  const shoot = useCallback(() => {
    const userAnswer = parseInt(userInput, 10);
    if (isNaN(userAnswer)) return;

    setTotalAnswers(ta => ta + 1);
    const hit = enemies.find(e => e.answer === userAnswer);

    if (hit) {
      audioManager.play('laser');
      audioManager.playCorrect();
      setCorrectAnswers(ca => ca + 1);
      setQuestionsAnswered(qa => qa + 1);
      setStreak(s => s + 1);
      setScore(s => s + (100 + level * 30) * (streak >= 10 ? 3 : streak >= 5 ? 2 : 1));
      setEnemies(prev => prev.filter(e => e.id !== hit.id));

      if ((correctAnswers + 1) % 10 === 0) {
        setLevel(l => l + 1);
        audioManager.playLevelUp();
      }
    } else {
      audioManager.playWrong();
      setStreak(0);
    }

    setUserInput('');
  }, [userInput, enemies, streak, correctAnswers, level]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userInput.length > 0) {
      shoot();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserInput(value);
    checkAutoSubmit(value);
  };

  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('mathBlaster_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout gameName="Math Blaster" gameEmoji="🚀" score={0} lives={3} level={1} streak={0} onBack={onBack} showScore={false} showLives={false} showLevel={false}>
        <div className="math-blaster__start">
          <h1 className="math-blaster__title">🚀 Math Blaster</h1>
          <p className="math-blaster__description">Blast enemies with math answers!<br />Type or say the answer to shoot.</p>

          {/* Speed selector */}
          <div className="math-blaster__speed-selector">
            <h3>Choose Speed</h3>
            <div className="math-blaster__speed-options">
              {(Object.keys(SPEED_PRESETS) as SpeedLevel[]).map((speed) => (
                <button
                  key={speed}
                  className={`math-blaster__speed-button ${speedLevel === speed ? 'math-blaster__speed-button--active' : ''}`}
                  onClick={() => setSpeedLevel(speed)}
                >
                  <span className="math-blaster__speed-emoji">{SPEED_PRESETS[speed].emoji}</span>
                  <span>{SPEED_PRESETS[speed].label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="math-blaster__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Enemies fall from the top with math problems</li>
              <li>Type or speak the answer to blast them!</li>
              <li>Correct answers auto-fire after 0.25s</li>
              <li>Speed increases every 10 questions</li>
              <li>Don't let enemies reach the bottom</li>
            </ul>
          </div>
          {highScore > 0 && <div className="math-blaster__high-score">High Score: {highScore.toLocaleString()}</div>}
          <button className="math-blaster__start-button" onClick={startGame}>🚀 Start Blasting!</button>
        </div>
      </ArcadeGameLayout>
    );
  }

  if (gameStatus === 'gameover') {
    return <GameOverOverlay score={score} highScore={highScore} isNewHighScore={score > highScore} level={level} correctAnswers={correctAnswers} totalAnswers={totalAnswers} onPlayAgain={startGame} onBack={onBack} />;
  }

  return (
    <ArcadeGameLayout gameName="Math Blaster" gameEmoji="🚀" score={score} lives={lives} level={level} streak={streak} onBack={onBack} onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')} isPaused={gameStatus === 'paused'}>
      <div className="math-blaster">
        {/* Speed indicator */}
        <div className="math-blaster__speed-indicator">
          {SPEED_PRESETS[speedLevel].emoji} Speed: {Math.floor((1 + Math.floor(questionsAnswered / 10) * 0.15) * 100)}%
          {questionsAnswered > 0 && questionsAnswered % 10 === 0 && (
            <span className="math-blaster__speed-up">SPEED UP!</span>
          )}
        </div>

        <div className="math-blaster__game-area" style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
          {enemies.map(enemy => (
            <div key={enemy.id} className="math-blaster__enemy" style={{ left: enemy.x, top: enemy.y }}>
              <div className="math-blaster__alien">👾</div>
              <div className="math-blaster__problem">{enemy.problem}</div>
            </div>
          ))}
        </div>
        <div className="math-blaster__controls">
          <div className="math-blaster__input-wrapper">
            <input
              ref={inputRef}
              type="number"
              value={userInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="math-blaster__input"
              placeholder="Type answer..."
              autoFocus
            />
            {isListening && <span className="math-blaster__mic-indicator">🎤</span>}
          </div>
          <button className="math-blaster__shoot" onClick={shoot} disabled={userInput.length === 0}>🚀 SHOOT</button>
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
