import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'app' | 'primary' | 'accent' | 'ghost' | 'success' | 'danger';
  size?: 'md' | 'lg' | 'xl';
  block?: boolean;
}

/** Chunky 3-D button. Uses --k-app for the 'app' variant. */
export function BigButton({ children, variant = 'app', size = 'lg', block, className = '', type = 'button', ...rest }: BigButtonProps) {
  return (
    <button
      type={type}
      className={`k-btn k-btn--${variant} k-btn--${size}${block ? ' k-btn--block' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
