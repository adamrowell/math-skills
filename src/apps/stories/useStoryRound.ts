/**
 * One Story round (8 stories, no clock shown): ready → running ⇄ hint → worked → finished.
 *
 * Anti-guessing (docs/UX-V3.md §7.1, same as Quick Algebra):
 *  - first try right → full points (speed + combo);
 *  - first miss → combo reset, hint card (words + number sentence), short cooldown;
 *    second try right → half points;
 *  - second miss → worked answer; he retypes the answer to move on (0 points).
 * Same-length wrong answers are judged at once; a shorter one that can no longer become the answer
 * is judged after a beat; erasing digits that are already off track counts as the guess.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { awardTrophy, checkGoalAndAnnounce, checkLifetimeTrophies, rewards, sfx } from '../../core';
import type { RankInfo, TrophyId } from '../../core';
import { applyMastery, masteryStore, pickNextFact } from '../../drill';
import type { AnswerVia } from '../../drill';
import { matchNumberHypothesis, recordVoiceVerdict } from '../../voice';
import type { NumberMatchResult, VoiceHypothesis } from '../../voice';
import { MAX_ANSWER, STORIES_PER_ROUND, makeStory, templateById, templateFacts } from './problems';
import type { LevelId, Story } from './problems';
import { FIRST_ROUND_BONUS, PERFECT_BONUS, firstTryPoints, secondTryPoints, starsFor, tierFor } from './scoring';
import { recordRound } from './progress';

export type StoryStatus = 'ready' | 'running' | 'hint' | 'correct' | 'worked' | 'finished';

export interface StoryAnswer {
  story: Story;
  /** 1 = right first try, 2 = right after the hint, 0 = needed the worked answer. */
  solvedOn: 0 | 1 | 2;
  points: number;
  ms: number;
  via: AnswerVia | null;
}

export interface StoryRoundState {
  status: StoryStatus;
  level: LevelId;
  story: Story | null;
  index: number;
  input: string;
  attempt: 1 | 2;
  /** Last wrong value (shown struck through). */
  given: number | null;
  givenVia: AnswerVia | null;
  combo: number;
  bestCombo: number;
  points: number;
  answers: StoryAnswer[];
  /** Hint cooldown end (performance.now()). */
  cooldownUntil: number | null;
  lastPoints: number;
  heard: string | null;
  /** What the app made of the last utterance (for the MicPanel chip). */
  heardKind: 'ok' | 'wrong' | 'unsure' | 'partial' | null;
  pendingPartial: string | null;
  /** Bumps on every wrong (drives the shake). */
  nudge: number;
  endReason: 'complete' | 'quit' | null;
  bonusLines: Array<{ label: string; points: number; emoji?: string }>;
  stars: 0 | 1 | 2 | 3;
  best: { value: number; previous: number | null; isNewBest: boolean } | null;
  trophies: TrophyId[];
  rankUp: RankInfo | null;
  unlocked: LevelId | null;
}

const COOLDOWN_MS = 1500;
const HOLD_MS = 1200;
const UNCLEAR_MS = 1500;
const PARTIAL_MS = 1500;
const ADVANCE_MS = 1600;

export const bestKeyFor = (level: LevelId) => `stories:story8:L${level}`;

function initialState(level: LevelId): StoryRoundState {
  return {
    status: 'ready',
    level,
    story: null,
    index: 0,
    input: '',
    attempt: 1,
    given: null,
    givenVia: null,
    combo: 0,
    bestCombo: 0,
    points: 0,
    answers: [],
    cooldownUntil: null,
    lastPoints: 0,
    heard: null,
    heardKind: null,
    pendingPartial: null,
    nudge: 0,
    endReason: null,
    bonusLines: [],
    stars: 0,
    best: null,
    trophies: [],
    rankUp: null,
    unlocked: null,
  };
}

export interface StoryRoundCallbacks {
  onCorrect?: (points: number) => void;
  onWrong?: () => void;
  onStory?: (story: Story) => void;
}

const SPEED = { fastMs: 15_000, okMs: 30_000 };

export function useStoryRound(level: LevelId, cb: StoryRoundCallbacks = {}) {
  const store = masteryStore('stories');
  const [state, setState] = useState<StoryRoundState>(() => initialState(level));
  const sRef = useRef(state);
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });

  const R = useRef({
    shownAt: 0,
    hiddenAt: 0,
    recent: [] as string[],
    recentKeys: [] as string[],
    sessionWrong: {} as Record<string, number>,
    sessionRecovered: {} as Record<string, number>,
    comeback: [] as Array<{ factId: string; dueAt: number }>,
    rankBefore: 0,
    acceptedUtterance: null as number | null,
    mounted: true,
    timers: {} as Record<string, ReturnType<typeof setTimeout> | undefined>,
  });

  const commit = useCallback((patch: Partial<StoryRoundState>) => {
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
  const clearAll = () => Object.keys(R.current.timers).forEach(clearT);

  const facts = useMemo(() => templateFacts(level), [level]);

  const pick = (q: number): Story => {
    const r = R.current;
    const res = pickNextFact({
      facts,
      mastery: store.get(),
      speed: SPEED,
      recent: r.recent,
      sessionWrong: r.sessionWrong,
      sessionRecovered: r.sessionRecovered,
      comeback: r.comeback,
      questionIndex: q,
    });
    if (res.viaComeback) r.comeback = r.comeback.filter((c) => c.factId !== res.fact.id);
    r.recent = [...r.recent, res.fact.id].slice(-2);
    // Never the same story (or the same numbers) twice in a round.
    let s = makeStory(res.fact.id);
    for (let i = 0; i < 8 && r.recentKeys.includes(s.key); i++) s = makeStory(res.fact.id);
    r.recentKeys.push(s.key);
    return s;
  };

  const prior = (s: Story) => templateById(s.templateId)?.prior ?? 1;

  const mastery = (s: Story, correct: boolean, ms: number) => {
    store.set(applyMastery(store.get(), { factId: s.templateId, correct, ms, tier: correct ? tierFor(ms) : 'none' }, Date.now()));
  };

  // ---- flow ------------------------------------------------------------------------------

  const finish = (reason: 'complete' | 'quit') => {
    const s = sRef.current;
    if (s.status === 'finished' || s.status === 'ready') return;
    clearAll();
    store.flush();
    if (reason === 'quit') {
      commit({ status: 'finished', endReason: 'quit', cooldownUntil: null });
      if (s.answers.length) sfx.play('roundEnd');
      return;
    }
    const n = s.answers.length;
    const firstTry = s.answers.filter((a) => a.solvedOn === 1).length;
    const stars = starsFor(firstTry, n, STORIES_PER_ROUND);
    const bonusLines: StoryRoundState['bonusLines'] = [];
    if (n >= STORIES_PER_ROUND && firstTry === n) bonusLines.push({ label: 'Perfect story', points: PERFECT_BONUS, emoji: '💯' });
    if (n >= STORIES_PER_ROUND && firstTry >= 6 && rewards.claimFirstRound('stories')) bonusLines.push({ label: 'First round today', points: FIRST_ROUND_BONUS, emoji: '🌅' });
    const bonus = bonusLines.reduce((a, b) => a + b.points, 0);
    if (bonus > 0) rewards.addPoints('stories', bonus, 'bonus', `Stories L${level} bonus`);

    const b = rewards.recordBest(bestKeyFor(level), firstTry, true);
    const best = { value: firstTry, previous: b.previous, isNewBest: b.isNewBest };

    const got: TrophyId[] = [];
    const tryT = (id: TrophyId, cond: boolean) => {
      if (cond && awardTrophy(id, { quiet: true })) got.push(id);
    };
    tryT('first-round', n > 0);
    got.push(...checkLifetimeTrophies(true));
    got.push(...checkGoalAndAnnounce());
    const rankNow = rewards.rank();
    const rankUp = rankNow.index > R.current.rankBefore ? rankNow : null;
    const unlocked = recordRound(level, stars);

    if (stars === 3 || rankUp || unlocked) sfx.play('pb');
    else sfx.play('roundEnd');
    if (got.length) setTimeout(() => sfx.play('trophy'), 700);

    commit({
      status: 'finished',
      endReason: 'complete',
      cooldownUntil: null,
      bonusLines,
      stars,
      best,
      trophies: got,
      rankUp,
      unlocked,
      points: s.points + bonus,
    });
  };

  const showStory = (index: number) => {
    const story = pick(index);
    R.current.shownAt = performance.now();
    R.current.acceptedUtterance = null;
    commit({
      status: 'running',
      story,
      index,
      input: '',
      attempt: 1,
      given: null,
      givenVia: null,
      cooldownUntil: null,
      heard: null,
      heardKind: null,
      pendingPartial: null,
    });
    cbRef.current.onStory?.(story);
  };

  const next = () => {
    clearT('advance');
    const s = sRef.current;
    if (s.status === 'finished' || s.status === 'ready') return;
    if (s.answers.length >= STORIES_PER_ROUND) {
      finish('complete');
      return;
    }
    showStory(s.index + 1);
  };

  const judgeCorrect = (via: AnswerVia) => {
    const s = sRef.current;
    const st = s.story;
    if (!st || (s.status !== 'running' && s.status !== 'worked')) return;
    clearT('hold');
    const ms = Math.max(0, performance.now() - R.current.shownAt);
    let points = 0;
    let combo = s.combo;
    let solvedOn: 0 | 1 | 2 = 0;
    if (s.status === 'worked') {
      // Retyped the worked answer: no points, the combo is already 0.
      solvedOn = 0;
    } else if (s.attempt === 1) {
      combo = s.combo + 1;
      points = firstTryPoints(prior(st), ms, combo).points;
      solvedOn = 1;
      mastery(st, true, ms);
      if (R.current.sessionWrong[st.templateId]) R.current.sessionRecovered[st.templateId] = (R.current.sessionRecovered[st.templateId] ?? 0) + 1;
    } else {
      points = secondTryPoints(prior(st));
      solvedOn = 2;
    }
    if (points > 0) rewards.addPoints('stories', points, 'answer', st.sentence.replace('☐', String(st.answer)));
    sfx.play('correct', solvedOn === 0 ? 0.6 : 1);
    if (combo > 0 && combo % 5 === 0 && solvedOn === 1) setTimeout(() => sfx.play('combo'), 150);
    const ans: StoryAnswer = { story: st, solvedOn, points, ms: Math.round(ms), via };
    commit({
      status: 'correct',
      input: String(st.answer),
      combo,
      bestCombo: Math.max(s.bestCombo, combo),
      points: s.points + points,
      answers: [...s.answers, ans],
      lastPoints: points,
      cooldownUntil: null,
      pendingPartial: null,
    });
    if (points > 0) cbRef.current.onCorrect?.(points);
    checkGoalAndAnnounce();
    setT('advance', next, ADVANCE_MS);
  };

  const judgeWrong = (given: number, via: AnswerVia) => {
    const s = sRef.current;
    const st = s.story;
    if (!st) return;
    clearT('hold');
    if (s.status === 'worked') {
      // Retyping the worked answer: a slip just clears the box.
      sfx.play('wrong', 0.4);
      commit({ input: '', nudge: s.nudge + 1 });
      return;
    }
    if (s.status !== 'running') return;
    const ms = Math.max(0, performance.now() - R.current.shownAt);
    cbRef.current.onWrong?.();
    if (s.attempt === 1) {
      sfx.play('wrong');
      mastery(st, false, ms);
      R.current.sessionWrong[st.templateId] = (R.current.sessionWrong[st.templateId] ?? 0) + 1;
      R.current.sessionRecovered[st.templateId] = 0;
      if (!R.current.comeback.some((c) => c.factId === st.templateId)) R.current.comeback.push({ factId: st.templateId, dueAt: s.index + 3 });
      const until = performance.now() + COOLDOWN_MS;
      commit({ status: 'hint', attempt: 2, input: '', given, givenVia: via, combo: 0, cooldownUntil: until, nudge: s.nudge + 1, pendingPartial: null });
      setT('cooldown', () => {
        if (sRef.current.status === 'hint') commit({ status: 'running', cooldownUntil: null });
      }, COOLDOWN_MS);
    } else {
      sfx.play('wrong', 0.6);
      commit({ status: 'worked', input: '', given, givenVia: via, combo: 0, nudge: s.nudge + 1, pendingPartial: null });
    }
  };

  const start = () => {
    clearAll();
    const r = R.current;
    r.recent = [];
    r.recentKeys = [];
    r.sessionWrong = {};
    r.sessionRecovered = {};
    r.comeback = [];
    r.rankBefore = rewards.rank().index;
    sRef.current = { ...initialState(level), status: 'running' };
    showStory(0);
  };

  const accepting = () => {
    const s = sRef.current.status;
    return s === 'running' || s === 'worked';
  };

  const typeDigit = (d: string, via: AnswerVia = 'keypad') => {
    const s = sRef.current;
    const st = s.story;
    if (!st || !accepting()) return;
    const ans = String(st.answer);
    if (s.input === '' && d === '0') return; // answers are never 0 or 0-led
    if (s.input.length >= 3) return;
    clearT('hold');
    const nextIn = s.input + d;
    commit({ input: nextIn });
    if (nextIn === ans) {
      judgeCorrect(via);
      return;
    }
    if (ans.startsWith(nextIn)) return;
    if (nextIn.length >= ans.length) {
      judgeWrong(Number(nextIn), via);
      return;
    }
    setT(
      'hold',
      () => {
        const cur = sRef.current;
        if ((cur.status === 'running' || cur.status === 'worked') && cur.input) judgeWrong(Number(cur.input), via);
      },
      HOLD_MS,
    );
  };

  const guessedWrong = (): boolean => {
    // A quick fix of a mis-tap (⌫ while the wrong digit is still waiting to be judged) is free:
    // nothing on screen has said right or wrong yet, so it leaks nothing.
    if (R.current.timers.hold) return false;
    const s = sRef.current;
    if (s.status !== 'running' || !s.story || !s.input) return false;
    if (String(s.story.answer).startsWith(s.input)) return false;
    judgeWrong(Number(s.input), 'keypad');
    return true;
  };

  const backspace = () => {
    const s = sRef.current;
    if (!accepting()) return;
    if (guessedWrong()) return;
    clearT('hold');
    if (s.input) commit({ input: s.input.slice(0, -1) });
  };

  const clear = () => {
    if (!accepting()) return;
    if (guessedWrong()) return;
    clearT('hold');
    commit({ input: '' });
  };

  const submit = () => {
    const s = sRef.current;
    if (s.status === 'correct') {
      next();
      return;
    }
    if (!accepting() || !s.story || !s.input) return;
    if (s.input === String(s.story.answer)) judgeCorrect('keyboard');
    else judgeWrong(Number(s.input), 'keyboard');
  };

  const onVoiceTranscript = (hyp: VoiceHypothesis) => {
    const s = sRef.current;
    const st = s.story;
    if (!st || !(s.status === 'running' || s.status === 'worked' || s.status === 'hint')) return;
    if (R.current.acceptedUtterance !== null && hyp.utteranceId === R.current.acceptedUtterance) return;
    const prefix = s.pendingPartial ? `${s.pendingPartial} ` : '';
    const text = (hyp.text ?? '').trim();
    if (!text && !hyp.alternatives?.length) return;
    const merged: VoiceHypothesis = { ...hyp, text: prefix + text, alternatives: hyp.alternatives?.filter(Boolean).map((t) => prefix + t) };
    let res: NumberMatchResult;
    try {
      res = matchNumberHypothesis(merged, { expected: st.answer, maxPlausible: MAX_ANSWER, operands: st.operands, minConfidence: 0.5 });
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
    if (s.status === 'hint') {
      commit({ heard: merged.text, heardKind: 'partial' });
      return;
    }
    if (res.verdict === 'correct') {
      clearT('partial');
      clearT('unclear');
      R.current.acceptedUtterance = hyp.utteranceId;
      commit({ heard: merged.text, heardKind: 'ok', pendingPartial: null, input: String(st.answer) });
      judgeCorrect('voice');
      return;
    }
    if (!hyp.isFinal) {
      commit({ heard: merged.text, heardKind: 'partial' });
      return;
    }
    clearT('partial');
    if (res.verdict === 'wrong' && res.heard !== undefined) {
      commit({ heard: String(res.heard), heardKind: 'wrong', pendingPartial: null });
      judgeWrong(res.heard, 'voice');
      return;
    }
    commit({ heard: merged.text, heardKind: res.partial ? 'partial' : 'unsure', pendingPartial: res.partial ? merged.text : null });
    setT('unclear', () => commit({ heardKind: null }), UNCLEAR_MS);
    if (res.partial) setT('partial', () => commit({ pendingPartial: null }), PARTIAL_MS);
  };

  const end = () => finish('quit');
  const reset = () => {
    clearAll();
    sRef.current = initialState(level);
    setState(sRef.current);
  };

  // Backgrounded: don't let an iPad nap eat the speed bonus.
  useEffect(() => {
    const onVis = () => {
      const r = R.current;
      if (document.visibilityState === 'hidden') r.hiddenAt = performance.now();
      else if (r.hiddenAt) {
        r.shownAt += performance.now() - r.hiddenAt;
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
      store.flush();
    };
  }, [store]);

  /** Reading the story aloud is free: pause the speed clock while it talks. */
  const pauseClock = (ms: number) => {
    R.current.shownAt += Math.max(0, ms);
  };

  const actions = { start, typeDigit, backspace, clear, submit, onVoiceTranscript, end, reset, next, pauseClock };
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
      pauseClock: (ms: number) => ref.current.pauseClock(ms),
    }),
    [],
  );
  return { state, ...stable };
}
