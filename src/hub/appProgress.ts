/**
 * One short "how am I doing" line per app for the hub cards.
 *
 * Reads each app's saved progress straight from storage (read-only) so the hub never has to load
 * an app's code. Stores are flushed first so a round that just ended is included.
 */
import { flushAllStores } from '../core';
import type { AppId, RewardsState } from '../core';

function read(key: string): Record<string, unknown> | null {
  try {
    const txt = window.localStorage.getItem(key);
    if (!txt) return null;
    const v = JSON.parse(txt) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Facts at Leitner box 5 ("gold") in a drill app's mastery store. */
function goldFacts(appId: string): number {
  const facts = obj(read(`ms2:mastery:${appId}:v1`)?.facts);
  let n = 0;
  for (const f of Object.values(facts)) if (num(obj(f).box) >= 5) n++;
  return n;
}

function starSum(map: unknown, prefix = ''): number {
  let n = 0;
  for (const [k, v] of Object.entries(obj(map))) {
    if (!k.startsWith(prefix)) continue;
    n += typeof v === 'number' ? v : num(obj(v).stars);
  }
  return n;
}

export interface AppProgressLine {
  /** e.g. "Best 36 · 22 gold". */
  text: string;
  /** Nothing played yet. */
  fresh: boolean;
}

export function appProgress(appId: AppId, rewards: RewardsState): AppProgressLine {
  const best = (k: string) => {
    const v = rewards.bests[k];
    return typeof v === 'number' ? v : null;
  };
  const sprint = best(`${appId}:sprint60:all`);
  switch (appId) {
    case 'multiplication':
    case 'division': {
      const gold = goldFacts(appId);
      if (sprint === null && gold === 0) return { text: '✨ New!', fresh: true };
      return { text: [sprint !== null ? `🏅 Best ${sprint}` : '', `🌟 ${gold} gold`].filter(Boolean).join(' · '), fresh: false };
    }
    case 'addition':
    case 'mixed':
      return sprint === null ? { text: '✨ New!', fresh: true } : { text: `🏅 Best ${sprint}`, fresh: false };
    case 'coordinates': {
      const n = Object.keys(obj(read('ms2:gallery:coordinates:v1')?.entries)).length;
      return n === 0 ? { text: '✨ New!', fresh: true } : { text: `🖼️ ${n}/19 pictures`, fresh: false };
    }
    case 'algebra': {
      const p = read('ms2:algebra:progress:v1');
      const lvl = Math.max(1, num(p?.unlocked));
      const played = Object.values(obj(p?.played)).reduce<number>((a, v) => a + num(v), 0);
      return played === 0 && lvl === 1 ? { text: '✨ New!', fresh: true } : { text: `🔓 Level ${lvl} of 5`, fresh: false };
    }
    case 'words':
    case 'sentences': {
      const stars = starSum(read(`ms2:reading:${appId}:v1`)?.levels);
      return stars === 0 ? { text: '✨ New!', fresh: true } : { text: `⭐ ${stars} stars`, fresh: false };
    }
    case 'maps': {
      const stars = starSum(read('ms2:maps:progress:v1')?.stars);
      return stars === 0 ? { text: '✨ New!', fresh: true } : { text: `⭐ ${stars} stars`, fresh: false };
    }
    case 'stories': {
      const p = read('ms2:stories:progress:v1');
      const stars = starSum(p?.stars);
      const played = Object.values(obj(p?.played)).reduce<number>((a, v) => a + num(v), 0);
      return played === 0 ? { text: '✨ New!', fresh: true } : { text: `🔓 Level ${Math.max(1, num(p?.unlocked))} · ⭐ ${stars}`, fresh: false };
    }
    case 'flags': {
      // docs/GEO-LOGIC.md §C.6: collected = stickers in the album.
      const n = Object.keys(obj(read('ms2:flags:progress:v1')?.collected)).length;
      return n === 0 ? { text: '✨ New!', fresh: true } : { text: `🏳️ ${n} flags`, fresh: false };
    }
    case 'landmarks': {
      // docs/GEO-LOGIC.md §D.7: passport stamps.
      const n = Object.keys(obj(read('ms2:landmarks:progress:v1')?.stamps)).length;
      return n === 0 ? { text: '✨ New!', fresh: true } : { text: `🛂 ${n} stamps`, fresh: false };
    }
    case 'logic': {
      // docs/GEO-LOGIC.md §E.8: rounds played + families at hard.
      const p = read('ms2:logic:progress:v1');
      const rounds = num(p?.rounds);
      const hard = Object.values(obj(p?.level)).filter((v) => num(v) >= 3).length;
      return rounds === 0 ? { text: '✨ New!', fresh: true } : { text: `🧠 ${rounds} rounds · 🔥 ${hard} at hard`, fresh: false };
    }
    default:
      return { text: '', fresh: true };
  }
}

/** Make sure rounds that just ended are on disk before the hub reads them. */
export function flushProgress(): void {
  try {
    flushAllStores();
  } catch {
    /* storage off: cards just show "New!" */
  }
}
