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
import { MapView } from './MapView';
import type { MapLabel, RegionMark } from './MapView';
import { useMap } from './mapLoader';
import {
  FIND_SPEED,
  NAME_SPEED,
  answerPoints,
  buildChoices,
  comboMultiplier,
  missPenalty,
  pickTarget,
  scheduleComeback,
  starsFor,
} from './logic';
import type { Mode } from './logic';
import { isNameUnlocked, progressStore, recordRound } from './progress';
import { speak, stopSpeaking } from './speech';
import { ROUND_LENGTH, masteryId } from './stages';
import type { LoadedMap, Region, StageDef, ViewBox } from './types';

interface Props {
  stage: StageDef;
  mode: Mode;
  onExit: () => void;
  onAgain: () => void;
  onPlayStage: (mode: Mode, stageId: string) => void;
}

type Phase = 'ask' | 'hint' | 'reveal' | 'done';

interface QState {
  index: number;
  target: string;
  phase: Phase;
  misses: number;
  choices: string[];
  wrongChoices: string[];
}

interface RoundStats {
  points: number;
  combo: number;
  bestCombo: number;
  firstTry: number;
  missesTotal: number;
  answered: number;
  missedIds: string[];
}

interface Finished {
  stars: number;
  bonuses: RoundBonuses;
  best: { label: string; value: number; isNewBest: boolean; previous: number | null } | null;
  trophies: TrophyId[];
  rankUp: RankInfo | null;
  unlocked: StageDef | null;
  nameUnlocked: boolean;
}

const EMPTY_STATS: RoundStats = { points: 0, combo: 0, bestCombo: 0, firstTry: 0, missesTotal: 0, answered: 0, missedIds: [] };

/** A camera that frames one region (Name-it), keeping the stage view's aspect ratio. */
function zoomTo(r: Region, base: ViewBox, map: LoadedMap): ViewBox {
  const bw = r.bbox[2] - r.bbox[0];
  const bh = r.bbox[3] - r.bbox[1];
  const aspect = base[2] / base[3];
  let w = Math.max(bw * 2.4, bh * 2.4 * aspect, base[2] * 0.42);
  w = Math.min(w, map.data.width * 1.05);
  const h = w / aspect;
  const cx = (r.bbox[0] + r.bbox[2]) / 2;
  const cy = (r.bbox[1] + r.bbox[3]) / 2;
  return [cx - w / 2, cy - h / 2, w, h];
}

const soundOn = () => getSettings().soundOn;

export function RoundScreen({ stage, mode, onExit, onAgain, onPlayStage }: Props) {
  const { map, error, retry } = useMap(stage.map);
  const today = useTodayPoints();
  const burstRef = useRef<PointsBurstHandle>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const store = masteryStore('maps');

  const [q, setQ] = useState<QState | null>(null);
  const [stats, setStats] = useState<RoundStats>(EMPTY_STATS);
  const [marks, setMarks] = useState<Record<string, RegionMark>>({});
  const [labels, setLabels] = useState<MapLabel[]>([]);
  const [finished, setFinished] = useState<Finished | null>(null);

  // Mutable round bookkeeping (not rendered).
  const R = useRef({
    asked: [] as string[],
    missed: new Set<string>(),
    comeback: new Map<string, number>(),
    shownAt: 0,
    lastTapAt: 0,
    lastWrong: '' as string,
    cooldownUntil: 0,
    rankBefore: rewards.rank().index,
    timers: [] as number[],
    stats: EMPTY_STATS,
    q: null as QState | null,
    over: false,
  });
  R.current.stats = stats;
  R.current.q = q;

  const mapW = map?.data.width ?? 1000;
  const mapH = map?.data.height ?? 500;
  const baseView = useMemo<ViewBox>(() => stage.view ?? [0, 0, mapW, mapH], [stage, mapW, mapH]);
  const speed = mode === 'find' ? FIND_SPEED : NAME_SPEED;
  const active = useMemo(() => new Set(stage.targets), [stage]);

  const later = useCallback((ms: number, fn: () => void) => {
    const t = window.setTimeout(fn, ms);
    R.current.timers.push(t);
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

  const sayPrompt = useCallback(
    (target: Region, m: Mode) => {
      if (!soundOn()) return;
      speak(m === 'find' ? `Find ${target.label}` : 'What is this?');
    },
    [],
  );

  // ---- question flow -------------------------------------------------------------------------

  const askNext = useCallback(
    (index: number) => {
      if (!map) return;
      const cur = R.current;
      const mastery = store.get().facts;
      const candidates = stage.targets
        .map((id) => map.byId.get(id))
        .filter((r): r is Region => Boolean(r))
        .map((r) => ({ id: r.id, prior: r.prior }));
      const masteryById: Record<string, (typeof mastery)[string] | undefined> = {};
      for (const c of candidates) masteryById[c.id] = mastery[masteryId(stage.map, c.id)];
      const target = pickTarget({
        candidates,
        mastery: masteryById,
        asked: cur.asked,
        missed: cur.missed,
        comeback: cur.comeback,
        index,
        speed,
        rng: Math.random,
      });
      cur.comeback.delete(target);
      cur.asked.push(target);
      cur.lastWrong = '';
      cur.cooldownUntil = 0;
      const region = map.byId.get(target)!;
      let choices: string[] = [];
      if (mode === 'name') {
        const pool = stage.targets.map((id) => map.byId.get(id)).filter((r): r is Region => Boolean(r));
        choices = buildChoices({ id: target, x: region.lx, y: region.ly }, pool.map((p) => ({ id: p.id, x: p.lx, y: p.ly })), Math.random);
      }
      setMarks(mode === 'name' ? { [target]: 'target' } : {});
      setLabels([]);
      setQ({ index, target, phase: 'ask', misses: 0, choices, wrongChoices: [] });
      cur.shownAt = performance.now() + (mode === 'name' ? 450 : 0);
      sayPrompt(region, mode);
    },
    [map, stage, mode, speed, store, sayPrompt],
  );

  // Start as soon as the map is here.
  // No ready card here; consuming the PLAY mark records "Continue" (UX-V3 §2.3).
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
    const p0 = progressStore.get();
    const nameWasUnlocked = isNameUnlocked(p0, stage);
    const { unlocked } = recordRound(mode, stage.id, stars);
    const nameUnlocked = mode === 'find' && !nameWasUnlocked && isNameUnlocked(progressStore.get(), stage);

    const answered = s.answered;
    const real = answered >= 10 && s.firstTry / Math.max(1, answered) >= 0.8;
    const key = `maps:${mode}:${stage.id}`;
    let best: Finished['best'] = null;
    let realImprovement = false;
    if (s.points > 0) {
      const b = rewards.recordBest(key, s.points, true);
      best = { label: 'Best score', value: s.points, isNewBest: b.isNewBest, previous: b.previous };
      realImprovement = b.isNewBest && b.previous !== null && real;
    }
    const firstRound = real && rewards.claimFirstRound('maps');
    const bonuses = roundBonuses({ newBest: realImprovement, answered, correct: s.firstTry, firstRound });
    if (bonuses.total > 0) rewards.addPoints('maps', bonuses.total, 'bonus', 'Round bonus');

    const got: TrophyId[] = [];
    const tryT = (id: TrophyId, cond: boolean) => {
      if (cond && awardTrophy(id, { quiet: true })) got.push(id);
    };
    tryT('first-round', answered > 0);
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
    setFinished({ stars, bonuses, best, trophies: got, rankUp, unlocked, nameUnlocked });
  }, [stage, mode, later, store]);

  const advance = useCallback(
    (fromIndex: number) => {
      const cur = R.current;
      if (cur.over || cur.q?.index !== fromIndex) return;
      if (fromIndex + 1 >= ROUND_LENGTH) finish();
      else askNext(fromIndex + 1);
    },
    [askNext, finish],
  );

  const onCorrect = useCallback(
    (anchor: Element | null) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || !map || qs.phase === 'done') return;
      const region = map.byId.get(qs.target)!;
      const ms = Math.max(0, performance.now() - cur.shownAt);
      const firstTry = qs.misses === 0;
      const s = cur.stats;
      const combo = firstTry ? s.combo + 1 : 0;
      const pts = answerPoints({ mode, prior: region.prior, ms, misses: qs.misses, comboMult: comboMultiplier(combo) });
      if (pts > 0) {
        rewards.addPoints('maps', pts, 'answer', region.label);
        burstRef.current?.burst(pts, (anchor as HTMLElement | null) ?? promptRef.current);
        checkGoalAndAnnounce();
      }
      if (firstTry) {
        store.update((m) =>
          applyMastery(m, { factId: masteryId(stage.map, qs.target), correct: true, ms, tier: mode === 'name' && speedTier(ms, speed) === 'fast' ? 'ok' : speedTier(ms, speed) }, Date.now()),
        );
      }
      cur.missed.delete(qs.target);
      sfx.play('correct');
      if (firstTry && (combo === 5 || combo === 10)) {
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
      });
      setMarks({ [qs.target]: 'correct' });
      setLabels([{ id: qs.target, text: region.label, tone: 'good' }]);
      setQ({ ...qs, phase: 'done' });
      later(firstTry ? 850 : 1000, () => advance(qs.index));
    },
    [map, mode, stage, speed, store, later, advance],
  );

  const onMiss = useCallback(
    (wrongId: string | null, anchor: Element | null) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || !map) return;
      const region = map.byId.get(qs.target)!;
      const s = cur.stats;
      const penalty = missPenalty(s.points);
      if (penalty > 0) {
        rewards.addPoints('maps', -penalty, 'answer', `Miss: ${region.label}`);
        burstRef.current?.burst(-penalty, (anchor as HTMLElement | null) ?? promptRef.current);
      }
      sfx.play('wrong');
      const misses = qs.misses + 1;
      if (misses === 1) {
        store.update((m) => applyMastery(m, { factId: masteryId(stage.map, qs.target), correct: false, ms: 0, tier: 'none' }, Date.now()));
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
      if (wrongId) {
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
        setMarks((mk) => ({ ...mk, [qs.target]: 'reveal' }));
        setLabels((list) => [...list.filter((l) => l.id !== qs.target), { id: qs.target, text: region.label, tone: 'info' }]);
        setQ({ ...qs, misses, phase: 'reveal', wrongChoices: wrongId && mode === 'name' ? [...qs.wrongChoices, wrongId] : qs.wrongChoices });
        if (soundOn()) later(wrongId ? 1100 : 0, () => speak(mode === 'find' ? `Here is ${region.label}. Tap it!` : `It's ${region.label}`));
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
        setQ({ ...qs, misses, phase: 'hint', wrongChoices: wrongId && mode === 'name' ? [...qs.wrongChoices, wrongId] : qs.wrongChoices });
      }
    },
    [map, mode, stage, store, later, flashLabel, advance],
  );

  const onMapTap = useCallback(
    (id: string, el?: Element | null) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || !map || cur.over || mode !== 'find') return;
      const now = performance.now();
      if (qs.phase === 'done' || now < cur.cooldownUntil || now - cur.lastTapAt < 250) return;
      cur.lastTapAt = now;
      sfx.unlock();
      if (id === qs.target) {
        onCorrect(el ?? null);
        return;
      }
      const r = map.byId.get(id);
      if (!r) return;
      if (!active.has(id)) {
        // Not part of this level: just say what it is (no penalty).
        sfx.play('pop', 0.6);
        flashLabel({ id, text: r.label, tone: 'info' }, 1300);
        return;
      }
      if (qs.phase === 'reveal') {
        flashLabel({ id, text: r.label, tone: 'info' }, 1000);
        return;
      }
      if (id === cur.lastWrong) return; // same wrong spot twice = one miss
      cur.lastWrong = id;
      onMiss(id, el ?? null);
    },
    [map, mode, active, onCorrect, onMiss, flashLabel],
  );

  const onChoice = useCallback(
    (id: string, el: HTMLElement) => {
      const cur = R.current;
      const qs = cur.q;
      if (!qs || cur.over || qs.phase === 'done') return;
      const now = performance.now();
      if (now < cur.cooldownUntil || now - cur.lastTapAt < 250) return;
      if (qs.wrongChoices.includes(id)) return;
      cur.lastTapAt = now;
      if (id === qs.target) onCorrect(el);
      else if (qs.phase !== 'reveal') onMiss(null, el);
      if (id !== qs.target && qs.phase !== 'reveal') {
        setQ((cq) => (cq && cq.index === qs.index ? { ...cq, wrongChoices: [...cq.wrongChoices, id] } : cq));
      }
    },
    [onCorrect, onMiss],
  );

  // MapView only reports ids; find the tapped element for the +N burst position.
  const mapTap = useCallback(
    (id: string) => {
      const el = document.querySelector(`.mp-map [data-region="${CSS.escape(id)}"]`);
      onMapTap(id, el);
    },
    [onMapTap],
  );

  // ---- render --------------------------------------------------------------------------------

  const target = q && map ? map.byId.get(q.target) : undefined;
  const hintCircle = useMemo(() => {
    if (!q || !target || mode !== 'find' || q.phase !== 'hint') return null;
    const w = target.bbox[2] - target.bbox[0];
    const h = target.bbox[3] - target.bbox[1];
    const r = Math.max(Math.hypot(w, h) * 0.9, baseView[2] * 0.09);
    // Offset the centre a little so the circle does not point straight at it.
    const cx = (target.bbox[0] + target.bbox[2]) / 2 + r * 0.25 * (q.index % 2 ? 1 : -1);
    const cy = (target.bbox[1] + target.bbox[3]) / 2 + r * 0.2 * (q.index % 3 ? -1 : 1);
    return { x: cx, y: cy, r: r * 1.3 };
  }, [q, target, mode, baseView]);

  const view = useMemo<ViewBox>(
    () => (mode === 'name' && target && map ? zoomTo(target, baseView, map) : baseView),
    [mode, target, map, baseView],
  );

  const title = (
    <>
      <span className="k-emoji">{stage.emoji}</span> {stage.title}
    </>
  );

  if (finished) {
    const s = stats;
    const stars = finished.stars;
    const bonusLines: Array<{ label: string; points: number; emoji?: string }> = [];
    const bo = finished.bonuses;
    if (bo.firstRound) bonusLines.push({ label: 'First round today', points: bo.firstRound, emoji: '🌅' });
    if (bo.newBest) bonusLines.push({ label: 'New record', points: bo.newBest, emoji: '🏆' });
    if (bo.perfect) bonusLines.push({ label: 'Perfect', points: bo.perfect, emoji: '💯' });
    return (
      <div className="k-screen mp-screen" style={{ ['--k-app' as string]: 'var(--k-app-maps)' }}>
        <TopBar onBack={onExit} title={title} points={today} />
        <RoundSummary
          title={stars === 3 ? 'Perfect map!' : stars >= 2 ? 'Great finding!' : stars === 1 ? 'Nice work!' : 'Keep exploring!'}
          emoji={stars === 3 ? '🏆' : '🗺️'}
          pointsEarned={Math.max(0, s.points) + bo.total}
          bonusLines={bonusLines}
          best={finished.best ?? undefined}
          trophies={finished.trophies}
          rankUp={finished.rankUp}
          stats={[
            { label: 'First try', value: `${s.firstTry}/${ROUND_LENGTH}`, emoji: '🎯', highlight: s.firstTry === ROUND_LENGTH },
            { label: 'Misses', value: s.missesTotal, emoji: '❌' },
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
          {s.missedIds.length > 0 && map && (
            <div className="mp-missed" data-testid="missed-list">
              <div className="mp-missed__t">Practice these:</div>
              <div className="mp-missed__chips">
                {s.missedIds.map((id) => (
                  <button
                    type="button"
                    key={id}
                    className="k-chip mp-missed__chip"
                    onClick={() => speak(map.byId.get(id)?.label ?? '')}
                  >
                    <span className="k-emoji">🔊</span> {map.byId.get(id)?.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {finished.unlocked && (
            <button
              type="button"
              className="mp-unlock"
              data-testid="unlocked-stage"
              onClick={() => onPlayStage('find', finished.unlocked!.id)}
            >
              <span className="k-emoji">🔓</span> New level: <b>{finished.unlocked.title}</b> <span className="k-emoji">{finished.unlocked.emoji}</span>
            </button>
          )}
          {finished.nameUnlocked && (
            <button type="button" className="mp-unlock mp-unlock--name" data-testid="unlocked-name" onClick={() => onPlayStage('name', stage.id)}>
              <span className="k-emoji">🏷️</span> <b>Name it!</b> is open for {stage.title}
            </button>
          )}
        </RoundSummary>
      </div>
    );
  }

  const comboMult = comboMultiplier(stats.combo);
  const promptText =
    !q || !target
      ? ''
      : q.phase === 'reveal'
        ? mode === 'find'
          ? 'Here it is! Tap it.'
          : 'This one is…'
        : q.phase === 'hint'
          ? mode === 'find'
            ? 'Look in the circle!'
            : 'Try again!'
          : mode === 'find'
            ? 'Find'
            : 'What is this?';

  return (
    <div
      className={`k-screen mp-screen mp-round mp-round--${mode}`}
      style={{ ['--k-app' as string]: 'var(--k-app-maps)' }}
      data-testid="maps-round"
      data-mode={mode}
      data-stage={stage.id}
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
        comboMultiplier={comboMult}
      />

      <div
        className={`mp-prompt is-${q?.phase ?? 'ask'}`}
        ref={promptRef}
        data-testid="prompt"
        data-target={q?.target ?? ''}
        data-q={q?.index ?? -1}
        data-phase={q?.phase ?? ''}
      >
        <div className="mp-prompt__text">
          <span className="mp-prompt__verb">{promptText}</span>
          {mode === 'find' && target && q?.phase !== 'reveal' && (
            <span className="mp-prompt__name" data-testid="target-name">
              {target.label}
            </span>
          )}
        </div>
        {target && (
          <button
            type="button"
            className="mp-say"
            aria-label="Say it again"
            data-testid="say"
            onClick={() => speak(mode === 'find' || q?.phase === 'reveal' ? `Find ${target.label}` : 'What is this?')}
          >
            <span className="k-emoji">🔊</span>
          </button>
        )}
        <div className="mp-round-pts k-num" data-testid="round-points" aria-label="Points this round">
          <span className="k-emoji">⭐</span> {Math.max(0, stats.points)}
        </div>
      </div>

      <main className="mp-stage">
        {map ? (
          <MapView
            map={map}
            view={view}
            inset={mode === 'find' ? stage.inset : undefined}
            portrait={mode === 'find' ? stage.portrait : undefined}
            active={active}
            marks={marks}
            labels={labels}
            hintCircle={hintCircle}
            onTap={mapTap}
            disabled={mode !== 'find'}
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

      {mode === 'name' && q && map && (
        <div className="mp-choices" data-testid="choices">
          {q.choices.map((id) => {
            const r = map.byId.get(id);
            const wrong = q.wrongChoices.includes(id);
            const isAnswer = id === q.target;
            const cls = wrong ? ' is-wrong' : isAnswer && (q.phase === 'reveal' || q.phase === 'done') ? ' is-right' : '';
            return (
              <button
                type="button"
                key={`${q.index}-${id}`}
                className={`mp-choice${cls}`}
                data-choice={id}
                disabled={wrong}
                onClick={(e) => onChoice(id, e.currentTarget)}
              >
                {r?.label}
              </button>
            );
          })}
        </div>
      )}
      <PointsBurst ref={burstRef} />
    </div>
  );
}
