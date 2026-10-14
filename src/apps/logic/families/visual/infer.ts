/**
 * Rule inference used by validators: given the values of one attribute along a sequence, list every
 * prediction a sensible rule makes for the next value. A puzzle is fair when, for every attribute,
 * all fitting rules agree on exactly one prediction.
 *
 * Rules: repeating with period 1–4 (at least two confirmations visible) and arithmetic progressions
 * with a non-zero step (at least three terms; optionally modulo, for turns).
 */

export interface Fit {
  rule: string;
  next: string;
}

/** Every period p ≤ maxP that the shown values repeat with, confirmed ≥ 2 times. */
export const periodicFits = (vals: readonly string[], maxP = 4): Fit[] => {
  const out: Fit[] = [];
  const n = vals.length;
  for (let p = 1; p <= maxP; p++) {
    if (n - p < 2) break;
    let ok = true;
    for (let i = p; i < n; i++) if (vals[i] !== vals[i - p]) ok = false;
    if (ok) out.push({ rule: `repeat-${p}`, next: vals[n - p] });
  }
  return out;
};

/** A constant non-zero step (mod `mod` if given), shown at least 3 times. */
export const arithFit = (vals: readonly number[], mod?: number): Fit | null => {
  if (vals.length < 3) return null;
  const norm = (v: number) => (mod ? ((v % mod) + mod) % mod : v);
  const step = norm(vals[1] - vals[0]);
  if (step === 0) return null;
  for (let i = 2; i < vals.length; i++) if (norm(vals[i] - vals[i - 1]) !== step) return null;
  return { rule: `step-${step}`, next: String(norm(vals[vals.length - 1] + step)) };
};

/** All distinct predictions for one attribute. */
export const predictions = (vals: readonly string[], numeric: boolean, mod?: number): Fit[] => {
  const fits = periodicFits(vals);
  if (numeric) {
    const a = arithFit(vals.map(Number), mod);
    if (a) fits.push(a);
  }
  return fits;
};

export const uniqueNext = (fits: Fit[]): string | null => {
  const set = new Set(fits.map((f) => f.next));
  return set.size === 1 ? [...set][0] : null;
};
