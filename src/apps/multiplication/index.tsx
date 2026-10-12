import { useEffect } from 'react';
import { back } from '../../core';
import type { AppProps } from '../../core';
import { DrillScreen, formatById } from '../../drill';
import type { RoundFormat } from '../../drill';
import { multiplicationGenerator, setChip } from './facts';
import { MultiplicationHome } from './MultiplicationHome';
import { GridScreen } from './GridScreen';

const VALID_SET = (id: string) => multiplicationGenerator.sets().some((s) => s.id === id);

/** Routes: '' → home · 'play/<format>/<set>' → round · 'grid' → mastery grid. */
export default function MultiplicationApp({ segments, navigate }: AppProps) {
  const [view, a, b] = segments;
  const play = (f: RoundFormat, setId: string) => navigate(`/multiplication/play/${f.id}/${setId}`);

  const format = view === 'play' ? formatById(a ?? '') : undefined;
  const setId = b && VALID_SET(b) ? b : 'all';
  const unknown = (view === 'play' && !format) || (view !== undefined && view !== 'play' && view !== 'grid');

  useEffect(() => {
    if (unknown) navigate('/multiplication', { replace: true });
  }, [unknown, navigate]);

  if (view === 'play' && format) {
    return (
      <DrillScreen
        key={`${format.id}/${setId}`}
        generator={multiplicationGenerator}
        format={format}
        setId={setId}
        title={`${format.title} · ${setChip(setId)}`}
        onExit={() => back('/multiplication')}
      />
    );
  }
  if (view === 'grid') return <GridScreen onBack={() => back('/multiplication')} onPlay={play} />;
  return <MultiplicationHome onBack={() => back('/')} onPlay={play} onGrid={() => navigate('/multiplication/grid')} />;
}
