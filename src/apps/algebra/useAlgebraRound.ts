/**
 * One Quick Algebra set (10 problems): ready → running ⇄ cooldown(hint) → solution → finished.
 *
 * Rules (docs/DESIGN.md §1.6):
 *  - first try right → full points (speed + combo on timed levels, streak on paper levels);
 *  - first miss → combo reset, hint, 2 s cooldown; second try right → small points;
 *  - second miss → worked solution line by line, 0 points, then Next.
 * Side effects live in the action functions (never in renders), as in src/drill.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { awardTrophy, checkGoalAndAnnounce, checkLifetimeTrophies, rewards, sfx } from '../../core';
import type { RankInfo, TrophyId } from '../../core';
import { applyMastery, masteryStore, pickNextFact } from '../../drill';
import type { AnswerVia } from '../../drill';
import { matchNumberHypothesis, recordVoiceVerdict } from '../../voice';
import type { NumberMatchResult, VoiceHypothesis } from '../../voice';
import { MAX_ANSWER, QUESTIONS_PER_SET, levelDef, makeProblem, templateFacts } from './problems';
import type { LevelId, Problem } from './problems';
import { PERFECT_BONUS, RECORD_BONUS, pointsFor, secondTryPoints } from './scoring';
import { recordSet } from './progress';

export type AlgebraStatus = 'ready' | 'running' | 'cooldown' | 'correct' | 'solution' | 'finished';

export interface AlgebraAnswer {
  problem: Problem;
  /** 1 = right first try, 2 = right after the hint, 0 = missed twice. */
  solvedOn: 0 | 1 | 2;
  points: number;
  ms: number;
  via: AnswerVia | null;
}

export interface AlgebraRoundState {
  status: AlgebraStatus;
  level: LevelId;
  problem: Problem | null;
  index: number;
  input: string;
  attempt: 1 | 2;
  /** Last wrong value (shown struck through). */
  given: number | null;
  givenVia: AnswerVia | null;
  combo: number;
  bestCombo: number;
  points: number;
  answers: AlgebraAnswer[];
  elapsedMs: number;
  cooldownUntil: number | null;
  /** Last answer's multiplier (combo/streak) for the little badge. */
  lastMult: number;
  heard: string | null;
  unclear: boolean;
  pendingPartial: string | null;
  /** Bumps on every wrong (drives the shake). */
  nudge: number;
  // round end
  endReason: 'complete' | 'quit' | null;
  bonusLines: Array<{ label: string; points: number; emoji?: string }>;
  best: { value: number; previous: number | null; isNewBest: boolean; kind: 'time' | 'streak' } | null;
  trophies: TrophyId[];
  rankUp: RankInfo | null;
  unlocked: LevelId | null;
}

const COOLDOWN_MS = 2000;
const HOLD_MS = 900;
const UNCLEAR_MS = 1500;
const PARTIAL_MS = 1500;

export function bestKeyFor(level: LevelId): string {
  return levelDef(level).paper ? `algebra:streak:L${level}` : `algebra:set10:L${level}`;
}

function initialState(level: LevelId): AlgebraRoundState {
  return {
    status: 'ready',
    level,
    problem: null,
    index: 0,
    input: '',
    attempt: 1,
    given: null,
    givenVia: null,
    combo: 0,
    bestCombo: 0,
    points: 0,
    answers: [],
    elapsedMs: 0,
    cooldownUntil: null,
    lastMult: 1,
    heard: null,
    unclear: false,
    pendingPartial: null,
    nudge: 0,
    endReason: null,
    bonusLines: [],
    best: null,
    trophies: [],
    rankUp: null,
    unlocked: null,
  };
}

export interface AlgebraRoundCallbacks {
  onCorrect?: (points: number) => void;
  onWrong?: () => void;
}

export function useAlgebraRound(level: LevelId, cb: AlgebraRoundCallbacks = {}) {
  const def = levelDef(level);
  const store = masteryStore('algebra');
  const [state, setState] = useState<AlgebraRoundState>(() => initialState(level));
  const sRef = useRef(state);
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });

  const R = useRef({
    startAt: 0,
    shownAt: 0,
    hiddenAt: 0,
    recent: [] as string[],
    sessionWrong: {} as Record<string, number>,
    sessionRecovered: {} as Record<string, number>,
    comeback: [] as Array<{ factId: string; dueAt: number }>,
    rankBefore: 0,
    acceptedUtterance: null as number | null,
    mounted: true,
    timers: {} as Record<string, ReturnType<typeof setTimeout> | undefined>,
    interval: null as ReturnType<typeof setInterval> | null,
  });

  const commit = useCallback((patch: Partial<AlgebraRoundState>) => {
    sRef.current = { ...sRef.current, ...patch };
    if (R.current.mounted) setState(sRef.current);
  }, []);

  const clearT = (k: string) => {
    const t = R.current.timers[k];
    if (t) clearTimeout(t);
    R.current.timers[k] = undefined;
  };
  const setT = (k: string, fn: () => void, ms: number) => {
    clearT(k);
    R.current.timers[k] = setTimeout(() => {
      R.current.timers[k] = undefined;
      fn();
    }, ms);
  };
  const clearAll = () => {
    Object.keys(R.current.timers).forEach(clearT);
    if (R.current.interval) clearInterval(R.current.interval);
    R.current.interval = null;
  };

  const facts = useMemo(() => templateFacts(level), [level]);

  const pick = (q: number): Problem => {
    const r = R.current;
    const res = pickNextFact({
      facts,
      mastery: store.get(),
      speed: def.speed,
      recent: r.recent,
      sessionWrong: r.sessionWrong,
      sessionRecovered: r.sessionRecovered,
      comeback: r.comeback,
      questionIndex: q,
    });
    if (res.viaComeback) r.comeback = r.comeback.filter((c) => c.factId !== res.fact.id);
    r.recent = [...r.recent, res.fact.id].slice(-6);
    // Never the exact same equation twice in a row.
    const prev = sRef.current.problem?.eq;
    let p = makeProblem(res.fact.id);
    for (let i = 0; i < 5 && p.eq === prev; i++) p = makeProblem(res.fact.id);
    return p;
  };

  const mastery = (p: Problem, correct: boolean, ms: number, tier: 'fast' | 'ok' | 'slow' | 'none') => {
    store.set(applyMastery(store.get(), { factId: p.templateId, correct, ms, tier }, Date.now()));
  };

  // ---- flow ------------------------------------------------------------------------------

  const finish = (reason: 'complete' | 'quit') => {
    const s = sRef.current;
    if (s.status === 'finished' || s.status === 'ready') return;
    clearAll();
    const elapsedMs = performance.now() - R.current.startAt;
    store.flush();
    if (reason === 'quit') {
      commit({ status: 'finished', endReason: 'quit', elapsedMs, cooldownUntil: null });
      if (s.answers.length) sfx.play('roundEnd');
      return;
    }
    const firstTry = s.answers.filter((a) => a.solvedOn === 1).length;
    const n = s.answers.length;
    const bonusLines: AlgebraRoundState['bonusLines'] = [];
    let best: AlgebraRoundState['best'] = null;

    if (def.paper) {
      const prev = rewards.getBest(bestKeyFor(level));
      if (s.bestCombo > 0) {
        const b = rewards.recordBest(bestKeyFor(level), s.bestCombo, true);
        best = { value: s.bestCombo, previous: b.previous, isNewBest: b.isNewBest, kind: 'streak' };
      } else best = { value: 0, previous: prev, isNewBest: false, kind: 'streak' };
    } else {
      const v = Math.round(elapsedMs);
      const prev = rewards.getBest(bestKeyFor(level));
      if (firstTry === n && n >= QUESTIONS_PER_SET) {
        const b = rewards.recordBest(bestKeyFor(level), v, false);
        best = { value: v, previous: b.previous, isNewBest: b.isNewBest, kind: 'time' };
        if (b.isNewBest && b.previous !== null) bonusLines.push({ label: 'New record', points: RECORD_BONUS, emoji: '🏆' });
      } else best = { value: v, previous: prev, isNewBest: false, kind: 'time' };
    }
    if (n >= QUESTIONS_PER_SET && firstTry === n) bonusLines.push({ label: 'Perfect', points: PERFECT_BONUS, emoji: '💯' });
    if (n >= QUESTIONS_PER_SET && firstTry >= 8 && rewards.claimFirstRound('algebra')) bonusLines.push({ label: 'First round today', points: 50, emoji: '🌅' });
    const bonus = bonusLines.reduce((a, b) => a + b.points, 0);
    if (bonus > 0) rewards.addPoints('algebra', bonus, 'bonus', `Algebra L${level} bonus`);

    const got: TrophyId[] = [];
    const tryT = (id: TrophyId, cond: boolean) => {
      if (cond && awardTrophy(id, { quiet: true })) got.push(id);
    };
    tryT('first-round', n > 0);
    tryT('combo-10', s.bestCombo >= 10);
    got.push(...checkLifetimeTrophies(true));
    got.push(...checkGoalAndAnnounce());
    const rankNow = rewards.rank();
    const rankUp = rankNow.index > R.current.rankBefore ? rankNow : null;
    const unlocked = n >= QUESTIONS_PER_SET ? recordSet(level, firstTry) : null;

    if ((best?.isNewBest && best.previous !== null) || rankUp || unlocked) sfx.play('pb');
    else sfx.play('roundEnd');
    if (got.length) setTimeout(() => sfx.play('trophy'), 700);

    commit({
      status: 'finished',
      endReason: 'complete',
      elapsedMs,
      cooldownUntil: null,
      bonusLines,
      best,
      trophies: got,
      rankUp,
      unlocked,
      points: s.points + bonus,
    });
  };

  const showProblem = (index: number) => {
    const p = pick(index);
    R.current.shownAt = performance.now();
    R.current.acceptedUtterance = null;
    commit({
      status: 'running',
      problem: p,
      index,
      input: '',
      attempt: 1,
      given: null,
      givenVia: null,
      cooldownUntil: null,
      heard: null,
      unclear: false,
      pendingPartial: null,
    });
  };

  const next = () => {
    clearT('advance');
    const s = sRef.current;
    if (s.status === 'finished' || s.status === 'ready') return;
    if (s.answers.length >= QUESTIONS_PER_SET) {
      finish('complete');
      return;
    }
    showProblem(s.index + 1);
  };

  const judgeCorrect = (via: AnswerVia) => {
    const s = sRef.current;
    const p = s.problem;
    if (!p || s.status !== 'running') return;
    clearT('hold');
    const ms = Math.max(0, performance.now() - R.current.shownAt);
    let points: number;
    let combo = s.combo;
    let mult = 1;
    if (s.attempt === 1) {
      combo = s.combo + 1;
      const sc = pointsFor({ level: def, ms, combo });
      points = sc.points;
      mult = sc.mult;
      mastery(p, true, ms, sc.tier);
      if (R.current.sessionWrong[p.templateId]) R.current.sessionRecovered[p.templateId] = (R.current.sessionRecovered[p.templateId] ?? 0) + 1;
    } else {
      points = secondTryPoints(def);
    }
    rewards.addPoints('algebra', points, 'answer', p.text);
    sfx.play('correct');
    if (combo > 0 && combo % 5 === 0 && s.attempt === 1) setTimeout(() => sfx.play('combo'), 150);
    const ans: AlgebraAnswer = { problem: p, solvedOn: s.attempt, points, ms: Math.round(ms), via };
    commit({
      status: 'correct',
      input: String(p.answer),
      combo,
      bestCombo: Math.max(s.bestCombo, combo),
      points: s.points + points,
      answers: [...s.answers, ans],
      lastMult: mult,
      cooldownUntil: null,
      pendingPartial: null,
    });
    cbRef.current.onCorrect?.(points);
    checkGoalAndAnnounce();
    setT('advance', next, def.paper ? 1100 : 750);
  };

  const judgeWrong = (given: number, via: AnswerVia) => {
    const s = sRef.current;
    const p = s.problem;
    if (!p || s.status !== 'running') return;
    clearT('hold');
    const ms = Math.max(0, performance.now() - R.current.shownAt);
    cbRef.current.onWrong?.();
    if (s.attempt === 1) {
      sfx.play('wrong');
      mastery(p, false, ms, 'none');
      R.current.sessionWrong[p.templateId] = (R.current.sessionWrong[p.templateId] ?? 0) + 1;
      R.current.sessionRecovered[p.templateId] = 0;
      if (!R.current.comeback.some((c) => c.factId === p.templateId)) R.current.comeback.push({ factId: p.templateId, dueAt: s.index + 3 });
      const until = performance.now() + COOLDOWN_MS;
      commit({ status: 'cooldown', attempt: 2, input: '', given, givenVia: via, combo: 0, cooldownUntil: until, nudge: s.nudge + 1, pendingPartial: null });
      setT('cooldown', () => {
        if (sRef.current.status === 'cooldown') commit({ status: 'running', cooldownUntil: null });
      }, COOLDOWN_MS);
    } else {
      sfx.play('wrong', 0.6);
      const ans: AlgebraAnswer = { problem: p, solvedOn: 0, points: 0, ms: Math.round(ms), via };
      commit({ status: 'solution', input: '', given, givenVia: via, combo: 0, answers: [...s.answers, ans], nudge: s.nudge + 1, pendingPartial: null });
    }
  };

  const start = () => {
    clearAll();
    const r = R.current;
    r.recent = [];
    r.sessionWrong = {};
    r.sessionRecovered = {};
    r.comeback = [];
    r.rankBefore = rewards.rank().index;
    r.startAt = performance.now();
    sRef.current = { ...initialState(level), status: 'running' };
    showProblem(0);
    r.interval = setInterval(() => {
      const s = sRef.current;
      if (s.status === 'finished' || s.status === 'ready' || document.visibilityState === 'hidden') return;
      commit({ elapsedMs: performance.now() - R.current.startAt });
    }, 200);
  };

  const typeDigit = (d: string, via: AnswerVia = 'keypad') => {
    const s = sRef.current;
    const p = s.problem;
    if (!p) return;
    if (s.status === 'solution') return;
    if (s.status !== 'running') return;
    const ans = String(p.answer);
    if (s.input === '' && d === '0' && p.answer !== 0) return; // a leading 0 is never right
    if (s.input.length >= 3) return;
    clearT('hold');
    const nextIn = s.input === '0' ? d : s.input + d;
    commit({ input: nextIn });
    if (nextIn === ans) {
      judgeCorrect(via);
      return;
    }
    if (ans.startsWith(nextIn)) return; // on the way to the right answer
    // As in the drills: once as many digits as the answer are typed and it isn't the answer, it's wrong.
    if (nextIn.length >= ans.length) {
      judgeWrong(Number(nextIn), via);
      return;
    }
    // Shorter than the answer but already off track: give him a moment, then judge it.
    setT(
      'hold',
      () => {
        const cur = sRef.current;
        if (cur.status === 'running' && cur.input) judgeWrong(Number(cur.input), via);
      },
      HOLD_MS,
    );
  };

  /** Erasing digits that can no longer become the answer is a guess, not a typo fix: judge it. */
  const guessedWrong = (): boolean => {
    // A quick fix of a mis-tap (⌫ while the wrong digit is still waiting to be judged) is free:
    // nothing on screen has said right or wrong yet, so it leaks nothing.
    if (R.current.timers.hold) return false;
    const s = sRef.current;
    if (!s.problem || !s.input) return false;
    if (String(s.problem.answer).startsWith(s.input)) return false;
    judgeWrong(Number(s.input), 'keypad');
    return true;
  };

  const backspace = () => {
    const s = sRef.current;
    if (s.status !== 'running') return;
    if (guessedWrong()) return;
    clearT('hold');
    if (s.input) commit({ input: s.input.slice(0, -1) });
  };

  const clear = () => {
    if (sRef.current.status !== 'running') return;
    if (guessedWrong()) return;
    clearT('hold');
    commit({ input: '' });
  };

  /** ✓ / Enter: judge what is typed; on the solution card it means "Next". */
  const submit = () => {
    const s = sRef.current;
    if (s.status === 'solution') {
      next();
      return;
    }
    if (s.status !== 'running' || !s.problem || !s.input) return;
    if (s.input === String(s.problem.answer)) judgeCorrect('keyboard');
    else judgeWrong(Number(s.input), 'keyboard');
  };

  const onVoiceTranscript = (hyp: VoiceHypothesis) => {
    const s = sRef.current;
    const p = s.problem;
    if (!p || (s.status !== 'running' && s.status !== 'cooldown')) return;
    if (R.current.acceptedUtterance !== null && hyp.utteranceId === R.current.acceptedUtterance) return;
    const prefix = s.pendingPartial ? `${s.pendingPartial} ` : '';
    const text = (hyp.text ?? '').trim();
    if (!text && !hyp.alternatives?.length) return;
    const merged: VoiceHypothesis = { ...hyp, text: prefix + text, alternatives: hyp.alternatives?.filter(Boolean).map((t) => prefix + t) };
    let res: NumberMatchResult;
    try {
      res = matchNumberHypothesis(merged, { expected: p.answer, maxPlausible: MAX_ANSWER, operands: p.operands, minConfidence: 0.5 });
    } catch {
      res = { verdict: 'unclear', candidates: [], normalized: merged.text };
    }
    if (hyp.isFinal) {
      try {
        recordVoiceVerdict(hyp.utteranceId, res.verdict);
      } catch {
        /* diagnostics only */
      }
    }
    // During the hint cooldown only show what was heard.
    if (s.status === 'cooldown') {
      commit({ heard: merged.text });
      return;
    }
    if (res.verdict === 'correct') {
      clearT('partial');
      clearT('unclear');
      R.current.acceptedUtterance = hyp.utteranceId;
      commit({ heard: merged.text, unclear: false, pendingPartial: null, input: String(p.answer) });
      judgeCorrect('voice');
      return;
    }
    if (!hyp.isFinal) {
      commit({ heard: merged.text });
      return;
    }
    clearT('partial');
    if (res.verdict === 'wrong' && res.heard !== undefined) {
      commit({ heard: merged.text, pendingPartial: null });
      judgeWrong(res.heard, 'voice');
      return;
    }
    commit({ heard: merged.text, unclear: true, pendingPartial: res.partial ? merged.text : null });
    setT('unclear', () => commit({ unclear: false }), UNCLEAR_MS);
    if (res.partial) setT('partial', () => commit({ pendingPartial: null }), PARTIAL_MS);
  };

  const end = () => finish('quit');
  const reset = () => {
    clearAll();
    sRef.current = initialState(level);
    setState(sRef.current);
  };

  // Backgrounded: the clock stops (timed levels must not punish an iPad nap).
  useEffect(() => {
    const onVis = () => {
      const r = R.current;
      if (document.visibilityState === 'hidden') r.hiddenAt = performance.now();
      else if (r.hiddenAt) {
        const dt = performance.now() - r.hiddenAt;
        r.startAt += dt;
        r.shownAt += dt;
        r.hiddenAt = 0;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const r = R.current;
    r.mounted = true;
    return () => {
      r.mounted = false;
      Object.values(r.timers).forEach((t) => t && clearTimeout(t));
      if (r.interval) clearInterval(r.interval);
      store.flush();
    };
  }, [store]);

  const actions = { start, typeDigit, backspace, clear, submit, onVoiceTranscript, end, reset, next };
  const ref = useRef(actions);
  useEffect(() => {
    ref.current = actions;
  });
  const stable = useMemo(
    () => ({
      start: () => ref.current.start(),
      typeDigit: (d: string, via?: AnswerVia) => ref.current.typeDigit(d, via),
      backspace: () => ref.current.backspace(),
      clear: () => ref.current.clear(),
      submit: () => ref.current.submit(),
      onVoiceTranscript: (h: VoiceHypothesis) => ref.current.onVoiceTranscript(h),
      end: () => ref.current.end(),
      reset: () => ref.current.reset(),
      next: () => ref.current.next(),
    }),
    [],
  );
  return { state, def, ...stable };
}
