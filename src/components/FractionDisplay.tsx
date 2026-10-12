import './FractionDisplay.css';

interface FractionDisplayProps {
  display: string;
  className?: string;
}

// Parse fraction strings like "1/2", "3 1/4", "0.5", "25%", "2 + 3", etc.
function parseFractionDisplay(display: string): React.ReactNode {
  // Check for mixed number like "3 1/4"
  const mixedMatch = display.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const [, whole, num, den] = mixedMatch;
    return (
      <span className="fraction-display__mixed">
        <span className="fraction-display__whole">{whole}</span>
        <span className="fraction-display__fraction">
          <span className="fraction-display__numerator">{num}</span>
          <span className="fraction-display__line" />
          <span className="fraction-display__denominator">{den}</span>
        </span>
      </span>
    );
  }

  // Check for simple fraction like "1/2"
  const fractionMatch = display.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const [, num, den] = fractionMatch;
    return (
      <span className="fraction-display__fraction">
        <span className="fraction-display__numerator">{num}</span>
        <span className="fraction-display__line" />
        <span className="fraction-display__denominator">{den}</span>
      </span>
    );
  }

  // Check for expression like "2 + 3" or "4 x 5"
  const exprMatch = display.match(/^(\d+)\s*([+\-×÷])\s*(\d+)$/);
  if (exprMatch) {
    const [, left, op, right] = exprMatch;
    return (
      <span className="fraction-display__expression">
        {left} {op} {right}
      </span>
    );
  }

  // Return as-is for decimals, percentages, word numbers, etc.
  return <span className="fraction-display__value">{display}</span>;
}

export function FractionDisplay({ display, className = '' }: FractionDisplayProps) {
  return (
    <span className={`fraction-display ${className}`}>
      {parseFractionDisplay(display)}
    </span>
  );
}
