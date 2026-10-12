import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import type { Level } from './levels';
import type { P, Picture } from './pictures';
import { PartsLayer, S } from './art';
import type { Mapper } from './art';
import { SNAP_RADIUS, fmtNum, formatPoint } from './game';

export interface Mark {
  id: number;
  kind: 'miss' | 'between' | 'auto';
  at: P;
}

interface Props {
  level: Level;
  pic: Picture;
  off: number;
  placed: number;
  /** Current target on the level grid (null when finished). */
  target: P | null;
  /** Misses on the current target: 1 lights the x line, 2 also the y line. */
  hint: number;
  marks: Mark[];
  cooling: boolean;
  done: boolean;
  onTap: (gx: number, gy: number, anchor: { clientX: number; clientY: number }) => void;
}

/** Geometry of the board in SVG units. */
function geometry(level: Level) {
  const q1 = level.min >= 0;
  const padL = q1 ? 1.0 : 0.6;
  const padB = q1 ? 0.85 : 0.6;
  const padR = 0.8;
  const padT = 0.6;
  const span = level.max - level.min;
  const map: Mapper = {
    x: (gx) => (gx - level.min + padL) * S,
    y: (gy) => (level.max - gy + padT) * S,
  };
  return { q1, map, w: (span + padL + padR) * S, h: (span + padT + padB) * S, padL, padT };
}

export function Board({ level, pic, off, placed, target, hint, marks, cooling, done, onTap }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { q1, map, w, h, padL, padT } = geometry(level);
  const [hover, setHover] = useState<P | null>(null);

  const toGrid = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!svg || !ctm) return null;
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      // Invert map.
      const gx = p.x / S - padL + level.min;
      const gy = level.max - (p.y / S - padT);
      return [gx, gy];
    },
    [level, padL, padT],
  );

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const g = toGrid(e.clientX, e.clientY);
    if (g) onTap(g[0], g[1], { clientX: e.clientX, clientY: e.clientY });
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'mouse' || level.hover === 'none') return;
    const g = toGrid(e.clientX, e.clientY);
    let next: P | null = null;
    if (g) {
      const nx = Math.round(g[0]);
      const ny = Math.round(g[1]);
      const inside = nx >= level.min && nx <= level.max && ny >= level.min && ny <= level.max;
      if (inside && Math.hypot(g[0] - nx, g[1] - ny) <= SNAP_RADIUS) next = [nx, ny];
    }
    setHover((prev) => (prev?.[0] === next?.[0] && prev?.[1] === next?.[1] ? prev : next));
  };

  const ticks: number[] = [];
  for (let i = level.min; i <= level.max; i++) ticks.push(i);
  const labelled = (v: number) => v % level.labelStep === 0;
  const hx = target && hint >= 1 ? target[0] : null;
  const hy = target && hint >= 2 ? target[1] : null;
  const showHover = hover && !done && level.hover !== 'none';

  // Axis positions: Quadrant I sits on the bottom/left edges; four quadrants cross at 0.
  const axisY = q1 ? level.min : 0;
  const axisX = q1 ? level.min : 0;
  const xLabelY = map.y(axisY) + (q1 ? 0.58 : 0.55) * S;
  const yLabelX = map.x(axisX) - (q1 ? 0.5 : 0.38) * S;

  return (
    <svg
      ref={svgRef}
      className={`co-board${cooling ? ' is-cooling' : ''}${done ? ' is-done' : ''}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMin meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="board"
      data-min={level.min}
      data-max={level.max}
      data-padl={padL}
      data-padt={padT}
      role="application"
      aria-label="Grid. Tap the point."
    >
      <rect className="co-paper" x={map.x(level.min)} y={map.y(level.max)} width={(level.max - level.min) * S} height={(level.max - level.min) * S} rx={4} />

      {/* Hint bands */}
      {hx !== null && (
        <line className="co-band co-band--x" x1={map.x(hx)} y1={map.y(level.min)} x2={map.x(hx)} y2={map.y(level.max)} />
      )}
      {hy !== null && (
        <line className="co-band co-band--y" x1={map.x(level.min)} y1={map.y(hy)} x2={map.x(level.max)} y2={map.y(hy)} />
      )}

      {/* Grid */}
      <g className="co-gridlines">
        {ticks.map((i) => (
          <g key={i}>
            <line x1={map.x(i)} y1={map.y(level.min)} x2={map.x(i)} y2={map.y(level.max)} />
            <line x1={map.x(level.min)} y1={map.y(i)} x2={map.x(level.max)} y2={map.y(i)} />
          </g>
        ))}
      </g>
      <g className="co-axes">
        <line x1={map.x(level.min)} y1={map.y(axisY)} x2={map.x(level.max) + 0.45 * S} y2={map.y(axisY)} />
        <line x1={map.x(axisX)} y1={map.y(level.min)} x2={map.x(axisX)} y2={map.y(level.max) - 0.3 * S} />
        <polygon
          points={`${map.x(level.max) + 0.7 * S},${map.y(axisY)} ${map.x(level.max) + 0.4 * S},${map.y(axisY) - 0.17 * S} ${map.x(level.max) + 0.4 * S},${map.y(axisY) + 0.17 * S}`}
        />
        <polygon
          points={`${map.x(axisX)},${map.y(level.max) - 0.55 * S} ${map.x(axisX) - 0.17 * S},${map.y(level.max) - 0.27 * S} ${map.x(axisX) + 0.17 * S},${map.y(level.max) - 0.27 * S}`}
        />
      </g>

      {/* Hover helpers (desktop) */}
      {showHover && level.hover === 'coords' && hover && (
        <g className="co-cross" data-testid="crosshair">
          <line x1={map.x(hover[0])} y1={map.y(hover[1])} x2={map.x(hover[0])} y2={map.y(axisY)} className="co-cross__x" />
          <line x1={map.x(hover[1] === axisY ? hover[0] : axisX)} y1={map.y(hover[1])} x2={map.x(hover[0])} y2={map.y(hover[1])} className="co-cross__y" />
        </g>
      )}

      <PartsLayer pic={pic} off={off} placed={placed} map={map} showMarkers={!done} />

      {/* Axis numbers */}
      <g className="co-labels">
        {ticks.map((i) => {
          const isHint = hx === i;
          const isHover = showHover && level.hover === 'coords' && hover?.[0] === i;
          if (!q1 && i === 0) return null;
          if (!labelled(i) && !isHint && !isHover) return null;
          return (
            <g key={`x${i}`} className={`co-tick co-tick--x${isHint ? ' is-hint' : ''}${isHover ? ' is-hover' : ''}`} data-testid={isHint ? 'hint-x' : undefined}>
              {(isHint || isHover) && <circle cx={map.x(i)} cy={xLabelY - 0.2 * S} r={0.36 * S} />}
              <text x={map.x(i)} y={xLabelY - 0.2 * S} dy="0.36em">
                {fmtNum(i)}
              </text>
            </g>
          );
        })}
        {ticks.map((i) => {
          const isHint = hy === i;
          const isHover = showHover && level.hover === 'coords' && hover?.[1] === i;
          if (!q1 && i === 0) return null;
          if (!labelled(i) && !isHint && !isHover) return null;
          return (
            <g key={`y${i}`} className={`co-tick co-tick--y${isHint ? ' is-hint' : ''}${isHover ? ' is-hover' : ''}`} data-testid={isHint ? 'hint-y' : undefined}>
              {(isHint || isHover) && <circle cx={yLabelX} cy={map.y(i)} r={0.36 * S} />}
              <text x={yLabelX} y={map.y(i)} dy="0.36em">
                {fmtNum(i)}
              </text>
            </g>
          );
        })}
        {!q1 && (
          <text className="co-origin" x={map.x(0) - 0.32 * S} y={map.y(0) + 0.5 * S} dy="0.1em">
            0
          </text>
        )}
        <text className="co-axis-name co-axis-name--x" x={map.x(level.max) + 0.55 * S} y={map.y(axisY) + 0.5 * S} dy="0.1em">
          x
        </text>
        <text className="co-axis-name co-axis-name--y" x={map.x(axisX) + 0.42 * S} y={map.y(level.max) - 0.32 * S} dy="0.36em">
          y
        </text>
      </g>


      {/* Marks: misses (red ✕ with its coordinates), between taps, auto-placed points */}
      {marks.map((m) => {
        const cx = map.x(m.at[0]);
        const cy = map.y(m.at[1]);
        if (m.kind === 'between') return <circle key={m.id} className="co-mark-between" cx={cx} cy={cy} r={0.3 * S} />;
        if (m.kind === 'auto')
          return <circle key={m.id} className="co-mark-auto" cx={cx} cy={cy} r={0.45 * S} data-testid="auto-mark" />;
        const label = formatPoint(m.at);
        const lw = (label.length * 0.25 + 0.4) * S;
        const above = m.at[1] < level.max - 0.5;
        const ly = above ? cy - 0.75 * S : cy + 0.75 * S;
        const lx = Math.min(Math.max(cx, map.x(level.min) + lw / 2), map.x(level.max) - lw / 2);
        return (
          <g key={m.id} className="co-mark-miss" data-testid="miss-mark" data-x={m.at[0]} data-y={m.at[1]}>
            <path d={`M${cx - 0.25 * S},${cy - 0.25 * S}L${cx + 0.25 * S},${cy + 0.25 * S}M${cx + 0.25 * S},${cy - 0.25 * S}L${cx - 0.25 * S},${cy + 0.25 * S}`} />
            <rect x={lx - lw / 2} y={ly - 0.3 * S} width={lw} height={0.6 * S} rx={0.3 * S} />
            <text x={lx} y={ly} dy="0.36em">
              {label}
            </text>
          </g>
        );
      })}

      {showHover && hover && (
        <g className="co-hover" data-testid="hover-dot">
          <circle cx={map.x(hover[0])} cy={map.y(hover[1])} r={0.3 * S} />
          {level.hover === 'coords' && (
            <g className="co-hover__label">
              <rect
                x={map.x(hover[0]) - 1.15 * S}
                y={map.y(hover[1]) - (hover[1] >= level.max - 0.5 ? -0.45 : 1.15) * S}
                width={2.3 * S}
                height={0.7 * S}
                rx={0.35 * S}
              />
              <text x={map.x(hover[0])} y={map.y(hover[1]) - (hover[1] >= level.max - 0.5 ? -0.8 : 0.8) * S} dy="0.36em">
                <tspan className="co-x">{fmtNum(hover[0])}</tspan>
                <tspan>, </tspan>
                <tspan className="co-y">{fmtNum(hover[1])}</tspan>
              </text>
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
