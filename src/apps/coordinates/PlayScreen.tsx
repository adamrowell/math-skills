import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  consumeAutostart,
  BigButton,
  PointsBurst,
  RoundSummary,
  TopBar,
  awardTrophy,
  celebrate,
  checkGoalAndAnnounce,
  checkLifetimeTrophies,
  rewards,
  sfx,
  useTodayPoints,
} from '../../core';
import type { PointsBurstHandle, RankInfo, RoundSummaryStat, TrophyId } from '../../core';
import { Board } from './Board';
import type { Mark } from './Board';
import { PictureArt } from './art';
import {
  CLEAN_DRAW_BONUS,
  CLEAN_DRAW_MAX_MISSES,
  COOLDOWN_MS,
  MAX_MISSES,
  RECORD_BONUS,
  TAP_DEBOUNCE_MS,
  comboMult,
  fmtNum,
  formatPoint,
  formatTime,
  judgeTap,
  missPenalty,
  pointsForHit,
  speedTier,
} from './game';
import type { Level } from './levels';
import { offsetFor, place } from './levels';
import type { P, Picture } from './pictures';
import { targetsOf } from './pictures';
import { recordDrawing } from './store';

const FIRST_ROUND_BONUS = 50;
const REVEAL_MS = 2600;

type Tone = 'info' | 'good' | 'bad';
interface Msg {
  id: number;
  text: string;
  tone: Tone;
}

interface GameState {
  placed: number;
  misses: number;
  totalMisses: number;
  firstTry: number;
  combo: number;
  bestCombo: number;
  fastCount: number;
  /** Net points of this picture (hits − penalties). */
  points: number;
  penalties: number;
  phase: 'play' | 'reveal' | 'summary';
}

interface Finish {
  elapsedMs: number;
  bonusLines: Array<{ label: string; points: number; emoji?: string }>;
  bonusTotal: number;
  best: { label: string; value: string; isNewBest: boolean; previous: string | null } | null;
  trophies: TrophyId[];
  rankUp: RankInfo | null;
  firstTime: boolean;
  /** Good enough to keep in the gallery (half the dots first try). */
  keeps: boolean;
}

const INITIAL: GameState = {
  placed: 0,
  misses: 0,
  totalMisses: 0,
  firstTry: 0,
  combo: 0,
  bestCombo: 0,
  fastCount: 0,
  points: 0,
  penalties: 0,
  phase: 'play',
};

interface Props {
  level: Level;
  pic: Picture;
  onExit: () => void;
  onAgain: () => void;
  onGallery: () => void;
}

export function PlayScreen({ level, pic, onExit, onAgain, onGallery }: Props) {
  const today = useTodayPoints();
  const off = offsetFor(level, pic);
  const targets = useMemo<P[]>(() => targetsOf(pic).map((p) => place(p, off)), [pic, off]);
  const total = targets.length;

  const [s, setS] = useState<GameState>(INITIAL);
  // No ready card here; consuming the PLAY mark records "Continue" (UX-V3 §2.3).
  useState(() => consumeAutostart());
  const sRef = useRef(s);
  const commit = useCallback((patch: Partial<GameState>) => {
    sRef.current = { ...sRef.current, ...patch };
    setS(sRef.current);
  }, []);

  const [marks, setMarks] = useState<Mark[]>([]);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [cooling, setCooling] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(null);

  const burstRef = useRef<PointsBurstHandle>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);
  const t = useRef({
    startAt: performance.now(),
    shownAt: performance.now(),
    lastTapAt: -Infinity,
    cooldownUntil: 0,
    lockedUntil: 0,
    lastMissKey: '',
    rankBefore: rewards.rank().index,
  });

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((id) => clearTimeout(id));
  }, []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const say = (text: string, tone: Tone) => setMsg({ id: ++seq.current, text, tone });

  const addMark = (kind: Mark['kind'], at: P, ttl: number) => {
    const id = ++seq.current;
    setMarks((m) => [...m.filter((x) => x.kind !== kind || kind === 'auto').slice(-4), { id, kind, at }]);
    later(() => setMarks((m) => m.filter((x) => x.id !== id)), ttl);
  };

  const burstAt = (amount: number, clientX: number, clientY: number) => {
    const a = anchorRef.current;
    if (!a) return;
    a.style.left = `${clientX}px`;
    a.style.top = `${clientY - 30}px`;
    burstRef.current?.burst(amount, a);
  };
  const shoutAt = (text: string, clientX: number, clientY: number) => {
    const a = anchorRef.current;
    if (!a) return;
    a.style.left = `${clientX}px`;
    a.style.top = `${Math.max(120, clientY - 90)}px`;
    burstRef.current?.shout(text, a);
  };

  const doFinish = (now: number) => {
    const st = sRef.current;
    const elapsedMs = Math.round(now - t.current.startAt);
    const bonusLines: Finish['bonusLines'] = [];
    const clean = st.totalMisses <= CLEAN_DRAW_MAX_MISSES;
    if (clean) bonusLines.push({ label: 'Clean Draw', points: CLEAN_DRAW_BONUS, emoji: '✨' });

    let best: Finish['best'] = null;
    const key = `coordinates:${level.id}:${pic.id}`;
    if (clean) {
      const b = rewards.recordBest(key, elapsedMs, false);
      best = {
        label: 'Best time',
        value: formatTime(elapsedMs),
        isNewBest: b.isNewBest,
        previous: b.previous !== null ? formatTime(b.previous) : null,
      };
      if (b.isNewBest && b.previous !== null) bonusLines.push({ label: 'Faster!', points: RECORD_BONUS, emoji: '⏱️' });
    } else {
      const prev = rewards.getBest(key);
      if (prev !== null) best = { label: 'Best time', value: formatTime(prev), isNewBest: false, previous: null };
    }
    if (st.firstTry / total >= 0.7 && rewards.claimFirstRound('coordinates'))
      bonusLines.push({ label: 'First round today', points: FIRST_ROUND_BONUS, emoji: '🌅' });
    const bonusTotal = bonusLines.reduce((n, b) => n + b.points, 0);
    if (bonusTotal > 0) rewards.addPoints('coordinates', bonusTotal, 'bonus', `Drew ${pic.name}`);

    // Only a picture he really drew (half the dots or more first try) goes in the gallery
    // and counts toward unlocking levels; a mashed one just ends.
    const keeps = st.firstTry >= Math.ceil(total / 2);
    const { firstTime } = keeps ? recordDrawing(pic.id, level.id, st.totalMisses, elapsedMs) : { firstTime: false };

    const got: TrophyId[] = [];
    const tryT = (id: TrophyId, cond: boolean) => {
      if (cond && awardTrophy(id, { quiet: true })) got.push(id);
    };
    tryT('first-round', keeps);
    tryT('combo-10', st.bestCombo >= 10);
    tryT('combo-25', st.bestCombo >= 25);
    tryT('combo-50', st.bestCombo >= 50);
    tryT('speed-demon', st.fastCount >= 10);
    tryT('sharp-shooter', total >= 20 && st.firstTry / total >= 0.95);
    tryT('perfect-20', total >= 20 && st.totalMisses === 0);
    got.push(...checkLifetimeTrophies(true));
    got.push(...checkGoalAndAnnounce());
    const rankNow = rewards.rank();
    const rankUp = rankNow.index > t.current.rankBefore ? rankNow : null;

    setFinish({ elapsedMs, bonusLines, bonusTotal, best, trophies: got, rankUp, firstTime, keeps });
    commit({ phase: 'reveal' });
    setMsg({ id: ++seq.current, text: keeps ? `It's a ${pic.name}!` : `Almost! It's a ${pic.name}.`, tone: keeps ? 'good' : 'info' });
    sfx.play(best?.isNewBest || rankUp ? 'pb' : 'roundEnd');
    if (keeps) celebrate('big');
    if (got.length) later(() => sfx.play('trophy'), 900);
    later(() => commit({ phase: 'summary' }), REVEAL_MS);
  };

  const advance = (now: number) => {
    const placed = sRef.current.placed + 1;
    commit({ placed, misses: 0 });
    setMarks((m) => m.filter((x) => x.kind !== 'auto'));
    t.current.shownAt = now;
    t.current.lastMissKey = '';
    t.current.cooldownUntil = 0;
    setCooling(false);
    if (placed >= total) doFinish(now);
  };

  const onTap = (gx: number, gy: number, at: { clientX: number; clientY: number }) => {
    const st = sRef.current;
    if (st.phase !== 'play' || confirmExit) return;
    const now = performance.now();
    const T = t.current;
    if (now < T.lockedUntil) return;
    if (now < T.cooldownUntil) {
      say('Look at the lit lines…', 'info');
      return;
    }
    if (now - T.lastTapAt < TAP_DEBOUNCE_MS) return;
    const target = targets[st.placed];
    const v = judgeTap(gx, gy, target, level);
    if (v.kind === 'between') {
      addMark('between', [gx, gy], 700);
      say('Tap right where two lines cross ✚', 'info');
      return;
    }
    T.lastTapAt = now;

    if (v.kind === 'hit') {
      const firstTry = st.misses === 0;
      const ms = now - T.shownAt;
      const combo = firstTry ? st.combo + 1 : 0;
      const pts = pointsForHit(st.misses, ms, combo, level);
      const fast = firstTry && speedTier(ms, level) === 'fast';
      commit({
        combo,
        bestCombo: Math.max(st.bestCombo, combo),
        firstTry: st.firstTry + (firstTry ? 1 : 0),
        fastCount: st.fastCount + (fast ? 1 : 0),
        points: st.points + pts,
      });
      if (pts > 0) {
        rewards.addPoints('coordinates', pts, 'answer', formatPoint(target));
        burstAt(pts, at.clientX, at.clientY);
      }
      sfx.play('correct');
      if (firstTry && (combo === 5 || combo === 10 || combo === 20 || (combo > 20 && combo % 10 === 0))) {
        sfx.play('combo');
        shoutAt(`${combo} in a row!`, at.clientX, at.clientY);
      }
      say(firstTry ? (fast ? 'Super fast!' : 'Yes!') : 'Got it!', 'good');
      checkGoalAndAnnounce();
      advance(now);
      return;
    }

    // The dot is already shown (3 misses): he has to tap it himself; no more penalties.
    if (st.misses >= MAX_MISSES) {
      say(`Tap the glowing dot at ${formatPoint(target)}!`, 'info');
      return;
    }
    // Miss. Tapping the same wrong dot again is the same miss.
    const mk = `${v.at[0]},${v.at[1]}`;
    if (mk === T.lastMissKey) {
      addMark('miss', v.at, 1800);
      return;
    }
    T.lastMissKey = mk;
    const misses = st.misses + 1;
    const pen = missPenalty(st.penalties);
    commit({
      misses,
      totalMisses: st.totalMisses + 1,
      combo: 0,
      points: st.points - pen,
      penalties: st.penalties + pen,
    });
    if (pen > 0) {
      rewards.addPoints('coordinates', -pen, 'answer', `Missed ${formatPoint(target)}`);
      burstAt(-pen, at.clientX, at.clientY);
    }
    sfx.play('wrong');
    addMark('miss', v.at, 1800);

    if (misses >= MAX_MISSES) {
      // Third miss: show him where it is (no points); he taps it to move on.
      say(`Here it is: ${formatPoint(target)}. Tap it!`, 'info');
      addMark('auto', target, 10 * 60_000);
      T.lockedUntil = now + 600;
      return;
    }
    const there = `That's ${formatPoint(v.at)}.`;
    if (v.swapped) say(`${there} Go across first, then up!`, 'bad');
    else if (misses === 1) say(`${there} Find x\u00a0=\u00a0${fmtNum(target[0])} first.`, 'bad');
    else say(`${there} Now go up to y\u00a0=\u00a0${fmtNum(target[1])}.`, 'bad');
    const cd = COOLDOWN_MS[misses] ?? 0;
    if (cd > 0) {
      T.cooldownUntil = now + cd;
      if (cd >= 1000) {
        setCooling(true);
        later(() => setCooling(false), cd);
      }
    }
  };

  const requestExit = () => {
    if (s.phase === 'play' && s.placed > 0) setConfirmExit(true);
    else onExit();
  };

  const target = s.phase === 'play' ? targets[s.placed] : null;
  const done = s.phase !== 'play';
  const mult = comboMult(s.combo);

  if (s.phase === 'summary' && finish) {
    const st = s;
    const stats: RoundSummaryStat[] = [
      { label: 'First try', value: `${st.firstTry}/${total}`, emoji: '🎯', highlight: st.firstTry === total },
      { label: 'Misses', value: st.totalMisses, emoji: st.totalMisses === 0 ? '💯' : '❌' },
      { label: 'Time', value: formatTime(finish.elapsedMs), emoji: '⏱️' },
      { label: 'Best combo', value: st.bestCombo, emoji: '🔥' },
    ];
    const earned = Math.max(0, st.points + finish.bonusTotal);
    return (
      <div className="k-screen co-play co-play--summary" style={{ ['--k-app' as string]: 'var(--k-app-coordinates)' }}>
        <RoundSummary
          title={finish.keeps ? `You drew a ${pic.name}!` : `Almost! A ${pic.name}`}
          emoji={finish.keeps ? pic.emoji : '✏️'}
          stats={stats}
          pointsEarned={earned}
          bonusLines={finish.bonusLines}
          best={finish.best ?? undefined}
          bestNote={
            !finish.keeps
              ? 'Draw it with fewer misses to keep it in your gallery.'
              : st.totalMisses > CLEAN_DRAW_MAX_MISSES
                ? 'Only 2 misses or fewer = Clean Draw +50!'
                : undefined
          }
          trophies={finish.trophies}
          rankUp={finish.rankUp}
          onAgain={onAgain}
          onHome={onExit}
        >
          <div className="co-sum-art" data-testid="summary-art">
            <PictureArt pic={pic} className="co-sum-art__svg" />
            {finish.firstTime && <div className="co-sum-new">New in your gallery!</div>}
            <button type="button" className="co-sum-gallery" onClick={onGallery} data-testid="summary-gallery">
              <span className="k-emoji">🖼️</span> My gallery
            </button>
          </div>
        </RoundSummary>
      </div>
    );
  }

  return (
    <div className="k-screen co-play k-noselect" style={{ ['--k-app' as string]: 'var(--k-app-coordinates)' }} data-testid="co-play" data-level={level.id} data-pic={pic.id}>
      <TopBar
        onBack={requestExit}
        center={
          <div className="co-progress" data-testid="progress" aria-label={`${s.placed} of ${total} dots`}>
            <div className="co-progress__bar">
              <div className="co-progress__fill" style={{ width: `${(s.placed / total) * 100}%` }} />
            </div>
            <span className="k-num">
              {s.placed}/{total}
            </span>
          </div>
        }
        combo={s.combo}
        comboMultiplier={mult}
        points={today}
      />
      <main className="co-play__main">
        <aside className="co-side">
          <div
            className={`co-target${done ? ' is-done' : ''}`}
            data-testid="target"
            data-x={target?.[0]}
            data-y={target?.[1]}
            data-misses={s.misses}
            data-placed={s.placed}
            data-phase={s.phase}
          >
            {target ? (
              <>
                <div className="co-target__label">Find the dot</div>
                <div className="co-target__pt k-num" key={s.placed}>
                  (<span className="co-x">{fmtNum(target[0])}</span>, <span className="co-y">{fmtNum(target[1])}</span>)
                </div>
                <div className="co-target__how">
                  <span className="co-x">x</span> across → <span className="co-y">y</span> up ↑
                </div>
              </>
            ) : (
              <div className="co-target__done">
                <span className="k-emoji">{pic.emoji}</span> {pic.name}!
              </div>
            )}
          </div>
          <div className="co-msg-wrap">
            {msg && (
              <div key={msg.id} className={`co-msg is-${msg.tone}`} data-testid="msg">
                {msg.text}
              </div>
            )}
          </div>
          <div className="co-chips">
            <div className="co-chip" data-testid="pic-points">
              <span className="k-emoji">⭐</span> <b className="k-num">{s.points}</b>
            </div>
            <div className="co-chip" data-testid="misses">
              <span className="k-emoji">❌</span> <b className="k-num">{s.totalMisses}</b>
            </div>
            <div className="co-chip co-chip--level">
              <span className="k-emoji">{level.emoji}</span> {level.name}
            </div>
          </div>
        </aside>
        <div className="co-board-wrap">
          <Board
            level={level}
            pic={pic}
            off={off}
            placed={done ? Infinity : s.placed}
            target={target}
            hint={s.misses}
            marks={marks}
            cooling={cooling}
            done={done}
            onTap={onTap}
          />
        </div>
      </main>
      <div ref={anchorRef} className="co-anchor" aria-hidden="true" />
      <PointsBurst ref={burstRef} />

      {confirmExit && (
        <div className="co-sheet" data-testid="confirm-exit">
          <div className="co-sheet__card">
            <div className="co-sheet__title">Stop drawing?</div>
            <div className="co-sheet__sub">Your points so far are saved.</div>
            <BigButton size="xl" onClick={() => setConfirmExit(false)} data-testid="keep-drawing">
              Keep drawing <span className="k-emoji">✏️</span>
            </BigButton>
            <BigButton size="lg" variant="ghost" onClick={onExit} data-testid="stop">
              Stop
            </BigButton>
          </div>
        </div>
      )}
    </div>
  );
}
