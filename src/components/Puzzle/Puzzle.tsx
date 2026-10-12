import { useMemo } from 'react';
import './Puzzle.css';

interface PuzzleProps {
  completed: number;
  total: number;
  color: string;
}

// Fun shapes and patterns for the puzzle
const shapes = ['star', 'heart', 'diamond', 'circle', 'square', 'triangle'];

export function Puzzle({ completed, total, color }: PuzzleProps) {
  // Calculate grid dimensions
  const cols = Math.ceil(Math.sqrt(total * 1.5)); // Slightly wider than tall
  const rows = Math.ceil(total / cols);

  // Generate stable pattern of shapes
  const pattern = useMemo(() => {
    const result = [];
    for (let i = 0; i < total; i++) {
      result.push(shapes[i % shapes.length]);
    }
    return result;
  }, [total]);

  const percentage = Math.round((completed / total) * 100);

  return (
    <div className="puzzle">
      <div className="puzzle__progress-text">
        <span className="puzzle__count">{completed}</span>
        <span className="puzzle__divider">/</span>
        <span className="puzzle__total">{total}</span>
        <span className="puzzle__percent">({percentage}%)</span>
      </div>

      <div
        className="puzzle__grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`puzzle__piece puzzle__piece--${pattern[i]} ${i < completed ? 'puzzle__piece--filled' : ''}`}
            style={
              i < completed
                ? { '--piece-color': color } as React.CSSProperties
                : undefined
            }
          >
            <PuzzleShape shape={pattern[i]} filled={i < completed} />
          </div>
        ))}
      </div>

      <div className="puzzle__bar">
        <div
          className="puzzle__bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

interface PuzzleShapeProps {
  shape: string;
  filled: boolean;
}

function PuzzleShape({ shape, filled }: PuzzleShapeProps) {
  const className = `shape shape--${shape} ${filled ? 'shape--filled' : ''}`;

  switch (shape) {
    case 'star':
      return <span className={className}>&#9733;</span>;
    case 'heart':
      return <span className={className}>&#9829;</span>;
    case 'diamond':
      return <span className={className}>&#9830;</span>;
    case 'circle':
      return <span className={className}>&#9679;</span>;
    case 'square':
      return <span className={className}>&#9632;</span>;
    case 'triangle':
      return <span className={className}>&#9650;</span>;
    default:
      return <span className={className}>&#9679;</span>;
  }
}
