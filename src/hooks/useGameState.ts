import { useState, useCallback, useEffect, useRef } from 'react';
import { config, levels, LevelConfig } from '../config/gameConfig';
import { MathProblem, generateProblem, checkAnswer } from '../utils/mathGenerator';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export interface GameStats {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  answersPerMinute: number;
  timeElapsed: number;
}

export interface GameState {
  status: GameStatus;
  currentProblem: MathProblem | null;
  previousProblem: MathProblem | null;
  previousWasCorrect: boolean | null;
  nextProblem: MathProblem | null;
  timeRemaining: number;
  stats: GameStats;
  puzzlePiecesCompleted: number;
  level: LevelConfig;
  userAnswer: string;
}

const initialStats: GameStats = {
  correct: 0,
  incorrect: 0,
  total: 0,
  accuracy: 100,
  answersPerMinute: 0,
  timeElapsed: 0,
};

export function useGameState() {
  const [status, setStatus] = useState<GameStatus>('idle');
  const [level, setLevel] = useState<LevelConfig>(levels[3]); // Default to Champion level
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [previousProblem, setPreviousProblem] = useState<MathProblem | null>(null);
  const [previousWasCorrect, setPreviousWasCorrect] = useState<boolean | null>(null);
  const [nextProblem, setNextProblem] = useState<MathProblem | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(config.timerDuration);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [puzzlePiecesCompleted, setPuzzlePiecesCompleted] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Calculate stats updates
  const updateStats = useCallback(
    (correct: boolean) => {
      setStats((prev) => {
        const newCorrect = prev.correct + (correct ? 1 : 0);
        const newIncorrect = prev.incorrect + (correct ? 0 : 1);
        const newTotal = prev.total + 1;
        const timeElapsed = startTimeRef.current
          ? (Date.now() - startTimeRef.current) / 1000
          : 0;
        const answersPerMinute =
          timeElapsed > 0 ? (newCorrect / timeElapsed) * 60 : 0;

        return {
          correct: newCorrect,
          incorrect: newIncorrect,
          total: newTotal,
          accuracy: newTotal > 0 ? Math.round((newCorrect / newTotal) * 100) : 100,
          answersPerMinute: Math.round(answersPerMinute * 10) / 10,
          timeElapsed: Math.round(timeElapsed),
        };
      });
    },
    []
  );

  // Generate new problems
  const advanceProblem = useCallback(() => {
    setPreviousProblem(currentProblem);
    setCurrentProblem(nextProblem);
    setNextProblem(generateProblem(level, nextProblem?.id));
    setUserAnswer('');
  }, [currentProblem, nextProblem, level]);

  // Check user's answer
  const submitAnswer = useCallback(
    (answer: number) => {
      if (!currentProblem || status !== 'playing') return;

      const isCorrect = checkAnswer(currentProblem, answer);
      setPreviousWasCorrect(isCorrect);
      updateStats(isCorrect);

      if (isCorrect) {
        setPuzzlePiecesCompleted((prev) => {
          const newCount = prev + 1;
          // Check win condition
          if (newCount >= level.puzzlePieces) {
            setStatus('won');
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
          return newCount;
        });
      }

      advanceProblem();
    },
    [currentProblem, status, level.puzzlePieces, updateStats, advanceProblem]
  );

  // Start game - accepts optional levelId to avoid stale closure issues
  const startGame = useCallback((levelId?: number) => {
    // Determine which level to use - if levelId provided, find it directly
    let gameLevel = level;
    if (levelId !== undefined) {
      const foundLevel = levels.find(l => l.id === levelId);
      if (foundLevel) {
        gameLevel = foundLevel;
        setLevel(foundLevel); // Also update state for consistency
      }
    }

    setStatus('playing');
    setTimeRemaining(config.timerDuration);
    setStats(initialStats);
    setPuzzlePiecesCompleted(0);
    setPreviousProblem(null);
    setPreviousWasCorrect(null);
    setUserAnswer('');

    // Generate initial problems using the resolved level
    const first = generateProblem(gameLevel);
    const second = generateProblem(gameLevel, first.id);
    setCurrentProblem(first);
    setNextProblem(second);

    startTimeRef.current = Date.now();

    // Start timer
    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          setStatus('lost');
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }, [level]);

  // Pause game
  const pauseGame = useCallback(() => {
    if (status === 'playing') {
      setStatus('paused');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [status]);

  // Resume game
  const resumeGame = useCallback(() => {
    if (status === 'paused') {
      setStatus('playing');
      timerRef.current = window.setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setStatus('lost');
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
  }, [status]);

  // Reset game
  const resetGame = useCallback(() => {
    setStatus('idle');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeRemaining(config.timerDuration);
    setStats(initialStats);
    setPuzzlePiecesCompleted(0);
    setCurrentProblem(null);
    setPreviousProblem(null);
    setPreviousWasCorrect(null);
    setNextProblem(null);
    setUserAnswer('');
    startTimeRef.current = null;
  }, []);

  // Select level
  const selectLevel = useCallback((levelId: number) => {
    const selectedLevel = levels.find((l) => l.id === levelId);
    if (selectedLevel) {
      setLevel(selectedLevel);
      resetGame();
    }
  }, [resetGame]);

  // Handle user input
  const handleInput = useCallback((value: string) => {
    // Only allow numbers
    const cleaned = value.replace(/[^0-9]/g, '');
    setUserAnswer(cleaned);
  }, []);

  // Clear input
  const clearInput = useCallback(() => {
    setUserAnswer('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    // State
    status,
    level,
    currentProblem,
    previousProblem,
    previousWasCorrect,
    nextProblem,
    timeRemaining,
    stats,
    puzzlePiecesCompleted,
    userAnswer,
    levels,
    config,

    // Actions
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    selectLevel,
    submitAnswer,
    handleInput,
    clearInput,
  };
}
