// Geography Game Configuration

export type GeographyCategory =
  | 'us-states'
  | 'us-state-capitals'
  | 'countries-africa'
  | 'countries-asia'
  | 'countries-europe'
  | 'countries-north-america'
  | 'countries-south-america'
  | 'countries-oceania'
  | 'oceans'
  | 'landmarks';

export type GeographyGameMode = 'say' | 'click' | 'combined';

export interface GeographyLevelConfig {
  id: number;
  name: string;
  description: string;
  category: GeographyCategory;
  targetPerMinute: number;
  itemsToWin: number;
  color: string;
  emoji: string;
  gameMode: GeographyGameMode;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface GeographyLocation {
  id: string;
  name: string;
  type: 'country' | 'state' | 'capital' | 'ocean' | 'sea' | 'landmark';
  coordinates: [number, number]; // [longitude, latitude]
  countryCode?: string; // ISO 3166-1 alpha-2
  capital?: string;
  continent?: string;
  population?: number;
  funFact?: string;
  imageUrl?: string;
  pronunciations?: string[];
}

export interface USState extends GeographyLocation {
  abbreviation: string;
  capital: string;
  region: 'west' | 'midwest' | 'south' | 'northeast';
  neighbors: string[];
}

export interface Country extends GeographyLocation {
  capital: string;
  continent: string;
  flagUrl: string;
  population: number;
  languages?: string[];
  currency?: string;
}

export interface Landmark extends GeographyLocation {
  description: string;
  country: string;
  city?: string;
  yearBuilt?: number;
  imageUrl: string;
  category: 'ancient' | 'modern' | 'natural' | 'monument' | 'building';
}

export interface BodyOfWater extends GeographyLocation {
  waterType: 'ocean' | 'sea' | 'lake' | 'river';
  area?: number; // in square km
  borderingCountries?: string[];
}

// Score tracking
export interface GeographyScore {
  gameMode: GeographyGameMode;
  category: GeographyCategory;
  levelId: number;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  timestamp: number;
  duration: number;
}

export interface GeographyProgress {
  highScores: GeographyScore[];
  totalGamesPlayed: number;
  masteredLocations: string[];
  achievements: string[];
  lastPlayed: number;
}

// Level configurations
export const geographyLevels: GeographyLevelConfig[] = [
  // US States - Click Mode
  {
    id: 1,
    name: "US States - Click",
    description: "Click on the correct state!",
    category: 'us-states',
    targetPerMinute: 4,
    itemsToWin: 25,
    color: "#1976D2",
    emoji: "🗺️",
    gameMode: 'click',
    difficulty: 'beginner',
  },
  // US States - Say Mode
  {
    id: 2,
    name: "US States - Say",
    description: "Say the state name out loud!",
    category: 'us-states',
    targetPerMinute: 4,
    itemsToWin: 25,
    color: "#2196F3",
    emoji: "🗣️",
    gameMode: 'say',
    difficulty: 'intermediate',
  },
  // US State Capitals
  {
    id: 3,
    name: "State Capitals",
    description: "Learn US state capitals!",
    category: 'us-state-capitals',
    targetPerMinute: 4,
    itemsToWin: 25,
    color: "#0D47A1",
    emoji: "🏛️",
    gameMode: 'click',
    difficulty: 'intermediate',
  },
  // Countries - Europe
  {
    id: 4,
    name: "Europe",
    description: "Learn European countries!",
    category: 'countries-europe',
    targetPerMinute: 3,
    itemsToWin: 20,
    color: "#4CAF50",
    emoji: "🏰",
    gameMode: 'click',
    difficulty: 'intermediate',
  },
  // Countries - Asia
  {
    id: 5,
    name: "Asia",
    description: "Explore Asian countries!",
    category: 'countries-asia',
    targetPerMinute: 3,
    itemsToWin: 20,
    color: "#FF9800",
    emoji: "🐉",
    gameMode: 'click',
    difficulty: 'intermediate',
  },
  // Countries - Africa
  {
    id: 6,
    name: "Africa",
    description: "Discover African countries!",
    category: 'countries-africa',
    targetPerMinute: 3,
    itemsToWin: 20,
    color: "#8BC34A",
    emoji: "🦁",
    gameMode: 'click',
    difficulty: 'intermediate',
  },
  // Countries - Americas
  {
    id: 7,
    name: "North America",
    description: "North American countries!",
    category: 'countries-north-america',
    targetPerMinute: 4,
    itemsToWin: 15,
    color: "#9C27B0",
    emoji: "🦅",
    gameMode: 'click',
    difficulty: 'beginner',
  },
  {
    id: 8,
    name: "South America",
    description: "South American countries!",
    category: 'countries-south-america',
    targetPerMinute: 4,
    itemsToWin: 12,
    color: "#673AB7",
    emoji: "🌴",
    gameMode: 'click',
    difficulty: 'beginner',
  },
  // Countries - Oceania
  {
    id: 9,
    name: "Oceania",
    description: "Pacific island nations!",
    category: 'countries-oceania',
    targetPerMinute: 4,
    itemsToWin: 12,
    color: "#00BCD4",
    emoji: "🏝️",
    gameMode: 'click',
    difficulty: 'beginner',
  },
  // Famous Landmarks
  {
    id: 10,
    name: "Famous Landmarks",
    description: "Find world famous places!",
    category: 'landmarks',
    targetPerMinute: 3,
    itemsToWin: 20,
    color: "#FF5722",
    emoji: "🗼",
    gameMode: 'click',
    difficulty: 'intermediate',
  },
];

// Geography-specific config
export const geographyConfig = {
  // Timer settings
  timerDuration: 10 * 60, // 10 minutes in seconds
  warningThreshold: 60, // seconds remaining to show warning

  // Scoring
  basePoints: 100,
  speedBonusThreshold: 3000, // ms - if answered under this, get speed bonus
  speedBonusPoints: 50,
  streakBonusPoints: 10, // per consecutive correct
  perfectRoundMultiplier: 2,

  // Click mode
  clickToleranceRadius: 50, // pixels - how close click needs to be

  // Voice settings
  voiceEnabled: true,

  // Map settings
  defaultZoom: 1,
  minZoom: 0.5,
  maxZoom: 4,

  // UI settings
  showFlags: true,
  showFunFacts: true,
  showHints: true,
  animationDuration: 300, // ms
};

// Flag CDN URL helper
export function getFlagUrl(countryCode: string, size: number = 80): string {
  return `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.png`;
}

// Get levels by category
export function getLevelsByCategory(category: GeographyCategory): GeographyLevelConfig[] {
  return geographyLevels.filter(level => level.category === category);
}

// Get levels by game mode
export function getLevelsByGameMode(mode: GeographyGameMode): GeographyLevelConfig[] {
  return geographyLevels.filter(level => level.gameMode === mode);
}

// Get levels by difficulty
export function getLevelsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): GeographyLevelConfig[] {
  return geographyLevels.filter(level => level.difficulty === difficulty);
}

export default geographyConfig;
