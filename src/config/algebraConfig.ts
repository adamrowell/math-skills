// Algebra Game Configuration
// Progressive levels for learning algebra concepts

export type AlgebraMode = 'equations' | 'solveForX' | 'advanced';
export type AlgebraOperation = 'add' | 'subtract' | 'multiply' | 'divide';

export interface AlgebraLevelConfig {
  id: number;
  name: string;
  description: string;
  mode: AlgebraMode;
  operations: AlgebraOperation[];
  range: { min: number; max: number };
  answerRange: { min: number; max: number };
  useParentheses: boolean;
  multiStep: boolean;
  variableOnBothSides: boolean;
  questionsToWin: number;
  timerDuration: number;
  emoji: string;
  color: string;
}

// Equation Builder Levels - Simple multi-operation equations
export const equationBuilderLevels: AlgebraLevelConfig[] = [
  {
    id: 1,
    name: 'Number Start',
    description: 'Simple addition and subtraction',
    mode: 'equations',
    operations: ['add', 'subtract'],
    range: { min: 1, max: 10 },
    answerRange: { min: 1, max: 20 },
    useParentheses: false,
    multiStep: false,
    variableOnBothSides: false,
    questionsToWin: 10,
    timerDuration: 180,
    emoji: '🔢',
    color: '#667eea',
  },
  {
    id: 2,
    name: 'Times Tables',
    description: 'Multiply and divide',
    mode: 'equations',
    operations: ['multiply', 'divide'],
    range: { min: 1, max: 10 },
    answerRange: { min: 1, max: 100 },
    useParentheses: false,
    multiStep: false,
    variableOnBothSides: false,
    questionsToWin: 12,
    timerDuration: 180,
    emoji: '✖️',
    color: '#4ECDC4',
  },
  {
    id: 3,
    name: 'Two Steps',
    description: 'Two operations together',
    mode: 'equations',
    operations: ['add', 'subtract', 'multiply'],
    range: { min: 1, max: 10 },
    answerRange: { min: 1, max: 50 },
    useParentheses: false,
    multiStep: true,
    variableOnBothSides: false,
    questionsToWin: 12,
    timerDuration: 240,
    emoji: '🎯',
    color: '#FF6B6B',
  },
  {
    id: 4,
    name: 'Parentheses',
    description: 'Solve inside first!',
    mode: 'equations',
    operations: ['add', 'subtract', 'multiply'],
    range: { min: 1, max: 8 },
    answerRange: { min: 1, max: 100 },
    useParentheses: true,
    multiStep: true,
    variableOnBothSides: false,
    questionsToWin: 12,
    timerDuration: 300,
    emoji: '🧮',
    color: '#45B7D1',
  },
  {
    id: 5,
    name: 'Order Master',
    description: 'Full order of operations',
    mode: 'equations',
    operations: ['add', 'subtract', 'multiply', 'divide'],
    range: { min: 2, max: 10 },
    answerRange: { min: 1, max: 100 },
    useParentheses: true,
    multiStep: true,
    variableOnBothSides: false,
    questionsToWin: 15,
    timerDuration: 300,
    emoji: '🏆',
    color: '#FF9800',
  },
];

// Mystery Number Levels - Solve for X (beginner) - Consolidated
export const mysteryNumberLevels: AlgebraLevelConfig[] = [
  {
    id: 1,
    name: 'Mystery Box',
    description: 'Add and subtract to find the mystery number',
    mode: 'solveForX',
    operations: ['add', 'subtract'],
    range: { min: 1, max: 15 },
    answerRange: { min: 1, max: 15 },
    useParentheses: false,
    multiStep: false,
    variableOnBothSides: false,
    questionsToWin: 10,
    timerDuration: 180,
    emoji: '📦',
    color: '#667eea',
  },
  {
    id: 2,
    name: 'Two Clues',
    description: 'Two steps to solve the mystery',
    mode: 'solveForX',
    operations: ['add', 'subtract', 'multiply', 'divide'],
    range: { min: 1, max: 10 },
    answerRange: { min: 1, max: 12 },
    useParentheses: false,
    multiStep: true,
    variableOnBothSides: false,
    questionsToWin: 12,
    timerDuration: 240,
    emoji: '🕵️',
    color: '#4ECDC4',
  },
  {
    id: 3,
    name: 'Master Detective',
    description: 'Complex multi-step mysteries',
    mode: 'solveForX',
    operations: ['add', 'subtract', 'multiply', 'divide'],
    range: { min: 1, max: 12 },
    answerRange: { min: 1, max: 15 },
    useParentheses: false,
    multiStep: true,
    variableOnBothSides: false,
    questionsToWin: 15,
    timerDuration: 300,
    emoji: '🎖️',
    color: '#FF9800',
  },
];

// Equation Master Levels - Advanced solve for X
export const equationMasterLevels: AlgebraLevelConfig[] = [
  {
    id: 1,
    name: 'X Beginner',
    description: 'Simple x equations',
    mode: 'advanced',
    operations: ['add', 'subtract'],
    range: { min: 1, max: 20 },
    answerRange: { min: 1, max: 20 },
    useParentheses: false,
    multiStep: false,
    variableOnBothSides: false,
    questionsToWin: 10,
    timerDuration: 180,
    emoji: '📐',
    color: '#667eea',
  },
  {
    id: 2,
    name: 'X Times',
    description: 'Multiply x',
    mode: 'advanced',
    operations: ['multiply', 'divide'],
    range: { min: 2, max: 10 },
    answerRange: { min: 1, max: 12 },
    useParentheses: false,
    multiStep: false,
    variableOnBothSides: false,
    questionsToWin: 12,
    timerDuration: 180,
    emoji: '✨',
    color: '#4ECDC4',
  },
  {
    id: 3,
    name: 'Two Step X',
    description: '2x + 5 = 17',
    mode: 'advanced',
    operations: ['add', 'subtract', 'multiply'],
    range: { min: 1, max: 10 },
    answerRange: { min: 1, max: 15 },
    useParentheses: false,
    multiStep: true,
    variableOnBothSides: false,
    questionsToWin: 12,
    timerDuration: 240,
    emoji: '🧩',
    color: '#FF6B6B',
  },
  {
    id: 4,
    name: 'Both Sides',
    description: 'x on both sides',
    mode: 'advanced',
    operations: ['add', 'subtract', 'multiply'],
    range: { min: 1, max: 10 },
    answerRange: { min: 1, max: 15 },
    useParentheses: false,
    multiStep: true,
    variableOnBothSides: true,
    questionsToWin: 12,
    timerDuration: 300,
    emoji: '⚖️',
    color: '#9C27B0',
  },
  {
    id: 5,
    name: 'Equation Pro',
    description: 'All equation types',
    mode: 'advanced',
    operations: ['add', 'subtract', 'multiply', 'divide'],
    range: { min: 1, max: 12 },
    answerRange: { min: 1, max: 20 },
    useParentheses: true,
    multiStep: true,
    variableOnBothSides: true,
    questionsToWin: 15,
    timerDuration: 360,
    emoji: '🏅',
    color: '#FF9800',
  },
];

// Graph Explorer Levels
export interface GraphLevelConfig {
  id: number;
  name: string;
  description: string;
  slopeRange: { min: number; max: number };
  interceptRange: { min: number; max: number };
  questionTypes: GraphQuestionType[];
  questionsToWin: number;
  timerDuration: number;
  emoji: string;
  color: string;
}

export type GraphQuestionType =
  | 'yForX'           // What is y when x = 3?
  | 'xForY'           // What is x when y = 8?
  | 'yIntercept'      // Where does line cross y-axis?
  | 'xIntercept'      // Where does line cross x-axis?
  | 'slopeDirection'  // Is line going up or down?
  | 'increasing'      // Is the line increasing or decreasing?
  | 'steeper'         // Which line is steeper?
  | 'pointOnLine'     // Is (2, 5) on the line?
  | 'slopeValue';     // What is the slope of the line?

export const graphExplorerLevels: GraphLevelConfig[] = [
  {
    id: 1,
    name: 'Line Explorer',
    description: 'Read and find values on lines',
    slopeRange: { min: 1, max: 2 },
    interceptRange: { min: -2, max: 3 },
    questionTypes: ['yForX', 'xForY', 'yIntercept', 'xIntercept', 'increasing'],
    questionsToWin: 10,
    timerDuration: 240,
    emoji: '📈',
    color: '#667eea',
  },
  {
    id: 2,
    name: 'Slope Spotter',
    description: 'Understand slope direction and value',
    slopeRange: { min: -3, max: 3 },
    interceptRange: { min: -3, max: 3 },
    questionTypes: ['yForX', 'xForY', 'slopeDirection', 'increasing', 'slopeValue', 'yIntercept'],
    questionsToWin: 12,
    timerDuration: 300,
    emoji: '⛰️',
    color: '#4ECDC4',
  },
  {
    id: 3,
    name: 'Point Checker',
    description: 'Which points are on the line?',
    slopeRange: { min: -3, max: 3 },
    interceptRange: { min: -4, max: 4 },
    questionTypes: ['yForX', 'xForY', 'pointOnLine', 'xIntercept', 'yIntercept'],
    questionsToWin: 12,
    timerDuration: 300,
    emoji: '📍',
    color: '#FF6B6B',
  },
  {
    id: 4,
    name: 'Line Comparer',
    description: 'Compare different lines',
    slopeRange: { min: -3, max: 4 },
    interceptRange: { min: -4, max: 4 },
    questionTypes: ['yForX', 'xForY', 'steeper', 'slopeValue', 'xIntercept', 'yIntercept'],
    questionsToWin: 12,
    timerDuration: 300,
    emoji: '⚖️',
    color: '#9C27B0',
  },
  {
    id: 5,
    name: 'Graph Master',
    description: 'All graph challenges',
    slopeRange: { min: -4, max: 4 },
    interceptRange: { min: -5, max: 5 },
    questionTypes: ['yForX', 'xForY', 'slopeDirection', 'increasing', 'yIntercept', 'xIntercept', 'pointOnLine', 'steeper', 'slopeValue'],
    questionsToWin: 15,
    timerDuration: 360,
    emoji: '🎓',
    color: '#FF9800',
  },
];

// Visual representation types for balance scale
export type VisualMode = 'objects' | 'boxes' | 'letters';

export const algebraConfig = {
  timerDuration: 180,
  autoSubmitDelay: 300,
  voiceEnabled: true,
  showSteps: true,
  defaultVisualMode: 'objects' as VisualMode,

  // Symbols for visual mode
  symbols: {
    objects: ['🍎', '⭐', '🔵', '🟢'],
    box: '□',
    variable: 'x',
  },

  // Encouragement messages
  correctMessages: [
    'Brilliant!',
    'You got it!',
    'Amazing!',
    'Perfect!',
    'Math star!',
    'Excellent!',
  ],
  incorrectMessages: [
    'Try again!',
    'Almost!',
    'Keep going!',
    'Think carefully!',
  ],
};

export default algebraConfig;
