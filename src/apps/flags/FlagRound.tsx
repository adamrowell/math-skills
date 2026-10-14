/**
 * Find it (tap the country for the flag) and Which flag? (pick the flag for the country) rounds.
 * Same economy and kid-proofing as Maps (docs/GEO-LOGIC.md §C.3–C.5).
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
import { applyMastery, masteryStore, roundBonuses, speedTier } from '../../drill';
import type { RoundBonuses } from '../../drill';
import { RotateHint } from '../../platform';
import { MapView } from '../maps/MapView';
import type { MapLabel, RegionMark } from '../maps/MapView';
import { useMap } from '../maps/mapLoader';
import { FIND_SPEED, NAME_SPEED, comboMultiplier, missPenalty, nextRecent, pickTarget, scheduleComeback, starsFor } from '../maps/logic';
import { speak, stopSpeaking } from '../maps/speech';
import { WORLD_ALL_INSET, WORLD_ALL_PORTRAIT, WORLD_NO_ANTARCTICA } from '../maps/stages';
import type { LoadedMap, Region, ViewBox } from '../maps/types';
import { FLAGS, FLAG_BY_CC, TWINS } from './data/flags';
import type { FlagDef } from './data/flags';
import { Flag } from './Flag';
import { ROUND_LENGTH, buildFlagChoices, collectAfter, findFlags, findKey, findPoints, flagPrior, whichKey, whichPoints } from './logic';
import type { FlagMode, LevelDef } from './logic';
import { progressStore, recordRound, starKey } from './progress';

interface Props {
  level: LevelDef;
  mode: FlagMode;
  onExit: () => void;
  onAgain: () => void;
  onGo: (route: string) => void;
}

type Phase = 'ask' | 'hint' | 'reveal' | 'done';

interface QState {
  index: number;
  cc: string;
  phase: Phase;
  misses: number;
  choices: string[];
  wrongChoices: string[];
  /** Find it: camera zoomed in for a small country. */
  zoom: ViewBox | null;
  /** Find it: he has this flag's sticker → "Whose flag is this?" without the name. */
  nameHidden: boolean;
  /** He tapped "👀 Name?" to see the hidden name (pays × 0.7, no gold). */
  peeked: boolean;
}

interface Stats {
  points: number;
  combo: number;
  bestCombo: number;
  firstTry: number;
  missesTotal: number;
  answered: number;
  missed: string[];
  newStickers: string[];
}

interface Finished {
  stars: number;
  bonuses: RoundBonuses;
  best: { label: string; value: number; isNewBest: boolean; previous: number | null } | null;
  trophies: TrophyId[];
  rankUp: RankInfo | null;
  opened: ReturnType<typeof recordRound>;
}

const EMPTY: Stats = { points: 0, combo: 0, bestCombo: 0, firstTry: 0, missesTotal: 0, answered: 0, missed: [], newStickers: [] };
const soundOn = () => getSettings().soundOn;
/** A camera this wide (map units) shows a small country with plenty of neighbours around it. */
const ZOOM_W = 190;
/** Smaller than this on screen at the level camera → zoom in (§C.3 auto-zoom rule). */
const ZOOM_BELOW_PX = 20;

const sizeOf = (r: Region) => Math.max(r.bbox[2] - r.bbox[0], r.bbox[3] - r.bbox[1]);

/**
 * A regional camera around a small country. The country is placed off-centre at random, so the
 * camera says "it's around here", not "it's in the middle".
 */
function regionalCamera(r: Region, base: ViewBox, map: LoadedMap, rng: () => number, screenW: number): ViewBox {
  // Wide enough to show neighbours, but close enough that the country is ≥ ~28 px on screen
  // (Luxembourg, Singapore…), never closer than 60 map units.
  const w = Math.max(60, Math.min(ZOOM_W, (sizeOf(r) * screenW) / 28));
  const h = (w * base[3]) / base[2];
  let x = r.lx - w / 2 + (rng() - 0.5) * w * 0.5;
  let y = r.ly - h / 2 + (rng() - 0.5) * h * 0.5;
  x = Math.max(0, Math.min(map.data.width - w, x));
  y = Math.max(0, Math.min(map.data.height - h, y));
  return [x, y, w, h];
}

/** Which flag?: frame the named country (by its label point and size, so overseas islands don't blow the box up). */
function countryCamera(r: Region, base: ViewBox, map: LoadedMap): ViewBox {
  const aspect = base[2] / base[3];
  const w = Math.min(map.data.width, Math.max(r.lr * 14, Math.min(sizeOf(r), 400) * 2.2, 150));
  const h = w / aspect;
  const x = Math.max(0, Math.min(map.data.width - w, r.lx - w / 2));
  const y = Math.max(0, Math.min(map.data.height - h, r.ly - h / 2));
  return [x, y, w, h];
}

export function FlagRound({ level, mode, onExit, onAgain, onGo }: Props) {
  const { map, error, retry } = useMap('countries');
  const today = useTodayPoints();
  const burstRef = useRef<PointsBurstHandle>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const store = masteryStore('flags');
  const recentKey = starKey(mode, level.id);
  const [prevRecent] = useState(() => progressStore.get().recent[recentKey] ?? []);

  const [q, setQ] = useState<QState | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [marks, setMarks] = useState<Record<string, RegionMark>>({});
  const [labels, setLabels] = useState<MapLabel[]>([]);
  const [finished, setFinished] = useState<Finished | null>(null);

  const R = useRef({
    asked: [] as string[],
    missed: new Set<string>(),
    comeback: new Map<string, number>(),
    recentWrong: [] as string[],
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

  const pool = useMemo(() => (mode === 'find' ? findFlags(level) : level.flags).map((cc) => FLAG_BY_CC.get(cc)!).filter(Boolean), [level, mode]);
  // Countries in play: the level's flags (all others are just named when tapped).
  const active = useMemo(() => new Set(pool.map((f) => f.id)), [pool]);
  const famous = level.id === 'famous';
  const baseView = WORLD_NO_ANTARCTICA;
  const speed = mode === 'find' ? FIND_SPEED : NAME_SPEED;

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

  const promptSpeech = useCallback(
    (f: FlagDef, hidden: boolean) => (mode === 'find' ? (hidden ? 'Whose flag is this? Find the country!' : `Find the flag of ${f.name}`) : `Which flag is ${f.name}?`),
    [mode],
  );

  const askNext = useCallback(
    (index: number) => {
      if (!map) return;
      const cur = R.current;
      const mastery = store.get().facts;
      const key = mode === 'find' ? findKey : whichKey;
      const candidates = pool.filter((f) => map.byId.has(f.id)).map((f) => ({ id: f.cc, prior: flagPrior(f) }));
      const m: Record<string, (typeof mastery)[string] | undefined> = {};
      for (const c of candidates) m[c.id] = mastery[key(c.id)];
      const cc = pickTarget({ candidates, mastery: m, asked: cur.asked, missed: cur.missed, comeback: cur.comeback, index, speed, rng: Math.random, prevRecent, now: Date.now() });
      cur.comeback.delete(cc);
      cur.asked.push(cc);
      cur.lastWrong = '';
      cur.cooldownUntil = 0;
      const recent = nextRecent(cur.asked);
      progressStore.update((p) => ({ ...p, recent: { ...p.recent, [recentKey]: recent } }));
      const flag = FLAG_BY_CC.get(cc)!;
      const region = map.byId.get(flag.id)!;

      let zoom: ViewBox | null = null;
      let choices: string[] = [];
      let nameHidden = false;
      if (mode === 'find') {
        const screenW = Math.max(320, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 20);
        const px = sizeOf(region) * (screenW / baseView[2]);
        if (px < ZOOM_BELOW_PX) zoom = regionalCamera(region, baseView, map, Math.random, screenW);
        const p = progressStore.get();
        // Hide the name as soon as the sticker is won (first-try right once): from then on Find it
        // tests the flag, not reading. Never for flags that look identical to another one.
        nameHidden = Boolean(p.collected[cc]) && !TWINS[cc];
        setMarks({});
      } else {
        // Beyond Famous flags, look-alikes may come from the whole catalog (that is the point).
        choices = buildFlagChoices(flag, famous ? pool : FLAGS, Math.random, cur.recentWrong.slice(-3));
        setMarks({ [flag.id]: 'target' });
      }
      setLabels([]);
      setQ({ index, cc, phase: 'ask', misses: 0, choices, wrongChoices: [], zoom, nameHidden, peeked: false });
      cur.shownAt = performance.now() + (zoom || mode === 'which' ? 500 : 0);
      if (soundOn()) speak(promptSpeech(flag, nameHidden));
    },
    [map, store, mode, pool, speed, prevRecent, recentKey, baseView, famous, promptSpeech],
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
    const opened = recordRound(mode, level.id, stars);
    const real = s.answered >= 10 && s.firstTry / Math.max(1, s.answered) >= 0.8;
    let best: Finished['best'] = null;
    let realImprovement = false;
    if (s.points > 0) {
      const b = rewards.recordBest(`flags:${mode}:${level.id}`, s.points, true);
      best = { label: 'Best score', value: s.points, isNewBest: b.isNewBest, previous: b.previous };
      realImprovement = b.isNewBest && b.previous !== null && real;
    }
    const firstRound = real && rewards.claimFirstRound('flags');
    const bonuses = roundBonuses({ newBest: realImprovement, answered: s.answered, correct: s.firstTry, firstRound });
    if (bonuses.total > 0) rewards.addPoints('flags', bonuses.total, 'bonus', 'Round bonus');
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
    if ((best?.isNewBest && best.previous !== null) || rankUp || stars === 3 || s.newStickers.length > 0) {
      sfx.play('pb');
      celebrate(stars === 3 ? 'big' : 'pb');
    } else {
      sfx.play('roundEnd');
      if (stars >= 2) celebrate('small');
    }
    if (got.length) later(700, () => sfx.play('trophy'));
    store.flush();
    setFinished({ stars, bonuses, best, trophies: got, rankUp, opened });
  }, [mode, level, later, store]);

  const advance = useCallback(
    (from: number) => {
      const cur = R.current;
      if (cur.over || cur.q?.index !== from) return;
      if (from + 1 >= ROUND_LENGTH) finish();
      else askNext(from + 1);
    },
    [askNext, finish],
  );

  const onCorrect = useCallback(
    (anchor: Element | null) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || !map || qs.phase === 'done') return;
      const flag = FLAG_BY_CC.get(qs.cc)!;
      const ms = Math.max(0, performance.now() - cur.shownAt);
      const firstTry = qs.misses === 0;
      const s = cur.stats;
      const combo = firstTry ? s.combo + 1 : 0;
      const prior = flagPrior(flag);
      const comboMult = comboMultiplier(combo);
      const pts =
        mode === 'find'
          ? findPoints({ prior, ms, misses: qs.misses, comboMult, nameHidden: qs.nameHidden, peeked: qs.peeked })
          : whichPoints({ prior, ms, misses: qs.misses, comboMult });
      if (pts > 0) {
        rewards.addPoints('flags', pts, 'answer', flag.name);
        burstRef.current?.burst(pts, (anchor as HTMLElement | null) ?? promptRef.current);
        checkGoalAndAnnounce();
      }
      if (firstTry) {
        const tier = speedTier(ms, speed);
        // A peek at the name counts as a slow answer (no box promotion).
        const t = qs.peeked ? 'slow' : mode === 'which' && tier === 'fast' ? 'ok' : tier;
        store.update((m) => applyMastery(m, { factId: (mode === 'find' ? findKey : whichKey)(qs.cc), correct: true, ms, tier: t }, Date.now()));
      }
      // Sticker album.
      const p = progressStore.get();
      const col = collectAfter({ mode, firstTry, already: Boolean(p.collected[qs.cc]), whichHits: p.whichHits[qs.cc] ?? 0 });
      const goldNow = mode === 'find' && firstTry && !qs.peeked && !p.gold[qs.cc] && (store.get().facts[findKey(qs.cc)]?.box ?? 0) >= 4;
      progressStore.update((pp) => ({
        ...pp,
        whichHits: { ...pp.whichHits, [qs.cc]: col.whichHits },
        collected: col.collect ? { ...pp.collected, [qs.cc]: Date.now() } : pp.collected,
        gold: goldNow ? { ...pp.gold, [qs.cc]: Date.now() } : pp.gold,
      }));
      if (col.collect) {
        later(350, () => burstRef.current?.shout('New sticker!', promptRef.current));
        later(300, () => sfx.play('combo'));
      }
      cur.missed.delete(qs.cc);
      sfx.play('correct');
      if (firstTry && (combo === 5 || combo === 10) && !col.collect) {
        later(150, () => sfx.play('combo'));
        burstRef.current?.shout(combo === 5 ? '5 in a row!' : '10 in a row!', promptRef.current);
      }
      setStats({
        ...s,
        points: s.points + pts,
        combo,
        bestCombo: Math.max(s.bestCombo, combo),
        firstTry: s.firstTry + (firstTry ? 1 : 0),
        answered: s.answered + 1,
        newStickers: col.collect ? [...s.newStickers, qs.cc] : s.newStickers,
      });
      setMarks({ [flag.id]: 'correct' });
      setLabels([{ id: flag.id, text: flag.name, tone: 'good' }]);
      setQ({ ...qs, phase: 'done' });
      if (soundOn() && mode === 'find' && qs.nameHidden && !qs.peeked) speak(flag.name);
      later(firstTry ? (col.collect ? 1300 : 950) : 1100, () => advance(qs.index));
    },
    [map, mode, speed, store, later, advance],
  );

  const onMiss = useCallback(
    (wrongId: string | null, anchor: Element | null) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || !map) return;
      const flag = FLAG_BY_CC.get(qs.cc)!;
      const s = cur.stats;
      const penalty = missPenalty(s.points);
      if (penalty > 0) {
        rewards.addPoints('flags', -penalty, 'answer', `Miss: ${flag.name}`);
        burstRef.current?.burst(-penalty, (anchor as HTMLElement | null) ?? promptRef.current);
      }
      sfx.play('wrong');
      const misses = qs.misses + 1;
      if (misses === 1) {
        store.update((m) => applyMastery(m, { factId: (mode === 'find' ? findKey : whichKey)(qs.cc), correct: false, ms: 0, tier: 'none' }, Date.now()));
        cur.missed.add(qs.cc);
        scheduleComeback(cur.comeback, qs.cc, qs.index, Math.random);
      }
      setStats({ ...s, points: s.points - penalty, combo: 0, missesTotal: s.missesTotal + 1, missed: s.missed.includes(qs.cc) ? s.missed : [...s.missed, qs.cc] });
      if (wrongId && mode === 'find') {
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
      }
      if (misses >= 2) {
        cur.cooldownUntil = performance.now() + 900;
        setMarks((mk) => ({ ...mk, [flag.id]: mode === 'find' ? 'reveal' : 'target' }));
        if (mode === 'find') setLabels((list) => [...list.filter((l) => l.id !== flag.id), { id: flag.id, text: flag.name, tone: 'info' }]);
        setQ((cq) => (cq && cq.index === qs.index ? { ...cq, misses, phase: 'reveal' } : cq));
        if (soundOn()) later(wrongId ? 1100 : 300, () => speak(mode === 'find' ? `Here is ${flag.name}. Tap it!` : `This is the flag of ${flag.name}. Tap it!`));
        later(7000, () => {
          const c = R.current.q;
          if (c && c.index === qs.index && c.phase === 'reveal') {
            setStats((st) => ({ ...st, answered: st.answered + 1 }));
            setQ({ ...c, phase: 'done' });
            advance(qs.index);
          }
        });
      } else {
        setQ((cq) => (cq && cq.index === qs.index ? { ...cq, misses, phase: 'hint' } : cq));
      }
    },
    [map, mode, store, later, flashLabel, advance],
  );

  const onMapTap = useCallback(
    (id: string) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || !map || cur.over || mode !== 'find') return;
      const now = performance.now();
      if (qs.phase === 'done' || now < cur.cooldownUntil || now - cur.lastTapAt < 250) return;
      cur.lastTapAt = now;
      sfx.unlock();
      const el = document.querySelector(`.mp-map [data-region="${CSS.escape(id)}"]`);
      const target = FLAG_BY_CC.get(qs.cc)!;
      if (id === target.id) {
        onCorrect(el);
        return;
      }
      const r = map.byId.get(id);
      if (!r) return;
      if (!active.has(id)) {
        sfx.play('pop', 0.6);
        flashLabel({ id, text: r.label, tone: 'info' }, 1300);
        return;
      }
      if (qs.phase === 'reveal') {
        flashLabel({ id, text: r.label, tone: 'info' }, 1000);
        return;
      }
      if (id === cur.lastWrong) return;
      cur.lastWrong = id;
      onMiss(id, el);
    },
    [map, mode, active, onCorrect, onMiss, flashLabel],
  );

  const onChoice = useCallback(
    (cc: string, el: HTMLElement) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || cur.over || qs.phase === 'done') return;
      const now = performance.now();
      if (now < cur.cooldownUntil || now - cur.lastTapAt < 250) return;
      if (qs.wrongChoices.includes(cc)) return;
      cur.lastTapAt = now;
      sfx.unlock();
      if (cc === qs.cc) {
        onCorrect(el);
        return;
      }
      if (qs.phase === 'reveal') return;
      cur.recentWrong.push(cc);
      const w = FLAG_BY_CC.get(cc);
      if (w && soundOn()) speak(`That's ${w.name}`);
      setQ((cq) => (cq && cq.index === qs.index ? { ...cq, wrongChoices: [...cq.wrongChoices, cc] } : cq));
      onMiss(null, el);
    },
    [onCorrect, onMiss],
  );

  // ---- render --------------------------------------------------------------------------------

  const flag = q ? FLAG_BY_CC.get(q.cc) : undefined;
  const region = flag && map ? map.byId.get(flag.id) : undefined;

  const hintCircle = useMemo(() => {
    if (!q || !region || mode !== 'find' || q.phase !== 'hint') return null;
    const view = q.zoom ?? baseView;
    const r = Math.max(Math.min(sizeOf(region), 120) * 0.9, view[2] * 0.09);
    const cx = region.lx + r * 0.25 * (q.index % 2 ? 1 : -1);
    const cy = region.ly + r * 0.2 * (q.index % 3 ? -1 : 1);
    return { x: cx, y: cy, r: r * 1.3 };
  }, [q, region, mode, baseView]);

  const view = useMemo<ViewBox>(() => {
    if (!map || !q || !region) return baseView;
    if (mode === 'which') return countryCamera(region, baseView, map);
    return q.zoom ?? baseView;
  }, [map, q, region, mode, baseView]);
  const zoomed = mode === 'find' && Boolean(q?.zoom);
  const useInset = mode === 'find' && !famous && !zoomed;

  const title = (
    <>
      <span className="k-emoji">{mode === 'find' ? '🏳️' : '🤔'}</span> {level.title}
    </>
  );

  if (finished) {
    const s = stats;
    const st = finished.stars;
    const bo = finished.bonuses;
    const bonusLines: Array<{ label: string; points: number; emoji?: string }> = [];
    if (bo.firstRound) bonusLines.push({ label: 'First round today', points: bo.firstRound, emoji: '🌅' });
    if (bo.newBest) bonusLines.push({ label: 'New record', points: bo.newBest, emoji: '🏆' });
    if (bo.perfect) bonusLines.push({ label: 'Perfect', points: bo.perfect, emoji: '💯' });
    const op = finished.opened;
    return (
      <div className="k-screen fl-screen" style={{ ['--k-app' as string]: 'var(--k-app-flags)' }}>
        <TopBar onBack={onExit} title={title} points={today} />
        <RoundSummary
          title={st === 3 ? 'Flag champion!' : st >= 2 ? 'Great flags!' : st === 1 ? 'Nice work!' : 'Keep collecting!'}
          emoji={st === 3 ? '🏆' : '🏳️'}
          pointsEarned={Math.max(0, s.points) + bo.total}
          bonusLines={bonusLines}
          best={finished.best ?? undefined}
          trophies={finished.trophies}
          rankUp={finished.rankUp}
          stats={[
            { label: 'First try', value: `${s.firstTry}/${ROUND_LENGTH}`, emoji: '🎯', highlight: s.firstTry === ROUND_LENGTH },
            { label: 'New stickers', value: s.newStickers.length, emoji: '✨', highlight: s.newStickers.length > 0 },
            { label: 'Best streak', value: s.bestCombo, emoji: '🔥' },
          ]}
          onAgain={onAgain}
          onHome={onExit}
        >
          <div className="mp-sum-stars" data-testid="summary-stars" data-stars={st} aria-label={`${st} stars`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`mp-star${i < st ? ' is-on' : ''}`} style={{ animationDelay: `${300 + i * 220}ms` }}>
                ★
              </span>
            ))}
          </div>
          {s.newStickers.length > 0 && (
            <div className="fl-sum-stickers" data-testid="new-stickers">
              {s.newStickers.map((cc, i) => (
                <span key={cc} className="fl-sum-sticker" style={{ animationDelay: `${500 + i * 120}ms` }}>
                  <Flag cc={cc} />
                </span>
              ))}
            </div>
          )}
          {s.missed.length > 0 && (
            <div className="mp-missed" data-testid="missed-list">
              <div className="mp-missed__t">Practice these:</div>
              <div className="mp-missed__chips">
                {s.missed.map((cc) => (
                  <button type="button" key={cc} className="k-chip mp-missed__chip fl-missed" onClick={() => speak(FLAG_BY_CC.get(cc)?.name ?? '')}>
                    <Flag cc={cc} alt="" /> {FLAG_BY_CC.get(cc)?.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {op.unlockedLevel && (
            <button type="button" className="mp-unlock fl-unlock" data-testid="unlocked-level" onClick={() => onGo(`/flags/find/${op.unlockedLevel!.id}`)}>
              <span className="k-emoji">🔓</span> New level: <b>{op.unlockedLevel.title}</b>
            </button>
          )}
          {op.whichOpened && (
            <button type="button" className="mp-unlock mp-unlock--name" data-testid="unlocked-which" onClick={() => onGo(`/flags/which/${level.id}`)}>
              <span className="k-emoji">🤔</span> <b>Which flag?</b> is open for {level.title}
            </button>
          )}
          {op.spotterOpened && (
            <button type="button" className="mp-unlock mp-unlock--name" data-testid="unlocked-spotter" onClick={() => onGo('/flags/spotter')}>
              <span className="k-emoji">⚡</span> <b>Flag Spotter</b> is open!
            </button>
          )}
        </RoundSummary>
      </div>
    );
  }

  const phase = q?.phase ?? 'ask';
  const showName = mode === 'which' || !q?.nameHidden || q.peeked || phase === 'done' || phase === 'reveal';
  const canPeek = mode === 'find' && Boolean(q?.nameHidden) && !q?.peeked && (phase === 'ask' || phase === 'hint');
  const peek = () => {
    const cur = R.current.q;
    if (!cur || !flag) return;
    setQ({ ...cur, peeked: true });
    if (soundOn()) speak(`Find ${flag.name}`);
  };
  const verb =
    mode === 'find'
      ? phase === 'reveal'
        ? 'Here it is! Tap it.'
        : phase === 'hint'
          ? `It's in ${flag?.continent ?? 'there'}!`
          : q?.nameHidden && !q.peeked && phase !== 'done'
            ? 'Whose flag? Find the country!'
            : 'Find'
      : phase === 'reveal'
        ? 'This one! Tap it.'
        : phase === 'hint'
          ? 'Try again!'
          : 'Which flag is';

  return (
    <div
      className={`k-screen mp-screen fl-screen mp-round fl-round fl-round--${mode}`}
      style={{ ['--k-app' as string]: 'var(--k-app-flags)' }}
      data-testid="flags-round"
      data-mode={mode}
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
        className={`mp-prompt fl-prompt is-${phase}`}
        ref={promptRef}
        data-testid="prompt"
        data-target={q?.cc ?? ''}
        data-q={q?.index ?? -1}
        data-phase={q?.phase ?? ''}
        data-hidden={q?.nameHidden ? '1' : undefined}
      >
        {mode === 'find' && flag && (
          <span className="fl-prompt__flag" key={q?.index}>
            <Flag cc={flag.cc} alt="The flag to find" />
          </span>
        )}
        <div className="mp-prompt__text">
          <span className="mp-prompt__verb">{verb}</span>
          {flag && showName && (
            <span className="mp-prompt__name" data-testid="target-name">
              {flag.name}
            </span>
          )}
          {canPeek && (
            <button type="button" className="fl-peek" data-testid="name-peek" onClick={peek} aria-label="Show the name (fewer points)">
              <span className="k-emoji">👀</span> Name?
            </button>
          )}
          {zoomed && phase !== 'done' && (
            <span className="fl-zoomchip" data-testid="zoomed">
              <span className="k-emoji">🔍</span> Zoomed in
            </span>
          )}
        </div>
        {flag && (
          <button type="button" className="mp-say" aria-label="Say it again" data-testid="say" onClick={() => speak(promptSpeech(flag, Boolean(q?.nameHidden) && phase === 'ask'))}>
            <span className="k-emoji">🔊</span>
          </button>
        )}
        <div className="mp-round-pts k-num" data-testid="round-points" aria-label="Points this round">
          <span className="k-emoji">⭐</span> {Math.max(0, stats.points)}
        </div>
      </div>

      <div className="fl-body">
        <main className="mp-stage fl-stage">
          {map ? (
            <MapView
              map={map}
              view={view}
              inset={useInset ? WORLD_ALL_INSET : undefined}
              portrait={useInset ? WORLD_ALL_PORTRAIT : undefined}
              active={active}
              marks={marks}
              labels={labels}
              hintCircle={hintCircle}
              onTap={onMapTap}
              disabled={mode !== 'find'}
              tinyDots
            />
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
        </main>

        {mode === 'which' && q && (
          <div className="fl-choices" data-testid="choices">
            {q.choices.map((cc, i) => {
              const wrong = q.wrongChoices.includes(cc);
              const isAnswer = cc === q.cc;
              const cls = wrong ? ' is-wrong' : isAnswer && (q.phase === 'reveal' || q.phase === 'done') ? ' is-right' : '';
              return (
                <button
                  type="button"
                  key={`${q.index}-${cc}`}
                  className={`fl-choice${cls}`}
                  data-choice={cc}
                  aria-label={wrong ? `Not this one: ${FLAG_BY_CC.get(cc)?.name}` : `Flag ${i + 1}`}
                  disabled={wrong}
                  onClick={(e) => onChoice(cc, e.currentTarget)}
                >
                  <Flag cc={cc} alt="" />
                  {wrong && <span className="fl-choice__name">That's {FLAG_BY_CC.get(cc)?.name}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <PointsBurst ref={burstRef} />
    </div>
  );
}

