import { memo } from 'react';

export interface TableCellProps {
  row: number;
  col: number;
  value: number;
  isHovered: boolean;
  isInArea: boolean;
  isFactorRow: boolean;
  isFactorCol: boolean;
  isHidden: boolean;
  isAnswer: boolean;
  isSquare: boolean;
  isHeader?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

export const TableCell = memo(function TableCell({
  row,
  col,
  value,
  isHovered,
  isInArea,
  isFactorRow,
  isFactorCol,
  isHidden,
  isAnswer,
  isSquare,
  isHeader = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: TableCellProps) {
  const classNames = [
    'table-cell',
    isHeader && 'table-cell--header',
    isHovered && 'table-cell--hovered',
    isInArea && !isHovered && 'table-cell--in-area',
    isFactorRow && 'table-cell--factor-row',
    isFactorCol && 'table-cell--factor-col',
    isHidden && 'table-cell--hidden',
    isAnswer && 'table-cell--answer',
    isSquare && !isHeader && 'table-cell--square',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      role="gridcell"
      aria-label={
        isHeader
          ? `${value}`
          : isHidden
          ? `${row} times ${col} equals hidden`
          : `${row} times ${col} equals ${value}`
      }
      data-row={row}
      data-col={col}
    >
      {isHidden ? '?' : value}
    </div>
  );
});

export default TableCell;
