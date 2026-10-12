// Centralized Progress Storage System
// Uses localStorage to persist progress across all game modes

import {
  GameMode,
  GameScore,
  LevelCompletion,
  GameModeProgress,
  UserProgress,
  ACHIEVEMENTS,
  generateScoreId,
  getDateString,
} from '../types/game';

const STORAGE_KEY = 'learning_skills_progress';
const STORAGE_VERSION = 1;

// ============================================================================
// Default Data
// ============================================================================

function getDefaultLevelCompletion(): LevelCompletion {
  return {
    completed: false,
    bestScore: 0,
    bestAccuracy: 0,
    bestTime: Infinity,
    attempts: 0,
    wins: 0,
    firstCompletedAt: null,
    lastPlayedAt: 0,
  };
}

function getDefaultGameModeProgress(): GameModeProgress {
  return {
    levelsCompleted: 0,
    totalLevels: 0,
    totalGamesPlayed: 0,
    totalCorrect: 0,
    totalAttempts: 0,
    bestOverallAccuracy: 0,
    totalTimeSpent: 0,
    levelCompletions: {},
  };
}

function getDefaultProgress(): UserProgress {
  const gameModes: Record<GameMode, GameModeProgress> = {
    math: getDefaultGameModeProgress(),
    reading: getDefaultGameModeProgress(),
    geography: getDefaultGameModeProgress(),
    charts: getDefaultGameModeProgress(),
    comparison: getDefaultGameModeProgress(),
    tables: getDefaultGameModeProgress(),
    algebra: getDefaultGameModeProgress(),
    graphExplorer: getDefaultGameModeProgress(),
    wordProblems: getDefaultGameModeProgress(),
    arcade: getDefaultGameModeProgress(),
  };

  return {
    gameModes,
    recentScores: [],
    totalGamesPlayed: 0,
    totalCorrect: 0,
    totalAttempts: 0,
    totalTimeSpent: 0,
    achievements: [],
    lastPlayedDate: '',
    currentStreakDays: 0,
    bestStreakDays: 0,
    version: STORAGE_VERSION,
  };
}

// ============================================================================
// Core Storage Functions
// ============================================================================

export function loadProgress(): UserProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate or ensure all fields exist
      const progress = migrateProgress(parsed);
      return progress;
    }
  } catch (error) {
    console.warn('Failed to load progress:', error);
  }
  return getDefaultProgress();
}

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn('Failed to save progress:', error);
  }
}

function migrateProgress(parsed: any): UserProgress {
  const defaultProgress = getDefaultProgress();

  // Ensure all game modes exist
  const gameModes: Record<GameMode, GameModeProgress> = {
    math: { ...getDefaultGameModeProgress(), ...parsed.gameModes?.math },
    reading: { ...getDefaultGameModeProgress(), ...parsed.gameModes?.reading },
    geography: { ...getDefaultGameModeProgress(), ...parsed.gameModes?.geography },
    charts: { ...getDefaultGameModeProgress(), ...parsed.gameModes?.charts },
    comparison: { ...getDefaultGameModeProgress(), ...parsed.gameModes?.comparison },
    tables: { ...getDefaultGameModeProgress(), ...parsed.gameModes?.tables },
    algebra: { ...getDefaultGameModeProgress(), ...parsed.gameModes?.algebra },
    graphExplorer: { ...getDefaultGameModeProgress(), ...parsed.gameModes?.graphExplorer },
    wordProblems: { ...getDefaultGameModeProgress(), ...parsed.gameModes?.wordProblems },
    arcade: { ...getDefaultGameModeProgress(), ...parsed.gameModes?.arcade },
  };

  return {
    ...defaultProgress,
    ...parsed,
    gameModes,
    version: STORAGE_VERSION,
  };
}

// ============================================================================
// Score Management
// ============================================================================

export interface AddScoreParams {
  gameMode: GameMode;
  levelId: number;
  levelName: string;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  bestStreak: number;
  duration: number;
  isWin: boolean;
}

export function addScore(params: AddScoreParams): UserProgress {
  const progress = loadProgress();
  const { gameMode, levelId, isWin, correct, total, accuracy, duration, score, bestStreak } = params;

  // Create score record
  const newScore: GameScore = {
    id: generateScoreId(),
    gameMode,
    levelId,
    levelName: params.levelName,
    score,
    correct,
    total,
    accuracy,
    bestStreak,
    timestamp: Date.now(),
    duration,
    isWin,
  };

  // Add to recent scores (keep last 50)
  progress.recentScores.unshift(newScore);
  if (progress.recentScores.length > 50) {
    progress.recentScores = progress.recentScores.slice(0, 50);
  }

  // Update global totals
  progress.totalGamesPlayed += 1;
  progress.totalCorrect += correct;
  progress.totalAttempts += total;
  progress.totalTimeSpent += duration;

  // Update game mode progress
  const modeProgress = progress.gameModes[gameMode];
  modeProgress.totalGamesPlayed += 1;
  modeProgress.totalCorrect += correct;
  modeProgress.totalAttempts += total;
  modeProgress.totalTimeSpent += duration;

  if (accuracy > modeProgress.bestOverallAccuracy) {
    modeProgress.bestOverallAccuracy = accuracy;
  }

  // Update level completion
  if (!modeProgress.levelCompletions[levelId]) {
    modeProgress.levelCompletions[levelId] = getDefaultLevelCompletion();
  }

  const levelCompletion = modeProgress.levelCompletions[levelId];
  levelCompletion.attempts += 1;
  levelCompletion.lastPlayedAt = Date.now();

  if (isWin) {
    levelCompletion.wins += 1;

    if (!levelCompletion.completed) {
      levelCompletion.completed = true;
      levelCompletion.firstCompletedAt = Date.now();
      modeProgress.levelsCompleted += 1;
    }

    // Update best scores
    if (score > levelCompletion.bestScore) {
      levelCompletion.bestScore = score;
    }
    if (accuracy > levelCompletion.bestAccuracy) {
      levelCompletion.bestAccuracy = accuracy;
    }
    if (duration < levelCompletion.bestTime) {
      levelCompletion.bestTime = duration;
    }
  }

  // Update streak
  updateStreak(progress);

  // Check for new achievements
  checkAchievements(progress);

  saveProgress(progress);
  return progress;
}

// ============================================================================
// Streak Management
// ============================================================================

function updateStreak(progress: UserProgress): void {
  const today = getDateString();
  const lastDate = progress.lastPlayedDate;

  if (lastDate) {
    const lastDateObj = new Date(lastDate);
    const todayObj = new Date(today);
    const diffTime = todayObj.getTime() - lastDateObj.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day
      progress.currentStreakDays += 1;
    } else if (diffDays > 1) {
      // Streak broken
      progress.currentStreakDays = 1;
    }
    // If same day (diffDays === 0), don't change streak
  } else {
    // First time playing
    progress.currentStreakDays = 1;
  }

  // Update best streak
  if (progress.currentStreakDays > progress.bestStreakDays) {
    progress.bestStreakDays = progress.currentStreakDays;
  }

  progress.lastPlayedDate = today;
}

// ============================================================================
// Achievement Checking
// ============================================================================

function checkAchievements(progress: UserProgress): string[] {
  const newAchievements: string[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (!progress.achievements.includes(achievement.id)) {
      try {
        if (achievement.requirement(progress)) {
          newAchievements.push(achievement.id);
          progress.achievements.push(achievement.id);
        }
      } catch {
        // Skip achievement if requirement check fails
      }
    }
  }

  return newAchievements;
}

// ============================================================================
// Query Functions
// ============================================================================

export function getProgress(): UserProgress {
  return loadProgress();
}

export function getGameModeProgress(gameMode: GameMode): GameModeProgress {
  const progress = loadProgress();
  return progress.gameModes[gameMode];
}

export function getLevelCompletion(gameMode: GameMode, levelId: number): LevelCompletion {
  const progress = loadProgress();
  return progress.gameModes[gameMode].levelCompletions[levelId] || getDefaultLevelCompletion();
}

export function isLevelCompleted(gameMode: GameMode, levelId: number): boolean {
  const completion = getLevelCompletion(gameMode, levelId);
  return completion.completed;
}

export function getCompletedLevelIds(gameMode: GameMode): number[] {
  const progress = loadProgress();
  const modeProgress = progress.gameModes[gameMode];
  return Object.entries(modeProgress.levelCompletions)
    .filter(([, completion]) => completion.completed)
    .map(([id]) => parseInt(id, 10));
}

export function getLevelBestScore(gameMode: GameMode, levelId: number): number {
  const completion = getLevelCompletion(gameMode, levelId);
  return completion.bestScore;
}

export function getLevelAttempts(gameMode: GameMode, levelId: number): number {
  const completion = getLevelCompletion(gameMode, levelId);
  return completion.attempts;
}

export function getRecentScores(limit: number = 10, gameMode?: GameMode): GameScore[] {
  const progress = loadProgress();
  let scores = progress.recentScores;

  if (gameMode) {
    scores = scores.filter(s => s.gameMode === gameMode);
  }

  return scores.slice(0, limit);
}

export function getHighScores(gameMode: GameMode, levelId?: number, limit: number = 10): GameScore[] {
  const progress = loadProgress();
  let scores = progress.recentScores.filter(s => s.gameMode === gameMode);

  if (levelId !== undefined) {
    scores = scores.filter(s => s.levelId === levelId);
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, limit);
}

export function getOverallStats() {
  const progress = loadProgress();

  return {
    totalGamesPlayed: progress.totalGamesPlayed,
    totalCorrect: progress.totalCorrect,
    totalAttempts: progress.totalAttempts,
    overallAccuracy: progress.totalAttempts > 0
      ? Math.round((progress.totalCorrect / progress.totalAttempts) * 100)
      : 0,
    totalTimeSpent: progress.totalTimeSpent,
    currentStreak: progress.currentStreakDays,
    bestStreak: progress.bestStreakDays,
    achievementCount: progress.achievements.length,
    totalAchievements: ACHIEVEMENTS.length,
  };
}

export function getGameModeStats(gameMode: GameMode) {
  const modeProgress = getGameModeProgress(gameMode);

  return {
    levelsCompleted: modeProgress.levelsCompleted,
    totalGamesPlayed: modeProgress.totalGamesPlayed,
    totalCorrect: modeProgress.totalCorrect,
    totalAttempts: modeProgress.totalAttempts,
    accuracy: modeProgress.totalAttempts > 0
      ? Math.round((modeProgress.totalCorrect / modeProgress.totalAttempts) * 100)
      : 0,
    totalTimeSpent: modeProgress.totalTimeSpent,
    bestAccuracy: modeProgress.bestOverallAccuracy,
  };
}

// ============================================================================
// Achievement Functions
// ============================================================================

export function getEarnedAchievements() {
  const progress = loadProgress();
  return ACHIEVEMENTS.filter(a => progress.achievements.includes(a.id));
}

export function getAllAchievementsWithStatus() {
  const progress = loadProgress();
  return ACHIEVEMENTS.map(a => ({
    ...a,
    earned: progress.achievements.includes(a.id),
  }));
}

export function hasAchievement(achievementId: string): boolean {
  const progress = loadProgress();
  return progress.achievements.includes(achievementId);
}

// ============================================================================
// Utility Functions
// ============================================================================

export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear progress:', error);
  }
}

export function exportProgress(): string {
  const progress = loadProgress();
  return JSON.stringify(progress, null, 2);
}

export function importProgress(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    const progress = migrateProgress(parsed);
    saveProgress(progress);
    return true;
  } catch (error) {
    console.warn('Failed to import progress:', error);
    return false;
  }
}

// ============================================================================
// React Hook Helper
// ============================================================================

// This can be used to create a React hook for progress
export function subscribeToProgress(callback: (progress: UserProgress) => void): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      callback(loadProgress());
    }
  };

  window.addEventListener('storage', handleStorageChange);

  return () => {
    window.removeEventListener('storage', handleStorageChange);
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  loadProgress,
  saveProgress,
  addScore,
  getProgress,
  getGameModeProgress,
  getLevelCompletion,
  isLevelCompleted,
  getCompletedLevelIds,
  getLevelBestScore,
  getLevelAttempts,
  getRecentScores,
  getHighScores,
  getOverallStats,
  getGameModeStats,
  getEarnedAchievements,
  getAllAchievementsWithStatus,
  hasAchievement,
  clearProgress,
  exportProgress,
  importProgress,
  subscribeToProgress,
};
