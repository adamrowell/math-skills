/**
 * maze-path — grid walks with 🐭 and 🧀 (docs/GEO-LOGIC.md §E.6).
 *   steps:  how many steps on the shortest way round the rocks (BFS)
 *   arrows: follow an arrow code — which lettered square does 🐭 end on?
 *   code:   which arrow code takes 🐭 to 🧀 without bumping a rock?
 * Validator: reads the grid back (rocks, mouse, cheese, letters, arrow code) and re-walks it.
 */
import type { AnswerSpec, ChoiceOption, Difficulty, GridCell, GridNode, Puzzle, PuzzleFamily, Rng } from '../engine/types';
import { OPTION_COUNT } from '../engine/types';
import { chance, pick, puzzleId, randInt, shuffled } from '../engine/rng';
import type { Candidate } from './kit';
import { checkTextChoice, emoji, finalizeChoice, grid, numberOptions, spec, text } from './kit';

const VARIANTS = ['steps', 'arrows', 'code'] as const;
type Variant = (typeof VARIANTS)[number];

const BY_D: Record<Difficulty, Variant[]> = {
  1: ['arrows', 'steps'],
  2: ['arrows', 'steps', 'code'],
  3: ['steps', 'code', 'arrows'],
};
const SIZE: Record<Difficulty, number> = { 1: 5, 2: 6, 3: 7 };

const MOUSE = '🐭';
const CHEESE = '🧀';
const ROCK = '🪨';
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

type Dir = 'U' | 'D' | 'L' | 'R';
const ARROW: Record<Dir, string> = { U: '↑', D: '↓', L: '←', R: '→' };
const FROM_ARROW: Record<string, Dir> = { '↑': 'U', '↓': 'D', '←': 'L', '→': 'R' };
const DV: Record<Dir, [number, number]> = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const DIRS: Dir[] = ['U', 'D', 'L', 'R'];
const codeText = (ds: Dir[]) => ds.map((x) => ARROW[x]).join(' ');

type P = [number, number];
const key = (p: P) => `${p[0]},${p[1]}`;

function bfs(n: number, rocks: Set<string>, a: P, b: P): number {
  const dist = new Map<string, number>([[key(a), 0]]);
  const q: P[] = [a];
  while (q.length) {
    const cur = q.shift()!;
    if (cur[0] === b[0] && cur[1] === b[1]) return dist.get(key(cur))!;
    for (const dd of DIRS) {
      const nx: P = [cur[0] + DV[dd][0], cur[1] + DV[dd][1]];
      if (nx[0] < 0 || nx[1] < 0 || nx[0] >= n || nx[1] >= n || rocks.has(key(nx)) || dist.has(key(nx))) continue;
      dist.set(key(nx), dist.get(key(cur))! + 1);
      q.push(nx);
    }
  }
  return -1;
}

/** Walk a code; null if it leaves the grid or bumps a rock. */
function walkCode(n: number, rocks: Set<string>, start: P, code: Dir[]): P | null {
  let p: P = start;
  for (const d of code) {
    p = [p[0] + DV[d][0], p[1] + DV[d][1]];
    if (p[0] < 0 || p[1] < 0 || p[0] >= n || p[1] >= n || rocks.has(key(p))) return null;
  }
  return p;
}

function cellPx(n: number): number {
  return n === 5 ? 54 : n === 6 ? 46 : 40;
}

function mazeGrid(n: number, rocks: Set<string>, mouse: P, cheese: P | null, letters: Map<string, string>, cell = cellPx(n)): GridNode {
  const cells: GridCell[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const k = `${r},${c}`;
      const m = r === mouse[0] && c === mouse[1];
      const ch = cheese && r === cheese[0] && c === cheese[1];
      if (rocks.has(k)) cells.push({ r, c, fill: 'grey', node: emoji(cell / 2, cell / 2 + 1, ROCK, cell * 0.66) });
      else if (m) cells.push({ r, c, node: emoji(cell / 2, cell / 2 + 1, MOUSE, cell * 0.72) });
      else if (ch) cells.push({ r, c, node: emoji(cell / 2, cell / 2 + 1, CHEESE, cell * 0.72) });
      else if (letters.has(k)) cells.push({ r, c, label: letters.get(k), fill: 'yellow' });
    }
  return grid(4, 4, n, n, cell, { id: 'maze', cells });
}

function stepsPuzzle(d: Difficulty, rng: Rng): Puzzle | null {
  const n = SIZE[d];
  const mouse: P = [randInt(rng, 0, n - 1), 0];
  const cheese: P = [randInt(rng, 0, n - 1), n - 1];
  const rocks = new Set<string>();
  const density = d === 1 ? 0.18 : d === 2 ? 0.25 : 0.3;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const k = `${r},${c}`;
      if (k !== key(mouse) && k !== key(cheese) && chance(rng, density)) rocks.add(k);
    }
  const dist = bfs(n, rocks, mouse, cheese);
  const manhattan = Math.abs(mouse[0] - cheese[0]) + Math.abs(mouse[1] - cheese[1]);
  if (dist < 0 || (d >= 2 && dist < manhattan + 2) || dist > 16) return null;
  const g = mazeGrid(n, rocks, mouse, cheese, new Map());
  const cell = cellPx(n);
  const visual = spec(n * cell + 8, n * cell + 8, [g], `A ${n} by ${n} grid with rocks, a mouse and cheese.`);
  const pool: Candidate[] = [
    ...(dist !== manhattan ? [{ v: manhattan, why: 'That way goes through a rock' }] : []),
    { v: dist + 1, why: 'There is a shorter way' },
    { v: dist + 2, why: 'There is a shorter way' },
    { v: dist - 1, why: "Can't get there that fast — count each step" },
    { v: dist + 3, why: 'There is a shorter way' },
  ];
  const keypad = d === 3 && chance(rng, 0.6);
  const answer: AnswerSpec = keypad ? { kind: 'number', answer: dist } : numberOptions(rng, dist, pool, OPTION_COUNT[d], { min: 1, max: 40 });
  return {
    id: puzzleId('maze-path', d, `steps|${key(mouse)}|${key(cheese)}|${[...rocks].sort().join(';')}`),
    family: 'maze-path',
    difficulty: d,
    prompt: `Fewest steps from ${MOUSE} to ${CHEESE}?`,
    speak: 'How many steps does the mouse need to get to the cheese? Up, down, left or right, and no rocks!',
    visual,
    answer,
    explanation: [
      { text: 'Steps go up, down, left or right — never through a rock.', visual },
      { text: 'Try the straightest way first, then go round the rocks.' },
      { text: `The shortest way is ${dist} steps.` },
    ],
    rule: `shortest path = ${dist} steps`,
    variant: 'steps',
  };
}

/** A random code of `len` moves that stays on the grid and never steps back on itself immediately. */
function randomCode(n: number, rocks: Set<string>, start: P, len: number, rng: Rng): Dir[] | null {
  const code: Dir[] = [];
  let p = start;
  const opp: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' };
  for (let i = 0; i < len; i++) {
    const opts = shuffled(rng, DIRS).filter((d) => {
      if (code.length && opp[d] === code[code.length - 1]) return false;
      const nx: P = [p[0] + DV[d][0], p[1] + DV[d][1]];
      return nx[0] >= 0 && nx[1] >= 0 && nx[0] < n && nx[1] < n && !rocks.has(key(nx));
    });
    // Prefer repeating the last move sometimes (runs like → → → read nicely).
    const d = code.length && opts.includes(code[code.length - 1]) && chance(rng, 0.45) ? code[code.length - 1] : opts[0];
    if (!d) return null;
    code.push(d);
    p = [p[0] + DV[d][0], p[1] + DV[d][1]];
  }
  return code;
}

function arrowsPuzzle(d: Difficulty, rng: Rng): Puzzle | null {
  const n = SIZE[d];
  const len = d === 1 ? randInt(rng, 3, 4) : d === 2 ? randInt(rng, 5, 6) : randInt(rng, 7, 8);
  const start: P = [randInt(rng, 0, n - 1), randInt(rng, 0, n - 1)];
  const code = randomCode(n, new Set(), start, len, rng);
  if (!code) return null;
  const end = walkCode(n, new Set(), start, code)!;
  if (key(end) === key(start)) return null;
  // Wrong landing spots from typical slips.
  const swapLR: Record<Dir, Dir> = { U: 'U', D: 'D', L: 'R', R: 'L' };
  const swapUD: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'L', R: 'R' };
  const slips: Array<{ code: Dir[]; why: string }> = [
    { code: code.slice(0, -1), why: 'You stopped one arrow early' },
    { code: code.map((x) => swapLR[x]), why: '← is left and → is right' },
    { code: code.map((x) => swapUD[x]), why: '↑ is up and ↓ is down' },
    { code: code.slice(1), why: "Don't skip the first arrow" },
    { code: [...code, code[code.length - 1]], why: 'One step too many' },
    ...code.map((_, i) => ({ code: code.filter((__, j) => j !== i), why: 'An arrow got skipped' })),
  ];
  const nOpt = OPTION_COUNT[d];
  const spots = new Map<string, { p: P; why: string }>();
  for (const s of shuffled(rng, slips.slice(0, 5)).concat(slips.slice(5))) {
    const e = walkCode(n, new Set(), start, s.code);
    if (!e || key(e) === key(end) || key(e) === key(start) || spots.has(key(e))) continue;
    spots.set(key(e), { p: e, why: s.why });
    if (spots.size >= nOpt - 1) break;
  }
  // Fill with near neighbours of the end if slips ran out.
  for (const dd of shuffled(rng, DIRS)) {
    if (spots.size >= nOpt - 1) break;
    const e: P = [end[0] + DV[dd][0], end[1] + DV[dd][1]];
    if (e[0] < 0 || e[1] < 0 || e[0] >= n || e[1] >= n || key(e) === key(start) || key(e) === key(end) || spots.has(key(e))) continue;
    spots.set(key(e), { p: e, why: 'Count the steps again' });
  }
  if (spots.size < nOpt - 1) return null;
  const marked = shuffled(rng, [{ p: end, why: '' }, ...spots.values()]);
  const letters = new Map<string, string>();
  marked.forEach((m, i) => letters.set(key(m.p), LETTERS[i]));
  const cell = Math.floor(240 / n);
  const g = mazeGrid(n, new Set(), start, null, letters, cell);
  const codeY = n * cell + 30;
  const visual = spec(n * cell + 8, codeY + 22, [g, text((n * cell + 8) / 2, codeY, codeText(code), { id: 'code', size: 26, fill: 'purple' })], `Grid with a mouse and lettered squares; arrows ${codeText(code)}.`);
  const correct = letters.get(key(end))!;
  const wrong: ChoiceOption[] = marked.filter((m) => key(m.p) !== key(end)).map((m) => ({ text: letters.get(key(m.p))!, why: m.why }));
  // Options in letter order: the letters are already randomly placed, so A..F order hides nothing.
  const ordered = finalizeChoice(rng, { text: correct }, wrong);
  ordered.options.sort((a, b) => (a.text! < b.text! ? -1 : 1));
  ordered.answerIndex = ordered.options.findIndex((o) => o.text === correct);
  return {
    id: puzzleId('maze-path', d, `arrows|${key(start)}|${code.join('')}`),
    family: 'maze-path',
    difficulty: d,
    prompt: `Follow the arrows. Where does ${MOUSE} end up?`,
    speak: 'Follow the arrows, one square for each arrow. Which letter does the mouse land on?',
    visual,
    answer: ordered,
    explanation: [
      { text: 'Each arrow moves the mouse one square that way.', visual, highlight: ['code'] },
      { text: `Go one arrow at a time: ${codeText(code)}.` },
      { text: `The mouse lands on ${correct}.` },
    ],
    rule: `follow ${codeText(code)} → ${correct}`,
    variant: 'arrows',
  };
}

function codePuzzle(d: Difficulty, rng: Rng): Puzzle | null {
  const n = SIZE[d];
  const start: P = [randInt(rng, 0, n - 1), randInt(rng, 0, 1)];
  const rocks = new Set<string>();
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (`${r},${c}` !== key(start) && chance(rng, d === 2 ? 0.18 : 0.24)) rocks.add(`${r},${c}`);
  const len = d === 2 ? randInt(rng, 4, 5) : randInt(rng, 5, 7);
  const code = randomCode(n, rocks, start, len, rng);
  if (!code) return null;
  const cheese = walkCode(n, rocks, start, code)!;
  if (key(cheese) === key(start)) return null;
  // Wrong codes: same length, one change each.
  const swapLR: Record<Dir, Dir> = { U: 'U', D: 'D', L: 'R', R: 'L' };
  const cands: Array<{ code: Dir[]; why: string }> = [];
  cands.push({ code: code.map((x) => swapLR[x]), why: 'Left and right are swapped' });
  for (let i = 0; i < code.length; i++)
    for (const dd of DIRS) {
      if (dd === code[i]) continue;
      const c2 = code.slice();
      c2[i] = dd;
      const e = walkCode(n, rocks, start, c2);
      cands.push({ code: c2, why: e === null ? 'That bumps into a rock or falls off' : 'That ends on the wrong square' });
    }
  for (let i = 0; i + 1 < code.length; i++) {
    if (code[i] === code[i + 1]) continue;
    const c2 = code.slice();
    [c2[i], c2[i + 1]] = [c2[i + 1], c2[i]];
    const e = walkCode(n, rocks, start, c2);
    cands.push({ code: c2, why: e === null ? 'Right arrows, wrong order — it bumps a rock' : 'Right arrows, wrong order' });
  }
  const nOpt = OPTION_COUNT[d];
  const seen = new Set([code.join('')]);
  const wrong: ChoiceOption[] = [];
  // Mix: some that bump a rock, some that end in the wrong place.
  for (const c of shuffled(rng, cands)) {
    if (wrong.length >= nOpt - 1) break;
    const e = walkCode(n, rocks, start, c.code);
    if (seen.has(c.code.join('')) || (e && key(e) === key(cheese))) continue;
    seen.add(c.code.join(''));
    wrong.push({ text: codeText(c.code), why: c.why });
  }
  if (wrong.length < nOpt - 1) return null;
  const g = mazeGrid(n, rocks, start, cheese, new Map());
  const cell = cellPx(n);
  const visual = spec(n * cell + 8, n * cell + 8, [g], 'A grid with rocks, a mouse and cheese.');
  return {
    id: puzzleId('maze-path', d, `code|${key(start)}|${code.join('')}|${[...rocks].sort().join(';')}`),
    family: 'maze-path',
    difficulty: d,
    prompt: `Which code takes ${MOUSE} to ${CHEESE}?`,
    speak: 'Which arrow code takes the mouse to the cheese, without bumping into a rock?',
    visual,
    answer: finalizeChoice(rng, { text: codeText(code) }, wrong),
    explanation: [
      { text: 'Try each code with your finger, one square per arrow.', visual },
      { text: 'A code is wrong if it bumps a rock or stops off the cheese.' },
      { text: `${codeText(code)} gets to the cheese!` },
    ],
    rule: `${codeText(code)} reaches the cheese`,
    variant: 'code',
  };
}

function generate(d: Difficulty, rng: Rng): Puzzle {
  for (let tries = 0; tries < 400; tries++) {
    const variant = pick(rng, BY_D[d]);
    const p = variant === 'steps' ? stepsPuzzle(d, rng) : variant === 'arrows' ? arrowsPuzzle(d, rng) : codePuzzle(d, rng);
    if (p && validate(p).length === 0) return p;
  }
  throw new Error('maze-path: generator stuck');
}

// ---------------------------------------------------------------------------------------------
// Independent validator
// ---------------------------------------------------------------------------------------------

function readMaze(p: Puzzle) {
  const g = p.visual.nodes.find((n): n is GridNode => n.t === 'grid' && n.id === 'maze');
  if (!g) return null;
  const rocks = new Set<string>();
  let mouse: P | null = null;
  let cheese: P | null = null;
  const letters = new Map<string, P>();
  for (const c of g.cells ?? []) {
    const ch = c.node && c.node.t === 'emoji' ? c.node.char : '';
    if (ch === ROCK) rocks.add(`${c.r},${c.c}`);
    if (ch === MOUSE) mouse = [c.r, c.c];
    if (ch === CHEESE) cheese = [c.r, c.c];
    if (c.label) letters.set(c.label, [c.r, c.c]);
  }
  let code: Dir[] | null = null;
  const ct = p.visual.nodes.find((n) => n.t === 'text' && n.id === 'code');
  if (ct && ct.t === 'text') code = ct.text.split(' ').map((a) => FROM_ARROW[a]);
  return { n: g.rows, rocks, mouse: mouse as P | null, cheese: cheese as P | null, letters, code };
}

function validate(p: Puzzle): string[] {
  const m = readMaze(p);
  if (!m || !m.mouse) return ['cannot read the maze'];
  const v = p.variant as Variant;
  if (v === 'steps') {
    if (!m.cheese) return ['no cheese'];
    const dist = bfs(m.n, m.rocks, m.mouse, m.cheese);
    if (dist < 1) return ['no path'];
    if (p.answer.kind === 'number') return p.answer.answer === dist ? [] : [`keypad ${p.answer.answer} ≠ ${dist}`];
    if (p.answer.kind !== 'choice') return ['bad answer kind'];
    return checkTextChoice(p.answer, String(dist));
  }
  if (v === 'arrows') {
    if (!m.code || m.code.some((x) => !x)) return ['cannot read the code'];
    const end = walkCode(m.n, new Set(), m.mouse, m.code);
    if (!end) return ['code leaves the grid'];
    const hit = [...m.letters].filter(([, pos]) => key(pos) === key(end)).map(([l]) => l);
    if (hit.length !== 1) return [`${hit.length} letters at the end square`];
    if (p.answer.kind !== 'choice') return ['bad answer kind'];
    const errs = checkTextChoice(p.answer, hit[0]);
    if (p.answer.options.some((o) => !m.letters.has(o.text ?? ''))) errs.push('option letter not on the grid');
    return errs;
  }
  if (v === 'code') {
    if (!m.cheese || p.answer.kind !== 'choice') return ['bad code puzzle'];
    const good = p.answer.options.map((o) => {
      const ds = (o.text ?? '').split(' ').map((a) => FROM_ARROW[a]);
      const e = ds.some((x) => !x) ? null : walkCode(m.n, m.rocks, m.mouse!, ds);
      return e !== null && key(e) === key(m.cheese!);
    });
    const texts = p.answer.options.map((o) => o.text);
    if (new Set(texts).size !== texts.length) return ['duplicate codes'];
    if (good.filter(Boolean).length !== 1) return [`${good.filter(Boolean).length} codes reach the cheese`];
    if (!good[p.answer.answerIndex]) return ['answerIndex is not the working code'];
    const lens = new Set(texts.map((t) => t!.length));
    if (lens.size !== 1) return ['codes have different lengths (a tell)'];
    return [];
  }
  return ['unknown variant'];
}

export const mazePath: PuzzleFamily = {
  id: 'maze-path',
  title: 'Mouse Maze',
  emoji: '🐭',
  group: 'spatial',
  variants: VARIANTS,
  generate,
  validate,
};
