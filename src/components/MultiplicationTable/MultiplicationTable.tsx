import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { TableCell } from './TableCell';
import { tableConfig, PatternType, TableQuestion } from '../../config/tableGameConfig';
import './MultiplicationTable.css';

export interface MultiplicationTableProps {
  hiddenCells?: Set<string>;
  highlightPattern?: PatternType;
  highlightNumber?: number;
  currentQuestion?: TableQuestion | null;
  onCellClick?: (row: number, col: number) => void;
}

export function MultiplicationTable({
  hiddenCells = new Set(),
  highlightPattern = null,
  highlightNumber = 1,
  currentQuestion = null,
  onCellClick,
}: MultiplicationTableProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const gridSize = tableConfig.gridSize;

  // Calculate scale based on container size
  useEffect(() => {
    const container = containerRef.current;
    const table = tableRef.current;
    if (!container || !table) return;

    const calculateScale = () => {
      // Get the natural size of the table (13 cells: 1 header + 12 data)
      const cellSize = 38; // Base cell size from CSS
      const tableSize = cellSize * (gridSize + 1) + 2; // +1 for header, +2 for borders

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate the scale needed to fit both dimensions
      const scaleX = containerWidth / tableSize;
      const scaleY = containerHeight / tableSize;

      // Use the smaller scale to ensure table fits in both dimensions
      // Cap at 1 to avoid scaling up
      const newScale = Math.min(scaleX, scaleY, 1);

      setScale(Math.max(newScale, 0.4)); // Minimum scale of 0.4
    };

    // Initial calculation
    calculateScale();

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculateScale);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [gridSize]);

  const handleCellHover = useCallback((row: number, col: number) => {
    setHoveredCell({ row, col });
  }, []);

  const handleCellLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      onCellClick?.(row, col);
    },
    [onCellClick]
  );

  // Check if a cell is part of a highlight pattern
  const isPatternHighlighted = useCallback(
    (row: number, col: number): boolean => {
      if (!highlightPattern) return false;

      if (highlightPattern === 'squares') {
        return row === col;
      }

      if (highlightPattern === 'multiples') {
        const product = row * col;
        return product % highlightNumber === 0;
      }

      return false;
    },
    [highlightPattern, highlightNumber]
  );

  // Generate the tooltip text
  const tooltipText = useMemo(() => {
    if (!hoveredCell) return '';
    const { row, col } = hoveredCell;
    return `${row} × ${col} = ${row * col}`;
  }, [hoveredCell]);

  // Render header row
  const renderHeaderRow = () => {
    const cells = [];

    // Empty corner cell
    cells.push(
      <div key="corner" className="table-cell table-cell--corner" role="columnheader">
        ×
      </div>
    );

    // Column headers
    for (let col = 1; col <= gridSize; col++) {
      const isFactorCol = hoveredCell?.col === col;
      const isQuestionCol = currentQuestion?.col === col;
      cells.push(
        <TableCell
          key={`header-${col}`}
          row={0}
          col={col}
          value={col}
          isHovered={false}
          isInArea={false}
          isFactorRow={false}
          isFactorCol={isFactorCol || isQuestionCol}
          isHidden={false}
          isAnswer={false}
          isSquare={false}
          isHeader={true}
        />
      );
    }

    return (
      <div className="table-row table-row--header" role="row">
        {cells}
      </div>
    );
  };

  // Render a data row
  const renderRow = (row: number) => {
    const cells = [];

    // Row header
    const isFactorRow = hoveredCell?.row === row;
    const isQuestionRow = currentQuestion?.row === row;
    cells.push(
      <TableCell
        key={`row-header-${row}`}
        row={row}
        col={0}
        value={row}
        isHovered={false}
        isInArea={false}
        isFactorRow={isFactorRow || isQuestionRow}
        isFactorCol={false}
        isHidden={false}
        isAnswer={false}
        isSquare={false}
        isHeader={true}
      />
    );

    // Data cells
    for (let col = 1; col <= gridSize; col++) {
      const value = row * col;
      const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
      const isInArea =
        hoveredCell !== null && row <= hoveredCell.row && col <= hoveredCell.col;
      const isFactorRowHighlight = hoveredCell?.row === row;
      const isFactorColHighlight = hoveredCell?.col === col;
      const cellKey = `${row}-${col}`;
      const isHidden = hiddenCells.has(cellKey);
      const isAnswer =
        currentQuestion?.row === row && currentQuestion?.col === col;
      const isSquare = row === col || isPatternHighlighted(row, col);

      cells.push(
        <TableCell
          key={cellKey}
          row={row}
          col={col}
          value={value}
          isHovered={isHovered}
          isInArea={isInArea}
          isFactorRow={isFactorRowHighlight}
          isFactorCol={isFactorColHighlight}
          isHidden={isHidden}
          isAnswer={isAnswer}
          isSquare={isSquare}
          onMouseEnter={() => handleCellHover(row, col)}
          onMouseLeave={handleCellLeave}
          onClick={() => handleCellClick(row, col)}
        />
      );
    }

    return (
      <div key={`row-${row}`} className="table-row" role="row">
        {cells}
      </div>
    );
  };

  return (
    <div className="multiplication-table-container" ref={containerRef}>
      <div
        className="multiplication-table"
        role="grid"
        aria-label="Multiplication table"
        ref={tableRef}
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
      >
        {renderHeaderRow()}
        {Array.from({ length: gridSize }, (_, i) => renderRow(i + 1))}
      </div>
      {hoveredCell && tableConfig.showTooltip && (
        <div
          className="table-tooltip"
          style={{
            '--tooltip-row': hoveredCell.row,
            '--tooltip-col': hoveredCell.col,
          } as React.CSSProperties}
        >
          {tooltipText}
        </div>
      )}
    </div>
  );
}

export default MultiplicationTable;
