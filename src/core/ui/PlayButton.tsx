import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import './play.css';

export type PlayButtonVariant = 'play' | 'go' | 'continue' | 'again' | 'mic';

export interface PlayButtonProps {
  variant?: PlayButtonVariant;
  /** Overrides the variant's default label. */
  label?: ReactNode;
  onClick: () => void;
  size?: 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
  'aria-label'?: string;
}

const ICON: Record<PlayButtonVariant, string> = { play: '▶', go: '▶', continue: '▶', again: '↻', mic: '🎤' };
const LABEL: Record<PlayButtonVariant, string> = { play: 'PLAY', go: 'GO', continue: 'PLAY', again: 'AGAIN', mic: 'Turn on my ears' };

/**
 * The one primary button (UX-V3 §2.4): green pill, same place on every screen, breathes gently.
 * Nothing else on a screen is green and pill-shaped.
 */
export const PlayButton = forwardRef<HTMLButtonElement, PlayButtonProps>(function PlayButton(
  { variant = 'play', label, onClick, size = 'lg', className = '', disabled, 'data-testid': testId = 'play', 'aria-label': ariaLabel },
  ref,
) {
  const icon = ICON[variant];
  const iconAfter = variant === 'again';
  return (
    <button
      ref={ref}
      type="button"
      className={`k-play k-play--${variant} k-play--${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {!iconAfter && (
        <span className={`k-play__icon${variant === 'mic' ? ' k-emoji' : ''}`} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="k-play__label">{label ?? LABEL[variant]}</span>
      {iconAfter && (
        <span className="k-play__icon" aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );
});
