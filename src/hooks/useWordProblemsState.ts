// Word Problems Game State Hook
import { useState, useCallback, useEffect, useRef } from 'react';
import { WordProblemLevelConfig, wordProblemLevels, wordProblemsConfig, ProblemCategory, WordProblem } from '../config/wordProblemsConfig';
import { getRandomProblem } from '../data/wordProblems/allProblems';

export type WordProblemsGameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export interface WordProblemsGameStats {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  timeElapsed: number;
}

const initialStats: WordProblemsGameStats = {
  correct: 0,
  incorrect: 0,
  total: 0,
  accuracy: 0,
  timeElapsed: 0,
};

export function useWordProblemsState() {
  const [status, setStatus] = useState<WordProblemsGameStatus>('idle');
  const [level, setLevel] = useState<WordProblemLevelConfig>(wordProblemLevels[0]);
  const [currentProblem, setCurrentProblem] = useState<WordProblem | null>(null);
  const [previousProblem, setPreviousProblem] = useState<WordProblem | null>(null);
  const [previousWasCorrect, setPreviousWasCorrect] = useState<boolean | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(wordProblemLevels[0].timerDuration);
  const [stats, setStats] = useState<WordProblemsGameStats>(initialStats);
  const [problemsCompleted, setProblemsCompleted] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | number | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [usedProblemIds, setUsedProblemIds] = useState<string[]>([]);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Get next problem
  const getNextProblem = useCallback((categories: ProblemCategory[], difficulty: number, excludeIds: string[]): WordProblem | null => {
    return getRandomProblem(categories, difficulty, excludeIds);
  }, []);

  // Start game
  const startGame = useCallback((levelId?: number) => {
    const selectedLevel = levelId
      ? wordProblemLevels.find(l => l.id === levelId) || wordProblemLevels[0]
      : level;

    setLevel(selectedLevel);
    setStatus('playing');
    setStats(initialStats);
    setProblemsCompleted(0);
    setTimeRemaining(selectedLevel.timerDuration);
    setPreviousProblem(null);
    setPreviousWasCorrect(null);
    setSelectedAnswer(null);
    setUserAnswer('');
    setAttempts(0);
    setShowHint(false);
    setUsedProblemIds([]);

    const problem = getNextProblem(selectedLevel.categories, selectedLevel.difficulty, []);
    if (problem) {
      setCurrentProblem(problem);
      setUsedProblemIds([problem.id]);
    }
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
  }, [level, getNextProblem]);

  // Check answer
  const checkAnswer = useCallback((answer: string | number): boolean => {
    if (!currentProblem) return false;

    const correct = currentProblem.correctAnswer;

    // String comparison (case-insensitive, trimmed)
    if (typeof correct === 'string') {
      return String(answer).toLowerCase().trim() === correct.toLowerCase().trim();
    }

    // Number comparison
    if (typeof correct === 'number') {
      const numAnswer = typeof answer === 'string' ? parseFloat(answer) : answer;
      return !isNaN(numAnswer) && numAnswer === correct;
    }

    return false;
  }, [currentProblem]);

  // Submit answer
  const submitAnswer = useCallback((answer: string | number) => {
    if (!currentProblem || status !== 'playing') return;

    const isCorrect = checkAnswer(answer);

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
      return newStats;
    });

    // Track previous
    setPreviousProblem(currentProblem);
    setPreviousWasCorrect(isCorrect);

    if (isCorrect) {
      const newCompleted = problemsCompleted + 1;
      setProblemsCompleted(newCompleted);
      setAttempts(0);
      setShowHint(false);

      // Check win condition
      if (newCompleted >= level.problemsToWin) {
        setStatus('won');
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        return;
      }

      // Generate next problem after short delay
      setTimeout(() => {
        const nextProblem = getNextProblem(level.categories, level.difficulty, usedProblemIds);
        if (nextProblem) {
          setCurrentProblem(nextProblem);
          setUsedProblemIds(prev => [...prev, nextProblem.id]);
        }
        setSelectedAnswer(null);
        setUserAnswer('');
      }, 800);
    } else {
      // Wrong answer
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      // Show hint after configured wrong attempts
      if (newAttempts >= wordProblemsConfig.showHintsAfterWrong && level.showHints) {
        setShowHint(true);
      }

      // After max attempts, show answer and move on
      if (newAttempts >= wordProblemsConfig.maxAttempts) {
        setTimeout(() => {
          const nextProblem = getNextProblem(level.categories, level.difficulty, usedProblemIds);
          if (nextProblem) {
            setCurrentProblem(nextProblem);
            setUsedProblemIds(prev => [...prev, nextProblem.id]);
          }
          setSelectedAnswer(null);
          setUserAnswer('');
          setAttempts(0);
          setShowHint(false);
        }, 1500);
      } else {
        // Clear selection after delay
        setTimeout(() => {
          setSelectedAnswer(null);
          setUserAnswer('');
        }, 800);
      }
    }
  }, [currentProblem, status, problemsCompleted, level, attempts, usedProblemIds, checkAnswer, getNextProblem]);

  // Select option (multiple choice)
  const selectOption = useCallback((option: string | number) => {
    setSelectedAnswer(option);
    submitAnswer(option);
  }, [submitAnswer]);

  // Handle typed input
  const handleInput = useCallback((value: string) => {
    setUserAnswer(value);
  }, []);

  // Submit typed answer
  const submitTypedAnswer = useCallback(() => {
    if (userAnswer.trim()) {
      submitAnswer(userAnswer.trim());
    }
  }, [userAnswer, submitAnswer]);

  // Skip problem (no penalty but doesn't count as correct)
  const skipProblem = useCallback(() => {
    if (!currentProblem || status !== 'playing') return;

    const nextProblem = getNextProblem(level.categories, level.difficulty, usedProblemIds);
    if (nextProblem) {
      setCurrentProblem(nextProblem);
      setUsedProblemIds(prev => [...prev, nextProblem.id]);
    }
    setSelectedAnswer(null);
    setUserAnswer('');
    setAttempts(0);
    setShowHint(false);
  }, [currentProblem, status, level, usedProblemIds, getNextProblem]);

  // Request hint
  const requestHint = useCallback(() => {
    if (level.showHints) {
      setShowHint(true);
    }
  }, [level.showHints]);

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
    setProblemsCompleted(0);
    setSelectedAnswer(null);
    setUserAnswer('');
    setAttempts(0);
    setShowHint(false);
    setUsedProblemIds([]);
    setTimeRemaining(level.timerDuration);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [level]);

  // Select level
  const selectLevel = useCallback((levelId: number) => {
    const selectedLevel = wordProblemLevels.find(l => l.id === levelId);
    if (selectedLevel) {
      setLevel(selectedLevel);
    }
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
    levels: wordProblemLevels,
    currentProblem,
    previousProblem,
    previousWasCorrect,
    timeRemaining,
    stats,
    problemsCompleted,
    selectedAnswer,
    userAnswer,
    attempts,
    showHint,
    config: wordProblemsConfig,

    // Actions
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    selectLevel,
    selectOption,
    handleInput,
    submitTypedAnswer,
    skipProblem,
    requestHint,
  };
}

export default useWordProblemsState;
