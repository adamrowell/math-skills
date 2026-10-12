import { memo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartData, ChartSeries } from '../../data/charts/chartDataGenerator';
import { teamNames } from '../../config/chartGameConfig';

interface InteractiveMultiLineChartProps {
  data: ChartData;
  onPointClick?: (name: string) => void;
  showValues?: boolean;
  disabled?: boolean;
  highlightedLine?: string;
}

export const InteractiveMultiLineChart = memo(function InteractiveMultiLineChart({
  data,
  onPointClick,
  showValues: _showValues = false,
  disabled = false,
  highlightedLine,
}: InteractiveMultiLineChartProps) {
  void _showValues; // Available for future use

  const series = data.series || [];
  const xLabels = data.data.map(d => d.name);

  // Build chart data: [{name: 'Monday', series0: 5, series1: 3}, ...]
  const chartData = xLabels.map((label, i) => {
    const point: Record<string, string | number> = { name: label };
    series.forEach((s: ChartSeries, seriesIndex: number) => {
      point[`series${seriesIndex}`] = s.data[i] ?? 0;
    });
    return point;
  });

  const handleClick = (_entry: unknown, seriesName: string) => {
    if (!disabled && onPointClick) {
      onPointClick(seriesName);
    }
  };

  return (
    <div className="chart-wrapper">
      <h3 className="chart-title">{data.title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#333' }}
            tickLine={{ stroke: '#ccc' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#333' }}
            tickLine={{ stroke: '#ccc' }}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '2px solid #667eea',
              borderRadius: '8px',
              fontSize: '14px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            formatter={(value) => {
              const index = parseInt(value.replace('series', ''));
              const seriesInfo = series[index];
              return seriesInfo?.name || teamNames[index]?.name || `Line ${index + 1}`;
            }}
          />
          {series.map((s: ChartSeries, index: number) => {
            const seriesColor = s.color || teamNames[index]?.color || '#667eea';
            const isHighlighted = s.name === highlightedLine;
            return (
              <Line
                key={index}
                type="monotone"
                dataKey={`series${index}`}
                stroke={isHighlighted ? '#FFD700' : seriesColor}
                strokeWidth={isHighlighted ? 4 : 3}
                dot={{ r: 6, fill: seriesColor, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{
                  r: 10,
                  onClick: (e: any) => handleClick(e, s.name),
                  cursor: disabled ? 'default' : 'pointer',
                }}
                name={`series${index}`}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default InteractiveMultiLineChart;
