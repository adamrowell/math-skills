/** Home screen shared by Read Words and Read Sentences on the universal AppHome (UX-V3 §2.2). */
import { useEffect } from 'react';
import { AppHome, appUiStore, getSettings, sfx } from '../../core';
import { preloadVoice, voiceImplemented } from '../../voice';
import { isUnlocked, readingStore, suggestedLevel } from './reading/progress';
import type { ReadingAppId } from './reading/progress';
import { LevelPath, Stars, UnlockAllLink } from './reading/ReadingUI';
import { ensureReadingFont } from './reading/font';
import type { LevelCardInfo } from './reading/ReadingUI';

export function ReadingHome({
  app,
  title,
  emoji,
  levels,
  heroSub,
  onBack,
  onPlay,
}: {
  app: ReadingAppId;
  title: string;
  emoji: string;
  color?: string;
  levels: LevelCardInfo[];
  heroLabel?: string;
  /** e.g. "15 words" */
  heroSub: string;
  onBack: () => void;
  onPlay: (levelId: string) => void;
}) {
  useEffect(() => ensureReadingFont(), []);
  // The hub usually started this already; make sure the listening model is on its way.
  useEffect(() => {
    if (voiceImplemented && getSettings().voice.enabled) void preloadVoice();
  }, []);
  const store = readingStore(app);
  const progress = store.useStore();
  const ui = appUiStore(app);
  const picked = ui.useStore((s) => s.setId);
  const ids = levels.map((l) => l.id);
  const pickedIdx = ids.indexOf(picked);
  const current = pickedIdx >= 0 && isUnlocked(ids, pickedIdx, progress) ? picked : suggestedLevel(ids, progress);
  const ci = Math.max(0, ids.indexOf(current));
  const cur = levels[ci];
  const totalStars = ids.reduce((a, id) => a + (progress.levels[id]?.stars ?? 0), 0);

  // Choosing a level never starts a round: it updates the level chip.
  const pick = (id: string) => {
    sfx.play('click');
    ui.update((s) => ({ ...s, setId: id }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AppHome
      appId={app}
      title={title}
      emoji={emoji}
      onBack={onBack}
      testId={`${app}-home`}
      className="rd-home"
      topRight={null}
      hero={{
        levelChip: (
          <>
            Level {ci + 1} · <span className="k-emoji">{cur.emoji}</span> {cur.title}{' '}
            <Stars n={Math.min(3, progress.levels[cur.id]?.stars ?? 0)} size="sm" />
          </>
        ),
        subtitle: `${heroSub}. Read them out loud!`,
        bestLine:
          totalStars > 0 ? (
            <span data-testid="total-stars">
              <span className="k-emoji">⭐</span> <span className="k-num">{totalStars}</span> / {ids.length * 3} stars
            </span>
          ) : undefined,
      }}
      playLabel={`Level ${ci + 1}`}
      playRoute={`/${app}/play/${cur.id}`}
      onPlay={() => {
        ui.update((s) => ({ ...s, setId: 'all' }));
        onPlay(cur.id);
      }}
      levelSection="levels"
      more={[
        {
          id: 'levels',
          title: 'Levels',
          node: (
            <>
              <LevelPath levels={levels} progress={progress} current={cur.id} onPick={pick} />
              <div className="rd-home__foot">
                <UnlockAllLink done={!!progress.unlockAll} onUnlock={() => store.update((p) => ({ ...p, unlockAll: true }))} />
              </div>
            </>
          ),
        },
      ]}
    />
  );
}
