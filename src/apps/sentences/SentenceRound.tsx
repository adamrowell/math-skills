/** One "Read 8" round of sentences: ready → playing → summary. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { BigButton, PlayButton, PointsBurst, RoundSummary, TopBar, celebrate, consumeAutostart, rewards, sfx, useTodayPoints } from '../../core';
import type { PointsBurstHandle } from '../../core';
import { matchWordHypothesis, recordVoiceVerdict, MicPanel } from '../../voice';
import type { VoiceHypothesis } from '../../voice';
import type { SentenceLevel } from '../../data/reading/sentences';
import { SENTENCE_LEVELS } from '../../data/reading/sentences';
import { bumpItem, pickRound, readingStore } from '../words/reading/progress';
import { canSpeak, speak, stopSpeaking } from '../words/reading/speech';
import { useReadingVoice } from '../words/reading/useReadingVoice';
import { ReadingMic, Stars, VoiceNote } from '../words/reading/ReadingUI';
import { ensureReadingFont } from '../words/reading/font';
import { SENTENCE_POINTS, comboMultiplier, credit, finishRound } from '../words/reading/rewards';
import type { RoundOutcome } from '../words/reading/rewards';
import {
  applyTranscript,
  firstPassCount,
  heardAll,
  helpWord,
  inRetry,
  initSentence,
  isClean,
  isDone,
  pending,
  wordCount,
} from './sentenceLogic';
import type { SentenceState } from './sentenceLogic';

export const SENTENCE_ROUND = 8;
const NEXT_MS = 1700;
const MAX_RETRIES = 3;

interface Played {
  text: string;
  first: number;
  words: number;
  clean: boolean;
  skipped: boolean;
  ms: number;
}

export function SentenceRound({ level, onExit, onAgain }: { level: SentenceLevel; onExit: () => void; onAgain: () => void }) {
  useEffect(() => ensureReadingFont(), []);
  const store = readingStore('sentences');
  const today = useTodayPoints();
  const burstRef = useRef<PointsBurstHandle>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const levelIdx = SENTENCE_LEVELS.findIndex((l) => l.id === level.id);
  const [items] = useState<string[]>(() => pickRound(level.sentences, (s) => s, store.get(), Math.min(SENTENCE_ROUND, level.sentences.length)));
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [idx, setIdx] = useState(0);
  const [sent, setSent] = useState<SentenceState>(() => initSentence(items[0]));
  const [finished, setFinished] = useState<'clean' | 'done' | 'skipped' | null>(null);
  const [retries, setRetries] = useState(0);
  const [empty, setEmpty] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [points, setPoints] = useState(0);
  const [played, setPlayed] = useState<Played[]>([]);
  const [practice, setPractice] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [heard, setHeard] = useState('');
  const shownAt = useRef(0);
  const lastHitAt = useRef(0);
  const rankBefore = useRef(rewards.rank().index);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sentRef = useRef(sent);
  sentRef.current = sent;
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => () => stopSpeaking(), []);

  const playing = phase === 'playing';
  const pend = pending(sent);
  const targetWords = pend.map((i) => sent.words[i]);
  const mode = pend.length === 1 ? 'word' : 'sentence';
  const onHypRef = useRef<(h: VoiceHypothesis) => void>(() => {});
  const rv = useReadingVoice({
    active: playing && !practice,
    mode,
    words: playing && !finished ? targetWords : [],
    onHypothesis: (h) => onHypRef.current(h),
  });

  useEffect(() => {
    if (!playing) return;
    shownAt.current = performance.now();
    lastHitAt.current = 0;
    setSent(initSentence(items[idx]));
    setFinished(null);
    setRetries(0);
    setEmpty(0);
    setHeard('');
  }, [idx, playing, items]);

  const finishRoundNow = useCallback(
    (log: Played[], best: number) => {
      rv.stop();
      const totalWords = log.reduce((a, p) => a + p.words, 0);
      const firstWords = log.reduce((a, p) => a + p.first, 0);
      // Stars use the words read right on the first pass.
      const o = finishRound({
        app: 'sentences',
        levelId: level.id,
        firstTry: firstWords,
        total: totalWords,
        complete: log.length >= items.length,
        bestCombo: best,
        voiced: !practice,
        rankBefore: rankBefore.current,
      });
      setOutcome(o);
      setPhase('done');
      if (o.stars > o.prevStars || o.rankUp) celebrate('pb');
      else if (firstWords >= totalWords * 0.8) celebrate('small');
    },
    [level.id, practice, rv, items.length],
  );

  /** Sentence over: log it and move on. */
  const complete = useCallback(
    (s: SentenceState, how: 'clean' | 'done' | 'skipped') => {
      setFinished(how);
      const clean = how === 'clean';
      const nextCombo = clean ? combo + 1 : 0;
      const best = Math.max(bestCombo, nextCombo);
      setCombo(nextCombo);
      setBestCombo(best);
      if (!practice) {
        const out = clean ? 'first' : how === 'skipped' ? 'missed' : s.states.includes('helped') ? 'helped' : 'second';
        const text = items[idx];
        store.update((p) => ({ ...p, items: { ...p.items, [text]: bumpItem(p.items[text], out, Date.now()) } }));
      }
      if (clean && !practice) {
        const bonus = Math.round(SENTENCE_POINTS.clean * level.prior * comboMultiplier(nextCombo));
        credit('sentences', bonus, 'Smooth reading');
        setPoints((p) => p + bonus);
        burstRef.current?.shout(nextCombo >= 3 ? `${nextCombo} in a row!` : 'Smooth!', cardRef.current);
        burstRef.current?.burst(bonus, cardRef.current);
        sfx.play('combo', 0.8);
      } else if (how !== 'skipped') sfx.play('correct');
      const ms = (lastHitAt.current || performance.now()) - shownAt.current;
      const log = [...played, { text: items[idx], first: firstPassCount(s), words: wordCount(s), clean, skipped: how === 'skipped', ms }];
      setPlayed(log);
      timers.current.push(
        setTimeout(() => {
          if (idx + 1 >= items.length) finishRoundNow(log, best);
          else setIdx(idx + 1);
        }, how === 'skipped' ? NEXT_MS + 1200 : NEXT_MS),
      );
    },
    [combo, bestCombo, practice, items, idx, store, level.prior, played, finishRoundNow],
  );

  onHypRef.current = (h: VoiceHypothesis) => {
    const s = sentRef.current;
    if (!playing || confirmStop || finished || !h.isFinal) return;
    const idxs = pending(s);
    if (!idxs.length) return;
    let text = h.text;
    // One word left: judge it like Read Words (word mode).
    if (idxs.length === 1) {
      const r = matchWordHypothesis(h, s.words[idxs[0]]);
      recordVoiceVerdict(h.utteranceId, r.verdict);
      text = r.verdict === 'correct' ? s.words[idxs[0]] : '';
    }
    setHeard(h.text || '');
    const res = applyTranscript(s, text);
    const hits = res.firstHits.length + res.rereadHits.length;
    if (!hits) {
      setEmpty((e) => e + 1);
      if (inRetry(s)) setRetries((r) => r + 1);
      return;
    }
    lastHitAt.current = performance.now();
    setEmpty(0);
    const pts = practice ? 0 : Math.round(res.firstHits.length * SENTENCE_POINTS.word * level.prior) + res.rereadHits.length * SENTENCE_POINTS.reread;
    if (pts > 0) {
      credit('sentences', pts, items[idx]);
      setPoints((p) => p + pts);
      burstRef.current?.burst(pts, cardRef.current);
    }
    sfx.play('pop', 0.6);
    const next = res.next;
    setSent(next);
    sentRef.current = next;
    if (isDone(next)) complete(next, isClean(next) ? 'clean' : 'done');
    else if (inRetry(next) && !inRetry(s)) sfx.play('wrong', 0.35);
  };

  // Out of re-reads: say it for him and move on.
  useEffect(() => {
    if (!playing || finished || retries < MAX_RETRIES) return;
    void speak(items[idx]);
    complete(sentRef.current, 'skipped');
  }, [retries, playing, finished, items, idx, complete]);

  // Stuck on the first pass (reads that matched nothing): after 2, say the next word for him;
  // after 3, read the whole sentence and move on with 0 (same as running out of re-reads).
  useEffect(() => {
    if (!playing || finished || empty < 2 || inRetry(sentRef.current)) return;
    if (empty >= 3) {
      void speak(items[idx], { rate: 0.85 });
      complete(sentRef.current, 'skipped');
      return;
    }
    const first = pending(sentRef.current)[0];
    if (first === undefined) return;
    void speak(sentRef.current.words[first] || sentRef.current.tokens[first]);
    const next = helpWord(sentRef.current, first);
    if (next !== sentRef.current) {
      setSent(next);
      sentRef.current = next;
      if (isDone(next)) complete(next, 'done');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty]);

  const tapWord = (i: number) => {
    sfx.unlock();
    void speak(sent.words[i] || sent.tokens[i]);
    if (finished) return;
    const next = helpWord(sent, i);
    if (next !== sent) {
      setSent(next);
      sentRef.current = next;
      if (isDone(next)) complete(next, 'done');
    }
  };

  const hearAll = () => {
    sfx.unlock();
    void speak(items[idx], { rate: 0.8 });
    if (finished) return;
    const next = heardAll(sent);
    setSent(next);
    sentRef.current = next;
  };

  const skip = () => {
    if (finished) return;
    void speak(items[idx], { rate: 0.85 });
    complete(sent, 'skipped');
  };

  const readIt = () => {
    if (finished) return;
    const next = { ...sent, states: sent.states.map((st) => (st === 'todo' || st === 'miss' ? ('reread' as const) : st)) };
    setSent(next);
    complete(next, 'done');
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
    if (played.length) finishRoundNow(played, bestCombo);
    else {
      rv.stop();
      onExit();
    }
  };

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

  const style = { ['--k-app' as string]: 'var(--k-app-sentences)' } as CSSProperties;
  const retry = inRetry(sent);
  const firstNext = pend.length ? pend[0] : -1;
  const totalWords = played.reduce((a, p) => a + p.words, 0);
  const firstWords = played.reduce((a, p) => a + p.first, 0);
  const readMs = played.reduce((a, p) => a + (p.skipped ? 0 : p.ms), 0);
  const wpm = readMs > 0 ? Math.round((played.filter((p) => !p.skipped).reduce((a, p) => a + p.words, 0) / readMs) * 60000) : 0;
  const long = sent.tokens.length > 7;

  const prompt = finished
    ? finished === 'clean'
      ? '🎉 Smooth reading!'
      : finished === 'skipped'
        ? 'Listen…'
        : '👍 You got it!'
    : retry
      ? 'Read the orange words!'
      : empty >= 2
        ? 'Listen, then keep reading!'
        : 'Read it out loud!';

  return (
    <div className="k-screen rd-screen k-noselect" style={style} data-testid="sentence-round">
      <TopBar
        onBack={leave}
        title={phase === 'ready' ? `${level.emoji} ${level.title}` : undefined}
        center={
          phase !== 'ready' ? (
            <div className="rd-dots" data-testid="progress">
              {items.map((_, i) => {
                const p = played[i];
                const cls = p ? (p.clean ? 'is-first' : p.skipped ? 'is-missed' : 'is-ok') : i === idx && playing ? 'is-now' : '';
                return <span key={i} className={`rd-dot ${cls}`} />;
              })}
            </div>
          ) : undefined
        }
        right={phase === 'playing' && !practice && rv.supported ? <ReadingMic rv={rv} onTap={() => rv.start()} /> : undefined}
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
            <div className="rd-ready__peek rd-font">{items[0]}</div>
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

        {phase === 'playing' && (
          <div
            ref={cardRef}
            key={idx}
            className={`rd-card rd-sent-card${finished && finished !== 'skipped' ? ' is-done' : ''}`}
            data-testid="sentence-card"
            data-idx={idx}
            data-finished={finished ?? ''}
            data-text={items[idx]}
          >
            <div className={`rd-sent rd-font${long ? ' rd-sent--long' : ''}`} data-testid="sentence">
              {sent.tokens.map((t, i) => {
                const st = sent.states[i];
                const cls =
                  st === 'hit' || st === 'reread' ? 'is-hit' : st === 'miss' ? 'is-miss' : st === 'helped' ? 'is-helped' : i === firstNext && !retry ? 'is-next' : '';
                return (
                  <button
                    type="button"
                    key={i}
                    className={`rd-w ${cls}`}
                    onClick={() => tapWord(i)}
                    data-testid="sw"
                    data-state={st}
                    aria-label={`${t}. Tap to hear it`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <div className={`rd-prompt${retry ? ' is-wrong' : finished ? ' is-correct' : ''}`} data-testid="prompt" aria-live="polite">
              {prompt}
            </div>
            {heard && !finished && !practice && <div className="rd-heard" data-testid="heard">I heard: “{heard}”</div>}
            {!finished && (
              <div className="rd-actions">
                {canSpeak() && (
                  <BigButton size="lg" variant="ghost" onClick={hearAll} data-testid="hear">
                    <span className="k-emoji">🔊</span> Hear it {!practice && <span className="rd-cost">(fewer ⭐)</span>}
                  </BigButton>
                )}
                {(practice || !rv.supported) && (
                  <BigButton size="lg" variant="success" onClick={readIt} data-testid="read-it">
                    <span className="k-emoji">✅</span> I read it
                  </BigButton>
                )}
                <BigButton size="lg" variant="ghost" onClick={skip} data-testid="skip">
                  Skip <span className="k-emoji">⏭️</span>
                </BigButton>
              </div>
            )}
            {practice && <div className="rd-practice-tag">Practice · no stars</div>}
            {!finished && <div className="rd-tip">Tip: tap a word to hear it</div>}
          </div>
        )}
        {phase === 'playing' && !practice && rv.supported && !finished && (
          <MicPanel
            voice={rv.voice}
            on
            heard={empty > 0 ? { kind: 'unsure', text: 'Say it again?', id: empty } : null}
            say="read the sentence"
            className="rd-micpanel"
          />
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
          emoji={practice ? '📚' : outcome.stars === 3 ? '🏆' : '🎉'}
          stats={[
            { label: 'Words read', value: `${firstWords}/${totalWords}`, emoji: '✅', highlight: true },
            { label: 'Smooth', value: played.filter((p) => p.clean).length, emoji: '🌊' },
            { label: 'Words / min', value: wpm, emoji: '⚡' },
          ]}
          pointsEarned={points + outcome.bonusTotal}
          bonusLines={outcome.bonusLines}
          trophies={outcome.trophies}
          rankUp={outcome.rankUp}
          bestNote={practice ? 'Turn on the microphone to earn stars and points.' : outcome.stopped ? 'Finish all the sentences to earn stars.' : outcome.stars === 0 ? 'Read most words on the first try to earn a star!' : undefined}
          onAgain={onAgain}
          onHome={onExit}
        >
          <div className="rd-summary-stars" data-testid="summary-stars">
            <Stars n={Math.max(outcome.stars, outcome.prevStars)} size="lg" />
          </div>
        </RoundSummary>
      )}
    </div>
  );
}
