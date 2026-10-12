// Algebra Problem Generator
// Generates equations and solve-for-x problems

import {
  AlgebraLevelConfig,
  AlgebraOperation,
  GraphLevelConfig,
  GraphQuestionType,
} from '../config/algebraConfig';

// Types
export interface AlgebraProblem {
  id: string;
  displayText: string;
  displayParts: DisplayPart[];
  answer: number;
  type: 'equation' | 'solveForX' | 'advanced';
  steps?: SolutionStep[];
  visualData?: VisualData;
}

export interface DisplayPart {
  type: 'number' | 'operator' | 'variable' | 'equals' | 'parenthesis' | 'unknown';
  value: string;
  highlight?: boolean;
}

export interface SolutionStep {
  description: string;
  equation: string;
}

export interface VisualData {
  leftSide: number;
  rightSide: number;
  coefficient?: number;
  constant?: number;
}

export interface GraphProblem {
  id: string;
  slope: number;
  yIntercept: number;
  equation: string;
  questionType: GraphQuestionType;
  questionText: string;
  answer: number | string;
  options?: (number | string)[];
  xValue?: number;
  yValue?: number;
  testPoint?: { x: number; y: number };
  compareSlope?: number;
}

// Helpers
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function getOperatorSymbol(op: AlgebraOperation): string {
  switch (op) {
    case 'add': return '+';
    case 'subtract': return '-';
    case 'multiply': return '×';
    case 'divide': return '÷';
  }
}

// Simple equation generator: 3 + 4 = ?
function generateSimpleEquation(level: AlgebraLevelConfig): AlgebraProblem {
  const op = randomChoice(level.operations);
  let a: number, b: number, answer: number;

  switch (op) {
    case 'add':
      a = randomInt(level.range.min, level.range.max);
      b = randomInt(level.range.min, level.range.max);
      answer = a + b;
      break;
    case 'subtract':
      answer = randomInt(level.range.min, level.range.max);
      b = randomInt(level.range.min, Math.min(answer, level.range.max));
      a = answer + b;
      break;
    case 'multiply':
      a = randomInt(level.range.min, level.range.max);
      b = randomInt(level.range.min, level.range.max);
      answer = a * b;
      break;
    case 'divide':
      b = randomInt(Math.max(1, level.range.min), level.range.max);
      answer = randomInt(level.range.min, level.range.max);
      a = b * answer;
      break;
    default:
      a = 1; b = 1; answer = 2;
  }

  const symbol = getOperatorSymbol(op);
  const displayText = `${a} ${symbol} ${b} = ?`;

  return {
    id: generateId(),
    displayText,
    displayParts: [
      { type: 'number', value: String(a) },
      { type: 'operator', value: symbol },
      { type: 'number', value: String(b) },
      { type: 'equals', value: '=' },
      { type: 'unknown', value: '?' },
    ],
    answer,
    type: 'equation',
  };
}

// Two-step equation: 3 × 4 + 2 = ?
function generateTwoStepEquation(level: AlgebraLevelConfig): AlgebraProblem {
  // Pick two operations - prefer multiply/divide first for order of operations
  const hasMultiply = level.operations.includes('multiply') || level.operations.includes('divide');
  const hasAddSub = level.operations.includes('add') || level.operations.includes('subtract');

  let a: number, b: number, c: number, answer: number;
  let op1: AlgebraOperation, op2: AlgebraOperation;

  if (hasMultiply && hasAddSub) {
    // multiplication/division first, then add/subtract
    op1 = level.operations.includes('multiply') ? 'multiply' : 'divide';
    op2 = randomChoice(['add', 'subtract'].filter(o => level.operations.includes(o as AlgebraOperation)) as AlgebraOperation[]) || 'add';

    if (op1 === 'multiply') {
      a = randomInt(2, Math.min(5, level.range.max));
      b = randomInt(2, Math.min(5, level.range.max));
      c = randomInt(1, Math.min(10, level.range.max));
      answer = op2 === 'add' ? (a * b) + c : (a * b) - c;
    } else {
      b = randomInt(2, Math.min(5, level.range.max));
      const quotient = randomInt(2, Math.min(5, level.range.max));
      a = b * quotient;
      c = randomInt(1, Math.min(10, level.range.max));
      answer = op2 === 'add' ? quotient + c : quotient - c;
    }
  } else {
    // Just add/subtract
    op1 = 'add';
    op2 = 'subtract';
    a = randomInt(level.range.min, level.range.max);
    b = randomInt(level.range.min, level.range.max);
    c = randomInt(1, Math.min(a + b - 1, level.range.max));
    answer = a + b - c;
  }

  // Ensure positive answer
  if (answer < 0) {
    return generateTwoStepEquation(level);
  }

  const sym1 = getOperatorSymbol(op1);
  const sym2 = getOperatorSymbol(op2);
  const displayText = `${a} ${sym1} ${b} ${sym2} ${c} = ?`;

  return {
    id: generateId(),
    displayText,
    displayParts: [
      { type: 'number', value: String(a) },
      { type: 'operator', value: sym1 },
      { type: 'number', value: String(b) },
      { type: 'operator', value: sym2 },
      { type: 'number', value: String(c) },
      { type: 'equals', value: '=' },
      { type: 'unknown', value: '?' },
    ],
    answer,
    type: 'equation',
    steps: [
      { description: `First, do ${a} ${sym1} ${b}`, equation: `${op1 === 'multiply' ? a * b : a / b}` },
      { description: `Then, ${sym2} ${c}`, equation: `${answer}` },
    ],
  };
}

// Parentheses equation: (3 + 2) × 4 = ?
function generateParenthesesEquation(level: AlgebraLevelConfig): AlgebraProblem {
  const innerOp = randomChoice(['add', 'subtract'] as AlgebraOperation[]);
  const outerOp = randomChoice(['multiply'] as AlgebraOperation[]);

  let a: number, b: number, c: number, innerResult: number, answer: number;

  a = randomInt(2, Math.min(6, level.range.max));
  b = randomInt(1, Math.min(5, level.range.max));
  c = randomInt(2, Math.min(5, level.range.max));

  if (innerOp === 'add') {
    innerResult = a + b;
  } else {
    // Make sure a > b for subtraction
    if (a <= b) {
      [a, b] = [b + 1, a];
    }
    innerResult = a - b;
  }

  answer = innerResult * c;

  const innerSym = getOperatorSymbol(innerOp);
  const outerSym = getOperatorSymbol(outerOp);
  const displayText = `(${a} ${innerSym} ${b}) ${outerSym} ${c} = ?`;

  return {
    id: generateId(),
    displayText,
    displayParts: [
      { type: 'parenthesis', value: '(' },
      { type: 'number', value: String(a) },
      { type: 'operator', value: innerSym },
      { type: 'number', value: String(b) },
      { type: 'parenthesis', value: ')' },
      { type: 'operator', value: outerSym },
      { type: 'number', value: String(c) },
      { type: 'equals', value: '=' },
      { type: 'unknown', value: '?' },
    ],
    answer,
    type: 'equation',
    steps: [
      { description: `First, solve inside parentheses: ${a} ${innerSym} ${b}`, equation: `${innerResult}` },
      { description: `Then multiply: ${innerResult} ${outerSym} ${c}`, equation: `${answer}` },
    ],
  };
}

// Simple solve for X: x + 3 = 7 or 3 + x = 7
function generateSimpleSolveForX(level: AlgebraLevelConfig): AlgebraProblem {
  const op = randomChoice(level.operations);
  let answer: number, constant: number, result: number;
  let displayText: string;
  let parts: DisplayPart[];
  let steps: SolutionStep[];

  answer = randomInt(level.answerRange.min, level.answerRange.max);

  switch (op) {
    case 'add':
      constant = randomInt(level.range.min, level.range.max);
      result = answer + constant;
      // Randomly put x first or second
      if (Math.random() > 0.5) {
        displayText = `x + ${constant} = ${result}`;
        parts = [
          { type: 'variable', value: 'x', highlight: true },
          { type: 'operator', value: '+' },
          { type: 'number', value: String(constant) },
          { type: 'equals', value: '=' },
          { type: 'number', value: String(result) },
        ];
        steps = [
          { description: `Subtract ${constant} from both sides`, equation: `x = ${result} - ${constant}` },
          { description: 'Calculate', equation: `x = ${answer}` },
        ];
      } else {
        displayText = `${constant} + x = ${result}`;
        parts = [
          { type: 'number', value: String(constant) },
          { type: 'operator', value: '+' },
          { type: 'variable', value: 'x', highlight: true },
          { type: 'equals', value: '=' },
          { type: 'number', value: String(result) },
        ];
        steps = [
          { description: `Subtract ${constant} from both sides`, equation: `x = ${result} - ${constant}` },
          { description: 'Calculate', equation: `x = ${answer}` },
        ];
      }
      break;

    case 'subtract':
      constant = randomInt(1, Math.min(answer, level.range.max));
      result = answer - constant;
      displayText = `x - ${constant} = ${result}`;
      parts = [
        { type: 'variable', value: 'x', highlight: true },
        { type: 'operator', value: '-' },
        { type: 'number', value: String(constant) },
        { type: 'equals', value: '=' },
        { type: 'number', value: String(result) },
      ];
      steps = [
        { description: `Add ${constant} to both sides`, equation: `x = ${result} + ${constant}` },
        { description: 'Calculate', equation: `x = ${answer}` },
      ];
      break;

    case 'multiply':
      constant = randomInt(2, Math.min(10, level.range.max));
      result = answer * constant;
      displayText = `${constant}x = ${result}`;
      parts = [
        { type: 'number', value: String(constant) },
        { type: 'variable', value: 'x', highlight: true },
        { type: 'equals', value: '=' },
        { type: 'number', value: String(result) },
      ];
      steps = [
        { description: `Divide both sides by ${constant}`, equation: `x = ${result} ÷ ${constant}` },
        { description: 'Calculate', equation: `x = ${answer}` },
      ];
      break;

    case 'divide':
      constant = randomInt(2, Math.min(10, level.range.max));
      result = answer; // x / constant = result, so x = result * constant
      answer = result * constant;
      displayText = `x ÷ ${constant} = ${result}`;
      parts = [
        { type: 'variable', value: 'x', highlight: true },
        { type: 'operator', value: '÷' },
        { type: 'number', value: String(constant) },
        { type: 'equals', value: '=' },
        { type: 'number', value: String(result) },
      ];
      steps = [
        { description: `Multiply both sides by ${constant}`, equation: `x = ${result} × ${constant}` },
        { description: 'Calculate', equation: `x = ${answer}` },
      ];
      break;

    default:
      constant = 1;
      result = answer + 1;
      displayText = `x + 1 = ${result}`;
      parts = [];
      steps = [];
  }

  return {
    id: generateId(),
    displayText,
    displayParts: parts,
    answer,
    type: 'solveForX',
    steps,
    visualData: {
      leftSide: answer,
      rightSide: result,
      constant,
    },
  };
}

// Two-step solve for X: 2x + 3 = 11
function generateTwoStepSolveForX(level: AlgebraLevelConfig): AlgebraProblem {
  const answer = randomInt(level.answerRange.min, level.answerRange.max);
  const coefficient = randomInt(2, Math.min(5, level.range.max));
  const constant = randomInt(1, Math.min(10, level.range.max));
  const addOrSub = Math.random() > 0.5;

  let result: number;
  let displayText: string;
  let parts: DisplayPart[];
  let steps: SolutionStep[];

  if (addOrSub) {
    result = coefficient * answer + constant;
    displayText = `${coefficient}x + ${constant} = ${result}`;
    parts = [
      { type: 'number', value: String(coefficient) },
      { type: 'variable', value: 'x', highlight: true },
      { type: 'operator', value: '+' },
      { type: 'number', value: String(constant) },
      { type: 'equals', value: '=' },
      { type: 'number', value: String(result) },
    ];
    steps = [
      { description: `Subtract ${constant} from both sides`, equation: `${coefficient}x = ${result - constant}` },
      { description: `Divide both sides by ${coefficient}`, equation: `x = ${(result - constant) / coefficient}` },
    ];
  } else {
    result = coefficient * answer - constant;
    if (result < 1) {
      return generateTwoStepSolveForX(level);
    }
    displayText = `${coefficient}x - ${constant} = ${result}`;
    parts = [
      { type: 'number', value: String(coefficient) },
      { type: 'variable', value: 'x', highlight: true },
      { type: 'operator', value: '-' },
      { type: 'number', value: String(constant) },
      { type: 'equals', value: '=' },
      { type: 'number', value: String(result) },
    ];
    steps = [
      { description: `Add ${constant} to both sides`, equation: `${coefficient}x = ${result + constant}` },
      { description: `Divide both sides by ${coefficient}`, equation: `x = ${(result + constant) / coefficient}` },
    ];
  }

  return {
    id: generateId(),
    displayText,
    displayParts: parts,
    answer,
    type: 'advanced',
    steps,
    visualData: {
      leftSide: answer,
      rightSide: result,
      coefficient,
      constant,
    },
  };
}

// Variable on both sides: x + 3 = 2x - 5
function generateBothSidesSolveForX(level: AlgebraLevelConfig): AlgebraProblem {
  const answer = randomInt(level.answerRange.min, level.answerRange.max);

  // Create equation where x + a = bx + c, solution is x
  // x + a = bx + c → a - c = bx - x → a - c = (b-1)x → x = (a-c)/(b-1)
  // Work backwards: pick answer, coefficient diff, calculate constants
  const leftCoeff = 1;
  const rightCoeff = randomInt(2, 3);
  const coeffDiff = rightCoeff - leftCoeff;

  // answer = (leftConst - rightConst) / coeffDiff
  // answer * coeffDiff = leftConst - rightConst
  const constDiff = answer * coeffDiff;
  const rightConst = randomInt(1, 10);
  const leftConst = constDiff + rightConst;

  const displayText = `x + ${leftConst} = ${rightCoeff}x + ${rightConst}`;
  const parts: DisplayPart[] = [
    { type: 'variable', value: 'x', highlight: true },
    { type: 'operator', value: '+' },
    { type: 'number', value: String(leftConst) },
    { type: 'equals', value: '=' },
    { type: 'number', value: String(rightCoeff) },
    { type: 'variable', value: 'x', highlight: true },
    { type: 'operator', value: '+' },
    { type: 'number', value: String(rightConst) },
  ];

  const steps: SolutionStep[] = [
    { description: `Subtract x from both sides`, equation: `${leftConst} = ${rightCoeff - 1}x + ${rightConst}` },
    { description: `Subtract ${rightConst} from both sides`, equation: `${leftConst - rightConst} = ${rightCoeff - 1}x` },
    { description: `Divide both sides by ${rightCoeff - 1}`, equation: `x = ${answer}` },
  ];

  return {
    id: generateId(),
    displayText,
    displayParts: parts,
    answer,
    type: 'advanced',
    steps,
  };
}

// Main algebra problem generator
export function generateAlgebraProblem(level: AlgebraLevelConfig): AlgebraProblem {
  if (level.mode === 'equations') {
    if (level.useParentheses) {
      return Math.random() > 0.5
        ? generateParenthesesEquation(level)
        : generateTwoStepEquation(level);
    } else if (level.multiStep) {
      return generateTwoStepEquation(level);
    } else {
      return generateSimpleEquation(level);
    }
  } else if (level.mode === 'solveForX') {
    if (level.multiStep) {
      return generateTwoStepSolveForX(level);
    } else {
      return generateSimpleSolveForX(level);
    }
  } else {
    // Advanced mode
    if (level.variableOnBothSides && Math.random() > 0.5) {
      return generateBothSidesSolveForX(level);
    } else if (level.multiStep) {
      return generateTwoStepSolveForX(level);
    } else {
      return generateSimpleSolveForX(level);
    }
  }
}

// Format equation string helper
function formatEquation(slope: number, yIntercept: number): string {
  if (slope === 0) {
    return `y = ${yIntercept}`;
  } else if (slope === 1) {
    return yIntercept === 0 ? 'y = x' : yIntercept > 0 ? `y = x + ${yIntercept}` : `y = x - ${Math.abs(yIntercept)}`;
  } else if (slope === -1) {
    return yIntercept === 0 ? 'y = -x' : yIntercept > 0 ? `y = -x + ${yIntercept}` : `y = -x - ${Math.abs(yIntercept)}`;
  } else {
    if (yIntercept === 0) {
      return `y = ${slope}x`;
    } else if (yIntercept > 0) {
      return `y = ${slope}x + ${yIntercept}`;
    } else {
      return `y = ${slope}x - ${Math.abs(yIntercept)}`;
    }
  }
}

// Graph problem generator
export function generateGraphProblem(level: GraphLevelConfig): GraphProblem {
  const slope = randomInt(level.slopeRange.min, level.slopeRange.max);
  const yIntercept = randomInt(level.interceptRange.min, level.interceptRange.max);
  const questionType = randomChoice(level.questionTypes);

  const equation = formatEquation(slope, yIntercept);

  let questionText: string;
  let answer: number | string;
  let xValue: number | undefined;
  let yValue: number | undefined;
  let testPoint: { x: number; y: number } | undefined;
  let options: (number | string)[] | undefined;
  let compareSlope: number | undefined;

  switch (questionType) {
    case 'yForX':
      // Use negative x values most of the time (70%)
      if (Math.random() < 0.7) {
        xValue = randomInt(-4, -1);
      } else {
        xValue = randomInt(1, 4);
      }
      answer = slope * xValue + yIntercept;
      questionText = `What is y when x = ${xValue}?`;
      options = generateWrongOptions(answer as number, 4);
      break;

    case 'xForY':
      // Make sure y gives a nice x value (can be negative)
      if (Math.random() < 0.6) {
        xValue = randomInt(-3, -1);
      } else {
        xValue = randomInt(1, 3);
      }
      yValue = slope * xValue + yIntercept;
      answer = xValue;
      questionText = `What is x when y = ${yValue}?`;
      options = generateWrongOptions(answer as number, 4);
      break;

    case 'yIntercept':
      answer = yIntercept;
      questionText = 'Where does the line cross the y-axis? (y = ?)';
      options = generateWrongOptions(answer as number, 4);
      break;

    case 'xIntercept':
      // x-intercept is where y = 0, so x = -yIntercept / slope
      if (slope === 0) {
        // Horizontal line doesn't cross x-axis (unless yIntercept is 0)
        // Fall back to yIntercept question
        answer = yIntercept;
        questionText = 'Where does the line cross the y-axis? (y = ?)';
        options = generateWrongOptions(answer as number, 4);
      } else {
        const xInt = -yIntercept / slope;
        // Only ask if x-intercept is a nice integer
        if (Number.isInteger(xInt)) {
          answer = xInt;
          questionText = 'Where does the line cross the x-axis? (x = ?)';
          options = generateWrongOptions(answer as number, 4);
        } else {
          // Fall back to another question type
          xValue = randomInt(-3, 3);
          if (xValue === 0) xValue = 1;
          answer = slope * xValue + yIntercept;
          questionText = `What is y when x = ${xValue}?`;
          options = generateWrongOptions(answer as number, 4);
        }
      }
      break;

    case 'slopeDirection':
      answer = slope > 0 ? 'Up' : slope < 0 ? 'Down' : 'Flat';
      questionText = 'As you move right, does the line go up, down, or stay flat?';
      options = ['Up', 'Down', 'Flat'];
      break;

    case 'increasing':
      answer = slope > 0 ? 'Increasing' : slope < 0 ? 'Decreasing' : 'Neither';
      questionText = 'Is this line increasing or decreasing?';
      options = ['Increasing', 'Decreasing', 'Neither'];
      break;

    case 'slopeValue':
      answer = slope;
      questionText = 'What is the slope of this line?';
      options = generateWrongOptions(slope, 4);
      break;

    case 'steeper':
      compareSlope = slope + (Math.random() > 0.5 ? 1 : -1) * randomInt(1, 2);
      if (compareSlope === slope) compareSlope = slope + 1;
      answer = Math.abs(slope) > Math.abs(compareSlope) ? 'Blue line' : Math.abs(slope) < Math.abs(compareSlope) ? 'Orange line' : 'Same';
      questionText = `Which line is steeper?`;
      options = ['Blue line', 'Orange line', 'Same'];
      break;

    case 'pointOnLine':
      // Generate a point that might or might not be on the line
      // Use negative x values sometimes
      const onLine = Math.random() > 0.5;
      xValue = Math.random() < 0.5 ? randomInt(-3, -1) : randomInt(1, 3);
      if (onLine) {
        yValue = slope * xValue + yIntercept;
        answer = 'Yes';
      } else {
        yValue = slope * xValue + yIntercept + (Math.random() > 0.5 ? 1 : -1) * randomInt(1, 3);
        answer = 'No';
      }
      testPoint = { x: xValue, y: yValue };
      questionText = `Is the point (${xValue}, ${yValue}) on the line?`;
      options = ['Yes', 'No'];
      break;

    default:
      xValue = randomInt(-2, 2);
      if (xValue === 0) xValue = 1;
      answer = slope * xValue + yIntercept;
      questionText = `What is y when x = ${xValue}?`;
      options = generateWrongOptions(answer as number, 4);
  }

  return {
    id: generateId(),
    slope,
    yIntercept,
    equation,
    questionType,
    questionText,
    answer,
    options,
    xValue,
    yValue,
    testPoint,
    compareSlope,
  };
}

// Generate wrong options close to the correct answer
function generateWrongOptions(correct: number, count: number): number[] {
  const options = new Set<number>([correct]);
  const offsets = [-3, -2, -1, 1, 2, 3, 4, -4];

  for (const offset of offsets) {
    if (options.size >= count) break;
    const wrong = correct + offset;
    if (wrong >= -10 && wrong <= 100) {
      options.add(wrong);
    }
  }

  // Shuffle the array
  return Array.from(options).sort(() => Math.random() - 0.5);
}

// Check answer
export function checkAlgebraAnswer(problem: AlgebraProblem, answer: number): boolean {
  return Math.abs(problem.answer - answer) < 0.001;
}

export function checkGraphAnswer(problem: GraphProblem, answer: number | string): boolean {
  if (typeof problem.answer === 'string') {
    return String(answer).toLowerCase() === problem.answer.toLowerCase();
  }
  return Number(answer) === problem.answer;
}

export default {
  generateAlgebraProblem,
  generateGraphProblem,
  checkAlgebraAnswer,
  checkGraphAnswer,
};
