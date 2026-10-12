import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import type { InsetSpec, LoadedMap, Region, ViewBox } from './types';

export type RegionMark = 'correct' | 'wrong' | 'reveal' | 'target' | 'selected' | 'hint';

export interface MapLabel {
  id: string;
  text: string;
  tone?: 'good' | 'bad' | 'info';
}

interface Props {
  map: LoadedMap;
  view: ViewBox;
  inset?: InsetSpec;
  /** Alternative camera + inset for tall containers (portrait). */
  portrait?: { view: ViewBox; inset: InsetSpec };
  /** In-play regions (others are greyed). Undefined → all. */
  active?: ReadonlySet<string>;
  marks?: Readonly<Record<string, RegionMark>>;
  labels?: MapLabel[];
  /** Soft dashed circle "it's around here" (map units). */
  hintCircle?: { x: number; y: number; r: number } | null;
  /** Fill override per region (mastery colours in Explore). */
  fillFor?: (id: string) => string | undefined;
  onTap?: (id: string) => void;
  disabled?: boolean;
}

const LAND_COLORS = ['#FFC56B', '#7DD3A6', '#FF9FB8', '#8EC1FF', '#C9A8FF', '#FFE27A', '#7EDFE0'];
const CONTINENT_COLORS: Record<string, string> = {
  'north-america': '#FFB25B',
  'south-america': '#7DD3A6',
  europe: '#C9A8FF',
  africa: '#FFD95A',
  asia: '#FF9FB8',
  oceania: '#5FD0E8',
  antarctica: '#FFFFFF',
};
const OCEAN_COLORS: Record<string, string> = {
  pacific: '#9FD3F7',
  atlantic: '#B3DDF9',
  indian: '#A7D7F7',
  arctic: '#C5E6FB',
  southern: '#B9E0F9',
};
const DIM = '#E4E9F2';

/** Greedy colouring so neighbours (overlapping bboxes) get different colours. */
const colorCache = new WeakMap<LoadedMap, Map<string, string>>();
function colorsFor(map: LoadedMap): Map<string, string> {
  const hit = colorCache.get(map);
  if (hit) return hit;
  const out = new Map<string, string>();
  if (map.kind === 'continents') {
    for (const r of map.land) out.set(r.id, CONTINENT_COLORS[r.id] ?? LAND_COLORS[0]);
  } else {
    const pad = 1.5;
    const touches = (a: Region, b: Region) =>
      a.bbox[0] - pad <= b.bbox[2] && b.bbox[0] - pad <= a.bbox[2] && a.bbox[1] - pad <= b.bbox[3] && b.bbox[1] - pad <= a.bbox[3];
    const order = [...map.land].sort((a, b) => b.bbox[2] - b.bbox[0] + b.bbox[3] - b.bbox[1] - (a.bbox[2] - a.bbox[0] + a.bbox[3] - a.bbox[1]));
    for (const r of order) {
      const used = new Set<string>();
      for (const o of map.land) if (o !== r && out.has(o.id) && touches(r, o)) used.add(out.get(o.id)!);
      out.set(r.id, LAND_COLORS.find((c) => !used.has(c)) ?? LAND_COLORS[r.id.length % LAND_COLORS.length]);
    }
  }
  for (const o of map.oceans) out.set(o.id, OCEAN_COLORS[o.id] ?? '#B3DDF9');
  colorCache.set(map, out);
  return out;
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Tweens the viewBox (CSS cannot animate it). */
function useAnimatedView(target: ViewBox): ViewBox {
  const [cur, setCur] = useState<ViewBox>(target);
  const curRef = useRef(cur);
  curRef.current = cur;
  const key = target.join(',');
  useEffect(() => {
    const from = curRef.current;
    const to = target;
    if (from.join(',') === to.join(',')) return;
    if (reducedMotion()) {
      setCur(to);
      return;
    }
    const t0 = performance.now();
    const ms = 550;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setCur(from.map((v, i) => v + (to[i] - v) * e) as ViewBox);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return cur;
}

function useSize<T extends Element>(): [React.RefObject<T>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

const intersects = (b: Region['bbox'], v: ViewBox) => b[0] <= v[0] + v[2] && b[2] >= v[0] && b[1] <= v[1] + v[3] && b[3] >= v[1];

interface LandProps {
  regions: Region[];
  colors: Map<string, string>;
  active?: ReadonlySet<string>;
  marks?: Readonly<Record<string, RegionMark>>;
  fillFor?: (id: string) => string | undefined;
  inset?: boolean;
  continents: boolean;
}

const LandLayer = memo(function LandLayer({ regions, colors, active, marks, fillFor, inset, continents }: LandProps) {
  return (
    <>
      {regions.map((r) => {
        const on = !active || active.has(r.id);
        const fill = fillFor?.(r.id) ?? (on ? colors.get(r.id) : DIM);
        const mark = marks?.[r.id];
        return (
          <path
            key={r.id}
            d={r.d}
            data-region={r.id}
            data-name={r.label}
            data-lx={r.lx}
            data-ly={r.ly}
            data-inset={inset ? '1' : undefined}
            className={`mp-land${on ? ' is-on' : ' is-off'}${mark ? ` is-${mark}` : ''}${continents ? ' is-continent' : ''}`}
            style={{ '--fill': fill } as CSSProperties}
          />
        );
      })}
    </>
  );
});

export function MapView(props: Props) {
  const [wrapRef, size] = useSize<HTMLDivElement>();
  const tall = Boolean(props.portrait) && size.h > size.w * 0.85;
  const view = tall && props.portrait ? props.portrait.view : props.view;
  const inset = tall && props.portrait ? props.portrait.inset : props.inset;
  // Render the map only once the box is measured, so the first camera is already the right one.
  return (
    <div className="mp-mapwrap" ref={wrapRef}>
      {size.w > 0 && <MapViewInner {...props} view={view} inset={inset} size={size} />}
    </div>
  );
}

function MapViewInner({
  map,
  view,
  inset,
  active,
  marks,
  labels,
  hintCircle,
  fillFor,
  onTap,
  disabled,
  size,
}: Props & { size: { w: number; h: number } }) {
  const v = useAnimatedView(view);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const colors = colorsFor(map);
  const { data } = map;
  const isWorld = map.kind !== 'us';
  const continents = map.kind === 'continents';

  // Map units per screen px (preserveAspectRatio meet).
  const k = size.w > 0 && size.h > 0 ? Math.max(v[2] / size.w, v[3] / size.h) : v[2] / 900;

  const visible = useMemo(() => map.land.filter((r) => intersects(r.bbox, [view[0] - 40, view[1] - 40, view[2] + 80, view[3] + 80])), [map, view]);

  // Invisible tap halos (≥ 20 px) under tiny in-play land, so islands and slivers are hittable.
  const halos = useMemo(
    () =>
      visible.filter((r) => {
        if (active && !active.has(r.id)) return false;
        const w = (r.bbox[2] - r.bbox[0]) / k;
        const h = (r.bbox[3] - r.bbox[1]) / k;
        return Math.min(w, h) < 34 || r.lr / k < 9;
      }),
    [visible, active, k],
  );

  const insetRegions = useMemo(() => (inset ? map.land.filter((r) => intersects(r.bbox, inset.src)) : []), [map, inset]);

  const marked = useMemo(() => Object.keys(marks ?? {}).map((id) => map.byId.get(id)).filter((r): r is Region => Boolean(r)), [marks, map]);

  const handleClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (disabled || !onTap) return;
    const el = (e.target as Element).closest?.('[data-region]');
    const id = el?.getAttribute('data-region');
    if (id) onTap(id);
  };

  const fontPx = size.w && size.w < 640 ? 17 : 21;
  const insetScale = inset ? inset.dst[2] / inset.src[2] : 1;

  const labelEls = (labels ?? []).map((l) => {
    const r = map.byId.get(l.id);
    if (!r) return null;
    const inInset = inset && !r.isOcean && intersects(r.bbox, inset.src) && (r.bbox[2] - r.bbox[0]) / k < 40;
    let x = r.lx;
    let y = r.ly;
    if (inInset && inset) {
      x = inset.dst[0] + (r.lx - inset.src[0]) * insetScale;
      y = inset.dst[1] + (r.ly - inset.src[1]) * insetScale;
    }
    const fs = fontPx * k;
    // Keep the label on screen.
    const halfW = (l.text.length * fs * 0.3) + fs * 0.4;
    x = Math.max(v[0] + halfW, Math.min(v[0] + v[2] - halfW, x));
    y = Math.max(v[1] + fs * 1.1, Math.min(v[1] + v[3] - fs * 0.4, y - fs * 0.2));
    return (
      <text key={`${l.id}-${l.text}`} x={x} y={y} className={`mp-label is-${l.tone ?? 'info'}`} style={{ fontSize: fs, strokeWidth: fs * 0.32 }} data-testid="map-label">
        {l.text}
      </text>
    );
  });

  return (
    <svg
      className={`mp-map mp-map--${map.kind}${disabled ? ' is-disabled' : ''}`}
      viewBox={v.join(' ')}
      preserveAspectRatio="xMidYMid meet"
      onClick={handleClick}
      role="img"
      aria-label="Map"
      data-testid="map"
    >
      <defs>
        {inset && (
          <clipPath id={`clip-${uid}`}>
            <rect x={inset.dst[0]} y={inset.dst[1]} width={inset.dst[2]} height={inset.dst[3]} rx={10} />
          </clipPath>
        )}
      </defs>
      {isWorld && data.sphere ? (
        <path d={data.sphere} className="mp-sea" />
      ) : (
        <rect x={v[0] - 2000} y={v[1] - 2000} width={v[2] + 4000} height={v[3] + 4000} className="mp-sea mp-sea--us" />
      )}
      {isWorld && data.graticule && <path d={data.graticule} className="mp-grat" />}

      {map.oceans.map((o) => {
        const on = !active || active.has(o.id);
        const mark = marks?.[o.id];
        return (
          <path
            key={o.id}
            d={o.d}
            data-region={o.id}
            data-name={o.label}
            data-lx={o.lx}
            data-ly={o.ly}
            className={`mp-ocean${on ? ' is-on' : ' is-off'}${mark ? ` is-${mark}` : ''}`}
            style={{ '--fill': fillFor?.(o.id) ?? colors.get(o.id) } as CSSProperties}
          />
        );
      })}

      {halos.map((r) => (
        <circle key={`h-${r.id}`} cx={r.lx} cy={r.ly} r={Math.max(r.lr, 20 * k)} data-region={r.id} className="mp-halo" />
      ))}

      <g className="mp-landlayer">
        <LandLayer regions={visible} colors={colors} active={active} marks={marks} fillFor={fillFor} continents={continents} />
      </g>

      {/* Outline marked regions on top so their border is never hidden by neighbours. */}
      {marked.map((r) => (
        <path key={`m-${r.id}`} d={r.d} className={`mp-outline is-${marks?.[r.id]}`} />
      ))}

      {hintCircle && (
        <circle cx={hintCircle.x} cy={hintCircle.y} r={hintCircle.r} className="mp-hint" data-testid="hint-circle" />
      )}

      {inset && (
        <g className="mp-inset" data-testid="inset">
          <rect x={inset.dst[0]} y={inset.dst[1]} width={inset.dst[2]} height={inset.dst[3]} rx={10} className="mp-inset__bg" />
          <g clipPath={`url(#clip-${uid})`}>
            <g transform={`translate(${inset.dst[0]} ${inset.dst[1]}) scale(${insetScale}) translate(${-inset.src[0]} ${-inset.src[1]})`}>
              <LandLayer regions={insetRegions} colors={colors} active={active} marks={marks} fillFor={fillFor} inset continents={continents} />
              {marked
                .filter((r) => insetRegions.includes(r))
                .map((r) => (
                  <path key={`mi-${r.id}`} d={r.d} className={`mp-outline is-${marks?.[r.id]}`} />
                ))}
            </g>
          </g>
          <rect x={inset.dst[0]} y={inset.dst[1]} width={inset.dst[2]} height={inset.dst[3]} rx={10} className="mp-inset__frame" />
          <text x={inset.dst[0] + 4 * k} y={inset.dst[1] - 6 * k} className="mp-inset__tag" style={{ fontSize: 15 * k }}>
            🔍 Zoom
          </text>
        </g>
      )}

      <g className="mp-labels">{labelEls}</g>
    </svg>
  );
}
