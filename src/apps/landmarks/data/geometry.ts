/** Small geometry helpers over the generated map paths ("M x y L x y … Z", absolute coordinates). */

export type Ring = Array<[number, number]>;

export function pathRings(d: string): Ring[] {
  const rings: Ring[] = [];
  for (const part of d.split('M').slice(1)) {
    // "x y L x y x y …" — implicit line-tos, so read the numbers in pairs.
    const nums = part.replace(/[LZ]/g, ' ').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    const pts: Ring = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    if (pts.length >= 3) rings.push(pts);
  }
  return rings;
}

/** Even-odd point-in-polygon over all rings. */
export function inRings(rings: Ring[], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Distance from a point to the shape (0 when inside). */
export function distToRings(rings: Ring[], x: number, y: number): number {
  if (inRings(rings, x, y)) return 0;
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j];
      const [bx, by] = ring[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
      best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
  }
  return best;
}
