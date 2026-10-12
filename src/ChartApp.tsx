import { useCallback, useRef, useEffect, useState } from 'react';
import { useChartGameState } from './hooks/useChartGameState';
import { useProgressTracking } from './hooks/useProgressTracking';
import { useAppNavigation } from './hooks/useAppNavigation';
import { ChartDisplay } from './components/Charts';
import { chartGameConfig } from './config/chartGameConfig';
import { Stats } from './components/Stats';
import { CandylandPath } from './components/CandylandPath';
import { WinScreen } from './components/WinScreen';
import { FeedbackMessage } from './components/FeedbackMessage/FeedbackMessage';
import { LevelSelect, GenericLevel } from './components/LevelSelect';
import { AppLayout, SelectionScreen, PlayingLayout, PauseOverlay } from './components/AppLayout';
import './App.css';
import './ChartApp.css';

interface ChartAppProps {
  onBack: () => void;
}

// Level styles matching other apps
const levelStyles: Record<number, { emoji: string; color: string }> = {
  1: { emoji: '📊', color: '#4CAF50' },
  2: { emoji: '🔍', color: '#2196F3' },
  3: { emoji: '🏆', color: '#FF9800' },
};

function ChartApp({ onBack }: ChartAppProps) {
  const {
    status,
    level,
    levels,
    currentQuestion,
    previousWasCorrect,
    timeRemaining,
    stats,
    questionsCompleted,
    showingHint,
    userAnswer,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    submitAnswer,
    handleChartClick,
    showHint,
    skipQuestion,
    setUserAnswer,
  } = useChartGameState();

  // Browser back button support
  const handleNavigationBack = useCallback(() => {
    if (status !== 'idle') {
      resetGame();
    } else {
      onBack();
    }
  }, [status, resetGame, onBack]);

  useAppNavigation({
    state: status !== 'idle' ? 'playing' : null,
    onBack: handleNavigationBack,
  });

  // Progress tracking
  const { submitOnGameEnd, resetSubmission } = useProgressTracking({
    gameMode: 'charts',
    levelId: level.id,
    levelName: level.name,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | number | null>(null);

  // Submit score when game ends
  useEffect(() => {
    if (status === 'won' || status === 'lost') {
      submitOnGameEnd(status, {
        correct: stats.correct,
        total: stats.total,
        accuracy: stats.accuracy,
        bestStreak: stats.bestStreak,
      }, stats.timeElapsed);
    }
  }, [status, stats, submitOnGameEnd]);

  // Focus input when question changes (for typed input)
  useEffect(() => {
    if (status === 'playing' && currentQuestion?.inputType === 'typed' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [status, currentQuestion]);

  // Clear selected option when question changes
  useEffect(() => {
    setSelectedOption(null);
  }, [currentQuestion?.id]);

  // Show feedback when answer is submitted (longer for kids to read)
  useEffect(() => {
    if (previousWasCorrect !== null) {
      setShowFeedback(true);
      const timer = setTimeout(() => {
        setShowFeedback(false);
      }, 1200); // Longer feedback for kids
      return () => clearTimeout(timer);
    }
  }, [previousWasCorrect]);

  // Handle typed answer submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (userAnswer.trim()) {
        submitAnswer(userAnswer.trim());
      }
    },
    [userAnswer, submitAnswer]
  );

  // Handle multiple choice selection
  const handleOptionClick = useCallback(
    (option: string | number) => {
      setSelectedOption(option);
      setTimeout(() => {
        submitAnswer(option);
      }, 200);
    },
    [submitAnswer]
  );

  // Handle level selection and start game
  const handleStartGame = useCallback(
    (levelId: number) => {
      resetSubmission();
      startGame(levelId);
    },
    [startGame, resetSubmission]
  );

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
      if ((e.key === 'h' || e.key === 'H') && status === 'playing') {
        e.preventDefault();
        showHint();
      }
      if ((e.key === 's' || e.key === 'S') && status === 'playing' && currentQuestion?.inputType !== 'typed') {
        e.preventDefault();
        skipQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, pauseGame, resumeGame, showHint, skipQuestion, currentQuestion]);

  // Handle going back to mode selection
  const handleBackToMenu = useCallback(() => {
    resetGame();
    onBack();
  }, [resetGame, onBack]);

  const isPaused = status === 'paused';

  // Start screen
  if (status === 'idle') {
    return (
      <AppLayout ref={containerRef} className="chart-app">
        <SelectionScreen
          title="Chart Explorer"
          emoji="📊"
          subtitle="Learn to read charts, graphs, and more!"
          onBack={onBack}
        >
          {/* Level Selection */}
          <LevelSelect
            levels={levels.map(l => {
              const style = levelStyles[l.id] || { emoji: '📊', color: '#4CAF50' };
              return {
                id: l.id,
                name: l.name,
                description: l.description,
                emoji: style.emoji,
                color: style.color,
                metaItems: [
                  { label: 'to win', value: l.itemsToWin },
                  { label: 'min', value: Math.floor((l.timerDuration || chartGameConfig.timerDuration) / 60) },
                ],
              } as GenericLevel;
            })}
            currentLevelId={level.id}
            gameMode="charts"
            onSelectLevel={(l) => handleStartGame(l.id)}
            title="Choose Your Level"
          />
        </SelectionScreen>
      </AppLayout>
    );
  }

  // Win/Lose screen
  if (status === 'won' || status === 'lost') {
    return (
      <AppLayout ref={containerRef} className="chart-app">
        <WinScreen
          stats={{
            correct: stats.correct,
            incorrect: stats.incorrect,
            total: stats.total,
            accuracy: stats.accuracy,
            answersPerMinute: stats.questionsPerMinute,
            timeElapsed: stats.timeElapsed,
          }}
          level={{
            id: level.id,
            name: level.name,
            description: level.description,
            color: levelStyles[level.id]?.color || '#4CAF50',
            emoji: levelStyles[level.id]?.emoji || '📊',
            puzzlePieces: level.itemsToWin,
            targetCorrectPerMinute: 5,
            addition: { min: 0, max: 0 },
            subtraction: { minuendMax: 0 },
            multiplication: { min: 0, max: 0 },
            division: { dividendMax: 0 },
          }}
          timeRemaining={timeRemaining}
          isWin={status === 'won'}
          onPlayAgain={() => startGame(level.id)}
          onChangeLevel={handleBackToMenu}
        />
      </AppLayout>
    );
  }

  // Main game
  return (
    <AppLayout ref={containerRef} className="chart-app">
      <PlayingLayout
        gameName="Chart Explorer"
        gameEmoji="📊"
        levelName={level.name}
        timeRemaining={timeRemaining}
        showTimer={true}
        isPaused={isPaused}
        stats={{
          correct: stats.correct,
          progress: `${questionsCompleted}/${level.itemsToWin}`,
          streak: stats.streak,
        }}
        onBack={handleBackToMenu}
        onPause={pauseGame}
        sidebarContent={
          <>
            <div className="chart-score-sidebar">
              <div className="chart-score-sidebar__score">
                <span className="chart-score-sidebar__label">Score</span>
                <span className="chart-score-sidebar__value">{stats.score.toLocaleString()}</span>
              </div>
              {stats.streak > 1 && (
                <div className="chart-score-sidebar__streak">
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
                answersPerMinute: stats.questionsPerMinute,
                timeElapsed: stats.timeElapsed,
              }}
              puzzlePiecesCompleted={questionsCompleted}
              puzzlePiecesTotal={level.itemsToWin}
              targetPerMinute={5}
            />

            <CandylandPath
              completed={questionsCompleted}
              total={level.itemsToWin}
            />
          </>
        }
      >
        {/* Question and Chart */}
        {currentQuestion && (
          <div className="chart-question-area">
            <div className="chart-question-text">{currentQuestion.questionText}</div>

            {/* Chart Display */}
            <ChartDisplay
              data={currentQuestion.chartData}
              onElementClick={currentQuestion.inputType === 'click' ? handleChartClick : undefined}
              showValues={level.showValues}
              disabled={currentQuestion.inputType !== 'click'}
              highlightedElement={showingHint ? currentQuestion.targetItem : undefined}
            />

            {/* Feedback overlay */}
            <FeedbackMessage isCorrect={previousWasCorrect} show={showFeedback} />

            {/* Hint */}
            {showingHint && currentQuestion.hint && (
              <div className="chart-hint">
                <span className="chart-hint-icon">💡</span>
                {currentQuestion.hint}
              </div>
            )}

            {/* Input Area */}
            <div className="chart-input-area">
              {currentQuestion.inputType === 'typed' && (
                <form onSubmit={handleSubmit} className="chart-typed-input">
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="chart-input"
                    autoComplete="off"
                  />
                  <button type="submit" className="chart-btn chart-btn--submit" disabled={!userAnswer.trim()}>
                    Submit
                  </button>
                </form>
              )}

              {currentQuestion.inputType === 'multipleChoice' && currentQuestion.options && (
                <div className="chart-options">
                  {currentQuestion.options.map((option, index) => (
                    <button
                      key={index}
                      className={`chart-option ${selectedOption === option ? 'chart-option--selected' : ''}`}
                      onClick={() => handleOptionClick(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.inputType === 'click' && (
                <div className="chart-click-instruction">
                  👆 Tap the answer on the chart above!
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="chart-actions">
              {!showingHint && (
                <button className="chart-btn chart-btn--hint" onClick={showHint}>
                  💡 Hint
                </button>
              )}
              <button className="chart-btn chart-btn--skip" onClick={skipQuestion}>
                ⏭️ Skip
              </button>
            </div>
          </div>
        )}
      </PlayingLayout>

      {/* Pause Overlay */}
      {isPaused && (
        <PauseOverlay onResume={resumeGame} />
      )}
    </AppLayout>
  );
}

export default ChartApp;
