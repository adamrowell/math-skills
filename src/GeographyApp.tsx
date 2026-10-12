import { useEffect, useRef, useCallback, useState } from 'react';
import { useGeographyGameState, GeographyItem } from './hooks/useGeographyGameState';
import { useGeographyVoiceRecognition } from './hooks/useGeographyVoiceRecognition';
import { useProgressTracking } from './hooks/useProgressTracking';
import { useAppNavigation } from './hooks/useAppNavigation';
import { geographyConfig } from './config/geographyConfig';
import { addScore as addGeographyScore, getHighScores, GeographyScore } from './utils/geographyStorage';
import { WinScreen } from './components/WinScreen';
import { Stats } from './components/Stats';
import { CandylandPath } from './components/CandylandPath';
import { FeedbackMessage } from './components/FeedbackMessage';
import { LevelSelect, GenericLevel } from './components/LevelSelect';
import { AppLayout, SelectionScreen, PlayingLayout, PauseOverlay } from './components/AppLayout';
import { USStateData } from './data/geography/usStates';
import { CountryData, getFlagUrl } from './data/geography/countries';
import { BodyOfWaterData } from './data/geography/bodiesOfWater';
import { LandmarkData } from './data/geography/landmarks';
import { USMap } from './components/Geography/USMap';
import { WorldMap } from './components/Geography/WorldMap';
import './App.css';
import './GeographyApp.css';

interface GeographyAppProps {
  onSwitchMode: () => void;
}

// Helper to determine item type
function isUSState(item: GeographyItem): item is USStateData {
  return 'abbreviation' in item && 'region' in item;
}

function isCountry(item: GeographyItem): item is CountryData {
  return 'continent' in item && 'capital' in item && !('city' in item);
}

function isBodyOfWater(item: GeographyItem): item is BodyOfWaterData {
  return 'type' in item && ['ocean', 'sea', 'lake', 'gulf', 'bay'].includes((item as BodyOfWaterData).type);
}

function isLandmark(item: GeographyItem): item is LandmarkData {
  return 'category' in item && 'country' in item && 'imageUrl' in item;
}

export function GeographyApp({ onSwitchMode }: GeographyAppProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [highScores, setHighScores] = useState<GeographyScore[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSubmittedRef = useRef(false);

  const {
    status,
    level,
    levels,
    currentItem,
    previousItem,
    previousWasCorrect,
    timeRemaining,
    stats,
    itemsCompleted,
    isClickMode,
    showingHint,
    wrongAttempts,
    maxWrongAttempts,
    lastWrongClick,
    showCorrectAnswer,
    multipleChoiceMode,
    decoyItems,
    startGame: startGameBase,
    pauseGame,
    resumeGame,
    resetGame,
    submitAnswer,
    showHint,
    skipItem,
    recordWrongAttempt,
    confirmCorrectAnswer,
    toggleMultipleChoiceMode,
  } = useGeographyGameState();

  // Browser back button support
  const handleNavigationBack = useCallback(() => {
    if (status !== 'idle') {
      resetGame();
    } else {
      onSwitchMode();
    }
  }, [status, resetGame, onSwitchMode]);

  useAppNavigation({
    state: status !== 'idle' ? 'playing' : null,
    onBack: handleNavigationBack,
  });

  // Centralized progress tracking
  const { submitOnGameEnd, resetSubmission } = useProgressTracking({
    gameMode: 'geography',
    levelId: level.id,
    levelName: level.name,
  });

  // Voice recognition for Say mode
  const handleCorrectMatch = useCallback(() => {
    if (status === 'playing' && !isClickMode) {
      submitAnswer(true);
    }
  }, [status, isClickMode, submitAnswer]);

  const handleWrongAttempt = useCallback(() => {
    if (status === 'playing' && !isClickMode) {
      recordWrongAttempt();
    }
  }, [status, isClickMode, recordWrongAttempt]);

  const {
    isListening,
    isSupported: voiceSupported,
    transcript,
    startListening,
    stopListening,
    resetRecognition,
  } = useGeographyVoiceRecognition({
    expectedItem: currentItem,
    onCorrectMatch: handleCorrectMatch,
    onWrongAttempt: handleWrongAttempt,
    enabled: status === 'playing' && !isClickMode,
    childMode: true,
  });

  // Load high scores on mount
  useEffect(() => {
    setHighScores(getHighScores(undefined, undefined, 5));
  }, []);

  // Start game with voice recognition - accepts optional levelId to avoid stale closure
  const startGame = useCallback((levelId?: number) => {
    hasSubmittedRef.current = false;
    resetSubmission();
    startGameBase(levelId);
  }, [startGameBase, resetSubmission]);

  // Start/stop voice recognition based on game state
  useEffect(() => {
    if (status === 'playing' && !isClickMode && voiceSupported) {
      startListening();
    } else {
      stopListening();
    }
    return () => stopListening();
  }, [status, isClickMode, voiceSupported, startListening, stopListening]);

  // Reset voice recognition when item changes
  useEffect(() => {
    if (currentItem && !isClickMode) {
      resetRecognition();
    }
  }, [currentItem, isClickMode, resetRecognition]);

  // Save score when game ends (both geography-specific and centralized)
  useEffect(() => {
    if ((status === 'won' || status === 'lost') && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;

      // Save to geography-specific storage (for high scores)
      addGeographyScore({
        gameMode: level.gameMode,
        category: level.category,
        levelId: level.id,
        levelName: level.name,
        score: stats.score,
        correct: stats.correct,
        total: stats.total,
        accuracy: stats.accuracy,
        bestStreak: stats.bestStreak,
        timestamp: Date.now(),
        duration: stats.timeElapsed,
      });
      setHighScores(getHighScores(undefined, undefined, 5));

      // Save to centralized progress tracking
      submitOnGameEnd(status, {
        score: stats.score,
        correct: stats.correct,
        total: stats.total,
        accuracy: stats.accuracy,
        bestStreak: stats.bestStreak,
      }, stats.timeElapsed);
    }
  }, [status, level, stats, submitOnGameEnd]);

  // Show feedback when answer is submitted
  useEffect(() => {
    if (previousWasCorrect !== null) {
      setShowFeedback(true);
      const timer = setTimeout(() => {
        setShowFeedback(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [previousWasCorrect]);

  // Handle map click
  const handleMapClick = useCallback((clickedId: string, clickedName?: string) => {
    if (status !== 'playing' || !currentItem) return;

    let expectedId = '';
    if (isUSState(currentItem)) {
      expectedId = currentItem.abbreviation;
    } else if (isCountry(currentItem)) {
      expectedId = currentItem.id;
    } else if (isBodyOfWater(currentItem)) {
      expectedId = currentItem.id;
    } else if (isLandmark(currentItem)) {
      expectedId = currentItem.countryCode;
    }

    const isCorrect = clickedId.toUpperCase() === expectedId.toUpperCase();

    // If showing correct answer (after max wrong attempts), only accept correct click
    if (showCorrectAnswer) {
      if (isCorrect) {
        confirmCorrectAnswer(); // Advance to next item (marked incorrect)
      }
      return;
    }

    // Normal click mode
    if (!isClickMode) return;

    if (isCorrect) {
      submitAnswer(true);
    } else {
      // Wrong click - record attempt with clicked name, give another chance
      recordWrongAttempt(clickedName || clickedId);
    }
  }, [status, currentItem, isClickMode, showCorrectAnswer, submitAnswer, recordWrongAttempt, confirmCorrectAnswer]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || (e.key === ' ' && status !== 'idle')) {
        e.preventDefault();
        if (status === 'playing') {
          pauseGame();
        } else if (status === 'paused') {
          resumeGame();
        }
      }
      // H for hint
      if ((e.key === 'h' || e.key === 'H') && status === 'playing') {
        e.preventDefault();
        showHint();
      }
      // S to skip
      if ((e.key === 's' || e.key === 'S') && status === 'playing') {
        e.preventDefault();
        skipItem();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, pauseGame, resumeGame, showHint, skipItem]);

  // Handle going back to mode selection
  const handleBackToMenu = useCallback(() => {
    resetGame();
    onSwitchMode();
  }, [resetGame, onSwitchMode]);

  // Check if this is a state capitals game
  const isStateCapitalsGame = level.category === 'us-state-capitals';

  // Get the display info for current item
  const getItemDisplay = (item: GeographyItem | null): {
    name: string;
    flag: string | null;
    subtitle: string;
    funFact: string;
    landmarkImage?: string | null;
  } => {
    if (!item) return { name: '', flag: null, subtitle: '', funFact: '', landmarkImage: null };

    if (isUSState(item)) {
      // For state capitals game, show capital and ask to find the state
      if (isStateCapitalsGame) {
        return {
          name: item.capital,
          flag: null,
          subtitle: `Find the state with this capital`,
          funFact: item.funFact,
          landmarkImage: null,
        };
      }
      return {
        name: item.name,
        flag: null,
        subtitle: `Capital: ${item.capital}`,
        funFact: item.funFact,
        landmarkImage: null,
      };
    }
    if (isCountry(item)) {
      return {
        name: item.name,
        flag: getFlagUrl(item.id, 80),
        subtitle: `Capital: ${item.capital}`,
        funFact: item.funFact,
        landmarkImage: null,
      };
    }
    if (isBodyOfWater(item)) {
      return {
        name: item.name,
        flag: null,
        subtitle: item.type.charAt(0).toUpperCase() + item.type.slice(1),
        funFact: item.funFact,
        landmarkImage: null,
      };
    }
    if (isLandmark(item)) {
      return {
        name: item.name,
        flag: getFlagUrl(item.countryCode, 40),
        subtitle: `${item.city ? item.city + ', ' : ''}${item.country}`,
        funFact: item.funFact,
        landmarkImage: item.imageUrl,
      };
    }
    return { name: '', flag: null, subtitle: '', funFact: '', landmarkImage: null };
  };

  const currentDisplay = getItemDisplay(currentItem);

  // Determine which map to show
  const showUSMap = level.category === 'us-states' || level.category === 'us-state-capitals';

  // Get the highlighted item ID for the map
  const getHighlightedId = (): string | null => {
    if (!currentItem) return null;
    if (isUSState(currentItem)) return currentItem.abbreviation;
    if (isCountry(currentItem)) return currentItem.id;
    if (isBodyOfWater(currentItem)) return currentItem.id;
    if (isLandmark(currentItem)) return currentItem.countryCode;
    return null;
  };

  // Get all option IDs for multiple choice mode (correct + decoys)
  const getHighlightedOptions = (): string[] => {
    if (!multipleChoiceMode || !currentItem) return [];

    const options: string[] = [];

    // Add correct answer
    if (isUSState(currentItem)) {
      options.push(currentItem.abbreviation);
    } else if (isCountry(currentItem)) {
      options.push(currentItem.id);
    } else if (isBodyOfWater(currentItem)) {
      options.push(currentItem.id);
    } else if (isLandmark(currentItem)) {
      options.push(currentItem.countryCode);
    }

    // Add decoys
    for (const decoy of decoyItems) {
      if (isUSState(decoy)) {
        options.push(decoy.abbreviation);
      } else if (isCountry(decoy)) {
        options.push(decoy.id);
      } else if (isBodyOfWater(decoy)) {
        options.push(decoy.id);
      } else if (isLandmark(decoy)) {
        options.push(decoy.countryCode);
      }
    }

    return options;
  };

  // Start screen
  if (status === 'idle') {
    return (
      <AppLayout ref={containerRef} className="geography-app">
        <SelectionScreen
          title="Geography Skills"
          emoji="🌍"
          subtitle="Explore the world and learn amazing places!"
          onBack={onSwitchMode}
        >
          {/* Level Selection - Click to start */}
          <LevelSelect
            levels={levels.map(l => ({
              id: l.id,
              name: l.name,
              description: l.description,
              emoji: l.emoji,
              color: l.color,
              metaItems: [
                { label: l.gameMode === 'click' ? '🖱️' : l.gameMode === 'say' ? '🗣️' : '🔄', value: '' },
                { label: 'to win', value: l.itemsToWin },
                { label: 'min', value: Math.floor(geographyConfig.timerDuration / 60) },
              ],
            } as GenericLevel))}
            currentLevelId={level.id}
            gameMode="geography"
            onSelectLevel={(l) => startGame(l.id)}
            title="Choose Your Adventure"
          />

          {/* High Scores */}
          {highScores.length > 0 && (
            <div className="geography-high-scores">
              <h3 className="geography-high-scores__title">🏆 High Scores</h3>
              <div className="geography-high-scores__list">
                {highScores.slice(0, 5).map((score, index) => (
                  <div key={score.id} className="geography-high-scores__item">
                    <span className="geography-high-scores__rank">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </span>
                    <span className="geography-high-scores__name">{score.levelName}</span>
                    <span className="geography-high-scores__score">{score.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SelectionScreen>
      </AppLayout>
    );
  }

  // Win/Lose screen
  if (status === 'won' || status === 'lost') {
    return (
      <AppLayout ref={containerRef} className="geography-app">
        <WinScreen
          stats={{
            correct: stats.correct,
            incorrect: stats.incorrect,
            total: stats.total,
            accuracy: stats.accuracy,
            answersPerMinute: stats.itemsPerMinute,
            timeElapsed: stats.timeElapsed,
          }}
          level={{
            ...level,
            puzzlePieces: level.itemsToWin,
            targetCorrectPerMinute: level.targetPerMinute,
            addition: { min: 0, max: 0 },
            subtraction: { minuendMax: 0 },
            multiplication: { min: 0, max: 0 },
            division: { dividendMax: 0 },
          }}
          timeRemaining={timeRemaining}
          isWin={status === 'won'}
          onPlayAgain={startGame}
          onChangeLevel={handleBackToMenu}
        />
        <div className="geography-results">
          <div className="geography-results__score">
            <span className="geography-results__label">Final Score</span>
            <span className="geography-results__value">{stats.score.toLocaleString()}</span>
          </div>
          <div className="geography-results__streak">
            <span className="geography-results__label">Best Streak</span>
            <span className="geography-results__value">{stats.bestStreak} 🔥</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  const isPaused = status === 'paused';

  return (
    <AppLayout ref={containerRef} className="geography-app">
      <PlayingLayout
        gameName="Geography"
        gameEmoji="🌍"
        levelName={level.name}
        timeRemaining={timeRemaining}
        showTimer={true}
        isPaused={isPaused}
        showVoice={!isClickMode && voiceSupported}
        isListening={isListening}
        transcript={transcript}
        stats={{
          correct: stats.correct,
          progress: `${itemsCompleted}/${level.itemsToWin}`,
          streak: stats.streak,
        }}
        onBack={handleBackToMenu}
        onPause={pauseGame}
        sidebarContent={
          <>
            <div className="geography-score-sidebar">
              <div className="geography-score-sidebar__score">
                <span className="geography-score-sidebar__label">Score</span>
                <span className="geography-score-sidebar__value">{stats.score.toLocaleString()}</span>
              </div>
              {stats.streak > 1 && (
                <div className="geography-score-sidebar__streak">
                  {stats.streak} 🔥
                </div>
              )}
            </div>

            <Stats
              stats={{
                correct: stats.correct,
                incorrect: stats.incorrect,
                total: stats.total,
                accuracy: stats.accuracy,
                answersPerMinute: stats.itemsPerMinute,
                timeElapsed: stats.timeElapsed,
              }}
              puzzlePiecesCompleted={itemsCompleted}
              puzzlePiecesTotal={level.itemsToWin}
              targetPerMinute={level.targetPerMinute}
            />

            <CandylandPath
              completed={itemsCompleted}
              total={level.itemsToWin}
            />
          </>
        }
      >
        {/* Previous item display - show what was just answered */}
        {previousItem && previousWasCorrect !== null && (
          <div className={`geography-previous ${previousWasCorrect ? 'geography-previous--correct' : 'geography-previous--incorrect'}`}>
            <span className="geography-previous__icon">{previousWasCorrect ? '✓' : '✗'}</span>
            <span className="geography-previous__name">{getItemDisplay(previousItem).name}</span>
          </div>
        )}

        {/* Landmark image display - above the info panel */}
        {currentDisplay.landmarkImage && (
          <div className="geography-landmark-image">
            <img
              src={currentDisplay.landmarkImage}
              alt="Landmark"
              className="geography-landmark-image__img"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Compact info panel */}
        <div className="geography-info-panel geography-info-panel--compact">
          <div className="geography-prompt">
            {/* In Say mode, show the location highlighted on the map, don't show the name */}
            {isClickMode ? (
              <>
                <span className="geography-prompt__mode">🖱️ Click on:</span>
                <div className="geography-prompt__target">
                  {currentDisplay.flag && (
                    <img src={currentDisplay.flag} alt="Flag" className="geography-prompt__flag" />
                  )}
                  <span className="geography-prompt__name">{currentDisplay.name}</span>
                </div>
              </>
            ) : (
              <>
                <span className="geography-prompt__mode">🗣️ Say the name of the highlighted location</span>
                {/* Only show name when hint is active or after wrong attempts as help */}
                {(showingHint || wrongAttempts >= 2) && (
                  <div className="geography-prompt__target geography-prompt__target--hint">
                    <span className="geography-prompt__name">{currentDisplay.name}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Wrong click feedback */}
          {lastWrongClick && wrongAttempts > 0 && !showCorrectAnswer && (
            <div className="geography-wrong-click">
              <span className="geography-wrong-click__icon">✗</span>
              <span className="geography-wrong-click__text">
                That was <strong>{lastWrongClick}</strong>. Try again! ({maxWrongAttempts - wrongAttempts} left)
              </span>
            </div>
          )}

          {/* Show correct answer prompt */}
          {showCorrectAnswer && (
            <div className="geography-show-answer">
              <span className="geography-show-answer__icon">👆</span>
              <span className="geography-show-answer__text">
                Click on <strong>
                  {isStateCapitalsGame && currentItem && isUSState(currentItem)
                    ? currentItem.name
                    : currentDisplay.name}
                </strong> (highlighted in blue) to continue
              </span>
            </div>
          )}

          {/* Fun fact hint */}
          {showingHint && currentDisplay.funFact && (
            <div className="geography-hint">
              <span className="geography-hint__icon">💡</span>
              <span className="geography-hint__text">{currentDisplay.funFact}</span>
            </div>
          )}

          {/* Compact controls */}
          <div className="geography-controls geography-controls--compact">
            <button className="geography-btn geography-btn--hint" onClick={showHint} disabled={showingHint}>
              💡 Hint
            </button>
            <button className="geography-btn geography-btn--skip" onClick={skipItem}>
              ⏭️ Skip
            </button>
            {isClickMode && (
              <button
                className={`geography-btn geography-btn--choices ${multipleChoiceMode ? 'geography-btn--active' : ''}`}
                onClick={toggleMultipleChoiceMode}
                title={multipleChoiceMode ? 'Turn off multiple choice hints' : 'Show 3 choices to help learn'}
              >
                {multipleChoiceMode ? '3️⃣ On' : '3️⃣ Off'}
              </button>
            )}
          </div>
        </div>

        {/* Map display */}
        <div className="geography-map-container" style={{ position: 'relative' }}>
          {showUSMap ? (
            <USMap
              highlightedState={(!isClickMode || showCorrectAnswer) ? getHighlightedId() : null}
              highlightedOptions={isClickMode ? getHighlightedOptions() : []}
              onStateClick={handleMapClick}
              showLabels={showingHint || showCorrectAnswer}
              disabled={!isClickMode && !showCorrectAnswer}
            />
          ) : (
            <WorldMap
              highlightedCountry={(!isClickMode || showCorrectAnswer) ? getHighlightedId() : null}
              highlightedOptions={isClickMode ? getHighlightedOptions() : []}
              onCountryClick={handleMapClick}
              continent={level.category.startsWith('countries-') ? level.category.replace('countries-', '') : undefined}
              showLabels={showingHint || showCorrectAnswer}
              disabled={!isClickMode && !showCorrectAnswer}
            />
          )}
          <FeedbackMessage isCorrect={previousWasCorrect} show={showFeedback} />
        </div>
      </PlayingLayout>

      {/* Pause Overlay */}
      {isPaused && (
        <PauseOverlay onResume={resumeGame} />
      )}
    </AppLayout>
  );
}

export default GeographyApp;
