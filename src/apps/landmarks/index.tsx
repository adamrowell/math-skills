import { useEffect } from 'react';
import { back } from '../../core';
import type { AppProps } from '../../core';
import { Credits } from './Credits';
import { FindRound } from './FindRound';
import { Gallery } from './Gallery';
import { LandmarksHome } from './LandmarksHome';
import { Passport } from './Passport';
import { levelById } from './levels';
import { isUnlocked, progressStore } from './progress';
import '../maps/maps.css';
import './landmarks.css';

/**
 * Routes: '' → home · 'find/<level>' → round · 'passport' · 'gallery' · 'credits'.
 * Locked or unknown deep links fall back to the home screen.
 */
export default function LandmarksApp({ segments, navigate }: AppProps) {
  const [view, levelId, nonce] = segments;
  const level = view === 'find' ? levelById(levelId ?? '') : undefined;
  const playable = Boolean(level && isUnlocked(progressStore.get(), level));
  const known = view === undefined || playable || view === 'passport' || view === 'gallery' || view === 'credits';

  useEffect(() => {
    if (!known) navigate('/landmarks', { replace: true });
  }, [known, navigate]);

  const home = () => back('/landmarks');

  if (playable && level) {
    return (
      <FindRound
        key={`${level.id}/${nonce ?? ''}`}
        level={level}
        onExit={home}
        onAgain={() => navigate(`/landmarks/find/${level.id}/${Date.now().toString(36)}`, { replace: true })}
        onPlayLevel={(id) => navigate(`/landmarks/find/${id}`, { replace: true })}
        onPassport={() => navigate('/landmarks/passport', { replace: true })}
      />
    );
  }
  if (view === 'passport') return <Passport onBack={home} />;
  if (view === 'gallery') return <Gallery onBack={home} onCredits={() => navigate('/landmarks/credits')} />;
  if (view === 'credits') return <Credits onBack={() => back('/landmarks')} />;
  return (
    <LandmarksHome
      onBack={() => back('/')}
      onPlay={(id) => navigate(`/landmarks/find/${id}`)}
      onPassport={() => navigate('/landmarks/passport')}
      onGallery={() => navigate('/landmarks/gallery')}
      onCredits={() => navigate('/landmarks/credits')}
    />
  );
}
