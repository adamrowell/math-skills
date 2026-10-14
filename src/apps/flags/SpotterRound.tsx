/**
 * Flag Spotter (docs/GEO-LOGIC.md §C.3): 45 seconds, six flags, "Tap Japan!". +6 (+2 fast), a wrong
 * tap −5 and the round goes on. The grid reshuffles every question, the target never stays in the
 * same cell, and one of the six is always a look-alike when there is one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  consumeAutostart,
  PointsBurst,
  RoundSummary,
  TopBar,
  awardTrophy,
  celebrate,
  checkGoalAndAnnounce,
  checkLifetimeTrophies,
  getSettings,
  rewards,
  sfx,
  useTodayPoints,
} from '../../core';
import type { PointsBurstHandle, RankInfo, TrophyId } from '../../core';
import { RotateHint } from '../../platform';
import { comboMultiplier, missPenalty } from '../maps/logic';
import { speak, stopSpeaking } from '../maps/speech';
import { FLAG_BY_CC } from './data/flags';
import { Flag } from './Flag';
import { LEVELS, SPOTTER_SECONDS, pickSpotterTarget, spotterGrid, spotterPoints } from './logic';
import { isLevelUnlocked, progressStore } from './progress';

interface Props {
  onExit: () => void;
  onAgain: () => void;
}

interface Turn {
  n: number;
  cc: string;
  flags: string[];
  cell: number;
  wrong: string[];
}

interface Finished {
  best: { label: string; value: number; isNewBest: boolean; previous: number | null };
  trophies: TrophyId[];
  rankUp: RankInfo | null;
}

const soundOn = () => getSettings().soundOn;

export function SpotterRound({ onExit, onAgain }: Props) {
  const today = useTodayPoints();
  const burstRef = useRef<PointsBurstHandle>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  // Every flag of every open level.
  const pool = useMemo(() => {
    const p = progressStore.get();
    const ccs = new Set(LEVELS.filter((l) => isLevelUnlocked(p, l)).flatMap((l) => l.flags));
    return [...ccs].map((cc) => FLAG_BY_CC.get(cc)!).filter(Boolean);
  }, []);

  const [turn, setTurn] = useState<Turn | null>(null);
  const [left, setLeft] = useState(SPOTTER_SECONDS);
  const [score, setScore] = useState({ points: 0, correct: 0, wrong: 0, combo: 0, bestCombo: 0 });
  const [finished, setFinished] = useState<Finished | null>(null);
  const R = useRef({ recent: [] as string[], shownAt: 0, lastTapAt: 0, endsAt: 0, over: false, rankBefore: rewards.rank().index, score, turn: null as Turn | null });
  R.current.score = score;
  R.current.turn = turn;

  const next = useCallback(
    (n: number, prevCell: number) => {
      const target = pickSpotterTarget(pool, R.current.recent, Math.random);
      R.current.recent.push(target.cc);
      const g = spotterGrid(target, pool, Math.random, prevCell);
      setTurn({ n, cc: target.cc, flags: g.flags, cell: g.cell, wrong: [] });
      R.current.shownAt = performance.now();
      if (soundOn()) speak(target.name);
    },
    [pool],
  );

  const finish = useCallback(() => {
    const cur = R.current;
    if (cur.over) return;
    cur.over = true;
    stopSpeaking();
    const s = cur.score;
    const b = rewards.recordBest('flags:spotter', s.correct, true);
    const got: TrophyId[] = [];
    if (s.correct > 0 && awardTrophy('first-round', { quiet: true })) got.push('first-round');
    if (s.bestCombo >= 10 && awardTrophy('combo-10', { quiet: true })) got.push('combo-10');
    got.push(...checkLifetimeTrophies(true));
    got.push(...checkGoalAndAnnounce());
    const rankNow = rewards.rank();
    progressStore.update((p) => ({ ...p, plays: { ...p.plays, spotter: (p.plays.spotter ?? 0) + 1 } }));
    if (b.isNewBest && b.previous !== null) {
      sfx.play('pb');
      celebrate('pb');
    } else sfx.play('roundEnd');
    setFinished({
      best: { label: 'Best spotted', value: s.correct, isNewBest: b.isNewBest, previous: b.previous },
      trophies: got,
      rankUp: rankNow.index > cur.rankBefore ? rankNow : null,
    });
  }, []);

  useState(() => consumeAutostart());
  useEffect(() => {
    R.current.endsAt = performance.now() + SPOTTER_SECONDS * 1000;
    R.current.rankBefore = rewards.rank().index;
    next(0, -1);
    const t = window.setInterval(() => {
      const ms = R.current.endsAt - performance.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) {
        window.clearInterval(t);
        finish();
      }
    }, 200);
    return () => {
      window.clearInterval(t);
      stopSpeaking();
    };
  }, [next, finish]);

  const onTap = (cc: string, el: HTMLElement) => {
    const cur = R.current;
    const t = cur.turn;
    if (!t || cur.over) return;
    const now = performance.now();
    if (now - cur.lastTapAt < 250 || t.wrong.includes(cc)) return;
    cur.lastTapAt = now;
    sfx.unlock();
    const s = cur.score;
    if (cc === t.cc) {
      const combo = s.combo + 1;
      const pts = Math.round(spotterPoints(now - cur.shownAt) * comboMultiplier(combo));
      rewards.addPoints('flags', pts, 'answer', `Spotter: ${FLAG_BY_CC.get(cc)?.name}`);
      burstRef.current?.burst(pts, el);
      sfx.play('correct');
      setScore({ ...s, points: s.points + pts, correct: s.correct + 1, combo, bestCombo: Math.max(s.bestCombo, combo) });
      next(t.n + 1, t.cell);
    } else {
      const pen = missPenalty(s.points);
      if (pen > 0) {
        rewards.addPoints('flags', -pen, 'answer', 'Spotter miss');
        burstRef.current?.burst(-pen, el);
      }
      sfx.play('wrong');
      setScore({ ...s, points: s.points - pen, wrong: s.wrong + 1, combo: 0 });
      setTurn({ ...t, wrong: [...t.wrong, cc] });
    }
  };

  const title = (
    <>
      <span className="k-emoji">⚡</span> Flag Spotter
    </>
  );

  if (finished) {
    return (
      <div className="k-screen fl-screen" style={{ ['--k-app' as string]: 'var(--k-app-flags)' }}>
        <TopBar onBack={onExit} title={title} points={today} />
        <RoundSummary
          title={finished.best.isNewBest && finished.best.previous !== null ? 'New record!' : score.correct >= 15 ? 'Super spotter!' : 'Nice spotting!'}
          emoji="⚡"
          pointsEarned={Math.max(0, score.points)}
          best={finished.best}
          trophies={finished.trophies}
          rankUp={finished.rankUp}
          stats={[
            { label: 'Spotted', value: score.correct, emoji: '🎯' },
            { label: 'Oops', value: score.wrong, emoji: '❌' },
            { label: 'Best streak', value: score.bestCombo, emoji: '🔥' },
          ]}
          onAgain={onAgain}
          onHome={onExit}
        />
      </div>
    );
  }

  const target = turn ? FLAG_BY_CC.get(turn.cc) : undefined;
  return (
    <div className="k-screen fl-screen fl-spotter" style={{ ['--k-app' as string]: 'var(--k-app-flags)' }} data-testid="spotter-round">
      <RotateHint />
      <TopBar
        onBack={onExit}
        title={title}
        center={
          <div className={`fl-timer${left <= 10 ? ' is-low' : ''}`} data-testid="timer">
            <span className="k-emoji">⏱️</span> <span className="k-num">{left}</span>
          </div>
        }
        points={today}
        combo={score.combo}
        comboMultiplier={comboMultiplier(score.combo)}
      />
      <div className="mp-prompt fl-prompt" ref={promptRef} data-testid="prompt" data-target={turn?.cc ?? ''} data-n={turn?.n ?? -1} data-cell={turn?.cell ?? -1}>
        <div className="mp-prompt__text">
          <span className="mp-prompt__verb">Tap</span>
          <span className="mp-prompt__name" key={turn?.n} data-testid="target-name">
            {target?.name}
          </span>
        </div>
        {target && (
          <button type="button" className="mp-say" aria-label="Say it again" onClick={() => speak(target.name)}>
            <span className="k-emoji">🔊</span>
          </button>
        )}
        <div className="mp-round-pts k-num" data-testid="round-points">
          <span className="k-emoji">🎯</span> {score.correct}
        </div>
      </div>
      <main className="fl-spot-grid" data-testid="spotter-grid">
        {turn?.flags.map((cc, i) => {
          const wrong = turn.wrong.includes(cc);
          return (
            <button
              type="button"
              key={`${turn.n}-${cc}`}
              className={`fl-choice fl-spot${wrong ? ' is-wrong' : ''}`}
              data-choice={cc}
              data-cell={i}
              aria-label={`Flag ${i + 1}`}
              disabled={wrong}
              onClick={(e) => onTap(cc, e.currentTarget)}
            >
              <Flag cc={cc} alt="" />
              {wrong && <span className="fl-choice__name">{FLAG_BY_CC.get(cc)?.name}</span>}
            </button>
          );
        })}
      </main>
      <PointsBurst ref={burstRef} />
    </div>
  );
}
