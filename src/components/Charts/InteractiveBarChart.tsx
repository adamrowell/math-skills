import { memo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { ChartData } from '../../data/charts/chartDataGenerator';

interface InteractiveBarChartProps {
  data: ChartData;
  onBarClick?: (name: string) => void;
  showValues?: boolean;
  disabled?: boolean;
  highlightedBar?: string;
}

export const InteractiveBarChart = memo(function InteractiveBarChart({
  data,
  onBarClick,
  showValues = false,
  disabled = false,
  highlightedBar,
}: InteractiveBarChartProps) {
  const handleClick = useCallback(
    (entry: any) => {
      if (!disabled && onBarClick) {
        onBarClick(entry.name);
      }
    },
    [disabled, onBarClick]
  );

  return (
    <div className="chart-wrapper">
      <h3 className="chart-title">{data.title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data.data}
          margin={{ top: 20, right: 15, left: 10, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 13, fill: '#333' }}
            tickLine={{ stroke: '#ccc' }}
            angle={-35}
            textAnchor="end"
            height={70}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 13, fill: '#333' }}
            tickLine={{ stroke: '#ccc' }}
            width={40}
            label={{
              value: data.unit,
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fill: '#666' },
            }}
          />
          {/* No tooltip - kids should read the chart visually */}
          <Bar
            dataKey="value"
            radius={[8, 8, 0, 0]}
            cursor={disabled ? 'default' : 'pointer'}
            onClick={handleClick}
          >
            {data.data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={highlightedBar === entry.name ? '#FFD700' : entry.color}
                stroke={highlightedBar === entry.name ? '#FFA500' : 'transparent'}
                strokeWidth={highlightedBar === entry.name ? 3 : 0}
                style={{
                  filter: highlightedBar === entry.name
                    ? 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))'
                    : 'none',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
            {showValues && (
              <LabelList
                dataKey="value"
                position="top"
                style={{ fontSize: 15, fontWeight: 'bold', fill: '#333' }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export default InteractiveBarChart;
