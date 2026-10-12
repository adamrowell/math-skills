import { memo, useCallback } from 'react';
import { ChartData } from '../../data/charts/chartDataGenerator';
import './ChartStyles.css';

interface InteractivePictographProps {
  data: ChartData;
  onRowClick?: (name: string) => void;
  showValues?: boolean;
  disabled?: boolean;
  highlightedRow?: string;
}

export const InteractivePictograph = memo(function InteractivePictograph({
  data,
  onRowClick,
  showValues = false,
  disabled = false,
  highlightedRow,
}: InteractivePictographProps) {
  const handleClick = useCallback(
    (name: string) => {
      if (!disabled && onRowClick) {
        onRowClick(name);
      }
    },
    [disabled, onRowClick]
  );

  // Determine symbol scale (each symbol represents X items)
  // Use nice round numbers: 1, 2, 5, 10, 20, 50, etc.
  const maxValue = Math.max(...data.data.map(d => d.value));
  const getRoundSymbolValue = (max: number): number => {
    if (max <= 5) return 1;
    if (max <= 10) return 2;
    if (max <= 25) return 5;
    if (max <= 50) return 10;
    if (max <= 100) return 20;
    return 50;
  };
  const symbolValue = getRoundSymbolValue(maxValue);
  const symbol = data.symbol || '⭐';

  return (
    <div className="chart-wrapper pictograph-wrapper">
      <h3 className="chart-title">{data.title}</h3>
      <div className="pictograph-key">
        <span className="pictograph-key-symbol">{symbol}</span>
        <span className="pictograph-key-text">= {symbolValue} {data.unit}</span>
      </div>
      <div className="pictograph-container">
        {data.data.map((item) => {
          const symbolCount = Math.round(item.value / symbolValue);
          const isHighlighted = item.name === highlightedRow;

          return (
            <div
              key={item.name}
              className={`pictograph-row ${isHighlighted ? 'pictograph-row--highlighted' : ''} ${
                disabled ? 'pictograph-row--disabled' : ''
              }`}
              onClick={() => handleClick(item.name)}
            >
              <div className="pictograph-label" style={{ color: item.color }}>
                {item.name}
              </div>
              <div className="pictograph-symbols">
                {Array.from({ length: symbolCount }, (_, i) => (
                  <span key={i} className="pictograph-symbol">
                    {symbol}
                  </span>
                ))}
                {showValues && (
                  <span className="pictograph-value">({item.value})</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default InteractivePictograph;
