import { useEffect } from 'react';
import { back } from '../../core';
import type { AppProps } from '../../core';
import { isFamilyId } from './engine/registry';
import { isMode } from './progress';
import { uiStore } from './uiStore';
import { LogicHome } from './ui/LogicHome';
import { PlayScreen } from './ui/PlayScreen';
import { BrainMap } from './ui/BrainMap';
import './logic.css';

/**
 * Routes: '' → home · 'play/<mode>' → a round · 'play/adaptive/family/<id>' → practice one family ·
 * 'map' → Brain Map · 'gallery' → one of each. Unknown routes fall back to the home.
 */
export default function LogicApp({ segments, navigate }: AppProps) {
  const [view, a, b, c] = segments;
  const isPlay = view === 'play' && isMode(a) && (b === undefined || (b === 'family' && isFamilyId(c)));
  const known = view === undefined || isPlay || view === 'map' || view === 'gallery';

  useEffect(() => {
    if (!known) navigate('/logic', { replace: true });
  }, [known, navigate]);

  if (isPlay && isMode(a)) {
    const only = b === 'family' && isFamilyId(c) ? c : undefined;
    return <PlayScreen key={segments.join('/')} kind={only ? 'practice' : 'round'} mode={only ? 'adaptive' : a} only={only} onExit={() => back('/logic')} />;
  }
  if (view === 'gallery') {
    return <PlayScreen key="gallery" kind="gallery" mode="adaptive" level={uiStore.get().galleryLevel} onExit={() => back('/logic')} />;
  }
  if (view === 'map') {
    return <BrainMap onBack={() => back('/logic')} onPick={(f) => navigate(`/logic/play/adaptive/family/${f}`)} />;
  }
  return (
    <LogicHome
      onBack={() => back('/')}
      onPlay={(m) => navigate(`/logic/play/${m}`)}
      onFamily={(f) => navigate(`/logic/play/adaptive/family/${f}`)}
      onMap={() => navigate('/logic/map')}
      onGallery={() => navigate('/logic/gallery')}
    />
  );
}
