import { useEffect } from 'react';
import { back } from '../../core';
import type { AppProps } from '../../core';
import { StoriesHome } from './StoriesHome';
import { StoryRound } from './StoryRound';
import { progressStore } from './progress';
import type { LevelId } from './problems';

/** Routes: '' → home · 'play/<level>' → a round of 8 stories. Locked levels redirect home. */
export default function StoriesApp({ segments, navigate }: AppProps) {
  const [view, a] = segments;
  const unlocked = progressStore.useStore((p) => p.unlocked);
  const lv = Number(a);
  const level = view === 'play' && Number.isInteger(lv) && lv >= 1 && lv <= unlocked ? (lv as LevelId) : null;
  const bad = view !== undefined && !(view === 'play' && level !== null);

  useEffect(() => {
    if (bad) navigate('/stories', { replace: true });
  }, [bad, navigate]);

  if (level !== null) {
    return (
      <StoryRound
        key={level}
        level={level}
        onExit={() => back('/stories')}
        onPlayLevel={(l) => navigate(`/stories/play/${l}`, { replace: true })}
      />
    );
  }
  return <StoriesHome onBack={() => back('/')} onPlay={(l) => navigate(`/stories/play/${l}`)} />;
}
