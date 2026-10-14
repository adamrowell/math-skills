/**
 * A round of Brain Puzzles (docs/GEO-LOGIC.md §E.2): 10 puzzles, one at a time.
 *   kind 'round'    — points, mastery, adaptive levels, round bonuses
 *   kind 'practice' — one family only (Brain Map), half points, no round bonuses
 *   kind 'gallery'  — one of each family, no points at all ("Show me one of each")
 * Anti-guessing: taps ignored for 700 ms, −5 per miss, one retry for +5, then Brain Coach.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  BigButton,
  Keypad,
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
} from '../../../core';
import type { PointsBurstHandle, RankInfo, TrophyId } from '../../../core';
import { applyMastery, masteryStore, roundBonuses, speedTier } from '../../../drill';
import type { RoundBonuses } from '../../../drill';
import type { CellsAnswer, Color, Difficulty, FamilyId, LogicMode, Puzzle, SudokuAnswer } from '../engine/types';
import { MISS_PENALTY, ROUND_LENGTH } from '../engine/types';
import { FAMILIES } from '../engine/registry';
import { familyEmoji, familyTitle } from './familyInfo';
import { adapt, createRound, factId, shuffleChoice, speedFor, withSeen } from '../engine/session';
import type { Round } from '../engine/session';
import { comboMultiplier, pointsFor } from '../engine/scoring';
import { mulberry32 } from '../engine/rng';
import { Visual } from '../engine/Visual';
import type { GridEdit } from '../engine/Visual';
import { progressStore } from '../progress';
import { uiStore, markTipSeen } from '../uiStore';
import { FAMILY_META } from '../tips';
import { speak, stopSpeaking } from '../speech';
import { ChoiceGrid } from './ChoiceGrid';
import { BrainCoach } from './BrainCoach';

export type PlayKind = 'round' | 'practice' | 'gallery';

interface Props {
  kind: PlayKind;
  mode: LogicMode;
  only?: FamilyId;
  /** Gallery difficulty. */
  level?: Difficulty;
  onExit: () => void;
}

type Phase = 'ask' | 'retry' | 'correct' | 'coach';

interface Item {
  index: number;
  puzzle: Puzzle;
  phase: Phase;
  misses: 0 | 1 | 2;
  wrong: number[];
  input: string;
  fills: Record<string, Color | undefined>;
  sym: Record<string, string | undefined>;
  selected: string | null;
  marks: Record<string, 'bad' | 'good' | 'sel' | undefined>;
  note: string;
  whyOpen: boolean;
  points: number;
}

interface Stats {
  points: number;
  combo: number;
  bestCombo: number;
  firstTry: number;
  missesTotal: number;
  answered: number;
  missed: Puzzle[];
}

interface Finished {
  bonuses: RoundBonuses;
  best: { label: string; value: string; isNewBest: boolean; previous: string | null } | null;
  trophies: TrophyId[];
  rankUp: RankInfo | null;
}

const EMPTY: Stats = { points: 0, combo: 0, bestCombo: 0, firstTry: 0, missesTotal: 0, answered: 0, missed: [] };
const MASH_MS = 700;
const soundOn = () => getSettings().soundOn;


/** Everything a round needs to hand out puzzles. */
interface Feed {
  length: number;
  next: () => Puzzle | null;
}

function makeFeed(kind: PlayKind, mode: LogicMode, only: FamilyId | undefined, level: Difficulty, seed: number): Feed {
  const rng = mulberry32(seed);
  if (kind === 'gallery') {
    const fams = FAMILIES.slice();
    let i = 0;
    return {
      length: fams.length,
      next: () => {
        if (i >= fams.length) return null;
        const f = fams[i++];
        for (let t = 0; t < 10; t++) {
          try {
            const p = f.generate(level, mulberry32(Math.floor(rng() * 2 ** 32)));
            if (f.validate(p).length) continue;
            return p.answer.kind === 'choice' ? { ...p, answer: shuffleChoice(p.answer, rng) } : p;
          } catch {
            /* try another seed */
          }
        }
        return null;
      },
    };
  }
  const round: Round = createRound({
    families: FAMILIES,
    mode,
    progress: progressStore.get(),
    mastery: masteryStore('logic').get(),
    rng,
    only,
  });
  return { length: round.length, next: round.next };
}

/** Dev/test only: the answer in a form a test can act on. */
function devAnswer(a: Puzzle['answer']): string {
  if (a.kind === 'choice') return String(a.answerIndex);
  if (a.kind === 'number') return String(a.answer);
  if (a.kind === 'cells')
    return Object.entries(a.target)
      .filter(([k]) => !(a.locked ?? []).includes(k))
      .map(([k, c]) => `${k}=${a.palette.indexOf(c) + 1}`)
      .join(';');
  return a.givens
    .flatMap((row, r) => row.map((g, c) => (g ? '' : `${r},${c}=${a.solution[r][c]}`)))
    .filter(Boolean)
    .join(';');
}

function digits(n: number): number {
  return String(Math.abs(n)).length;
}

function sudokuKeyAt(a: SudokuAnswer, key: string): string | null {
  const [r, c] = key.split(',').map(Number);
  return a.givens[r]?.[c] ?? null;
}

/** Cells that clash with another cell in the same row, column or 2×2 box. */
function sudokuConflicts(a: SudokuAnswer, sym: Record<string, string | undefined>): string[] {
  const val = (r: number, c: number) => a.givens[r][c] ?? sym[`${r},${c}`];
  const bad = new Set<string>();
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      const v = val(r, c);
      if (!v || a.givens[r][c]) continue;
      for (let r2 = 0; r2 < 4; r2++)
        for (let c2 = 0; c2 < 4; c2++) {
          if (r2 === r && c2 === c) continue;
          const same = r2 === r || c2 === c || (Math.floor(r2 / 2) === Math.floor(r / 2) && Math.floor(c2 / 2) === Math.floor(c / 2));
          if (same && val(r2, c2) === v) bad.add(`${r},${c}`);
        }
    }
  return [...bad];
}

function sudokuNode(p: Puzzle, key: string) {
  const a = p.answer as SudokuAnswer;
  const sym = a.symbols.find((s) => s.key === key);
  if (!sym) return {};
  if (p.variant === 'shapes' && sym.visual) return { node: sym.visual.nodes[0] };
  if (p.variant === 'fruit') return { node: { t: 'emoji' as const, x: 32, y: 34, char: key, size: 38 } };
  return { label: sym.label ?? key };
}

export function PlayScreen({ kind, mode, only, level = 1, onExit }: Props) {
  const today = useTodayPoints();
  const burstRef = useRef<PointsBurstHandle>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const [roundNo, setRoundNo] = useState(0);
  const feed = useMemo(() => makeFeed(kind, mode, only, level, (Date.now() ^ (roundNo * 7919)) >>> 0), [kind, mode, only, level, roundNo]);
  const [item, setItem] = useState<Item | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [empty, setEmpty] = useState(false);
  const free = kind === 'gallery';
  const practice = kind === 'practice';

  const R = useRef({ shownAt: 0, timers: [] as number[], item: null as Item | null, stats: EMPTY, over: false, rankBefore: 0, firstMissDone: false });
  R.current.item = item;
  R.current.stats = stats;

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

  const show = useCallback(
    (index: number) => {
      const p = feed.next();
      if (!p) {
        if (index === 0) setEmpty(true);
        return false;
      }
      if (!free) progressStore.update((pr) => withSeen(pr, [p.id]));
      R.current.shownAt = performance.now();
      R.current.firstMissDone = false;
      // Sudoku: the first empty square starts selected, so the number tray is live straight away.
      let selected: string | null = null;
      if (p.answer.kind === 'sudoku') {
        const g = p.answer.givens;
        const r = g.findIndex((row) => row.some((v) => !v));
        if (r >= 0) selected = `${r},${g[r].findIndex((v) => !v)}`;
      }
      setItem({ index, puzzle: p, phase: 'ask', misses: 0, wrong: [], input: '', fills: {}, sym: {}, selected, marks: selected ? { [selected]: 'sel' } : {}, note: '', whyOpen: false, points: 0 });
      if (soundOn()) speak(p.speak ?? p.prompt);
      return true;
    },
    [feed, free],
  );

  // Start straight away (no countdown: nothing to listen for).
  useState(() => consumeAutostart());
  const startedFeed = useRef<Feed | null>(null);
  useEffect(() => {
    if (startedFeed.current === feed) return; // StrictMode double effect
    startedFeed.current = feed;
    R.current.over = false;
    R.current.rankBefore = rewards.rank().index;
    setStats(EMPTY);
    setFinished(null);
    show(0);
  }, [feed, show]);

  const finish = useCallback(() => {
    const cur = R.current;
    if (cur.over) return;
    cur.over = true;
    stopSpeaking();
    const s = cur.stats;
    if (free) {
      sfx.play('roundEnd');
      setFinished({ bonuses: roundBonuses({ newBest: false, answered: 0, correct: 0 }), best: null, trophies: [], rankUp: null });
      return;
    }
    progressStore.update((p) => ({ ...p, rounds: p.rounds + 1, best: practice ? p.best : { ...p.best, [mode]: Math.max(p.best[mode] ?? 0, s.firstTry) } }));
    progressStore.flush();
    let best: Finished['best'] = null;
    let realImprovement = false;
    const real = s.answered >= ROUND_LENGTH && s.firstTry / Math.max(1, s.answered) >= 0.8;
    if (!practice) {
      const key = `logic:${mode}`;
      if (s.firstTry >= 8) {
        const b = rewards.recordBest(key, s.firstTry, true);
        best = { label: 'Best first try', value: `${s.firstTry}/${ROUND_LENGTH}`, isNewBest: b.isNewBest, previous: b.previous === null ? null : `${b.previous}/${ROUND_LENGTH}` };
        realImprovement = b.isNewBest && b.previous !== null;
      } else {
        const prev = rewards.getBest(key);
        if (prev !== null) best = { label: 'Best first try', value: `${prev}/${ROUND_LENGTH}`, isNewBest: false, previous: null };
      }
    }
    const firstRound = !practice && real && rewards.claimFirstRound('logic');
    const bonuses = practice
      ? roundBonuses({ newBest: false, answered: 0, correct: 0 })
      : roundBonuses({ newBest: realImprovement, answered: s.answered, correct: s.firstTry, firstRound });
    if (bonuses.total > 0) rewards.addPoints('logic', bonuses.total, 'bonus', 'Round bonus');
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
    if (s.firstTry === ROUND_LENGTH || rankUp || (best?.isNewBest && best.previous !== null)) {
      sfx.play('pb');
      celebrate(s.firstTry === ROUND_LENGTH ? 'big' : 'pb');
    } else {
      sfx.play('roundEnd');
      if (s.firstTry >= 7) celebrate('small');
    }
    if (got.length) later(700, () => sfx.play('trophy'));
    masteryStore('logic').flush();
    setFinished({ bonuses, best, trophies: got, rankUp });
  }, [free, practice, mode, later]);

  const advance = useCallback(
    (fromIndex: number) => {
      const cur = R.current;
      if (cur.over || cur.item?.index !== fromIndex) return;
      if (fromIndex + 1 >= feed.length || !show(fromIndex + 1)) finish();
    },
    [feed, show, finish],
  );

  /** End-of-item bookkeeping shared by "right" and "missed out". */
  const settle = useCallback(
    (p: Puzzle, misses: 0 | 1 | 2) => {
      if (free) return;
      progressStore.update((pr) => adapt(pr, p.family, misses, practice ? 'adaptive' : mode));
    },
    [free, practice, mode],
  );

  const onCorrect = useCallback(
    (anchor: HTMLElement | null) => {
      const cur = R.current;
      const it = cur.item;
      if (!it || (it.phase !== 'ask' && it.phase !== 'retry')) return;
      const p = it.puzzle;
      const ms = Math.max(0, performance.now() - cur.shownAt);
      const s = cur.stats;
      const firstTry = it.misses === 0;
      const combo = firstTry ? s.combo + 1 : 0;
      const pts = free ? 0 : pointsFor({ difficulty: p.difficulty, ms, misses: it.misses, combo, answerKind: p.answer.kind, practice });
      if (pts > 0) {
        rewards.addPoints('logic', pts, 'answer', familyTitle(p.family));
        burstRef.current?.burst(pts, anchor ?? promptRef.current);
        checkGoalAndAnnounce();
      }
      if (!free && firstTry) {
        masteryStore('logic').update((m) =>
          applyMastery(m, { factId: factId(p.family, p.difficulty), correct: true, ms, tier: speedTier(ms, speedFor(p.difficulty)) }, Date.now()),
        );
      }
      settle(p, it.misses);
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
      const marks = p.answer.kind === 'cells' || p.answer.kind === 'sudoku' ? {} : it.marks;
      setItem({ ...it, phase: 'correct', points: pts, marks, note: it.misses ? 'You got it!' : '' });
      // Long enough to notice the "Why?" chip and decide to tap it.
      later(firstTry ? 2400 : 2000, () => {
        const c = R.current.item;
        if (c && c.index === it.index && c.phase === 'correct' && !c.whyOpen) advance(it.index);
      });
    },
    [free, practice, later, settle, advance],
  );

  const onMiss = useCallback(
    (anchor: HTMLElement | null, patch: Partial<Item>) => {
      const cur = R.current;
      const it = cur.item;
      if (!it || (it.phase !== 'ask' && it.phase !== 'retry')) return;
      const p = it.puzzle;
      const s = cur.stats;
      if (!free) {
        rewards.addPoints('logic', -MISS_PENALTY, 'answer', `Miss: ${familyTitle(p.family)}`);
        burstRef.current?.burst(-MISS_PENALTY, anchor ?? promptRef.current);
        if (!cur.firstMissDone) {
          cur.firstMissDone = true;
          masteryStore('logic').update((m) => applyMastery(m, { factId: factId(p.family, p.difficulty), correct: false, ms: 0, tier: 'none' }, Date.now()));
        }
      }
      sfx.play('wrong');
      const misses = (it.misses + 1) as 1 | 2;
      setStats({
        ...s,
        points: s.points - (free ? 0 : MISS_PENALTY),
        combo: 0,
        missesTotal: s.missesTotal + 1,
        missed: misses === 2 && !s.missed.includes(p) ? [...s.missed, p] : s.missed,
        answered: s.answered + (misses === 2 ? 1 : 0),
      });
      if (misses === 2) {
        settle(p, 2);
        setItem({ ...it, ...patch, misses, phase: 'coach' });
      } else {
        setItem({ ...it, ...patch, misses, phase: 'retry' });
      }
    },
    [free, settle],
  );

  // ---- answer handlers -----------------------------------------------------------------------

  const pick = useCallback(
    (i: number, el: HTMLElement) => {
      const it = R.current.item;
      if (!it || it.puzzle.answer.kind !== 'choice' || (it.phase !== 'ask' && it.phase !== 'retry')) return;
      if (performance.now() - R.current.shownAt < MASH_MS || it.wrong.includes(i)) return;
      sfx.unlock();
      if (i === it.puzzle.answer.answerIndex) onCorrect(el);
      else onMiss(el, { wrong: [...it.wrong, i], note: it.puzzle.answer.options[i].why && it.misses === 0 ? 'Not that one — look again!' : '' });
    },
    [onCorrect, onMiss],
  );

  const typeDigit = useCallback(
    (d: string) => {
      const it = R.current.item;
      if (!it || it.puzzle.answer.kind !== 'number' || (it.phase !== 'ask' && it.phase !== 'retry')) return;
      const a = it.puzzle.answer;
      const input = (it.input + d).replace(/^0+(?=\d)/, '');
      const max = a.maxDigits ?? digits(a.answer);
      if (input === String(a.answer)) {
        setItem({ ...it, input });
        R.current.item = { ...it, input };
        onCorrect(null);
      } else if (input.length >= max) {
        onMiss(null, { input: '', note: `Not ${input}` });
      } else setItem({ ...it, input, note: '' });
    },
    [onCorrect, onMiss],
  );
  const backspace = () => setItem((it) => (it ? { ...it, input: it.input.slice(0, -1) } : it));
  const clear = () => setItem((it) => (it ? { ...it, input: '' } : it));
  const submit = () => {
    const it = R.current.item;
    if (!it || it.puzzle.answer.kind !== 'number' || !it.input) return;
    if (it.input === String(it.puzzle.answer.answer)) onCorrect(null);
    else onMiss(null, { input: '', note: `Not ${it.input}` });
  };

  /** Functional item update that also keeps the ref in step (taps can arrive faster than renders). */
  const patchItem = useCallback((fn: (it: Item) => Item | null) => {
    const it = R.current.item;
    if (!it) return;
    const next = fn(it);
    if (!next) return;
    R.current.item = next;
    setItem(next);
  }, []);

  const tapCell = useCallback(
    (key: string) =>
      patchItem((it) => {
        if (it.phase !== 'ask' && it.phase !== 'retry') return null;
        const a = it.puzzle.answer;
        if (a.kind === 'cells') {
          sfx.play('pop', 0.5);
          const pal = a.palette;
          const cur = it.fills[key];
          const nextC = pal.length === 1 ? (cur ? undefined : pal[0]) : cur === undefined ? pal[0] : pal[pal.indexOf(cur) + 1];
          return { ...it, fills: { ...it.fills, [key]: nextC }, marks: { ...it.marks, [key]: undefined }, note: '' };
        }
        if (a.kind === 'sudoku') {
          if (sudokuKeyAt(a, key)) return null;
          sfx.play('pop', 0.5);
          const marks: Item['marks'] = {};
          for (const [k, v] of Object.entries(it.marks)) if (v === 'bad') marks[k] = v;
          marks[key] = 'sel';
          return { ...it, selected: key, marks, note: '' };
        }
        return null;
      }),
    [patchItem],
  );

  const putSymbol = (k: string | undefined) =>
    patchItem((it) => {
      if (!it.selected || (it.phase !== 'ask' && it.phase !== 'retry')) return null;
      sfx.play('pop', 0.6);
      const marks = { ...it.marks };
      marks[it.selected] = 'sel';
      return { ...it, sym: { ...it.sym, [it.selected]: k }, marks, note: '' };
    });

  const check = () => {
    const it = R.current.item;
    if (!it || (it.phase !== 'ask' && it.phase !== 'retry')) return;
    const a = it.puzzle.answer;
    const btn = document.querySelector<HTMLElement>('[data-testid="check"]');
    if (a.kind === 'cells') {
      const locked = new Set(a.locked ?? []);
      const set = Object.entries(it.fills).filter(([k, v]) => v && !locked.has(k));
      if (!set.length) {
        setItem({ ...it, note: 'Tap the squares first!' });
        return;
      }
      // Locked squares count as already painted (whatever the picture shows there).
      const shown = new Map<string, Color | undefined>();
      const g = it.puzzle.visual.nodes.find((n) => n.t === 'grid' && n.id === a.gridId);
      if (g && g.t === 'grid') for (const c of g.cells ?? []) shown.set(`${c.r},${c.c}`, c.fill);
      const eff = (k: string) => (locked.has(k) ? shown.get(k) : it.fills[k]);
      const wrongCells = set.filter(([k, v]) => a.target[k] !== v).map(([k]) => k);
      const missing = Object.keys(a.target).filter((k) => eff(k) !== a.target[k] && !wrongCells.includes(k));
      if (!wrongCells.length && !missing.length) onCorrect(btn);
      else {
        const marks: Item['marks'] = {};
        for (const k of wrongCells) marks[k] = 'bad';
        onMiss(btn, { marks, note: wrongCells.length ? 'The red squares are wrong' : 'Not yet — some squares are missing' });
      }
    } else if (a.kind === 'sudoku') {
      const blanks = a.givens.flatMap((row, r) => row.map((g, c) => (g ? null : `${r},${c}`))).filter((k): k is string => k !== null);
      if (blanks.some((k) => !it.sym[k])) {
        setItem({ ...it, note: 'Fill every square first!' });
        return;
      }
      const ok = blanks.every((k) => {
        const [r, c] = k.split(',').map(Number);
        return a.solution[r][c] === it.sym[k];
      });
      if (ok) onCorrect(btn);
      else {
        const bad = sudokuConflicts(a, it.sym);
        const marks: Item['marks'] = {};
        for (const k of bad) marks[k] = 'bad';
        onMiss(btn, { marks, selected: null, note: bad.length ? 'Red squares clash with another one' : 'Not quite' });
      }
    }
  };

  const closeCoach = () => {
    const it = R.current.item;
    if (!it) return;
    stopSpeaking();
    if (it.phase === 'coach') {
      if (!free) markTipSeen(it.puzzle.family);
      advance(it.index);
    } else if (it.phase === 'correct') {
      setItem({ ...it, whyOpen: false });
      advance(it.index);
    }
  };

  // ---- render --------------------------------------------------------------------------------

  const style = { ['--k-app' as string]: 'var(--k-app-logic)' } as CSSProperties;
  const title = (
    <>
      <span className="k-emoji">🧠</span> {free ? 'All the puzzles' : practice && only ? familyTitle(only) : 'Brain Puzzles'}
    </>
  );

  if (empty) {
    return (
      <div className="k-screen lg-screen" style={style}>
        <TopBar onBack={onExit} title={title} points={today} />
        <main className="lg-empty">
          <p>These puzzles are still being built. Try another one!</p>
          <BigButton onClick={onExit}>Back</BigButton>
        </main>
      </div>
    );
  }

  if (finished) {
    const s = stats;
    const bo = finished.bonuses;
    const bonusLines: Array<{ label: string; points: number; emoji?: string }> = [];
    if (bo.firstRound) bonusLines.push({ label: 'First round today', points: bo.firstRound, emoji: '🌅' });
    if (bo.newBest) bonusLines.push({ label: 'New record', points: bo.newBest, emoji: '🏆' });
    if (bo.perfect) bonusLines.push({ label: 'Perfect', points: bo.perfect, emoji: '💯' });
    const total = feed.length;
    return (
      <div className="k-screen lg-screen lg-summary" style={style} data-testid="logic-summary">
        <TopBar onBack={onExit} title={title} points={today} />
        <RoundSummary
          title={free ? 'That’s every puzzle!' : s.firstTry === total ? 'Big brain!' : 'Nice thinking!'}
          emoji={s.firstTry === total ? '🏆' : '🧠'}
          pointsEarned={free ? 0 : Math.max(0, s.points) + bo.total}
          bonusLines={bonusLines}
          best={finished.best ?? undefined}
          bestNote={!free && !practice && s.firstTry < 8 ? 'Get 8 or more right first try to set a record!' : undefined}
          trophies={finished.trophies}
          rankUp={finished.rankUp}
          stats={[
            { label: 'First try', value: `${s.firstTry}/${total}`, emoji: '🎯', highlight: s.firstTry === total },
            { label: 'Misses', value: s.missesTotal, emoji: '❌' },
            { label: 'Best streak', value: s.bestCombo, emoji: '🔥' },
          ]}
          onAgain={() => {
            R.current.timers.forEach((t) => clearTimeout(t));
            R.current.timers = [];
            setItem(null);
            setRoundNo((n) => n + 1);
          }}
          onHome={onExit}
        >
          {s.missed.length > 0 && (
            <div className="lg-remember" data-testid="remember">
              <div className="lg-remember__t">
                <span className="k-emoji">🧠</span> Remember
              </div>
              <div className="lg-remember__chips">
                {s.missed.map((p) => (
                  <span key={p.id} className="lg-remember__chip">
                    <span className="k-emoji">{familyEmoji(p.family)}</span> {p.rule}
                  </span>
                ))}
              </div>
            </div>
          )}
        </RoundSummary>
      </div>
    );
  }

  const p = item?.puzzle;
  const a = p?.answer;
  const live = item && (item.phase === 'ask' || item.phase === 'retry');
  const answerIdx = a?.kind === 'choice' ? a.answerIndex : null;
  const showRight = item && (item.phase === 'correct' || item.phase === 'coach') ? answerIdx : null;

  // Interactive grids: overlay edits on the puzzle picture.
  let edit: GridEdit | undefined;
  if (p && item && a?.kind === 'cells') {
    const ca = a as CellsAnswer;
    const reveal = item.phase === 'coach' || item.phase === 'correct';
    edit = {
      gridId: ca.gridId,
      fills: reveal ? { ...item.fills, ...ca.target } : item.fills,
      marks: item.marks,
      locked: new Set(ca.locked ?? []),
      onCell: live ? tapCell : undefined,
    };
  } else if (p && item && a?.kind === 'sudoku') {
    const sa = a as SudokuAnswer;
    const reveal = item.phase === 'coach';
    const nodes: GridEdit['nodes'] = {};
    const labels: GridEdit['labels'] = {};
    sa.givens.forEach((row, r) =>
      row.forEach((g, c) => {
        if (g) return;
        const key = `${r},${c}`;
        const v = reveal ? sa.solution[r][c] : item.sym[key];
        const look = v ? sudokuNode(p, v) : {};
        nodes[key] = 'node' in look ? look.node : undefined;
        labels[key] = 'label' in look ? look.label : '';
      }),
    );
    const locked = new Set(sa.givens.flatMap((row, r) => row.map((g, c) => (g ? `${r},${c}` : ''))).filter(Boolean));
    edit = { gridId: sa.gridId, nodes, labels, marks: item.marks, locked, onCell: live ? tapCell : undefined };
  }

  let answerArea: ReactNode = null;
  if (p && item && a) {
    if (a.kind === 'choice') {
      answerArea = <ChoiceGrid options={a.options} wrong={item.wrong} right={showRight} onPick={pick} disabled={!live} />;
    } else if (a.kind === 'number') {
      answerArea = (
        <div className="lg-numpad">
          <div className={`lg-entry${item.phase === 'correct' ? ' is-right' : ''}${item.note ? ' is-bad' : ''}`} data-testid="entry" aria-live="polite">
            {item.phase === 'coach' ? a.answer : item.input || '?'}
          </div>
          <Keypad value={item.input} onDigit={typeDigit} onBackspace={backspace} onClear={clear} onSubmit={submit} disabled={!live} keyboard={Boolean(live)} hideSubmit={false} size="md" />
        </div>
      );
    } else if (a.kind === 'cells') {
      const pal = a.palette;
      answerArea = (
        <div className="lg-check">
          <p className="lg-check__hint">
            {pal.length === 1 ? 'Tap squares to colour them. Tap again to clear.' : 'Tap a square to change its colour.'}
          </p>
          <BigButton size="xl" onClick={check} disabled={!live} data-testid="check">
            Check ✓
          </BigButton>
        </div>
      );
    } else if (a.kind === 'sudoku') {
      const filled = a.givens.every((row, r) => row.every((g, c) => g || item.sym[`${r},${c}`]));
      answerArea = (
        <div className="lg-check">
          <p className="lg-check__hint">{item.selected ? 'Now pick what goes there.' : 'Tap an empty square, then pick.'}</p>
          <div className="lg-tray" data-testid="tray" role="group" aria-label="Pick what goes in the square">
            {a.symbols.map((s) => (
              <button
                key={s.key}
                type="button"
                className="lg-tray__chip"
                data-testid={`sym-${s.key}`}
                disabled={!live || !item.selected}
                onClick={() => putSymbol(s.key)}
                aria-label={s.label ?? s.key}
              >
                {s.visual ? <Visual spec={s.visual} size="sm" testId="sym-visual" /> : <span className={p.variant === 'fruit' ? 'k-emoji' : ''}>{s.label ?? s.key}</span>}
              </button>
            ))}
            <button type="button" className="lg-tray__chip lg-tray__erase" disabled={!live || !item.selected} onClick={() => putSymbol(undefined)} aria-label="Clear square">
              ⌫
            </button>
          </div>
          <BigButton size="xl" onClick={check} disabled={!live || !filled} data-testid="check">
            Check ✓
          </BigButton>
        </div>
      );
    }
  }

  const coachAnswer = (): ReactNode => {
    if (!p || !a) return null;
    if (a.kind === 'choice') {
      const o = a.options[a.answerIndex];
      return o.visual ? <Visual spec={o.visual} size="sm" testId="coach-answer-visual" /> : <span className="lg-coach__big">{o.text}</span>;
    }
    if (a.kind === 'number') return <span className="lg-coach__big">{a.answer}</span>;
    return <Visual spec={p.visual} edit={edit} testId="coach-answer-visual" />;
  };

  const coachOpen = item && (item.phase === 'coach' || item.whyOpen);
  const tipsSeen = uiStore.get().tipsSeen;
  const tip = p && item?.phase === 'coach' && !tipsSeen.includes(p.family) ? FAMILY_META[p.family].tip : undefined;
  const fam = p?.family;
  const visualRatio = p ? p.visual.h / p.visual.w : 1;
  // compact: the picture is only a banner and the options are the puzzle (odd-one-out);
  // wide: a long, low picture (sequences, analogies) reads best above the answers.
  const compactStage = Boolean(p && p.visual.h <= 64 && a?.kind === 'choice');
  const wideStage = !compactStage && visualRatio < 0.45;

  return (
    <div
      className={`k-screen lg-screen lg-play${compactStage ? ' lg-play--compact' : ''}${wideStage ? ' lg-play--wide' : ''} lg-play--${a?.kind ?? 'none'}`}
      style={style}
      data-testid="logic-play"
      data-kind={kind}
    >
      <TopBar
        onBack={onExit}
        title={title}
        center={
          <div className="lg-dots" data-testid="round-progress" aria-label={`Puzzle ${(item?.index ?? 0) + 1} of ${feed.length}`}>
            {feed.length <= 12 &&
              Array.from({ length: feed.length }, (_, i) => (
                <span key={i} className={`lg-dot${item && i < item.index + (item.phase === 'correct' || item.phase === 'coach' ? 1 : 0) ? ' is-done' : ''}${item && i === item.index ? ' is-now' : ''}`} />
              ))}
            <span className="lg-dots__n k-num">
              {(item?.index ?? 0) + 1}/{feed.length}
            </span>
          </div>
        }
        points={today}
        combo={stats.combo}
        comboMultiplier={comboMultiplier(stats.combo)}
      />
      {p && item && (
        <main className="lg-body">
          <section className="lg-stage">
            <div
              className={`lg-prompt is-${item.phase}`}
              ref={promptRef}
              data-testid="prompt"
              data-q={item.index}
              data-family={p.family}
              data-difficulty={p.difficulty}
              data-variant={p.variant}
              data-answer-kind={a?.kind}
              data-phase={item.phase}
              data-answer={import.meta.env.DEV && a ? devAnswer(a) : undefined}
            >
              <span className="lg-prompt__fam k-emoji" title={fam ? familyTitle(fam) : ''} aria-hidden="true">
                {fam ? familyEmoji(fam) : ''}
              </span>
              <span className="lg-prompt__text">{p.prompt}</span>
              <button type="button" className="lg-say" aria-label="Read it to me" data-testid="say" onClick={() => speak(p.speak ?? p.prompt)}>
                <span className="k-emoji">🔊</span>
              </button>
              {!free && (
                <span className="lg-round-pts k-num" data-testid="round-points" aria-label="Points this round">
                  <span className="k-emoji">⭐</span> {stats.points}
                </span>
              )}
            </div>
            <div className="lg-visual-wrap" key={p.id}>
              <Visual spec={p.visual} edit={edit} size="lg" testId="stage-visual" />
            </div>
            <div className={`lg-note${item.phase === 'correct' ? ' is-good' : ''}`} data-testid="note" aria-live="polite">
              {item.phase === 'correct' ? (
                <>
                  <span>
                    <span className="k-emoji">🎉</span> {item.note || (item.points >= 40 ? 'Brilliant!' : 'Yes!')}
                  </span>
                  <button
                    type="button"
                    className="lg-why"
                    data-testid="why"
                    onClick={() => {
                      sfx.play('click');
                      setItem({ ...item, whyOpen: true });
                    }}
                  >
                    <span className="k-emoji">🧠</span> Why?
                  </button>
                </>
              ) : (
                item.note || (item.phase === 'retry' ? 'Try once more!' : ' ')
              )}
            </div>
          </section>
          <section className="lg-answer">{answerArea}</section>
        </main>
      )}
      {coachOpen && p && item && (
        <BrainCoach puzzle={p} answer={coachAnswer()} tip={tip} afterCorrect={item.phase === 'correct'} onClose={closeCoach} />
      )}
      <PointsBurst ref={burstRef} />
    </div>
  );
}
