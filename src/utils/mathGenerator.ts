import { LevelConfig } from '../config/gameConfig';

export type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division';

export interface MathProblem {
  id: string;
  operand1: number;
  operand2: number;
  operation: Operation;
  answer: number;
  displayText: string;
  operationSymbol: string;
}

const operationSymbols: Record<Operation, string> = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷',
};

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateAddition(levelConfig: LevelConfig): MathProblem {
  const { min, max } = levelConfig.addition;
  const operand1 = getRandomInt(min, max);
  const operand2 = getRandomInt(min, max);
  const answer = operand1 + operand2;

  return {
    id: crypto.randomUUID(),
    operand1,
    operand2,
    operation: 'addition',
    answer,
    displayText: `${operand1} + ${operand2}`,
    operationSymbol: operationSymbols.addition,
  };
}

function generateSubtraction(levelConfig: LevelConfig): MathProblem {
  const { minuendMax } = levelConfig.subtraction;
  // Ensure result is never negative
  const operand1 = getRandomInt(0, minuendMax);
  const operand2 = getRandomInt(0, operand1); // operand2 <= operand1
  const answer = operand1 - operand2;

  return {
    id: crypto.randomUUID(),
    operand1,
    operand2,
    operation: 'subtraction',
    answer,
    displayText: `${operand1} − ${operand2}`,
    operationSymbol: operationSymbols.subtraction,
  };
}

function generateMultiplication(levelConfig: LevelConfig): MathProblem {
  const { min, max } = levelConfig.multiplication;
  const operand1 = getRandomInt(min, max);
  const operand2 = getRandomInt(min, max);
  const answer = operand1 * operand2;

  return {
    id: crypto.randomUUID(),
    operand1,
    operand2,
    operation: 'multiplication',
    answer,
    displayText: `${operand1} × ${operand2}`,
    operationSymbol: operationSymbols.multiplication,
  };
}

function generateDivision(levelConfig: LevelConfig): MathProblem {
  const { dividendMax } = levelConfig.division;
  // Generate clean division problems
  // Pick a divisor from 1-12, then pick a result, then calculate dividend
  const divisor = getRandomInt(1, Math.min(12, dividendMax));
  const maxResult = Math.floor(dividendMax / divisor);
  const result = getRandomInt(0, maxResult);
  const dividend = divisor * result;

  return {
    id: crypto.randomUUID(),
    operand1: dividend,
    operand2: divisor,
    operation: 'division',
    answer: result,
    displayText: `${dividend} ÷ ${divisor}`,
    operationSymbol: operationSymbols.division,
  };
}

const generators: Record<Operation, (config: LevelConfig) => MathProblem> = {
  addition: generateAddition,
  subtraction: generateSubtraction,
  multiplication: generateMultiplication,
  division: generateDivision,
};

export function generateProblem(
  levelConfig: LevelConfig,
  excludeId?: string
): MathProblem {
  const operations: Operation[] = ['addition', 'subtraction', 'multiplication', 'division'];
  const operation = operations[getRandomInt(0, operations.length - 1)];

  let problem = generators[operation](levelConfig);

  // Make sure we don't generate the same problem twice in a row
  while (problem.id === excludeId) {
    problem = generators[operation](levelConfig);
  }

  return problem;
}

export function generateProblemQueue(
  levelConfig: LevelConfig,
  count: number
): MathProblem[] {
  const problems: MathProblem[] = [];
  let lastId: string | undefined;

  for (let i = 0; i < count; i++) {
    const problem = generateProblem(levelConfig, lastId);
    problems.push(problem);
    lastId = problem.id;
  }

  return problems;
}

export function checkAnswer(problem: MathProblem, userAnswer: number): boolean {
  return problem.answer === userAnswer;
}
