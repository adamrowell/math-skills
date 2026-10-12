// Unified Game Types
// Central type definitions for consistent interfaces across all game modes

// ============================================================================
// Game Modes
// ============================================================================

export type GameMode = 'math' | 'reading' | 'geography' | 'charts' | 'comparison' | 'tables' | 'algebra' | 'graphExplorer' | 'wordProblems' | 'arcade';

export const GAME_MODE_CONFIG: Record<GameMode, {
  name: string;
  emoji: string;
  color: string;
  description: string;
}> = {
  math: {
    name: 'Math Skills',
    emoji: '🔢',
    color: '#667eea',
    description: 'Arithmetic practice',
  },
  reading: {
    name: 'Reading Skills',
    emoji: '📖',
    color: '#4CAF50',
    description: 'Word reading practice',
  },
  geography: {
    name: 'Geography Skills',
    emoji: '🌍',
    color: '#FF9800',
    description: 'Learn locations',
  },
  charts: {
    name: 'Chart Skills',
    emoji: '📊',
    color: '#2196F3',
    description: 'Read charts and graphs',
  },
  comparison: {
    name: 'Compare Numbers',
    emoji: '⚖️',
    color: '#9C27B0',
    description: 'Compare values',
  },
  tables: {
    name: 'Times Tables',
    emoji: '✖️',
    color: '#E91E63',
    description: 'Multiplication practice',
  },
  algebra: {
    name: 'Algebra',
    emoji: '🔢',
    color: '#667eea',
    description: 'Equations and solving for x',
  },
  graphExplorer: {
    name: 'Graph Explorer',
    emoji: '📈',
    color: '#2196F3',
    description: 'Learn about lines and graphs',
  },
  wordProblems: {
    name: 'Word Problems',
    emoji: '📝',
    color: '#4CAF50',
    description: 'Reading comprehension puzzles',
  },
  arcade: {
    name: 'Arcade Games',
    emoji: '🕹️',
    color: '#E91E63',
    description: 'Fun educational arcade games',
  },
};

// ============================================================================
// Game Status
// ============================================================================

export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

// ============================================================================
// Base Interfaces
// ============================================================================

export interface BaseGameStats {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  streak: number;
  bestStreak: number;
  startTime: number | null;
  endTime: number | null;
}

export interface BaseLevelConfig {
  id: number;
  name: string;
  description: string;
  emoji: string;
  color: string;
}

export interface GenericLevelConfig extends BaseLevelConfig {
  // Optional meta items for display in level select
  metaItems?: { label: string; value: string | number }[];
  // For progress tracking
  questionsToWin?: number;
  targetPerMinute?: number;
}

// ============================================================================
// Progress Tracking
// ============================================================================

export interface GameScore {
  id: string;
  gameMode: GameMode;
  levelId: number;
  levelName: string;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  bestStreak: number;
  timestamp: number;
  duration: number; // in seconds
  isWin: boolean;
}

export interface LevelCompletion {
  completed: boolean;
  bestScore: number;
  bestAccuracy: number;
  bestTime: number; // fastest completion in seconds
  attempts: number;
  wins: number;
  firstCompletedAt: number | null;
  lastPlayedAt: number;
}

export interface GameModeProgress {
  levelsCompleted: number;
  totalLevels: number;
  totalGamesPlayed: number;
  totalCorrect: number;
  totalAttempts: number;
  bestOverallAccuracy: number;
  totalTimeSpent: number; // in seconds
  levelCompletions: Record<number, LevelCompletion>;
}

export interface UserProgress {
  // Per-game mode progress
  gameModes: Record<GameMode, GameModeProgress>;

  // Recent scores (last 50)
  recentScores: GameScore[];

  // Aggregate stats
  totalGamesPlayed: number;
  totalCorrect: number;
  totalAttempts: number;
  totalTimeSpent: number;

  // Achievements
  achievements: string[];

  // Streaks
  lastPlayedDate: string; // YYYY-MM-DD
  currentStreakDays: number;
  bestStreakDays: number;

  // Version for migrations
  version: number;
}

// ============================================================================
// Achievement System
// ============================================================================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: 'global' | GameMode;
  requirement: (progress: UserProgress) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Global achievements
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Complete your first game!',
    emoji: '🎯',
    category: 'global',
    requirement: (p) => p.totalGamesPlayed >= 1,
  },
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Complete 10 games!',
    emoji: '🚀',
    category: 'global',
    requirement: (p) => p.totalGamesPlayed >= 10,
  },
  {
    id: 'dedicated-learner',
    name: 'Dedicated Learner',
    description: 'Complete 50 games!',
    emoji: '📚',
    category: 'global',
    requirement: (p) => p.totalGamesPlayed >= 50,
  },
  {
    id: 'well-rounded',
    name: 'Well Rounded',
    description: 'Complete a level in every game mode!',
    emoji: '🌟',
    category: 'global',
    requirement: (p) => {
      const modes: GameMode[] = ['math', 'reading', 'geography', 'charts', 'comparison', 'tables', 'algebra', 'graphExplorer', 'wordProblems'];
      return modes.every(mode => p.gameModes[mode]?.levelsCompleted > 0);
    },
  },
  {
    id: 'daily-learner',
    name: 'Daily Learner',
    description: 'Play for 7 days in a row!',
    emoji: '📅',
    category: 'global',
    requirement: (p) => p.currentStreakDays >= 7,
  },
  {
    id: 'streak-master',
    name: 'Streak Master',
    description: 'Play for 30 days in a row!',
    emoji: '🔥',
    category: 'global',
    requirement: (p) => p.bestStreakDays >= 30,
  },
  {
    id: 'perfect-accuracy',
    name: 'Perfect!',
    description: 'Complete a game with 100% accuracy!',
    emoji: '💯',
    category: 'global',
    requirement: (p) => p.recentScores.some(s => s.accuracy === 100 && s.isWin),
  },

  // Math achievements
  {
    id: 'math-whiz',
    name: 'Math Whiz',
    description: 'Complete all math levels!',
    emoji: '🧮',
    category: 'math',
    requirement: (p) => p.gameModes.math?.levelsCompleted >= 6,
  },
  {
    id: 'math-100',
    name: 'Math Century',
    description: 'Answer 100 math problems correctly!',
    emoji: '💯',
    category: 'math',
    requirement: (p) => p.gameModes.math?.totalCorrect >= 100,
  },

  // Reading achievements
  {
    id: 'bookworm',
    name: 'Bookworm',
    description: 'Read 100 words correctly!',
    emoji: '📖',
    category: 'reading',
    requirement: (p) => p.gameModes.reading?.totalCorrect >= 100,
  },
  {
    id: 'super-reader',
    name: 'Super Reader',
    description: 'Read 500 words correctly!',
    emoji: '🦸',
    category: 'reading',
    requirement: (p) => p.gameModes.reading?.totalCorrect >= 500,
  },

  // Geography achievements
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Identify 50 locations correctly!',
    emoji: '🗺️',
    category: 'geography',
    requirement: (p) => p.gameModes.geography?.totalCorrect >= 50,
  },
  {
    id: 'world-traveler',
    name: 'World Traveler',
    description: 'Complete all geography levels!',
    emoji: '✈️',
    category: 'geography',
    requirement: (p) => p.gameModes.geography?.levelsCompleted >= 4,
  },

  // Charts achievements
  {
    id: 'data-reader',
    name: 'Data Reader',
    description: 'Answer 50 chart questions correctly!',
    emoji: '📊',
    category: 'charts',
    requirement: (p) => p.gameModes.charts?.totalCorrect >= 50,
  },
  {
    id: 'data-scientist',
    name: 'Data Scientist',
    description: 'Answer 200 chart questions correctly!',
    emoji: '🔬',
    category: 'charts',
    requirement: (p) => p.gameModes.charts?.totalCorrect >= 200,
  },

  // Comparison achievements
  {
    id: 'quick-compare',
    name: 'Quick Compare',
    description: 'Complete 25 comparisons correctly!',
    emoji: '⚖️',
    category: 'comparison',
    requirement: (p) => p.gameModes.comparison?.totalCorrect >= 25,
  },

  // Tables achievements
  {
    id: 'times-tables-pro',
    name: 'Times Tables Pro',
    description: 'Complete all times tables levels!',
    emoji: '✖️',
    category: 'tables',
    requirement: (p) => p.gameModes.tables?.levelsCompleted >= 12,
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

export function generateScoreId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}
