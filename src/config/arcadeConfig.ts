// Arcade Games Configuration
// Defines all arcade games and their properties

export type ArcadeGameId =
  | 'mathBlaster'
  | 'cardShark'
  | 'diceDash'
  | 'clockMaster'
  | 'binaryBlitz'
  | 'probabilityPlayground'
  | 'numberNinja'
  | 'siUnitSafari'
  | 'wordPuzzlePalace'
  | 'equationInvaders'
  | 'randomRoulette'
  | 'speedMathSprint'
  | 'mathMuncher'
  | 'mathSnake'
  | 'breakoutEquations';

export interface ArcadeGameConfig {
  id: ArcadeGameId;
  name: string;
  shortName: string;
  description: string;
  emoji: string;
  color: string;
  gradient: string;
  category: 'action' | 'puzzle' | 'classic' | 'educational';
  difficulty: 'easy' | 'medium' | 'hard';
  features: string[];
  howToPlay: string;
  controls: string;
}

// Full arcade games collection
export const ARCADE_GAMES: ArcadeGameConfig[] = [
  {
    id: 'mathBlaster',
    name: 'Math Blaster',
    shortName: 'Blaster',
    description: 'Blast asteroids with correct math answers!',
    emoji: '🚀',
    color: '#6366F1',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    category: 'action',
    difficulty: 'medium',
    features: ['Space shooter', 'Quick math', 'Power-ups', 'High scores'],
    howToPlay: 'Solve math problems to shoot lasers at incoming asteroids!',
    controls: 'Type answer and press Enter to fire',
  },
  {
    id: 'diceDash',
    name: 'Dice Dash',
    shortName: 'Dice',
    description: 'Roll dice and add them up fast!',
    emoji: '🎲',
    color: '#FF9800',
    gradient: 'linear-gradient(135deg, #FF9800 0%, #FFC107 100%)',
    category: 'puzzle',
    difficulty: 'easy',
    features: ['Fun dice rolling', 'Simple addition', 'Beat the clock', 'Earn points'],
    howToPlay: 'Watch the dice roll, then add up the numbers. Type your answer!',
    controls: 'Type answer and press Enter',
  },
  {
    id: 'clockMaster',
    name: 'Clock Master',
    shortName: 'Clock',
    description: 'Learn to tell time with fun clocks!',
    emoji: '🕐',
    color: '#2196F3',
    gradient: 'linear-gradient(135deg, #2196F3 0%, #03A9F4 100%)',
    category: 'educational',
    difficulty: 'easy',
    features: ['Analog clocks', 'Digital practice', 'Time conversion', 'Multiple modes'],
    howToPlay: 'Look at the clock and tell what time it shows!',
    controls: 'Type the time',
  },
  {
    id: 'cardShark',
    name: 'Card Shark',
    shortName: 'Cards',
    description: 'Add up cards like a card game pro!',
    emoji: '🃏',
    color: '#4CAF50',
    gradient: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)',
    category: 'puzzle',
    difficulty: 'easy',
    features: ['Colorful cards', 'Mental math', 'Strategic thinking', 'Beat your score'],
    howToPlay: 'Cards flip one by one. Add them up and type the total!',
    controls: 'Type numbers and press Enter',
  },
  {
    id: 'binaryBlitz',
    name: 'Binary Blitz',
    shortName: 'Binary',
    description: 'Learn binary numbers in a fun way!',
    emoji: '💻',
    color: '#00BCD4',
    gradient: 'linear-gradient(135deg, #00BCD4 0%, #00E5FF 100%)',
    category: 'educational',
    difficulty: 'hard',
    features: ['Binary conversion', 'Decimal practice', 'Computer science', 'Progressive levels'],
    howToPlay: 'Convert between binary and decimal numbers!',
    controls: 'Type the converted number',
  },
  {
    id: 'probabilityPlayground',
    name: 'Probability Playground',
    shortName: 'Probability',
    description: 'Learn probability through games of chance!',
    emoji: '🎯',
    color: '#9C27B0',
    gradient: 'linear-gradient(135deg, #9C27B0 0%, #E040FB 100%)',
    category: 'educational',
    difficulty: 'medium',
    features: ['Dice games', 'Coin flips', 'Predictions', 'Statistics'],
    howToPlay: 'Predict outcomes and learn about probability!',
    controls: 'Click to make predictions',
  },
  {
    id: 'numberNinja',
    name: 'Number Ninja',
    shortName: 'Ninja',
    description: 'Catch falling numbers with ninja reflexes!',
    emoji: '🥷',
    color: '#263238',
    gradient: 'linear-gradient(135deg, #263238 0%, #455A64 100%)',
    category: 'action',
    difficulty: 'medium',
    features: ['Fast action', 'Quick reactions', 'Combo bonuses', 'Power-ups'],
    howToPlay: 'Catch falling numbers that equal the target answer!',
    controls: 'Mouse or Arrow keys to move',
  },
  {
    id: 'siUnitSafari',
    name: 'SI Unit Safari',
    shortName: 'Units',
    description: 'Explore the world of measurements!',
    emoji: '📏',
    color: '#795548',
    gradient: 'linear-gradient(135deg, #795548 0%, #A1887F 100%)',
    category: 'educational',
    difficulty: 'medium',
    features: ['Metric system', 'Unit conversion', 'Real-world examples', 'Science topics'],
    howToPlay: 'Convert between different units of measurement!',
    controls: 'Type the converted value',
  },
  {
    id: 'wordPuzzlePalace',
    name: 'Word Puzzle Palace',
    shortName: 'Words',
    description: 'Solve word puzzles and win joke tickets!',
    emoji: '🏰',
    color: '#673AB7',
    gradient: 'linear-gradient(135deg, #673AB7 0%, #9575CD 100%)',
    category: 'puzzle',
    difficulty: 'easy',
    features: ['Word games', 'Vocabulary', 'Spelling', 'Win jokes'],
    howToPlay: 'Figure out the missing letters to complete the word!',
    controls: 'Type the word',
  },
  {
    id: 'equationInvaders',
    name: 'Equation Invaders',
    shortName: 'Invaders',
    description: 'Defend Earth from math-hungry aliens!',
    emoji: '👾',
    color: '#3F51B5',
    gradient: 'linear-gradient(135deg, #3F51B5 0%, #7986CB 100%)',
    category: 'action',
    difficulty: 'medium',
    features: ['Space invaders', 'Equation solving', 'Boss battles', 'Upgrades'],
    howToPlay: 'Solve equations to shoot down invading aliens!',
    controls: 'Type answer and press Enter to fire',
  },
  {
    id: 'randomRoulette',
    name: 'Random Roulette',
    shortName: 'Roulette',
    description: 'Guess if the next number is higher or lower!',
    emoji: '🎰',
    color: '#F44336',
    gradient: 'linear-gradient(135deg, #F44336 0%, #EF5350 100%)',
    category: 'puzzle',
    difficulty: 'easy',
    features: ['Number guessing', 'Probability', 'Streak bonuses', 'Risk/reward'],
    howToPlay: 'See a number, then guess if the next one will be higher or lower!',
    controls: 'Click HIGHER or LOWER',
  },
  {
    id: 'speedMathSprint',
    name: 'Speed Math Sprint',
    shortName: 'Sprint',
    description: 'Race against time solving math problems!',
    emoji: '⚡',
    color: '#FF5722',
    gradient: 'linear-gradient(135deg, #FF5722 0%, #FF8A65 100%)',
    category: 'action',
    difficulty: 'hard',
    features: ['Speed challenge', 'All operations', 'Time attack', 'Leaderboards'],
    howToPlay: 'Solve as many problems as possible before time runs out!',
    controls: 'Type answers quickly',
  },
  {
    id: 'mathMuncher',
    name: 'Math Muncher',
    shortName: 'Muncher',
    description: 'Eat the right numbers in this maze game!',
    emoji: '👻',
    color: '#FFEB3B',
    gradient: 'linear-gradient(135deg, #FFEB3B 0%, #FFC107 100%)',
    category: 'classic',
    difficulty: 'easy',
    features: ['Classic gameplay', 'Maze navigation', 'Multiple levels', 'Enemies'],
    howToPlay: 'Move around the maze and eat numbers that match the rule!',
    controls: '← → ↑ ↓ Arrow keys',
  },
  {
    id: 'mathSnake',
    name: 'Math Snake',
    shortName: 'Snake',
    description: 'Guide your snake to eat correct answers!',
    emoji: '🐍',
    color: '#4CAF50',
    gradient: 'linear-gradient(135deg, #4CAF50 0%, #81C784 100%)',
    category: 'classic',
    difficulty: 'medium',
    features: ['Snake game', 'Growing challenge', 'Speed increases', 'High scores'],
    howToPlay: 'Eat the correct answer to grow your snake!',
    controls: '← → ↑ ↓ Arrow keys',
  },
  {
    id: 'breakoutEquations',
    name: 'Breakout Equations',
    shortName: 'Breakout',
    description: 'Break blocks by solving equations!',
    emoji: '🧱',
    color: '#E91E63',
    gradient: 'linear-gradient(135deg, #E91E63 0%, #F48FB1 100%)',
    category: 'classic',
    difficulty: 'medium',
    features: ['Breakout style', 'Equation blocks', 'Power-ups', 'Multiple levels'],
    howToPlay: 'Solve equations to break the matching blocks!',
    controls: 'Mouse to move paddle, type answers',
  },
];

// Get game config by ID
export function getArcadeGameConfig(id: ArcadeGameId): ArcadeGameConfig | undefined {
  return ARCADE_GAMES.find(game => game.id === id);
}

// Get games by category
export function getGamesByCategory(category: ArcadeGameConfig['category']): ArcadeGameConfig[] {
  return ARCADE_GAMES.filter(game => game.category === category);
}

// Game categories for display
export const GAME_CATEGORIES = [
  { id: 'action', name: 'Action', emoji: '🚀', description: 'Fast-paced action games' },
  { id: 'puzzle', name: 'Puzzle', emoji: '🧩', description: 'Brain-teasing puzzles' },
  { id: 'classic', name: 'Classic', emoji: '🕹️', description: 'Retro arcade games' },
  { id: 'educational', name: 'Learning', emoji: '📚', description: 'Educational games' },
] as const;

// Difficulty settings that affect game speed/complexity
export const DIFFICULTY_SETTINGS = {
  easy: {
    speedMultiplier: 0.7,
    mathComplexity: 1,
    lives: 5,
    timeBonus: 1.5,
  },
  medium: {
    speedMultiplier: 1.0,
    mathComplexity: 2,
    lives: 3,
    timeBonus: 1.0,
  },
  hard: {
    speedMultiplier: 1.3,
    mathComplexity: 3,
    lives: 2,
    timeBonus: 0.8,
  },
};

// Math problem generators for arcade games
export interface MathProblem {
  num1: number;
  num2: number;
  operation: '+' | '-' | '*' | '/';
  answer: number;
  display: string;
}

// EASIER math problems for kids
export function generateMathProblem(difficulty: number): MathProblem {
  // Only add operations gradually:
  // difficulty 1: just +
  // difficulty 2-3: + and -
  // difficulty 4+: + - *
  let operations: ('+' | '-' | '*' | '/')[] = ['+'];
  if (difficulty >= 2) operations.push('-');
  if (difficulty >= 4) operations.push('*');

  const operation = operations[Math.floor(Math.random() * operations.length)];

  // SMALLER numbers for kids - start with 1-10
  const maxNum = Math.min(5 + difficulty * 2, 15);
  let num1: number, num2: number, answer: number;

  switch (operation) {
    case '+':
      num1 = Math.floor(Math.random() * maxNum) + 1;
      num2 = Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      answer = num1 + num2;
      break;
    case '-':
      // Ensure positive result
      num2 = Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      num1 = num2 + Math.floor(Math.random() * Math.min(maxNum, 10)) + 1;
      answer = num1 - num2;
      break;
    case '*':
      // Small multiplication: 1-5 × 1-5 starting
      num1 = Math.floor(Math.random() * Math.min(5 + difficulty, 10)) + 1;
      num2 = Math.floor(Math.random() * 5) + 1;
      answer = num1 * num2;
      break;
    case '/':
      // Simple division
      num2 = Math.floor(Math.random() * 5) + 1;
      answer = Math.floor(Math.random() * 5) + 1;
      num1 = num2 * answer;
      break;
    default:
      num1 = 1;
      num2 = 1;
      answer = 2;
  }

  const operationSymbol = operation === '*' ? '×' : operation === '/' ? '÷' : operation;

  return {
    num1,
    num2,
    operation,
    answer,
    display: `${num1} ${operationSymbol} ${num2} = ?`,
  };
}

// Generate wrong answers that look plausible
export function generateWrongAnswers(correctAnswer: number, count: number): number[] {
  const wrong: Set<number> = new Set();

  while (wrong.size < count) {
    // Generate plausible wrong answers
    const offset = Math.floor(Math.random() * 20) - 10;
    const candidate = correctAnswer + offset;

    if (candidate !== correctAnswer && candidate > 0 && !wrong.has(candidate)) {
      wrong.add(candidate);
    }
  }

  return Array.from(wrong);
}

// Shuffle array utility
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
