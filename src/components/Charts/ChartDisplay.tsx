import { memo } from 'react';
import { ChartData } from '../../data/charts/chartDataGenerator';
import { InteractiveBarChart } from './InteractiveBarChart';
import { InteractiveHorizontalBarChart } from './InteractiveHorizontalBarChart';
import { InteractiveLineChart } from './InteractiveLineChart';
import { InteractivePieChart } from './InteractivePieChart';
import { InteractivePictograph } from './InteractivePictograph';
import { InteractiveMultiLineChart } from './InteractiveMultiLineChart';
import { InteractiveCoordinateGrid } from './InteractiveCoordinateGrid';
import './ChartStyles.css';

interface ChartDisplayProps {
  data: ChartData;
  onElementClick?: (name: string) => void;
  showValues?: boolean;
  disabled?: boolean;
  highlightedElement?: string;
}

export const ChartDisplay = memo(function ChartDisplay({
  data,
  onElementClick,
  showValues = false,
  disabled = false,
  highlightedElement,
}: ChartDisplayProps) {
  const renderChart = () => {
    switch (data.type) {
      case 'bar':
        return (
          <InteractiveBarChart
            data={data}
            onBarClick={onElementClick}
            showValues={showValues}
            disabled={disabled}
            highlightedBar={highlightedElement}
          />
        );
      case 'horizontalBar':
        return (
          <InteractiveHorizontalBarChart
            data={data}
            onBarClick={onElementClick}
            showValues={showValues}
            disabled={disabled}
            highlightedBar={highlightedElement}
          />
        );
      case 'line':
        return (
          <InteractiveLineChart
            data={data}
            onPointClick={onElementClick}
            showValues={showValues}
            disabled={disabled}
            highlightedPoint={highlightedElement}
          />
        );
      case 'pie':
        return (
          <InteractivePieChart
            data={data}
            onSliceClick={onElementClick}
            showValues={showValues}
            disabled={disabled}
            highlightedSlice={highlightedElement}
          />
        );
      case 'pictograph':
        return (
          <InteractivePictograph
            data={data}
            onRowClick={onElementClick}
            showValues={showValues}
            disabled={disabled}
            highlightedRow={highlightedElement}
          />
        );
      case 'multiLine':
        return (
          <InteractiveMultiLineChart
            data={data}
            onPointClick={onElementClick}
            showValues={showValues}
            disabled={disabled}
            highlightedLine={highlightedElement}
          />
        );
      case 'coordinateGrid':
        return (
          <InteractiveCoordinateGrid
            data={data}
            onCellClick={onElementClick}
            disabled={disabled}
            highlightedCell={highlightedElement}
          />
        );
      default:
        return (
          <InteractiveBarChart
            data={data}
            onBarClick={onElementClick}
            showValues={showValues}
            disabled={disabled}
            highlightedBar={highlightedElement}
          />
        );
    }
  };

  return <div className="chart-display">{renderChart()}</div>;
});

export default ChartDisplay;
