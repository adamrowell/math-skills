/**
 * <Visual> — the ONLY renderer of a VisualSpec (docs/GEO-LOGIC.md §E.4). Pure and deterministic:
 * no randomness, no Date, no measuring. Families produce data; this turns it into SVG.
 */
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { Color, FillPattern, GridNode, ShapeNode, VisualNode, VisualSpec } from './types';
import { shortHash } from './canon';
import { GRID_LINE, PALETTE, r2, shapePath } from './paint';

/** Interactive overlay for one grid (CellGrid / SudokuGrid). */
export interface GridEdit {
  gridId: string;
  /** cell key → fill (overrides the spec). */
  fills?: Record<string, Color | undefined>;
  /** cell key → node drawn in the cell (sudoku symbols). */
  nodes?: Record<string, VisualNode | undefined>;
  /** cell key → label (sudoku digits). */
  labels?: Record<string, string | undefined>;
  marks?: Record<string, 'bad' | 'good' | 'sel' | undefined>;
  onCell?: (key: string) => void;
  /** Keys that do not respond to taps. */
  locked?: Set<string>;
}

interface Ctx {
  pid: string;
  hl: Set<string>;
  edit?: GridEdit;
}

function fillRef(ctx: Ctx, color: Color, pattern: FillPattern | undefined): string {
  const c = PALETTE[color] ?? PALETTE.grey;
  if (!pattern || pattern === 'solid') return c;
  if (pattern === 'empty') return PALETTE.white;
  return `url(#${ctx.pid}-${pattern}-${color})`;
}

function patternDef(id: string, pattern: FillPattern, color: Color): ReactNode {
  const c = PALETTE[color] ?? PALETTE.grey;
  if (pattern === 'half') {
    return (
      <linearGradient id={id} key={id} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0.5" stopColor={c} />
        <stop offset="0.5" stopColor="#fff" />
      </linearGradient>
    );
  }
  if (pattern === 'striped') {
    return (
      <pattern id={id} key={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="#fff" />
        <rect width="4" height="8" fill={c} />
      </pattern>
    );
  }
  if (pattern === 'dotted') {
    return (
      <pattern id={id} key={id} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#fff" />
        <circle cx="3" cy="3" r="2" fill={c} />
      </pattern>
    );
  }
  return (
    <pattern id={id} key={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#fff" />
      <rect width="2.6" height="8" fill={c} />
      <rect width="8" height="2.6" fill={c} />
    </pattern>
  );
}

/** Every (pattern, colour) pair the picture uses → its <defs> entry. */
function collectDefs(pid: string, nodes: VisualNode[], extra: Array<VisualNode | undefined>, out: Map<string, ReactNode>): void {
  const visit = (n: VisualNode | undefined) => {
    if (!n) return;
    if ((n.t === 'shape' || n.t === 'path') && n.pattern && n.pattern !== 'solid' && n.pattern !== 'empty') {
      const color = n.fill ?? 'grey';
      if (color !== 'none') {
        const id = `${pid}-${n.pattern}-${color}`;
        if (!out.has(id)) out.set(id, patternDef(id, n.pattern, color));
      }
    }
    if (n.t === 'g') n.children.forEach(visit);
    if (n.t === 'scale') {
      n.left.forEach(visit);
      n.right.forEach(visit);
    }
    if (n.t === 'grid') for (const c of n.cells ?? []) visit(c.node);
  };
  nodes.forEach(visit);
  extra.forEach(visit);
}

function cls(ctx: Ctx, id?: string): string | undefined {
  return id && ctx.hl.has(id) ? 'is-hl' : undefined;
}

function Shape({ n, ctx }: { n: ShapeNode; ctx: Ctx }) {
  const sx = n.flipX ? -1 : 1;
  const sy = n.flipY ? -1 : 1;
  const tf = `translate(${r2(n.x)} ${r2(n.y)})${n.rotate ? ` rotate(${r2(n.rotate)})` : ''}${sx !== 1 || sy !== 1 ? ` scale(${sx} ${sy})` : ''}`;
  const isDot = n.kind === 'dot';
  const fillColor: Color = n.fill ?? (isDot ? 'ink' : 'white');
  const stroke = n.stroke ?? 'ink';
  const fill = fillColor === 'none' ? 'none' : fillRef(ctx, fillColor, n.pattern);
  const d = shapePath(n.kind, n.size, n.aspect);
  return (
    <g transform={tf} className={cls(ctx, n.id)} opacity={n.opacity} data-id={n.id}>
      <path
        d={d}
        fill={fill}
        stroke={stroke === 'none' ? 'none' : PALETTE[stroke]}
        strokeWidth={isDot ? Math.min(n.strokeWidth ?? 1.5, n.size / 4) : (n.strokeWidth ?? 2.5)}
        strokeLinejoin="round"
      />
    </g>
  );
}

function Grid({ n, ctx }: { n: GridNode; ctx: Ctx }) {
  const edit = ctx.edit && n.id === ctx.edit.gridId ? ctx.edit : undefined;
  const byKey = new Map((n.cells ?? []).map((c) => [`${c.r},${c.c}`, c]));
  const unknown = new Set((n.unknown ?? []).map((u) => `${u.r},${u.c}`));
  const lines = n.lines !== false;
  const stroke = n.stroke ? PALETTE[n.stroke] : GRID_LINE;
  const out: ReactNode[] = [];
  for (let r = 0; r < n.rows; r++) {
    for (let c = 0; c < n.cols; c++) {
      const key = `${r},${c}`;
      const cell = byKey.get(key);
      const x = n.x + c * n.cell;
      const y = n.y + r * n.cell;
      const fillC = edit?.fills && key in edit.fills ? edit.fills[key] : cell?.fill;
      const mark = edit?.marks?.[key];
      const label = edit?.labels && key in edit.labels ? edit.labels[key] : cell?.label;
      const node = edit?.nodes && key in edit.nodes ? edit.nodes[key] : cell?.node;
      const tappable = Boolean(edit?.onCell) && !edit?.locked?.has(key);
      const isUnknown = unknown.has(key);
      out.push(
        <g key={key}>
          <rect
            x={x}
            y={y}
            width={n.cell}
            height={n.cell}
            fill={fillC ? PALETTE[fillC] : lines || isUnknown ? '#fff' : 'none'}
            stroke={isUnknown ? PALETTE.ink : lines ? stroke : 'none'}
            strokeWidth={isUnknown ? 2.5 : 2}
            strokeDasharray={isUnknown ? '6 5' : undefined}
            className={`lg-cell${mark ? ` is-${mark}` : ''}${tappable ? ' is-tap' : ''}`}
            data-cell={edit ? key : undefined}
            data-fill={edit ? (fillC ?? '') : undefined}
            role={tappable ? 'button' : undefined}
            aria-label={tappable ? `Square row ${r + 1} column ${c + 1}` : undefined}
            onPointerDown={
              tappable
                ? (e) => {
                    e.preventDefault();
                    edit!.onCell!(key);
                  }
                : undefined
            }
          />
          {node && (
            <g transform={`translate(${x} ${y})`} pointerEvents="none">
              <Node n={node} ctx={ctx} />
            </g>
          )}
          {label !== undefined && label !== '' && (
            <text
              x={x + n.cell / 2}
              y={y + n.cell / 2}
              className="lg-text"
              fontSize={n.cell * (label.length <= 2 ? 0.5 : label.length === 3 ? 0.36 : Math.max(0.2, 1 / label.length))}
              textAnchor="middle"
              dominantBaseline="central"
              fill={PALETTE.ink}
              pointerEvents="none"
            >
              {label}
            </text>
          )}
          {isUnknown && (
            <text
              x={x + n.cell / 2}
              y={y + n.cell / 2}
              className="lg-text lg-q"
              fontSize={n.cell * 0.6}
              textAnchor="middle"
              dominantBaseline="central"
              fill={PALETTE.ink}
              pointerEvents="none"
            >
              ?
            </text>
          )}
        </g>,
      );
    }
  }
  return (
    <g className={cls(ctx, n.id)} opacity={n.opacity} data-id={n.id}>
      {out}
    </g>
  );
}

function Node({ n, ctx }: { n: VisualNode; ctx: Ctx }): ReactNode {
  switch (n.t) {
    case 'shape':
      return <Shape n={n} ctx={ctx} />;
    case 'text':
      return (
        <text
          x={n.x}
          y={n.y}
          fontSize={n.size ?? 18}
          fontWeight={n.weight ?? 900}
          textAnchor={n.anchor ?? 'middle'}
          dominantBaseline="central"
          fill={PALETTE[n.fill ?? 'ink']}
          className={`lg-text${cls(ctx, n.id) ? ' is-hl' : ''}`}
          opacity={n.opacity}
          data-id={n.id}
        >
          {n.text}
        </text>
      );
    case 'emoji':
      return (
        <text
          x={n.x}
          y={n.y}
          fontSize={n.size}
          textAnchor="middle"
          dominantBaseline="central"
          className={`lg-emoji${cls(ctx, n.id) ? ' is-hl' : ''}`}
          opacity={n.opacity}
          data-id={n.id}
        >
          {n.char}
        </text>
      );
    case 'line': {
      const col = PALETTE[n.stroke ?? 'ink'];
      const w = n.strokeWidth ?? 2.5;
      const head = (x1: number, y1: number, x2: number, y2: number) => {
        const a = Math.atan2(y2 - y1, x2 - x1);
        const L = 4 + w * 2.2;
        const p1 = [x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45)];
        const p2 = [x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45)];
        return <path d={`M${r2(p1[0])} ${r2(p1[1])} L${r2(x2)} ${r2(y2)} L${r2(p2[0])} ${r2(p2[1])}`} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
      };
      return (
        <g className={cls(ctx, n.id)} opacity={n.opacity} data-id={n.id}>
          <line x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={col} strokeWidth={w} strokeLinecap="round" strokeDasharray={n.dash ? '6 5' : undefined} />
          {n.arrow && head(n.x1, n.y1, n.x2, n.y2)}
          {n.arrow === 'both' && head(n.x2, n.y2, n.x1, n.y1)}
        </g>
      );
    }
    case 'path': {
      const fc = n.fill ?? 'none';
      return (
        <path
          d={n.d}
          fill={fc === 'none' ? 'none' : fillRef(ctx, fc, n.pattern)}
          stroke={n.stroke === 'none' ? 'none' : PALETTE[n.stroke ?? 'ink']}
          strokeWidth={n.strokeWidth ?? 2.5}
          strokeDasharray={n.dash ? '6 5' : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
          className={cls(ctx, n.id)}
          opacity={n.opacity}
          data-id={n.id}
        />
      );
    }
    case 'grid':
      return <Grid n={n} ctx={ctx} />;
    case 'clock': {
      const { x, y, r } = n;
      const ticks: ReactNode[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i * 30 * Math.PI) / 180;
        const big = i % 3 === 0;
        const r1 = r * (big ? 0.8 : 0.86);
        ticks.push(
          <line
            key={`t${i}`}
            x1={r2(x + r1 * Math.sin(a))}
            y1={r2(y - r1 * Math.cos(a))}
            x2={r2(x + r * 0.94 * Math.sin(a))}
            y2={r2(y - r * 0.94 * Math.cos(a))}
            stroke={PALETTE.ink}
            strokeWidth={big ? Math.max(2, r * 0.05) : Math.max(1, r * 0.025)}
            strokeLinecap="round"
          />,
        );
        if (r >= 34) {
          const rn = r * 0.66;
          ticks.push(
            <text
              key={`n${i}`}
              x={r2(x + rn * Math.sin(a))}
              y={r2(y - rn * Math.cos(a))}
              fontSize={r * 0.22}
              textAnchor="middle"
              dominantBaseline="central"
              className="lg-text"
              fill={PALETTE.ink}
            >
              {i === 0 ? 12 : i}
            </text>,
          );
        }
      }
      const m = n.minute ?? 0;
      const ha = (((n.hour % 12) + m / 60) * 30 * Math.PI) / 180;
      const ma = (m * 6 * Math.PI) / 180;
      return (
        <g className={cls(ctx, n.id)} opacity={n.opacity} data-id={n.id} data-time={`${n.hour}:${String(m).padStart(2, '0')}`}>
          <circle cx={x} cy={y} r={r} fill="#fff" stroke={PALETTE.ink} strokeWidth={Math.max(2.5, r * 0.06)} />
          {ticks}
          <line x1={x} y1={y} x2={r2(x + r * 0.5 * Math.sin(ha))} y2={r2(y - r * 0.5 * Math.cos(ha))} stroke={PALETTE.ink} strokeWidth={Math.max(3, r * 0.09)} strokeLinecap="round" />
          {n.minute !== undefined && (
            <line x1={x} y1={y} x2={r2(x + r * 0.8 * Math.sin(ma))} y2={r2(y - r * 0.8 * Math.cos(ma))} stroke={PALETTE.red} strokeWidth={Math.max(2, r * 0.05)} strokeLinecap="round" />
          )}
          <circle cx={x} cy={y} r={Math.max(2.5, r * 0.07)} fill={PALETTE.ink} />
        </g>
      );
    }
    case 'scale': {
      const { x, y, width: w, tilt } = n;
      const ang = (tilt * 8 * Math.PI) / 180;
      const lx = x - (w / 2) * Math.cos(ang);
      const ly = y - (w / 2) * Math.sin(ang);
      const rx = x + (w / 2) * Math.cos(ang);
      const ry = y + (w / 2) * Math.sin(ang);
      const pw = w * 0.42;
      const drop = 34;
      const pan = (px: number, py: number, kids: VisualNode[], side: string) => (
        <g key={side}>
          <line x1={px} y1={py} x2={px - pw / 2} y2={py + drop} stroke={PALETTE.ink} strokeWidth={1.5} />
          <line x1={px} y1={py} x2={px + pw / 2} y2={py + drop} stroke={PALETTE.ink} strokeWidth={1.5} />
          <path
            d={`M${r2(px - pw / 2)} ${r2(py + drop)} Q${r2(px)} ${r2(py + drop + 14)} ${r2(px + pw / 2)} ${r2(py + drop)} Z`}
            fill="#e9edf8"
            stroke={PALETTE.ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <g transform={`translate(${r2(px)} ${r2(py + drop - 13)})`}>
            {kids.map((k, i) => (
              <Node key={i} n={k} ctx={ctx} />
            ))}
          </g>
        </g>
      );
      return (
        <g className={cls(ctx, n.id)} opacity={n.opacity} data-id={n.id} data-tilt={tilt}>
          <path d={`M${x - 26} ${y + 86} L${x + 26} ${y + 86} L${x + 12} ${y + 76} L${x - 12} ${y + 76} Z`} fill={PALETTE.brown} stroke={PALETTE.ink} strokeWidth={2} />
          <line x1={x} y1={y} x2={x} y2={y + 78} stroke={PALETTE.ink} strokeWidth={4} strokeLinecap="round" />
          <line x1={r2(lx)} y1={r2(ly)} x2={r2(rx)} y2={r2(ry)} stroke={PALETTE.ink} strokeWidth={5} strokeLinecap="round" />
          <path d={`M${x - 7} ${y - 2} L${x} ${y - 12} L${x + 7} ${y - 2} Z`} fill={PALETTE.ink} />
          {pan(r2(lx), r2(ly), n.left, 'l')}
          {pan(r2(rx), r2(ry), n.right, 'r')}
        </g>
      );
    }
    case 'g': {
      const s = n.scale ?? 1;
      const sx = (n.flipX ? -1 : 1) * s;
      const sy = (n.flipY ? -1 : 1) * s;
      const tf = `translate(${r2(n.x ?? 0)} ${r2(n.y ?? 0)})${n.rotate ? ` rotate(${r2(n.rotate)})` : ''}${sx !== 1 || sy !== 1 ? ` scale(${sx} ${sy})` : ''}`;
      return (
        <g transform={tf} className={cls(ctx, n.id)} opacity={n.opacity} data-id={n.id}>
          {n.children.map((c, i) => (
            <Node key={i} n={c} ctx={ctx} />
          ))}
        </g>
      );
    }
    default:
      return null;
  }
}

export interface VisualProps {
  spec: VisualSpec;
  size?: 'sm' | 'md' | 'lg';
  highlight?: string[];
  edit?: GridEdit;
  className?: string;
  testId?: string;
}

export function Visual({ spec, size = 'md', highlight, edit, className = '', testId = 'visual' }: VisualProps) {
  const pid = useId().replace(/:/g, '');
  const ctx: Ctx = { pid, hl: new Set(highlight ?? []), edit };
  const defs = new Map<string, ReactNode>();
  collectDefs(pid, spec.nodes, edit?.nodes ? Object.values(edit.nodes) : [], defs);
  return (
    <svg
      className={`lg-visual lg-visual--${size} ${className}`}
      viewBox={`0 0 ${spec.w} ${spec.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={spec.label ?? 'Puzzle picture'}
      data-testid={testId}
      data-vis={shortHash(spec)}
    >
      {defs.size > 0 && <defs>{[...defs.values()]}</defs>}
      {spec.nodes.map((n, i) => (
        <Node key={i} n={n} ctx={ctx} />
      ))}
    </svg>
  );
}
