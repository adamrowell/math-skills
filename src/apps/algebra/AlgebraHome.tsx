import { AppHome, rewardsStore, sfx, toast } from '../../core';
import type { RewardsState } from '../../core';
import { formatSeconds, masteryScore, masteryStore } from '../../drill';
import type { MasteryState } from '../../drill';
import { Equation } from './Equation';
import { LEVELS, levelDef } from './problems';
import type { LevelDef, LevelId } from './problems';
import { UNLOCK_NOW, progressStore, selectLevel } from './progress';
import { bestKeyFor } from './useAlgebraRound';
import './algebra.css';

interface Props {
  onBack: () => void;
  onPlay: (level: LevelId) => void;
}

const selectBests = (s: RewardsState) => s.bests;

/** 0..1 mastery of a level: mean template mastery. */
function levelMastery(l: LevelDef, m: MasteryState): number {
  const v = l.templates.map((t) => masteryScore(m.facts[t.id], l.speed));
  return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
}

function bestLabel(l: LevelDef, v: number | undefined): string | null {
  if (v === undefined) return null;
  return l.paper ? `🔥 ${v} in a row` : `⏱ ${formatSeconds(v)}`;
}

export function AlgebraHome({ onBack, onPlay }: Props) {
  const progress = progressStore.useStore();
  const bests = rewardsStore.useStore(selectBests);
  const mastery = masteryStore('algebra').useStore();
  const cur = levelDef(progress.level);
  const curBest = bestLabel(cur, bests[bestKeyFor(cur.id)]);

  // Choosing a level never starts a round: it updates the level chip (UX-V3 §2.2).
  const tapLevel = (l: LevelDef) => {
    sfx.unlock();
    if (l.id > progress.unlocked) {
      sfx.play('wrong', 0.4);
      toast.show(`Get ${UNLOCK_NOW} right first try on Level ${progress.unlocked} to unlock!`, { emoji: '🔒', durationMs: 2400 });
      return;
    }
    sfx.play('click');
    selectLevel(l.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const levels = (
    <section className="al-levels" aria-label="Levels">
      {LEVELS.map((l) => {
        const locked = l.id > progress.unlocked;
        const pct = Math.round(levelMastery(l, mastery) * 100);
        const best = bestLabel(l, bests[bestKeyFor(l.id)]);
        const isCur = l.id === progress.level;
        return (
          <button
            key={l.id}
            type="button"
            className={`al-level${locked ? ' is-locked' : ''}${isCur ? ' is-current' : ''}`}
            onClick={() => tapLevel(l)}
            data-testid={`level-${l.id}`}
            aria-pressed={isCur}
            aria-label={`Level ${l.id}: ${l.title}${locked ? ' (locked)' : ''}`}
          >
            <span className="al-level__num k-num">{locked ? <span className="k-emoji">🔒</span> : l.id}</span>
            <span className="al-level__body">
              <span className="al-level__title">
                {l.title}
                {l.paper && <span className="al-level__tag">✏️ paper</span>}
              </span>
              <span className="al-level__eq">
                <Equation lines={[l.example]} size="small" />
              </span>
              <span className="al-level__bar" aria-label={`${pct}% mastered`}>
                <span style={{ transform: `scaleX(${pct / 100})` }} />
              </span>
            </span>
            <span className="al-level__side">
              <span className="al-level__pts">⭐ {l.base}+</span>
              {best && <span className="al-level__best k-num">{best}</span>}
            </span>
          </button>
        );
      })}
    </section>
  );

  return (
    <AppHome
      appId="algebra"
      title="Quick Algebra"
      emoji="🔍"
      onBack={onBack}
      className="al-home"
      hero={{
        above: (
          <div className="al-hero__eq">
            <Equation lines={[cur.example]} size="big" />
          </div>
        ),
        levelChip: (
          <>
            <span className="k-emoji">{cur.emoji}</span> Level {cur.id} · {cur.title}
          </>
        ),
        subtitle: cur.paper ? 'Take your time. Use paper!' : '10 questions. Be quick for more ⭐',
        bestLine: curBest ? <>🏅 Best {curBest}</> : undefined,
      }}
      playLabel={`Level ${cur.id}`}
      playRoute={`/algebra/play/${cur.id}`}
      onPlay={() => onPlay(cur.id)}
      more={[{ id: 'levels', title: 'Levels', node: levels }]}
      levelSection="levels"
    />
  );
}
