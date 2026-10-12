import { useState, useEffect, useCallback, useRef } from 'react';
import {
  chartLevels,
  ChartLevelConfig,
  chartGameConfig,
} from '../config/chartGameConfig';
import {
  ChartQuestion,
  generateNewQuestion,
  checkAnswer,
} from '../data/charts/chartDataGenerator';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export interface ChartGameStats {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  questionsPerMinute: number;
  timeElapsed: number;
  streak: number;
  bestStreak: number;
  score: number;
}

export interface ChartGameState {
  status: GameStatus;
  level: ChartLevelConfig;
  levels: ChartLevelConfig[];
  currentQuestion: ChartQuestion | null;
  previousQuestion: ChartQuestion | null;
  previousWasCorrect: boolean | null;
  timeRemaining: number;
  stats: ChartGameStats;
  questionsCompleted: number;
  showingHint: boolean;
  userAnswer: string;
  feedbackMessage: string | null;
}

export function useChartGameState() {
  const [status, setStatus] = useState<GameStatus>('idle');
  const [level, setLevel] = useState<ChartLevelConfig>(chartLevels[0]);
  const [currentQuestion, setCurrentQuestion] = useState<ChartQuestion | null>(null);
  const [previousQuestion, setPreviousQuestion] = useState<ChartQuestion | null>(null);
  const [previousWasCorrect, setPreviousWasCorrect] = useState<boolean | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(chartGameConfig.timerDuration);
  const [questionsCompleted, setQuestionsCompleted] = useState(0);
  const [showingHint, setShowingHint] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0); // Track attempts for second chance
  const [stats, setStats] = useState<ChartGameStats>({
    correct: 0,
    incorrect: 0,
    total: 0,
    accuracy: 0,
    questionsPerMinute: 0,
    timeElapsed: 0,
    streak: 0,
    bestStreak: 0,
    score: 0,
  });

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastAnswerTimeRef = useRef<number>(0);
  const feedbackTimeoutRef = useRef<number | null>(null);

  // Select level
  const selectLevel = useCallback((levelId: number) => {
    const newLevel = chartLevels.find(l => l.id === levelId);
    if (newLevel) {
      setLevel(newLevel);
    }
  }, []);

  // Start game - accepts optional levelId to avoid stale closure issues
  const startGame = useCallback((levelId?: number) => {
    // Determine which level to use
    let gameLevel = level;
    if (levelId !== undefined) {
      const foundLevel = chartLevels.find(l => l.id === levelId);
      if (foundLevel) {
        gameLevel = foundLevel;
        setLevel(foundLevel);
      }
    }

    const firstQuestion = generateNewQuestion(gameLevel);

    setCurrentQuestion(firstQuestion);
    setPreviousQuestion(null);
    setPreviousWasCorrect(null);
    setQuestionsCompleted(0);
    setTimeRemaining(gameLevel.timerDuration || chartGameConfig.timerDuration);
    setShowingHint(false);
    setUserAnswer('');
    setFeedbackMessage(null);
    setAttemptCount(0);
    setStats({
      correct: 0,
      incorrect: 0,
      total: 0,
      accuracy: 0,
      questionsPerMinute: 0,
      timeElapsed: 0,
      streak: 0,
      bestStreak: 0,
      score: 0,
    });
    startTimeRef.current = Date.now();
    lastAnswerTimeRef.current = Date.now();
    setStatus('playing');
  }, [level]);

  // Pause game
  const pauseGame = useCallback(() => {
    setStatus('paused');
  }, []);

  // Resume game
  const resumeGame = useCallback(() => {
    setStatus('playing');
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    setStatus('idle');
    setCurrentQuestion(null);
    setPreviousQuestion(null);
    setPreviousWasCorrect(null);
    setQuestionsCompleted(0);
    setTimeRemaining(level.timerDuration || chartGameConfig.timerDuration);
    setShowingHint(false);
    setUserAnswer('');
    setFeedbackMessage(null);
    setAttemptCount(0);
    setStats({
      correct: 0,
      incorrect: 0,
      total: 0,
      accuracy: 0,
      questionsPerMinute: 0,
      timeElapsed: 0,
      streak: 0,
      bestStreak: 0,
      score: 0,
    });
  }, [level]);

  // Submit answer
  const submitAnswer = useCallback((answer: string | number) => {
    if (status !== 'playing' || !currentQuestion) return;

    const isCorrect = checkAnswer(currentQuestion, answer);

    const now = Date.now();
    const answerTime = now - lastAnswerTimeRef.current;
    const timeElapsed = (now - startTimeRef.current) / 1000;

    // Clear any existing feedback timeout
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    // WRONG ANSWER - First attempt: Give second chance
    if (!isCorrect && attemptCount === 0) {
      setAttemptCount(1);
      setPreviousWasCorrect(false);
      setFeedbackMessage('Not quite! Try again!');
      setShowingHint(true); // Show hint to help them
      setUserAnswer('');

      // Clear feedback after delay but keep question
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedbackMessage(null);
      }, 2000);
      return; // Don't move to next question
    }

    // Calculate score and update stats
    let pointsEarned = 0;
    let newStreak = stats.streak;
    let newBestStreak = stats.bestStreak;

    if (isCorrect) {
      lastAnswerTimeRef.current = now;

      // Reduced points if on second attempt
      pointsEarned = attemptCount > 0
        ? Math.floor(chartGameConfig.basePoints / 2)
        : chartGameConfig.basePoints;

      // Speed bonus only on first attempt
      if (attemptCount === 0 && answerTime < chartGameConfig.speedBonusThreshold) {
        pointsEarned += chartGameConfig.speedBonusPoints;
      }

      // Streak bonus
      newStreak = stats.streak + 1;
      pointsEarned += newStreak * chartGameConfig.streakBonusPoints;

      if (newStreak > newBestStreak) {
        newBestStreak = newStreak;
      }

      // Hint penalty
      if (showingHint && attemptCount === 0) {
        pointsEarned = Math.max(0, pointsEarned - chartGameConfig.hintPenalty);
      }

      setFeedbackMessage(attemptCount > 0 ? 'You got it!' : 'Correct!');
    } else {
      // Wrong on second attempt - show answer and move on
      lastAnswerTimeRef.current = now;
      newStreak = 0;
      setFeedbackMessage(`The answer was ${currentQuestion.correctAnswer}`);
    }

    const newCorrect = isCorrect ? stats.correct + 1 : stats.correct;
    const newIncorrect = isCorrect ? stats.incorrect : stats.incorrect + 1;
    const newTotal = stats.total + 1;
    const newScore = stats.score + pointsEarned;

    setStats({
      correct: newCorrect,
      incorrect: newIncorrect,
      total: newTotal,
      accuracy: newTotal > 0 ? Math.round((newCorrect / newTotal) * 100) : 0,
      questionsPerMinute: timeElapsed > 0 ? Math.round((newCorrect / timeElapsed) * 60 * 10) / 10 : 0,
      timeElapsed,
      streak: newStreak,
      bestStreak: newBestStreak,
      score: newScore,
    });

    setPreviousQuestion(currentQuestion);
    setPreviousWasCorrect(isCorrect);
    setShowingHint(false);
    setUserAnswer('');
    setAttemptCount(0); // Reset attempts for next question

    // Clear feedback after delay
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedbackMessage(null);
    }, 2500);

    if (isCorrect) {
      const newCompleted = questionsCompleted + 1;
      setQuestionsCompleted(newCompleted);

      // Check win condition
      if (newCompleted >= level.itemsToWin) {
        setStatus('won');
        return;
      }
    }

    // Generate next question
    const nextQuestion = generateNewQuestion(level);
    setCurrentQuestion(nextQuestion);
  }, [status, currentQuestion, stats, questionsCompleted, level, showingHint, attemptCount]);

  // Handle bar/element click
  const handleChartClick = useCallback((itemName: string) => {
    if (status !== 'playing' || !currentQuestion) return;

    // For click-type questions, the itemName is the answer
    if (currentQuestion.inputType === 'click') {
      submitAnswer(itemName);
    }
  }, [status, currentQuestion, submitAnswer]);

  // Show hint
  const showHint = useCallback(() => {
    if (status !== 'playing') return;
    setShowingHint(true);
  }, [status]);

  // Skip current question
  const skipQuestion = useCallback(() => {
    if (status !== 'playing' || !currentQuestion) return;

    setPreviousQuestion(currentQuestion);
    setPreviousWasCorrect(false);
    setShowingHint(false);
    setUserAnswer('');
    setAttemptCount(0);
    setFeedbackMessage(`Skipped! The answer was ${currentQuestion.correctAnswer}`);

    // Update stats
    setStats(prev => ({
      ...prev,
      incorrect: prev.incorrect + 1,
      total: prev.total + 1,
      accuracy: prev.total > 0 ? Math.round((prev.correct / (prev.total + 1)) * 100) : 0,
      streak: 0,
    }));

    // Clear feedback after delay
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedbackMessage(null);
    }, 2000);

    // Generate next question
    const nextQuestion = generateNewQuestion(level);
    setCurrentQuestion(nextQuestion);
  }, [status, currentQuestion, level]);

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
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  // Cleanup feedback timeout
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  return {
    status,
    level,
    levels: chartLevels,
    currentQuestion,
    previousQuestion,
    previousWasCorrect,
    timeRemaining,
    stats,
    questionsCompleted,
    showingHint,
    userAnswer,
    feedbackMessage,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    selectLevel,
    submitAnswer,
    handleChartClick,
    showHint,
    skipQuestion,
    setUserAnswer,
  };
}

export default useChartGameState;
