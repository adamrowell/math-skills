/**
 * The 48 px mic toggle in the TopBar (docs/UX-V3.md §4.1). Same look in every app: it reads the
 * shared MicLook, so the chip and the MicPanel under the problem never disagree.
 *
 *   <MicChip voice={voice} on={settings.voice.enabled} onToggle={toggleMic} />            // play
 *   <MicChip voice={voice} on={on} onToggle={toggle} variant="home" />                     // app home
 */
import type { CSSProperties } from 'react';
import type { UseVoiceInputResult } from '../types';
import { useVoiceState } from '../useVoiceInput';
import { loadFraction, meterHeight, useMicLook, type MicLookId } from './micLook';
import './voice-ui.css';

export interface MicChipProps {
  voice: UseVoiceInputResult;
  /** Talking is switched on (settings.voice.enabled). */
  on: boolean;
  /** Tap: the caller toggles talking, or retries the mic after a problem (inside the tap). */
  onToggle: () => void;
  variant?: 'home' | 'play';
  className?: string;
  /** Answers typed this round: pass the same count as the MicPanel so both show the same look. */
  typed?: number;
}

const LABEL: Record<MicLookId, string> = {
  off: 'Talking is off. Tap to turn it on',
  tap: 'Talking is on. Tap to start the microphone',
  arming: 'Getting my ears ready',
  listening: 'Listening. Say the answer',
  hearing: 'Hearing you',
  thinking: 'Thinking',
  'heard-ok': 'Got it',
  'heard-wrong': 'Listening',
  unsure: 'Say it again',
  'cant-hear': 'I cannot hear you. Tap to check the microphone',
  error: 'Microphone problem. Tap to try again',
};

const ICON: Record<MicLookId, string> = {
  off: '🎤',
  tap: '🎤',
  arming: '🧠',
  listening: '👂',
  hearing: '👂',
  thinking: '💭',
  'heard-ok': '✅',
  'heard-wrong': '👂',
  unsure: '❓',
  'cant-hear': '👂',
  error: '🎤',
};

export function MicChip({ voice, on, onToggle, variant = 'play', className, typed }: MicChipProps) {
  const snap = useVoiceState();
  const playLook = useMicLook(voice, on, null, typed, snap.timeoutAt);
  // On a home screen the mic is not open yet: the chip only says on / off.
  const look: MicLookId = variant === 'home' ? (on ? (playLook === 'error' ? 'error' : 'tap') : 'off') : playLook;
  const frac = look === 'arming' ? loadFraction(voice.loadProgress, snap.modelState) : null;
  const pct = frac === null ? null : Math.round(frac * 100);
  const style = {
    ['--vmc-lvl' as string]: String(look === 'hearing' || look === 'listening' ? meterHeight(voice.level) : 0),
    ['--vmc-pct' as string]: String(frac ?? 0),
  } as CSSProperties;
  const label = pct !== null ? `${LABEL[look]} ${pct}%` : LABEL[look];
  return (
    <button
      type="button"
      className={`vmc vmc--${variant} is-${look}${on ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={on}
      title={label}
      data-testid={variant === 'home' ? 'voice-toggle' : 'mic'}
      data-look={look}
      data-engine={voice.engine ?? ''}
      style={style}
    >
      <span className="vmc__ring" aria-hidden="true" />
      {frac !== null && <span className="vmc__progress" aria-hidden="true" />}
      <span className="k-emoji vmc__icon" aria-hidden="true">
        {ICON[look]}
      </span>
      {look === 'off' && <span className="vmc__slash" aria-hidden="true" />}
      {look === 'thinking' && (
        <span className="vmc__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      {look === 'error' && <span className="vmc__bang">!</span>}
      {look === 'cant-hear' && <span className="vmc__dot" aria-hidden="true" />}
      {(variant === 'home' || look === 'off') && <span className="vmc__word">{on ? 'On' : 'Off'}</span>}
    </button>
  );
}
