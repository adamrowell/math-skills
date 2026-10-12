/**
 * Points for the reading apps (credited per item as he reads — quitting never loses them),
 * plus round-end bonuses, stars and trophies.
 *
 *   Read Words, per word:   first try  round(20·prior) + 5 if read within 3 s, × combo
 *                           second try round(8·prior)    (after "not quite" / "say it again")
 *                           after 🔊   2                 (he heard it first)
 *                           skipped    0
 *   Read Sentences, per word read on the first pass 3·prior, re-read 1; clean sentence +20·prior × combo.
 *   No voice (practice mode): 0 — points need the microphone to check the reading.
 *   Round end: +15 per new star, +30 perfect round, +50 first real round of the day.
 *   A round stopped early keeps its per-item points but earns no stars, best or bonus.
 */
import {
  awardTrophy,
  checkGoalAndAnnounce,
  checkLifetimeTrophies,
  rewards,
  sfx,
} from '../../../core';
import type { AppId, RankInfo, TrophyId } from '../../../core';
import { comboMultiplier } from '../../../drill';
import { readingStore, starsFor } from './progress';
import type { ReadingAppId } from './progress';

export { comboMultiplier };

export const WORD_POINTS = { first: 20, fastBonus: 5, fastMs: 3000, second: 8, helped: 2 };
export const SENTENCE_POINTS = { word: 3, reread: 1, clean: 20 };
export const ROUND_BONUS = { star: 15, perfect: 30, firstRound: 50 };

export function wordPoints(o: { prior: number; attempt: number; helped: boolean; ms: number; combo: number }): number {
  if (o.helped) return WORD_POINTS.helped;
  if (o.attempt > 1) return Math.round(WORD_POINTS.second * o.prior);
  const base = Math.round(WORD_POINTS.first * o.prior) + (o.ms <= WORD_POINTS.fastMs ? WORD_POINTS.fastBonus : 0);
  return Math.round(base * comboMultiplier(o.combo));
}

/** Credit points now (per item) and announce the daily goal when reached. */
export function credit(app: AppId, points: number, note: string): void {
  if (points <= 0) return;
  rewards.addPoints(app, points, 'answer', note);
  checkGoalAndAnnounce();
}

export interface RoundOutcome {
  stars: 0 | 1 | 2 | 3;
  /** The round was stopped before the last item: no stars, best or bonuses. */
  stopped: boolean;
  prevStars: number;
  newBest: boolean;
  bonusLines: Array<{ label: string; points: number; emoji?: string }>;
  bonusTotal: number;
  trophies: TrophyId[];
  rankUp: RankInfo | null;
}

/**
 * Close a round: stars + level best, bonuses, trophies. `firstTry` = items read right on the
 * first try with the microphone. Practice rounds (no voice) earn nothing.
 */
export function finishRound(o: {
  app: ReadingAppId;
  levelId: string;
  firstTry: number;
  /** Items (words) scored: firstTry is out of this. */
  total: number;
  /** False when he stopped before the end of the round. */
  complete: boolean;
  bestCombo: number;
  voiced: boolean;
  rankBefore: number;
}): RoundOutcome {
  const store = readingStore(o.app);
  const prev = store.get().levels[o.levelId];
  const prevStars = prev?.stars ?? 0;
  const counts = o.voiced && o.complete;
  const stars = counts ? starsFor(o.firstTry, o.total) : 0;
  const newBest = counts && o.firstTry > (prev?.best ?? 0);
  store.update((p) => ({
    ...p,
    lastLevel: o.levelId,
    levels: {
      ...p.levels,
      [o.levelId]: {
        best: Math.max(prev?.best ?? 0, counts ? o.firstTry : 0),
        stars: Math.max(prevStars, stars) as 0 | 1 | 2 | 3,
        plays: (prev?.plays ?? 0) + 1,
      },
    },
  }));
  const bonusLines: RoundOutcome['bonusLines'] = [];
  if (counts) {
    const gained = Math.max(0, stars - prevStars);
    if (gained) bonusLines.push({ label: gained > 1 ? `${gained} new stars` : 'New star', points: gained * ROUND_BONUS.star, emoji: '⭐' });
    if (o.total >= 5 && o.firstTry === o.total) bonusLines.push({ label: 'Perfect', points: ROUND_BONUS.perfect, emoji: '💯' });
    const real = o.total >= 5 && o.firstTry / o.total >= 0.65;
    if (real && rewards.claimFirstRound(o.app)) bonusLines.push({ label: 'First round today', points: ROUND_BONUS.firstRound, emoji: '🌅' });
  }
  const bonusTotal = bonusLines.reduce((a, b) => a + b.points, 0);
  if (bonusTotal > 0) rewards.addPoints(o.app, bonusTotal, 'bonus', 'Round bonus');

  const trophies: TrophyId[] = [];
  const got = (id: TrophyId, cond: boolean) => {
    if (cond && awardTrophy(id, { quiet: true })) trophies.push(id);
  };
  if (counts) {
    got('first-round', o.firstTry > 0);
    got('combo-10', o.bestCombo >= 10);
    got('combo-25', o.bestCombo >= 25);
  }
  trophies.push(...checkLifetimeTrophies(true));
  trophies.push(...checkGoalAndAnnounce());
  const rankNow = rewards.rank();
  const rankUp = rankNow.index > o.rankBefore ? rankNow : null;
  if (rankUp || stars > prevStars) sfx.play('pb');
  else sfx.play('roundEnd');
  if (trophies.length) setTimeout(() => sfx.play('trophy'), 700);
  return { stars, stopped: !o.complete, prevStars, newBest, bonusLines, bonusTotal, trophies, rankUp };
}
