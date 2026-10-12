// Game Configuration
// All configurable values are centralized here for easy adjustment

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  targetCorrectPerMinute: number;
  addition: { min: number; max: number };
  subtraction: { minuendMax: number };
  multiplication: { min: number; max: number };
  division: { dividendMax: number };
  puzzlePieces: number;
  color: string;
  emoji: string;
}

export const config = {
  // Timer settings
  timerDuration: 10 * 60, // 10 minutes in seconds
  warningThreshold: 60, // seconds remaining to show warning

  // Input settings
  autoSubmitDelay: 250, // milliseconds to wait before auto-submit on correct answer

  // Gamification settings
  defaultTargetCorrectPerMinute: 8,
  defaultPuzzlePieces: 48, // 6x8 grid for puzzle game

  // Math operation defaults
  addition: { min: 0, max: 12 },
  subtraction: { minuendMax: 20 },
  multiplication: { min: 0, max: 12 },
  division: { dividendMax: 20 },

  // Voice recognition
  voiceEnabled: true,
  voiceAutoSubmit: true,

  // UI settings
  showPreviousQuestion: true,
  showNextPreview: true,

  // Celebration
  celebrationDuration: 5000, // milliseconds
};

export const levels: LevelConfig[] = [
  {
    id: 1,
    name: "Starter",
    description: "Perfect for warming up! Simple math with plenty of time.",
    targetCorrectPerMinute: 5,
    addition: { min: 0, max: 10 },
    subtraction: { minuendMax: 10 },
    multiplication: { min: 0, max: 5 },
    division: { dividendMax: 10 },
    puzzlePieces: 30,
    color: "#4CAF50",
    emoji: "🌱",
  },
  {
    id: 2,
    name: "Beginner",
    description: "Building confidence with numbers up to 12.",
    targetCorrectPerMinute: 6,
    addition: { min: 0, max: 12 },
    subtraction: { minuendMax: 12 },
    multiplication: { min: 0, max: 6 },
    division: { dividendMax: 12 },
    puzzlePieces: 36,
    color: "#2196F3",
    emoji: "🚀",
  },
  {
    id: 3,
    name: "Explorer",
    description: "Adventure awaits! Numbers are getting bigger.",
    targetCorrectPerMinute: 7,
    addition: { min: 0, max: 12 },
    subtraction: { minuendMax: 15 },
    multiplication: { min: 0, max: 9 },
    division: { dividendMax: 15 },
    puzzlePieces: 42,
    color: "#9C27B0",
    emoji: "🗺️",
  },
  {
    id: 4,
    name: "Champion",
    description: "You're getting fast! Full 12s tables.",
    targetCorrectPerMinute: 8,
    addition: { min: 0, max: 12 },
    subtraction: { minuendMax: 20 },
    multiplication: { min: 0, max: 12 },
    division: { dividendMax: 20 },
    puzzlePieces: 48,
    color: "#FF9800",
    emoji: "🏆",
  },
  {
    id: 5,
    name: "Master",
    description: "Speed demon mode! Bigger numbers, faster pace.",
    targetCorrectPerMinute: 9,
    addition: { min: 0, max: 15 },
    subtraction: { minuendMax: 30 },
    multiplication: { min: 0, max: 12 },
    division: { dividendMax: 30 },
    puzzlePieces: 54,
    color: "#F44336",
    emoji: "⚡",
  },
  {
    id: 6,
    name: "Legend",
    description: "Only the best can conquer this level!",
    targetCorrectPerMinute: 10,
    addition: { min: 0, max: 20 },
    subtraction: { minuendMax: 50 },
    multiplication: { min: 0, max: 12 },
    division: { dividendMax: 50 },
    puzzlePieces: 60,
    color: "#E91E63",
    emoji: "👑",
  },
];

export default config;
