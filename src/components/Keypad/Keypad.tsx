import { useEffect, useRef } from 'react';
import './Keypad.css';

interface KeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  disabled?: boolean;
}

export function Keypad({
  value,
  onChange,
  onSubmit,
  onClear,
  disabled = false,
}: KeypadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      if (e.key >= '0' && e.key <= '9') {
        onChange(value + e.key);
      } else if (e.key === 'Backspace') {
        onChange(value.slice(0, -1));
      } else if (e.key === 'Enter') {
        onSubmit();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        onClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, onChange, onSubmit, onClear, disabled]);

  const handleButtonClick = (digit: string) => {
    if (disabled) return;
    onChange(value + digit);
  };

  const buttons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', '='],
  ];

  return (
    <div className="keypad">
      <input
        ref={inputRef}
        type="text"
        className="keypad__display"
        value={value}
        readOnly
        placeholder="?"
        disabled={disabled}
      />

      <div className="keypad__grid">
        {buttons.map((row, rowIndex) => (
          <div key={rowIndex} className="keypad__row">
            {row.map((btn) => {
              if (btn === 'C') {
                return (
                  <button
                    key={btn}
                    className="keypad__button keypad__button--clear"
                    onClick={onClear}
                    disabled={disabled}
                    type="button"
                  >
                    {btn}
                  </button>
                );
              }
              if (btn === '=') {
                return (
                  <button
                    key={btn}
                    className="keypad__button keypad__button--submit"
                    onClick={onSubmit}
                    disabled={disabled || value === ''}
                    type="button"
                  >
                    GO!
                  </button>
                );
              }
              return (
                <button
                  key={btn}
                  className="keypad__button keypad__button--digit"
                  onClick={() => handleButtonClick(btn)}
                  disabled={disabled}
                  type="button"
                >
                  {btn}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
