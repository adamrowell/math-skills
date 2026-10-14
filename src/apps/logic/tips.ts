/**
 * Per-family display data and the one-line "how to think" tip Brain Coach shows the first time he
 * misses out a family (docs/GEO-LOGIC.md §E.7). Titles/emoji here are the fallback for families that
 * are not registered yet; a registered family's own title/emoji win.
 */
import type { FamilyId } from './engine/types';

export const FAMILY_META: Record<FamilyId, { title: string; emoji: string; tip: string }> = {
  'seq-number': { title: 'Number Trains', emoji: '🔢', tip: 'Write the jump between each pair of numbers. Do the jumps make a pattern?' },
  'number-box': { title: 'Number Boxes', emoji: '🔲', tip: 'Look at a FULL row first. Find what it does, then do the same to the ? row.' },
  'rule-machine': { title: 'Robot Machine', emoji: '🤖', tip: 'Guess the rule from the first pair, then check it on EVERY pair.' },
  'code-break': { title: 'Secret Code', emoji: '🔐', tip: 'Start with the row that has only one kind of picture.' },
  balance: { title: 'Balance Scales', emoji: '⚖️', tip: 'Heavy goes DOWN, light goes UP. Level means the same weight.' },
  'clock-calendar': { title: 'Clocks & Calendars', emoji: '⏰', tip: 'Count on with your finger: one hour at a time, then the minutes.' },
  'mini-sudoku': { title: 'Mini Sudoku', emoji: '🧩', tip: 'Find a square where only ONE thing can go. Fill it, then find the next.' },
  'maze-path': { title: 'Mouse Maze', emoji: '🐭', tip: 'Use your finger and move one square for every step or arrow.' },
  'odd-one-out': { title: 'Odd One Out', emoji: '🕵️', tip: "Find what MOST of them share. Colours can be a trick — check shape, sides and number too." },
  analogy: { title: 'Picture Pairs', emoji: '🔁', tip: 'Say what changed from A to B. Then do exactly that to C.' },
  'seq-shape': { title: 'Shape Trains', emoji: '🔷', tip: 'Look at one thing at a time: the colours, then the shapes, then the turns.' },
  'growing-pattern': { title: 'Growing Patterns', emoji: '🌱', tip: 'How many more does each picture add? Keep adding that.' },
  matrix: { title: 'Pattern Grid', emoji: '🔳', tip: 'Read each row left to right. What changes, and what stays the same?' },
  mirror: { title: 'Mirror Magic', emoji: '🪞', tip: "Pretend the line is a mirror. What's closest to the mirror stays closest!" },
  rotation: { title: 'Spin It', emoji: '🔄', tip: 'Turn it in your head. A flipped shape can never be made by turning.' },
  'symmetry-fill': { title: 'Make It Match', emoji: '🦋', tip: 'Each square has a twin the same distance from the line on the other side.' },
  'paper-fold': { title: 'Paper Fold', emoji: '📄', tip: 'Every hole gets a twin across each fold line when you open the paper.' },
  'count-figures': { title: 'Count the Shapes', emoji: '🔺', tip: 'Count the small ones first, then the bigger ones made of small ones.' },
  'pattern-block': { title: 'Missing Piece', emoji: '🧱', tip: 'Look at what is around the hole. The piece must match on every side.' },
  'tangram-fit': { title: 'Shape Builder', emoji: '📐', tip: 'Imagine sliding the two pieces together. Do they fill the shape exactly?' },
};
