// Algebra Game State Hook
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  AlgebraLevelConfig,
  equationBuilderLevels,
  mysteryNumberLevels,
  equationMasterLevels,
  algebraConfig,
  AlgebraMode,
} from '../config/algebraConfig';
import { AlgebraProblem, generateAlgebraProblem, checkAlgebraAnswer } from '../utils/algebraGenerator';

export type AlgebraGameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export interface AlgebraGameStats {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  answersPerMinute: number;
  timeElapsed: number;
}

const initialStats: AlgebraGameStats = {
  correct: 0,
  incorrect: 0,
  total: 0,
  accuracy: 0,
  answersPerMinute: 0,
  timeElapsed: 0,
};

// Get levels for a specific mode
export function getLevelsForMode(mode: AlgebraMode): AlgebraLevelConfig[] {
  switch (mode) {
    case 'equations':
      return equationBuilderLevels;
    case 'solveForX':
      return mysteryNumberLevels;
    case 'advanced':
      return equationMasterLevels;
    default:
      return equationBuilderLevels;
  }
}

export function useAlgebraGameState(initialMode: AlgebraMode = 'equations') {
  const [mode, setMode] = useState<AlgebraMode>(initialMode);
  const [status, setStatus] = useState<AlgebraGameStatus>('idle');
  const [levels, setLevels] = useState<AlgebraLevelConfig[]>(getLevelsForMode(initialMode));
  const [level, setLevel] = useState<AlgebraLevelConfig>(levels[0]);
  const [currentProblem, setCurrentProblem] = useState<AlgebraProblem | null>(null);
  const [previousProblem, setPreviousProblem] = useState<AlgebraProblem | null>(null);
  const [previousWasCorrect, setPreviousWasCorrect] = useState<boolean | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(algebraConfig.timerDuration);
  const [stats, setStats] = useState<AlgebraGameStats>(initialStats);
  const [questionsCompleted, setQuestionsCompleted] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showSteps, setShowSteps] = useState(false);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Change mode
  const changeMode = useCallback((newMode: AlgebraMode) => {
    setMode(newMode);
    const newLevels = getLevelsForMode(newMode);
    setLevels(newLevels);
    setLevel(newLevels[0]);
    setStatus('idle');
  }, []);

  // Generate new problem
  const generateNewProblem = useCallback(() => {
    const problem = generateAlgebraProblem(level);
    return problem;
  }, [level]);

  // Start game
  const startGame = useCallback((levelId?: number) => {
    const selectedLevel = levelId
      ? levels.find(l => l.id === levelId) || levels[0]
      : level;

    setLevel(selectedLevel);
    setStatus('playing');
    setStats(initialStats);
    setQuestionsCompleted(0);
    setTimeRemaining(selectedLevel.timerDuration);
    setPreviousProblem(null);
    setPreviousWasCorrect(null);
    setUserAnswer('');
    setShowSteps(false);

    const problem = generateAlgebraProblem(selectedLevel);
    setCurrentProblem(problem);
    startTimeRef.current = Date.now();

    // Start timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setStatus('lost');
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [level, levels, generateNewProblem]);

  // Submit answer
  const submitAnswer = useCallback((answer: number) => {
    if (!currentProblem || status !== 'playing') return;

    const isCorrect = checkAlgebraAnswer(currentProblem, answer);

    // Update stats
    setStats(prev => {
      const newStats = {
        ...prev,
        total: prev.total + 1,
        correct: isCorrect ? prev.correct + 1 : prev.correct,
        incorrect: isCorrect ? prev.incorrect : prev.incorrect + 1,
        timeElapsed: startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0,
      };
      newStats.accuracy = newStats.total > 0
        ? Math.round((newStats.correct / newStats.total) * 100)
        : 0;
      newStats.answersPerMinute = newStats.timeElapsed > 0
        ? Math.round((newStats.correct / newStats.timeElapsed) * 60)
        : 0;
      return newStats;
    });

    // Track previous
    setPreviousProblem(currentProblem);
    setPreviousWasCorrect(isCorrect);
    setShowSteps(false);

    if (isCorrect) {
      const newCompleted = questionsCompleted + 1;
      setQuestionsCompleted(newCompleted);

      // Check win condition
      if (newCompleted >= level.questionsToWin) {
        setStatus('won');
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        return;
      }

      // Generate next problem
      const nextProblem = generateAlgebraProblem(level);
      setCurrentProblem(nextProblem);
      setUserAnswer('');
    } else {
      // Wrong answer - let user try again
      setUserAnswer('');
    }
  }, [currentProblem, status, questionsCompleted, level]);

  // Handle input
  const handleInput = useCallback((value: string) => {
    // Allow numbers and minus sign at start
    const cleaned = value.replace(/[^0-9-]/g, '').replace(/(.)-/g, '$1');
    setUserAnswer(cleaned);
  }, []);

  // Clear input
  const clearInput = useCallback(() => {
    setUserAnswer('');
  }, []);

  // Pause game
  const pauseGame = useCallback(() => {
    if (status === 'playing') {
      setStatus('paused');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [status]);

  // Resume game
  const resumeGame = useCallback(() => {
    if (status === 'paused') {
      setStatus('playing');
      timerRef.current = window.setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setStatus('lost');
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [status]);

  // Reset game
  const resetGame = useCallback(() => {
    setStatus('idle');
    setCurrentProblem(null);
    setPreviousProblem(null);
    setPreviousWasCorrect(null);
    setStats(initialStats);
    setQuestionsCompleted(0);
    setUserAnswer('');
    setTimeRemaining(level.timerDuration);
    setShowSteps(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [level]);

  // Select level
  const selectLevel = useCallback((levelId: number) => {
    const selectedLevel = levels.find(l => l.id === levelId);
    if (selectedLevel) {
      setLevel(selectedLevel);
    }
  }, [levels]);

  // Toggle steps visibility
  const toggleSteps = useCallback(() => {
    setShowSteps(prev => !prev);
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
    mode,
    status,
    level,
    levels,
    currentProblem,
    previousProblem,
    previousWasCorrect,
    timeRemaining,
    stats,
    questionsCompleted,
    userAnswer,
    showSteps,
    config: algebraConfig,

    // Actions
    changeMode,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    selectLevel,
    submitAnswer,
    handleInput,
    clearInput,
    toggleSteps,
  };
}

export default useAlgebraGameState;
