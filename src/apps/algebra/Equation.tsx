import type { ReactNode } from 'react';
import type { Tok } from './problems';

interface SlotProps {
  /** What he has typed so far. */
  input: string;
  state?: 'idle' | 'correct' | 'wrong';
}

function Slot({ input, state = 'idle' }: SlotProps) {
  return (
    <span className={`al-slot is-${state}${input ? '' : ' is-empty'}`} data-testid="answer" aria-label={input ? `your answer ${input}` : 'missing number'}>
      {input ? <span className="k-num">{input}</span> : <span className="al-slot__q">?</span>}
    </span>
  );
}

function renderTok(k: Tok, i: number, slot: SlotProps | null): ReactNode {
  switch (k.t) {
    case 'n':
      return (
        <span key={i} className="al-n k-num">
          {k.v}
        </span>
      );
    case 'op':
      return (
        <span key={i} className={`al-op${k.v === '=' ? ' al-op--eq' : ''}`}>
          {k.v}
        </span>
      );
    case 'box':
    case 'ans':
      return slot ? <Slot key={i} {...slot} /> : <span key={i} className="al-slot is-ghost" aria-hidden="true" />;
    case 'x':
      return (
        <span key={i} className="al-term">
          {k.c ? <span className="al-n k-num al-coef">{k.c}</span> : null}
          <span className="al-x">x</span>
        </span>
      );
    case 'frac':
      return (
        <span key={i} className="al-frac" aria-label={`x divided by ${k.c}`}>
          <span className="al-frac__top">
            <span className="al-x">x</span>
          </span>
          <span className="al-frac__bar" />
          <span className="al-frac__bot k-num">{k.c}</span>
        </span>
      );
    case 'pic':
      return (
        <span key={i} className="al-pic k-emoji">
          {k.v}
        </span>
      );
  }
}

/** Split a line at its first '=' → [left, right] for grid alignment. */
function split(line: Tok[]): [Tok[], Tok[]] {
  const i = line.findIndex((k) => k.t === 'op' && k.v === '=');
  if (i < 0) return [line, []];
  return [line.slice(0, i), line.slice(i + 1)];
}

interface EquationProps {
  lines: Tok[][];
  /** Where typed digits render (box / ans tokens); null renders an empty ghost. */
  slot?: SlotProps | null;
  size?: 'hero' | 'big' | 'mid' | 'small';
  className?: string;
}

/**
 * Typeset equations. Lines align on '=' (a 3-column grid), so puzzles and worked steps
 * read like a tidy page of working.
 */
export function Equation({ lines, slot = null, size = 'big', className = '' }: EquationProps) {
  return (
    <div className={`al-eqs al-eqs--${size} ${className}`} role="math">
      {lines.map((line, li) => {
        const [l, r] = split(line);
        return (
          <div className="al-eqrow" key={li}>
            <span className="al-side al-side--l">{l.map((k, i) => renderTok(k, i, slot))}</span>
            {r.length > 0 && <span className="al-op al-op--eq">=</span>}
            <span className="al-side al-side--r">{r.map((k, i) => renderTok(k, i, slot))}</span>
          </div>
        );
      })}
    </div>
  );
}
