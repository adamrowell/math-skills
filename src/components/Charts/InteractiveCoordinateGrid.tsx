import { memo } from 'react';
import { ChartData } from '../../data/charts/chartDataGenerator';
import './ChartStyles.css';

interface InteractiveCoordinateGridProps {
  data: ChartData;
  onCellClick?: (name: string) => void;
  showValues?: boolean;
  disabled?: boolean;
  highlightedCell?: string;
}

export const InteractiveCoordinateGrid = memo(function InteractiveCoordinateGrid({
  data,
  onCellClick,
  showValues = false,
  disabled = false,
  highlightedCell,
}: InteractiveCoordinateGridProps) {
  void showValues; // Grid always shows treasures
  // Grid data format: data.grid is a 2D array, data.gridSize has rows/cols
  const grid = data.grid || [];
  const rawGridSize = data.gridSize;
  const gridSize = typeof rawGridSize === 'object' ? rawGridSize : { rows: rawGridSize || 5, cols: rawGridSize || 5 };

  const handleClick = (x: number, y: number) => {
    if (!disabled && onCellClick) {
      onCellClick(`${x},${y}`);
    }
  };

  // Parse highlighted cell
  const [highlightX, highlightY] = highlightedCell?.split(',').map(Number) || [-1, -1];

  return (
    <div className="chart-wrapper">
      <h3 className="chart-title">{data.title || 'Coordinate Grid'}</h3>
      <div className="coordinate-grid-container">
        {/* Y-axis label and numbers */}
        <div className="coordinate-grid-y-axis">
          <div className="coordinate-grid-axis-label coordinate-grid-axis-label--y">y</div>
          <div className="coordinate-grid-y-labels">
            {Array.from({ length: gridSize.rows }, (_, i) => gridSize.rows - 1 - i).map(y => (
              <div key={y} className="coordinate-grid-y-label">{y}</div>
            ))}
          </div>
        </div>

        {/* Main grid and X-axis */}
        <div className="coordinate-grid-main">
          <div
            className="coordinate-grid"
            style={{
              gridTemplateColumns: `repeat(${gridSize.cols}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize.rows}, 1fr)`,
            }}
          >
            {Array.from({ length: gridSize.rows }, (_, rowIndex) => {
              const y = gridSize.rows - 1 - rowIndex; // Flip so y=0 is at bottom
              return Array.from({ length: gridSize.cols }, (_, x) => {
                const value = grid[y]?.[x] ?? '';
                const isHighlighted = x === highlightX && y === highlightY;
                const hasValue = value !== '' && value !== null && value !== undefined;

                return (
                  <div
                    key={`${x}-${y}`}
                    className={`coordinate-grid-cell ${isHighlighted ? 'coordinate-grid-cell--highlighted' : ''} ${hasValue ? 'coordinate-grid-cell--has-value' : ''} ${disabled ? 'coordinate-grid-cell--disabled' : ''}`}
                    onClick={() => handleClick(x, y)}
                    title={`(${x}, ${y})`}
                  >
                    {hasValue && <span className="coordinate-grid-treasure">{value}</span>}
                  </div>
                );
              });
            })}
          </div>

          {/* X-axis labels and label */}
          <div className="coordinate-grid-x-axis">
            <div className="coordinate-grid-x-labels">
              {Array.from({ length: gridSize.cols }, (_, x) => (
                <div key={x} className="coordinate-grid-x-label">{x}</div>
              ))}
            </div>
            <div className="coordinate-grid-axis-label coordinate-grid-axis-label--x">x</div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default InteractiveCoordinateGrid;
