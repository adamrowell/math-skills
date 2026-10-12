import { LevelConfig } from '../../config/gameConfig';
import { LegacyLevelSelect } from '../LevelSelect';
import './StartScreen.css';

interface StartScreenProps {
  levels: LevelConfig[];
  currentLevel: LevelConfig;
  onSelectLevel: (levelId: number) => void;
  onStart: () => void;
}

export function StartScreen({
  levels,
  currentLevel,
  onSelectLevel,
  onStart,
}: StartScreenProps) {

  return (
    <div className="start-screen">
      <div className="start-screen__header">
        <h1 className="start-screen__title">
          <span className="start-screen__emoji">🔢</span>
          Math Skills
          <span className="start-screen__emoji">🧮</span>
        </h1>
        <p className="start-screen__subtitle">
          Speed math practice - answer quickly to win!
        </p>
      </div>

      <LegacyLevelSelect
        levels={levels}
        currentLevel={currentLevel}
        onSelectLevel={onSelectLevel}
        onStartGame={onStart}
      />
    </div>
  );
}
