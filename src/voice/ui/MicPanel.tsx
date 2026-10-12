/**
 * The on-screen voice status, directly under the problem / word / sentence in every app
 * (docs/UX-V3.md §4.1). One line, fixed height so the card never jumps:
 *
 *   🧠 Getting my ears ready… 43 %  [bar]   You can type meanwhile
 *   ▂▅█▅▂  I'm listening — say the answer
 *   ▃▇█▇▃  …                                 (moves with his voice)
 *   Hmm…                                      (max 2 s, then "Say it again?")
 *   ✓ 56   ·   I heard 54   ·   ❓ Say it again?
 *   Mic is blocked 🚫  [Fix it] [I'll type]
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { UseVoiceInputResult, VoiceError } from '../types';
import { useVoiceState } from '../useVoiceInput';
import { loadFraction, meterHeight, useMicLook, type HeardChip, type MicLookId } from './micLook';
import { fixSteps } from './fix';
import './voice-ui.css';

export interface MicPanelProps {
  voice: UseVoiceInputResult;
  size?: 'sm' | 'md' | 'lg';
  /** What the app made of the last utterance. */
  heard?: HeardChip | null;
  /** Talking is switched on. Default: the mic is doing something (status ≠ off/ready). */
  on?: boolean;
  /** Answers typed this round (enables the "can't hear you" hint after 3). */
  typed?: number;
  /** "say the answer" (default) / "read the word" / "read the sentence". */
  say?: string;
  /** Reserve the slot even when talking is off (drills: the card never jumps). Default true. */
  reserve?: boolean;
  /** "I'll type" was tapped (voice off for this round). Default: voice.stop(). */
  onType?: () => void;
  className?: string;
}

/** Smoothed 0..1 level: attack ~30 ms, decay ~220 ms (rAF). */
function useSmoothedLevel(level: number, active: boolean): number {
  const target = useRef(level);
  target.current = level;
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let cur = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.max(1, t - last);
      last = t;
      const goal = target.current;
      const tau = goal > cur ? 30 : 220;
      cur += (goal - cur) * (1 - Math.exp(-dt / tau));
      setV((prev) => (Math.abs(prev - cur) > 0.004 ? cur : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return active ? v : 0;
}

const BAR_SCALE = [0.6, 0.85, 1, 0.85, 0.6];

export function Meter({ level, idle, big }: { level: number; idle: boolean; big?: boolean }) {
  const h = meterHeight(level);
  return (
    <span className={`vmp__meter${idle ? ' is-idle' : ''}`} aria-hidden="true" data-testid="mic-meter" data-level={h.toFixed(2)}>
      {BAR_SCALE.map((k, i) => (
        <i key={i} style={{ height: `${(8 + 32 * h * k) * (big ? 2 : 1)}px` }} />
      ))}
    </span>
  );
}

function errorTitle(err: VoiceError | null): string {
  switch (err?.code) {
    case 'permission-denied':
      return 'Mic is blocked 🚫';
    case 'no-mic':
      return 'No microphone 🎤';
    case 'insecure-context':
    case 'unsupported':
      return "Talking can't work here";
    default:
      return 'Mic stopped working';
  }
}

export function MicPanel({ voice, size = 'md', heard, on, typed, say = 'say the answer', reserve = true, onType, className }: MicPanelProps) {
  const snap = useVoiceState();
  const [typing, setTyping] = useState(false);
  const [fix, setFix] = useState(false);
  const isOn = (on ?? (voice.status !== 'off' && voice.status !== 'ready')) && !typing;
  const look: MicLookId = useMicLook(voice, isOn, heard, typed, snap.timeoutAt);
  const moving = look === 'listening' || look === 'hearing' || look === 'cant-hear';
  const lvl = useSmoothedLevel(voice.level, moving);

  // A new round (talking turned back on elsewhere) clears "I'll type".
  useEffect(() => {
    if (typing && (voice.status === 'listening' || voice.status === 'hearing')) setTyping(false);
  }, [typing, voice.status]);

  const retry = () => {
    setFix(false);
    setTyping(false);
    // Inside the tap: may re-prompt / reopen the mic.
    try {
      voice.stop();
      void voice.start().catch(() => {});
    } catch {
      /* shown through voice.error */
    }
  };
  const type = () => {
    setFix(false);
    setTyping(true);
    if (onType) onType();
    else voice.stop();
  };

  let body: ReactNode = null;
  switch (look) {
    case 'off':
      body = null;
      break;
    case 'tap':
      body = (
        <button type="button" className="vmp__btn" onClick={retry} data-testid="mic-start">
          <span className="k-emoji">🎤</span> Tap to talk
        </button>
      );
      break;
    case 'arming': {
      const frac = loadFraction(voice.loadProgress, snap.modelState);
      body = (
        <>
          <span className="k-emoji vmp__icon">🧠</span>
          <span className="vmp__col">
            <span className="vmp__text">
              Getting my ears ready…{frac !== null && <b className="k-num"> {Math.round(frac * 100)}%</b>}
            </span>
            <span className={`vmp__bar${frac === null ? ' is-indeterminate' : ''}`}>
              <span style={{ transform: `scaleX(${frac ?? 0.35})` }} />
            </span>
          </span>
          {size !== 'sm' && <span className="vmp__sub">You can type meanwhile</span>}
        </>
      );
      break;
    }
    case 'listening':
      body = (
        <>
          <Meter level={lvl} idle={lvl < 0.03} big={size === 'lg'} />
          <span className="vmp__text">I'm listening — {say}</span>
        </>
      );
      break;
    case 'hearing':
      body = (
        <>
          <Meter level={Math.max(lvl, 0.04)} idle={false} big={size === 'lg'} />
          <span className="vmp__text vmp__text--soft">{heard?.kind === 'partial' ? `${heard.text}…` : '…'}</span>
        </>
      );
      break;
    case 'thinking':
      body = (
        <span className="vmp__text">
          Hmm
          <span className="vmp__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </span>
      );
      break;
    case 'heard-ok':
      body = (
        <span className="vmp__chip is-ok" data-testid="mic-heard">
          ✓ <b className="k-num">{heard?.text}</b>
        </span>
      );
      break;
    case 'heard-wrong':
      body = (
        <span className="vmp__chip is-wrong" data-testid="mic-heard">
          I heard <b>{heard?.text}</b>
        </span>
      );
      break;
    case 'unsure': {
      // The heard-it caption: what it thought he said (short), then "say it again".
      const t = heard?.text ?? '';
      const quoted = heard?.kind === 'unsure' && t && t !== 'Say it again?' && !t.startsWith('Almost') && t.length <= 18;
      body = (
        <span className="vmp__chip is-unsure" data-testid="mic-heard">
          {heard?.kind === 'partial' ? (
            <b>{t}…</b>
          ) : t.startsWith('Almost') ? (
            <>❓ {t}</>
          ) : quoted ? (
            <>
              ❓ “{t}”? Say it again
            </>
          ) : (
            <>❓ Say it again?</>
          )}
        </span>
      );
      break;
    }
    case 'cant-hear':
      body = (
        <button type="button" className="vmp__btn is-soft" onClick={retry} data-testid="mic-cant-hear">
          <Meter level={lvl} idle={lvl < 0.03} />
          Can't hear you — tap 🎤 to check
        </button>
      );
      break;
    case 'error':
      body = (
        <span className="vmp__err" data-testid="mic-error">
          <span className="vmp__text">{errorTitle(voice.error)}</span>
          {voice.error?.code === 'permission-denied' ? (
            <button type="button" className="vmp__btn is-fix" onClick={() => setFix(true)} data-testid="mic-fix">
              Fix it
            </button>
          ) : voice.error?.recoverable !== false ? (
            <button type="button" className="vmp__btn is-fix" onClick={retry} data-testid="mic-retry">
              Try again
            </button>
          ) : null}
          <button type="button" className="vmp__btn is-ghost" onClick={type} data-testid="mic-type">
            I'll type
          </button>
        </span>
      );
      break;
  }

  if (!body && !reserve) return null;
  const style = { ['--vmp-lvl' as string]: String(meterHeight(lvl)) } as CSSProperties;
  return (
    <>
      <div
        className={`vmp vmp--${size} is-${look}${className ? ` ${className}` : ''}`}
        data-testid="mic-panel"
        data-look={look}
        data-engine={voice.engine ?? ''}
        role="status"
        aria-live="polite"
        style={style}
      >
        {body}
      </div>
      {fix && (
        <div className="vmp-sheet" role="dialog" aria-modal="true" aria-label="Fix the microphone" data-testid="mic-fix-sheet" onClick={() => setFix(false)}>
          <div className="vmp-sheet__card" onClick={(e) => e.stopPropagation()}>
            <div className="vmp-sheet__title">
              <span className="k-emoji">🎤</span> Let's fix the mic
            </div>
            <div className="vmp-sheet__sub">Ask a grown-up to:</div>
            <ol className="vmp-sheet__steps">
              {fixSteps(voice.error).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="vmp-sheet__row">
              <button type="button" className="vmp__btn is-fix is-big" onClick={retry} data-testid="mic-retry">
                Try again
              </button>
              <button type="button" className="vmp__btn is-ghost is-big" onClick={type} data-testid="mic-type">
                I'll type
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
