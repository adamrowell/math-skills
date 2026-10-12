// Comparison Game Configuration
// Multi-modal number comparison game with visualizations

export type ValueType =
  | 'integer'
  | 'decimal'
  | 'fraction'
  | 'word-number'
  | 'percentage'
  | 'negative'
  | 'special' // infinity, pi, etc.
  | 'expression'; // 2×12, 3+9

export type ComparisonResult = 'left' | 'right' | 'equal';

export interface ComparisonValue {
  type: ValueType;
  display: string;       // What the user sees: "1/2", "0.5", "one half"
  numericValue: number;  // Actual numeric value for comparison
  explanation?: string;  // How to convert/understand: "1/2 = 0.5"
  visualizable: boolean; // Can be shown on number line
}

export interface ComparisonQuestion {
  left: ComparisonValue;
  right: ComparisonValue;
  correctAnswer: ComparisonResult;
  hint?: string;
  category: string; // For grouping similar comparisons
}

export interface ComparisonLevelConfig {
  id: number;
  name: string;
  description: string;
  targetPerMinute: number;
  questionsToWin: number;
  color: string;
  emoji: string;
  enabledTypes: ValueType[];
  allowMixedTypes: boolean; // Compare fraction vs decimal, etc.
  numberRange: { min: number; max: number };
  includeNegatives: boolean;
  includeSpecials: boolean; // pi, infinity, etc.
}

// Difficulty levels - 3 focused modes
export const comparisonLevels: ComparisonLevelConfig[] = [
  {
    id: 1,
    name: "Fractions",
    description: "Which fraction is bigger?",
    targetPerMinute: 6,
    questionsToWin: 15,
    color: "#2196F3",
    emoji: "½",
    enabledTypes: ['fraction'],
    allowMixedTypes: false,
    numberRange: { min: 0, max: 10 },
    includeNegatives: false,
    includeSpecials: false,
  },
  {
    id: 2,
    name: "Decimals & Fractions",
    description: "Compare decimals, fractions & percents",
    targetPerMinute: 5,
    questionsToWin: 15,
    color: "#9C27B0",
    emoji: "🔢",
    enabledTypes: ['decimal', 'fraction', 'percentage'],
    allowMixedTypes: true,
    numberRange: { min: 0, max: 10 },
    includeNegatives: false,
    includeSpecials: false,
  },
  {
    id: 3,
    name: "Mixed Challenge",
    description: "Fractions, decimals & expressions",
    targetPerMinute: 4,
    questionsToWin: 20,
    color: "#4CAF50",
    emoji: "🏆",
    enabledTypes: ['integer', 'decimal', 'fraction', 'percentage', 'expression'],
    allowMixedTypes: true,
    numberRange: { min: 0, max: 100 },
    includeNegatives: false,
    includeSpecials: false,
  },
];

// Word number mappings
export const wordNumbers: { [key: string]: number } = {
  'zero': 0,
  'one': 1,
  'two': 2,
  'three': 3,
  'four': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8,
  'nine': 9,
  'ten': 10,
  'eleven': 11,
  'twelve': 12,
  'twenty': 20,
  'fifty': 50,
  'hundred': 100,
  'thousand': 1000,
  'ten thousand': 10000,
  'hundred thousand': 100000,
  'one million': 1000000,
  'ten million': 10000000,
  'hundred million': 100000000,
  'one billion': 1000000000,
  'ten billion': 10000000000,
  'hundred billion': 100000000000,
  'one trillion': 1000000000000,
};

// Common fractions for display
export const commonFractions = [
  { numerator: 1, denominator: 2, display: '1/2' },
  { numerator: 1, denominator: 3, display: '1/3' },
  { numerator: 2, denominator: 3, display: '2/3' },
  { numerator: 1, denominator: 4, display: '1/4' },
  { numerator: 3, denominator: 4, display: '3/4' },
  { numerator: 1, denominator: 5, display: '1/5' },
  { numerator: 2, denominator: 5, display: '2/5' },
  { numerator: 3, denominator: 5, display: '3/5' },
  { numerator: 4, denominator: 5, display: '4/5' },
  { numerator: 1, denominator: 6, display: '1/6' },
  { numerator: 5, denominator: 6, display: '5/6' },
  { numerator: 1, denominator: 8, display: '1/8' },
  { numerator: 3, denominator: 8, display: '3/8' },
  { numerator: 5, denominator: 8, display: '5/8' },
  { numerator: 7, denominator: 8, display: '7/8' },
  { numerator: 1, denominator: 10, display: '1/10' },
  { numerator: 3, denominator: 10, display: '3/10' },
  { numerator: 7, denominator: 10, display: '7/10' },
  { numerator: 9, denominator: 10, display: '9/10' },
];

// Special numbers
export const specialNumbers: { display: string; value: number }[] = [
  { display: 'pi', value: Math.PI },
  { display: 'e', value: Math.E },
];

// Config settings
export const comparisonConfig = {
  timerDuration: 5 * 60, // 5 minutes
  warningThreshold: 30,
  autoAdvanceDelay: 1500, // Show feedback before next question
  hintDelay: 500, // Delay before showing hint
  showVisualizationDuration: 3000, // How long to show visualization
};

// Helper functions for generating values

export function generateInteger(min: number, max: number, allowNegative: boolean = false): ComparisonValue {
  let value: number;
  if (allowNegative && Math.random() < 0.5) {
    value = -Math.floor(Math.random() * Math.abs(min)) || -1;
  } else {
    value = Math.floor(Math.random() * (max - Math.max(0, min) + 1)) + Math.max(0, min);
  }

  return {
    type: value < 0 ? 'negative' : 'integer',
    display: value.toLocaleString(),
    numericValue: value,
    visualizable: Math.abs(value) <= 20,
  };
}

export function generateDecimal(min: number, max: number, precision: number = 2): ComparisonValue {
  const value = Math.random() * (max - min) + min;
  const rounded = Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);

  return {
    type: 'decimal',
    display: rounded.toFixed(precision),
    numericValue: rounded,
    explanation: `${rounded} is ${rounded < 1 ? 'less than 1' : rounded < 2 ? 'between 1 and 2' : 'greater than 2'}`,
    visualizable: Math.abs(rounded) <= 10,
  };
}

export function generateFraction(maxDenominator: number = 10): ComparisonValue {
  const validFractions = commonFractions.filter(f => f.denominator <= maxDenominator);
  const fraction = validFractions[Math.floor(Math.random() * validFractions.length)];
  const value = fraction.numerator / fraction.denominator;

  return {
    type: 'fraction',
    display: fraction.display,
    numericValue: value,
    explanation: `${fraction.display} = ${value.toFixed(3)}`,
    visualizable: true,
  };
}

export function generateMixedNumber(maxWhole: number = 5): ComparisonValue {
  const whole = Math.floor(Math.random() * maxWhole) + 1;
  const validFractions = commonFractions.filter(f => f.numerator < f.denominator);
  const fraction = validFractions[Math.floor(Math.random() * validFractions.length)];
  const value = whole + fraction.numerator / fraction.denominator;

  return {
    type: 'fraction',
    display: `${whole} ${fraction.display}`,
    numericValue: value,
    explanation: `${whole} ${fraction.display} = ${value.toFixed(3)}`,
    visualizable: value <= 10,
  };
}

export function generateWordNumber(minOrder: number = 3, maxOrder: number = 12): ComparisonValue {
  const wordNumberEntries = Object.entries(wordNumbers).filter(([_, v]) => {
    const order = Math.log10(Math.max(v, 1));
    return order >= minOrder && order <= maxOrder && v > 0;
  });

  const [word, value] = wordNumberEntries[Math.floor(Math.random() * wordNumberEntries.length)];

  return {
    type: 'word-number',
    display: word,
    numericValue: value,
    explanation: `${word} = ${value.toLocaleString()}`,
    visualizable: false,
  };
}

export function generatePercentage(min: number = 0, max: number = 200): ComparisonValue {
  const percent = Math.floor(Math.random() * (max - min + 1)) + min;
  const value = percent / 100;

  return {
    type: 'percentage',
    display: `${percent}%`,
    numericValue: value,
    explanation: `${percent}% = ${value}`,
    visualizable: true,
  };
}

export function generateExpression(): ComparisonValue {
  const operations = [
    { op: '+', fn: (a: number, b: number) => a + b, symbol: '+' },
    { op: '-', fn: (a: number, b: number) => a - b, symbol: '-' },
    { op: '*', fn: (a: number, b: number) => a * b, symbol: '×' },
  ];

  const operation = operations[Math.floor(Math.random() * operations.length)];
  let a: number, b: number, value: number;

  if (operation.op === '*') {
    a = Math.floor(Math.random() * 12) + 1;
    b = Math.floor(Math.random() * 12) + 1;
  } else if (operation.op === '-') {
    a = Math.floor(Math.random() * 20) + 5;
    b = Math.floor(Math.random() * a);
  } else {
    a = Math.floor(Math.random() * 20) + 1;
    b = Math.floor(Math.random() * 20) + 1;
  }

  value = operation.fn(a, b);

  return {
    type: 'expression',
    display: `${a} ${operation.symbol} ${b}`,
    numericValue: value,
    explanation: `${a} ${operation.symbol} ${b} = ${value}`,
    visualizable: value >= 0 && value <= 20,
  };
}

export function generateSpecial(): ComparisonValue {
  const special = specialNumbers[Math.floor(Math.random() * specialNumbers.length)];

  return {
    type: 'special',
    display: special.display === 'pi' ? 'π' : special.display,
    numericValue: special.value,
    explanation: `${special.display} ≈ ${special.value.toFixed(4)}`,
    visualizable: true,
  };
}

// Generate a comparison question based on level config
export function generateQuestion(level: ComparisonLevelConfig): ComparisonQuestion {
  const { enabledTypes, allowMixedTypes, numberRange, includeNegatives } = level;

  // Pick types for left and right values
  let leftType = enabledTypes[Math.floor(Math.random() * enabledTypes.length)];
  let rightType = allowMixedTypes
    ? enabledTypes[Math.floor(Math.random() * enabledTypes.length)]
    : leftType;

  // Generate values
  let left: ComparisonValue;
  let right: ComparisonValue;
  let category = 'mixed';

  // Generate based on types
  const generateForType = (type: ValueType): ComparisonValue => {
    switch (type) {
      case 'integer':
        return generateInteger(numberRange.min, numberRange.max, includeNegatives);
      case 'decimal':
        return generateDecimal(
          Math.max(-10, numberRange.min),
          Math.min(10, numberRange.max),
          Math.random() < 0.5 ? 1 : 2
        );
      case 'fraction':
        return Math.random() < 0.3 ? generateMixedNumber() : generateFraction();
      case 'word-number':
        return generateWordNumber();
      case 'percentage':
        return generatePercentage();
      case 'negative':
        return generateInteger(-100, -1, true);
      case 'special':
        return generateSpecial();
      case 'expression':
        return generateExpression();
      default:
        return generateInteger(1, 100);
    }
  };

  // Keep generating until we get a reasonable comparison
  let attempts = 0;
  do {
    left = generateForType(leftType);
    right = generateForType(rightType);
    attempts++;

    // Avoid comparisons that are too easy (e.g., 1 vs 1000000000)
    // Unless both are word numbers or both are the same type
    const ratio = Math.max(Math.abs(left.numericValue), 0.001) /
                  Math.max(Math.abs(right.numericValue), 0.001);

    if (leftType === rightType || !allowMixedTypes) {
      break; // Same type comparisons are fine
    }

    // For mixed types, ensure values are in similar magnitude
    if (ratio > 0.001 && ratio < 1000) {
      break;
    }
  } while (attempts < 10);

  // Determine category for hint generation
  if (leftType === rightType) {
    category = leftType;
  } else if ([leftType, rightType].includes('fraction') && [leftType, rightType].includes('decimal')) {
    category = 'fraction-decimal';
  } else if ([leftType, rightType].includes('percentage')) {
    category = 'percentage';
  }

  // Determine correct answer
  let correctAnswer: ComparisonResult;
  if (Math.abs(left.numericValue - right.numericValue) < 0.0001) {
    correctAnswer = 'equal';
  } else if (left.numericValue > right.numericValue) {
    correctAnswer = 'left';
  } else {
    correctAnswer = 'right';
  }

  // Generate hint
  const hint = generateHint(left, right, category);

  return {
    left,
    right,
    correctAnswer,
    hint,
    category,
  };
}

function generateHint(left: ComparisonValue, right: ComparisonValue, category: string): string {
  if (category === 'fraction-decimal') {
    return `Convert to decimals: ${left.display} = ${left.numericValue.toFixed(3)}, ${right.display} = ${right.numericValue.toFixed(3)}`;
  }

  if (category === 'fraction') {
    // Find common denominator hint
    return `Compare by converting to decimals or finding common denominators`;
  }

  if (category === 'percentage') {
    return `${left.display} = ${left.numericValue}, ${right.display} = ${right.numericValue}`;
  }

  if (category === 'word-number') {
    return `${left.display} = ${left.numericValue.toLocaleString()}, ${right.display} = ${right.numericValue.toLocaleString()}`;
  }

  if (category === 'expression') {
    return `Calculate: ${left.display} = ${left.numericValue}, ${right.display} = ${right.numericValue}`;
  }

  if (left.numericValue < 0 || right.numericValue < 0) {
    return `Remember: on a number line, numbers further right are bigger`;
  }

  return `${left.display} = ${left.numericValue}, ${right.display} = ${right.numericValue}`;
}

export default comparisonConfig;
