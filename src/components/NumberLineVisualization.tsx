import { useMemo } from 'react';
import { ComparisonValue } from '../config/comparisonConfig';
import './NumberLineVisualization.css';

interface NumberLineVisualizationProps {
  left: ComparisonValue;
  right: ComparisonValue;
  highlightCorrect?: boolean;
}

export function NumberLineVisualization({ left, right, highlightCorrect }: NumberLineVisualizationProps) {
  // Calculate the range for the number line
  const { min, max, ticks, leftPosition, rightPosition } = useMemo(() => {
    const values = [left.numericValue, right.numericValue];
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    // Add padding to the range
    const range = maxVal - minVal || 1;
    const padding = range * 0.2;
    let min = Math.floor(minVal - padding);
    let max = Math.ceil(maxVal + padding);

    // Ensure 0 is included for negatives
    if (minVal < 0 && maxVal > 0) {
      min = Math.min(min, Math.floor(minVal * 1.2));
      max = Math.max(max, Math.ceil(maxVal * 1.2));
    }

    // For small decimals, adjust
    if (Math.abs(max - min) < 2) {
      min = Math.floor(minVal * 10) / 10 - 0.5;
      max = Math.ceil(maxVal * 10) / 10 + 0.5;
    }

    // Generate tick marks
    const tickCount = 11;
    const tickStep = (max - min) / (tickCount - 1);
    const ticks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      const val = min + i * tickStep;
      // Round to reasonable precision
      ticks.push(Math.round(val * 100) / 100);
    }

    // Calculate positions as percentages
    const rangeSize = max - min;
    const leftPosition = ((left.numericValue - min) / rangeSize) * 100;
    const rightPosition = ((right.numericValue - min) / rangeSize) * 100;

    return { min, max, ticks, leftPosition, rightPosition };
  }, [left.numericValue, right.numericValue]);

  const leftIsBigger = left.numericValue > right.numericValue;
  const areEqual = Math.abs(left.numericValue - right.numericValue) < 0.0001;

  return (
    <div className="number-line-viz">
      <div className="number-line-viz__title">Number Line Comparison</div>

      <div className="number-line-viz__container">
        {/* The line */}
        <div className="number-line-viz__line">
          {/* Zero marker if in range */}
          {min <= 0 && max >= 0 && (
            <div
              className="number-line-viz__zero"
              style={{ left: `${((0 - min) / (max - min)) * 100}%` }}
            >
              <div className="number-line-viz__zero-line" />
              <span className="number-line-viz__zero-label">0</span>
            </div>
          )}

          {/* Tick marks */}
          {ticks.map((tick, i) => (
            <div
              key={i}
              className="number-line-viz__tick"
              style={{ left: `${(i / (ticks.length - 1)) * 100}%` }}
            >
              <div className="number-line-viz__tick-mark" />
              <span className="number-line-viz__tick-label">
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </span>
            </div>
          ))}

          {/* Left value marker */}
          <div
            className={`number-line-viz__marker number-line-viz__marker--left ${
              highlightCorrect && (leftIsBigger || areEqual) ? 'number-line-viz__marker--correct' : ''
            }`}
            style={{ left: `${leftPosition}%` }}
          >
            <div className="number-line-viz__marker-dot" />
            <div className="number-line-viz__marker-label">
              {left.display}
              <span className="number-line-viz__marker-value">
                = {left.numericValue.toFixed(3)}
              </span>
            </div>
          </div>

          {/* Right value marker */}
          <div
            className={`number-line-viz__marker number-line-viz__marker--right ${
              highlightCorrect && (!leftIsBigger || areEqual) ? 'number-line-viz__marker--correct' : ''
            }`}
            style={{ left: `${rightPosition}%` }}
          >
            <div className="number-line-viz__marker-dot" />
            <div className="number-line-viz__marker-label">
              {right.display}
              <span className="number-line-viz__marker-value">
                = {right.numericValue.toFixed(3)}
              </span>
            </div>
          </div>

          {/* Arrow showing direction */}
          <div className="number-line-viz__direction">
            <span className="number-line-viz__direction-arrow">→</span>
            <span className="number-line-viz__direction-text">Bigger</span>
          </div>
        </div>
      </div>

      <div className="number-line-viz__explanation">
        {areEqual ? (
          <span>Both values are equal!</span>
        ) : leftIsBigger ? (
          <span>
            <strong>{left.display}</strong> is further right, so it's <strong>bigger</strong>
          </span>
        ) : (
          <span>
            <strong>{right.display}</strong> is further right, so it's <strong>bigger</strong>
          </span>
        )}
      </div>
    </div>
  );
}
