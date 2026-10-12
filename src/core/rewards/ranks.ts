import type { RankDef, RankInfo } from '../types';

export const RANKS: RankDef[] = [
  { name: 'Rookie', emoji: '🐣', threshold: 0 },
  { name: 'Rising Star', emoji: '🌟', threshold: 250 },
  { name: 'Explorer', emoji: '🧭', threshold: 1000 },
  { name: 'Whiz', emoji: '⚡', threshold: 3000 },
  { name: 'Ace', emoji: '🚀', threshold: 7500 },
  { name: 'Champion', emoji: '🏆', threshold: 15000 },
  { name: 'Master', emoji: '🥋', threshold: 30000 },
  { name: 'Grand Master', emoji: '👑', threshold: 60000 },
  { name: 'Legend', emoji: '🐉', threshold: 100000 },
  { name: 'Wizard', emoji: '🧙', threshold: 175000 },
  { name: 'Infinity', emoji: '♾️', threshold: 300000 },
];

export function rankFor(lifetime: number): RankInfo {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (lifetime >= RANKS[i].threshold) index = i;
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  if (!next) return { rank, index, next: null, progress: 1, pointsToNext: 0 };
  const span = next.threshold - rank.threshold;
  return {
    rank,
    index,
    next,
    progress: Math.max(0, Math.min(1, (lifetime - rank.threshold) / span)),
    pointsToNext: Math.max(0, next.threshold - lifetime),
  };
}
