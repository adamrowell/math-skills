/**
 * Home screen shared by the fast-facts apps (Times Tables, Division, Big Adding, Mixed) on the
 * universal AppHome pattern (UX-V3 §2.2): Sprint is PLAY; other formats, set chips and progress
 * live in "More ways to play".
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { AppHome, appUiStore, playStarter, rewardsStore, sfx } from '../../core';
import type { AppHomeMore, RewardsState } from '../../core';
import { FORMATS, FormatCards, SPRINT_60, SetChips, bestKey } from '../../drill';
import type { FactGenerator, RoundFormat } from '../../drill';
import './facts-home.css';

const selectBests = (s: RewardsState) => s.bests;

/** Per-app chip defaults (UX-V3 §2.2) so app routers don't have to know about them. */
const PRIMARY: Partial<Record<string, string[]>> = {
  multiplication: ['all', 'easy', 'hard', 'weak'],
  division: ['all', 'easy', 'hard', 'weak'],
  addition: ['all', 'warmup', 'carry', 'big'],
};
const MORE_LABEL: Partial<Record<string, [string, string]>> = { addition: ['More', '➕'] };
/** Mixed is one big mix: no chips, the mix panel instead. */
const NO_SETS = new Set(['mixed']);

interface Props {
  generator: FactGenerator;
  title: string;
  emoji: string;
  /** Short set label, e.g. "All" / "6–9". */
  chip: (setId: string) => string;
  onBack: () => void;
  onPlay: (format: RoundFormat, setId: string) => void;
  /** Progress strip (grid / skills) shown inside "More ways to play". */
  progressTile?: ReactNode;
  /** Formats offered inside More (Sprint is PLAY). Default: all but Sprint. */
  formats?: RoundFormat[];
  /** Hide the set chips (single-set apps). */
  hideSets?: boolean;
  /** Chips shown (≤ 4); the rest sit behind one "more" chip. */
  primarySets?: string[];
  moreSetsLabel?: string;
  moreSetsEmoji?: string;
  /** Plain sentence under PLAY. */
  subtitle?: string;
  /** Extra progress content (skills ladder, mix panel) inside More. */
  children?: ReactNode;
}

export function FactsHome({
  generator,
  title,
  emoji,
  onBack,
  onPlay,
  progressTile,
  formats,
  hideSets,
  primarySets,
  moreSetsLabel,
  moreSetsEmoji,
  subtitle = '60 seconds, as many as you can!',
  children,
}: Props) {
  const appId = generator.appId;
  const hide = hideSets ?? NO_SETS.has(appId);
  const primary = primarySets ?? PRIMARY[appId];
  const [moreLabelDefault, moreEmojiDefault] = MORE_LABEL[appId] ?? [undefined, undefined];
  const store = appUiStore(appId);
  const savedSet = store.useStore((s) => s.setId);
  const sets = generator.sets();
  const setId = !hide && sets.some((s) => s.id === savedSet) ? savedSet : 'all';
  const set = sets.find((s) => s.id === setId);
  const bestsAll = rewardsStore.useStore(selectBests);

  const bests = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const f of FORMATS) for (const s of sets) out[`${f.id}:${s.id}`] = bestsAll[bestKey(appId, f.id, s.id)] ?? null;
    return out;
  }, [bestsAll, sets, appId]);

  const pickSet = (id: string) => {
    sfx.play('click');
    store.update((s) => ({ ...s, setId: id }));
  };

  const setName = set ? set.title : 'Everything';
  const sprintBest = bests[`sprint60:${setId}`];
  const shown = formats ?? FORMATS.filter((f) => f.id !== SPRINT_60.id);
  const route = (f: RoundFormat) => `/${appId}/play/${f.id}/${setId}`;

  const more: AppHomeMore[] = [];
  if (shown.length)
    more.push({
      id: 'formats',
      title: 'Other games',
      node: (
        <FormatCards
          formats={shown}
          setId={setId}
          bests={bests}
          onStart={(f, s) => playStarter(appId, `${f.title} · ${setName}`, () => onPlay(f, s), route(f))()}
        />
      ),
    });
  if (!hide && sets.length > 1)
    more.push({
      id: 'sets',
      title: 'Which facts',
      node: (
        <SetChips
          sets={sets}
          selectedSetId={setId}
          onSelectSet={pickSet}
          primary={primary}
          moreLabel={moreSetsLabel ?? moreLabelDefault}
          moreEmoji={moreSetsEmoji ?? moreEmojiDefault}
        />
      ),
    });
  if (progressTile || children)
    more.push({
      id: 'progress',
      title: 'My progress',
      node: (
        <div className="ff-progress">
          {progressTile}
          {children}
        </div>
      ),
    });

  return (
    <AppHome
      appId={appId}
      title={title}
      emoji={emoji}
      onBack={onBack}
      levelSection={hide ? undefined : 'sets'}
      hero={{
        levelChip: (
          <>
            <span className="k-emoji">{SPRINT_60.emoji}</span> {SPRINT_60.title} · {set?.emoji && <span className="k-emoji">{set.emoji}</span>}{' '}
            {setName}
          </>
        ),
        subtitle,
        bestLine:
          sprintBest !== null && sprintBest !== undefined ? (
            <>
              <span className="k-emoji">🏅</span> Best <span className="k-num" data-testid="best-sprint">{sprintBest}</span>
            </>
          ) : undefined,
      }}
      playLabel={`Sprint · ${setName}`}
      playRoute={route(SPRINT_60)}
      onPlay={() => onPlay(SPRINT_60, setId)}
      more={more}
    />
  );
}

/** Single-row progress strip used inside More (grid / skills). */
export function ProgressStrip({ emoji, text, onOpen, testId }: { emoji: string; text: ReactNode; onOpen: () => void; testId?: string }) {
  return (
    <button type="button" className="k-strip" onClick={onOpen} data-testid={testId}>
      <span className="k-emoji">{emoji}</span>
      <span className="k-strip__main">{text}</span>
      <span className="k-strip__go" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
