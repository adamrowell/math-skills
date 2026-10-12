// Geography Game Storage Utility
// Uses localStorage for persistent score tracking

import { GeographyCategory, GeographyGameMode } from '../config/geographyConfig';

export interface GeographyScore {
  id: string;
  gameMode: GeographyGameMode;
  category: GeographyCategory;
  levelId: number;
  levelName: string;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  bestStreak: number;
  timestamp: number;
  duration: number; // in seconds
}

export interface GeographyProgress {
  highScores: GeographyScore[];
  totalGamesPlayed: number;
  totalCorrect: number;
  totalAttempts: number;
  masteredLocations: string[];
  achievements: string[];
  lastPlayed: number;
  streakDays: number;
  lastStreakDate: string;
}

const STORAGE_KEY = 'geography_progress';

// Initialize default progress
function getDefaultProgress(): GeographyProgress {
  return {
    highScores: [],
    totalGamesPlayed: 0,
    totalCorrect: 0,
    totalAttempts: 0,
    masteredLocations: [],
    achievements: [],
    lastPlayed: 0,
    streakDays: 0,
    lastStreakDate: '',
  };
}

// Load progress from localStorage
export function loadProgress(): GeographyProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure all fields exist (migration support)
      return { ...getDefaultProgress(), ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load geography progress:', error);
  }
  return getDefaultProgress();
}

// Save progress to localStorage
export function saveProgress(progress: GeographyProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn('Failed to save geography progress:', error);
  }
}

// Generate a unique ID for a score
function generateScoreId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Add a new game score
export function addScore(score: Omit<GeographyScore, 'id'>): GeographyProgress {
  const progress = loadProgress();
  const newScore: GeographyScore = {
    ...score,
    id: generateScoreId(),
  };

  // Add to high scores
  progress.highScores.push(newScore);

  // Sort by score (descending) and keep top 100
  progress.highScores.sort((a, b) => b.score - a.score);
  if (progress.highScores.length > 100) {
    progress.highScores = progress.highScores.slice(0, 100);
  }

  // Update totals
  progress.totalGamesPlayed += 1;
  progress.totalCorrect += score.correct;
  progress.totalAttempts += score.total;
  progress.lastPlayed = Date.now();

  // Update streak
  const today = new Date().toISOString().split('T')[0];
  const lastDate = progress.lastStreakDate;

  if (lastDate) {
    const lastDateObj = new Date(lastDate);
    const todayObj = new Date(today);
    const diffDays = Math.floor((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      progress.streakDays += 1;
    } else if (diffDays > 1) {
      progress.streakDays = 1;
    }
  } else {
    progress.streakDays = 1;
  }
  progress.lastStreakDate = today;

  // Check for achievements
  checkAndAddAchievements(progress, score);

  saveProgress(progress);
  return progress;
}

// Get high scores for a specific category and mode
export function getHighScores(
  category?: GeographyCategory,
  gameMode?: GeographyGameMode,
  limit: number = 10
): GeographyScore[] {
  const progress = loadProgress();
  let scores = progress.highScores;

  if (category) {
    scores = scores.filter(s => s.category === category);
  }
  if (gameMode) {
    scores = scores.filter(s => s.gameMode === gameMode);
  }

  return scores.slice(0, limit);
}

// Get best score for a specific level
export function getBestScore(levelId: number): GeographyScore | null {
  const progress = loadProgress();
  const levelScores = progress.highScores.filter(s => s.levelId === levelId);
  return levelScores.length > 0 ? levelScores[0] : null;
}

// Get overall statistics
export function getStatistics() {
  const progress = loadProgress();
  const overallAccuracy = progress.totalAttempts > 0
    ? Math.round((progress.totalCorrect / progress.totalAttempts) * 100)
    : 0;

  return {
    totalGamesPlayed: progress.totalGamesPlayed,
    totalCorrect: progress.totalCorrect,
    totalAttempts: progress.totalAttempts,
    overallAccuracy,
    achievementCount: progress.achievements.length,
    streakDays: progress.streakDays,
    highestScore: progress.highScores.length > 0 ? progress.highScores[0].score : 0,
    masteredCount: progress.masteredLocations.length,
  };
}

// Mark a location as mastered (answered correctly multiple times)
export function markAsMastered(locationId: string): void {
  const progress = loadProgress();
  if (!progress.masteredLocations.includes(locationId)) {
    progress.masteredLocations.push(locationId);
    saveProgress(progress);
  }
}

// Achievement definitions
const ACHIEVEMENTS = {
  'first-game': { name: 'Explorer', description: 'Complete your first geography game!' },
  'perfect-10': { name: 'Perfect 10', description: 'Get 10 answers correct in a row!' },
  'perfect-round': { name: 'Flawless', description: 'Complete a round with 100% accuracy!' },
  'speed-demon': { name: 'Speed Demon', description: 'Answer 10 questions in under 30 seconds!' },
  '10-games': { name: 'Getting Started', description: 'Play 10 geography games!' },
  '50-games': { name: 'Geography Enthusiast', description: 'Play 50 geography games!' },
  '100-games': { name: 'Geography Master', description: 'Play 100 geography games!' },
  'all-states': { name: 'United We Stand', description: 'Correctly identify all 50 US states!' },
  'world-traveler': { name: 'World Traveler', description: 'Play every continent category!' },
  'high-scorer': { name: 'High Scorer', description: 'Score over 5000 points in a single game!' },
  'super-scorer': { name: 'Super Scorer', description: 'Score over 10000 points in a single game!' },
  '7-day-streak': { name: 'Week Warrior', description: 'Play for 7 days in a row!' },
  '30-day-streak': { name: 'Monthly Champion', description: 'Play for 30 days in a row!' },
};

// Check and add achievements
function checkAndAddAchievements(
  progress: GeographyProgress,
  score: Omit<GeographyScore, 'id'>
): void {
  const newAchievements: string[] = [];

  // First game
  if (progress.totalGamesPlayed === 1 && !progress.achievements.includes('first-game')) {
    newAchievements.push('first-game');
  }

  // Perfect streak of 10
  if (score.bestStreak >= 10 && !progress.achievements.includes('perfect-10')) {
    newAchievements.push('perfect-10');
  }

  // Perfect round (100% accuracy)
  if (score.accuracy === 100 && score.total >= 10 && !progress.achievements.includes('perfect-round')) {
    newAchievements.push('perfect-round');
  }

  // Game count achievements
  if (progress.totalGamesPlayed >= 10 && !progress.achievements.includes('10-games')) {
    newAchievements.push('10-games');
  }
  if (progress.totalGamesPlayed >= 50 && !progress.achievements.includes('50-games')) {
    newAchievements.push('50-games');
  }
  if (progress.totalGamesPlayed >= 100 && !progress.achievements.includes('100-games')) {
    newAchievements.push('100-games');
  }

  // High score achievements
  if (score.score >= 5000 && !progress.achievements.includes('high-scorer')) {
    newAchievements.push('high-scorer');
  }
  if (score.score >= 10000 && !progress.achievements.includes('super-scorer')) {
    newAchievements.push('super-scorer');
  }

  // Streak achievements
  if (progress.streakDays >= 7 && !progress.achievements.includes('7-day-streak')) {
    newAchievements.push('7-day-streak');
  }
  if (progress.streakDays >= 30 && !progress.achievements.includes('30-day-streak')) {
    newAchievements.push('30-day-streak');
  }

  // Add new achievements
  progress.achievements.push(...newAchievements);
}

// Get achievement info
export function getAchievementInfo(achievementId: string): { name: string; description: string } | null {
  return ACHIEVEMENTS[achievementId as keyof typeof ACHIEVEMENTS] || null;
}

// Get all achievements (earned and unearned)
export function getAllAchievements(): Array<{
  id: string;
  name: string;
  description: string;
  earned: boolean;
}> {
  const progress = loadProgress();
  return Object.entries(ACHIEVEMENTS).map(([id, info]) => ({
    id,
    ...info,
    earned: progress.achievements.includes(id),
  }));
}

// Clear all progress (for testing or reset)
export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear geography progress:', error);
  }
}

export default {
  loadProgress,
  saveProgress,
  addScore,
  getHighScores,
  getBestScore,
  getStatistics,
  markAsMastered,
  getAchievementInfo,
  getAllAchievements,
  clearProgress,
};
