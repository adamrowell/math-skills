/**
 * The fast-facts round state machine (docs/DESIGN.md §1.0.2, §1.0.3, §3.5):
 * ready → running ⇄ retype → finished, with pause on backgrounding.
 * Side effects (points, sounds, mastery) happen in the action functions, never in renders,
 * so StrictMode double-invocation is harmless.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  awardTrophy,
  checkGoalAndAnnounce,
  checkLifetimeTrophies,
  getSettings,
  rewards,
  sfx,
  softCapFactor,
  toast,
} from '../core';
import type { RankInfo, TrophyId } from '../core';
import { matchNumberHypothesis, recordCorrection, recordVoiceVerdict } from '../voice';
import type { NumberMatchResult, VoiceHypothesis } from '../voice';
import type {
  AnswerEvent,
  AnswerVia,
  Fact,
  MasteryState,
  RoundState,
  ScoreResult,
  UseDrillRound,
  UseDrillRoundOptions,
} from './types';
import { applyMastery } from './mastery';
import { masteryStore } from './masteryStore';
import { pickNextFact } from './scheduler';
import { comboMilestone, isRealRound, roundBonuses, scoreAnswer } from './scoring';
import { bestKey } from './formats';
import { randInt } from './util';
import { addDigit, couldGrowTyped, layoutFor, onTrack, removeDigit, workbookColumns } from './columns';
import type { EntryOrder } from './columns';

/** Round timer tick, and the tick gap that counts as a frozen page. */
const TICK_MS = 100;
const STALL_MS = 2500;

/**
 * Entry order for a fact: workbook problems fill ones-first (right to left, like on paper)
 * unless Grown-ups → Settings says left to right (`settings.workbookEntry`, UX-V3 §5.2).
 */
export function entryOrderFor(fact: Fact | null | undefined, pref?: unknown): EntryOrder {
  if (layoutFor(fact) !== 'workbook') return 'ltr';
  let p = pref;
  if (p === undefined) {
    try {
      p = (getSettings() as unknown as { workbookEntry?: unknown }).workbookEntry;
    } catch {
      p = undefined;
    }
  }
  return p === 'ltr' ? 'ltr' : 'ones';
}

export interface DrillRoundExtras {
  /** Trophies unlocked at round end. */
  trophies: TrophyId[];
  rankUp: RankInfo | null;
  /** Facts that moved up a Leitner box this round. */
  movers: string[];
  fastCount: number;
  fastestMs: number | null;
  /** Increments whenever the retype is wrong again (drives the shake). */
  nudge: number;
  /** Voice result that was not accepted ('unclear'), shown as "?" bubble. */
  unclear: boolean;
  lastScore: ScoreResult | null;
  /** performance.now() deadline for the retype auto-advance. */
  retypeUntil: number | null;
  /** Combo milestone banner (bumps `id` each time). */
  milestone: { id: number; text: string } | null;
}

export interface UseDrillRoundOptionsExt extends UseDrillRoundOptions {
  onCorrect?: (ev: AnswerEvent, score: ScoreResult) => void;
  onWrong?: (ev: AnswerEvent) => void;
}

export interface UseDrillRoundExt extends UseDrillRound {
  extras: DrillRoundExtras;
}

const RETYPE_MS = 6000;
/**
 * A wrong-looking entry that could still grow into another plausible number ("1" → 12 when
 * the answer is 6) waits this long for the next digit before it is judged, so the retype card
 * says "Not 12", not "Not 1". Correct answers are never delayed.
 */
export const HOLD_MS = 700;
/**
 * A wrong entry shorter than the answer ("9" when the answer is 56, "96" when it is 108) is
 * judged after this much idle time, so there is never a dead end without a ✓ key. Backspace
 * within the window lets him fix a slip.
 */
export const IDLE_MS = 1600;
const PARTIAL_MS = 1500;
const UNCLEAR_MS = 1500;

const EMPTY_EXTRAS: DrillRoundExtras = {
  trophies: [],
  rankUp: null,
  movers: [],
  fastCount: 0,
  fastestMs: null,
  nudge: 0,
  unclear: false,
  lastScore: null,
  retypeUntil: null,
  milestone: null,
};

export function useDrillRound(options: UseDrillRoundOptionsExt): UseDrillRoundExt {
  const { generator, format, setId } = options;
  const appId = generator.appId;
  const store = masteryStore(appId);

  const initial = useCallback(
    (): RoundState => ({
      status: 'ready',
      config: { appId, format, setId },
      current: null,
      input: '',
      questionIndex: 0,
      elapsedMs: 0,
      remainingMs: format.durationMs ?? null,
      answered: [],
      correctCount: 0,
      wrongCount: 0,
      combo: 0,
      bestCombo: 0,
      points: 0,
      pointsMult: generator.sets().find((x) => x.id === setId)?.pointsMult ?? 1,
      lastVerdict: null,
      heard: null,
      pendingPartial: null,
      bonuses: null,
      best: null,
      endReason: null,
    }),
    [appId, format, setId, generator],
  );

  const [state, setState] = useState<RoundState>(initial);
  const [extras, setExtras] = useState<DrillRoundExtras>(EMPTY_EXTRAS);
  const sRef = useRef<RoundState>(state);
  const xRef = useRef<DrillRoundExtras>(extras);
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  // Mutable round internals.
  const r = useRef({
    facts: [] as Fact[],
    recent: [] as string[],
    sessionWrong: {} as Record<string, number>,
    sessionRecovered: {} as Record<string, number>,
    comeback: [] as Array<{ factId: string; dueAt: number }>,
    startBoxes: {} as Record<string, number>,
    rankBefore: 0,
    /** "Try another app" toast already shown this round. */
    capToasted: false,
    startAt: 0,
    shownAt: 0,
    pausedAt: 0,
    /** Last timer tick; a long gap means the page was frozen (iOS sheet, busy main thread). */
    lastTickAt: 0,
    resumeTo: 'running' as 'running' | 'retype',
    pendingAdvance: false,
    locked: false,
    lastTickSec: -1,
    /** Unclear voice texts this question; `learn` = safe to learn as an alias (no number was heard). */
    unclearTexts: [] as { text: string; learn: boolean }[],
    /** Voice utterance that was just accepted: its late finals must not be judged again. */
    acceptedUtterance: null as number | null,
    timers: {
      interval: null as ReturnType<typeof setInterval> | null,
      advance: null as ReturnType<typeof setTimeout> | null,
      retype: null as ReturnType<typeof setTimeout> | null,
      partial: null as ReturnType<typeof setTimeout> | null,
      unclear: null as ReturnType<typeof setTimeout> | null,
      hold: null as ReturnType<typeof setTimeout> | null,
    },
    mounted: true,
  });

  const commit = useCallback((patch: Partial<RoundState>) => {
    sRef.current = { ...sRef.current, ...patch };
    if (r.current.mounted) setState(sRef.current);
  }, []);
  const commitX = useCallback((patch: Partial<DrillRoundExtras>) => {
    xRef.current = { ...xRef.current, ...patch };
    if (r.current.mounted) setExtras(xRef.current);
  }, []);

  const clearTimer = (k: keyof typeof r.current.timers) => {
    const t = r.current.timers[k];
    if (t) {
      if (k === 'interval') clearInterval(t as ReturnType<typeof setInterval>);
      else clearTimeout(t as ReturnType<typeof setTimeout>);
      r.current.timers[k] = null;
    }
  };
  const clearAll = () => (Object.keys(r.current.timers) as Array<keyof typeof r.current.timers>).forEach(clearTimer);

  const elapsedNow = () => performance.now() - r.current.startAt;

  const pick = (qIndex: number): Fact => {
    const R = r.current;
    const res = pickNextFact({
      facts: R.facts,
      mastery: store.get(),
      speed: generator.speed,
      recent: R.recent,
      sessionWrong: R.sessionWrong,
      sessionRecovered: R.sessionRecovered,
      comeback: R.comeback,
      questionIndex: qIndex,
    });
    if (res.viaComeback) R.comeback = R.comeback.filter((c) => c.factId !== res.fact.id);
    R.recent = [...R.recent, res.fact.id].slice(-12);
    return generator.instantiate ? generator.instantiate(res.fact, Math.random) : res.fact;
  };

  // ---- finishing -------------------------------------------------------------------------

  const finish = (reason: 'complete' | 'quit') => {
    const s = sRef.current;
    if (s.status === 'finished' || s.status === 'ready') return;
    clearAll();
    const R = r.current;
    R.locked = true;
    const elapsedMs = s.status === 'paused' ? R.pausedAt - R.startAt : elapsedNow();
    const remainingMs = format.durationMs ? Math.max(0, format.durationMs - elapsedMs) : null;
    const answeredN = s.answered.length;
    const correct = s.correctCount;

    if (reason === 'quit') {
      // Stopped early: points already earned stay; no records, bonuses or trophies.
      commitX({ retypeUntil: null, milestone: null });
      commit({
        status: 'finished',
        elapsedMs,
        remainingMs,
        endReason: 'quit',
        lastVerdict: null,
        bonuses: null,
        best: null,
      });
      store.flush();
      if (answeredN > 0) sfx.play('roundEnd');
      return;
    }

    // Personal best. Only honest rounds count: a Race needs every answer right (mashing a
    // wrong answer and copying the retype card is never a "record"); a Sprint best is the
    // number right, which guessing cannot raise.
    let best: RoundState['best'] = null;
    let realImprovement = false;
    if (format.bestMetric !== 'none') {
      const key = bestKey(appId, format.id, setId);
      const previous = rewards.getBest(key);
      if (format.bestMetric === 'correctCount') {
        const eligible = correct > 0;
        if (eligible) {
          const b = rewards.recordBest(key, correct, true);
          best = {
            key,
            value: correct,
            isNewBest: b.isNewBest,
            previous: b.previous,
            eligible,
          };
        } else {
          best = { key, value: 0, isNewBest: false, previous, eligible };
        }
      } else {
        const v = Math.round(elapsedMs);
        const eligible = answeredN >= (format.questionCount ?? 1) && s.wrongCount === 0;
        if (eligible) {
          const b = rewards.recordBest(key, v, false);
          best = {
            key,
            value: v,
            isNewBest: b.isNewBest,
            previous: b.previous,
            eligible,
          };
        } else {
          best = { key, value: v, isNewBest: false, previous, eligible };
        }
      }
      // The +50 is for beating a real previous best, in a real round (the first round of a set
      // just sets the baseline quietly).
      realImprovement = Boolean(best?.isNewBest && best.previous !== null && isRealRound(answeredN, correct));
    }

    const setDesc = generator.sets().find((x) => x.id === setId);
    const firstRound =
      Boolean(setDesc?.bonusEligible) && isRealRound(answeredN, correct) && rewards.claimFirstRound(appId);
    const bonuses = roundBonuses({
      newBest: realImprovement,
      answered: answeredN,
      correct,
      firstRound,
    });
    if (bonuses.total > 0) rewards.addPoints(appId, bonuses.total, 'bonus', 'Round bonus');

    // Trophies (shown on the summary card, so quiet).
    const got: TrophyId[] = [];
    const tryT = (id: TrophyId, cond: boolean) => {
      if (cond && awardTrophy(id, { quiet: true })) got.push(id);
    };
    const acc = answeredN ? correct / answeredN : 0;
    tryT('first-round', answeredN > 0);
    tryT('combo-10', s.bestCombo >= 10);
    tryT('combo-25', s.bestCombo >= 25);
    tryT('combo-50', s.bestCombo >= 50);
    tryT('speed-demon', xRef.current.fastCount >= 10);
    tryT('sharp-shooter', answeredN >= 20 && acc >= 0.95);
    tryT('perfect-20', answeredN >= 20 && s.wrongCount === 0);
    const grid = generator.grid;
    const m = store.get();
    if (grid) {
      const boxAt = (rr: number, cc: number) => {
        const id = grid.cellFactId(rr, cc);
        return id ? (m.facts[id]?.box ?? 0) : 5;
      };
      tryT(
        'table-tamer',
        grid.rows.some((rr) => rr >= 2 && grid.cols.every((cc) => boxAt(rr, cc) >= 4)),
      );
      tryT(
        'grid-master',
        grid.rows.every((rr) => grid.cols.every((cc) => boxAt(rr, cc) >= 5)),
      );
    }
    got.push(...checkLifetimeTrophies(true));
    got.push(...checkGoalAndAnnounce());

    const rankNow = rewards.rank();
    const rankUp = rankNow.index > R.rankBefore ? rankNow : null;

    const movers = Object.keys(m.facts).filter((id) => (m.facts[id]?.box ?? 0) > (R.startBoxes[id] ?? 0));

    if ((best?.isNewBest && best.previous !== null) || rankUp) sfx.play('pb');
    else sfx.play('roundEnd');
    if (got.length) setTimeout(() => sfx.play('trophy'), 700);

    commitX({
      trophies: got,
      rankUp,
      movers,
      retypeUntil: null,
      milestone: null,
    });
    commit({
      status: 'finished',
      elapsedMs,
      remainingMs,
      bonuses,
      best,
      points: s.points + bonuses.total,
      lastVerdict: null,
      endReason: 'complete',
    });
    store.flush();
    optsRef.current.onFinished?.(sRef.current);
  };

  // ---- question flow --------------------------------------------------------------------

  const nextQuestion = () => {
    const R = r.current;
    clearTimer('advance');
    clearTimer('retype');
    clearTimer('partial');
    clearTimer('unclear');
    clearTimer('hold');
    R.pendingAdvance = false;
    const s = sRef.current;
    if (s.status === 'finished' || s.status === 'ready') return;
    if (format.questionCount && s.answered.length >= format.questionCount) {
      finish('complete');
      return;
    }
    if (format.durationMs && elapsedNow() >= format.durationMs) {
      finish('complete');
      return;
    }
    const q = s.questionIndex + 1;
    const fact = pick(q);
    R.unclearTexts = [];
    R.locked = false;
    R.shownAt = performance.now();
    commitX({ unclear: false, retypeUntil: null });
    commit({
      status: 'running',
      current: fact,
      questionIndex: q,
      input: '',
      lastVerdict: null,
      heard: null,
      pendingPartial: null,
    });
  };

  const scheduleAdvance = (ms: number) => {
    const R = r.current;
    R.locked = true;
    R.pendingAdvance = true;
    clearTimer('advance');
    R.timers.advance = setTimeout(nextQuestion, ms);
  };

  const updateMastery = (fact: Fact, correct: boolean, ms: number, tier: ScoreResult['tier']) => {
    const now = Date.now();
    let m: MasteryState = applyMastery(store.get(), { factId: fact.id, correct, ms, tier }, now);
    if (fact.mirrorId) m = applyMastery(m, { factId: fact.mirrorId, correct, ms, tier, mirror: true }, now);
    store.set(m);
  };

  const judgeCorrect = (via: AnswerVia) => {
    const R = r.current;
    const s = sRef.current;
    const fact = s.current;
    if (!fact || R.locked || s.status !== 'running') return;
    const ms = Math.max(0, performance.now() - R.shownAt);
    const combo = s.combo + 1;
    clearTimer('hold');
    // Lots of points from this app today already: half pay, and a nudge to try another app.
    const cap = softCapFactor(appId);
    if (cap < 1 && !R.capToasted) {
      R.capToasted = true;
      toast.show('Try another app for full points!', {
        emoji: '🌈',
        kind: 'info',
        durationMs: 3000,
      });
    }
    const score = scoreAnswer({
      fact,
      ms,
      combo,
      attempt: 1,
      speed: generator.speed,
      pointsMult: s.pointsMult * cap,
      box: store.get().facts[fact.id]?.box,
    });
    rewards.addPoints(appId, score.points, 'answer', fact.prompt);
    updateMastery(fact, true, ms, score.tier);
    if (R.sessionWrong[fact.id]) R.sessionRecovered[fact.id] = (R.sessionRecovered[fact.id] ?? 0) + 1;

    // Adaptation: an unclear voice transcript followed by a typed correct answer.
    if (via !== 'voice' && R.unclearTexts.length) {
      try {
        // Always adapt the acceptance margin; only learn an alias from text in which no
        // number was heard (never "fifty" → 56, never an echo of the question).
        const last = R.unclearTexts[R.unclearTexts.length - 1];
        recordCorrection(last.learn ? last.text : '', fact.answer);
      } catch {
        /* voice module optional */
      }
    }

    const ev: AnswerEvent = {
      factId: fact.id,
      prompt: fact.prompt,
      answer: fact.answer,
      correct: true,
      ms: Math.round(ms),
      attempt: 1,
      via,
      points: score.points,
      combo,
      tier: score.tier,
    };

    sfx.play('correct');
    const milestone = comboMilestone(combo);
    const x = xRef.current;
    if (milestone) {
      // A hair later so it does not mask the "correct" blip.
      setTimeout(() => sfx.play('combo'), 150);
    }
    commitX({
      milestone: milestone ? { id: (x.milestone?.id ?? 0) + 1, text: milestone } : x.milestone,
      fastCount: x.fastCount + (score.tier === 'fast' ? 1 : 0),
      fastestMs: x.fastestMs === null ? Math.round(ms) : Math.min(x.fastestMs, Math.round(ms)),
      lastScore: score,
      unclear: false,
    });
    commit({
      input: String(fact.answer),
      combo,
      bestCombo: Math.max(s.bestCombo, combo),
      points: s.points + score.points,
      correctCount: s.correctCount + 1,
      lastVerdict: 'correct',
      answered: [...s.answered, ev],
      pendingPartial: null,
    });
    optsRef.current.onCorrect?.(ev, score);
    checkGoalAndAnnounce();
    scheduleAdvance(format.id === 'sprint60' ? 300 : 450);
  };

  const judgeWrong = (given: number | undefined, via: AnswerVia) => {
    const R = r.current;
    const s = sRef.current;
    const fact = s.current;
    if (!fact || R.locked || s.status !== 'running') return;
    clearTimer('hold');
    const ms = Math.max(0, performance.now() - R.shownAt);
    updateMastery(fact, false, ms, 'none');
    R.sessionWrong[fact.id] = (R.sessionWrong[fact.id] ?? 0) + 1;
    R.sessionRecovered[fact.id] = 0;
    if (!R.comeback.some((c) => c.factId === fact.id)) {
      R.comeback.push({
        factId: fact.id,
        dueAt: s.questionIndex + randInt(3, 5),
      });
    }
    const ev: AnswerEvent = {
      factId: fact.id,
      prompt: fact.prompt,
      answer: fact.answer,
      correct: false,
      ms: Math.round(ms),
      attempt: 1,
      via,
      points: 0,
      combo: 0,
      tier: 'none',
      given,
    };
    sfx.play('wrong');
    const until = performance.now() + RETYPE_MS;
    commitX({ retypeUntil: until, unclear: false });
    commit({
      status: 'retype',
      input: '',
      combo: 0,
      wrongCount: s.wrongCount + 1,
      lastVerdict: 'wrong',
      answered: [...s.answered, ev],
      pendingPartial: null,
    });
    optsRef.current.onWrong?.(ev);
    clearTimer('retype');
    R.timers.retype = setTimeout(nextQuestion, RETYPE_MS);
  };

  const retypeDone = () => {
    const R = r.current;
    if (R.locked) return;
    clearTimer('retype');
    sfx.play('pop');
    commitX({ retypeUntil: null });
    scheduleAdvance(300);
  };

  const retypeMiss = () => {
    sfx.play('wrong', 0.5);
    commitX({ nudge: xRef.current.nudge + 1 });
    commit({ input: '' });
  };

  // ---- timer ----------------------------------------------------------------------------

  const tick = () => {
    const s = sRef.current;
    const R = r.current;
    const now = performance.now();
    // A frozen page (Safari suspends timers behind a system sheet; a starved main thread) must not
    // eat the round: treat a tick gap over 2.5 s as an involuntary pause.
    const gap = R.lastTickAt ? now - R.lastTickAt - TICK_MS : 0;
    R.lastTickAt = now;
    if (s.status !== 'running' && s.status !== 'retype') return;
    if (gap > STALL_MS - TICK_MS) {
      R.startAt += gap;
      R.shownAt += gap;
    }
    const elapsed = elapsedNow();
    if (format.durationMs) {
      const remaining = format.durationMs - elapsed;
      if (remaining <= 0) {
        finish('complete');
        return;
      }
      const sec = Math.ceil(remaining / 1000);
      if (sec <= 10 && sec !== r.current.lastTickSec) {
        r.current.lastTickSec = sec;
        if (sec < 10) sfx.play('tick', 0.6);
      }
      commit({ elapsedMs: elapsed, remainingMs: remaining });
    } else if (format.showTimer) {
      commit({ elapsedMs: elapsed });
    }
  };

  // ---- public actions -------------------------------------------------------------------

  const start = () => {
    clearAll();
    const R = r.current;
    const mastery = store.get();
    let facts = generator.factsForSet(setId, mastery);
    if (!facts.length) facts = generator.allFacts();
    R.facts = facts;
    R.recent = [];
    R.sessionWrong = {};
    R.sessionRecovered = {};
    R.comeback = [];
    R.startBoxes = Object.fromEntries(Object.entries(mastery.facts).map(([k, v]) => [k, v.box]));
    R.rankBefore = rewards.rank().index;
    R.capToasted = false;
    R.unclearTexts = [];
    R.lastTickSec = -1;
    R.pendingAdvance = false;
    R.locked = false;
    R.acceptedUtterance = null;
    const first = pick(0);
    const now = performance.now();
    R.startAt = now;
    R.shownAt = now;
    R.lastTickAt = now;
    xRef.current = EMPTY_EXTRAS;
    setExtras(EMPTY_EXTRAS);
    sRef.current = { ...initial(), status: 'running', current: first };
    setState(sRef.current);
    R.timers.interval = setInterval(tick, TICK_MS);
  };

  const typeDigit = (digit: string, via: AnswerVia = 'keypad') => {
    const s = sRef.current;
    const R = r.current;
    const fact = s.current;
    if (!fact || R.locked) return;
    const ans = String(fact.answer);
    const order = entryOrderFor(fact);
    // Workbook: never more digits than answer boxes.
    const maxLen = layoutFor(fact) === 'workbook' ? workbookColumns(fact, String(generator.maxPlausible).length) : 99;
    if (s.status === 'running') {
      if (order === 'ltr' && s.input === '' && digit === '0' && ans.length > 1) return; // a leading 0 is never right
      if (s.input.length >= maxLen) return;
      clearTimer('hold');
      const next = addDigit(s.input, digit, order);
      commit({ input: next });
      if (next === ans) {
        judgeCorrect(via);
      } else if (next.length < ans.length && onTrack(ans, next, order)) {
        // On the way to the right answer: wait for the next digit.
      } else if (next.length < ans.length || couldGrowTyped(next, order, generator.maxPlausible, maxLen)) {
        // Shorter than the answer, or "1" when the answer is 6 (may become "12"): judge once
        // he stops typing, with the whole number he meant.
        R.timers.hold = setTimeout(
          () => {
            R.timers.hold = null;
            const cur = sRef.current;
            if (cur.status === 'running' && cur.input && !R.locked) judgeWrong(Number(cur.input), via);
          },
          next.length < ans.length ? IDLE_MS : HOLD_MS,
        );
      } else {
        judgeWrong(Number(next), via);
      }
    } else if (s.status === 'retype') {
      const next = addDigit(s.input, digit, order);
      if (next === ans) {
        commit({ input: next });
        retypeDone();
      } else if (next.length >= ans.length || !onTrack(ans, next, order)) {
        retypeMiss();
      } else {
        commit({ input: next });
      }
    }
  };

  const backspace = () => {
    const s = sRef.current;
    if (r.current.locked || (s.status !== 'running' && s.status !== 'retype')) return;
    clearTimer('hold');
    if (s.input) commit({ input: removeDigit(s.input, entryOrderFor(s.current)) });
  };

  const clear = () => {
    const s = sRef.current;
    if (r.current.locked || (s.status !== 'running' && s.status !== 'retype')) return;
    clearTimer('hold');
    commit({ input: '' });
  };

  /**
   * Explicit submit (Enter / ✓). A correct-so-far partial ("5" of 56) is never judged: it just
   * nudges, because answers auto-submit at full length. Anything else is judged now.
   */
  const submit = () => {
    const s = sRef.current;
    const fact = s.current;
    if (!fact || r.current.locked || !s.input) return;
    const ans = String(fact.answer);
    if (s.status === 'running') {
      if (s.input === ans) judgeCorrect('keyboard');
      else if (onTrack(ans, s.input, entryOrderFor(fact))) commitX({ nudge: xRef.current.nudge + 1 });
      else judgeWrong(Number(s.input), 'keyboard');
    } else if (s.status === 'retype') {
      if (s.input === ans) retypeDone();
      else retypeMiss();
    }
  };

  const onVoiceTranscript = (hyp: VoiceHypothesis) => {
    const s = sRef.current;
    const R = r.current;
    const fact = s.current;
    if (!fact || R.locked || (s.status !== 'running' && s.status !== 'retype')) return;
    // The rest of an utterance that was already accepted (a late Web Speech final arriving
    // after the next question appeared) belongs to the previous question: ignore it.
    if (R.acceptedUtterance !== null && hyp.utteranceId === R.acceptedUtterance) return;
    const prefix = s.pendingPartial ? `${s.pendingPartial} ` : '';
    const text = (hyp.text ?? '').trim();
    if (!text && !hyp.alternatives?.length) return;
    const merged: VoiceHypothesis = {
      ...hyp,
      text: prefix + text,
      alternatives: hyp.alternatives?.filter(Boolean).map((t) => prefix + t),
    };
    let res: NumberMatchResult;
    try {
      // Handles interim early-accept (never 'wrong' on interim), alternatives and the
      // engine's confidence (uncertain 'wrong' → 'unclear').
      res = matchNumberHypothesis(merged, {
        expected: fact.answer,
        maxPlausible: generator.maxPlausible,
        operands: fact.operands,
        minConfidence: 0.5,
      });
    } catch {
      res = { verdict: 'unclear', candidates: [], normalized: merged.text };
    }
    const heardText = merged.text;
    if (hyp.isFinal) {
      try {
        recordVoiceVerdict(hyp.utteranceId, res.verdict);
      } catch {
        /* diagnostics only */
      }
    }
    if (res.verdict === 'correct') {
      clearTimer('partial');
      clearTimer('unclear');
      commitX({ unclear: false });
      R.acceptedUtterance = hyp.utteranceId;
      commit({
        heard: heardText,
        pendingPartial: null,
        input: String(fact.answer),
      });
      if (s.status === 'running') judgeCorrect('voice');
      else retypeDone();
      return;
    }
    if (!hyp.isFinal) {
      // Interim (Web Speech): just show what we're hearing.
      commit({ heard: heardText });
      return;
    }
    clearTimer('partial');
    if (res.verdict === 'wrong') {
      commit({ heard: heardText, pendingPartial: null });
      if (s.status === 'running') judgeWrong(res.heard, 'voice');
      else retypeMiss();
      return;
    }
    // unclear: no sound, "?" bubble, keep listening.
    R.unclearTexts.push({
      text: heardText,
      learn: res.candidates.length === 0 && !res.partial,
    });
    commitX({ unclear: true });
    clearTimer('unclear');
    R.timers.unclear = setTimeout(() => commitX({ unclear: false }), UNCLEAR_MS);
    if (res.partial) {
      commit({ heard: heardText, pendingPartial: heardText });
      R.timers.partial = setTimeout(() => commit({ pendingPartial: null }), PARTIAL_MS);
    } else {
      commit({ heard: heardText, pendingPartial: null });
    }
  };

  const pause = () => {
    const s = sRef.current;
    if (s.status !== 'running' && s.status !== 'retype') return;
    const R = r.current;
    R.pausedAt = performance.now();
    R.resumeTo = s.status;
    clearTimer('interval');
    clearTimer('retype');
    clearTimer('hold');
    if (R.timers.advance) {
      clearTimer('advance');
      R.pendingAdvance = true;
    }
    commit({ status: 'paused' });
  };

  const resume = () => {
    const s = sRef.current;
    if (s.status !== 'paused') return;
    const R = r.current;
    const dt = performance.now() - R.pausedAt;
    R.startAt += dt;
    R.shownAt += dt;
    R.lastTickAt = performance.now();
    commit({ status: R.resumeTo });
    R.timers.interval = setInterval(tick, TICK_MS);
    const fact = sRef.current.current;
    if (R.pendingAdvance) {
      nextQuestion();
    } else if (
      R.resumeTo === 'running' &&
      fact &&
      s.input &&
      !onTrack(String(fact.answer), s.input, entryOrderFor(fact))
    ) {
      // A held wrong entry from before the pause: judge it now.
      judgeWrong(Number(s.input), 'keypad');
    } else if (R.resumeTo === 'retype') {
      commitX({ retypeUntil: performance.now() + RETYPE_MS });
      R.timers.retype = setTimeout(nextQuestion, RETYPE_MS);
    }
  };

  const end = () => finish('quit');

  const reset = () => {
    clearAll();
    r.current.locked = false;
    xRef.current = EMPTY_EXTRAS;
    setExtras(EMPTY_EXTRAS);
    sRef.current = initial();
    setState(sRef.current);
  };

  // Pause when the app is backgrounded (iPad home button, tab switch).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') pauseRef.current();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const R = r.current;
    R.mounted = true;
    return () => {
      R.mounted = false;
      (Object.keys(R.timers) as Array<keyof typeof R.timers>).forEach((k) => {
        const t = R.timers[k];
        if (t) clearTimeout(t as ReturnType<typeof setTimeout>);
        R.timers[k] = null;
      });
      store.flush();
    };
  }, [store]);

  // Stable action identities for consumers; the latest closures live in a ref.
  const actions = {
    start,
    typeDigit,
    backspace,
    clear,
    submit,
    onVoiceTranscript,
    pause,
    resume,
    end,
    reset,
  };
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });
  const pauseRef = useRef(pause);
  useEffect(() => {
    pauseRef.current = pause;
  });

  const stable = useMemo(
    () => ({
      start: () => actionsRef.current.start(),
      typeDigit: (d: string, via?: AnswerVia) => actionsRef.current.typeDigit(d, via),
      backspace: () => actionsRef.current.backspace(),
      clear: () => actionsRef.current.clear(),
      submit: () => actionsRef.current.submit(),
      onVoiceTranscript: (h: VoiceHypothesis) => actionsRef.current.onVoiceTranscript(h),
      pause: () => actionsRef.current.pause(),
      resume: () => actionsRef.current.resume(),
      end: () => actionsRef.current.end(),
      reset: () => actionsRef.current.reset(),
    }),
    [],
  );

  return { state, extras, ...stable };
}
