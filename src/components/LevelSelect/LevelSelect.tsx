import { GameMode, LevelCompletion } from '../../types/game';
import { getLevelCompletion } from '../../utils/progressStorage';
import './LevelSelect.css';

// Generic level interface that any game mode can use
export interface GenericLevel {
  id: number;
  name: string;
  description: string;
  emoji: string;
  color: string;
  // Optional meta items for display
  metaItems?: { label: string; value: string | number }[];
}

interface LevelSelectProps<T extends GenericLevel> {
  levels: T[];
  currentLevelId?: number;
  title?: string;
  gameMode?: GameMode; // For progress tracking
  onSelectLevel: (level: T) => void;
  showProgress?: boolean;
}

export function LevelSelect<T extends GenericLevel>({
  levels,
  currentLevelId,
  title = 'Choose Your Level',
  gameMode,
  onSelectLevel,
  showProgress = true,
}: LevelSelectProps<T>) {
  // Get completion data for each level if gameMode is provided
  const getCompletionData = (levelId: number): LevelCompletion | null => {
    if (!gameMode || !showProgress) return null;
    return getLevelCompletion(gameMode, levelId);
  };

  return (
    <div className="level-select">
      <h2 className="level-select__title">{title}</h2>
      <div className="level-select__grid">
        {levels.map((level) => {
          const completion = getCompletionData(level.id);
          const isCompleted = completion?.completed;
          const isSelected = level.id === currentLevelId;
          const hasAttempts = completion && completion.attempts > 0;

          return (
            <button
              key={level.id}
              className={`level-card level-card--clickable ${isSelected ? 'level-card--selected' : ''} ${isCompleted ? 'level-card--completed' : ''}`}
              onClick={() => onSelectLevel(level)}
              style={{ '--level-color': level.color } as React.CSSProperties}
            >
              {/* Completion badge */}
              {isCompleted && (
                <div className="level-card__badge" title="Completed!">
                  <span className="level-card__badge-icon">✓</span>
                </div>
              )}

              {/* Star badge for high accuracy */}
              {completion && completion.bestAccuracy >= 90 && (
                <div className="level-card__star" title={`Best: ${completion.bestAccuracy}%`}>
                  ⭐
                </div>
              )}

              <span className="level-card__emoji">{level.emoji}</span>
              <span className="level-card__name">{level.name}</span>
              <span className="level-card__description">{level.description}</span>

              {/* Meta items - use provided ones or default */}
              {level.metaItems && level.metaItems.length > 0 && (
                <div className="level-card__meta">
                  {level.metaItems.map((item, idx) => (
                    <span key={idx} className="level-card__meta-item">
                      {item.value} {item.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Progress stats if available */}
              {hasAttempts && showProgress && (
                <div className="level-card__progress">
                  <span className="level-card__progress-item" title="Attempts">
                    {completion.attempts}x
                  </span>
                  {completion.wins > 0 && (
                    <span className="level-card__progress-item" title="Best Accuracy">
                      {completion.bestAccuracy}%
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Legacy support - keep the old interface working
// This can be removed once all apps are migrated
import { LevelConfig } from '../../config/gameConfig';

interface LegacyLevelSelectProps {
  levels: LevelConfig[];
  currentLevel: LevelConfig;
  onSelectLevel: (levelId: number) => void;
  onStartGame?: (levelId: number) => void;
}

export function LegacyLevelSelect({
  levels,
  currentLevel,
  onSelectLevel,
  onStartGame,
}: LegacyLevelSelectProps) {
  // Convert to generic format
  const genericLevels: GenericLevel[] = levels.map(l => ({
    id: l.id,
    name: l.name,
    description: l.description,
    emoji: l.emoji,
    color: l.color,
    metaItems: [
      { label: '/min', value: l.targetCorrectPerMinute },
      { label: 'to win', value: l.puzzlePieces },
    ],
  }));

  const handleSelect = (level: GenericLevel) => {
    if (onStartGame) {
      onStartGame(level.id);
    } else {
      onSelectLevel(level.id);
    }
  };

  return (
    <LevelSelect
      levels={genericLevels}
      currentLevelId={currentLevel.id}
      gameMode="math"
      onSelectLevel={handleSelect}
    />
  );
}

export default LevelSelect;
