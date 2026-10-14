/**
 * paper-fold — "Unfold the paper — which one?" A square sheet (4×4 squares) is folded in half one,
 * two or three times, a hole is punched, and the child picks the unfolded sheet.
 *
 * The generator unfolds backwards (each unfold mirrors every hole across that fold line). The
 * validator does it the other way round: it folds every square of the open sheet forwards and
 * asks "does this square land on a punched spot?" — two independent derivations.
 */
import type { Color, Difficulty, ExplainStep, Puzzle, PuzzleFamily, Rng, ShapeKind, ShapeNode, VisualNode, VisualSpec } from '../../engine/types';
import { OPTION_COUNT } from '../../engine/types';
import { grid, group, line, mirrorNode, pick, polygon, sample, shape, shuffle, spec, text } from '../../engine/shapes';
import { byId, checkVisualChoice, choice, finish, generateValid, pickWrongFair, type Wrong } from './common';

const ID = 'paper-fold' as const;
const N = 4;
const PAPER: Color = 'yellow';

export interface Fold {
  axis: 'v' | 'h' | 'd';
  /** v/h: the grid line index the fold sits on. d: the top-left corner (r, c) of the square being folded. */
  at: number;
  r0?: number;
  c0?: number;
  size?: number;
  /** Which side stays: v → cols < at ('low') or ≥ at ('high'); h → rows; d → below the diagonal ('low'). */
  keep: 'low' | 'high';
}

export interface Hole {
  r: number;
  c: number;
  kind: ShapeKind;
  rot: number;
  flipX?: boolean;
  flipY?: boolean;
}

const k = (r: number, c: number) => `${r},${c}`;

/** Mirror a cell across a fold. */
export const reflect = (f: Fold, r: number, c: number): [number, number] => {
  if (f.axis === 'v') return [r, 2 * f.at - 1 - c];
  if (f.axis === 'h') return [2 * f.at - 1 - r, c];
  return [f.r0! + (c - f.c0!), f.c0! + (r - f.r0!)];
};

/** Is the cell on the flap (the side that moves)? Diagonal cells are on neither side. */
export const onFlap = (f: Fold, r: number, c: number): boolean => {
  if (f.axis === 'v') return f.keep === 'low' ? c >= f.at : c < f.at;
  if (f.axis === 'h') return f.keep === 'low' ? r >= f.at : r < f.at;
  return r - f.r0! < c - f.c0!; // above the diagonal folds down onto the lower-left
};

/** How a hole's shape turns over when a fold is undone (a reflection across the fold line). */
const flipHole = (h: Hole, f: Fold): Hole => {
  const axis = f.axis === 'v' ? 'x' : f.axis === 'h' ? 'y' : 'diag';
  const n = mirrorNode(shape(h.kind, 0, 0, 10, { rotate: h.rot, flipX: h.flipX, flipY: h.flipY }), axis, 0, 0) as ShapeNode;
  return { ...h, rot: n.rotate ?? 0, flipX: n.flipX, flipY: n.flipY };
};

// ------------------------------------------------------------------------------------------------
// Drawing

/** Paper pieces for a footprint (cells + diagonal halves). */
const footprintNodes = (cells: Set<string>, diag: Fold | null, u: number, ox: number, oy: number): VisualNode[] => {
  const out: VisualNode[] = [];
  for (const key of cells) {
    const [r, c] = key.split(',').map(Number);
    const x = ox + c * u;
    const y = oy + r * u;
    const onDiag = diag && r - diag.r0! === c - diag.c0!;
    if (onDiag)
      out.push(
        polygon(
          [
            [x, y],
            [x, y + u],
            [x + u, y + u],
          ],
          { fill: PAPER, stroke: 'ink', strokeWidth: 1.5 },
        ),
      );
    else
      out.push(
        polygon(
          [
            [x, y],
            [x + u, y],
            [x + u, y + u],
            [x, y + u],
          ],
          { fill: PAPER, stroke: 'ink', strokeWidth: 1.5 },
        ),
      );
  }
  return out;
};

const holeNode = (h: Hole, u: number, ox: number, oy: number, id?: string): ShapeNode =>
  // Shaped holes are drawn bigger so which way they point is easy to see.
  shape(h.kind, ox + (h.c + 0.5) * u, oy + (h.r + 0.5) * u, u * (h.kind === 'circle' ? 0.62 : 0.78), {
    fill: 'white',
    strokeWidth: 2,
    ...(h.rot ? { rotate: h.rot } : {}),
    ...(h.flipX ? { flipX: true } : {}),
    ...(h.flipY ? { flipY: true } : {}),
    ...(id ? { id } : {}),
  });

/** The open sheet with holes, as an option picture. */
export const sheetOption = (holes: Hole[]): VisualSpec => {
  const u = 21;
  const o = (100 - N * u) / 2;
  const all = new Set<string>();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) all.add(k(r, c));
  return spec(100, 100, [...footprintNodes(all, null, u, o, o), ...holes.map((h) => holeNode(h, u, o, o))], `Open paper with ${holes.length} holes`);
};

const foldLine = (f: Fold, cells: Set<string>, u: number, ox: number, oy: number, id: string): VisualNode[] => {
  const ext = 5;
  const b = bbox(cells);
  const d = { dash: true, stroke: 'ink' as Color, strokeWidth: 2.5 };
  if (f.axis === 'v') {
    const x = ox + f.at * u;
    return [line(x, oy + b.r0 * u - ext, x, oy + (b.r1 + 1) * u + ext, { id, ...d })];
  }
  if (f.axis === 'h') {
    const y = oy + f.at * u;
    return [line(ox + b.c0 * u - ext, y, ox + (b.c1 + 1) * u + ext, y, { id, ...d })];
  }
  const s = f.size!;
  return [line(ox + f.c0! * u - ext, oy + f.r0! * u - ext, ox + (f.c0! + s) * u + ext, oy + (f.r0! + s) * u + ext, { id, ...d })];
};

/** A short arrow from the flap towards the side that stays. */
const foldArrow = (f: Fold, cells: Set<string>, u: number, ox: number, oy: number): VisualNode => {
  const flap = [...cells].map((x) => x.split(',').map(Number)).filter(([r, c]) => onFlap(f, r, c));
  const cr = flap.reduce((a, [r]) => a + r, 0) / flap.length + 0.5;
  const cc = flap.reduce((a, [, c]) => a + c, 0) / flap.length + 0.5;
  const [tr, tc] = (() => {
    if (f.axis === 'v') return [cr, 2 * f.at - cc];
    if (f.axis === 'h') return [2 * f.at - cr, cc];
    return [f.r0! + (cc - f.c0!), f.c0! + (cr - f.r0!)];
  })();
  const fx = ox + cc * u;
  const fy = oy + cr * u;
  const tx = ox + tc * u;
  const ty = oy + tr * u;
  return line(fx + (tx - fx) * 0.15, fy + (ty - fy) * 0.15, fx + (tx - fx) * 0.85, fy + (ty - fy) * 0.85, { arrow: 'end', stroke: 'red', strokeWidth: 3 });
};

// ------------------------------------------------------------------------------------------------
// Plans

const VARIANTS: Record<Difficulty, string[]> = { 1: ['one-fold'], 2: ['two-folds-cross', 'two-folds-same'], 3: ['diagonal', 'three-folds', 'cross-diagonal'] };

const footprintAfter = (folds: Fold[]): Set<string> => {
  let cells = new Set<string>();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.add(k(r, c));
  for (const f of folds) cells = new Set([...cells].filter((x) => !onFlap(f, ...(x.split(',').map(Number) as [number, number]))));
  return cells;
};

const bbox = (cells: Set<string>) => {
  const rc = [...cells].map((x) => x.split(',').map(Number));
  return { r0: Math.min(...rc.map((x) => x[0])), r1: Math.max(...rc.map((x) => x[0])), c0: Math.min(...rc.map((x) => x[1])), c1: Math.max(...rc.map((x) => x[1])) };
};

/** A fold across the middle of the current footprint. */
const midFold = (cells: Set<string>, axis: 'v' | 'h', rng: Rng): Fold => {
  const b = bbox(cells);
  const at = axis === 'v' ? (b.c0 + b.c1 + 1) / 2 : (b.r0 + b.r1 + 1) / 2;
  return { axis, at, keep: rng() < 0.5 ? 'low' : 'high' };
};

const diagFold = (cells: Set<string>): Fold => {
  const b = bbox(cells);
  return { axis: 'd', at: 0, r0: b.r0, c0: b.c0, size: b.r1 - b.r0 + 1, keep: 'low' };
};

const planFolds = (variant: string, rng: Rng): Fold[] => {
  const folds: Fold[] = [];
  const add = (f: (cells: Set<string>) => Fold) => folds.push(f(footprintAfter(folds)));
  const first: 'v' | 'h' = rng() < 0.5 ? 'v' : 'h';
  const other: 'v' | 'h' = first === 'v' ? 'h' : 'v';
  switch (variant) {
    case 'one-fold':
      add((c) => midFold(c, first, rng));
      break;
    case 'two-folds-cross':
      add((c) => midFold(c, first, rng));
      add((c) => midFold(c, other, rng));
      break;
    case 'two-folds-same':
      add((c) => midFold(c, first, rng));
      add((c) => midFold(c, first, rng));
      break;
    case 'diagonal':
      add(diagFold);
      break;
    case 'three-folds':
      add((c) => midFold(c, first, rng));
      add((c) => midFold(c, first, rng));
      add((c) => midFold(c, other, rng));
      break;
    default:
      add((c) => midFold(c, 'v', rng));
      add((c) => midFold(c, 'h', rng));
      add(diagFold);
  }
  return folds;
};

/** Generator side: unfold backwards. */
export const unfold = (folds: Fold[], punched: Hole[]): Hole[] => {
  let holes = punched.slice();
  for (const f of [...folds].reverse()) holes = [...holes, ...holes.map((h) => ({ ...flipHole(h, f), r: reflect(f, h.r, h.c)[0], c: reflect(f, h.r, h.c)[1] }))];
  return holes;
};

/** Validator side: fold every square of the open sheet forwards. */
export const foldForward = (folds: Fold[], punched: Hole[]): Hole[] => {
  const out: Hole[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      let rr = r;
      let cc = c;
      const applied: Fold[] = [];
      for (const f of folds) {
        if (f.axis === 'd' && rr - f.r0! === cc - f.c0!) {
          rr = -99; // on the crease: never punched
          break;
        }
        if (onFlap(f, rr, cc)) {
          [rr, cc] = reflect(f, rr, cc);
          applied.push(f);
        }
      }
      const p = punched.find((h) => h.r === rr && h.c === cc);
      if (!p) continue;
      // The square was turned over by each applied fold; undo them last-first.
      let h: Hole = { ...p, r, c };
      for (const f of [...applied].reverse()) h = { ...flipHole(h, f), r, c };
      out.push(h);
    }
  return out;
};

const PANEL_GAP = 14;

const attempt = (d: Difficulty, rng: Rng): Puzzle | null => {
  const variant = pick(VARIANTS[d], rng);
  const folds = planFolds(variant, rng);
  const final = footprintAfter(folds);
  const diag = folds.find((f) => f.axis === 'd') ?? null;
  const punchable = [...final].filter((x) => {
    const [r, c] = x.split(',').map(Number);
    return !(diag && r - diag.r0! === c - diag.c0!);
  });
  const nHoles = Math.min(punchable.length, d === 1 ? pick([1, 1, 2], rng) : variant === 'two-folds-cross' || variant === 'three-folds' || variant === 'cross-diagonal' ? 1 : pick([1, 2], rng));
  // Easy: round holes only (a flipped heart is too subtle a trap at this level).
  const kind: ShapeKind = d === 1 ? 'circle' : d === 3 && rng() < 0.5 ? 'triangle' : rng() < 0.3 ? 'heart' : 'circle';
  const rot = kind === 'triangle' ? pick([90, 270, 0, 180], rng) : kind === 'heart' ? pick([0, 180], rng) : 0;
  const punched: Hole[] = sample(punchable, nHoles, rng).map((x) => {
    const [r, c] = x.split(',').map(Number);
    return { r, c, kind, rot };
  });
  const holes = unfold(folds, punched);
  const ans = sheetOption(holes);

  // Panels: each fold, then the punched paper, then "?".
  const panels = folds.length + 2;
  // One row for up to 4 panels; otherwise the folds on top and "punched → ?" underneath.
  const perRow = panels <= 4 ? panels : Math.ceil(panels / 2);
  const rows = Math.ceil(panels / perRow);
  const u = Math.min(22, Math.floor((392 - PANEL_GAP * (perRow - 1)) / (perRow * N)));
  const pw = N * u;
  const rowH = pw + 28;
  const totalW = perRow * pw + (perRow - 1) * PANEL_GAP + 12;
  const pos = (i: number): [number, number] => {
    const row = Math.floor(i / perRow);
    const inRow = row === rows - 1 ? panels - row * perRow : perRow;
    const col = i - row * perRow;
    const rowW = inRow * pw + (inRow - 1) * PANEL_GAP;
    return [(totalW - rowW) / 2 + col * (pw + PANEL_GAP), 8 + row * rowH];
  };
  const nodes: VisualNode[] = [];
  let shown = new Set<string>(footprintAfter([]));
  folds.forEach((f, i) => {
    const [ox, oy] = pos(i);
    nodes.push(
      group([...footprintNodes(shown, null, u, ox, oy), ...foldLine(f, shown, u, ox, oy, `fold${i}`), foldArrow(f, shown, u, ox, oy)], {
        id: `step${i}`,
      }),
    );
    nodes.push(text(ox + pw / 2, oy + pw + 14, String(i + 1), { size: 13 }));
    shown = footprintAfter(folds.slice(0, i + 1));
  });
  const [px, py] = pos(folds.length);
  nodes.push(
    group(
      [...footprintNodes(final, diag, u, px, py), ...punched.map((h) => holeNode(h, u, px, py, `hole:${h.r},${h.c}`))],
      { id: 'punch' },
    ),
  );
  nodes.push(text(px + pw / 2, py + pw + 14, '✂︎', { size: 13 }));
  const [qx, qy] = pos(folds.length + 1);
  nodes.push(grid(qx, qy, 1, 1, pw, { id: 'q', unknown: [{ r: 0, c: 0 }] }));
  // Semantic record of the folds for the validator (geometry is checked against it).
  folds.forEach((f, i) => {
    const ln = byId(nodes, `fold${i}`) as { id?: string } | undefined;
    if (ln) ln.id = `fold${i}:${f.axis}:${f.at}:${f.keep}:${f.r0 ?? ''}:${f.c0 ?? ''}:${f.size ?? ''}`;
  });
  const visual = spec(totalW, rows * rowH + 4, nodes, `Paper folded ${folds.length} time${folds.length > 1 ? 's' : ''}, punched, then opened`);

  // Distractors.
  const pool: Wrong[] = [];
  const lastOnly = unfold(folds.slice(-1), punched);
  if (folds.length > 1) pool.push({ visual: sheetOption(lastOnly), why: 'that is only unfolded once' });
  pool.push({ visual: sheetOption(punched), why: 'that is not unfolded at all' });
  // The classic mistake: copies slid across the fold instead of mirrored.
  const slid = (() => {
    let hs = punched.slice();
    for (let i = folds.length - 1; i >= 0; i--) {
      const f = folds[i];
      if (f.axis === 'd') return null;
      const b = bbox(footprintAfter(folds.slice(0, i)));
      const half = f.axis === 'v' ? (b.c1 - b.c0 + 1) / 2 : (b.r1 - b.r0 + 1) / 2;
      const dir = f.keep === 'low' ? 1 : -1;
      hs = [...hs, ...hs.map((h) => (f.axis === 'v' ? { ...h, c: h.c + dir * half } : { ...h, r: h.r + dir * half }))];
    }
    return hs;
  })();
  if (slid) pool.push({ visual: sheetOption(slid), why: 'the holes slid across instead of flipping' });
  const swapped = folds.map((f) => (f.axis === 'v' ? { ...f, axis: 'h' as const } : f.axis === 'h' ? { ...f, axis: 'v' as const } : f));
  const swappedHoles = unfold(swapped, punched).filter((h) => h.r >= 0 && h.r < N && h.c >= 0 && h.c < N);
  pool.push({ visual: sheetOption(swappedHoles), why: 'that opens the wrong way' });
  if (kind !== 'circle') pool.push({ visual: sheetOption(holes.map((h) => ({ ...h, rot, flipX: undefined, flipY: undefined }))), why: 'the holes did not flip over' });
  if (holes.length > 1) pool.push({ visual: sheetOption(holes.slice(0, -1)), why: 'a hole is missing' });
  const free: Hole[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!holes.some((h) => h.r === r && h.c === c)) free.push({ r, c, kind, rot });
  pool.push({ visual: sheetOption([...holes, pick(free, rng)]), why: 'one hole too many' });
  if (diag) {
    // Opened across the wrong line: the other slanted line, or straight up/down.
    const other = punched.concat(punched.map((h) => ({ ...h, r: N - 1 - h.c, c: N - 1 - h.r })));
    pool.push({ visual: sheetOption(other), why: 'that opens across the wrong slanted line' });
    for (const ax of ['v', 'h'] as const) {
      const alt = folds.map((f) => (f.axis === 'd' ? { axis: ax, at: ax === 'v' ? (f.c0! + f.size! / 2) : (f.r0! + f.size! / 2), keep: 'low' as const } : f));
      pool.push({ visual: sheetOption(unfold(alt, punched)), why: 'that opens straight, not across the slanted line' });
    }
  }
  const firstOnly = unfold(folds.slice(0, 1), punched);
  pool.push({ visual: sheetOption(firstOnly), why: 'some folds were not opened' });
  const wrong = pickWrongFair(ans, [...shuffle(pool.slice(0, 4), rng), ...shuffle(pool.slice(4), rng)], OPTION_COUNT[d], rng);
  if (!wrong) return null;

  const explanation: ExplainStep[] = [
    { text: `The paper is folded ${folds.length === 1 ? 'once' : folds.length === 2 ? 'twice' : 'three times'}, so the punch goes through ${2 ** folds.length} layers.`, visual },
    { text: 'Open it one fold at a time: each hole gets a mirror twin across the fold line.', visual, highlight: folds.map((_, i) => `step${i}`) },
    { text: `So there are ${holes.length} holes when it's open.`, visual: ans },
  ];
  return finish(ID, d, {
    prompt: 'Unfold the paper — which one?',
    speak: 'The paper is folded, then a hole is punched. Which picture shows the paper opened up?',
    visual,
    answer: choice(rng, ans, wrong),
    explanation,
    rule: `${folds.map((f) => f.axis).join(' then ')} fold, ${holes.length} holes`,
    variant,
  });
};

export const derivePaperFold = (p: Puzzle): { holes: Hole[] } | string[] => {
  const folds: Fold[] = [];
  for (let i = 0; ; i++) {
    const step = byId(p.visual.nodes, `step${i}`);
    if (!step || step.t !== 'g') break;
    const ln = step.children.find((c) => c.id?.startsWith(`fold${i}:`));
    if (!ln || ln.t !== 'line') return ['missing fold line'];
    const [, axis, at, keep, r0, c0, size] = ln.id!.split(':');
    const f: Fold = { axis: axis as Fold['axis'], at: Number(at), keep: keep as Fold['keep'], ...(axis === 'd' ? { r0: Number(r0), c0: Number(c0), size: Number(size) } : {}) };
    const geomOk = f.axis === 'v' ? ln.x1 === ln.x2 : f.axis === 'h' ? ln.y1 === ln.y2 : ln.x2 - ln.x1 === ln.y2 - ln.y1;
    if (!geomOk) return ['fold line drawn the wrong way'];
    folds.push(f);
  }
  if (!folds.length) return ['no folds'];
  const punch = byId(p.visual.nodes, 'punch');
  if (!punch || punch.t !== 'g') return ['no punched paper'];
  const punched: Hole[] = punch.children
    .filter((c): c is ShapeNode => c.t === 'shape' && !!c.id?.startsWith('hole:'))
    .map((s) => {
      const [r, c] = s.id!.slice(5).split(',').map(Number);
      return { r, c, kind: s.kind, rot: s.rotate ?? 0, flipX: s.flipX, flipY: s.flipY };
    });
  if (!punched.length) return ['no holes'];
  // Every punched spot must be on paper that is still there after all folds.
  const final = footprintAfter(folds);
  if (punched.some((h) => !final.has(k(h.r, h.c)))) return ['hole punched off the paper'];
  return { holes: foldForward(folds, punched) };
};

export const validatePaperFold = (p: Puzzle): string[] => {
  const r = derivePaperFold(p);
  if (Array.isArray(r)) return r;
  return checkVisualChoice(p, sheetOption(r.holes));
};

export const paperFold: PuzzleFamily = {
  id: ID,
  title: 'Fold and punch',
  emoji: '✂️',
  group: 'spatial',
  variants: [...VARIANTS[1], ...VARIANTS[2], ...VARIANTS[3]],
  generate: (d, rng) => generateValid(() => attempt(d, rng), validatePaperFold),
  validate: validatePaperFold,
};
