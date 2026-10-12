import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import {
  Keypad,
  PointsBurst,
  RoundSummary,
  TopBar,
  BigButton,
  PlayButton,
  CoachMark,
  IdleHint,
  celebrate,
  coachDone,
  consumeAutostart,
  sfx,
  toast,
  updateSettings,
  useCoachPending,
  useSettings,
  useTodayPoints,
} from '../core';
import type { PointsBurstHandle, RoundSummaryStat } from '../core';
import { suppressVoice, useVoiceInput, voiceImplemented, MicChip, MicPanel, MicReadyNote, heardChipFor } from '../voice';
import type { UseVoiceInputResult } from '../voice';
import type { DrillScreenProps } from './types';
import { useDrillRound } from './useDrillRound';
import { comboMultiplier } from './scoring';
import { ProblemCard } from './ProblemCard';
import { formatBest } from './formats';
import { formatSeconds } from './util';
import './drill.css';

function TimerBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const frac = Math.max(0, Math.min(1, remainingMs / totalMs));
  const secs = Math.ceil(remainingMs / 1000);
  const low = secs <= 10;
  return (
    <div className={`dr-timer${low ? ' is-low' : ''}`} data-testid="timer" aria-label={`${secs} seconds left`}>
      <div className="dr-timer__track">
        <div className="dr-timer__fill" style={{ transform: `scaleX(${frac})` }} />
      </div>
      <span className="dr-timer__secs k-num">{secs}</span>
    </div>
  );
}

function Progress({ n, total, elapsedMs, stopwatch }: { n: number; total: number; elapsedMs: number; stopwatch: boolean }) {
  return (
    <div className="dr-progress" data-testid="progress">
      <span className="k-num dr-progress__n">
        {Math.min(n, total)} / {total}
      </span>
      {stopwatch && <span className="k-num dr-progress__clock">⏱ {formatSeconds(elapsedMs)}</span>}
    </div>
  );
}

type MicPermission = 'checking' | 'granted' | 'prompt' | 'denied' | 'unknown';

/** Ask the browser whether the mic is already allowed (no prompt). Safari ≥ 16, Chrome. */
function useMicPermission(active: boolean): MicPermission {
  const [state, setState] = useState<MicPermission>('checking');
  useEffect(() => {
    if (!active) return;
    let alive = true;
    try {
      const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
      if (!perms?.query) {
        setState('unknown');
        return;
      }
      perms
        .query({ name: 'microphone' as PermissionName })
        .then((st) => {
          if (alive) setState(st.state === 'granted' ? 'granted' : st.state === 'denied' ? 'denied' : 'prompt');
        })
        .catch(() => alive && setState('unknown'));
    } catch {
      setState('unknown');
    }
    return () => {
      alive = false;
    };
  }, [active]);
  return state;
}

/** Resolve after `p` settles or `ms` passes, whichever is first; reports whether it failed. */
function settleWithin(p: Promise<void>, ms: number): Promise<'ok' | 'error' | 'timeout'> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve('timeout'), ms);
    p.then(
      () => {
        clearTimeout(t);
        resolve('ok');
      },
      () => {
        clearTimeout(t);
        resolve('error');
      },
    );
  });
}

/** What the MicPanel shows about the last utterance (✓ 56 · I heard 54 · ❓ / fifty…). */
function drillHeard(state: ReturnType<typeof useDrillRound>['state'], unclear: boolean) {
  const last = state.answered[state.answered.length - 1];
  if (state.lastVerdict === 'correct' && last?.via === 'voice' && last.correct) return heardChipFor({ verdict: 'correct', text: last.answer, id: state.answered.length });
  if (state.status === 'retype' && last?.via === 'voice' && !last.correct) return heardChipFor({ verdict: 'wrong', text: last.given, id: state.answered.length });
  if (unclear) return heardChipFor({ verdict: 'unclear', text: state.pendingPartial ?? state.heard, partial: !!state.pendingPartial });
  return null;
}

/** One line under the countdown digits: is the mic live yet? */
function CountdownMicLine({ voice, on }: { voice: UseVoiceInputResult; on: boolean }) {
  if (!on) return <div className="dr-countdown__mic" />;
  const s = voice.status;
  const text =
    s === 'listening' || s === 'hearing' || s === 'processing' ? (
      <>
        <span className="k-emoji">👂</span> I'm listening
      </>
    ) : s === 'error' ? null : (
      <>
        <span className="k-emoji">🧠</span> Getting my ears ready…
      </>
    );
  return (
    <div className="dr-countdown__mic" data-testid="countdown-mic">
      {text}
    </div>
  );
}

/** Matches a CSS media query (re-renders on change). */
function useMedia(query: string): boolean {
  const get = () => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  };
  const [m, setM] = useState(get);
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(query);
    } catch {
      return;
    }
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return m;
}

/** In play: after 8 s with nothing typed, a soft nudge under the card (no hand). */
function useNudge(active: boolean, key: string, ms = 8000): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false);
    if (!active) return;
    const t = setTimeout(() => setShow(true), ms);
    return () => clearTimeout(t);
  }, [active, key, ms]);
  return show && active;
}

/**
 * First run on a device: a dedicated tap for the mic permission, so the prompt never lands on a
 * running clock. The ONLY card that ever precedes play after PLAY (UX-V3 §2.3).
 */
function MicStep({ voice, onDone }: { voice: UseVoiceInputResult; onDone: (enabled: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const yesRef = useRef<HTMLButtonElement>(null);
  const ask = () => {
    if (busy) return;
    setBusy(true);
    sfx.unlock();
    // voice.start() must run synchronously inside this tap (iOS).
    let p: Promise<void>;
    try {
      p = voice.start();
    } catch (e) {
      p = Promise.reject(e);
    }
    // Never stare at a dead button: after 3 s the countdown starts anyway and the mic keeps arming
    // (the countdown line and the MicPanel show "Getting my ears ready…" or the error row).
    void settleWithin(p, 3000).then((r) => {
      setBusy(false);
      onDone(r !== 'error');
    });
  };
  return (
    <div className="dr-micstep" data-testid="mic-step">
      <div className="dr-ready__title">Can I listen to your answers?</div>
      <PlayButton
        ref={yesRef}
        variant="mic"
        label={busy ? 'Tap “Allow”…' : 'Yes, turn on my ears'}
        onClick={ask}
        disabled={busy}
        data-testid="mic-allow"
      />
      <BigButton size="md" variant="ghost" onClick={() => onDone(false)} data-testid="mic-skip">
        I'll type instead
      </BigButton>
      <IdleHint target={yesRef} on={!busy} />
    </div>
  );
}

/** A whole fast-facts round: ready → countdown → play → summary. */
export function DrillScreen({ generator, format, setId, title, onExit, onAgain }: DrillScreenProps) {
  const settings = useSettings();
  const today = useTodayPoints();
  const burstRef = useRef<PointsBurstHandle>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  // PLAY on the home was the gesture: skip the ready card (UX-V3 §2.3).
  const [autoPending, setAutoPending] = useState(() => consumeAutostart());
  const goRef = useRef<HTMLButtonElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const phonePortrait = useMedia('(max-width: 480px)');

  // Feedback sounds play while the mic is open: tell the recognizer to ignore them.
  const quietMic = useCallback(() => {
    try {
      if (voiceImplemented) suppressVoice(250);
    } catch {
      /* optional */
    }
  }, []);
  const onCorrect = useCallback(
    (ev: { points: number }) => {
      quietMic();
      if (ev.points > 0) burstRef.current?.burst(ev.points, cardRef.current);
    },
    [quietMic],
  );
  const [confirmStop, setConfirmStop] = useState(false);

  const round = useDrillRound({ generator, format, setId, onCorrect, onWrong: quietMic });
  const { state, extras, start: startRound } = round;

  const voiceOn = voiceImplemented && settings.voice.enabled;
  const answer = state.current?.answer;
  const bias = useMemo(() => (answer === undefined ? undefined : { numbers: [answer] }), [answer]);
  const voice = useVoiceInput({
    enabled: voiceOn,
    mode: 'number',
    // The on-device scorer always scores the expected answer (accuracy + safe "wrong" verdicts).
    bias,
    onTranscript: round.onVoiceTranscript,
  });
  const showMic = voiceImplemented && voice.isSupported && !(voice.error && !voice.error.recoverable);
  const micPerm = useMicPermission(voiceOn && !settings.voice.askedMic);
  // The permission step shows once per device, only while the browser has not said yes yet.
  const needMicStep = showMic && voiceOn && !settings.voice.askedMic && micPerm !== 'granted' && micPerm !== 'checking';
  useEffect(() => {
    if (voiceOn && !settings.voice.askedMic && micPerm === 'granted') {
      updateSettings({ voice: { ...settings.voice, askedMic: true } });
    }
  }, [voiceOn, micPerm, settings.voice]);
  const micStepDone = (enabled: boolean) => {
    updateSettings({ voice: { ...settings.voice, enabled, askedMic: true } });
    if (!enabled) {
      voice.stop();
      toast.show('Okay, typing it is', { emoji: '⌨️' });
    }
    // No second tap: the countdown starts right away.
    sfx.play('tick');
    setCountdown(3);
  };

  const startMic = useCallback(() => {
    if (!voiceImplemented) return;
    try {
      void voice.start().catch(() => {});
    } catch {
      /* mic is optional */
    }
  }, [voice]);

  // GO tap: this handler is the user gesture that unlocks audio and the mic.
  const go = useCallback(() => {
    sfx.unlock();
    if (voiceOn) startMic();
    sfx.play('tick');
    setCountdown(3);
  }, [voiceOn, startMic]);

  // Backgrounded during 3-2-1: go back to the GO screen instead of starting unseen.
  useEffect(() => {
    if (countdown === null) return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') setCountdown(null);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [countdown]);

  useEffect(() => {
    if (countdown === null) return;
    if (document.visibilityState === 'hidden') {
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        sfx.play('combo', 0.7);
        startRound();
      } else {
        sfx.play('tick');
        setCountdown(countdown - 1);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [countdown, startRound]);

  // Autostart: once the mic-permission check has settled, count down without a ready card.
  useEffect(() => {
    if (!autoPending || state.status !== 'ready' || countdown !== null) return;
    if (voiceOn && !settings.voice.askedMic && micPerm === 'checking') return;
    setAutoPending(false);
    if (needMicStep) return;
    go();
  }, [autoPending, state.status, countdown, voiceOn, settings.voice.askedMic, micPerm, needMicStep, go]);

  // Ready screen: Enter / Space starts.
  useEffect(() => {
    if (state.status !== 'ready' || countdown !== null || needMicStep) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status, countdown, go, needMicStep]);

  // Round end: release the mic (restores iOS speaker volume) and celebrate.
  const finished = state.status === 'finished';
  const stopRef = useRef(voice.stop);
  useEffect(() => {
    stopRef.current = voice.stop;
  });
  useEffect(() => {
    if (!finished) return;
    stopRef.current();
    const answered = state.answered.length;
    const acc = answered ? state.correctCount / answered : 0;
    if (state.endReason !== 'complete') return;
    if ((state.best?.isNewBest && state.best.previous !== null) || extras.rankUp) celebrate('pb');
    else if (answered >= 5 && acc >= 0.9) celebrate('small');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);
  useEffect(() => () => stopRef.current(), []);

  // Combo milestones: a big word over the card.
  const milestoneId = extras.milestone?.id ?? 0;
  useEffect(() => {
    if (!milestoneId || !extras.milestone) return;
    burstRef.current?.shout(extras.milestone.text.replace(/!.*$/, '!'), cardRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneId]);

  /** Stop the round early: summary when he answered something, else straight home. */
  const stopRound = () => {
    setConfirmStop(false);
    const answered = state.answered.length;
    round.end();
    if (answered === 0) onExit();
  };

  // Back mid-round pauses first (an accidental tap near the edge must not lose a sprint).
  const leave = () => {
    if (state.status === 'running' || state.status === 'retype') {
      round.pause();
      setConfirmStop(true);
      return;
    }
    if (state.status === 'paused') {
      stopRound();
      return;
    }
    if (countdown !== null) setCountdown(null);
    onExit();
  };

  const again = () => {
    if (onAgain) {
      onAgain();
      return;
    }
    round.reset();
    go();
  };

  const toggleMic = () => {
    sfx.unlock();
    // A mic problem: the tap means "try again", not "turn voice off".
    if (settings.voice.enabled && (voice.status === 'error' || voice.error)) {
      startMic();
      return;
    }
    const next = !settings.voice.enabled;
    // Render synchronously so the voice hook sees enabled=true, then open the mic while
    // we are still inside the tap (iOS needs getUserMedia in the gesture).
    flushSync(() => updateSettings({ voice: { ...settings.voice, enabled: next } }));
    if (next) startMic();
    else voice.stop();
  };

  const playing = state.status === 'running' || state.status === 'retype' || state.status === 'paused';

  const center = useMemo(() => {
    if (!playing && state.status !== 'finished') return null;
    if (format.durationMs) return <TimerBar remainingMs={state.remainingMs ?? format.durationMs} totalMs={format.durationMs} />;
    if (format.questionCount)
      return (
        <Progress
          n={state.answered.length + (state.status === 'finished' ? 0 : 1)}
          total={format.questionCount}
          elapsedMs={state.elapsedMs}
          stopwatch={format.showTimer}
        />
      );
    return null;
  }, [playing, state.status, state.remainingMs, state.answered.length, state.elapsedMs, format]);

  // ---- summary data ----
  const summary = useMemo(() => {
    if (!finished) return null;
    const answered = state.answered.length;
    const acc = answered ? Math.round((state.correctCount / answered) * 100) : 0;
    const stats: RoundSummaryStat[] = [];
    const quit = state.endReason === 'quit';
    if (format.bestMetric === 'elapsedMs') stats.push({ label: 'Time', value: formatSeconds(state.elapsedMs), emoji: '⏱️', highlight: true });
    stats.push({ label: 'Right', value: state.correctCount, emoji: '✅', highlight: format.id === 'sprint60' });
    stats.push({ label: 'Accuracy', value: `${acc}%`, emoji: '🎯' });
    stats.push({ label: 'Best combo', value: state.bestCombo, emoji: '🔥' });
    if (extras.fastestMs !== null) stats.push({ label: 'Fastest', value: formatSeconds(extras.fastestMs), emoji: '⚡' });
    const b = state.best;
    const realNewBest = Boolean(b?.isNewBest && b.previous !== null);
    let best: { label: string; value: string; isNewBest: boolean; previous: string | null } | undefined;
    let bestNote: string | undefined;
    if (b && !quit) {
      if (b.isNewBest) {
        best = {
          label: b.previous === null ? 'Your best so far' : 'Your best',
          value: b.previous === null && format.bestMetric !== 'elapsedMs' ? `${formatBest(format, b.value)} right` : formatBest(format, b.value),
          isNewBest: realNewBest,
          previous: b.previous === null ? null : formatBest(format, b.previous),
        };
      } else if (b.previous !== null) {
        best = { label: 'Your best', value: formatBest(format, b.previous), isNewBest: false, previous: null };
      }
      if (!b.eligible && format.bestMetric === 'elapsedMs') bestNote = `Get all ${format.questionCount ?? ''} right to set a record!`.replace('  ', ' ');
    }
    const bonusLines: Array<{ label: string; points: number; emoji?: string }> = [];
    const bo = state.bonuses;
    if (bo) {
      if (bo.firstRound) bonusLines.push({ label: 'First round today', points: bo.firstRound, emoji: '🌅' });
      if (bo.newBest) bonusLines.push({ label: 'New record', points: bo.newBest, emoji: '🏆' });
      if (bo.perfect) bonusLines.push({ label: 'Perfect', points: bo.perfect, emoji: '💯' });
      if (bo.sharpShooter) bonusLines.push({ label: 'Sharp shooter', points: bo.sharpShooter, emoji: '🎯' });
    }
    const factMap = new Map(generator.allFacts().map((f) => [f.id, f]));
    const missed = Array.from(new Set(state.answered.filter((a) => !a.correct).map((a) => a.factId)))
      .map((id) => factMap.get(id))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
      .slice(0, 4);
    // Mirrors (7×8 and 8×7) both move: show each pair once.
    const seen = new Set<string>();
    const allMovers = extras.movers
      .map((id) => factMap.get(id))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
      .filter((f) => {
        const k = [...f.operands].sort((x, y) => x - y).join('x');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    const movers = allMovers.slice(0, 6);
    const moreMovers = allMovers.length - movers.length;
    const title = quit
      ? 'Good try!'
      : answered === 0
        ? 'Round over'
        : realNewBest
          ? 'New record!'
          : 'Nice work!';
    const emoji = quit ? '👍' : realNewBest ? '🏆' : answered && state.wrongCount === 0 ? '💯' : '🎉';
    return { stats, best, bestNote, bonusLines, missed, movers, moreMovers, answered, title, emoji };
  }, [finished, state, extras, format, generator]);

  const coachPending = useCoachPending('play');
  const firstQuestion = state.status === 'running' && state.answered.length === 0;
  const coachPlay = coachPending && firstQuestion;
  const voiceListening = voiceOn && (voice.status === 'listening' || voice.status === 'hearing');
  const nudge = useNudge(state.status === 'running' && state.input === '' && !coachPlay, `${state.current?.id ?? ''}:${state.answered.length}`);
  // The first question was answered: the "play" tip has done its job.
  useEffect(() => {
    if (coachPending && state.answered.length > 0) coachDone('play');
  }, [coachPending, state.answered.length]);

  const appColor = `var(--k-app-${generator.appId})`;
  const style = { ['--k-app' as string]: appColor } as CSSProperties;

  return (
    <div className="k-screen dr-screen k-noselect" style={style} data-testid="drill-screen">
      <TopBar
        onBack={leave}
        title={playing || finished ? undefined : title}
        center={phonePortrait ? null : center}
        right={showMic && !needMicStep ? <MicChip voice={voice} on={settings.voice.enabled} onToggle={toggleMic} typed={state.answered.filter((a) => a.via !== 'voice').length} /> : undefined}
        points={today}
        combo={state.combo}
        comboMultiplier={comboMultiplier(state.combo)}
      />

      <main className="dr-body">
        <div className="dr-stage">
          {state.status === 'ready' ? (
            <div className="dr-card dr-ready" data-testid="ready">
              {countdown === null ? (
                needMicStep ? (
                  <MicStep voice={voice} onDone={micStepDone} />
                ) : (
                  <>
                    <div className="dr-ready__title">
                      <span className="k-emoji">{format.emoji}</span> {title}
                    </div>
                    <div className="dr-ready__desc">{format.description}</div>
                    {!autoPending && (
                      <>
                        <PlayButton ref={goRef} variant="go" onClick={go} data-testid="go" />
                        {showMic && <MicReadyNote voice={voice} on={voiceOn} />}
                      </>
                    )}
                  </>
                )
              ) : (
                <div className="dr-countwrap" data-testid="countdown-wrap">
                  <div className="dr-countdown__label">Get ready…</div>
                  <div className="dr-countdown k-num" key={countdown} data-testid="countdown">
                    {countdown}
                  </div>
                  <CountdownMicLine voice={voice} on={voiceOn && showMic} />
                </div>
              )}
            </div>
          ) : (
            <>
              {phonePortrait && center && <div className="dr-stage__timer">{center}</div>}
              <ProblemCard
                ref={cardRef}
                state={state}
                extras={extras}
                showCount={format.id === 'sprint60'}
                answerDigits={String(generator.maxPlausible).length}
              />
              {showMic && voiceOn && <MicPanel voice={voice} on heard={drillHeard(state, extras.unclear)} typed={state.answered.filter((a) => a.via !== 'voice').length} />}
            </>
          )}
          {nudge && (
            <div className="dr-nudge" data-testid="nudge">
              {showMic && voiceOn ? 'Say it or type it' : 'Type the answer'} <span className="k-emoji">👇</span>
            </div>
          )}
        </div>
        <div className="dr-pad" ref={padRef}>
          <Keypad
            value={state.input}
            onDigit={(d) => round.typeDigit(d, 'keypad')}
            onBackspace={round.backspace}
            onClear={round.clear}
            onSubmit={round.submit}
            hideSubmit
            disabled={!(state.status === 'running' || state.status === 'retype')}
            keyboard={state.status !== 'finished'}
          />
        </div>
      </main>

      {state.status === 'paused' && (
        <div className="dr-pause" data-testid="paused">
          <div className="dr-pause__card">
            <div className="k-emoji dr-pause__emoji">⏸️</div>
            <div className="dr-pause__title">{confirmStop ? 'Stop this round?' : 'Paused'}</div>
            <BigButton
              size="xl"
              onClick={() => {
                sfx.unlock();
                setConfirmStop(false);
                // iOS may have closed the mic while backgrounded; this tap may reopen it.
                if (voiceOn) startMic();
                round.resume();
              }}
              data-testid="resume"
            >
              Keep going
            </BigButton>
            <BigButton size="md" variant="ghost" onClick={stopRound} data-testid="stop">
              Stop
            </BigButton>
          </div>
        </div>
      )}

      <PointsBurst ref={burstRef} />

      {state.status === 'ready' && countdown === null && !needMicStep && !(autoPending) && (
        <IdleHint target={goRef} />
      )}
      {coachPlay && (
        <CoachMark
          target={padRef}
          text={voiceListening ? 'Say it or type it' : 'Type the answer'}
          onDismiss={() => coachDone('play')}
        />
      )}

      {finished && summary && (
        <RoundSummary
          title={summary.title}
          emoji={summary.emoji}
          stats={summary.stats}
          pointsEarned={state.points}
          best={summary.best}
          bestNote={summary.bestNote}
          bonusLines={summary.bonusLines}
          trophies={extras.trophies}
          rankUp={extras.rankUp}
          onAgain={again}
          onHome={onExit}
        >
          {summary.movers.length > 0 && (
            <div className="dr-summary-facts">
              <div className="dr-summary-facts__label">⬆️ Leveled up</div>
              <div className="dr-summary-facts__list">
                {summary.movers.map((f) => (
                  <span key={f.id} className="dr-fact-chip is-up k-num">
                    {f.prompt}
                  </span>
                ))}
                {summary.moreMovers > 0 && <span className="dr-fact-chip is-more k-num">+{summary.moreMovers} more</span>}
              </div>
            </div>
          )}
          {summary.missed.length > 0 && (
            <div className="dr-summary-facts">
              <div className="dr-summary-facts__label">🧠 Remember</div>
              <div className="dr-summary-facts__list">
                {summary.missed.map((f) => (
                  <span key={f.id} className="dr-fact-chip k-num">
                    {f.prompt} = {f.answer}
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
