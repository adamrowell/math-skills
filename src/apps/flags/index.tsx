import { useEffect } from 'react';
import { back } from '../../core';
import type { AppProps } from '../../core';
import { Album } from './Album';
import { FlagRound } from './FlagRound';
import { FlagsHome } from './FlagsHome';
import { SpotterRound } from './SpotterRound';
import { levelById } from './logic';
import { isLevelUnlocked, isSpotterUnlocked, isWhichUnlocked, progressStore } from './progress';
import '../maps/maps.css';
import './flags.css';

/**
 * Routes: '' home · 'find/<level>' · 'which/<level>' · 'spotter' · 'album'.
 * Locked deep links fall back to the home screen.
 */
export default function FlagsApp({ segments, navigate }: AppProps) {
  const [view, levelId] = segments;
  const p = progressStore.get();
  const level = levelById(levelId ?? '');
  const round =
    level && ((view === 'find' && isLevelUnlocked(p, level)) || (view === 'which' && isLevelUnlocked(p, level) && isWhichUnlocked(p, level.id)))
      ? level
      : null;
  const spotter = view === 'spotter' && isSpotterUnlocked(p);
  const album = view === 'album';
  const unknown = view !== undefined && !round && !spotter && !album;

  useEffect(() => {
    if (unknown) navigate('/flags', { replace: true });
  }, [unknown, navigate]);

  if (round && (view === 'find' || view === 'which')) {
    return (
      <FlagRound
        key={`${view}/${round.id}/${segments[2] ?? ''}`}
        level={round}
        mode={view}
        onExit={() => back('/flags')}
        onAgain={() => navigate(`/flags/${view}/${round.id}/${Date.now().toString(36)}`, { replace: true })}
        onGo={(r) => navigate(r, { replace: true })}
      />
    );
  }
  if (spotter) {
    return (
      <SpotterRound
        key={segments[1] ?? ''}
        onExit={() => back('/flags')}
        onAgain={() => navigate(`/flags/spotter/${Date.now().toString(36)}`, { replace: true })}
      />
    );
  }
  if (album) return <Album onBack={() => back('/flags')} />;
  return <FlagsHome onBack={() => back('/')} navigate={(r) => navigate(r)} />;
}
