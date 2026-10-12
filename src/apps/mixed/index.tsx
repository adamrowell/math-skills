import { useEffect } from 'react';
import { back } from '../../core';
import type { AppProps } from '../../core';
import { CHALLENGE_20, DrillScreen, formatById } from '../../drill';
import type { RoundFormat } from '../../drill';
import { FactsHome } from '../division/FactsHome';
import { mixedGenerator, setChip } from './facts';
import { MixPanel } from './MixPanel';
import './mixed.css';

const VALID_SET = (id: string) => mixedGenerator.sets().some((s) => s.id === id);
const ALLOWED = new Set(['sprint60', 'challenge20']);

/** Routes: '' → home · 'play/<sprint60|challenge20>/<set>' → round. */
export default function MixedApp({ segments, navigate }: AppProps) {
  const [view, a, b] = segments;
  const play = (f: RoundFormat, setId: string) => navigate(`/mixed/play/${f.id}/${setId}`);
  const format = view === 'play' && ALLOWED.has(a ?? '') ? formatById(a ?? '') : undefined;
  const setId = b && VALID_SET(b) ? b : 'all';
  const unknown = (view === 'play' && !format) || (view !== undefined && view !== 'play');

  useEffect(() => {
    if (unknown) navigate('/mixed', { replace: true });
  }, [unknown, navigate]);

  if (view === 'play' && format) {
    return (
      <DrillScreen
        key={`${format.id}/${setId}`}
        generator={mixedGenerator}
        format={format}
        setId={setId}
        title={`${format.title} · ${setChip(setId)}`}
        onExit={() => back('/mixed')}
      />
    );
  }
  return (
    <FactsHome
      generator={mixedGenerator}
      title="Mixed Blitz"
      emoji="🌀"
      chip={setChip}
      onBack={() => back('/')}
      onPlay={play}
      formats={[CHALLENGE_20]}
    >
      <MixPanel />
    </FactsHome>
  );
}
