import { useEffect } from 'react';
import { back, beginPlay } from '../../core';
import type { AppProps } from '../../core';
import { isUnlocked, readingStore } from './reading/progress';
import { WORD_LEVELS, wordLevelById } from '../../data/reading/words';
import { ReadingHome } from './ReadingHome';
import { WordRound } from './WordRound';

const LEVEL_CARDS = WORD_LEVELS.map((l) => ({
  id: l.id,
  title: l.title,
  emoji: l.emoji,
  preview: l.words
    .slice(0, 3)
    .map((w) => w[0])
    .join(' '),
}));

/** Routes: '' → home · 'play/<levelId>' → a Read 15 round. */
export default function WordsApp({ segments, navigate }: AppProps) {
  const [view, levelId] = segments;
  const found = view === 'play' && levelId ? wordLevelById(levelId) : undefined;
  // Locked levels open from the level map only after the one before has a star.
  const level =
    found && isUnlocked(WORD_LEVELS.map((l) => l.id), WORD_LEVELS.indexOf(found), readingStore('words').get()) ? found : undefined;
  const unknown = view !== undefined && !level;
  useEffect(() => {
    if (unknown) navigate('/words', { replace: true });
  }, [unknown, navigate]);

  if (level) {
    return (
      <WordRound
        // A new key per visit: "Again" replaces the route with a fresh nonce.
        key={`${level.id}/${segments[2] ?? ''}`}
        level={level}
        onExit={() => back('/words')}
        onAgain={() => {
          // "Again" goes straight back into reading (no ready card).
          beginPlay({ app: 'words', label: level.title });
          navigate(`/words/play/${level.id}/${Date.now().toString(36)}`, { replace: true });
        }}
      />
    );
  }
  return (
    <ReadingHome
      app="words"
      title="Read Words"
      emoji="📖"
      color="--k-app-words"
      levels={LEVEL_CARDS}
      heroLabel="Read!"
      heroSub="15 words"
      onBack={() => back('/')}
      onPlay={(id) => navigate(`/words/play/${id}`)}
    />
  );
}
