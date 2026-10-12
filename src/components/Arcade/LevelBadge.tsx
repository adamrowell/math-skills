import './LevelBadge.css';

interface LevelBadgeProps {
  level: number;
  name?: string;
  size?: 'small' | 'medium' | 'large';
}

export function LevelBadge({ level, name, size = 'medium' }: LevelBadgeProps) {
  // Color based on level
  const getColor = () => {
    if (level <= 3) return 'green';
    if (level <= 6) return 'blue';
    if (level <= 10) return 'purple';
    return 'gold';
  };

  return (
    <div className={`level-badge level-badge--${size} level-badge--${getColor()}`}>
      <span className="level-badge__label">LV</span>
      <span className="level-badge__number">{level}</span>
      {name && <span className="level-badge__name">{name}</span>}
    </div>
  );
}
