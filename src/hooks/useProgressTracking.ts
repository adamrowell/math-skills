// Hook for integrating progress tracking into game components
import { useRef, useCallback, useEffect, useState } from 'react';
import { GameMode, UserProgress } from '../types/game';
import { addScore, getProgress, AddScoreParams } from '../utils/progressStorage';

interface UseProgressTrackingOptions {
  gameMode: GameMode;
  levelId: number;
  levelName: string;
}

interface UseProgressTrackingResult {
  // State
  progress: UserProgress | null;
  hasSubmitted: boolean;

  // Actions
  submitScore: (params: {
    score: number;
    correct: number;
    total: number;
    accuracy: number;
    bestStreak: number;
    duration: number;
    isWin: boolean;
  }) => UserProgress;

  // Utility for auto-submit on game end
  submitOnGameEnd: (
    status: 'won' | 'lost' | string,
    stats: {
      score?: number;
      correct: number;
      total?: number;
      accuracy: number;
      streak?: number;
      bestStreak?: number;
    },
    duration: number
  ) => void;

  // Reset for new game
  resetSubmission: () => void;
}

export function useProgressTracking({
  gameMode,
  levelId,
  levelName,
}: UseProgressTrackingOptions): UseProgressTrackingResult {
  const hasSubmittedRef = useRef(false);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Load initial progress
  useEffect(() => {
    setProgress(getProgress());
  }, []);

  const submitScore = useCallback((params: {
    score: number;
    correct: number;
    total: number;
    accuracy: number;
    bestStreak: number;
    duration: number;
    isWin: boolean;
  }): UserProgress => {
    const scoreParams: AddScoreParams = {
      gameMode,
      levelId,
      levelName,
      ...params,
    };

    const updatedProgress = addScore(scoreParams);
    setProgress(updatedProgress);
    hasSubmittedRef.current = true;
    setHasSubmitted(true);
    return updatedProgress;
  }, [gameMode, levelId, levelName]);

  const submitOnGameEnd = useCallback((
    status: 'won' | 'lost' | string,
    stats: {
      score?: number;
      correct: number;
      total?: number;
      accuracy: number;
      streak?: number;
      bestStreak?: number;
    },
    duration: number
  ) => {
    if (hasSubmittedRef.current) return;
    if (status !== 'won' && status !== 'lost') return;

    const total = stats.total ?? stats.correct;
    const score = stats.score ?? stats.correct * 100;
    const bestStreak = stats.bestStreak ?? stats.streak ?? 0;

    submitScore({
      score,
      correct: stats.correct,
      total,
      accuracy: stats.accuracy,
      bestStreak,
      duration,
      isWin: status === 'won',
    });
  }, [submitScore]);

  const resetSubmission = useCallback(() => {
    hasSubmittedRef.current = false;
    setHasSubmitted(false);
  }, []);

  return {
    progress,
    hasSubmitted,
    submitScore,
    submitOnGameEnd,
    resetSubmission,
  };
}

export default useProgressTracking;
