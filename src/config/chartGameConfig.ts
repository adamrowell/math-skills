// Chart Game Configuration - Designed for 7-year-olds
// Questions should be clear, unambiguous, and make real-world sense

export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'horizontalBar'
  | 'pictograph'
  | 'multiLine'      // Two lines comparing things (Red Team vs Blue Team)
  | 'coordinateGrid'; // Simple treasure-map style grid

export type QuestionType =
  | 'highest'        // Which has the most?
  | 'lowest'         // Which has the fewest?
  | 'value'          // How many does X have?
  | 'compare'        // Which has more: X or Y?
  | 'difference'     // How many more does X have than Y?
  | 'addTwo'         // What is X + Y?
  | 'clickHighest'   // Click the biggest one
  | 'clickLowest'    // Click the smallest one
  | 'clickItem'      // Click on Apples
  | 'compareLines'   // Which team has more on Tuesday?
  | 'gridValue'      // What's at position (2, 3)?
  | 'clickGrid';     // Click on position (1, 4)

export type InputType = 'typed' | 'click' | 'multipleChoice';

export interface ChartLevelConfig {
  id: number;
  name: string;
  description: string;
  chartTypes: ChartType[];
  questionTypes: QuestionType[];
  inputTypes: InputType[];
  dataRange: { min: number; max: number };
  dataPoints: { min: number; max: number };
  itemsToWin: number;
  showGridLines: boolean;
  showValues: boolean;
  timerDuration?: number;
}

export const chartLevels: ChartLevelConfig[] = [
  {
    id: 1,
    name: 'Chart Explorer',
    description: 'Learn to read simple charts',
    chartTypes: ['bar', 'pictograph'],
    questionTypes: ['clickHighest', 'clickLowest', 'value', 'clickItem'],
    inputTypes: ['click', 'multipleChoice'],
    dataRange: { min: 1, max: 10 },
    dataPoints: { min: 3, max: 4 },
    itemsToWin: 8,
    showGridLines: true,
    showValues: true, // Show values for beginners
  },
  {
    id: 2,
    name: 'Data Detective',
    description: 'Read charts without the numbers showing',
    chartTypes: ['bar', 'horizontalBar', 'pictograph'],
    questionTypes: ['highest', 'lowest', 'value', 'compare', 'clickHighest', 'clickLowest'],
    inputTypes: ['click', 'multipleChoice'],
    dataRange: { min: 5, max: 25 },
    dataPoints: { min: 4, max: 5 },
    itemsToWin: 10,
    showGridLines: true,
    showValues: false,
  },
  {
    id: 3,
    name: 'Graph Master',
    description: 'Tackle bigger numbers and new chart types',
    chartTypes: ['bar', 'horizontalBar', 'line', 'pictograph'],
    questionTypes: ['highest', 'lowest', 'value', 'compare', 'difference', 'addTwo', 'clickHighest', 'clickLowest'],
    inputTypes: ['typed', 'multipleChoice'],
    dataRange: { min: 10, max: 50 },
    dataPoints: { min: 4, max: 6 },
    itemsToWin: 12,
    showGridLines: true,
    showValues: false,
  },
  {
    id: 4,
    name: 'Comparison Champion',
    description: 'Compare two lines on the same chart',
    chartTypes: ['bar', 'line', 'multiLine'],
    questionTypes: ['highest', 'lowest', 'value', 'compare', 'difference', 'compareLines'],
    inputTypes: ['typed', 'multipleChoice'],
    dataRange: { min: 10, max: 100 },
    dataPoints: { min: 4, max: 6 },
    itemsToWin: 12,
    showGridLines: true,
    showValues: false,
    timerDuration: 240,
  },
  {
    id: 5,
    name: 'Treasure Hunter',
    description: 'Find treasures on a coordinate grid',
    chartTypes: ['coordinateGrid', 'bar', 'line'],
    questionTypes: ['gridValue', 'clickGrid', 'highest', 'lowest', 'value', 'compare'],
    inputTypes: ['typed', 'click', 'multipleChoice'],
    dataRange: { min: 10, max: 50 },
    dataPoints: { min: 4, max: 6 },
    itemsToWin: 12,
    showGridLines: true,
    showValues: false,
    timerDuration: 300,
  },
  {
    id: 6,
    name: 'Chart Champion',
    description: 'The ultimate chart challenge!',
    chartTypes: ['bar', 'horizontalBar', 'line', 'multiLine', 'coordinateGrid', 'pie'],
    questionTypes: ['highest', 'lowest', 'value', 'compare', 'difference', 'addTwo', 'compareLines', 'gridValue', 'clickGrid'],
    inputTypes: ['typed', 'multipleChoice'],
    dataRange: { min: 20, max: 100 },
    dataPoints: { min: 5, max: 7 },
    itemsToWin: 15,
    showGridLines: true,
    showValues: false,
    timerDuration: 360,
  },
];

// Theme categories - kid-friendly, real-world topics
export interface ThemeCategory {
  name: string;
  items: string[];
  unit: string;
  symbol: string;
}

export const chartThemes: ThemeCategory[] = [
  {
    name: 'Favorite Animals',
    items: ['Dogs', 'Cats', 'Birds', 'Fish', 'Rabbits', 'Hamsters'],
    unit: 'votes',
    symbol: '🐾',
  },
  {
    name: 'Fruit Stand',
    items: ['Apples', 'Bananas', 'Oranges', 'Grapes', 'Strawberries', 'Watermelon'],
    unit: 'sold',
    symbol: '🍎',
  },
  {
    name: 'Sports Kids',
    items: ['Soccer', 'Basketball', 'Baseball', 'Swimming', 'Tennis', 'Running'],
    unit: 'kids',
    symbol: '⚽',
  },
  {
    name: 'Books This Week',
    items: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    unit: 'books',
    symbol: '📚',
  },
  {
    name: 'Ice Cream Votes',
    items: ['Vanilla', 'Chocolate', 'Strawberry', 'Mint', 'Cookie Dough'],
    unit: 'votes',
    symbol: '🍦',
  },
  {
    name: 'Toy Collection',
    items: ['Cars', 'Dolls', 'Blocks', 'Puzzles', 'Stuffed Animals', 'Legos'],
    unit: 'toys',
    symbol: '🧸',
  },
  {
    name: 'Sticker Chart',
    items: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    unit: 'stickers',
    symbol: '⭐',
  },
  {
    name: 'Points Scored',
    items: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5'],
    unit: 'points',
    symbol: '🏆',
  },
];

// Chart colors - bright and fun
export const chartColors = [
  '#667eea', // Purple
  '#4ECDC4', // Teal
  '#FF6B6B', // Coral
  '#45B7D1', // Sky blue
  '#FF9800', // Orange
  '#4CAF50', // Green
  '#E91E63', // Pink
  '#FFC107', // Amber
];

// For multi-line charts - comparing two teams
export const teamNames = [
  { name: 'Red Team', color: '#FF6B6B' },
  { name: 'Blue Team', color: '#45B7D1' },
];

// Treasure grid items - for coordinate grid questions
export const treasureItems = ['💎', '⭐', '🏆', '🎁', '🌟', '💰', '🔮', '👑'];

// Game configuration
export const chartGameConfig = {
  timerDuration: 180, // 3 minutes default
  basePoints: 10,
  speedBonusThreshold: 5000,
  speedBonusPoints: 5,
  streakBonusPoints: 2,
  hintPenalty: 5,
};

// Question templates - clear, kid-friendly language
export const questionTemplates: Record<QuestionType, string[]> = {
  highest: [
    'Which one has the MOST {unit}?',
    'Which is the BIGGEST?',
  ],
  lowest: [
    'Which one has the FEWEST {unit}?',
    'Which is the SMALLEST?',
  ],
  value: [
    'How many {unit} for {item}?',
    'What number is {item}?',
  ],
  compare: [
    'Which has MORE: {item1} or {item2}?',
  ],
  difference: [
    '{item1} has how many MORE {unit} than {item2}?',
    'How many MORE {unit} does {item1} have than {item2}?',
  ],
  addTwo: [
    'Add {item1} and {item2}. What is the total?',
  ],
  clickHighest: [
    'Click the BIGGEST one!',
    'Tap the one with the MOST!',
  ],
  clickLowest: [
    'Click the SMALLEST one!',
    'Tap the one with the FEWEST!',
  ],
  clickItem: [
    'Click on {item}!',
    'Find {item} and tap it!',
  ],
  compareLines: [
    'On {item}, which team has MORE?',
    'Who scored more on {item}?',
  ],
  gridValue: [
    'What treasure is at ({x}, {y})?',
    'Look at spot ({x}, {y}). What do you see?',
  ],
  clickGrid: [
    'Click on spot ({x}, {y})!',
    'Find ({x}, {y}) and tap it!',
  ],
};

export default chartGameConfig;
