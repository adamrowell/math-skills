/** Canonical picture key: ids/labels ignored, numbers rounded to 0.5, child order ignored. */
import type { VisualSpec } from './types';
import { hashString } from './rng';

function canon(v: unknown): unknown {
  if (typeof v === 'number') return Math.round(v * 2) / 2;
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      if (k === 'id' || k === 'label') continue;
      const x = (v as Record<string, unknown>)[k];
      if (x === undefined) continue;
      if (k === 'children' || k === 'nodes' || k === 'left' || k === 'right') {
        out[k] = (x as unknown[]).map((n) => JSON.stringify(canon(n))).sort();
      } else out[k] = canon(x);
    }
    return out;
  }
  return v;
}

export function visualKey(s: VisualSpec): string {
  return JSON.stringify(canon({ w: s.w, h: s.h, nodes: s.nodes }));
}

/** Short stable hash for `data-vis` (tests compare options by it). */
export function shortHash(s: VisualSpec): string {
  return hashString(visualKey(s)).toString(36);
}
