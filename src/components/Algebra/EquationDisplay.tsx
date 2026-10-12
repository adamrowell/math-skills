import { memo } from 'react';
import { DisplayPart } from '../../utils/algebraGenerator';
import './Algebra.css';

interface EquationDisplayProps {
  parts: DisplayPart[];
  size?: 'small' | 'medium' | 'large';
  showAnimation?: boolean;
  className?: string;
}

export const EquationDisplay = memo(function EquationDisplay({
  parts,
  size = 'large',
  showAnimation = true,
  className = '',
}: EquationDisplayProps) {
  return (
    <div className={`equation-display equation-display--${size} ${className}`}>
      {parts.map((part, index) => (
        <span
          key={index}
          className={`equation-part equation-part--${part.type} ${part.highlight ? 'equation-part--highlight' : ''} ${showAnimation ? 'equation-part--animated' : ''}`}
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          {part.value}
        </span>
      ))}
    </div>
  );
});

interface SimpleEquationDisplayProps {
  equation: string;
  size?: 'small' | 'medium' | 'large';
  highlightVariable?: boolean;
  className?: string;
}

export const SimpleEquationDisplay = memo(function SimpleEquationDisplay({
  equation,
  size = 'large',
  highlightVariable = true,
  className = '',
}: SimpleEquationDisplayProps) {
  // Parse equation string into parts
  const parts: DisplayPart[] = [];
  let current = '';

  for (let i = 0; i < equation.length; i++) {
    const char = equation[i];

    if (char === ' ') {
      if (current) {
        parts.push(parseToken(current, highlightVariable));
        current = '';
      }
      continue;
    }

    if (['+', '-', '×', '÷', '=', '(', ')'].includes(char)) {
      if (current) {
        parts.push(parseToken(current, highlightVariable));
        current = '';
      }
      parts.push({
        type: char === '=' ? 'equals' : ['(', ')'].includes(char) ? 'parenthesis' : 'operator',
        value: char,
      });
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(parseToken(current, highlightVariable));
  }

  return <EquationDisplay parts={parts} size={size} className={className} />;
});

function parseToken(token: string, highlightVariable: boolean): DisplayPart {
  if (token === '?') {
    return { type: 'unknown', value: '?' };
  }
  if (/^-?\d+$/.test(token)) {
    return { type: 'number', value: token };
  }
  if (/^[xyz]$/.test(token.toLowerCase())) {
    return { type: 'variable', value: token, highlight: highlightVariable };
  }
  if (/^\d+[xyz]$/.test(token.toLowerCase())) {
    // Coefficient with variable like "2x"
    return { type: 'variable', value: token, highlight: highlightVariable };
  }
  return { type: 'number', value: token };
}

export default EquationDisplay;
