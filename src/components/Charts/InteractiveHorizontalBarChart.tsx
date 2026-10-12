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

interface InteractiveHorizontalBarChartProps {
  data: ChartData;
  onBarClick?: (name: string) => void;
  showValues?: boolean;
  disabled?: boolean;
  highlightedBar?: string;
}

export const InteractiveHorizontalBarChart = memo(function InteractiveHorizontalBarChart({
  data,
  onBarClick,
  showValues = false,
  disabled = false,
  highlightedBar,
}: InteractiveHorizontalBarChartProps) {
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
      <ResponsiveContainer width="100%" height={Math.min(220, Math.max(180, data.data.length * 36))}>
        <BarChart
          data={data.data}
          layout="vertical"
          margin={{ top: 20, right: 50, left: 100, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            type="number"
            tick={{ fontSize: 14, fill: '#333' }}
            tickLine={{ stroke: '#ccc' }}
            label={{
              value: data.unit,
              position: 'insideBottom',
              offset: -10,
              style: { fontSize: 14, fill: '#666' },
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 14, fill: '#333' }}
            tickLine={{ stroke: '#ccc' }}
            width={90}
          />
          {/* No tooltip - kids should read the chart visually */}
          <Bar
            dataKey="value"
            radius={[0, 8, 8, 0]}
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
                position="right"
                style={{ fontSize: 14, fontWeight: 'bold', fill: '#333' }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export default InteractiveHorizontalBarChart;
