import { useId } from 'react';
import type { ReactNode } from 'react';
import type { Picture } from './pictures';

/** SVG user units per grid unit (keeps font sizes > 1 for Safari). */
export const S = 40;

export interface Mapper {
  x: (gx: number) => number;
  y: (gy: number) => number;
}

const INK = '#1b2559';
const RAINBOW = ['#7048E8', '#1C7ED6', '#2F9E44', '#FAB005', '#FD7E14', '#F03E3E'];

/**
 * The picture as far as it is drawn: `placed` targets (Infinity = all). Parts fill when their
 * last point is placed; lines are keyed so only new ones animate in.
 */
export function PartsLayer({
  pic,
  off,
  placed,
  map,
  showMarkers = true,
  animate = true,
}: {
  pic: Picture;
  off: number;
  placed: number;
  map: Mapper;
  showMarkers?: boolean;
  animate?: boolean;
}) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const fills: ReactNode[] = [];
  const lines: ReactNode[] = [];
  const dots: ReactNode[] = [];
  const markers: ReactNode[] = [];
  const X = (p: readonly [number, number]) => map.x(p[0] + off);
  const Y = (p: readonly [number, number]) => map.y(p[1] + off);
  const anim = animate ? ' is-anim' : '';

  let start = 0;
  pic.parts.forEach((part, pi) => {
    const n = part.pts.length;
    const k = Math.max(0, Math.min(n, placed - start));
    start += n;
    if (k === 0) return;
    const line = part.line ?? INK;
    const width = (part.width ?? 0.14) * S;
    if (n === 1) {
      const p = part.pts[0];
      dots.push(
        <circle
          key={`d${pi}`}
          className={`co-bigdot${anim}`}
          cx={X(p)}
          cy={Y(p)}
          r={(part.r ?? 0.4) * S}
          fill={part.fill ?? line}
          stroke={part.line ?? INK}
          strokeWidth={0.08 * S}
        />,
      );
      return;
    }
    const done = k === n;
    if (done && part.fill) {
      const fill = part.fill === 'rainbow' ? `url(#${gid}-rb)` : part.fill;
      fills.push(
        <polygon
          key={`f${pi}`}
          className={`co-fill${anim}`}
          points={part.pts.map((p) => `${X(p)},${Y(p)}`).join(' ')}
          fill={fill}
        />,
      );
    }
    for (let j = 1; j < k; j++) {
      const a = part.pts[j - 1];
      const b = part.pts[j];
      lines.push(
        <line
          key={`l${pi}-${j}`}
          className={`co-seg${anim}`}
          x1={X(a)}
          y1={Y(a)}
          x2={X(b)}
          y2={Y(b)}
          stroke={line}
          strokeWidth={width}
          pathLength={1}
        />,
      );
    }
    if (done && part.closed) {
      const a = part.pts[n - 1];
      const b = part.pts[0];
      lines.push(
        <line
          key={`l${pi}-c`}
          className={`co-seg${anim}`}
          x1={X(a)}
          y1={Y(a)}
          x2={X(b)}
          y2={Y(b)}
          stroke={line}
          strokeWidth={width}
          pathLength={1}
        />,
      );
    }
    if (showMarkers) {
      for (let j = 0; j < k; j++) {
        const p = part.pts[j];
        markers.push(<circle key={`m${pi}-${j}`} className="co-marker" cx={X(p)} cy={Y(p)} r={0.13 * S} />);
      }
    }
  });

  const rb = pic.rainbow;
  return (
    <g className="co-parts">
      {rb && (
        <defs>
          <radialGradient
            id={`${gid}-rb`}
            gradientUnits="userSpaceOnUse"
            cx={map.x(rb.c[0] + off)}
            cy={map.y(rb.c[1] + off)}
            r={rb.r1 * S}
          >
            {RAINBOW.flatMap((c, i) => {
              const f0 = rb.r0 / rb.r1;
              const a = f0 + ((1 - f0) * i) / RAINBOW.length;
              const b = f0 + ((1 - f0) * (i + 1)) / RAINBOW.length;
              return [<stop key={`${i}a`} offset={a} stopColor={c} />, <stop key={`${i}b`} offset={b} stopColor={c} />];
            })}
          </radialGradient>
        </defs>
      )}
      {fills}
      {lines}
      {markers}
      {dots}
    </g>
  );
}

/** A finished picture on its own (gallery, summary). */
export function PictureArt({ pic, className, grid = true }: { pic: Picture; className?: string; grid?: boolean }) {
  const pad = 0.8;
  const n = pic.size;
  const map: Mapper = { x: (gx) => (gx + pad) * S, y: (gy) => (n - gy + pad) * S };
  const vb = (n + 2 * pad) * S;
  const ticks = Array.from({ length: n + 1 }, (_, i) => i);
  return (
    <svg className={className} viewBox={`0 0 ${vb} ${vb}`} role="img" aria-label={pic.name}>
      {grid &&
        ticks.map((i) => (
          <g key={i} className="co-art-grid">
            <line x1={map.x(i)} y1={map.y(0)} x2={map.x(i)} y2={map.y(n)} />
            <line x1={map.x(0)} y1={map.y(i)} x2={map.x(n)} y2={map.y(i)} />
          </g>
        ))}
      <PartsLayer pic={pic} off={0} placed={Infinity} map={map} showMarkers={false} animate={false} />
    </svg>
  );
}
