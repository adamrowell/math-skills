/** Small helpers shared by the drill engine. */

export function randInt(lo: number, hi: number, rng: () => number = Math.random): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function formatSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
