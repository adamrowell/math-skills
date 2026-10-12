/**
 * Hand-written stories ported from the legacy Word Problems bank (fill-number word-math items,
 * plus the "Who has more?" item rewritten as a how-many-more question). Mixed into Level 1–2
 * rounds now and then; the template generator does the rest.
 */
import type { Pic } from './problems';
import type { Theme } from './things';

export interface Seed {
  id: string;
  templateId: string;
  theme: Theme;
  sentences: string[];
  question: string;
  answer: number;
  operands: number[];
  hint: string;
  sentence: string;
  worked: string[];
  answerLine: string;
  pic: Pic | null;
  emoji: string;
}

function add(id: string, theme: Theme, emoji: string, sentences: string[], question: string, a: number, b: number, hint: string, answerLine: string): Seed {
  return {
    id, templateId: 'join:L1', theme, sentences, question, answer: a + b, operands: [a, b], hint,
    sentence: `${a} + ${b} = ☐`, worked: [`${a} + ${b} = ${a + b}`], answerLine,
    pic: { kind: 'join', emoji, parts: [a, b] }, emoji,
  };
}

function sub(id: string, theme: Theme, emoji: string, sentences: string[], question: string, a: number, b: number, hint: string, answerLine: string): Seed {
  return {
    id, templateId: 'take:L1', theme, sentences, question, answer: a - b, operands: [a, b], hint,
    sentence: `${a} − ${b} = ☐`, worked: [`${a} − ${b} = ${a - b}`], answerLine,
    pic: { kind: 'take', emoji, total: a, away: b }, emoji,
  };
}

function more(id: string, theme: Theme, emoji: string, sentences: string[], question: string, a: number, b: number, labels: [string, string], hint: string, answerLine: string, level: 1 | 2 = 1): Seed {
  return {
    id, templateId: `more:L${level}`, theme, sentences, question, answer: a - b, operands: [a, b], hint,
    sentence: `${a} − ${b} = ☐`, worked: [`${a} − ${b} = ${a - b}`], answerLine,
    pic: a <= 20 ? { kind: 'compare', emoji, rows: [{ label: labels[0], count: a }, { label: labels[1], count: b }] } : null, emoji,
  };
}

export const SEEDS: Seed[] = [
  add('wm001', 'party', '🍎', ['Emma has 3 apples.', 'She gets 2 more.'], 'How many apples does Emma have now?', 3, 2, 'She starts with 3, then gets more. Add them together!', 'Emma has 5 apples now.'),
  add('wm002', 'sports', '🚗', ['Max has 4 toy cars.', 'His friend gives him 3 more.'], 'How many toy cars does Max have now?', 4, 3, 'Start with 4, add 3 more.', 'Max has 7 toy cars.'),
  add('wm003', 'animals', '🐦', ['There are 5 birds in a tree.', '4 more birds land in the tree.'], 'How many birds are in the tree now?', 5, 4, '5 birds and 4 more birds. Put them together!', 'There are 9 birds in the tree.'),
  add('wm004', 'party', '🌟', ['Sam has 6 stickers.', 'He gets 5 more from his teacher.'], 'How many stickers does Sam have now?', 6, 5, 'Start at 6 and count on 5.', 'Sam has 11 stickers.'),
  add('wm005', 'party', '📖', ['Mia reads 7 pages on Monday.', 'She reads 8 pages on Tuesday.'], 'How many pages did she read in all?', 7, 8, 'Add the Monday pages and the Tuesday pages.', 'Mia read 15 pages.'),
  add('wm020', 'party', '💵', ['Emma has 4 dollars.', 'Her mom gives her 6 more dollars.'], 'How many dollars does Emma have now?', 4, 6, 'Start with 4 and add 6.', 'Emma has 10 dollars.'),
  add('wm023', 'sports', '🧒', ['There are 6 boys in a class.', 'There are 8 girls in the class.'], 'How many children are in the class?', 6, 8, 'Boys and girls together: add them!', 'There are 14 children in the class.'),
  sub('wm006', 'party', '🍪', ['There are 8 cookies.', 'Tom eats 3.'], 'How many cookies are left?', 8, 3, 'Start with 8, take away 3.', '5 cookies are left.'),
  sub('wm007', 'party', '🎈', ['Sara has 7 balloons.', '2 fly away.'], 'How many balloons does Sara have now?', 7, 2, '7 balloons, take away the 2 that flew away.', 'Sara has 5 balloons.'),
  sub('wm008', 'animals', '🐟', ['There are 12 fish in a pond.', '5 swim away.'], 'How many fish are left?', 12, 5, 'Start at 12 and count back 5.', '7 fish are left.'),
  sub('wm009', 'sports', '🧍', ['A bus has 15 people on it.', 'At the stop, 6 people get off.'], 'How many people are still on the bus?', 15, 6, 'Take 6 away from 15.', '9 people are still on the bus.'),
  sub('wm019', 'party', '💵', ['Max has 8 dollars.', 'He buys a toy for 5 dollars.'], 'How many dollars does Max have left?', 8, 5, '8 dollars, take away the 5 he spent.', 'Max has 3 dollars left.'),
  sub('wm024', 'party', '📚', ['A shelf has 20 books.', 'Kids take 7 books.'], 'How many books are left on the shelf?', 20, 7, 'Take 7 away from 20.', '13 books are left.'),
  more('wm010', 'sports', '🧸', ['Alex has 7 toys.', 'Ben has 4 toys.'], 'How many more toys does Alex have than Ben?', 7, 4, ['Alex', 'Ben'], 'Line them up! How many extra does Alex have?', 'Alex has 3 more toys.'),
  more('wm013', 'sports', '🔵', ['Sam has 8 marbles.', 'Jake has 5 marbles.'], 'How many more marbles does Sam have than Jake?', 8, 5, ['Sam', 'Jake'], 'Find the difference: take 5 away from 8.', 'Sam has 3 more marbles.'),
  more('wm014', 'party', '🍎', ['There are 10 red apples.', 'There are 6 green apples.'], 'How many more red apples are there?', 10, 6, ['Red', 'Green'], 'Take 6 away from 10.', 'There are 4 more red apples.'),
  more('wm015', 'party', '🌟', ['Emma needs 15 stickers to win a prize.', 'She has 9 stickers.'], 'How many more stickers does she need?', 15, 9, ['Prize', 'Emma'], 'Count up from 9 to 15.', 'Emma needs 6 more stickers.'),
  more('wm025', 'sports', '🏀', ['The red team has 18 points.', 'The blue team has 12 points.'], 'How many more points does the red team have?', 18, 12, ['Red', 'Blue'], 'Take 12 away from 18.', 'The red team has 6 more points.'),
];
