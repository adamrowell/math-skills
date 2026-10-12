import { memo, useCallback, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartData } from '../../data/charts/chartDataGenerator';

interface InteractivePieChartProps {
  data: ChartData;
  onSliceClick?: (name: string) => void;
  showValues?: boolean;
  disabled?: boolean;
  highlightedSlice?: string;
}

// Custom label renderer
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  value,
  showValues,
}: any) => {
  if (!showValues) return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 14, fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
    >
      {value}
    </text>
  );
};

export const InteractivePieChart = memo(function InteractivePieChart({
  data,
  onSliceClick,
  showValues = false,
  disabled = false,
  highlightedSlice,
}: InteractivePieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleClick = useCallback(
    (_: any, index: number) => {
      if (!disabled && onSliceClick) {
        onSliceClick(data.data[index].name);
      }
    },
    [disabled, onSliceClick, data.data]
  );

  const onMouseEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  const onMouseLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  return (
    <div className="chart-wrapper">
      <h3 className="chart-title">{data.title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data.data as any[]}
            cx="50%"
            cy="45%"
            labelLine={false}
            label={(props) => renderCustomLabel({ ...props, showValues })}
            outerRadius={90}
            innerRadius={0}
            dataKey="value"
            onClick={handleClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            cursor={disabled ? 'default' : 'pointer'}
          >
            {data.data.map((entry, index) => {
              const isHighlighted = entry.name === highlightedSlice;
              const isActive = index === activeIndex;

              return (
                <Cell
                  key={`cell-${index}`}
                  fill={isHighlighted ? '#FFD700' : entry.color}
                  stroke={isHighlighted ? '#FFA500' : '#fff'}
                  strokeWidth={isHighlighted || isActive ? 3 : 2}
                  style={{
                    filter: isHighlighted
                      ? 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.8))'
                      : isActive
                      ? 'drop-shadow(0 0 5px rgba(0, 0, 0, 0.3))'
                      : 'none',
                    transform: isActive && !disabled ? 'scale(1.05)' : 'scale(1)',
                    transformOrigin: 'center',
                    transition: 'all 0.2s ease',
                  }}
                />
              );
            })}
          </Pie>
          {/* No tooltip - kids should read the chart visually */}
          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: 12, fontSize: 14 }}
            formatter={(value: string) => (
              <span style={{ color: '#333', fontWeight: value === highlightedSlice ? 'bold' : 'normal' }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});

export default InteractivePieChart;
