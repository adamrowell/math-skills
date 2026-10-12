// Chart Data Generator - Clean, simple questions for 7-year-olds
import {
  ChartType,
  QuestionType,
  InputType,
  ChartLevelConfig,
  ThemeCategory,
  chartThemes,
  chartColors,
  questionTemplates,
  teamNames,
  treasureItems,
} from '../../config/chartGameConfig';

// Data structures
export interface ChartDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface ChartSeries {
  name: string;
  data: number[];
  color: string;
}

export interface ChartData {
  id: string;
  type: ChartType;
  title: string;
  theme: ThemeCategory;
  data: ChartDataPoint[];
  unit: string;
  symbol?: string;
  series?: ChartSeries[];
  grid?: string[][];
  gridSize?: { rows: number; cols: number };
}

export interface ChartQuestion {
  id: string;
  chartData: ChartData;
  questionType: QuestionType;
  inputType: InputType;
  questionText: string;
  correctAnswer: string | number;
  options?: (string | number)[];
  targetItem?: string;
  hint?: string;
}

// Helpers
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Make chart values round so kids can read them easily
function getRoundValue(min: number, max: number): number {
  if (max <= 10) {
    // Small values: just use whole numbers
    return randomInRange(min, max);
  }
  if (max <= 30) {
    // Medium values: use multiples of 5
    const minMult = Math.ceil(min / 5);
    const maxMult = Math.floor(max / 5);
    return randomInRange(minMult, maxMult) * 5;
  }
  // Large values: use multiples of 10
  const minMult = Math.ceil(min / 10);
  const maxMult = Math.floor(max / 10);
  return randomInRange(minMult, maxMult) * 10;
}

// Generate standard chart data (bar, line, pie, pictograph)
function generateStandardChartData(level: ChartLevelConfig, chartType: ChartType): ChartData {
  const theme = randomElement(chartThemes);
  const numPoints = randomInRange(level.dataPoints.min, level.dataPoints.max);
  const selectedItems = shuffleArray(theme.items).slice(0, numPoints);

  const data: ChartDataPoint[] = selectedItems.map((name, index) => ({
    name,
    value: getRoundValue(level.dataRange.min, level.dataRange.max),
    color: chartColors[index % chartColors.length],
  }));

  // Ensure not all values are the same
  if (data.length > 1 && data.every(d => d.value === data[0].value)) {
    data[0].value = Math.min(data[0].value + 5, level.dataRange.max);
    data[1].value = Math.max(data[1].value - 3, level.dataRange.min);
  }

  return {
    id: generateId(),
    type: chartType,
    title: theme.name,
    theme,
    data,
    unit: theme.unit,
    symbol: theme.symbol,
  };
}

// Generate multi-line chart (Red Team vs Blue Team)
function generateMultiLineData(level: ChartLevelConfig): ChartData {
  // Use time-based themes for multi-line
  const timeThemes = chartThemes.filter(t =>
    t.items.some(item => ['Monday', 'Tuesday', 'Game 1'].some(d => item.includes(d) || item.startsWith('Game')))
  );
  const theme = timeThemes.length > 0 ? randomElement(timeThemes) : chartThemes[3]; // Default to "Books This Week"

  const numPoints = Math.min(5, randomInRange(level.dataPoints.min, level.dataPoints.max));
  const xLabels = theme.items.slice(0, numPoints);

  const series: ChartSeries[] = teamNames.slice(0, 2).map((team) => ({
    name: team.name,
    data: xLabels.map(() => getRoundValue(level.dataRange.min, level.dataRange.max)),
    color: team.color,
  }));

  // Primary data points for compatibility
  const data: ChartDataPoint[] = xLabels.map((name, i) => ({
    name,
    value: series[0].data[i],
    color: chartColors[i % chartColors.length],
  }));

  return {
    id: generateId(),
    type: 'multiLine',
    title: `${teamNames[0].name} vs ${teamNames[1].name}`,
    theme,
    data,
    series,
    unit: 'points',
    symbol: '🏆',
  };
}

// Generate coordinate grid (treasure map)
function generateCoordinateGridData(): ChartData {
  // Random grid size between 5x5 and 10x10
  const size = randomInRange(5, 10);
  const gridSize = { rows: size, cols: size };
  const grid: string[][] = [];

  // Initialize empty grid
  for (let y = 0; y < gridSize.rows; y++) {
    grid[y] = [];
    for (let x = 0; x < gridSize.cols; x++) {
      grid[y][x] = '';
    }
  }

  // Place treasures randomly (more treasures for larger grids)
  const numTreasures = randomInRange(4, Math.min(8, size));
  const placedPositions: { x: number; y: number; treasure: string }[] = [];
  const availableTreasures = shuffleArray([...treasureItems]);

  for (let i = 0; i < numTreasures; i++) {
    let x, y;
    let attempts = 0;
    do {
      x = randomInRange(0, gridSize.cols - 1);
      y = randomInRange(0, gridSize.rows - 1);
      attempts++;
    } while (grid[y][x] !== '' && attempts < 50);

    if (grid[y][x] === '') {
      const treasure = availableTreasures[i % availableTreasures.length];
      grid[y][x] = treasure;
      placedPositions.push({ x, y, treasure });
    }
  }

  // Create data points for compatibility
  const data: ChartDataPoint[] = placedPositions.map((p, i) => ({
    name: `(${p.x},${p.y})`,
    value: i + 1,
    color: chartColors[i % chartColors.length],
  }));

  return {
    id: generateId(),
    type: 'coordinateGrid',
    title: 'Treasure Map',
    theme: chartThemes[0],
    data,
    grid,
    gridSize,
    unit: 'treasure',
    symbol: '💎',
  };
}

// Main chart generator
export function generateChartData(level: ChartLevelConfig): ChartData {
  const chartType = randomElement(level.chartTypes);

  switch (chartType) {
    case 'multiLine':
      return generateMultiLineData(level);
    case 'coordinateGrid':
      return generateCoordinateGridData();
    default:
      return generateStandardChartData(level, chartType);
  }
}

// Get highest/lowest items
function getHighest(data: ChartDataPoint[]): ChartDataPoint {
  return data.reduce((max, d) => d.value > max.value ? d : max, data[0]);
}

function getLowest(data: ChartDataPoint[]): ChartDataPoint {
  return data.reduce((min, d) => d.value < min.value ? d : min, data[0]);
}

// Generate wrong number answers (close to correct)
function generateWrongNumbers(correct: number, count: number, min: number, max: number): number[] {
  const wrong: number[] = [];
  const offsets = [-2, -1, 1, 2, 3, -3];

  for (const offset of shuffleArray(offsets)) {
    const val = correct + offset;
    if (val !== correct && val >= min && val <= max && !wrong.includes(val)) {
      wrong.push(val);
      if (wrong.length >= count) break;
    }
  }

  // Fill with random if needed
  while (wrong.length < count) {
    const val = randomInRange(min, max);
    if (val !== correct && !wrong.includes(val)) {
      wrong.push(val);
    }
  }

  return wrong;
}

// Main question generator
export function generateQuestion(chartData: ChartData, level: ChartLevelConfig): ChartQuestion {
  // Filter valid question types for this chart
  let validTypes = level.questionTypes.filter(qt => {
    // Grid questions only for coordinate grids
    if ((qt === 'gridValue' || qt === 'clickGrid') && chartData.type !== 'coordinateGrid') return false;
    // compareLines only for multiLine
    if (qt === 'compareLines' && chartData.type !== 'multiLine') return false;
    // Skip grid questions for non-grid charts
    if (chartData.type === 'coordinateGrid' && !['gridValue', 'clickGrid'].includes(qt)) return false;
    // Click questions not great for pie charts
    if (qt.startsWith('click') && chartData.type === 'pie') return false;
    return true;
  });

  if (validTypes.length === 0) {
    validTypes = ['highest', 'lowest'];
  }

  const questionType = randomElement(validTypes);
  const template = randomElement(questionTemplates[questionType] || ['']);

  let questionText = '';
  let correctAnswer: string | number = '';
  let options: (string | number)[] | undefined;
  let targetItem: string | undefined;
  let hint: string | undefined;
  let inputType: InputType = 'multipleChoice';

  switch (questionType) {
    case 'highest':
    case 'clickHighest': {
      const highest = getHighest(chartData.data);
      questionText = template.replace('{unit}', chartData.unit);
      correctAnswer = highest.name;
      targetItem = highest.name;
      hint = `Look for the tallest bar!`;
      inputType = questionType === 'clickHighest' ? 'click' : 'multipleChoice';
      if (inputType === 'multipleChoice') {
        options = shuffleArray(chartData.data.map(d => d.name));
      }
      break;
    }

    case 'lowest':
    case 'clickLowest': {
      const lowest = getLowest(chartData.data);
      questionText = template.replace('{unit}', chartData.unit);
      correctAnswer = lowest.name;
      targetItem = lowest.name;
      hint = `Look for the shortest bar!`;
      inputType = questionType === 'clickLowest' ? 'click' : 'multipleChoice';
      if (inputType === 'multipleChoice') {
        options = shuffleArray(chartData.data.map(d => d.name));
      }
      break;
    }

    case 'value': {
      const item = randomElement(chartData.data);
      questionText = template.replace('{item}', item.name).replace('{unit}', chartData.unit);
      correctAnswer = item.value;
      targetItem = item.name;
      hint = `Find ${item.name} and read its number`;
      inputType = level.inputTypes.includes('typed') ? 'typed' : 'multipleChoice';
      if (inputType === 'multipleChoice') {
        options = shuffleArray([item.value, ...generateWrongNumbers(item.value, 3, level.dataRange.min, level.dataRange.max)]);
      }
      break;
    }

    case 'clickItem': {
      const item = randomElement(chartData.data);
      questionText = template.replace('{item}', item.name);
      correctAnswer = item.name;
      targetItem = item.name;
      hint = `Find ${item.name} on the chart!`;
      inputType = 'click';
      break;
    }

    case 'compare': {
      const shuffled = shuffleArray([...chartData.data]);
      const item1 = shuffled[0];
      const item2 = shuffled[1];
      questionText = template.replace('{item1}', item1.name).replace('{item2}', item2.name);
      correctAnswer = item1.value > item2.value ? item1.name : item2.name;
      hint = `Compare the heights of ${item1.name} and ${item2.name}`;
      inputType = 'multipleChoice';
      options = [item1.name, item2.name];
      break;
    }

    case 'difference': {
      // Pick two items where difference is reasonable
      const sorted = [...chartData.data].sort((a, b) => b.value - a.value);
      const bigger = sorted[0];
      const smaller = sorted[sorted.length - 1];
      const diff = bigger.value - smaller.value;

      questionText = template
        .replace('{item1}', bigger.name)
        .replace('{item2}', smaller.name)
        .replace('{unit}', chartData.unit);
      correctAnswer = diff;
      hint = `${bigger.value} minus ${smaller.value} = ?`;
      inputType = level.inputTypes.includes('typed') ? 'typed' : 'multipleChoice';
      if (inputType === 'multipleChoice') {
        options = shuffleArray([diff, ...generateWrongNumbers(diff, 3, 0, level.dataRange.max)]);
      }
      break;
    }

    case 'addTwo': {
      // Pick two items to add
      const shuffled = shuffleArray([...chartData.data]);
      const item1 = shuffled[0];
      const item2 = shuffled[1];
      const total = item1.value + item2.value;

      questionText = template.replace('{item1}', item1.name).replace('{item2}', item2.name);
      correctAnswer = total;
      hint = `${item1.value} plus ${item2.value} = ?`;
      inputType = level.inputTypes.includes('typed') ? 'typed' : 'multipleChoice';
      if (inputType === 'multipleChoice') {
        options = shuffleArray([total, ...generateWrongNumbers(total, 3, level.dataRange.min, level.dataRange.max * 2)]);
      }
      break;
    }

    case 'compareLines': {
      if (!chartData.series || chartData.series.length < 2) {
        // Fallback
        return generateQuestion({ ...chartData, type: 'bar' }, level);
      }

      const xIndex = randomInRange(0, chartData.data.length - 1);
      const xLabel = chartData.data[xIndex].name;
      const team1Val = chartData.series[0].data[xIndex];
      const team2Val = chartData.series[1].data[xIndex];
      const winner = team1Val > team2Val ? chartData.series[0].name : chartData.series[1].name;

      questionText = template.replace('{item}', xLabel);
      correctAnswer = winner;
      hint = `Compare the two dots on ${xLabel}`;
      inputType = 'multipleChoice';
      options = [chartData.series[0].name, chartData.series[1].name];
      break;
    }

    case 'gridValue': {
      if (!chartData.grid || !chartData.gridSize) {
        return generateQuestion({ ...chartData, type: 'bar' }, level);
      }

      // Collect all treasure positions
      const allTreasures: { x: number; y: number; treasure: string }[] = [];
      for (let y = 0; y < chartData.gridSize.rows; y++) {
        for (let x = 0; x < chartData.gridSize.cols; x++) {
          if (chartData.grid[y][x] !== '') {
            allTreasures.push({ x, y, treasure: chartData.grid[y][x] });
          }
        }
      }

      if (allTreasures.length === 0) {
        return generateQuestion({ ...chartData, type: 'bar' }, level);
      }

      // Pick a random treasure
      const selected = randomElement(allTreasures);
      const foundX = selected.x;
      const foundY = selected.y;
      const treasure = selected.treasure;

      questionText = template.replace('{x}', String(foundX)).replace('{y}', String(foundY));
      correctAnswer = treasure;
      targetItem = `${foundX},${foundY}`;
      hint = `Find column ${foundX}, row ${foundY}`;
      inputType = 'multipleChoice';

      // Options are the treasures on the grid
      const treasuresOnGrid = chartData.grid.flat().filter(t => t !== '');
      const otherTreasures = treasureItems.filter(t => t !== treasure && !treasuresOnGrid.includes(t));
      options = shuffleArray([treasure, ...shuffleArray(otherTreasures).slice(0, 3)]);
      break;
    }

    case 'clickGrid': {
      if (!chartData.grid || !chartData.gridSize) {
        return generateQuestion({ ...chartData, type: 'bar' }, level);
      }

      // Collect all treasure positions
      const allGridTreasures: { x: number; y: number }[] = [];
      for (let y = 0; y < chartData.gridSize.rows; y++) {
        for (let x = 0; x < chartData.gridSize.cols; x++) {
          if (chartData.grid[y][x] !== '') {
            allGridTreasures.push({ x, y });
          }
        }
      }

      if (allGridTreasures.length === 0) {
        return generateQuestion({ ...chartData, type: 'bar' }, level);
      }

      // Pick a random position
      const selectedPos = randomElement(allGridTreasures);
      const foundX = selectedPos.x;
      const foundY = selectedPos.y;

      questionText = template.replace('{x}', String(foundX)).replace('{y}', String(foundY));
      correctAnswer = `${foundX},${foundY}`;
      targetItem = `${foundX},${foundY}`;
      hint = `Row ${foundY}, Column ${foundX}`;
      inputType = 'click';
      break;
    }

    default: {
      // Fallback to highest
      const highest = getHighest(chartData.data);
      questionText = `Which has the most ${chartData.unit}?`;
      correctAnswer = highest.name;
      targetItem = highest.name;
      inputType = 'multipleChoice';
      options = shuffleArray(chartData.data.map(d => d.name));
    }
  }

  return {
    id: generateId(),
    chartData,
    questionType,
    inputType,
    questionText,
    correctAnswer,
    options,
    targetItem,
    hint,
  };
}

export function generateNewQuestion(level: ChartLevelConfig): ChartQuestion {
  const chartData = generateChartData(level);
  return generateQuestion(chartData, level);
}

export function checkAnswer(question: ChartQuestion, answer: string | number): boolean {
  const correct = question.correctAnswer;

  // String comparison (case-insensitive)
  if (typeof correct === 'string' && typeof answer === 'string') {
    return correct.toLowerCase().trim() === answer.toLowerCase().trim();
  }

  // Number comparison (with tolerance for decimals)
  if (typeof correct === 'number') {
    const numAnswer = typeof answer === 'string' ? parseFloat(answer) : answer;
    if (isNaN(numAnswer)) return false;
    return Math.abs(correct - numAnswer) < 0.5;
  }

  return String(correct) === String(answer);
}

export default {
  generateChartData,
  generateQuestion,
  generateNewQuestion,
  checkAnswer,
};
