// Multiplication Table Game Configuration

export type TableGameMode = 'learn' | 'practice-mult' | 'practice-div';
export type HideMode = 'none' | 'answer' | 'row-col' | 'all';
export type PatternType = 'squares' | 'multiples' | null;

export interface TableQuestion {
  row: number;
  col: number;
  answer: number;
  operation: 'mult' | 'div';
  displayText: string; // "7 × 8" or "56 ÷ 8"
}

export const tableConfig = {
  // Grid settings
  gridSize: 12, // 12×12 table

  // Timer settings
  timerDuration: 10 * 60, // 10 minutes in seconds
  timerEnabled: true, // Can be disabled for learn mode

  // Input settings
  autoSubmitDelay: 250, // milliseconds to wait before auto-submit on correct answer

  // Gamification settings
  defaultTargetPerMinute: 8,
  questionsToWin: 20, // Number of questions to complete to win

  // Voice recognition
  voiceEnabled: true,
  voiceAutoSubmit: true,

  // Visual settings
  showTooltip: true,
  showAreaHighlight: true,
  animationDuration: 200, // milliseconds

  // Colors (CSS variables are defined in CSS, these are for reference)
  colors: {
    normalCell: '#ffffff',
    areaHighlight: '#E3F2FD',
    hoveredCell: '#2196F3',
    factorHeader: '#FFD54F',
    hiddenCell: '#9E9E9E',
    squareNumber: '#E8F5E9',
  },
};

export interface TableLevelConfig {
  id: number;
  name: string;
  description: string;
  mode: TableGameMode;
  hideMode: HideMode;
  timerEnabled: boolean;
  targetPerMinute: number;
  questionsToWin: number;
  color: string;
  emoji: string;
}

export const tableLevels: TableLevelConfig[] = [
  {
    id: 1,
    name: "Table Practice",
    description: "Multiplication with the full table visible",
    mode: 'practice-mult',
    hideMode: 'none',
    timerEnabled: true,
    targetPerMinute: 6,
    questionsToWin: 15,
    color: "#2196F3",
    emoji: "📊",
  },
  {
    id: 2,
    name: "Hidden Answer",
    description: "The answer cell is hidden - find it!",
    mode: 'practice-mult',
    hideMode: 'answer',
    timerEnabled: true,
    targetPerMinute: 7,
    questionsToWin: 20,
    color: "#9C27B0",
    emoji: "🎯",
  },
  {
    id: 3,
    name: "Division",
    description: "56 ÷ 8 = ? Find the missing factor!",
    mode: 'practice-div',
    hideMode: 'answer',
    timerEnabled: true,
    targetPerMinute: 6,
    questionsToWin: 20,
    color: "#F44336",
    emoji: "➗",
  },
];

// Generate a random question based on mode
export function generateTableQuestion(mode: TableGameMode, previousQuestion?: TableQuestion | null): TableQuestion {
  const gridSize = tableConfig.gridSize;

  // Generate random row and column (1-12)
  let row: number, col: number;
  do {
    row = Math.floor(Math.random() * gridSize) + 1;
    col = Math.floor(Math.random() * gridSize) + 1;
  } while (
    previousQuestion &&
    row === previousQuestion.row &&
    col === previousQuestion.col
  );

  const product = row * col;

  if (mode === 'practice-div') {
    // For division, ask "product ÷ col = ?" (answer is row)
    // Randomly choose whether to divide by row or column
    const divideByRow = Math.random() < 0.5;
    if (divideByRow) {
      return {
        row,
        col,
        answer: col,
        operation: 'div',
        displayText: `${product} ÷ ${row} = ?`,
      };
    } else {
      return {
        row,
        col,
        answer: row,
        operation: 'div',
        displayText: `${product} ÷ ${col} = ?`,
      };
    }
  } else {
    // Multiplication: "row × col = ?"
    return {
      row,
      col,
      answer: product,
      operation: 'mult',
      displayText: `${row} × ${col} = ?`,
    };
  }
}

export default tableConfig;
