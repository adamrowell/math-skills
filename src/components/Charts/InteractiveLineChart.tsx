import { memo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { ChartData } from '../../data/charts/chartDataGenerator';

interface InteractiveLineChartProps {
  data: ChartData;
  onPointClick?: (name: string) => void;
  showValues?: boolean;
  disabled?: boolean;
  highlightedPoint?: string;
}

// Custom dot component for interactivity - larger clickable area
const CustomDot = (props: any) => {
  const { cx, cy, payload, highlightedPoint, disabled, onPointClick } = props;
  const isHighlighted = payload?.name === highlightedPoint;

  if (!payload) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onPointClick && payload.name) {
      onPointClick(payload.name);
    }
  };

  return (
    <g onClick={handleClick} style={{ cursor: disabled ? 'default' : 'pointer' }}>
      {/* Invisible larger hit area for easier clicking */}
      <circle
        cx={cx}
        cy={cy}
        r={24}
        fill="transparent"
        style={{ cursor: disabled ? 'default' : 'pointer' }}
      />
      {/* Visible dot */}
      <circle
        cx={cx}
        cy={cy}
        r={isHighlighted ? 14 : 10}
        fill={isHighlighted ? '#FFD700' : payload.color || '#667eea'}
        stroke={isHighlighted ? '#FFA500' : '#fff'}
        strokeWidth={isHighlighted ? 4 : 3}
        style={{
          filter: isHighlighted ? 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.8))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          transition: 'all 0.2s ease',
        }}
      />
    </g>
  );
};

export const InteractiveLineChart = memo(function InteractiveLineChart({
  data,
  onPointClick,
  showValues = false,
  disabled = false,
  highlightedPoint,
}: InteractiveLineChartProps) {
  return (
    <div className="chart-wrapper chart-wrapper--line">
      <h3 className="chart-title">{data.title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data.data}
          margin={{ top: 15, right: 15, left: 10, bottom: 45 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 13, fill: '#333' }}
            tickLine={{ stroke: '#ccc' }}
            angle={-25}
            textAnchor="end"
            height={50}
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
          <Line
            type="monotone"
            dataKey="value"
            stroke="#667eea"
            strokeWidth={4}
            dot={(props) => (
              <CustomDot
                {...props}
                highlightedPoint={highlightedPoint}
                disabled={disabled}
                onPointClick={onPointClick}
              />
            )}
            activeDot={false}
            label={
              showValues
                ? {
                    position: 'top',
                    fill: '#333',
                    fontSize: 14,
                    fontWeight: 'bold',
                    offset: 15,
                  }
                : false
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default InteractiveLineChart;
