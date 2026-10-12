import type { TrophyId } from '../types';
import { sfx } from '../sound/sfx';
import { toast } from '../ui/toastStore';
import { rewards, rewardsStore } from './rewardsStore';
import { trophyDef } from './trophies';
import { getSettings } from '../settings/settingsStore';

/** Unlock a trophy; when it is new, play the chime and toast. Returns true when newly unlocked. */
export function awardTrophy(id: TrophyId, opts: { quiet?: boolean } = {}): boolean {
  const isNew = rewards.unlockTrophy(id);
  if (isNew && !opts.quiet) {
    const t = trophyDef(id);
    sfx.play('trophy');
    toast.show(`Trophy: ${t.title}!`, { emoji: t.emoji, kind: 'trophy', durationMs: 2600 });
  }
  return isNew;
}

/** Lifetime-point trophies; returns newly unlocked ids. */
export function checkLifetimeTrophies(quiet = false): TrophyId[] {
  const out: TrophyId[] = [];
  const life = rewardsStore.get().lifetime;
  if (life >= 5000 && awardTrophy('thousand-club', { quiet })) out.push('thousand-club');
  if (life >= 50000 && awardTrophy('ten-k-club', { quiet })) out.push('ten-k-club');
  return out;
}

/**
 * Call after adding points. When today's goal is first reached: toast + sound + streak trophies.
 * Returns newly unlocked trophy ids.
 */
export function checkGoalAndAnnounce(): TrophyId[] {
  const out: TrophyId[] = [];
  if (rewards.checkDailyGoal()) {
    sfx.play('combo');
    const s = rewardsStore.get();
    toast.show(`Daily goal! ${getSettings().dailyGoal} points`, {
      emoji: '🎯',
      kind: 'success',
      durationMs: 2600,
    });
    if (s.goalStreak >= 7 && awardTrophy('goal-7')) out.push('goal-7');
    if (s.goalStreak >= 30 && awardTrophy('goal-30')) out.push('goal-30');
  }
  return out;
}
