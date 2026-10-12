// Simple SVG-based pie chart for visualizing fractions (values between 0 and 1)
import { ComparisonValue } from '../config/comparisonConfig';

interface FractionPieChartProps {
  left: ComparisonValue;
  right: ComparisonValue;
  highlightCorrect?: boolean;
}

interface SinglePieProps {
  value: number;
  display: string;
  color: string;
  isWinner: boolean;
}

function SinglePie({ value, display, color, isWinner }: SinglePieProps) {
  // Clamp value between 0 and 1
  const clampedValue = Math.max(0, Math.min(1, value));

  // Calculate the pie slice path
  const radius = 40;
  const cx = 50;
  const cy = 50;

  // For a full circle when value = 1
  if (clampedValue >= 0.9999) {
    return (
      <div className="fraction-pie">
        <svg viewBox="0 0 100 100" className="fraction-pie__svg">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill={color}
            stroke={isWinner ? '#4CAF50' : '#ddd'}
            strokeWidth={isWinner ? 4 : 2}
          />
        </svg>
        <div className="fraction-pie__label">{display}</div>
        <div className="fraction-pie__decimal">= {value.toFixed(2)}</div>
      </div>
    );
  }

  // For empty circle when value = 0
  if (clampedValue <= 0.0001) {
    return (
      <div className="fraction-pie">
        <svg viewBox="0 0 100 100" className="fraction-pie__svg">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="#f5f5f5"
            stroke={isWinner ? '#4CAF50' : '#ddd'}
            strokeWidth={isWinner ? 4 : 2}
          />
        </svg>
        <div className="fraction-pie__label">{display}</div>
        <div className="fraction-pie__decimal">= {value.toFixed(2)}</div>
      </div>
    );
  }

  // Calculate end point of the arc
  const angle = clampedValue * 2 * Math.PI;
  const endX = cx + radius * Math.sin(angle);
  const endY = cy - radius * Math.cos(angle);

  // Determine if we need the large arc flag
  const largeArcFlag = clampedValue > 0.5 ? 1 : 0;

  // Create the path for the filled portion
  const pathD = [
    `M ${cx} ${cy}`,                    // Move to center
    `L ${cx} ${cy - radius}`,           // Line to top (12 o'clock)
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
    'Z'                                  // Close path
  ].join(' ');

  return (
    <div className={`fraction-pie ${isWinner ? 'fraction-pie--winner' : ''}`}>
      <svg viewBox="0 0 100 100" className="fraction-pie__svg">
        {/* Background circle */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="#f0f0f0"
          stroke={isWinner ? '#4CAF50' : '#ddd'}
          strokeWidth={isWinner ? 4 : 2}
        />
        {/* Filled portion */}
        <path
          d={pathD}
          fill={color}
          stroke={isWinner ? '#4CAF50' : '#ddd'}
          strokeWidth={1}
        />
        {/* Center dot for reference */}
        <circle cx={cx} cy={cy} r={2} fill="#999" />
      </svg>
      <div className="fraction-pie__label">{display}</div>
      <div className="fraction-pie__decimal">= {value.toFixed(2)}</div>
    </div>
  );
}

export function FractionPieChart({ left, right, highlightCorrect }: FractionPieChartProps) {
  // Only show for values between 0 and 1 (inclusive)
  const showLeft = left.numericValue >= 0 && left.numericValue <= 1;
  const showRight = right.numericValue >= 0 && right.numericValue <= 1;

  // If neither value is in range, don't render
  if (!showLeft && !showRight) {
    return null;
  }

  // Determine winner
  const leftWins = Boolean(highlightCorrect && left.numericValue > right.numericValue);
  const rightWins = Boolean(highlightCorrect && right.numericValue > left.numericValue);

  return (
    <div className="fraction-pie-chart">
      <div className="fraction-pie-chart__pies">
        {showLeft && (
          <SinglePie
            value={left.numericValue}
            display={left.display}
            color="#667eea"
            isWinner={leftWins}
          />
        )}

        <div className="fraction-pie-chart__vs">vs</div>

        {showRight && (
          <SinglePie
            value={right.numericValue}
            display={right.display}
            color="#764ba2"
            isWinner={rightWins}
          />
        )}
      </div>
    </div>
  );
}

export default FractionPieChart;
