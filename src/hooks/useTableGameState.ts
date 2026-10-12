import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  tableConfig,
  tableLevels,
  TableLevelConfig,
  TableGameMode,
  HideMode,
  PatternType,
  TableQuestion,
  generateTableQuestion,
} from '../config/tableGameConfig';

export type TableGameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export interface TableGameStats {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  answersPerMinute: number;
  timeElapsed: number;
}

const initialStats: TableGameStats = {
  correct: 0,
  incorrect: 0,
  total: 0,
  accuracy: 100,
  answersPerMinute: 0,
  timeElapsed: 0,
};

export function useTableGameState() {
  const [status, setStatus] = useState<TableGameStatus>('idle');
  const [level, setLevel] = useState<TableLevelConfig>(tableLevels[1]); // Default to Easy Practice
  const [mode, setMode] = useState<TableGameMode>('practice-mult');
  const [hideMode, setHideMode] = useState<HideMode>('none');
  const [currentQuestion, setCurrentQuestion] = useState<TableQuestion | null>(null);
  const [previousWasCorrect, setPreviousWasCorrect] = useState<boolean | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(tableConfig.timerDuration);
  const [stats, setStats] = useState<TableGameStats>(initialStats);
  const [questionsCompleted, setQuestionsCompleted] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [activePattern, setActivePattern] = useState<PatternType>(null);
  const [patternNumber, setPatternNumber] = useState(1);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Calculate hidden cells based on mode and current question
  const hiddenCells = useMemo(() => {
    const cells = new Set<string>();

    if (hideMode === 'none' || !currentQuestion) {
      return cells;
    }

    const { row, col } = currentQuestion;

    if (hideMode === 'answer') {
      cells.add(`${row}-${col}`);
    } else if (hideMode === 'row-col') {
      // Hide the entire row and column
      for (let i = 1; i <= tableConfig.gridSize; i++) {
        cells.add(`${row}-${i}`);
        cells.add(`${i}-${col}`);
      }
    } else if (hideMode === 'all') {
      // Hide all cells
      for (let r = 1; r <= tableConfig.gridSize; r++) {
        for (let c = 1; c <= tableConfig.gridSize; c++) {
          cells.add(`${r}-${c}`);
        }
      }
    }

    return cells;
  }, [hideMode, currentQuestion]);

  // Update stats
  const updateStats = useCallback((correct: boolean) => {
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
  }, []);

  // Generate a new question
  const generateQuestion = useCallback(() => {
    const question = generateTableQuestion(mode, currentQuestion);
    setCurrentQuestion(question);
    setUserAnswer('');
  }, [mode, currentQuestion]);

  // Submit answer
  const submitAnswer = useCallback(
    (answer: number) => {
      if (!currentQuestion || status !== 'playing') return;

      const isCorrect = answer === currentQuestion.answer;
      setPreviousWasCorrect(isCorrect);
      updateStats(isCorrect);

      if (isCorrect) {
        setQuestionsCompleted((prev) => {
          const newCount = prev + 1;
          // Check win condition
          if (level.questionsToWin > 0 && newCount >= level.questionsToWin) {
            setStatus('won');
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
          return newCount;
        });
      }

      generateQuestion();
    },
    [currentQuestion, status, level.questionsToWin, updateStats, generateQuestion]
  );

  // Start game
  const startGame = useCallback((levelId?: number) => {
    let gameLevel = level;
    if (levelId !== undefined) {
      const foundLevel = tableLevels.find((l) => l.id === levelId);
      if (foundLevel) {
        gameLevel = foundLevel;
        setLevel(foundLevel);
        setMode(foundLevel.mode);
        setHideMode(foundLevel.hideMode);
      }
    }

    // For learn mode, just set status to playing without timer
    if (gameLevel.mode === 'learn') {
      setStatus('playing');
      setStats(initialStats);
      setQuestionsCompleted(0);
      setPreviousWasCorrect(null);
      setUserAnswer('');
      setCurrentQuestion(null);
      startTimeRef.current = null;
      return;
    }

    setStatus('playing');
    setTimeRemaining(tableConfig.timerDuration);
    setStats(initialStats);
    setQuestionsCompleted(0);
    setPreviousWasCorrect(null);
    setUserAnswer('');

    // Generate initial question
    const question = generateTableQuestion(gameLevel.mode);
    setCurrentQuestion(question);

    startTimeRef.current = Date.now();

    // Start timer if enabled
    if (gameLevel.timerEnabled) {
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
    if (status === 'paused' && level.timerEnabled) {
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
    } else if (status === 'paused') {
      setStatus('playing');
    }
  }, [status, level.timerEnabled]);

  // Reset game
  const resetGame = useCallback(() => {
    setStatus('idle');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeRemaining(tableConfig.timerDuration);
    setStats(initialStats);
    setQuestionsCompleted(0);
    setCurrentQuestion(null);
    setPreviousWasCorrect(null);
    setUserAnswer('');
    startTimeRef.current = null;
    setActivePattern(null);
  }, []);

  // Handle user input
  const handleInput = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setUserAnswer(cleaned);
  }, []);

  // Clear input
  const clearInput = useCallback(() => {
    setUserAnswer('');
  }, []);

  // Set pattern for learn mode
  const setPattern = useCallback((pattern: PatternType, number?: number) => {
    setActivePattern(pattern);
    if (number !== undefined) {
      setPatternNumber(number);
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
    mode,
    hideMode,
    currentQuestion,
    previousWasCorrect,
    timeRemaining,
    stats,
    questionsCompleted,
    userAnswer,
    hiddenCells,
    activePattern,
    patternNumber,
    levels: tableLevels,
    config: tableConfig,

    // Actions
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    submitAnswer,
    handleInput,
    clearInput,
    setMode,
    setHideMode,
    setPattern,
  };
}
