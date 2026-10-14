/**
 * Asymmetric "block figures" for the mirror and rotation families: a polyomino of coloured blocks
 * on a 4×4 lattice in a 100×100 box, plus one or two marker shapes (dot, star, arrow, triangle)
 * sitting in blocks. Built so that no turn or flip maps the figure onto itself.
 */
import type { Color, Rng, ShapeKind, VisualNode, VisualSpec } from '../../engine/types';
import { allRotations, mirrorSpec, pick, polygon, randInt, sameVisual, shape, shuffle, spec } from '../../engine/shapes';

export const BOX = 100;
const U = 24;

type Cell = [number, number]; // [col, row]

export interface Figure {
  cells: Cell[];
  fill: Color;
  markers: Array<{ cell: Cell; kind: ShapeKind; fill: Color; rot: number }>;
}

const key = (c: Cell) => `${c[0]},${c[1]}`;

/** A random connected polyomino of n cells inside a 4×4 lattice. */
export const polyomino = (n: number, rng: Rng): Cell[] => {
  const cells: Cell[] = [[randInt(0, 3, rng), randInt(0, 3, rng)]];
  const has = new Set([key(cells[0])]);
  for (let guard = 0; cells.length < n && guard < 200; guard++) {
    const [c, r] = pick(cells, rng);
    const [dc, dr] = pick(
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as Cell[],
      rng,
    );
    const nc: Cell = [c + dc, r + dr];
    if (nc[0] < 0 || nc[0] > 3 || nc[1] < 0 || nc[1] > 3 || has.has(key(nc))) continue;
    has.add(key(nc));
    cells.push(nc);
  }
  return cells;
};

const BLOCK_FILLS: Color[] = ['blue', 'teal', 'orange', 'purple', 'green'];
const MARKS: Array<{ kind: ShapeKind; fill: Color }> = [
  { kind: 'circle', fill: 'red' },
  { kind: 'star', fill: 'yellow' },
  { kind: 'arrow', fill: 'white' },
  { kind: 'triangle', fill: 'white' },
  { kind: 'heart', fill: 'pink' },
];

export const randomFigure = (n: number, markers: number, rng: Rng): Figure => {
  const cells = polyomino(n, rng);
  const fill = pick(BLOCK_FILLS, rng);
  const marks = shuffle(MARKS, rng).slice(0, markers);
  const spots = shuffle(cells, rng);
  return {
    cells,
    fill,
    markers: marks.map((m, i) => ({ cell: spots[i % spots.length], ...m, rot: m.kind === 'arrow' || m.kind === 'triangle' ? pick([0, 90, 180, 270], rng) : 0 })),
  };
};

/** Blocks and markers, with the figure centred in the box (so position never gives a flip away). */
export const figureNodes = (f: Figure): VisualNode[] => {
  const xs = f.cells.map((c) => c[0]);
  const ys = f.cells.map((c) => c[1]);
  const ox = BOX / 2 - ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * U;
  const oy = BOX / 2 - ((Math.min(...ys) + Math.max(...ys) + 1) / 2) * U;
  const blocks = f.cells.map(([c, r]) =>
    polygon(
      [
        [ox + c * U, oy + r * U],
        [ox + (c + 1) * U, oy + r * U],
        [ox + (c + 1) * U, oy + (r + 1) * U],
        [ox + c * U, oy + (r + 1) * U],
      ],
      { fill: f.fill, strokeWidth: 2 },
    ),
  );
  const marks = f.markers.map((m) =>
    shape(m.kind, ox + (m.cell[0] + 0.5) * U, oy + (m.cell[1] + 0.5) * U, U * 0.78, { fill: m.fill, strokeWidth: 1.5, ...(m.rot ? { rotate: m.rot } : {}) }),
  );
  return [...blocks, ...marks];
};

export const figureSpec = (f: Figure): VisualSpec => spec(BOX, BOX, figureNodes(f), 'A figure made of blocks');

/** True when some flip or turn (other than doing nothing) maps the picture onto itself. */
export const hasSymmetry = (s: VisualSpec): boolean => {
  const rots = allRotations(s);
  if (rots.slice(1).some((r) => sameVisual(r, s))) return true;
  return rots.some((r) => sameVisual(mirrorSpec(r, 'x'), s));
};

/** Move one marker to a different block (an "altered" figure). */
export const moveMarker = (f: Figure, rng: Rng): Figure | null => {
  if (!f.markers.length) return null;
  const i = randInt(0, f.markers.length - 1, rng);
  const free = f.cells.filter((c) => !f.markers.some((m) => key(m.cell) === key(c)));
  if (!free.length) return null;
  const markers = f.markers.slice();
  markers[i] = { ...markers[i], cell: pick(free, rng) };
  return { ...f, markers };
};

/** Move one end block to another free spot touching the figure (keeps it connected-ish). */
export const moveBlock = (f: Figure, rng: Rng): Figure | null => {
  const has = new Set(f.cells.map(key));
  const markerCells = new Set(f.markers.map((m) => key(m.cell)));
  const removable = f.cells.filter((c) => !markerCells.has(key(c)));
  for (let t = 0; t < 20; t++) {
    const rm = pick(removable, rng);
    if (!rm) return null;
    const rest = f.cells.filter((c) => key(c) !== key(rm));
    const [c, r] = pick(rest, rng);
    const [dc, dr] = pick(
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as Cell[],
      rng,
    );
    const nc: Cell = [c + dc, r + dr];
    if (nc[0] < 0 || nc[0] > 3 || nc[1] < 0 || nc[1] > 3 || has.has(key(nc))) continue;
    return { ...f, cells: [...rest, nc] };
  }
  return null;
};

/** The figure turned by any multiple of 45° about the box centre (shrunk to fit when diagonal). */
export const turnAny = (s: VisualSpec, deg: number, scale = 1): VisualSpec =>
  spec(BOX, BOX, [
    {
      t: 'g',
      x: BOX / 2,
      y: BOX / 2,
      ...(deg % 360 ? { rotate: deg % 360 } : {}),
      ...(scale !== 1 ? { scale } : {}),
      children: [{ t: 'g', x: -BOX / 2, y: -BOX / 2, children: s.nodes }],
    },
  ]);

/** Read the figure nodes back out of a visual group (for validators). */
export const specOfGroup = (n: VisualNode | undefined): VisualSpec | null => (n && n.t === 'g' ? spec(BOX, BOX, n.children) : null);
