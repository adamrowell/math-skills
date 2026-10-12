import { useEffect, useRef, useState } from 'react';
import type { KeypadProps } from '../types';
import './ui.css';

type KeyId = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'back' | 'ok' | 'minus';

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/**
 * Big on-screen keypad (div display elsewhere; never an <input>, so the iPad keyboard
 * never appears). Fires on pointerdown for zero-latency taps. Also binds the physical keyboard.
 */
export function Keypad({
  onDigit,
  onBackspace,
  onClear,
  onSubmit,
  disabled = false,
  allowMinus = false,
  onMinus,
  keyboard = true,
  size = 'lg',
  label = 'Number pad',
  hideSubmit = false,
}: KeypadProps) {
  const [flash, setFlash] = useState<KeyId | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef({ onDigit, onBackspace, onClear, onSubmit, onMinus, disabled, allowMinus });
  useEffect(() => {
    handlers.current = { onDigit, onBackspace, onClear, onSubmit, onMinus, disabled, allowMinus };
  });

  const press = (k: KeyId) => {
    const h = handlers.current;
    if (h.disabled) return;
    setFlash(k);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 110);
    if (k === 'back') h.onBackspace();
    else if (k === 'ok') h.onSubmit();
    else if (k === 'minus') h.onMinus?.();
    else h.onDigit(k);
  };
  const pressRef = useRef(press);
  useEffect(() => {
    pressRef.current = press;
  });

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const k = e.key;
      // A held key auto-repeats ("1" → "111"): only the first press counts (Backspace may repeat).
      if (e.repeat && k !== 'Backspace' && k !== 'Delete') {
        if (/^[0-9]$/.test(k) || k === 'Enter' || k === 'NumpadEnter') e.preventDefault();
        return;
      }
      if (/^[0-9]$/.test(k)) {
        e.preventDefault();
        pressRef.current(k as KeyId);
      } else if (k === 'Backspace' || k === 'Delete') {
        e.preventDefault();
        pressRef.current('back');
      } else if (k === 'Enter' || k === 'NumpadEnter') {
        e.preventDefault();
        pressRef.current('ok');
      } else if (k === 'Escape') {
        if (!handlers.current.disabled) handlers.current.onClear();
      } else if ((k === '-' || k === 'Subtract') && handlers.current.allowMinus) {
        e.preventDefault();
        pressRef.current('minus');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const keys: KeyId[] = hideSubmit
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'back']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];

  const content = (k: KeyId) => (k === 'back' ? '⌫' : k === 'ok' ? '✓' : k === 'minus' ? '−' : k);
  const aria = (k: KeyId) => (k === 'back' ? 'Delete' : k === 'ok' ? 'Enter' : k === 'minus' ? 'Minus' : k);

  return (
    <div
      className={`k-keypad k-keypad--${size} k-noselect${disabled ? ' is-disabled' : ''}`}
      role="group"
      aria-label={label}
      data-testid="keypad"
    >
      {allowMinus && (
        <button
          type="button"
          tabIndex={-1}
          className={`k-key k-key--minus${flash === 'minus' ? ' is-flash' : ''}`}
          aria-label="Minus"
          onPointerDown={(e) => {
            e.preventDefault();
            press('minus');
          }}
        >
          −
        </button>
      )}
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          tabIndex={-1}
          className={`k-key k-key--${k === 'back' || k === 'ok' ? k : 'digit'}${hideSubmit && k === '0' ? ' k-key--wide' : ''}${flash === k ? ' is-flash' : ''}`}
          aria-label={aria(k)}
          data-key={k}
          disabled={disabled}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            press(k);
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {content(k)}
        </button>
      ))}
    </div>
  );
}
