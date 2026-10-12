import { memo, useMemo } from 'react';
import './Algebra.css';

interface BalanceScaleProps {
  leftValue: number;
  rightValue: number;
  leftLabel?: string;
  rightLabel?: string;
  showSymbols?: boolean;
  symbol?: string;
  showEquality?: boolean;
  interactive?: boolean;
  onBalanced?: () => void;
}

export const BalanceScale = memo(function BalanceScale({
  leftValue,
  rightValue,
  leftLabel,
  rightLabel,
  showSymbols = true,
  symbol = '🔵',
  showEquality = true,
  interactive = false,
}: BalanceScaleProps) {
  const isBalanced = leftValue === rightValue;
  const tiltAngle = useMemo(() => {
    const diff = leftValue - rightValue;
    // Max 15 degrees tilt
    return Math.max(-15, Math.min(15, diff * 2));
  }, [leftValue, rightValue]);

  // Generate symbols for display
  const renderSymbols = (count: number) => {
    if (!showSymbols) {
      return <span className="balance-value">{count}</span>;
    }

    const maxDisplay = 12;
    const displayCount = Math.min(count, maxDisplay);

    return (
      <>
        {Array.from({ length: displayCount }, (_, i) => (
          <span key={i} className="balance-item">
            {symbol}
          </span>
        ))}
        {count > maxDisplay && (
          <span className="balance-more">+{count - maxDisplay}</span>
        )}
      </>
    );
  };

  return (
    <div className="balance-scale">
      <div className="balance-beam-container">
        {showEquality && (
          <div className="balance-equal-sign">=</div>
        )}

        <div
          className="balance-beam"
          style={{ transform: `rotate(${tiltAngle}deg)` }}
        />

        <div className="balance-string balance-string--left" />
        <div className="balance-string balance-string--right" />

        <div
          className="balance-pan balance-pan--left"
          style={{
            transform: `translateY(${tiltAngle * 2}px)`,
          }}
        >
          {leftLabel && <div className="balance-label">{leftLabel}</div>}
          {renderSymbols(leftValue)}
        </div>

        <div
          className="balance-pan balance-pan--right"
          style={{
            transform: `translateY(${-tiltAngle * 2}px)`,
          }}
        >
          {rightLabel && <div className="balance-label">{rightLabel}</div>}
          {renderSymbols(rightValue)}
        </div>

        <div className="balance-fulcrum" />
      </div>

      <div
        className={`balance-indicator ${isBalanced ? 'balance-indicator--balanced' : 'balance-indicator--unbalanced'}`}
      >
        {isBalanced ? 'Balanced!' : leftValue > rightValue ? 'Left is heavier' : 'Right is heavier'}
      </div>

      {interactive && !isBalanced && (
        <div className="balance-hint">
          Add {Math.abs(leftValue - rightValue)} to the {leftValue < rightValue ? 'left' : 'right'} side
        </div>
      )}
    </div>
  );
});

interface EquationBalanceProps {
  coefficient: number;
  variable: string;
  constant: number;
  result: number;
  showSolution?: boolean;
}

export const EquationBalance = memo(function EquationBalance({
  coefficient,
  variable,
  constant,
  result,
  showSolution = false,
}: EquationBalanceProps) {
  // Calculate the variable value
  const variableValue = (result - constant) / coefficient;

  // Left side: coefficient * variable + constant
  const leftDisplay = useMemo(() => {
    if (coefficient === 1) {
      if (constant === 0) return variable;
      if (constant > 0) return `${variable} + ${constant}`;
      return `${variable} - ${Math.abs(constant)}`;
    }
    if (constant === 0) return `${coefficient}${variable}`;
    if (constant > 0) return `${coefficient}${variable} + ${constant}`;
    return `${coefficient}${variable} - ${Math.abs(constant)}`;
  }, [coefficient, variable, constant]);

  return (
    <div className="equation-balance">
      <div className="equation-balance__equation">
        <span className="equation-balance__left">{leftDisplay}</span>
        <span className="equation-balance__equals">=</span>
        <span className="equation-balance__right">{result}</span>
      </div>

      {showSolution && (
        <div className="equation-balance__solution">
          <div className="equation-balance__step">
            Step 1: Subtract {constant} from both sides
          </div>
          <div className="equation-balance__step">
            {coefficient > 1 ? `${coefficient}${variable}` : variable} = {result - constant}
          </div>
          {coefficient > 1 && (
            <>
              <div className="equation-balance__step">
                Step 2: Divide both sides by {coefficient}
              </div>
              <div className="equation-balance__step">
                {variable} = {variableValue}
              </div>
            </>
          )}
          <div className="equation-balance__answer">
            Answer: {variable} = {variableValue}
          </div>
        </div>
      )}
    </div>
  );
});

export default BalanceScale;
