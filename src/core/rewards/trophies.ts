import type { TrophyDef, TrophyId } from '../types';

export const TROPHIES: TrophyDef[] = [
  { id: 'first-round', title: 'First Round', emoji: '🎉', description: 'Finish your first round' },
  { id: 'combo-10', title: 'On Fire', emoji: '🔥', description: '10 right in a row' },
  { id: 'combo-25', title: 'Blazing', emoji: '☄️', description: '25 right in a row' },
  { id: 'combo-50', title: 'Unstoppable', emoji: '🌋', description: '50 right in a row' },
  { id: 'speed-demon', title: 'Speed Demon', emoji: '⚡', description: '10 super-fast answers in one round' },
  { id: 'sharp-shooter', title: 'Sharp Shooter', emoji: '🎯', description: '95% right on 20+ questions' },
  { id: 'perfect-20', title: 'Perfect 20', emoji: '💯', description: '20+ answers, none wrong' },
  { id: 'table-tamer', title: 'Table Tamer', emoji: '🦁', description: 'Master a whole times table' },
  { id: 'grid-master', title: 'Grid Master', emoji: '🌟', description: 'All 144 facts gold' },
  { id: 'goal-7', title: 'Week Streak', emoji: '📅', description: 'Daily goal 7 days in a row' },
  { id: 'goal-30', title: 'Month Streak', emoji: '🗓️', description: 'Daily goal 30 days in a row' },
  { id: 'thousand-club', title: '5,000 Club', emoji: '💎', description: 'Earn 5,000 points' },
  { id: 'ten-k-club', title: '50K Club', emoji: '👑', description: 'Earn 50,000 points' },
];

const byId = new Map(TROPHIES.map((t) => [t.id, t]));

export function trophyDef(id: TrophyId): TrophyDef {
  return byId.get(id) ?? { id, title: id, emoji: '🏅', description: '' };
}
