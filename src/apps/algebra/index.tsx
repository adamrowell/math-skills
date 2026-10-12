import { useEffect } from 'react';
import { back } from '../../core';
import type { AppProps } from '../../core';
import { AlgebraHome } from './AlgebraHome';
import { AlgebraRound } from './AlgebraRound';
import { progressStore } from './progress';
import type { LevelId } from './problems';

/** Routes: '' → home · 'play/<level>' → a set of 10. Locked levels redirect home. */
export default function AlgebraApp({ segments, navigate }: AppProps) {
  const [view, a] = segments;
  const unlocked = progressStore.useStore((p) => p.unlocked);
  const lv = Number(a);
  const level = view === 'play' && Number.isInteger(lv) && lv >= 1 && lv <= unlocked ? (lv as LevelId) : null;
  const bad = view !== undefined && !(view === 'play' && level !== null);

  useEffect(() => {
    if (bad) navigate('/algebra', { replace: true });
  }, [bad, navigate]);

  if (level !== null) {
    return (
      <AlgebraRound
        key={level}
        level={level}
        onExit={() => back('/algebra')}
        onPlayLevel={(l) => navigate(`/algebra/play/${l}`, { replace: true })}
      />
    );
  }
  return <AlgebraHome onBack={() => back('/')} onPlay={(l) => navigate(`/algebra/play/${l}`)} />;
}
