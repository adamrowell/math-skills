import { useEffect } from 'react';
import { back, beginPlay } from '../../core';
import type { AppProps } from '../../core';
import { isUnlocked, readingStore } from '../words/reading/progress';
import { SENTENCE_LEVELS, sentenceLevelById } from '../../data/reading/sentences';
import { ReadingHome } from '../words/ReadingHome';
import { SentenceRound } from './SentenceRound';

const LEVEL_CARDS = SENTENCE_LEVELS.map((l) => ({ id: l.id, title: l.title, emoji: l.emoji, preview: l.sentences[0] }));

/** Routes: '' → home · 'play/<levelId>' → a Read 8 round. */
export default function SentencesApp({ segments, navigate }: AppProps) {
  const [view, levelId] = segments;
  const found = view === 'play' && levelId ? sentenceLevelById(levelId) : undefined;
  // Locked levels open from the level map only after the one before has a star.
  const level =
    found && isUnlocked(SENTENCE_LEVELS.map((l) => l.id), SENTENCE_LEVELS.indexOf(found), readingStore('sentences').get()) ? found : undefined;
  const unknown = view !== undefined && !level;
  useEffect(() => {
    if (unknown) navigate('/sentences', { replace: true });
  }, [unknown, navigate]);

  if (level) {
    return (
      <SentenceRound
        key={`${level.id}/${segments[2] ?? ''}`}
        level={level}
        onExit={() => back('/sentences')}
        onAgain={() => {
          // "Again" goes straight back into reading (no ready card).
          beginPlay({ app: 'sentences', label: level.title });
          navigate(`/sentences/play/${level.id}/${Date.now().toString(36)}`, { replace: true });
        }}
      />
    );
  }
  return (
    <ReadingHome
      app="sentences"
      title="Read Sentences"
      emoji="💬"
      color="--k-app-sentences"
      levels={LEVEL_CARDS}
      heroLabel="Read!"
      heroSub="8 sentences"
      onBack={() => back('/')}
      onPlay={(id) => navigate(`/sentences/play/${id}`)}
    />
  );
}
