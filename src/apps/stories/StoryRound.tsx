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
  beginPlay,
  celebrate,
  consumeAutostart,
  sfx,
  toast,
  updateSettings,
  useSettings,
  useTodayPoints,
} from '../../core';
import type { PointsBurstHandle, RoundSummaryStat } from '../../core';
import { MicChip, MicPanel, micGranted, suppressVoice, useVoiceInput, voiceImplemented } from '../../voice';
import type { HeardChip, UseVoiceInputResult } from '../../voice';
import { canSpeak, speak, stopSpeaking } from '../words/reading/speech';
import { STORIES_PER_ROUND, levelDef } from './problems';
import type { LevelId, Story } from './problems';
import { Picture } from './Picture';
import { progressStore, setAutoRead } from './progress';
import { useStoryRound } from './useStoryRound';
import type { StoryAnswer, StoryRoundState } from './useStoryRound';
import './stories.css';

interface Props {
  level: LevelId;
  onExit: () => void;
  onPlayLevel: (level: LevelId) => void;
}

function Dots({ answers, index }: { answers: StoryAnswer[]; index: number }) {
  return (
    <div className="st-dots" aria-label={`Story ${Math.min(index + 1, STORIES_PER_ROUND)} of ${STORIES_PER_ROUND}`} data-testid="progress">
      {Array.from({ length: STORIES_PER_ROUND }, (_, i) => {
        const a = answers[i];
        const cls = a ? (a.solvedOn === 1 ? 'is-1' : a.solvedOn === 2 ? 'is-2' : 'is-0') : i === index ? 'is-now' : '';
        return <span key={i} className={`st-dot ${cls}`} />;
      })}
      <span className="st-dots__n k-num">
        {Math.min(index + 1, STORIES_PER_ROUND)}/{STORIES_PER_ROUND}
      </span>
    </div>
  );
}

function Stars({ n, testId }: { n: number; testId?: string }) {
  return (
    <span className="st-stars" aria-label={`${n} of 3 stars`} data-testid={testId} data-stars={n}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`st-star${i <= n ? ' is-on' : ''}`}>
          {i <= n ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

/** The answer box ("= ☐") for non-sequence stories. */
function AnswerBox({ input, state }: { input: string; state: StoryRoundState['status'] }) {
  return (
    <div className={`st-answer is-${state}`} data-testid="answer">
      <span className="st-answer__box k-num">{input || <span className="st-answer__caret" aria-hidden="true" />}</span>
    </div>
  );
}

/** Number sentence with the box filled by what he types (hint card). */
function NumberSentence({ text, input }: { text: string; input: string }) {
  const [a, b] = text.split('☐');
  return (
    <span className="st-sentence k-num" data-testid="number-sentence">
      {a}
      <span className="st-sentence__box">{input || ' '}</span>
      {b}
    </span>
  );
}

function ReadButton({ onRead, speaking }: { onRead: () => void; speaking: boolean }) {
  if (!canSpeak()) return null;
  return (
    <button type="button" className={`st-read${speaking ? ' is-speaking' : ''}`} onClick={onRead} data-testid="read-aloud" aria-label="Read it to me">
      <span className="k-emoji">🔊</span> <span className="st-read__label">Read it to me</span>
    </button>
  );
}

function StoryText({ story }: { story: Story }) {
  return (
    <div className="st-text" data-testid="story-text">
      {story.sentences.map((s, i) => (
        <p key={i} className="st-line">
          {s}
        </p>
      ))}
    </div>
  );
}

function Worked({ story, input }: { story: Story; input: string }) {
  return (
    <div className="st-worked" data-testid="worked">
      <div className="st-worked__head">
        <span className="k-emoji">🧠</span> Let's work it out
      </div>
      {story.pic && <Picture pic={story.pic} solved answer={story.answer} />}
      <ol className="st-steps">
        {story.worked.map((w, i) => (
          <li key={i} className="st-step k-num" style={{ animationDelay: `${i * 350}ms` }}>
            {w}
          </li>
        ))}
      </ol>
      <div className="st-worked__line">{story.answerLine}</div>
      <div className="st-worked__type">
        Type <b className="k-num">{story.answer}</b> <AnswerBox input={input} state="worked" />
      </div>
    </div>
  );
}

/** First run on a device: one tap for the mic permission (UX-V3 §2.3). */
function MicStep({ voice, onDone }: { voice: UseVoiceInputResult; onDone: (enabled: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const ask = () => {
    if (busy) return;
    setBusy(true);
    sfx.unlock();
    let p: Promise<void>;
    try {
      p = voice.start();
    } catch (e) {
      p = Promise.reject(e);
    }
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      setBusy(false);
      onDone(ok);
    };
    p.then(() => done(true), () => done(false));
    setTimeout(() => done(true), 3000); // never stare at a dead button; the mic keeps arming
  };
  return (
    <div className="st-micstep" data-testid="mic-step">
      <div className="st-ready__title">Can I listen to your answers?</div>
      <PlayButton variant="mic" label={busy ? 'Tap “Allow”…' : 'Yes, turn on my ears'} onClick={ask} disabled={busy} data-testid="mic-allow" />
      <BigButton size="md" variant="ghost" onClick={() => onDone(false)} data-testid="mic-skip">
        I'll type instead
      </BigButton>
    </div>
  );
}

export function StoryRound({ level, onExit, onPlayLevel }: Props) {
  const def = levelDef(level);
  const settings = useSettings();
  const today = useTodayPoints();
  const autoRead = progressStore.useStore((p) => p.autoRead);
  const burstRef = useRef<PointsBurstHandle>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [autoPending, setAutoPending] = useState(() => consumeAutostart());
  const [confirmStop, setConfirmStop] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quietMic = useCallback(() => {
    try {
      if (voiceImplemented) suppressVoice(250);
    } catch {
      /* optional */
    }
  }, []);

  const readRef = useRef<(text: string) => void>(() => {});
  const round = useStoryRound(level, {
    onCorrect: (pts) => {
      quietMic();
      if (pts > 0) burstRef.current?.burst(pts, cardRef.current);
    },
    onWrong: quietMic,
    onStory: (s) => {
      if (progressStore.get().autoRead) setTimeout(() => readRef.current(s.speech), 350);
    },
  });
  const { state } = round;
  const finished = state.status === 'finished';
  const playing = !finished && state.status !== 'ready';

  // ---- read aloud (free; the speed clock pauses while it talks) ----
  const read = useCallback(
    (text: string) => {
      const t0 = performance.now();
      setSpeaking(true);
      void speak(text, { rate: 0.85 }).then(() => {
        round.pauseClock(performance.now() - t0);
        setSpeaking(false);
      });
    },
    [round],
  );
  useEffect(() => {
    readRef.current = read;
  }, [read]);
  useEffect(() => () => stopSpeaking(), []);

  const s = state.story;
  const readNow = () => {
    sfx.unlock();
    if (!s) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (state.status === 'worked') read(`${s.worked.join('. ').replace(/−/g, 'minus').replace(/×/g, 'times').replace(/÷/g, 'divided by')}. ${s.answerLine}`);
    else if (state.status === 'hint') read(s.hint);
    else read(s.speech);
  };

  // Small screens: keep what he must look at next in view (the answer box / hint / worked answer).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const toEnd = state.status === 'hint' || state.status === 'worked' || state.status === 'correct';
    requestAnimationFrame(() => {
      try {
        el.scrollTo({ top: toEnd ? el.scrollHeight : 0, behavior: toEnd ? 'smooth' : 'auto' });
      } catch {
        el.scrollTop = toEnd ? el.scrollHeight : 0;
      }
    });
  }, [state.status, state.index]);

  // ---- voice ----
  const voiceOn = voiceImplemented && settings.voice.enabled;
  const answer = s?.answer;
  const bias = useMemo(() => (answer === undefined ? undefined : { numbers: [answer] }), [answer]);
  const voice = useVoiceInput({ enabled: voiceOn && !finished, mode: 'number', bias, onTranscript: round.onVoiceTranscript });
  const showMic = voiceImplemented && voice.isSupported && !(voice.error && !voice.error.recoverable);
  const needMicStep = showMic && voiceOn && !settings.voice.askedMic && !micGranted();

  const startMic = useCallback(() => {
    if (!voiceImplemented) return;
    try {
      void voice.start().catch(() => {});
    } catch {
      /* mic is optional */
    }
  }, [voice]);

  const go = useCallback(() => {
    sfx.unlock();
    if (voiceOn) startMic();
    sfx.play('tick');
    setCountdown(3);
  }, [voiceOn, startMic]);

  const micStepDone = (enabled: boolean) => {
    updateSettings({ voice: { ...settings.voice, enabled, askedMic: true } });
    if (!enabled) {
      voice.stop();
      toast.show('Okay, typing it is', { emoji: '⌨️' });
    }
    sfx.play('tick');
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    const t = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        sfx.play('combo', 0.7);
        round.start();
      } else {
        sfx.play('tick');
        setCountdown(countdown - 1);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [countdown, round]);

  // PLAY on the home was the gesture: count down straight away (unless the mic needs its one tap).
  useEffect(() => {
    if (!autoPending || state.status !== 'ready' || countdown !== null) return;
    setAutoPending(false);
    if (needMicStep) return;
    go();
  }, [autoPending, state.status, countdown, needMicStep, go]);

  // Ready card: Enter / Space starts.
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

  // Round end: release the mic, celebrate.
  const stopRef = useRef(voice.stop);
  useEffect(() => {
    stopRef.current = voice.stop;
  });
  useEffect(() => {
    if (!finished) return;
    stopRef.current();
    stopSpeaking();
    if (state.endReason !== 'complete') return;
    if (state.unlocked || state.stars === 3 || state.rankUp) celebrate('pb');
    else if (state.stars >= 2) celebrate('small');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);
  useEffect(() => () => stopRef.current(), []);

  const lastCombo = useRef(0);
  useEffect(() => {
    if (state.combo > lastCombo.current && state.combo >= 3 && state.combo % 3 === 0) {
      burstRef.current?.shout(`${state.combo} in a row!`, cardRef.current);
    }
    lastCombo.current = state.combo;
  }, [state.combo]);

  const stopRound = () => {
    setConfirmStop(false);
    const answered = state.answers.length;
    round.end();
    if (answered === 0) onExit();
  };
  const leave = () => {
    stopSpeaking();
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

  // ---- summary ----
  const summary = useMemo(() => {
    if (!finished) return null;
    const n = state.answers.length;
    const first = state.answers.filter((a) => a.solvedOn === 1).length;
    const second = state.answers.filter((a) => a.solvedOn === 2).length;
    const quit = state.endReason === 'quit';
    const stats: RoundSummaryStat[] = [{ label: 'Right first try', value: `${first}/${n}`, emoji: '✅', highlight: true }];
    if (second) stats.push({ label: 'After a hint', value: second, emoji: '💡' });
    stats.push({ label: 'Best streak', value: state.bestCombo, emoji: '🔥' });
    const b = state.best;
    const best =
      b && !quit && b.previous !== null
        ? { label: b.isNewBest ? 'New best' : 'Best', value: `${b.isNewBest ? b.value : b.previous}/${STORIES_PER_ROUND}`, isNewBest: b.isNewBest, previous: b.isNewBest ? `${b.previous}/${STORIES_PER_ROUND}` : null }
        : undefined;
    const missed = state.answers.filter((a) => a.solvedOn !== 1).slice(0, 4);
    const title = quit ? 'Good try!' : state.unlocked ? 'Level up!' : state.stars === 3 ? 'Perfect story!' : state.stars === 2 ? 'Great thinking!' : 'Nice work!';
    const emoji = quit ? '👍' : state.unlocked ? '🔓' : state.stars === 3 ? '💯' : '📚';
    return { stats, best, missed, title, emoji };
  }, [finished, state]);

  const heard: HeardChip | null = state.heard && state.heardKind ? { kind: state.heardKind, text: state.heard } : null;
  const style = { ['--k-app' as string]: 'var(--k-app-stories)' } as CSSProperties;
  const keypadOn = state.status === 'running' || state.status === 'worked';
  const isSeq = s?.pic?.kind === 'seq';
  const typedCount = state.answers.filter((a) => a.via === 'keypad' || a.via === 'keyboard').length;

  return (
    <div className="k-screen st-screen k-noselect" style={style} data-testid="stories-round" data-level={level}>
      <TopBar
        onBack={leave}
        title={playing || finished ? undefined : `Level ${level}`}
        right={showMic && !needMicStep ? <MicChip voice={voice} on={settings.voice.enabled} onToggle={toggleMic} typed={typedCount} variant="play" /> : undefined}
        points={today}
        combo={state.combo}
      />

      <main className="st-body">
        <div className="st-stage">
          {state.status === 'ready' ? (
            <div className="st-card st-ready" data-testid="ready">
              {countdown !== null ? (
                <>
                  <div className="st-countdown__label">Get ready…</div>
                  <div className="st-countdown k-num" key={countdown} data-testid="countdown">
                    {countdown}
                  </div>
                </>
              ) : needMicStep ? (
                <MicStep voice={voice} onDone={micStepDone} />
              ) : autoPending ? null : (
                <>
                  <div className="st-ready__badge">
                    <span className="k-emoji">{def.emoji}</span> Level {level} · {def.title}
                  </div>
                  <div className="st-ready__title">8 stories</div>
                  <div className="st-ready__desc">Read it, work it out, type or say the answer.</div>
                  <PlayButton variant="go" onClick={go} data-testid="go" />
                </>
              )}
            </div>
          ) : s ? (
            <div
              ref={cardRef}
              className={`st-card st-play is-${state.status}`}
              data-testid="story-card"
              data-status={state.status}
              data-q={state.index}
              data-attempt={state.attempt}
              data-template={s.templateId}
              data-eq={s.sentence}
            >
              <div className="st-card__top">
                <Dots answers={state.answers} index={state.index} />
                <ReadButton onRead={readNow} speaking={speaking} />
                <div className="st-score" aria-label={`${state.points} points this round`}>
                  <span className="k-emoji">⭐</span>{' '}
                  <span className="k-num" data-testid="round-points" key={state.points}>
                    {state.points}
                  </span>
                </div>
              </div>

              <div className="st-scroll" ref={scrollRef}>
                {state.status === 'worked' ? (
                  <>
                    <StoryText story={s} />
                    <p className="st-question">{s.question}</p>
                    <Worked story={s} input={state.input} />
                  </>
                ) : (
                  <div className={`st-problem${state.status === 'hint' ? ' do-shake' : ''}`} key={`${state.index}-${state.nudge}`}>
                    <StoryText story={s} />
                    {s.pic && (s.showPic || isSeq) && <Picture pic={s.pic} input={state.input} answer={s.answer} solved={state.status === 'correct' && isSeq} />}
                    <div className="st-ask">
                      <p className="st-question">{s.question}</p>
                      {!isSeq && <AnswerBox input={state.input} state={state.status} />}
                    </div>

                    {state.attempt === 2 && state.status !== 'correct' ? (
                      <div className="st-hint" data-testid="hint">
                        {state.given !== null && (
                          <div className="st-hint__not">
                            {state.givenVia === 'voice' ? 'I heard' : 'Not'} <s className="k-num">{state.given}</s> — one more try!
                          </div>
                        )}
                        <div className="st-hint__tip">
                          <span className="k-emoji">💡</span> {s.hint}
                        </div>
                        {!isSeq && <NumberSentence text={s.sentence} input={state.input} />}
                        {s.pic && !s.showPic && !isSeq && s.pic.kind !== 'seq' && <Picture pic={s.pic} />}
                      </div>
                    ) : state.status === 'correct' ? (
                      <div className="st-yay" data-testid="yay">
                        <span className="k-emoji">🎉</span> {state.lastPoints > 0 ? 'Yes!' : 'That’s it!'} <span className="st-yay__line">{s.answerLine}</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {voiceImplemented && showMic && state.status !== 'ready' && !finished && (
            <MicPanel voice={voice} on={settings.voice.enabled} heard={heard} typed={typedCount} say="say the answer" reserve={settings.voice.enabled} />
          )}
        </div>
        <div className="st-pad">
          <Keypad
            value={state.input}
            onDigit={(d) => round.typeDigit(d, 'keypad')}
            onBackspace={round.backspace}
            onClear={round.clear}
            onSubmit={round.submit}
            disabled={!keypadOn}
            keyboard={playing && !confirmStop}
          />
        </div>
      </main>

      {confirmStop && (
        <div className="st-pause" data-testid="paused">
          <div className="st-pause__card">
            <div className="k-emoji st-pause__emoji">⏸️</div>
            <div className="st-pause__title">Stop these stories?</div>
            <div className="st-pause__sub">Points you earned are kept.</div>
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
          bonusLines={state.bonusLines}
          trophies={state.trophies}
          rankUp={state.rankUp}
          onAgain={() => {
            round.reset();
            go();
          }}
          onHome={onExit}
        >
          {state.endReason === 'complete' && (
            <div className="st-summary-stars">
              <Stars n={state.stars} testId="round-stars" />
              {state.stars < 2 && level < 5 && !state.unlocked && <div className="st-summary-stars__tip">Get 6 right first try for ★★ and the next level!</div>}
            </div>
          )}
          {state.unlocked && (
            <div className="st-unlock" data-testid="unlocked">
              <div className="st-unlock__title">
                <span className="k-emoji">🔓</span> Level {state.unlocked} unlocked: {levelDef(state.unlocked).title}!
              </div>
              <BigButton size="lg" variant="accent" onClick={() => {
                  const l = state.unlocked as LevelId;
                  beginPlay({ app: 'stories', label: `Level ${l}`, route: `/stories/play/${l}` });
                  onPlayLevel(l);
                }} data-testid="next-level">
                Play Level {state.unlocked} <span aria-hidden="true">➜</span>
              </BigButton>
            </div>
          )}
          {summary.missed.length > 0 && (
            <div className="st-remember">
              <div className="st-remember__label">🧠 Remember</div>
              <div className="st-remember__list">
                {summary.missed.map((a, i) => (
                  <span key={i} className="st-remember__chip k-num">
                    <span className="k-emoji">{a.story.emoji}</span> {a.story.sentence.replace('☐', String(a.story.answer))}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!autoRead && canSpeak() && state.answers.some((a) => a.solvedOn !== 1) && (
            <button type="button" className="st-autoread" onClick={() => setAutoRead(true)} data-testid="autoread-tip">
              🔊 Read every story to me
            </button>
          )}
        </RoundSummary>
      )}
    </div>
  );
}
