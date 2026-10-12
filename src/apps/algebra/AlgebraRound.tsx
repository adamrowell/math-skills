import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import {
  BigButton,
  Keypad,
  PlayButton,
  PointsBurst,
  RoundSummary,
  TopBar,
  celebrate,
  consumeAutostart,
  sfx,
  updateSettings,
  useSettings,
  useTodayPoints,
} from '../../core';
import type { PointsBurstHandle, RoundSummaryStat } from '../../core';
import { formatSeconds } from '../../drill';
import { suppressVoice, useVoiceInput, voiceImplemented, MicChip, MicPanel, heardChipFor } from '../../voice';
import { Equation } from './Equation';
import { QUESTIONS_PER_SET, levelDef } from './problems';
import type { LevelId, Problem } from './problems';
import { progressStore, markSeen } from './progress';
import { useAlgebraRound } from './useAlgebraRound';
import type { AlgebraAnswer, AlgebraRoundState } from './useAlgebraRound';
import { Explainer } from './Explainer';
import { explainerFor } from './explainerKind';
import { comboMultiplierFor } from './scoring';
import './algebra.css';

interface Props {
  level: LevelId;
  onExit: () => void;
  onPlayLevel: (level: LevelId) => void;
}

function Dots({ answers, index, total }: { answers: AlgebraAnswer[]; index: number; total: number }) {
  return (
    <div className="al-dots" aria-label={`Question ${Math.min(index + 1, total)} of ${total}`} data-testid="progress">
      {Array.from({ length: total }, (_, i) => {
        const a = answers[i];
        const cls = a ? (a.solvedOn === 1 ? 'is-1' : a.solvedOn === 2 ? 'is-2' : 'is-0') : i === index ? 'is-now' : '';
        return <span key={i} className={`al-dot ${cls}`} />;
      })}
      <span className="al-dots__n k-num">
        {Math.min(index + 1, total)}/{total}
      </span>
    </div>
  );
}

function unknownName(p: Problem): string {
  const k = p.ask?.[0];
  return k?.t === 'pic' ? k.v : k ? 'x' : '☐';
}

function CooldownBar({ until }: { until: number }) {
  const total = Math.max(0, until - performance.now());
  return (
    <div className="al-cool" aria-hidden="true">
      <div className="al-cool__fill" style={{ animationDuration: `${total}ms` }} />
    </div>
  );
}

function ProblemView({ problem, state }: { problem: Problem; state: AlgebraRoundState }) {
  const slotState = state.status === 'correct' ? 'correct' : state.status === 'cooldown' || state.status === 'solution' ? 'wrong' : 'idle';
  const slot = { input: state.input, state: slotState } as const;
  const many = problem.lines.length > 1;
  const solved = state.status === 'correct';
  return (
    <div className="al-problem" data-eq={problem.eq} data-testid="equation" aria-label={problem.text}>
      {many && (
        <div className="al-puzzle-label">
          <span className="k-emoji">🔎</span> Crack the code
        </div>
      )}
      <Equation lines={problem.lines} slot={problem.ask ? null : slot} size={many ? 'mid' : 'hero'} className={many ? 'al-eqs--puzzle' : ''} />
      {problem.ask && (
        <div className={`al-ask${solved ? ' is-solved' : ''}`}>
          <Equation lines={[problem.ask]} slot={slot} size={many ? 'big' : 'hero'} />
        </div>
      )}
    </div>
  );
}

function Solution({ problem, onNext }: { problem: Problem; onNext: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 300 + problem.steps.length * 450);
    return () => clearTimeout(t);
  }, [problem]);
  return (
    <div className="al-solution" data-testid="solution">
      <div className="al-solution__head">
        <span className="k-emoji">🧠</span> Let's work it out
      </div>
      <Equation lines={problem.lines} size="mid" className="al-solution__problem" />
      <ol className="al-steps">
        {problem.steps.map((s, i) => (
          <li key={i} className="al-step" style={{ animationDelay: `${i * 450}ms` }}>
            <Equation lines={[s.eq]} size="small" />
            {s.note && <span className="al-step__note">{s.note}</span>}
          </li>
        ))}
      </ol>
      <BigButton
        size="lg"
        className="al-next"
        onClick={() => armed && onNext()}
        aria-disabled={!armed}
        data-testid="next"
      >
        Got it! Next <span aria-hidden="true">➜</span>
      </BigButton>
    </div>
  );
}

export function AlgebraRound({ level, onExit, onPlayLevel }: Props) {
  const def = levelDef(level);
  const settings = useSettings();
  const today = useTodayPoints();
  const seen = progressStore.useStore((p) => p.seen);
  const burstRef = useRef<PointsBurstHandle>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  const quietMic = useCallback(() => {
    try {
      if (voiceImplemented) suppressVoice(250);
    } catch {
      /* optional */
    }
  }, []);
  const round = useAlgebraRound(level, {
    onCorrect: (pts) => {
      quietMic();
      if (pts > 0) burstRef.current?.burst(pts, cardRef.current);
    },
    onWrong: quietMic,
  });
  const { state } = round;
  const finished = state.status === 'finished';
  const playing = !finished && state.status !== 'ready';

  const voiceOn = voiceImplemented && settings.voice.enabled;
  const answer = state.problem?.answer;
  const bias = useMemo(() => (answer === undefined ? undefined : { numbers: [answer] }), [answer]);
  const voice = useVoiceInput({ enabled: voiceOn && !finished, mode: 'number', bias, onTranscript: round.onVoiceTranscript });
  const showMic = voiceImplemented && voice.isSupported && !(voice.error && !voice.error.recoverable);

  const startMic = useCallback(() => {
    if (!voiceImplemented) return;
    try {
      void voice.start().catch(() => {});
    } catch {
      /* mic is optional */
    }
  }, [voice]);

  const explainer = explainerFor(level, seen);

  const go = useCallback(() => {
    sfx.unlock();
    if (voiceOn) {
      startMic();
      if (!settings.voice.askedMic) updateSettings({ voice: { ...settings.voice, askedMic: true } });
    }
    if (def.paper) {
      sfx.play('combo', 0.7);
      round.start();
    } else {
      sfx.play('tick');
      setCountdown(3);
    }
  }, [voiceOn, startMic, def.paper, round, settings.voice]);

  // `round` is a new object every render (mic level updates re-render ~60×/s): keep the countdown
  // timer keyed on the digit only, or it would be reset before it ever fires.
  const roundStartRef = useRef(round.start);
  useEffect(() => {
    roundStartRef.current = round.start;
  });
  useEffect(() => {
    if (countdown === null) return;
    const t = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        sfx.play('combo', 0.7);
        roundStartRef.current();
      } else {
        sfx.play('tick');
        setCountdown(countdown - 1);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [countdown]);

  // PLAY on the home was the gesture: skip the ready card (UX-V3 §2.3).
  const [autoPending, setAutoPending] = useState(() => consumeAutostart());
  useEffect(() => {
    if (!autoPending || state.status !== 'ready' || countdown !== null || explainer) return;
    setAutoPending(false);
    go();
  }, [autoPending, state.status, countdown, explainer, go]);

  // Ready screen: Enter / Space starts (or closes the explainer).
  useEffect(() => {
    if (state.status !== 'ready' || countdown !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (explainer) markSeen(explainer);
        else go();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status, countdown, go, explainer]);

  // Solution card: Enter / Space = Next (the keypad is off there).
  useEffect(() => {
    if (state.status !== 'solution') return;
    const armedAt = performance.now() + 600;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && performance.now() > armedAt) {
        e.preventDefault();
        round.next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status, round]);

  // Round end: release the mic, celebrate.
  const stopRef = useRef(voice.stop);
  useEffect(() => {
    stopRef.current = voice.stop;
  });
  useEffect(() => {
    if (!finished) return;
    stopRef.current();
    if (state.endReason !== 'complete') return;
    const first = state.answers.filter((a) => a.solvedOn === 1).length;
    if (state.unlocked || (state.best?.isNewBest && state.best.previous !== null) || state.rankUp) celebrate('pb');
    else if (first >= 8) celebrate('small');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);
  useEffect(() => () => stopRef.current(), []);

  // Streak milestones: a big word over the card.
  const lastCombo = useRef(0);
  useEffect(() => {
    if (state.combo > lastCombo.current && state.combo >= 3 && state.combo % (def.paper ? 3 : 5) === 0) {
      burstRef.current?.shout(`${state.combo} in a row!`, cardRef.current);
    }
    lastCombo.current = state.combo;
  }, [state.combo, def.paper]);

  const stopRound = () => {
    setConfirmStop(false);
    const answered = state.answers.length;
    round.end();
    if (answered === 0) onExit();
  };
  const leave = () => {
    if (playing) {
      setConfirmStop(true);
      return;
    }
    if (countdown !== null) setCountdown(null);
    onExit();
  };

  const toggleMic = () => {
    sfx.unlock();
    if (settings.voice.enabled && (voice.status === 'error' || voice.error)) {
      startMic();
      return;
    }
    const nextOn = !settings.voice.enabled;
    flushSync(() => updateSettings({ voice: { ...settings.voice, enabled: nextOn, askedMic: true } }));
    if (nextOn) startMic();
    else voice.stop();
  };

  const center = playing ? (
    <div className="al-center">
      {!def.paper ? (
        <span className="al-clock k-num" data-testid="stopwatch">
          ⏱ {formatSeconds(state.elapsedMs)}
        </span>
      ) : (
        <span className="al-paper-chip" data-testid="paper-chip">
          <span className="k-emoji">✏️</span> No clock
        </span>
      )}
    </div>
  ) : null;

  // ---- summary ----
  const summary = useMemo(() => {
    if (!finished) return null;
    const n = state.answers.length;
    const first = state.answers.filter((a) => a.solvedOn === 1).length;
    const quit = state.endReason === 'quit';
    const stats: RoundSummaryStat[] = [
      { label: 'Right first try', value: `${first}/${n}`, emoji: '✅', highlight: true },
    ];
    if (!def.paper) stats.push({ label: 'Time', value: formatSeconds(state.elapsedMs), emoji: '⏱️' });
    stats.push({ label: def.paper ? 'Best streak' : 'Best combo', value: state.bestCombo, emoji: '🔥' });
    const second = state.answers.filter((a) => a.solvedOn === 2).length;
    if (second) stats.push({ label: 'After a hint', value: second, emoji: '💡' });
    const b = state.best;
    let best: { label: string; value: string | number; isNewBest: boolean; previous: string | number | null } | undefined;
    let bestNote: string | undefined;
    const fmt = (v: number) => (b?.kind === 'time' ? formatSeconds(v) : String(v));
    if (b && !quit) {
      const real = b.isNewBest && b.previous !== null;
      if (b.isNewBest) best = { label: b.previous === null ? 'Your best so far' : 'Your best', value: b.previous === null && b.kind !== 'time' ? `${fmt(b.value)} in a row` : fmt(b.value), isNewBest: real, previous: b.previous === null ? null : fmt(b.previous) };
      else if (b.previous !== null) best = { label: b.kind === 'time' ? 'Best time' : 'Best streak', value: fmt(b.previous), isNewBest: false, previous: null };
      if (b.kind === 'time' && !(first === n && n >= QUESTIONS_PER_SET)) bestNote = 'Get all 10 right first try to set a time record!';
    }
    const missed = state.answers.filter((a) => a.solvedOn !== 1).slice(0, 4);
    const title = quit ? 'Good try!' : state.unlocked ? 'Level up!' : first === n && n > 0 ? 'Perfect!' : first >= 7 ? 'Great thinking!' : 'Nice work!';
    const emoji = quit ? '👍' : state.unlocked ? '🔓' : first === n ? '💯' : '🧠';
    return { stats, best, bestNote, missed, title, emoji };
  }, [finished, state, def.paper]);

  const style = { ['--k-app' as string]: 'var(--k-app-algebra)' } as CSSProperties;
  const p = state.problem;
  const keypadOn = state.status === 'running';
  const lastAnswer = state.answers[state.answers.length - 1];
  const typedCount = state.answers.filter((a) => a.via !== 'voice').length;
  const algebraHeard =
    state.status === 'correct' && lastAnswer?.via === 'voice'
      ? heardChipFor({ verdict: 'correct', text: lastAnswer.problem.answer })
      : (state.status === 'cooldown' || state.status === 'solution') && state.givenVia === 'voice'
        ? heardChipFor({ verdict: 'wrong', text: state.given })
        : state.unclear
          ? heardChipFor({ verdict: 'unclear', text: state.pendingPartial ?? state.heard, partial: !!state.pendingPartial })
          : null;

  return (
    <div className="k-screen al-screen k-noselect" style={style} data-testid="algebra-round" data-level={level}>
      <TopBar
        onBack={leave}
        title={playing || finished ? undefined : `Level ${level}`}
        center={center}
        right={showMic ? <MicChip voice={voice} on={settings.voice.enabled} onToggle={toggleMic} typed={typedCount} /> : undefined}
        points={today}
        combo={state.combo}
        comboMultiplier={comboMultiplierFor(state.combo)}
      />

      <main className="al-body">
        <div className="al-stage">
          {state.status === 'ready' ? (
            <div className="al-card al-ready" data-testid="ready">
              {countdown !== null ? (
                <div className="al-countdown k-num" key={countdown} data-testid="countdown">
                  {countdown}
                </div>
              ) : explainer ? (
                <Explainer kind={explainer} onDone={() => markSeen(explainer)} />
              ) : autoPending ? null : (
                <>
                  <div className="al-ready__badge">
                    <span className="k-emoji">{def.emoji}</span> Level {level}
                  </div>
                  <div className="al-ready__title">{def.title}</div>
                  <Equation lines={[def.example]} size="big" />
                  {def.paper ? (
                    <div className="al-ready__paper" data-testid="paper-note">
                      <span className="k-emoji">✏️</span> Take your time — use paper!
                      <small>No clock. Every right answer in a row is worth more.</small>
                    </div>
                  ) : (
                    <div className="al-ready__desc">10 questions · fast answers earn more ⚡</div>
                  )}
                  <PlayButton variant="go" onClick={go} data-testid="go" />
                  {showMic && voiceOn && (
                    <div className="al-ready__desc" data-testid="voice-note">
                      Type it or say it <span className="k-emoji">👂</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : p ? (
            <div
              ref={cardRef}
              className={`al-card al-play is-${state.status}`}
              data-testid="problem-card"
              data-status={state.status}
              data-q={state.index}
              data-attempt={state.attempt}
            >
              <div className="al-card__top">
                <Dots answers={state.answers} index={state.index} total={QUESTIONS_PER_SET} />
                <div className="al-score" aria-label={`${state.points} points this round`}>
                  <span className="k-emoji">⭐</span>{' '}
                  <span className="k-num" data-testid="round-points" key={state.points}>
                    {state.points}
                  </span>
                </div>
              </div>

              {state.status === 'solution' ? (
                <Solution problem={p} onNext={round.next} />
              ) : (
                <>
                  <div className={`al-problem-wrap${state.status === 'cooldown' ? ' do-shake' : ''}`} key={`${state.index}-${state.nudge}`}>
                    <ProblemView problem={p} state={state} />
                  </div>
                  <div className="al-feedback">
                    {state.attempt === 2 && state.status !== 'correct' ? (
                      <div className="al-hint" data-testid="hint">
                        {state.given !== null && (
                          <div className="al-hint__not">
                            {state.givenVia === 'voice' ? 'I heard' : 'Not'} <s className="k-num">{state.given}</s> — one more try!
                          </div>
                        )}
                        <div className="al-hint__tip">
                          <span className="k-emoji">💡</span> {p.hint}
                        </div>
                        {state.status === 'cooldown' && state.cooldownUntil && <CooldownBar until={state.cooldownUntil} key={state.cooldownUntil} />}
                      </div>
                    ) : state.status === 'correct' ? (
                      <div className="al-yay" data-testid="yay">
                        <span className="k-emoji">🎉</span> {state.attempt === 2 ? 'You got it!' : state.lastMult > 1 ? `Yes! ${def.paper ? 'Streak' : 'Combo'} ×${state.lastMult.toFixed(state.lastMult % 1 ? 1 : 0)}` : 'Yes!'}
                      </div>
                    ) : def.paper && state.index === 0 && !state.input ? (
                      <div className="al-tip">✏️ Work it out on paper, then type it.</div>
                    ) : null}
                  </div>
                  {showMic && voiceOn && <MicPanel voice={voice} on={settings.voice.enabled} heard={algebraHeard} typed={typedCount} />}
                </>
              )}
            </div>
          ) : null}
        </div>
        <div className="al-pad">
          <Keypad
            value={state.input}
            onDigit={(d) => round.typeDigit(d, 'keypad')}
            onBackspace={round.backspace}
            onClear={round.clear}
            onSubmit={round.submit}
            disabled={!keypadOn}
            keyboard={playing}
          />
        </div>
      </main>

      {confirmStop && (
        <div className="al-pause" data-testid="paused">
          <div className="al-pause__card">
            <div className="k-emoji al-pause__emoji">⏸️</div>
            <div className="al-pause__title">Stop this set?</div>
            <div className="al-pause__sub">Points you earned are kept.</div>
            <BigButton size="xl" onClick={() => setConfirmStop(false)} data-testid="resume">
              Keep going
            </BigButton>
            <BigButton size="md" variant="ghost" onClick={stopRound} data-testid="stop">
              Stop
            </BigButton>
          </div>
        </div>
      )}

      <PointsBurst ref={burstRef} />

      {finished && summary && (
        <RoundSummary
          title={summary.title}
          emoji={summary.emoji}
          stats={summary.stats}
          pointsEarned={state.points}
          best={summary.best}
          bestNote={summary.bestNote}
          bonusLines={state.bonusLines}
          trophies={state.trophies}
          rankUp={state.rankUp}
          onAgain={() => {
            round.reset();
            go();
          }}
          onHome={onExit}
        >
          {state.unlocked && (
            <div className="al-unlock" data-testid="unlocked">
              <div className="al-unlock__title">
                <span className="k-emoji">🔓</span> Level {state.unlocked} unlocked: {levelDef(state.unlocked).title}!
              </div>
              <BigButton size="lg" variant="accent" onClick={() => onPlayLevel(state.unlocked as LevelId)} data-testid="next-level">
                Play Level {state.unlocked} <span aria-hidden="true">➜</span>
              </BigButton>
            </div>
          )}
          {summary.missed.length > 0 && (
            <div className="al-remember">
              <div className="al-remember__label">🧠 Remember</div>
              <div className="al-remember__list">
                {summary.missed.map((a, i) => (
                  <span key={i} className="al-remember__chip k-num">
                    {a.problem.lines.length === 1 && <span className="al-remember__eq">{a.problem.text}</span>}
                    <b>
                      {unknownName(a.problem)} = {a.problem.answer}
                    </b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </RoundSummary>
      )}
    </div>
  );
}
