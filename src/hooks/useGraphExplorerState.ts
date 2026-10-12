// Graph Explorer Game State Hook
import { useState, useCallback, useEffect, useRef } from 'react';
import { GraphLevelConfig, graphExplorerLevels } from '../config/algebraConfig';
import { GraphProblem, generateGraphProblem, checkGraphAnswer } from '../utils/algebraGenerator';

export type GraphGameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export interface GraphGameStats {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  timeElapsed: number;
}

const initialStats: GraphGameStats = {
  correct: 0,
  incorrect: 0,
  total: 0,
  accuracy: 0,
  timeElapsed: 0,
};

export function useGraphExplorerState() {
  const [status, setStatus] = useState<GraphGameStatus>('idle');
  const [level, setLevel] = useState<GraphLevelConfig>(graphExplorerLevels[0]);
  const [currentProblem, setCurrentProblem] = useState<GraphProblem | null>(null);
  const [previousProblem, setPreviousProblem] = useState<GraphProblem | null>(null);
  const [previousWasCorrect, setPreviousWasCorrect] = useState<boolean | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(graphExplorerLevels[0].timerDuration);
  const [stats, setStats] = useState<GraphGameStats>(initialStats);
  const [questionsCompleted, setQuestionsCompleted] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | number | null>(null);
  const [userAnswer, setUserAnswer] = useState('');

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Start game
  const startGame = useCallback((levelId?: number) => {
    const selectedLevel = levelId
      ? graphExplorerLevels.find(l => l.id === levelId) || graphExplorerLevels[0]
      : level;

    setLevel(selectedLevel);
    setStatus('playing');
    setStats(initialStats);
    setQuestionsCompleted(0);
    setTimeRemaining(selectedLevel.timerDuration);
    setPreviousProblem(null);
    setPreviousWasCorrect(null);
    setSelectedAnswer(null);
    setUserAnswer('');

    const problem = generateGraphProblem(selectedLevel);
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
  }, [level]);

  // Submit answer
  const submitAnswer = useCallback((answer: number | string) => {
    if (!currentProblem || status !== 'playing') return;

    const isCorrect = checkGraphAnswer(currentProblem, answer);

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

      // Generate next problem after short delay
      setTimeout(() => {
        const nextProblem = generateGraphProblem(level);
        setCurrentProblem(nextProblem);
        setSelectedAnswer(null);
        setUserAnswer('');
      }, 800);
    } else {
      // Wrong answer - clear selection after delay
      setTimeout(() => {
        setSelectedAnswer(null);
        setUserAnswer('');
      }, 800);
    }
  }, [currentProblem, status, questionsCompleted, level]);

  // Select option
  const selectOption = useCallback((option: string | number) => {
    setSelectedAnswer(option);
    submitAnswer(option);
  }, [submitAnswer]);

  // Handle typed input
  const handleInput = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9-]/g, '');
    setUserAnswer(cleaned);
  }, []);

  // Submit typed answer
  const submitTypedAnswer = useCallback(() => {
    if (userAnswer) {
      const numAnswer = parseInt(userAnswer, 10);
      if (!isNaN(numAnswer)) {
        submitAnswer(numAnswer);
      }
    }
  }, [userAnswer, submitAnswer]);

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
    setSelectedAnswer(null);
    setUserAnswer('');
    setTimeRemaining(level.timerDuration);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [level]);

  // Select level
  const selectLevel = useCallback((levelId: number) => {
    const selectedLevel = graphExplorerLevels.find(l => l.id === levelId);
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
    levels: graphExplorerLevels,
    currentProblem,
    previousProblem,
    previousWasCorrect,
    timeRemaining,
    stats,
    questionsCompleted,
    selectedAnswer,
    userAnswer,

    // Actions
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    selectLevel,
    selectOption,
    handleInput,
    submitTypedAnswer,
  };
}

export default useGraphExplorerState;
