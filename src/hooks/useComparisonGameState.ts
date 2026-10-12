import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ComparisonLevelConfig,
  ComparisonQuestion,
  ComparisonResult,
  comparisonLevels,
  comparisonConfig,
  generateQuestion,
} from '../config/comparisonConfig';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export interface GameStats {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  streak: number;
  bestStreak: number;
  answersPerMinute: number;
  timeElapsed: number;
}

export interface UseComparisonGameStateReturn {
  // Game state
  status: GameStatus;
  level: ComparisonLevelConfig;
  levels: ComparisonLevelConfig[];
  currentQuestion: ComparisonQuestion | null;
  previousQuestion: ComparisonQuestion | null;
  previousWasCorrect: boolean | null;
  previousUserAnswer: ComparisonResult | null;
  userAnswer: ComparisonResult | null;

  // Timer
  timeRemaining: number;

  // Stats
  stats: GameStats;
  questionsCompleted: number;

  // Hint & visualization state
  showHint: boolean;
  showVisualization: boolean;

  // Actions
  startGame: (levelId?: number) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  submitAnswer: (answer: ComparisonResult) => void;
  requestHint: () => void;
}

const initialStats: GameStats = {
  correct: 0,
  incorrect: 0,
  total: 0,
  accuracy: 100,
  streak: 0,
  bestStreak: 0,
  answersPerMinute: 0,
  timeElapsed: 0,
};

export function useComparisonGameState(): UseComparisonGameStateReturn {
  const [status, setStatus] = useState<GameStatus>('idle');
  const [level, setLevel] = useState<ComparisonLevelConfig>(comparisonLevels[0]);
  const [currentQuestion, setCurrentQuestion] = useState<ComparisonQuestion | null>(null);
  const [previousQuestion, setPreviousQuestion] = useState<ComparisonQuestion | null>(null);
  const [previousWasCorrect, setPreviousWasCorrect] = useState<boolean | null>(null);
  const [previousUserAnswer, setPreviousUserAnswer] = useState<ComparisonResult | null>(null);
  const [userAnswer, setUserAnswer] = useState<ComparisonResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(comparisonConfig.timerDuration);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [questionsCompleted, setQuestionsCompleted] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showVisualization, setShowVisualization] = useState(false);

  const timerRef = useRef<number | null>(null);
  const advanceTimeoutRef = useRef<number | null>(null);

  // Generate a new question
  const nextQuestion = useCallback(() => {
    const question = generateQuestion(level);
    setCurrentQuestion(question);
    setUserAnswer(null);
    setShowHint(false);
    setShowVisualization(false);
  }, [level]);

  // Start game
  const startGame = useCallback((levelId?: number) => {
    const selectedLevel = levelId
      ? comparisonLevels.find(l => l.id === levelId) || comparisonLevels[0]
      : level;

    setLevel(selectedLevel);
    setStatus('playing');
    setTimeRemaining(comparisonConfig.timerDuration);
    setStats(initialStats);
    setQuestionsCompleted(0);
    setPreviousQuestion(null);
    setPreviousWasCorrect(null);
    setPreviousUserAnswer(null);
    setShowHint(false);
    setShowVisualization(false);

    // Generate first question
    const question = generateQuestion(selectedLevel);
    setCurrentQuestion(question);
    setUserAnswer(null);
  }, [level]);

  // Pause game
  const pauseGame = useCallback(() => {
    if (status === 'playing') {
      setStatus('paused');
    }
  }, [status]);

  // Resume game
  const resumeGame = useCallback(() => {
    if (status === 'paused') {
      setStatus('playing');
    }
  }, [status]);

  // Reset game
  const resetGame = useCallback(() => {
    setStatus('idle');
    setCurrentQuestion(null);
    setPreviousQuestion(null);
    setPreviousWasCorrect(null);
    setPreviousUserAnswer(null);
    setUserAnswer(null);
    setTimeRemaining(comparisonConfig.timerDuration);
    setStats(initialStats);
    setQuestionsCompleted(0);
    setShowHint(false);
    setShowVisualization(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  }, []);

  // Submit answer
  const submitAnswer = useCallback((answer: ComparisonResult) => {
    if (!currentQuestion || status !== 'playing' || userAnswer !== null) return;

    const isCorrect = answer === currentQuestion.correctAnswer;
    setUserAnswer(answer);
    setPreviousWasCorrect(isCorrect);
    setPreviousUserAnswer(answer);
    setPreviousQuestion(currentQuestion);

    // Update stats
    const elapsedTime = comparisonConfig.timerDuration - timeRemaining;
    setStats(prev => {
      const newCorrect = prev.correct + (isCorrect ? 1 : 0);
      const newIncorrect = prev.incorrect + (isCorrect ? 0 : 1);
      const newTotal = prev.total + 1;
      const newStreak = isCorrect ? prev.streak + 1 : 0;
      const minutesElapsed = Math.max(elapsedTime / 60, 0.1);

      return {
        correct: newCorrect,
        incorrect: newIncorrect,
        total: newTotal,
        accuracy: Math.round((newCorrect / newTotal) * 100),
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        answersPerMinute: Math.round((newTotal / minutesElapsed) * 10) / 10,
        timeElapsed: elapsedTime,
      };
    });

    setQuestionsCompleted(prev => prev + 1);

    // Show visualization if wrong
    if (!isCorrect) {
      setShowVisualization(true);
    }

    // Check win condition
    const newQuestionsCompleted = questionsCompleted + 1;
    if (newQuestionsCompleted >= level.questionsToWin) {
      // Calculate if they won based on accuracy
      const newCorrect = stats.correct + (isCorrect ? 1 : 0);
      const accuracy = (newCorrect / newQuestionsCompleted) * 100;

      if (accuracy >= 70) {
        setStatus('won');
      } else {
        setStatus('lost');
      }
      return;
    }

    // Auto-advance to next question after delay
    advanceTimeoutRef.current = window.setTimeout(() => {
      nextQuestion();
    }, isCorrect ? comparisonConfig.autoAdvanceDelay : comparisonConfig.autoAdvanceDelay * 2);
  }, [currentQuestion, status, userAnswer, questionsCompleted, level.questionsToWin, stats.correct, nextQuestion, timeRemaining]);

  // Request hint
  const requestHint = useCallback(() => {
    if (currentQuestion && status === 'playing') {
      setShowHint(true);
    }
  }, [currentQuestion, status]);

  // Timer effect
  useEffect(() => {
    if (status === 'playing') {
      timerRef.current = window.setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setStatus('lost');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  return {
    status,
    level,
    levels: comparisonLevels,
    currentQuestion,
    previousQuestion,
    previousWasCorrect,
    previousUserAnswer,
    userAnswer,
    timeRemaining,
    stats,
    questionsCompleted,
    showHint,
    showVisualization,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    submitAnswer,
    requestHint,
  };
}
