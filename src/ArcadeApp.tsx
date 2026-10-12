import { useState, useCallback } from 'react';
import { GameMode } from './types/game';
import { ARCADE_GAMES, GAME_CATEGORIES, ArcadeGameId } from './config/arcadeConfig';
import { AppLayout, SelectionScreen } from './components/AppLayout';
import { audioManager } from './utils/audioManager';

// Import all arcade games
import { MathBlasterGame } from './games/MathBlaster/MathBlasterGame';
import { CardSharkGame } from './games/CardShark/CardSharkGame';
import { MathMuncherGame } from './games/MathMuncher/MathMuncherGame';
import { DiceDashGame } from './games/DiceDash/DiceDashGame';
import { ClockMasterGame } from './games/ClockMaster/ClockMasterGame';
import { BinaryBlitzGame } from './games/BinaryBlitz/BinaryBlitzGame';
import { ProbabilityPlaygroundGame } from './games/ProbabilityPlayground/ProbabilityPlaygroundGame';
import { NumberNinjaGame } from './games/NumberNinja/NumberNinjaGame';
import { SIUnitSafariGame } from './games/SIUnitSafari/SIUnitSafariGame';
import { WordPuzzlePalaceGame } from './games/WordPuzzlePalace/WordPuzzlePalaceGame';
import { EquationInvadersGame } from './games/EquationInvaders/EquationInvadersGame';
import { RandomRouletteGame } from './games/RandomRoulette/RandomRouletteGame';
import { SpeedMathSprintGame } from './games/SpeedMathSprint/SpeedMathSprintGame';
import { MathSnakeGame } from './games/MathSnake/MathSnakeGame';
import { BreakoutEquationsGame } from './games/BreakoutEquations/BreakoutEquationsGame';

import './ArcadeApp.css';

interface ArcadeAppProps {
  onSwitchMode: (mode: GameMode | null) => void;
}

export function ArcadeApp({ onSwitchMode }: ArcadeAppProps) {
  const [currentGame, setCurrentGame] = useState<ArcadeGameId | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(audioManager.isEnabled());

  const handleBack = useCallback(() => {
    if (currentGame) {
      setCurrentGame(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    } else {
      onSwitchMode(null);
    }
  }, [currentGame, selectedCategory, onSwitchMode]);

  const handleSelectGame = useCallback((gameId: ArcadeGameId) => {
    audioManager.playClick();
    setCurrentGame(gameId);
  }, []);

  const handleToggleSound = useCallback(() => {
    const newState = audioManager.toggle();
    setSoundEnabled(newState);
  }, []);

  // Render individual game
  if (currentGame) {
    const gameProps = {
      onBack: handleBack,
    };

    switch (currentGame) {
      case 'mathBlaster':
        return <MathBlasterGame {...gameProps} />;
      case 'diceDash':
        return <DiceDashGame {...gameProps} />;
      case 'clockMaster':
        return <ClockMasterGame {...gameProps} />;
      case 'cardShark':
        return <CardSharkGame {...gameProps} />;
      case 'binaryBlitz':
        return <BinaryBlitzGame {...gameProps} />;
      case 'probabilityPlayground':
        return <ProbabilityPlaygroundGame {...gameProps} />;
      case 'numberNinja':
        return <NumberNinjaGame {...gameProps} />;
      case 'siUnitSafari':
        return <SIUnitSafariGame {...gameProps} />;
      case 'wordPuzzlePalace':
        return <WordPuzzlePalaceGame {...gameProps} />;
      case 'equationInvaders':
        return <EquationInvadersGame {...gameProps} />;
      case 'randomRoulette':
        return <RandomRouletteGame {...gameProps} />;
      case 'speedMathSprint':
        return <SpeedMathSprintGame {...gameProps} />;
      case 'mathMuncher':
        return <MathMuncherGame {...gameProps} />;
      case 'mathSnake':
        return <MathSnakeGame {...gameProps} />;
      case 'breakoutEquations':
        return <BreakoutEquationsGame {...gameProps} />;
      default:
        return null;
    }
  }

  // Filter games by category if selected
  const displayedGames = selectedCategory
    ? ARCADE_GAMES.filter(game => game.category === selectedCategory)
    : ARCADE_GAMES;

  return (
    <AppLayout>
      <SelectionScreen
        title="Arcade"
        emoji="🎮"
        subtitle="Action-packed learning games!"
        onBack={handleBack}
      >
        <div className="arcade-app">
          {/* Sound toggle */}
          <button
            className={`arcade-app__sound-toggle ${soundEnabled ? '' : 'arcade-app__sound-toggle--muted'}`}
            onClick={handleToggleSound}
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          {/* Category filters */}
          <div className="arcade-app__categories">
            <button
              className={`arcade-app__category ${selectedCategory === null ? 'arcade-app__category--active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              <span className="arcade-app__category-emoji">🎮</span>
              <span className="arcade-app__category-name">All Games</span>
            </button>
            {GAME_CATEGORIES.map(category => (
              <button
                key={category.id}
                className={`arcade-app__category ${selectedCategory === category.id ? 'arcade-app__category--active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                <span className="arcade-app__category-emoji">{category.emoji}</span>
                <span className="arcade-app__category-name">{category.name}</span>
              </button>
            ))}
          </div>

          {/* Game grid */}
          <div className="arcade-app__games">
            {displayedGames.map(game => (
              <button
                key={game.id}
                className="arcade-app__game-card"
                onClick={() => handleSelectGame(game.id)}
                style={{ background: game.gradient }}
              >
                <div className="arcade-app__game-emoji">{game.emoji}</div>
                <div className="arcade-app__game-info">
                  <h3 className="arcade-app__game-name">{game.name}</h3>
                  <p className="arcade-app__game-description">{game.description}</p>
                  <div className="arcade-app__game-meta">
                    <span className="arcade-app__game-category">{game.category}</span>
                    <span className={`arcade-app__game-difficulty arcade-app__game-difficulty--${game.difficulty}`}>
                      {game.difficulty}
                    </span>
                  </div>
                </div>
                <div className="arcade-app__game-play">
                  PLAY →
                </div>
              </button>
            ))}
          </div>

          {/* Instructions */}
          <div className="arcade-app__instructions">
            <h4>How to Play</h4>
            <p>Choose a game, score points, and try to beat your high score!</p>
            <p>Each game has 3 lives. When you lose all lives, the game ends.</p>
            <p>Difficulty increases as you play - games get faster and math gets harder!</p>
          </div>
        </div>
      </SelectionScreen>
    </AppLayout>
  );
}

export default ArcadeApp;
