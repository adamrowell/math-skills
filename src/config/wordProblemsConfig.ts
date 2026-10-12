// Word Problems Configuration
// 7-year-old friendly word problems combining reading and thinking

export type ProblemCategory =
  | 'letter-pattern'
  | 'rhyming'
  | 'synonym-antonym'
  | 'word-math'
  | 'sequence'
  | 'comprehension';

export type AnswerType = 'multiple-choice' | 'fill-number' | 'fill-word';

export interface WordProblem {
  id: string;
  category: ProblemCategory;
  subcategory: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  passage?: string;
  question: string;
  answerType: AnswerType;
  correctAnswer: string | number;
  options?: string[];
  hint1?: string;
  hint2?: string;
  explanation?: string;
}

export interface WordProblemLevelConfig {
  id: number;
  name: string;
  description: string;
  categories: ProblemCategory[];
  difficulty: number;
  problemsToWin: number;
  timerDuration: number;
  showHints: boolean;
  emoji: string;
  color: string;
}

export const wordProblemLevels: WordProblemLevelConfig[] = [
  {
    id: 1,
    name: 'Letter Fun',
    description: 'Letters and sounds',
    categories: ['letter-pattern'],
    difficulty: 1,
    problemsToWin: 10,
    timerDuration: 300,
    showHints: true,
    emoji: '🔤',
    color: '#4CAF50',
  },
  {
    id: 2,
    name: 'Rhyme Time',
    description: 'Find the rhymes',
    categories: ['letter-pattern', 'rhyming'],
    difficulty: 2,
    problemsToWin: 12,
    timerDuration: 300,
    showHints: true,
    emoji: '🎵',
    color: '#2196F3',
  },
  {
    id: 3,
    name: 'Word Power',
    description: 'Same and opposite words',
    categories: ['rhyming', 'synonym-antonym'],
    difficulty: 2,
    problemsToWin: 12,
    timerDuration: 300,
    showHints: true,
    emoji: '💪',
    color: '#9C27B0',
  },
  {
    id: 4,
    name: 'Story Math',
    description: 'Math in stories',
    categories: ['word-math', 'sequence'],
    difficulty: 3,
    problemsToWin: 12,
    timerDuration: 360,
    showHints: true,
    emoji: '📚',
    color: '#FF9800',
  },
  {
    id: 5,
    name: 'Read & Think',
    description: 'Short stories with questions',
    categories: ['comprehension', 'word-math'],
    difficulty: 3,
    problemsToWin: 12,
    timerDuration: 360,
    showHints: true,
    emoji: '🤔',
    color: '#E91E63',
  },
  {
    id: 6,
    name: 'Word Master',
    description: 'All problem types!',
    categories: ['letter-pattern', 'rhyming', 'synonym-antonym', 'word-math', 'sequence', 'comprehension'],
    difficulty: 4,
    problemsToWin: 15,
    timerDuration: 420,
    showHints: false,
    emoji: '🏆',
    color: '#FF5722',
  },
];

export const wordProblemsConfig = {
  timerDuration: 300,
  showHintsAfterWrong: 1, // Show hint after 1 wrong attempt
  maxAttempts: 3,
  voiceEnabled: true,

  // Categories display info
  categoryInfo: {
    'letter-pattern': {
      name: 'Letters & Patterns',
      emoji: '🔤',
      color: '#4CAF50',
    },
    'rhyming': {
      name: 'Rhyming Words',
      emoji: '🎵',
      color: '#2196F3',
    },
    'synonym-antonym': {
      name: 'Word Meanings',
      emoji: '🔄',
      color: '#9C27B0',
    },
    'word-math': {
      name: 'Story Math',
      emoji: '🔢',
      color: '#FF9800',
    },
    'sequence': {
      name: 'Order & Patterns',
      emoji: '📊',
      color: '#00BCD4',
    },
    'comprehension': {
      name: 'Reading Stories',
      emoji: '📖',
      color: '#E91E63',
    },
  },

  // Feedback messages
  correctMessages: [
    'Great reading!',
    'You got it!',
    'Smart thinking!',
    'Excellent!',
    'Perfect!',
    'Amazing!',
  ],
  incorrectMessages: [
    'Read it again!',
    'Think about it...',
    'Almost there!',
    'Try one more time!',
  ],
  hintMessages: [
    'Need a hint?',
    "Here's a clue!",
    'Let me help!',
  ],
};

// Subcategory definitions for organizing problems
export const subcategories = {
  'letter-pattern': [
    'alphabet-sequence',
    'missing-letter',
    'first-letter',
    'last-letter',
    'vowel-consonant',
    'letter-sound',
  ],
  'rhyming': [
    'find-rhyme',
    'word-family',
    'odd-one-out',
    'syllable-count',
  ],
  'synonym-antonym': [
    'synonym',
    'antonym',
    'context-word',
  ],
  'word-math': [
    'addition-story',
    'subtraction-story',
    'comparison',
    'how-many-more',
    'multiplication-story',
    'money-problem',
    'time-problem',
  ],
  'sequence': [
    'number-sequence',
    'letter-sequence',
    'story-order',
    'day-month-order',
    'size-order',
  ],
  'comprehension': [
    'character',
    'setting',
    'main-idea',
    'fact-recall',
    'prediction',
    'cause-effect',
  ],
};

export default wordProblemsConfig;
