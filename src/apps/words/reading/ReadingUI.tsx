/** Shared pieces of the reading apps: level path, voice card, mic chip, stars, parent unlock. */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { sfx, toast } from '../../../core';
import { ParentGate } from '../../../hub/ParentGate';
import { MicChip } from '../../../voice';
import type { ReadingVoice } from './useReadingVoice';
import { isUnlocked } from './progress';
import type { ReadingProgress } from './progress';
import './reading.css';

export function Stars({ n, size = 'md' }: { n: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`rd-stars rd-stars--${size}`} aria-label={`${n} of 3 stars`} data-testid="stars" data-stars={n}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`rd-star${i < n ? ' is-on' : ''}`} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

export interface LevelCardInfo {
  id: string;
  title: string;
  emoji: string;
  preview: string;
}

/** The level map: numbered cards with stars; locked ones show a padlock. */
export function LevelPath({
  levels,
  progress,
  current,
  onPick,
}: {
  levels: LevelCardInfo[];
  progress: ReadingProgress;
  current: string;
  onPick: (id: string) => void;
}) {
  const ids = levels.map((l) => l.id);
  return (
    <div className="rd-levels" data-testid="levels">
      {levels.map((l, i) => {
        const open = isUnlocked(ids, i, progress);
        const stars = progress.levels[l.id]?.stars ?? 0;
        return (
          <button
            key={l.id}
            type="button"
            className={`rd-level${open ? '' : ' is-locked'}${l.id === current ? ' is-current' : ''}${stars ? ' is-done' : ''}`}
            data-testid={`level-${l.id}`}
            data-locked={open ? 'false' : 'true'}
            aria-label={`Level ${i + 1}: ${l.title}${open ? '' : ' (locked)'}`}
            onClick={() => {
              if (!open) {
                sfx.play('wrong', 0.4);
                toast.show(`Get a star on level ${i} first!`, { emoji: '⭐', durationMs: 1800 });
                return;
              }
              onPick(l.id);
            }}
          >
            <span className="rd-level__num k-num">{i + 1}</span>
            <span className="rd-level__emoji k-emoji">{open ? l.emoji : '🔒'}</span>
            <span className="rd-level__title">{l.title}</span>
            <span className="rd-level__preview rd-font">{l.preview}</span>
            <Stars n={stars} size="sm" />
          </button>
        );
      })}
    </div>
  );
}

/** Mic chip for the top bar: the shared voice MicChip (same look as every other app). */
export function ReadingMic({ rv, onTap }: { rv: ReadingVoice; onTap: () => void }) {
  return <MicChip voice={rv.voice} on onToggle={onTap} />;
}

/** Friendly "the listening brain is getting ready" bar (one-time model download). */
export function BrainBar({ fraction, note }: { fraction: number; note?: ReactNode }) {
  const pct = Math.round(fraction * 100);
  return (
    <div className="rd-brain" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} data-testid="brain">
      <div className="rd-brain__row">
        <span className="k-emoji">🧠</span> Getting my listening ears ready… <b className="k-num">{pct}%</b>
      </div>
      <div className="rd-brain__bar">
        <span style={{ transform: `scaleX(${fraction})` }} />
      </div>
      {note && <div className="rd-brain__note">{note}</div>}
    </div>
  );
}

/** Small press-and-hold link that opens the grown-up gate, then unlocks every level. */
export function UnlockAllLink({ onUnlock, done }: { onUnlock: () => void; done: boolean }) {
  const [holding, setHolding] = useState(false);
  const [gate, setGate] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  if (done) return null;
  const cancel = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <>
      <button
        type="button"
        className={`rd-unlock${holding ? ' is-holding' : ''}`}
        data-testid="unlock-all"
        onPointerDown={() => {
          setHolding(true);
          timer.current = setTimeout(() => {
            setHolding(false);
            setGate(true);
          }, 1500);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        🔑 Grown-ups: hold to open all levels
      </button>
      {gate && (
        <div className="rd-gate">
          <ParentGate
            onPass={() => {
              setGate(false);
              onUnlock();
              toast.show('All levels open', { emoji: '🔓', kind: 'success' });
            }}
            onFail={() => setGate(false)}
          />
        </div>
      )}
    </>
  );
}

/** Voice readiness note for the home / ready screens. */
export function VoiceNote({ rv }: { rv: ReadingVoice }) {
  if (!rv.supported) {
    return (
      <div className="rd-note is-warn" data-testid="voice-note">
        <span className="k-emoji">🎤</span> Talking does not work here, so this is practice only (no stars).
      </div>
    );
  }
  if (rv.error) {
    return (
      <div className="rd-note is-warn" data-testid="voice-note">
        <span className="k-emoji">🎤</span> {rv.error}
      </div>
    );
  }
  if (rv.brain !== null)
    return (
      <BrainBar
        fraction={rv.brain}
        note={rv.voice.capabilities.webspeech ? "You can start now. I'm listening while it loads!" : 'One-time download. It is quick next time!'}
      />
    );
  return null;
}
