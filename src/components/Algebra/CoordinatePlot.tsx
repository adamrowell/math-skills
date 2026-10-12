import { memo, useMemo } from 'react';
import './Algebra.css';

interface CoordinatePlotProps {
  slope: number;
  yIntercept: number;
  width?: number;
  height?: number;
  gridSize?: number;
  showEquation?: boolean;
  highlightX?: number;
  highlightY?: number;
  animate?: boolean;
  compareLine?: { slope: number; yIntercept: number };
  xRange?: { min: number; max: number }; // Default centered around 0
  yRange?: { min: number; max: number }; // Default centered around 0
  highlightXIntercept?: boolean;
  highlightYIntercept?: boolean;
}

export const CoordinatePlot = memo(function CoordinatePlot({
  slope,
  yIntercept,
  width = 350,
  height = 350,
  gridSize = 10,
  showEquation = true,
  highlightX,
  highlightY,
  animate = true,
  compareLine,
  xRange,
  yRange,
  highlightXIntercept = false,
  highlightYIntercept = true,
}: CoordinatePlotProps) {
  const padding = 40;
  const plotWidth = width - padding * 2;

  // Use symmetric ranges by default (centered on origin)
  const halfGrid = Math.floor(gridSize / 2);
  const xMin = xRange?.min ?? -halfGrid;
  const xMax = xRange?.max ?? halfGrid;
  const yMin = yRange?.min ?? -halfGrid;
  const yMax = yRange?.max ?? halfGrid;

  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  const step = plotWidth / xSpan;
  const yStep = plotWidth / ySpan;

  // Convert math coordinates to screen coordinates
  const toScreenX = (x: number) => padding + (x - xMin) * step;
  const toScreenY = (y: number) => height - padding - (y - yMin) * yStep;

  // Calculate line points across the visible range
  const linePoints = useMemo(() => {
    const points: { x: number; y: number; screenX: number; screenY: number }[] = [];

    // Sample more points for smoother line
    for (let i = 0; i <= xSpan * 2; i++) {
      const x = xMin + i * 0.5;
      const y = slope * x + yIntercept;
      if (y >= yMin && y <= yMax && x >= xMin && x <= xMax) {
        points.push({ x, y, screenX: toScreenX(x), screenY: toScreenY(y) });
      }
    }

    return points;
  }, [slope, yIntercept, xMin, xMax, yMin, yMax, xSpan, toScreenX, toScreenY]);

  // Compare line points (if any)
  const comparePoints = useMemo(() => {
    if (!compareLine) return [];
    const points: { screenX: number; screenY: number }[] = [];

    for (let i = 0; i <= xSpan * 2; i++) {
      const x = xMin + i * 0.5;
      const y = compareLine.slope * x + compareLine.yIntercept;
      if (y >= yMin && y <= yMax && x >= xMin && x <= xMax) {
        points.push({ screenX: toScreenX(x), screenY: toScreenY(y) });
      }
    }

    return points;
  }, [compareLine, xMin, xMax, yMin, yMax, xSpan, toScreenX, toScreenY]);

  // Calculate x-intercept (where y = 0)
  const xIntercept = useMemo(() => {
    if (slope === 0) return null; // Horizontal line, no x-intercept unless yIntercept is 0
    const x = -yIntercept / slope;
    if (x >= xMin && x <= xMax && yMin <= 0 && yMax >= 0) {
      return { x, screenX: toScreenX(x), screenY: toScreenY(0) };
    }
    return null;
  }, [slope, yIntercept, xMin, xMax, yMin, yMax, toScreenX, toScreenY]);

  // Calculate y-intercept position
  const yInterceptPos = useMemo(() => {
    if (yIntercept >= yMin && yIntercept <= yMax && xMin <= 0 && xMax >= 0) {
      return { y: yIntercept, screenX: toScreenX(0), screenY: toScreenY(yIntercept) };
    }
    return null;
  }, [yIntercept, xMin, xMax, yMin, yMax, toScreenX, toScreenY]);

  // Format equation string
  const equationStr = useMemo(() => {
    if (slope === 0) return `y = ${yIntercept}`;
    if (slope === 1) {
      return yIntercept === 0 ? 'y = x' : yIntercept > 0 ? `y = x + ${yIntercept}` : `y = x - ${Math.abs(yIntercept)}`;
    }
    if (slope === -1) {
      return yIntercept === 0 ? 'y = -x' : yIntercept > 0 ? `y = -x + ${yIntercept}` : `y = -x - ${Math.abs(yIntercept)}`;
    }
    if (yIntercept === 0) return `y = ${slope}x`;
    if (yIntercept > 0) return `y = ${slope}x + ${yIntercept}`;
    return `y = ${slope}x - ${Math.abs(yIntercept)}`;
  }, [slope, yIntercept]);

  // Create line path
  const linePath = useMemo(() => {
    if (linePoints.length < 2) return '';
    return linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.screenX} ${p.screenY}`).join(' ');
  }, [linePoints]);

  const compareLinePath = useMemo(() => {
    if (comparePoints.length < 2) return '';
    return comparePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.screenX} ${p.screenY}`).join(' ');
  }, [comparePoints]);

  // Highlighted point
  const highlightedPoint = useMemo(() => {
    if (highlightX !== undefined) {
      const y = slope * highlightX + yIntercept;
      if (y >= yMin && y <= yMax && highlightX >= xMin && highlightX <= xMax) {
        return {
          x: highlightX,
          y,
          screenX: toScreenX(highlightX),
          screenY: toScreenY(y),
        };
      }
    }
    if (highlightY !== undefined) {
      const x = slope !== 0 ? (highlightY - yIntercept) / slope : null;
      if (x !== null && x >= xMin && x <= xMax && highlightY >= yMin && highlightY <= yMax) {
        return {
          x,
          y: highlightY,
          screenX: toScreenX(x),
          screenY: toScreenY(highlightY),
        };
      }
    }
    return null;
  }, [highlightX, highlightY, slope, yIntercept, xMin, xMax, yMin, yMax, toScreenX, toScreenY]);

  // Generate tick values for x and y axes
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let x = xMin; x <= xMax; x++) {
      ticks.push(x);
    }
    return ticks;
  }, [xMin, xMax]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let y = yMin; y <= yMax; y++) {
      ticks.push(y);
    }
    return ticks;
  }, [yMin, yMax]);

  // Calculate screen position of origin (0, 0)
  const originX = toScreenX(0);
  const originY = toScreenY(0);
  const showOriginX = xMin <= 0 && xMax >= 0;
  const showOriginY = yMin <= 0 && yMax >= 0;

  return (
    <div className="coordinate-plot">
      <svg
        className="coordinate-plot__svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Grid lines */}
        {xTicks.map((x) => (
          <line
            key={`vgrid-${x}`}
            className={`coordinate-plot__grid-line ${x === 0 ? 'coordinate-plot__grid-line--axis' : ''}`}
            x1={toScreenX(x)}
            y1={padding}
            x2={toScreenX(x)}
            y2={height - padding}
          />
        ))}
        {yTicks.map((y) => (
          <line
            key={`hgrid-${y}`}
            className={`coordinate-plot__grid-line ${y === 0 ? 'coordinate-plot__grid-line--axis' : ''}`}
            x1={padding}
            y1={toScreenY(y)}
            x2={width - padding}
            y2={toScreenY(y)}
          />
        ))}

        {/* Axes with arrows at center */}
        {/* X-axis (at y=0 if visible, otherwise at bottom) */}
        <line
          className="coordinate-plot__axis"
          x1={padding}
          y1={showOriginY ? originY : height - padding}
          x2={width - padding + 10}
          y2={showOriginY ? originY : height - padding}
          markerEnd="url(#arrowhead)"
        />
        {/* Y-axis (at x=0 if visible, otherwise at left) */}
        <line
          className="coordinate-plot__axis"
          x1={showOriginX ? originX : padding}
          y1={height - padding}
          x2={showOriginX ? originX : padding}
          y2={padding - 10}
          markerEnd="url(#arrowhead)"
        />

        {/* Arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
          </marker>
        </defs>

        {/* Axis labels */}
        <text
          className="coordinate-plot__axis-label"
          x={width - padding + 15}
          y={(showOriginY ? originY : height - padding) + 5}
        >
          x
        </text>
        <text
          className="coordinate-plot__axis-label"
          x={(showOriginX ? originX : padding) - 5}
          y={padding - 15}
        >
          y
        </text>

        {/* Tick labels */}
        {xTicks.map((x) => (
          <text
            key={`xtick-${x}`}
            className="coordinate-plot__tick-label"
            x={toScreenX(x)}
            y={(showOriginY ? originY : height - padding) + 18}
            textAnchor="middle"
          >
            {x}
          </text>
        ))}
        {yTicks.map((y) => y !== 0 && (
          <text
            key={`ytick-${y}`}
            className="coordinate-plot__tick-label"
            x={(showOriginX ? originX : padding) - 8}
            y={toScreenY(y) + 4}
            textAnchor="end"
          >
            {y}
          </text>
        ))}

        {/* Compare line (if any) */}
        {compareLinePath && (
          <path
            className="coordinate-plot__line"
            d={compareLinePath}
            stroke="#ff9800"
            strokeDasharray="8 4"
          />
        )}

        {/* Main line */}
        {linePath && (
          <path
            className={`coordinate-plot__line ${animate ? 'coordinate-plot__line--animated' : ''}`}
            d={linePath}
          />
        )}

        {/* Points on line (only at integer x values) */}
        {linePoints.filter(p => Number.isInteger(p.x)).map((point, i) => (
          <circle
            key={`point-${i}`}
            className={`coordinate-plot__point ${highlightedPoint && point.x === highlightedPoint.x && point.y === highlightedPoint.y ? 'coordinate-plot__point--highlighted' : ''}`}
            cx={point.screenX}
            cy={point.screenY}
            r={6}
          />
        ))}

        {/* Y-intercept highlight */}
        {highlightYIntercept && yInterceptPos && (
          <circle
            cx={yInterceptPos.screenX}
            cy={yInterceptPos.screenY}
            r={8}
            fill="#4CAF50"
            stroke="white"
            strokeWidth={3}
          />
        )}

        {/* X-intercept highlight */}
        {highlightXIntercept && xIntercept && (
          <circle
            cx={xIntercept.screenX}
            cy={xIntercept.screenY}
            r={8}
            fill="#FF5722"
            stroke="white"
            strokeWidth={3}
          />
        )}

        {/* Highlighted point (if different from line points) */}
        {highlightedPoint && !linePoints.some(p => p.x === highlightedPoint.x && p.y === highlightedPoint.y) && (
          <circle
            className="coordinate-plot__point--highlighted"
            cx={highlightedPoint.screenX}
            cy={highlightedPoint.screenY}
            r={8}
          />
        )}
      </svg>

      {showEquation && (
        <div className="coordinate-plot__equation">{equationStr}</div>
      )}
    </div>
  );
});

export default CoordinatePlot;
