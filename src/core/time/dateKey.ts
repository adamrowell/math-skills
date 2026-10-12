import type { DateKey } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date 'YYYY-MM-DD'. */
export function dateKey(ts: number = Date.now()): DateKey {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Midnight (local) of the given day offset from today. */
export function dayStart(offsetDays = 0, now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.getTime();
}

/** The previous calendar day's key. */
export function yesterdayKey(now: number = Date.now()): DateKey {
  return dateKey(dayStart(-1, now));
}

/** Last `n` day keys, oldest first, ending today. */
export function lastNDays(n: number, now: number = Date.now()): DateKey[] {
  const out: DateKey[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(dateKey(dayStart(-i, now)));
  return out;
}

/** Day keys from Monday of this week through today. */
export function thisWeekKeys(now: number = Date.now()): DateKey[] {
  const dow = (new Date(now).getDay() + 6) % 7; // Monday = 0
  return lastNDays(dow + 1, now);
}

export function shortDayName(key: DateKey): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
}
