import { useEffect } from 'react';
import { back } from '../../core';
import type { AppProps } from '../../core';
import { ExploreScreen } from './ExploreScreen';
import { MapsHome } from './MapsHome';
import { RoundScreen } from './RoundScreen';
import { isNameUnlocked, isStageUnlocked, progressStore } from './progress';
import { packOf, stageById } from './stages';
import './maps.css';

/**
 * Routes: '' → home · 'find/<stage>' / 'name/<stage>' → round · 'explore/<stage>' → learn mode.
 * Locked stages (deep links) fall back to the home screen.
 */
export default function MapsApp({ segments, navigate }: AppProps) {
  const [view, stageId] = segments;
  const stage = stageById(stageId ?? '');
  const progress = progressStore.get();
  const playable =
    stage && ((view === 'find' && isStageUnlocked(progress, stage)) || (view === 'name' && isNameUnlocked(progress, stage)));
  const explorable = view === 'explore' && stage;
  const unknown = view !== undefined && !playable && !explorable;

  useEffect(() => {
    if (unknown) navigate('/maps', { replace: true });
  }, [unknown, navigate]);

  const play = (mode: 'find' | 'name', id: string) => navigate(`/maps/${mode}/${id}`);

  if (playable && stage && (view === 'find' || view === 'name')) {
    return (
      <RoundScreen
        key={`${view}/${stage.id}/${segments[2] ?? ''}`}
        stage={stage}
        mode={view}
        onExit={() => back('/maps')}
        onAgain={() => navigate(`/maps/${view}/${stage.id}/${Date.now().toString(36)}`, { replace: true })}
        onPlayStage={(m, id) => navigate(`/maps/${m}/${id}`, { replace: true })}
      />
    );
  }
  if (explorable && stage) {
    return (
      <ExploreScreen
        stage={stage}
        onBack={() => back('/maps')}
        onStage={(id) => navigate(`/maps/explore/${id}`, { replace: true })}
      />
    );
  }
  return (
    <MapsHome
      onBack={() => back('/')}
      onPlay={play}
      onExplore={(id) => navigate(`/maps/explore/${id || packOf(progress.pack).exploreStage}`)}
    />
  );
}
