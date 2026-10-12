import { ComparisonValue } from '../config/comparisonConfig';
import './FractionBarVisualization.css';

interface FractionBarVisualizationProps {
  left: ComparisonValue;
  right: ComparisonValue;
  highlightCorrect?: boolean;
}

export function FractionBarVisualization({ left, right, highlightCorrect }: FractionBarVisualizationProps) {
  // Normalize values to percentages for bar display
  const maxValue = Math.max(left.numericValue, right.numericValue, 1);
  const leftPercent = Math.min((left.numericValue / maxValue) * 100, 100);
  const rightPercent = Math.min((right.numericValue / maxValue) * 100, 100);

  const leftIsBigger = left.numericValue > right.numericValue;
  const areEqual = Math.abs(left.numericValue - right.numericValue) < 0.0001;

  // Parse fraction display to show visual segments
  const parseFraction = (display: string): { numerator: number; denominator: number } | null => {
    // Handle mixed numbers like "2 1/2"
    const mixedMatch = display.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1]);
      const num = parseInt(mixedMatch[2]);
      const den = parseInt(mixedMatch[3]);
      return { numerator: whole * den + num, denominator: den };
    }

    // Handle simple fractions like "1/2"
    const fractionMatch = display.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
      return {
        numerator: parseInt(fractionMatch[1]),
        denominator: parseInt(fractionMatch[2]),
      };
    }

    return null;
  };

  const leftFraction = parseFraction(left.display);
  const rightFraction = parseFraction(right.display);

  // Render fraction segments
  const renderFractionSegments = (
    fraction: { numerator: number; denominator: number } | null,
    side: 'left' | 'right'
  ) => {
    if (!fraction || fraction.denominator > 12) {
      return null;
    }

    const segments = [];
    for (let i = 0; i < fraction.denominator; i++) {
      const isFilled = i < fraction.numerator;
      segments.push(
        <div
          key={i}
          className={`fraction-bar-viz__segment ${
            isFilled ? 'fraction-bar-viz__segment--filled' : ''
          } ${side === 'left' ? 'fraction-bar-viz__segment--blue' : 'fraction-bar-viz__segment--orange'}`}
        />
      );
    }

    return (
      <div className="fraction-bar-viz__segments">
        {segments}
        <span className="fraction-bar-viz__segment-count">
          {fraction.numerator} of {fraction.denominator} parts
        </span>
      </div>
    );
  };

  return (
    <div className="fraction-bar-viz">
      <div className="fraction-bar-viz__title">Visual Comparison</div>

      <div className="fraction-bar-viz__bars">
        {/* Left value */}
        <div className="fraction-bar-viz__bar-container">
          <div className="fraction-bar-viz__label">
            <span className="fraction-bar-viz__value">{left.display}</span>
            <span className="fraction-bar-viz__decimal">= {left.numericValue.toFixed(3)}</span>
          </div>

          <div className="fraction-bar-viz__bar-wrapper">
            <div
              className={`fraction-bar-viz__bar fraction-bar-viz__bar--left ${
                highlightCorrect && (leftIsBigger || areEqual) ? 'fraction-bar-viz__bar--correct' : ''
              }`}
              style={{ width: `${leftPercent}%` }}
            />
          </div>

          {leftFraction && renderFractionSegments(leftFraction, 'left')}
        </div>

        {/* Comparison indicator */}
        <div className="fraction-bar-viz__comparison">
          <span className="fraction-bar-viz__comparison-symbol">
            {areEqual ? '=' : leftIsBigger ? '>' : '<'}
          </span>
        </div>

        {/* Right value */}
        <div className="fraction-bar-viz__bar-container">
          <div className="fraction-bar-viz__label">
            <span className="fraction-bar-viz__value">{right.display}</span>
            <span className="fraction-bar-viz__decimal">= {right.numericValue.toFixed(3)}</span>
          </div>

          <div className="fraction-bar-viz__bar-wrapper">
            <div
              className={`fraction-bar-viz__bar fraction-bar-viz__bar--right ${
                highlightCorrect && (!leftIsBigger || areEqual) ? 'fraction-bar-viz__bar--correct' : ''
              }`}
              style={{ width: `${rightPercent}%` }}
            />
          </div>

          {rightFraction && renderFractionSegments(rightFraction, 'right')}
        </div>
      </div>

      <div className="fraction-bar-viz__explanation">
        {areEqual ? (
          <span>Both values are <strong>equal</strong>!</span>
        ) : leftIsBigger ? (
          <span>
            <strong>{left.display}</strong> fills more of the bar, so it's <strong>bigger</strong>
          </span>
        ) : (
          <span>
            <strong>{right.display}</strong> fills more of the bar, so it's <strong>bigger</strong>
          </span>
        )}
      </div>
    </div>
  );
}
