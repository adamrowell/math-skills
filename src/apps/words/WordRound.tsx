/**
 * One "Read 15" round: a word shows huge, he reads it out loud, the on-device recognizer
 * checks it. Ready → playing → summary.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { BigButton, PlayButton, PointsBurst, RoundSummary, TopBar, celebrate, consumeAutostart, rewards, sfx, useTodayPoints } from '../../core';
import type { PointsBurstHandle } from '../../core';
import { MicPanel, heardChipFor, matchWordHypothesis, recordVoiceVerdict } from '../../voice';
import type { VoiceHypothesis } from '../../voice';
import type { WordEntry, WordLevel } from '../../data/reading/words';
import { WORD_LEVELS } from '../../data/reading/words';
import { bumpItem, pickRound, readingStore } from './reading/progress';
import { canSpeak, speak, stopSpeaking } from './reading/speech';
import { useReadingVoice } from './reading/useReadingVoice';
import { ReadingMic, Stars, VoiceNote } from './reading/ReadingUI';
import { ensureReadingFont } from './reading/font';
import { ROUND_SIZE, chunks } from './wordUtil';
import { comboMultiplier, credit, finishRound, wordPoints } from './reading/rewards';
import type { RoundOutcome } from './reading/rewards';

const NEXT_MS = 1500;
const MISSED_MS = 2600;
const HINT_MS = 4000;

type ItemStatus = 'listen' | 'retry' | 'wrong' | 'correct' | 'missed';
type Outcome = 'first' | 'second' | 'helped' | 'missed' | 'practice';

interface Played {
  word: string;
  outcome: Outcome;
  points: number;
}

export function WordRound({ level, onExit, onAgain }: { level: WordLevel; onExit: () => void; onAgain: () => void }) {
  useEffect(() => ensureReadingFont(), []);
  const store = readingStore('words');
  const today = useTodayPoints();
  const burstRef = useRef<PointsBurstHandle>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const levelIdx = WORD_LEVELS.findIndex((l) => l.id === level.id);

  const [items] = useState<WordEntry[]>(() => pickRound(level.words, (w) => w[0], store.get(), Math.min(ROUND_SIZE, level.words.length)));
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<ItemStatus>('listen');
  const [attempt, setAttempt] = useState(1);
  const [helped, setHelped] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [unclear, setUnclear] = useState(0);
  /** Vowel minimal pairs heard in a row for this word (said/sad): 2 → the "not quite" path. */
  const [almost, setAlmost] = useState(0);
  const [hint, setHint] = useState(false);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [points, setPoints] = useState(0);
  const [played, setPlayed] = useState<Played[]>([]);
  const [practice, setPractice] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const shownAt = useRef(0);
  const rankBefore = useRef(rewards.rank().index);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lock = useRef(false);

  const item = items[idx];
  const word = item?.[0] ?? '';
  const alternates = item?.[2];

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => () => stopSpeaking(), []);

  const playing = phase === 'playing';
  const onHypRef = useRef<(h: VoiceHypothesis) => void>(() => {});
  const rv = useReadingVoice({
    active: playing && !practice,
    mode: 'word',
    words: playing && word ? [word, ...(alternates ?? [])] : [],
    onHypothesis: (h) => onHypRef.current(h),
  });

  // Show a word: reset per-item state.
  useEffect(() => {
    if (!playing) return;
    shownAt.current = performance.now();
    lock.current = false;
    setStatus('listen');
    setAttempt(1);
    setHelped(false);
    setHeard(null);
    setUnclear(0);
    setAlmost(0);
    setHint(false);
    const t = setTimeout(() => setHint(true), HINT_MS);
    return () => clearTimeout(t);
  }, [idx, playing]);

  const finish = useCallback(
    (log: Played[], best: number) => {
      rv.stop();
      const firstTry = log.filter((p) => p.outcome === 'first').length;
      const o = finishRound({ app: 'words', levelId: level.id, firstTry, total: log.length, complete: log.length >= items.length, bestCombo: best, voiced: !practice && log.some((p) => p.outcome !== 'practice'), rankBefore: rankBefore.current });
      setOutcome(o);
      setPhase('done');
      if (o.stars > o.prevStars || o.rankUp) celebrate('pb');
      else if (firstTry >= log.length * 0.8) celebrate('small');
    },
    [level.id, practice, rv, items.length],
  );

  /** Record the result for the current word and move on. */
  const settle = useCallback(
    (out: Outcome, pts: number, delay: number) => {
      if (lock.current) return;
      lock.current = true;
      if (out !== 'practice') store.update((p) => ({ ...p, items: { ...p.items, [word]: bumpItem(p.items[word], out, Date.now()) } }));
      const log = [...played, { word, outcome: out, points: pts }];
      setPlayed(log);
      const nextCombo = out === 'first' ? combo + 1 : out === 'practice' ? combo : 0;
      const best = Math.max(bestCombo, nextCombo);
      setCombo(nextCombo);
      setBestCombo(best);
      later(() => {
        if (idx + 1 >= items.length) finish(log, best);
        else setIdx(idx + 1);
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [played, word, combo, bestCombo, idx, items.length, finish],
  );

  const accept = useCallback(() => {
    if (lock.current) return;
    const ms = performance.now() - shownAt.current;
    const out: Outcome = helped ? 'helped' : attempt > 1 ? 'second' : 'first';
    const nextCombo = out === 'first' ? combo + 1 : 0;
    const pts = wordPoints({ prior: level.prior, attempt, helped, ms, combo: nextCombo });
    setStatus('correct');
    setHeard(null);
    sfx.play('correct');
    if ([5, 10, 20].includes(nextCombo)) {
      setTimeout(() => sfx.play('combo'), 150);
      burstRef.current?.shout(`${nextCombo} in a row!`, cardRef.current);
    }
    credit('words', pts, word);
    setPoints((p) => p + pts);
    if (pts > 0) burstRef.current?.burst(pts, cardRef.current);
    settle(out, pts, NEXT_MS);
  }, [helped, attempt, combo, level.prior, word, settle]);

  const miss = useCallback(() => {
    if (lock.current) return;
    setStatus('missed');
    void speak(word);
    settle('missed', 0, MISSED_MS);
  }, [word, settle]);

  onHypRef.current = (h: VoiceHypothesis) => {
    if (!playing || confirmStop || lock.current || !word) return;
    if (!h.isFinal && !h.text) return;
    const r = matchWordHypothesis(h, word, alternates);
    if (h.isFinal) recordVoiceVerdict(h.utteranceId, r.verdict);
    if (r.verdict === 'correct') {
      accept();
      return;
    }
    if (!h.isFinal) return;
    // Short vowels blur (said/sad, bed/bad): "almost" once, the "not quite" path the second time.
    const almostTwice = r.verdict === 'unclear' && r.almost && almost + 1 >= 2;
    if (r.verdict === 'unclear' && r.almost && !almostTwice) {
      setAlmost((a) => a + 1);
      setHeard(null);
      setStatus((s) => (s === 'listen' ? 'retry' : s));
      setHint(true);
      return;
    }
    if (r.verdict === 'wrong' || almostTwice) {
      setAlmost(0);
      sfx.play('wrong', 0.5);
      setHeard(r.heard ?? h.text);
      setCombo(0);
      if (attempt >= 2) {
        miss();
        return;
      }
      setAttempt(2);
      setStatus('wrong');
      return;
    }
    // unclear: keep listening; nudge after two tries.
    setUnclear((u) => u + 1);
    if (h.text) setHeard(null);
    setStatus((s) => (s === 'listen' ? 'retry' : s));
    if (unclear + 1 >= 2) setHint(true);
  };

  const hear = () => {
    sfx.unlock();
    if (!helped && status !== 'correct' && status !== 'missed') {
      setHelped(true);
      setCombo(0);
    }
    void speak(word);
  };

  const go = () => {
    sfx.unlock();
    if (rv.supported) {
      // Render 'playing' synchronously so the voice hook is enabled, then open the mic
      // while still inside the tap (iOS needs the gesture).
      flushSync(() => setPhase('playing'));
      rv.start();
    } else {
      setPractice(true);
      setPhase('playing');
    }
    sfx.play('combo', 0.6);
  };

  // PLAY on the home was the gesture: skip the ready card (UX-V3 §2.3).
  const [autoGo] = useState(() => consumeAutostart());
  useEffect(() => {
    if (!autoGo) return;
    const t = setTimeout(go, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const startPractice = () => {
    sfx.unlock();
    setPractice(true);
    setPhase('playing');
  };

  const leave = () => {
    if (phase === 'playing') {
      setConfirmStop(true);
      return;
    }
    stopSpeaking();
    onExit();
  };
  const stopNow = () => {
    setConfirmStop(false);
    timers.current.forEach(clearTimeout);
    if (played.length) finish(played, bestCombo);
    else {
      rv.stop();
      onExit();
    }
  };

  const micTap = () => {
    sfx.unlock();
    rv.start();
  };

  // Keyboard for desktop: Space/Enter starts; H hears; S skips.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmStop) return;
      if (phase === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        go();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const dots = useMemo(
    () =>
      items.map((_, i) => {
        const p = played[i];
        const cls = p ? (p.outcome === 'first' ? 'is-first' : p.outcome === 'missed' ? 'is-missed' : 'is-ok') : i === idx && playing ? 'is-now' : '';
        return <span key={i} className={`rd-dot ${cls}`} />;
      }),
    [items, played, idx, playing],
  );

  const style = { ['--k-app' as string]: 'var(--k-app-words)' } as CSSProperties;
  const firstTry = played.filter((p) => p.outcome === 'first').length;

  const prompt =
    status === 'correct'
      ? '🎉 Yes!'
      : status === 'missed'
        ? `It says “${word}”`
        : status === 'wrong'
          ? 'Not quite. Try again!'
          : status === 'retry'
            ? 'Say it again, nice and loud!'
            : practice
              ? 'Read it out loud!'
              : rv.voice.status === 'loading'
                ? 'Get ready…'
                : hint && !helped && canSpeak()
                  ? 'Stuck? Tap 🔊 to hear it'
                  : 'Read it out loud!';

  const wordHeard =
    status === 'correct'
      ? heardChipFor({ verdict: 'correct', text: word })
      : status === 'wrong' || status === 'missed'
        ? heardChipFor({ verdict: 'wrong', text: heard })
        : status === 'retry'
          ? heardChipFor({ verdict: 'unclear', text: 'Say it again?', almost: almost > 0, id: unclear + almost })
          : null;

  return (
    <div className="k-screen rd-screen k-noselect" style={style} data-testid="word-round">
      <TopBar
        onBack={leave}
        title={phase === 'ready' ? `${level.emoji} ${level.title}` : undefined}
        center={phase !== 'ready' ? <div className="rd-dots" data-testid="progress" aria-label={`${Math.min(idx + 1, items.length)} of ${items.length}`}>{dots}</div> : undefined}
        right={phase === 'playing' && !practice && rv.supported ? <ReadingMic rv={rv} onTap={micTap} /> : undefined}
        points={today}
        combo={combo}
        comboMultiplier={comboMultiplier(combo)}
      />

      <main className="rd-main">
        {phase === 'ready' && (
          <div className="rd-card rd-ready" data-testid="ready">
            <div className="rd-ready__level">Level {levelIdx + 1}</div>
            <div className="rd-ready__title">
              <span className="k-emoji">{level.emoji}</span> {level.title}
            </div>
            <div className="rd-ready__peek rd-font">{items.slice(0, 4).map((w) => w[0]).join('  ·  ')}</div>
            <PlayButton variant="go" onClick={go} data-testid="go" />
            <VoiceNote rv={rv} />
            {rv.supported ? (
              <button type="button" className="rd-linkbtn" onClick={startPractice} data-testid="practice">
                No microphone? Practice without stars
              </button>
            ) : (
              <BigButton size="md" variant="ghost" onClick={startPractice} data-testid="practice">
                Practice
              </BigButton>
            )}
          </div>
        )}

        {phase === 'playing' && item && (
          <div
            ref={cardRef}
            className={`rd-card rd-word-card is-${status}`}
            data-testid="word-card"
            data-word={word}
            data-status={status}
            data-idx={idx}
            key={idx}
          >
            <button type="button" className="rd-word rd-font" onClick={hear} aria-label={`${word}. Tap to hear it`} data-testid="word">
              {word}
            </button>
            {status === 'wrong' || status === 'missed' ? (
              <div className="rd-chunks rd-font" data-testid="chunks">
                {chunks(word)}
              </div>
            ) : null}
            <div className={`rd-prompt is-${status}`} data-testid="prompt" aria-live="polite">
              {prompt}
            </div>
            {(status === 'correct' || status === 'missed') && (
              <div className="rd-sentence rd-font" data-testid="sentence">
                {item[1].split(/(\s+)/).map((t, i) =>
                  t.replace(/[^a-z']/gi, '').toLowerCase() === word ? (
                    <mark key={i}>{t}</mark>
                  ) : (
                    <span key={i}>{t}</span>
                  ),
                )}
              </div>
            )}
            {status !== 'correct' && status !== 'missed' && (
              <div className="rd-actions">
                {canSpeak() && (
                  <BigButton size="lg" variant="ghost" onClick={hear} data-testid="hear" className={`rd-hear${hint ? ' is-hint' : ''}`}>
                    <span className="k-emoji">🔊</span> Hear it {!practice && <span className="rd-cost">{helped ? '' : '(fewer ⭐)'}</span>}
                  </BigButton>
                )}
                {(practice || !rv.supported) && (
                  <BigButton size="lg" variant="success" onClick={() => {
                    setStatus('correct');
                    sfx.play('correct');
                    settle('practice', 0, 900);
                  }} data-testid="read-it">
                    <span className="k-emoji">✅</span> I read it
                  </BigButton>
                )}
                <BigButton size="lg" variant="ghost" onClick={miss} data-testid="skip">
                  Skip <span className="k-emoji">⏭️</span>
                </BigButton>
              </div>
            )}
            {practice && <div className="rd-practice-tag">Practice · no stars</div>}
          </div>
        )}
        {phase === 'playing' && item && !practice && rv.supported && (
          <MicPanel voice={rv.voice} on heard={wordHeard} say="read the word" className="rd-micpanel" />
        )}
      </main>

      {confirmStop && (
        <div className="rd-sheet" data-testid="confirm-stop">
          <div className="rd-sheet__card">
            <div className="k-emoji rd-sheet__emoji">⏸️</div>
            <div className="rd-sheet__title">Stop reading?</div>
            <BigButton size="xl" onClick={() => setConfirmStop(false)} data-testid="resume">
              Keep going
            </BigButton>
            <BigButton size="md" variant="ghost" onClick={stopNow} data-testid="stop">
              Stop
            </BigButton>
          </div>
        </div>
      )}

      <PointsBurst ref={burstRef} />

      {phase === 'done' && outcome && (
        <RoundSummary
          title={practice ? 'Nice practice!' : outcome.stars === 3 ? 'Perfect reading!' : outcome.stars > outcome.prevStars ? 'New star!' : 'Great reading!'}
          emoji={practice ? '📖' : outcome.stars === 3 ? '🏆' : '🎉'}
          stats={[
            { label: 'Read first try', value: `${firstTry}/${played.length}`, emoji: '✅', highlight: true },
            { label: 'Best combo', value: bestCombo, emoji: '🔥' },
          ]}
          pointsEarned={points + outcome.bonusTotal}
          bonusLines={outcome.bonusLines}
          trophies={outcome.trophies}
          rankUp={outcome.rankUp}
          bestNote={practice ? 'Turn on the microphone to earn stars and points.' : outcome.stopped ? 'Finish all the words to earn stars.' : outcome.stars === 0 ? 'Read 10 of 15 on the first try to earn a star!' : undefined}
          onAgain={onAgain}
          onHome={onExit}
        >
          <div className="rd-summary-stars" data-testid="summary-stars">
            <Stars n={Math.max(outcome.stars, outcome.prevStars)} size="lg" />
          </div>
          {played.some((p) => p.outcome !== 'first' && p.outcome !== 'practice') && (
            <div className="rd-tricky">
              <div className="rd-tricky__label">🧠 Practice these</div>
              <div className="rd-tricky__list">
                {played
                  .filter((p) => p.outcome !== 'first' && p.outcome !== 'practice')
                  .map((p) => (
                    <button key={p.word} type="button" className="rd-chip rd-font" onClick={() => void speak(p.word)}>
                      {p.word} <span className="k-emoji">🔊</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </RoundSummary>
      )}
    </div>
  );
}
