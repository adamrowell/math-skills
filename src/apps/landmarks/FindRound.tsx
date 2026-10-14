/**
 * "Find it" round (docs/GEO-LOGIC.md §D.4): see the photo + name, tap the country (or the state on
 * the USA level). Right → the pin drops on the exact spot and a fact card shows. Same miss economy as
 * Maps: miss 1 −5 + hint circle + "Look in Europe!", miss 2 −5 + reveal (0 points), off-level
 * countries are just named.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  PointsBurst,
  RoundSummary,
  TopBar,
  awardTrophy,
  celebrate,
  checkGoalAndAnnounce,
  checkLifetimeTrophies,
  consumeAutostart,
  getSettings,
  rewards,
  sfx,
  useTodayPoints,
} from '../../core';
import type { PointsBurstHandle, RankInfo, TrophyId } from '../../core';
import { applyMastery, masteryStore, roundBonuses, speedTier } from '../../drill';
import type { RoundBonuses } from '../../drill';
import { RotateHint } from '../../platform';
import { MapView } from '../maps/MapView';
import type { MapLabel, RegionMark } from '../maps/MapView';
import { useMap } from '../maps/mapLoader';
import { comboMultiplier, missPenalty, pickTarget, scheduleComeback, starsFor } from '../maps/logic';
import { speak, stopSpeaking } from '../maps/speech';
import type { LoadedMap, Region } from '../maps/types';
import { ISO } from './data/iso';
import { LANDMARK_BY_ID, spokenName } from './data/landmarks';
import type { LandmarkDef } from './data/landmarks';
import { LANDMARK_PX } from './data/landmarks.gen';
import { Photo } from './Photo';
import {
  LM_SPEED,
  MIN_TAP_PX,
  ROUND_LENGTH,
  TIER_PRIOR,
  activeRegions,
  answersFor,
  baseCamera,
  landmarkPoints,
  landmarksOf,
  regionViewFor,
  screenSize,
} from './levels';
import type { Camera, LevelDef } from './levels';
import { isUnlocked, progressStore, recordRound, stamp } from './progress';

interface Props {
  level: LevelDef;
  onExit: () => void;
  onAgain: () => void;
  onPlayLevel: (id: string) => void;
  onPassport: () => void;
}

type Phase = 'ask' | 'hint' | 'reveal' | 'done';

interface QState {
  index: number;
  target: string;
  phase: Phase;
  misses: number;
  /** Set when the answer is shown: the stamp/country news for the fact card. */
  news?: { stamp: boolean; country: string | null; points: number; firstTry: boolean };
}

interface RoundStats {
  points: number;
  combo: number;
  bestCombo: number;
  firstTry: number;
  missesTotal: number;
  answered: number;
  missedIds: string[];
  stamps: number;
}

interface Finished {
  stars: number;
  bonuses: RoundBonuses;
  best: { label: string; value: number; isNewBest: boolean; previous: number | null } | null;
  trophies: TrophyId[];
  rankUp: RankInfo | null;
  unlocked: LevelDef | null;
}

const EMPTY: RoundStats = { points: 0, combo: 0, bestCombo: 0, firstTry: 0, missesTotal: 0, answered: 0, missedIds: [], stamps: 0 };
const PX = new Map(LANDMARK_PX.map((p) => [p.id, p]));
/** How long the fact card stays before the next photo (a tap on Next skips it). */
const FACT_MS = 3600;
const soundOn = () => getSettings().soundOn;
const countryName = (cc: string, map: LoadedMap | null) => map?.byId.get(ISO[cc]?.n ?? '')?.label ?? ISO[cc]?.name ?? cc;

function useBoxSize<T extends Element>(): [React.RefObject<T>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/** The pin (drawn in an overlay with the same camera as the map, so it lands on the exact spot). */
function Pins({ cam, points, k }: { cam: Camera; points: Array<{ x: number; y: number }>; k: number }) {
  const all: Array<{ x: number; y: number; s: number; key: string }> = [];
  points.forEach((p, i) => {
    all.push({ x: p.x, y: p.y, s: k, key: `m${i}` });
    const ins = cam.inset;
    if (ins && p.x >= ins.src[0] && p.x <= ins.src[0] + ins.src[2] && p.y >= ins.src[1] && p.y <= ins.src[1] + ins.src[3]) {
      const sc = ins.dst[2] / ins.src[2];
      all.push({ x: ins.dst[0] + (p.x - ins.src[0]) * sc, y: ins.dst[1] + (p.y - ins.src[1]) * sc, s: k, key: `i${i}` });
    }
  });
  return (
    <svg className="lm-pins" viewBox={cam.view.join(' ')} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {all.map((p) => (
        <g key={p.key} transform={`translate(${p.x} ${p.y}) scale(${p.s})`} className="lm-pin" data-testid="pin">
          <ellipse cx={0} cy={0} rx={7} ry={2.6} className="lm-pin__shadow" />
          <g className="lm-pin__drop">
            <path d="M0 0 C -4 -9 -12 -14 -12 -24 A 12 12 0 1 1 12 -24 C 12 -14 4 -9 0 0 Z" className="lm-pin__body" />
            <circle cx={0} cy={-24} r={5} className="lm-pin__dot" />
          </g>
        </g>
      ))}
    </svg>
  );
}

export function FindRound({ level, onExit, onAgain, onPlayLevel, onPassport }: Props) {
  const { map, error, retry } = useMap(level.map);
  const today = useTodayPoints();
  const burstRef = useRef<PointsBurstHandle>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const store = masteryStore('landmarks');
  const [stageRef, size] = useBoxSize<HTMLElement>();

  const [q, setQ] = useState<QState | null>(null);
  const [stats, setStats] = useState<RoundStats>(EMPTY);
  const [marks, setMarks] = useState<Record<string, RegionMark>>({});
  const [labels, setLabels] = useState<MapLabel[]>([]);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [bigPhoto, setBigPhoto] = useState(false);

  const pool = useMemo(() => landmarksOf(level), [level]);
  const active = useMemo(() => activeRegions(level), [level]);
  const R = useRef({
    asked: [] as string[],
    missed: new Set<string>(),
    comeback: new Map<string, number>(),
    prevRecent: progressStore.get().recent[level.id] ?? [],
    shownAt: 0,
    lastTapAt: 0,
    lastWrong: '',
    cooldownUntil: 0,
    rankBefore: rewards.rank().index,
    timers: [] as number[],
    stats: EMPTY,
    q: null as QState | null,
    over: false,
  });
  R.current.stats = stats;
  R.current.q = q;

  const later = useCallback((ms: number, fn: () => void) => {
    R.current.timers.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(
    () => () => {
      R.current.timers.forEach((t) => clearTimeout(t));
      stopSpeaking();
    },
    [],
  );

  const flashLabel = useCallback(
    (l: MapLabel, ms: number) => {
      setLabels((list) => [...list.filter((x) => x.id !== l.id), l]);
      later(ms, () => setLabels((list) => list.filter((x) => !(x.id === l.id && x.text === l.text))));
    },
    [later],
  );

  const factId = useCallback((id: string) => `${level.map}:${id}`, [level.map]);
  const lm = (id: string | undefined): LandmarkDef | undefined => (id ? LANDMARK_BY_ID.get(id) : undefined);

  // ---- question flow -------------------------------------------------------------------------

  const askNext = useCallback(
    (index: number) => {
      if (!map) return;
      const cur = R.current;
      const mastery = store.get().facts;
      const candidates = pool.map((l) => ({ id: l.id, prior: TIER_PRIOR[l.tier] }));
      const m: Record<string, (typeof mastery)[string] | undefined> = {};
      for (const c of candidates) m[c.id] = mastery[factId(c.id)];
      const target = pickTarget({
        candidates,
        mastery: m,
        asked: cur.asked,
        missed: cur.missed,
        comeback: cur.comeback,
        index,
        speed: LM_SPEED,
        rng: Math.random,
        prevRecent: cur.prevRecent,
        now: Date.now(),
      });
      cur.comeback.delete(target);
      cur.asked.push(target);
      cur.lastWrong = '';
      cur.cooldownUntil = 0;
      setMarks({});
      setLabels([]);
      setBigPhoto(false);
      setQ({ index, target, phase: 'ask', misses: 0 });
      cur.shownAt = performance.now();
      const l = LANDMARK_BY_ID.get(target);
      if (l && soundOn()) speak(`Where is ${spokenName(l)}?`);
    },
    [map, store, pool, factId],
  );

  useState(() => consumeAutostart());
  const started = useRef(false);
  useEffect(() => {
    if (map && !started.current) {
      started.current = true;
      R.current.rankBefore = rewards.rank().index;
      askNext(0);
    }
  }, [map, askNext]);

  const finish = useCallback(() => {
    const cur = R.current;
    if (cur.over) return;
    cur.over = true;
    const s = cur.stats;
    const stars = starsFor(s.firstTry, ROUND_LENGTH);
    const { unlocked } = recordRound(level.id, stars, Math.max(0, s.points), cur.asked);
    const real = s.answered >= 10 && s.firstTry / Math.max(1, s.answered) >= 0.8;
    let best: Finished['best'] = null;
    let realImprovement = false;
    if (s.points > 0) {
      const b = rewards.recordBest(`landmarks:${level.id}`, s.points, true);
      best = { label: 'Best score', value: s.points, isNewBest: b.isNewBest, previous: b.previous };
      realImprovement = b.isNewBest && b.previous !== null && real;
    }
    const firstRound = real && rewards.claimFirstRound('landmarks');
    const bonuses = roundBonuses({ newBest: realImprovement, answered: s.answered, correct: s.firstTry, firstRound });
    if (bonuses.total > 0) rewards.addPoints('landmarks', bonuses.total, 'bonus', 'Round bonus');
    const got: TrophyId[] = [];
    const tryT = (id: TrophyId, cond: boolean) => {
      if (cond && awardTrophy(id, { quiet: true })) got.push(id);
    };
    tryT('first-round', s.answered > 0);
    tryT('combo-10', s.bestCombo >= 10);
    got.push(...checkLifetimeTrophies(true));
    got.push(...checkGoalAndAnnounce());
    const rankNow = rewards.rank();
    const rankUp = rankNow.index > cur.rankBefore ? rankNow : null;
    if ((best?.isNewBest && best.previous !== null) || rankUp || stars === 3) {
      sfx.play('pb');
      celebrate(stars === 3 ? 'big' : 'pb');
    } else {
      sfx.play('roundEnd');
      if (stars >= 2) celebrate('small');
    }
    if (got.length) later(700, () => sfx.play('trophy'));
    store.flush();
    setFinished({ stars, bonuses, best, trophies: got, rankUp, unlocked });
  }, [level, later, store]);

  const advance = useCallback(
    (fromIndex: number) => {
      const cur = R.current;
      if (cur.over || cur.q?.index !== fromIndex) return;
      if (fromIndex + 1 >= ROUND_LENGTH) finish();
      else askNext(fromIndex + 1);
    },
    [askNext, finish],
  );

  /** Show where it is: every accepted country/state lights up, the pin drops, the fact card shows. */
  const showAnswer = useCallback(
    (qs: QState, news: QState['news'], tone: RegionMark) => {
      if (!map) return;
      const l = LANDMARK_BY_ID.get(qs.target)!;
      const ids = answersFor(level, l);
      setMarks(Object.fromEntries(ids.map((id) => [id, tone])));
      const primary = ids[0];
      setLabels([{ id: primary, text: map.byId.get(primary)?.label ?? '', tone: 'good' }]);
      setQ({ ...qs, phase: 'done', news });
      if (soundOn()) later(250, () => speak(l.fact, { rate: 0.95 }));
      later(FACT_MS, () => advance(qs.index));
    },
    [map, level, later, advance],
  );

  const onCorrect = useCallback(
    (anchor: Element | null) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || !map || qs.phase === 'done') return;
      const l = LANDMARK_BY_ID.get(qs.target)!;
      const ms = Math.max(0, performance.now() - cur.shownAt);
      const firstTry = qs.misses === 0;
      const s = cur.stats;
      const combo = firstTry ? s.combo + 1 : 0;
      const pts = landmarkPoints({ prior: TIER_PRIOR[l.tier], ms, misses: qs.misses, comboMult: comboMultiplier(combo) });
      if (pts > 0) {
        rewards.addPoints('landmarks', pts, 'answer', l.name);
        burstRef.current?.burst(pts, (anchor as HTMLElement | null) ?? promptRef.current);
        checkGoalAndAnnounce();
      }
      let news: QState['news'] = { stamp: false, country: null, points: pts, firstTry };
      if (firstTry) {
        store.update((m) => applyMastery(m, { factId: factId(qs.target), correct: true, ms, tier: speedTier(ms, LM_SPEED) }, Date.now()));
        const st = stamp(qs.target);
        news = { ...news, stamp: st.isNew, country: st.countryDone };
        if (st.isNew) later(350, () => sfx.play('combo'));
      }
      cur.missed.delete(qs.target);
      sfx.play('correct');
      if (firstTry && (combo === 5 || combo === 10)) burstRef.current?.shout(combo === 5 ? '5 in a row!' : '10 in a row!', promptRef.current);
      setStats({
        ...s,
        points: s.points + pts,
        combo,
        bestCombo: Math.max(s.bestCombo, combo),
        firstTry: s.firstTry + (firstTry ? 1 : 0),
        answered: s.answered + 1,
        stamps: s.stamps + (news.stamp ? 1 : 0),
      });
      showAnswer(qs, news, 'correct');
    },
    [map, store, factId, later, showAnswer],
  );

  const onMiss = useCallback(
    (wrongId: string, anchor: Element | null) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || !map) return;
      const l = LANDMARK_BY_ID.get(qs.target)!;
      const s = cur.stats;
      const penalty = missPenalty(s.points);
      if (penalty > 0) {
        rewards.addPoints('landmarks', -penalty, 'answer', `Miss: ${l.name}`);
        burstRef.current?.burst(-penalty, (anchor as HTMLElement | null) ?? promptRef.current);
      }
      sfx.play('wrong');
      const misses = qs.misses + 1;
      if (misses === 1) {
        store.update((m) => applyMastery(m, { factId: factId(qs.target), correct: false, ms: 0, tier: 'none' }, Date.now()));
        cur.missed.add(qs.target);
        scheduleComeback(cur.comeback, qs.target, qs.index, Math.random);
      }
      setStats({
        ...s,
        points: s.points - penalty,
        combo: 0,
        missesTotal: s.missesTotal + 1,
        missedIds: s.missedIds.includes(qs.target) ? s.missedIds : [...s.missedIds, qs.target],
      });
      const w = map.byId.get(wrongId);
      setMarks((mk) => ({ ...mk, [wrongId]: 'wrong' }));
      later(800, () =>
        setMarks((mk) => {
          if (mk[wrongId] !== 'wrong') return mk;
          const next = { ...mk };
          delete next[wrongId];
          return next;
        }),
      );
      if (w) flashLabel({ id: wrongId, text: `That's ${w.label}`, tone: 'bad' }, 1600);
      if (w && soundOn()) speak(`That's ${w.label}`);
      if (misses >= 2) {
        cur.cooldownUntil = performance.now() + 900;
        const ids = answersFor(level, l);
        setMarks((mk) => ({ ...mk, ...Object.fromEntries(ids.map((id) => [id, 'reveal' as RegionMark])) }));
        setLabels((list) => [...list.filter((x) => x.id !== ids[0]), { id: ids[0], text: map.byId.get(ids[0])?.label ?? '', tone: 'info' }]);
        setQ({ ...qs, misses, phase: 'reveal' });
        if (soundOn()) later(1100, () => speak(`${spokenName(l)} is in ${map.byId.get(ids[0])?.label}. Tap it!`));
        // No dead ends: move on by itself if he does not tap it.
        later(7000, () => {
          const c = R.current.q;
          if (c && c.index === qs.index && c.phase === 'reveal') {
            setStats((st) => ({ ...st, answered: st.answered + 1 }));
            setQ({ ...c, phase: 'done' });
            advance(qs.index);
          }
        });
      } else {
        setQ({ ...qs, misses, phase: 'hint' });
      }
    },
    [map, level, store, factId, later, flashLabel, advance],
  );

  const onMapTap = useCallback(
    (id: string) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || !map || cur.over) return;
      const now = performance.now();
      if (qs.phase === 'done' || now < cur.cooldownUntil || now - cur.lastTapAt < 250) return;
      cur.lastTapAt = now;
      sfx.unlock();
      const el = document.querySelector(`.mp-map [data-region="${CSS.escape(id)}"]`);
      const l = LANDMARK_BY_ID.get(qs.target)!;
      if (answersFor(level, l).includes(id)) {
        onCorrect(el);
        return;
      }
      const r = map.byId.get(id);
      if (!r) return;
      if (!active.has(id) || qs.phase === 'reveal') {
        // Not part of this level (or the answer is already shown): just say what it is, no penalty.
        sfx.play('pop', 0.6);
        flashLabel({ id, text: r.label, tone: 'info' }, 1300);
        return;
      }
      if (id === cur.lastWrong) return; // the same wrong place twice = one miss
      cur.lastWrong = id;
      onMiss(id, el);
    },
    [map, level, active, onCorrect, onMiss, flashLabel],
  );

  const skipFact = () => {
    const qs = R.current.q;
    if (qs && qs.phase === 'done') advance(qs.index);
  };

  // ---- camera --------------------------------------------------------------------------------

  const target = lm(q?.target);
  const tall = size.w > 0 && size.h > size.w * 0.85;
  const base = useMemo(() => baseCamera(level.map, tall), [level.map, tall]);
  const zoom = useMemo<{ cam: Camera; name: string } | null>(() => {
    if (!map || !target || level.map !== 'countries' || size.w === 0) return null;
    const regions = answersFor(level, target)
      .map((id) => map.byId.get(id))
      .filter((r): r is Region => Boolean(r));
    if (!regions.length || regions.some((r) => screenSize(r.bbox, base, size.w, size.h) >= MIN_TAP_PX)) return null;
    const rv = regionViewFor(regions[0].bbox);
    return rv ? { cam: { view: rv.view }, name: rv.name } : null;
  }, [map, target, level, base, size]);
  const cam = zoom?.cam ?? base;
  const k = size.w > 0 ? Math.max(cam.view[2] / size.w, cam.view[3] / size.h) : 1;

  // "It's around here": a circle near the landmark itself (not the whole country — the USA's box spans
  // Alaska to Hawaii), sized to the country but capped, and off-centre so it never points at the spot.
  const hintCircle = useMemo(() => {
    if (!q || !target || !map || q.phase !== 'hint') return null;
    const p = PX.get(target.id);
    const r = map.byId.get(answersFor(level, target)[0]);
    if (!p || !r) return null;
    const x = level.map === 'us' ? (p.ux ?? r.lx) : p.wx;
    const y = level.map === 'us' ? (p.uy ?? r.ly) : p.wy;
    const size = Math.hypot(r.bbox[2] - r.bbox[0], r.bbox[3] - r.bbox[1]);
    const rad = Math.min(Math.max(size * 0.5, cam.view[2] * 0.07), cam.view[2] * 0.13);
    const ang = ((q.index * 137 + target.id.length * 53) % 360) * (Math.PI / 180);
    return { x: x + Math.cos(ang) * rad * 0.4, y: y + Math.sin(ang) * rad * 0.4, r: rad };
  }, [q, target, map, level, cam]);

  const hintText = useMemo(() => {
    if (!target || !map) return '';
    if (level.map === 'us') {
      const g = map.byId.get(target.state ?? '')?.group;
      return g ? `Look in ${g}!` : 'Look in the circle!';
    }
    const g = ISO[target.cc]?.group;
    return g ? `It's in ${g}!` : 'Look in the circle!';
  }, [target, map, level.map]);

  const pinPoints = useMemo(() => {
    if (!q || !target || q.phase !== 'done') return [];
    const p = PX.get(target.id);
    if (!p) return [];
    if (level.map === 'us') return p.ux !== undefined && p.uy !== undefined ? [{ x: p.ux, y: p.uy }] : [];
    return [{ x: p.wx, y: p.wy }];
  }, [q, target, level.map]);

  // The fact card sits at the bottom of the map, or at the top when the pin is down there.
  const factPos = pinPoints[0] && (pinPoints[0].y - cam.view[1]) / cam.view[3] > 0.55 ? 'top' : 'bottom';

  const title = (
    <>
      <span className="k-emoji">{level.emoji}</span> {level.title}
    </>
  );

  // ---- summary -------------------------------------------------------------------------------

  if (finished) {
    const s = stats;
    const stars = finished.stars;
    const bo = finished.bonuses;
    const bonusLines: Array<{ label: string; points: number; emoji?: string }> = [];
    if (bo.firstRound) bonusLines.push({ label: 'First round today', points: bo.firstRound, emoji: '🌅' });
    if (bo.newBest) bonusLines.push({ label: 'New record', points: bo.newBest, emoji: '🏆' });
    if (bo.perfect) bonusLines.push({ label: 'Perfect', points: bo.perfect, emoji: '💯' });
    const totalStamps = Object.keys(progressStore.get().stamps).length;
    return (
      <div className="k-screen mp-screen lm-screen" style={{ ['--k-app' as string]: 'var(--k-app-landmarks)' }}>
        <TopBar onBack={onExit} title={title} points={today} />
        <RoundSummary
          title={stars === 3 ? 'World traveller!' : stars >= 2 ? 'Great exploring!' : stars === 1 ? 'Nice trip!' : 'Keep exploring!'}
          emoji={stars === 3 ? '🏆' : '🧳'}
          pointsEarned={Math.max(0, s.points) + bo.total}
          bonusLines={bonusLines}
          best={finished.best ?? undefined}
          trophies={finished.trophies}
          rankUp={finished.rankUp}
          stats={[
            { label: 'First try', value: `${s.firstTry}/${ROUND_LENGTH}`, emoji: '🎯', highlight: s.firstTry === ROUND_LENGTH },
            { label: 'New stamps', value: s.stamps, emoji: '🛂', highlight: s.stamps > 0 },
            { label: 'Best streak', value: s.bestCombo, emoji: '🔥' },
          ]}
          onAgain={onAgain}
          onHome={onExit}
        >
          <div className="mp-sum-stars" data-testid="summary-stars" data-stars={stars} aria-label={`${stars} stars`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`mp-star${i < stars ? ' is-on' : ''}`} style={{ animationDelay: `${300 + i * 220}ms` }}>
                ★
              </span>
            ))}
          </div>
          {s.missedIds.length > 0 && (
            <div className="lm-missed" data-testid="missed-list">
              <div className="mp-missed__t">Practice these:</div>
              <div className="lm-missed__row">
                {s.missedIds.map((id) => {
                  const l = LANDMARK_BY_ID.get(id)!;
                  return (
                    <button type="button" key={id} className="lm-missed__item" onClick={() => speak(`${l.name} is in ${countryName(l.cc, map)}. ${l.fact}`)}>
                      <Photo id={id} alt={l.name} thumb />
                      <span>
                        {l.name}
                        <small>{level.map === 'us' && l.state ? (map?.byId.get(l.state)?.label ?? l.state) : countryName(l.cc, map)}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button type="button" className="lm-passport-link" onClick={onPassport} data-testid="open-passport">
            <span className="k-emoji">🛂</span> Passport: <b className="k-num">{totalStamps}</b> stamps
          </button>
          {finished.unlocked && isUnlocked(progressStore.get(), finished.unlocked) && (
            <button type="button" className="mp-unlock" data-testid="unlocked-level" onClick={() => onPlayLevel(finished.unlocked!.id)}>
              <span className="k-emoji">🔓</span> New level: <b>{finished.unlocked.title}</b> <span className="k-emoji">{finished.unlocked.emoji}</span>
            </button>
          )}
        </RoundSummary>
      </div>
    );
  }

  // ---- play ----------------------------------------------------------------------------------

  const verb = !q
    ? ''
    : q.phase === 'reveal'
      ? 'Here it is! Tap it.'
      : q.phase === 'hint'
        ? hintText
        : q.phase === 'done'
          ? q.news?.firstTry
            ? 'You found'
            : 'This is'
          : 'Where is';
  const news = q?.phase === 'done' ? q.news : undefined;

  return (
    <div
      className="k-screen mp-screen lm-screen lm-round"
      style={{ ['--k-app' as string]: 'var(--k-app-landmarks)' }}
      data-testid="landmarks-round"
      data-level={level.id}
    >
      <RotateHint />
      <TopBar
        onBack={onExit}
        title={title}
        center={
          <div className="mp-progress" data-testid="round-progress" aria-label={`Question ${(q?.index ?? 0) + 1} of ${ROUND_LENGTH}`}>
            {Array.from({ length: ROUND_LENGTH }, (_, i) => (
              <span key={i} className={`mp-dot${q && i < q.index + (q.phase === 'done' ? 1 : 0) ? ' is-done' : ''}${q && i === q.index ? ' is-now' : ''}`} />
            ))}
            <span className="mp-progress__n k-num">
              {(q?.index ?? 0) + 1}/{ROUND_LENGTH}
            </span>
          </div>
        }
        points={today}
        combo={stats.combo}
        comboMultiplier={comboMultiplier(stats.combo)}
      />

      <div
        className={`mp-prompt lm-prompt is-${q?.phase ?? 'ask'}`}
        ref={promptRef}
        data-testid="prompt"
        data-target={q?.target ?? ''}
        data-answers={target ? answersFor(level, target).join(' ') : ''}
        data-zoom={zoom ? '1' : undefined}
        data-q={q?.index ?? -1}
        data-phase={q?.phase ?? ''}
      >
        {target && (
          <button type="button" className="lm-prompt__photo" onClick={() => setBigPhoto(true)} aria-label={`Bigger photo of ${target.name}`}>
            <Photo id={target.id} alt={target.name} eager testId="landmark-photo" />
          </button>
        )}
        <div className="lm-prompt__text">
          <span className="mp-prompt__verb">{verb}</span>
          {target && (
            <span className="lm-prompt__name" data-testid="target-name">
              {target.name}
            </span>
          )}
          {zoom && q?.phase !== 'done' && (
            <span className="lm-zoomchip" data-testid="zoomed">
              <span className="k-emoji">🔍</span> <span className="lm-zoomchip__long">Zoomed in on </span>
              {zoom.name}
            </span>
          )}
        </div>
        {target && (
          <button type="button" className="mp-say" aria-label="Say it again" data-testid="say" onClick={() => speak(`Where is ${spokenName(target)}?`)}>
            <span className="k-emoji">🔊</span>
          </button>
        )}
        <div className="mp-round-pts k-num" data-testid="round-points" aria-label="Points this round">
          <span className="k-emoji">⭐</span> {Math.max(0, stats.points)}
        </div>
      </div>

      <main className="mp-stage lm-stage" ref={stageRef}>
        {map ? (
          <>
            <MapView map={map} view={cam.view} inset={cam.inset} active={active} marks={marks} labels={labels} hintCircle={hintCircle} onTap={onMapTap} />
            {pinPoints.length > 0 && size.w > 0 && <Pins cam={cam} points={pinPoints} k={k} />}
          </>
        ) : (
          <div className="mp-loading" data-testid="map-loading">
            {error ? (
              <button type="button" className="k-btn k-btn--app k-btn--lg" onClick={retry}>
                Try again
              </button>
            ) : (
              <span className="k-emoji mp-spin">🌍</span>
            )}
          </div>
        )}
        {news && target && (
          <div className="lm-fact" data-testid="fact-card" role="status" data-pos={factPos}>
            <div className="lm-fact__head">
              <span className="k-emoji">📍</span>
              <b>
                {level.map === 'us' && target.state ? (map?.byId.get(target.state)?.label ?? '') : countryName(target.cc, map)}
              </b>
              {news.stamp && (
                <span className="lm-stamp-new" data-testid="new-stamp">
                  <span className="k-emoji">🛂</span> New stamp!
                </span>
              )}
            </div>
            <p className="lm-fact__text">{target.fact}</p>
            {news.country && (
              <div className="lm-fact__country" data-testid="country-done">
                <span className="k-emoji">🎉</span> {countryName(news.country, map)} page complete!
              </div>
            )}
            <div className="lm-fact__btns">
              <button type="button" className="lm-fact__say" onClick={() => speak(target.fact)} aria-label="Read the fact">
                <span className="k-emoji">🔊</span>
              </button>
              <button type="button" className="lm-fact__next" onClick={skipFact} data-testid="next">
                Next <span className="k-emoji">➜</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {bigPhoto && target && (
        <button type="button" className="lm-bigphoto" onClick={() => setBigPhoto(false)} data-testid="big-photo" aria-label="Close photo">
          <Photo id={target.id} alt={target.name} eager />
          <span className="lm-bigphoto__name">{target.name}</span>
        </button>
      )}
      <PointsBurst ref={burstRef} />
    </div>
  );
}

