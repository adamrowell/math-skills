/**
 * Logic Puzzles — shared contracts (frozen; see docs/GEO-LOGIC.md §E).
 *
 * Two builders code against this file in parallel:
 *   builder 3 → engine (session, scheduling, scoring, UI shell, the <Visual/> renderer) and the
 *               number / verbal-free families under src/apps/logic/families/*.ts
 *   builder 4 → the visual families under src/apps/logic/families/visual/** and the pure
 *               shape helpers in src/apps/logic/engine/shapes.ts
 *
 * Everything a family produces is PLAIN DATA (no React, no DOM): a prompt, a VisualSpec, an
 * AnswerSpec and explanation steps. One renderer turns a VisualSpec into SVG. This is what lets
 * generators be unit-tested in node and lets the two builders never touch each other's files.
 */

// ---------------------------------------------------------------------------------------------
// Difficulty, families, rng
// ---------------------------------------------------------------------------------------------

/** 1 = easy, 2 = medium, 3 = hard (a 7-year-old's "hard"). */
export type Difficulty = 1 | 2 | 3;

export type Rng = () => number;

export type FamilyGroup = 'number' | 'shape' | 'spatial' | 'logic';

export type FamilyId =
  // builder 3 — src/apps/logic/families/*.ts
  | 'seq-number' // 2, 4, 6, 8, ? · ×2 · alternating · Fibonacci-like at hard
  | 'number-box' // missing number in a grid / sum square / function machine
  | 'rule-machine' // in → out pairs: 3→7, 5→11, 8→?  (what is the rule)
  | 'code-break' // symbol = number; sums of symbol rows → value of a symbol / a row
  | 'balance' // scale pictures → which is heaviest / how many to balance
  | 'clock-calendar' // clock hands patterns, "what time in 2 hours", day-of-week sequences
  | 'mini-sudoku' // 4×4 tap-to-fill (digits or shapes), exactly one solution
  | 'maze-path' // which drawn route is shortest / how many steps
  | 'odd-one-out' // 4–6 items, exactly one breaks the shared rule
  | 'analogy' // A : B :: C : ?
  // builder 4 — src/apps/logic/families/visual/*.ts
  | 'seq-shape' // shape/colour/size/rotation sequences, what comes next
  | 'growing-pattern' // 1, 3, 6 dots… how many in the next figure / which figure is next
  | 'matrix' // 3×3 Raven-style: row/column rules on shape, count, fill, rotation
  | 'mirror' // which option is the mirror image across the shown line
  | 'rotation' // which option is the same figure rotated (others are flipped / altered)
  | 'symmetry-fill' // complete the symmetric picture by tapping cells
  | 'paper-fold' // folded + punched → which unfolded sheet (hard)
  | 'count-figures' // how many triangles / squares in the figure (exact count verified)
  | 'pattern-block' // which piece completes the pattern / fills the hole
  | 'tangram-fit'; // which two pieces together make the target shape

export const FAMILY_IDS: readonly FamilyId[] = [
  'seq-number',
  'number-box',
  'rule-machine',
  'code-break',
  'balance',
  'clock-calendar',
  'mini-sudoku',
  'maze-path',
  'odd-one-out',
  'analogy',
  'seq-shape',
  'growing-pattern',
  'matrix',
  'mirror',
  'rotation',
  'symmetry-fill',
  'paper-fold',
  'count-figures',
  'pattern-block',
  'tangram-fit',
];

// ---------------------------------------------------------------------------------------------
// VisualSpec — a tiny declarative SVG grammar (data only; rendered by engine/Visual.tsx)
// ---------------------------------------------------------------------------------------------

/**
 * Named colours only, so every family looks the same and the renderer owns the palette
 * (light theme values in docs/GEO-LOGIC.md §E.4). 'ink' = outline/text colour, 'none' = transparent.
 */
export type Color =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'orange'
  | 'pink'
  | 'teal'
  | 'brown'
  | 'grey'
  | 'ink'
  | 'white'
  | 'none';

export const COLORS: readonly Color[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];

export type ShapeKind =
  | 'circle'
  | 'square'
  | 'rect' // width = size, height = size * aspect (default 0.6)
  | 'triangle' // equilateral, points up
  | 'right-triangle' // right angle at bottom-left
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'heart'
  | 'cross'
  | 'arrow' // points right at rotate 0
  | 'moon'
  | 'semicircle' // flat side down
  | 'trapezoid'
  | 'parallelogram'
  | 'L' // an L-shaped block (3 squares); the one shape with no symmetry axis
  | 'dot'; // small filled circle (size = diameter), used for counting/dice patterns

export type FillPattern = 'solid' | 'empty' | 'striped' | 'dotted' | 'hatched' | 'half';

interface BaseNode {
  /** Optional id for explanation highlights (`ExplainStep.highlight`). */
  id?: string;
  opacity?: number;
}

/** A shape centred at (x, y); `size` is the diameter of its bounding circle in user units. */
export interface ShapeNode extends BaseNode {
  t: 'shape';
  kind: ShapeKind;
  x: number;
  y: number;
  size: number;
  fill?: Color;
  /** Default 'ink'. */
  stroke?: Color;
  /** Default 2.5. */
  strokeWidth?: number;
  /** Degrees, clockwise, about the centre. */
  rotate?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Default 'solid'. Patterns are drawn in the fill colour over a white base. */
  pattern?: FillPattern;
  /** rect / parallelogram only: height ÷ width. */
  aspect?: number;
}

export interface TextNode extends BaseNode {
  t: 'text';
  x: number;
  y: number;
  text: string;
  /** Font size in user units (default 18). */
  size?: number;
  fill?: Color;
  /** Default 'middle' (x is the centre). */
  anchor?: 'start' | 'middle' | 'end';
  weight?: 700 | 900;
}

/** An emoji glyph (fruit on a scale, animals in a sequence). Rendered as <text>. */
export interface EmojiNode extends BaseNode {
  t: 'emoji';
  x: number;
  y: number;
  char: string;
  size: number;
}

export interface LineNode extends BaseNode {
  t: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: Color;
  strokeWidth?: number;
  dash?: boolean;
  arrow?: 'end' | 'both';
}

/** Raw SVG path in user units (mazes, fold creases, cut-outs). */
export interface PathNode extends BaseNode {
  t: 'path';
  d: string;
  fill?: Color;
  stroke?: Color;
  strokeWidth?: number;
  dash?: boolean;
  pattern?: FillPattern;
}

/**
 * Cells drawn as squares; `cell` = side length. A cell may carry a fill and/or a node drawn in
 * the cell's own coordinates (0..cell, origin top-left). Used by matrices, sudoku, symmetry,
 * mazes, number boxes.
 */
export interface GridNode extends BaseNode {
  t: 'grid';
  x: number;
  y: number;
  rows: number;
  cols: number;
  cell: number;
  /** Draw cell borders (default true). */
  lines?: boolean;
  stroke?: Color;
  cells?: GridCell[];
  /** Cells that are the question mark ("?") — drawn with a dashed border and a big '?'. */
  unknown?: Array<{ r: number; c: number }>;
}

export interface GridCell {
  r: number;
  c: number;
  fill?: Color;
  node?: VisualNode;
  /** Short text centred in the cell (digits, letters). */
  label?: string;
  /** A tap target in tap-to-fill answers; carries the cell key. */
  key?: string;
}

/** Analogue clock, `r` = radius. Minute hand omitted when `minute` is undefined. */
export interface ClockNode extends BaseNode {
  t: 'clock';
  x: number;
  y: number;
  r: number;
  hour: number;
  minute?: number;
}

/** A balance scale with the two pans' contents drawn in pan coordinates (centre of each pan). */
export interface ScaleNode extends BaseNode {
  t: 'scale';
  x: number;
  y: number;
  /** Beam width. */
  width: number;
  /** -1 = left pan down (left heavier), 0 = level, 1 = right pan down. */
  tilt: -1 | 0 | 1;
  left: VisualNode[];
  right: VisualNode[];
}

export interface GroupNode extends BaseNode {
  t: 'g';
  x?: number;
  y?: number;
  rotate?: number;
  scale?: number;
  flipX?: boolean;
  flipY?: boolean;
  children: VisualNode[];
}

export type VisualNode = ShapeNode | TextNode | EmojiNode | LineNode | PathNode | GridNode | ClockNode | ScaleNode | GroupNode;

/**
 * A picture: a `w`×`h` user-unit box (keep w ≤ 400, h ≤ 300; options typically 100×100) that the
 * renderer scales to fit its slot (preserveAspectRatio meet). Nothing may rely on absolute px.
 */
export interface VisualSpec {
  w: number;
  h: number;
  nodes: VisualNode[];
  /** Accessible description, e.g. "Row of shapes: red circle, blue square, red circle, ?". */
  label?: string;
}

// ---------------------------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------------------------

export interface ChoiceOption {
  /** A picture option (visual families). */
  visual?: VisualSpec;
  /** A text option ("12", "Friday", "3 o'clock"). Exactly one of visual/text is set. */
  text?: string;
  /** Why this option is wrong (one short clause); used by Brain Coach. Required for every wrong option. */
  why?: string;
}

/** Multiple choice: 4 (easy) · 5 (medium) · 6 (hard) options; the engine shuffles them. */
export interface ChoiceAnswer {
  kind: 'choice';
  options: ChoiceOption[];
  answerIndex: number;
}

/** Keypad number (0..9999). */
export interface NumberAnswer {
  kind: 'number';
  answer: number;
  /** Accept when the typed length reaches this (default = digits of `answer`). */
  maxDigits?: number;
}

/**
 * Tap-to-fill cells on the puzzle's own grid (symmetry completion, odd cells, mazes):
 * the child toggles cells from `palette` (a single colour → tap toggles on/off).
 * `target` is the exact set of (cellKey → colour) that must be set; untouched cells must stay empty.
 */
export interface CellsAnswer {
  kind: 'cells';
  /** The grid node id inside `visual` that is editable. */
  gridId: string;
  palette: Color[];
  /** cell key ("r,c") → required colour. */
  target: Record<string, Color>;
  /** Cells that are locked (shown, not editable). */
  locked?: string[];
}

/** Mini-sudoku: tap a cell, pick a symbol. Exactly one solution. */
export interface SudokuAnswer {
  kind: 'sudoku';
  gridId: string;
  /** 4 symbols: digits '1'..'4' or shape kinds. */
  symbols: Array<{ key: string; label?: string; visual?: VisualSpec }>;
  /** Row-major 4×4 of symbol keys (the full solution). */
  solution: string[][];
  /** Row-major 4×4 of symbol keys or null for blanks (what is shown). */
  givens: Array<Array<string | null>>;
}

export type AnswerSpec = ChoiceAnswer | NumberAnswer | CellsAnswer | SudokuAnswer;

// ---------------------------------------------------------------------------------------------
// Puzzle + explanation
// ---------------------------------------------------------------------------------------------

export interface ExplainStep {
  /** ≤ 90 characters, kid language: "Look at the colours: red, blue, red, blue…". */
  text: string;
  /** Optional picture for this step (often the puzzle visual with `highlight`). */
  visual?: VisualSpec;
  /** Node ids (in `visual` or the puzzle visual) the renderer pulses. */
  highlight?: string[];
}

export interface Puzzle {
  /** `${family}:${difficulty}:${seedHex}` — unique per generated item; the engine never repeats one. */
  id: string;
  family: FamilyId;
  difficulty: Difficulty;
  /** The question, ≤ 60 characters, e.g. "What comes next?" */
  prompt: string;
  /** What the 🔊 button says (default = prompt). */
  speak?: string;
  visual: VisualSpec;
  answer: AnswerSpec;
  /** 1–4 steps. Shown by Brain Coach after the 2nd miss, and on "Why?" after a correct answer. */
  explanation: ExplainStep[];
  /** The rule in one line (for the parent/debug list and tests), e.g. "+3 each time". */
  rule: string;
  /** Sub-variant inside the family ("fib", "x2", "alt-color"), for variety accounting. */
  variant: string;
}

// ---------------------------------------------------------------------------------------------
// Family module contract
// ---------------------------------------------------------------------------------------------

/**
 * Validation is INDEPENDENT of generation: it must re-derive the rule from the puzzle (or from the
 * returned `check` closure) and prove that exactly one option / one filling satisfies it.
 * Returns a list of problems; empty = valid. Called in tests for every family × difficulty × 200 seeds.
 */
export type Validator = (puzzle: Puzzle) => string[];

export interface PuzzleFamily {
  id: FamilyId;
  title: string;
  emoji: string;
  group: FamilyGroup;
  /** Sub-variants this family can produce (for the harness: each variant must appear within 60 draws). */
  variants: readonly string[];
  generate: (difficulty: Difficulty, rng: Rng) => Puzzle;
  validate: Validator;
}

// ---------------------------------------------------------------------------------------------
// Session / scheduling / scoring (builder 3 implements; listed here so UI + tests share names)
// ---------------------------------------------------------------------------------------------

export type LogicMode = 'adaptive' | 'easy' | 'medium' | 'hard';

export const ROUND_LENGTH = 10;

/** Base points by difficulty; speed bonus thresholds (ms) by difficulty. */
export const BASE_POINTS: Record<Difficulty, number> = { 1: 15, 2: 25, 3: 40 };
export const FAST_MS: Record<Difficulty, number> = { 1: 10_000, 2: 18_000, 3: 30_000 };
export const OK_MS: Record<Difficulty, number> = { 1: 20_000, 2: 36_000, 3: 60_000 };
export const MISS_PENALTY = 5;
/** Flat points for a correct answer after one miss. */
export const SECOND_TRY_POINTS = 5;
/** Multiple-choice option count by difficulty. */
export const OPTION_COUNT: Record<Difficulty, number> = { 1: 4, 2: 5, 3: 6 };

export interface ItemResult {
  puzzleId: string;
  family: FamilyId;
  difficulty: Difficulty;
  /** 0 = first try, 1 = after one miss, 2 = missed out (explanation shown). */
  misses: 0 | 1 | 2;
  ms: number;
  points: number;
}

/** Persisted: ms2:logic:progress:v1 */
export interface LogicProgress {
  version: 1;
  mode: LogicMode;
  /** family → current adaptive difficulty. */
  level: Partial<Record<FamilyId, Difficulty>>;
  /** family → consecutive first-try corrects at the current level (2 → level up). */
  streak: Partial<Record<FamilyId, number>>;
  /** Last 300 puzzle ids served (no repeats). */
  seen: string[];
  rounds: number;
  /** `${mode}` → best first-try count in a round. */
  best: Record<string, number>;
}
