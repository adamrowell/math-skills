import './CandylandPath.css';

interface CandylandPathProps {
  completed: number;
  total: number;
}

// Vibrant candy colors for path tiles
const pathColors = [
  '#FF6B6B', // Red
  '#FF9F43', // Orange
  '#FECA57', // Yellow
  '#48DBFB', // Light Blue
  '#A55EEA', // Purple
  '#FF6B9D', // Pink
  '#26DE81', // Green
  '#45AAF2', // Blue
];

// Prize milestones with icons and labels
const prizes = [
  { icon: '🍭', label: 'Lollipop!' },
  { icon: '🌟', label: 'Star!' },
  { icon: '🍬', label: 'Candy!' },
  { icon: '🎈', label: 'Balloon!' },
  { icon: '🍪', label: 'Cookie!' },
  { icon: '🌈', label: 'Rainbow!' },
  { icon: '🎁', label: 'Gift!' },
  { icon: '🏆', label: 'Trophy!' },
];

export function CandylandPath({ completed, total }: CandylandPathProps) {
  // Support extended progress beyond goal
  const percentage = Math.min(Math.round((completed / total) * 100), 100);
  const isWinner = completed >= total;
  const bonusCount = Math.max(0, completed - total);

  // Create path with 5 rows in S-curve pattern
  const tilesPerRow = 6;
  const rows = 5;
  const totalTiles = tilesPerRow * rows;
  const tilesPerPiece = total / totalTiles;
  const completedTiles = Math.min(Math.floor(completed / tilesPerPiece), totalTiles);

  // Generate tile positions for S-curve
  const getTilePosition = (index: number) => {
    const row = Math.floor(index / tilesPerRow);
    const colInRow = index % tilesPerRow;
    // Alternate direction each row for S-curve
    const col = row % 2 === 0 ? colInRow : (tilesPerRow - 1 - colInRow);
    return { row, col };
  };

  // Prize positions (every ~6 tiles, at key milestones)
  const prizePositions = [5, 11, 17, 23, 29]; // At ends of rows and goal

  return (
    <div className="candyland-path">
      {/* Header with progress */}
      <div className="candyland-path__header">
        <div className="candyland-path__score">
          <span className="candyland-path__count">{completed}</span>
          <span className="candyland-path__divider">/</span>
          <span className="candyland-path__total">{total}</span>
        </div>
        {isWinner && (
          <div className="candyland-path__winner-badge">
            <span className="candyland-path__winner-icon">🏆</span>
            <span className="candyland-path__winner-text">WINNER!</span>
            {bonusCount > 0 && (
              <span className="candyland-path__bonus">+{bonusCount} bonus!</span>
            )}
          </div>
        )}
      </div>

      {/* The winding path board */}
      <div className="candyland-path__board">
        {/* Start area */}
        <div className="candyland-path__start-zone">
          <span className="candyland-path__start-icon">🏁</span>
          <span className="candyland-path__start-label">START</span>
        </div>

        {/* Path grid */}
        <div className="candyland-path__grid">
          {Array.from({ length: totalTiles }, (_, i) => {
            const { row, col } = getTilePosition(i);
            const isFilled = i < completedTiles;
            const isNext = i === completedTiles;
            const isCurrentPosition = i === completedTiles - 1 || (completedTiles === 0 && i === 0);
            const colorIndex = i % pathColors.length;
            const hasPrize = prizePositions.includes(i);
            const prizeIndex = prizePositions.indexOf(i);
            const isPrizeCollected = isFilled && hasPrize;
            const isGoal = i === totalTiles - 1;

            return (
              <div
                key={i}
                className={`
                  candyland-path__tile
                  ${isFilled ? 'candyland-path__tile--filled' : ''}
                  ${isNext ? 'candyland-path__tile--next' : ''}
                  ${isGoal ? 'candyland-path__tile--goal' : ''}
                `}
                style={{
                  '--tile-color': pathColors[colorIndex],
                  '--tile-row': row,
                  '--tile-col': col,
                  gridRow: row + 1,
                  gridColumn: col + 1,
                } as React.CSSProperties}
              >
                {/* Prize on tile */}
                {hasPrize && !isGoal && (
                  <div className={`candyland-path__prize ${isPrizeCollected ? 'candyland-path__prize--collected' : ''}`}>
                    <span className="candyland-path__prize-icon">{prizes[prizeIndex % prizes.length].icon}</span>
                  </div>
                )}

                {/* Goal marker */}
                {isGoal && (
                  <div className={`candyland-path__goal ${isFilled ? 'candyland-path__goal--reached' : ''}`}>
                    <span className="candyland-path__goal-icon">🏆</span>
                  </div>
                )}

                {/* Player position */}
                {isCurrentPosition && completedTiles > 0 && (
                  <div className="candyland-path__player">
                    <span className="candyland-path__player-icon">🚀</span>
                  </div>
                )}

                {/* Tile number (subtle) */}
                <span className="candyland-path__tile-num">{i + 1}</span>
              </div>
            );
          })}
        </div>

        {/* Finish area */}
        <div className={`candyland-path__finish-zone ${isWinner ? 'candyland-path__finish-zone--reached' : ''}`}>
          <span className="candyland-path__finish-icon">🎉</span>
          <span className="candyland-path__finish-label">FINISH</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="candyland-path__progress">
        <div
          className="candyland-path__progress-fill"
          style={{
            width: `${percentage}%`,
            background: isWinner
              ? 'linear-gradient(90deg, #FFD700, #FFA500, #FFD700)'
              : `linear-gradient(90deg, ${pathColors.slice(0, 4).join(', ')})`
          }}
        />
        <span className="candyland-path__progress-text">{percentage}%</span>
      </div>
    </div>
  );
}
