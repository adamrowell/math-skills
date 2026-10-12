import { useState, useCallback, useEffect, useRef } from 'react';
import { useWordProblemsState } from './hooks/useWordProblemsState';
import { useAppNavigation } from './hooks/useAppNavigation';
import { Stats } from './components/Stats/Stats';
import { CandylandPath } from './components/CandylandPath/CandylandPath';
import { Keypad } from './components/Keypad/Keypad';
import { FeedbackMessage } from './components/FeedbackMessage/FeedbackMessage';
import { WinScreen } from './components/WinScreen/WinScreen';
import { LevelSelect } from './components/LevelSelect/LevelSelect';
import { AppLayout, SelectionScreen, PlayingLayout, PauseOverlay } from './components/AppLayout';
import './WordProblemsApp.css';

interface WordProblemsAppProps {
  onSwitchMode: () => void;
}

export default function WordProblemsApp({ onSwitchMode }: WordProblemsAppProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    status,
    level,
    levels,
    currentProblem,
    previousWasCorrect,
    timeRemaining,
    stats,
    problemsCompleted,
    selectedAnswer,
    userAnswer,
    attempts,
    showHint,
    config,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    selectLevel,
    selectOption,
    handleInput,
    submitTypedAnswer,
    skipProblem,
    requestHint,
  } = useWordProblemsState();

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

  // Show feedback when answer is submitted
  useEffect(() => {
    if (previousWasCorrect !== null) {
      setShowFeedback(true);
      const timer = setTimeout(() => setShowFeedback(false), 800);
      return () => clearTimeout(timer);
    }
  }, [previousWasCorrect]);

  const handleLevelSelect = (selectedLevel: typeof level) => {
    selectLevel(selectedLevel.id);
    startGame(selectedLevel.id);
  };

  const handleBackToLevels = () => {
    resetGame();
  };

  const handlePlayAgain = () => {
    startGame(level.id);
  };

  // Get category info for display
  const getCategoryInfo = (category: string) => {
    return config.categoryInfo[category as keyof typeof config.categoryInfo] || {
      name: category,
      emoji: '📝',
      color: '#666',
    };
  };

  // Level selection / idle view
  if (status === 'idle') {
    const levelsWithMeta = levels.map(l => ({
      ...l,
      metaItems: [
        { label: 'Problems', value: l.problemsToWin },
        { label: 'Time', value: `${Math.floor(l.timerDuration / 60)}m` },
      ],
    }));

    return (
      <AppLayout ref={containerRef} className="word-problems-app">
        <SelectionScreen
          title="Word Problems"
          emoji="📝"
          subtitle="Practice reading and solving word problems!"
          onBack={onSwitchMode}
        >
          <LevelSelect
            levels={levelsWithMeta}
            currentLevelId={level.id}
            title="Choose Your Level"
            onSelectLevel={handleLevelSelect}
          />
        </SelectionScreen>
      </AppLayout>
    );
  }

  // Win/Lose screen
  if (status === 'won' || status === 'lost') {
    const gameStats = {
      correct: stats.correct,
      incorrect: stats.incorrect,
      total: stats.total,
      accuracy: stats.accuracy,
      answersPerMinute: Math.round((stats.correct / stats.timeElapsed) * 60) || 0,
      timeElapsed: stats.timeElapsed,
    };

    return (
      <AppLayout ref={containerRef} className="word-problems-app">
        <WinScreen
          stats={gameStats}
          level={{
            ...level,
            puzzlePieces: level.problemsToWin,
            targetCorrectPerMinute: 5,
            addition: { min: 0, max: 0 },
            subtraction: { minuendMax: 0 },
            multiplication: { min: 0, max: 0 },
            division: { dividendMax: 0 },
          }}
          timeRemaining={timeRemaining}
          isWin={status === 'won'}
          onPlayAgain={handlePlayAgain}
          onChangeLevel={handleBackToLevels}
        />
      </AppLayout>
    );
  }

  const isMultipleChoice = currentProblem?.answerType === 'multiple-choice';
  const isNumberInput = currentProblem?.answerType === 'fill-number';
  const categoryInfo = currentProblem ? getCategoryInfo(currentProblem.category) : null;
  const isPaused = status === 'paused';

  // Playing view
  return (
    <AppLayout ref={containerRef} className="word-problems-app">
      <PlayingLayout
        gameName="Word Problems"
        gameEmoji="📝"
        levelName={level.name}
        levelEmoji={level.emoji}
        levelColor={level.color}
        timeRemaining={timeRemaining}
        showTimer={true}
        isPaused={isPaused}
        stats={{
          correct: stats.correct,
          progress: `${problemsCompleted}/${level.problemsToWin}`,
          accuracy: stats.accuracy,
        }}
        onBack={handleBackToLevels}
        onPause={pauseGame}
        sidebarContent={
          <>
            <Stats
              stats={{
                correct: stats.correct,
                incorrect: stats.incorrect,
                total: stats.total,
                accuracy: stats.accuracy,
                answersPerMinute: 0,
                timeElapsed: stats.timeElapsed,
              }}
              puzzlePiecesCompleted={problemsCompleted}
              puzzlePiecesTotal={level.problemsToWin}
              targetPerMinute={5}
            />
            <CandylandPath
              completed={problemsCompleted}
              total={level.problemsToWin}
            />
          </>
        }
      >
        {currentProblem && (
          <div className="problem-card">
            {/* Category badge */}
            {categoryInfo && (
              <div
                className="category-badge"
                style={{ backgroundColor: categoryInfo.color }}
              >
                {categoryInfo.emoji} {categoryInfo.name}
              </div>
            )}

            {/* Passage (for comprehension problems) */}
            {currentProblem.passage && (
              <div className="problem-passage">
                <p>{currentProblem.passage}</p>
              </div>
            )}

            {/* Question */}
            <div className="problem-question">
              <p>{currentProblem.question}</p>
            </div>

            {/* Hint display */}
            {showHint && currentProblem.hint1 && (
              <div className="hint-display">
                <span className="hint-icon">💡</span>
                <span className="hint-text">
                  {attempts >= 2 && currentProblem.hint2
                    ? currentProblem.hint2
                    : currentProblem.hint1}
                </span>
              </div>
            )}

            {/* Answer section */}
            <div className="answer-section">
              {isMultipleChoice && currentProblem.options && (
                <div className="options-grid">
                  {currentProblem.options.map((option, i) => {
                    let optionClass = 'option-btn';
                    if (selectedAnswer === option) {
                      optionClass += previousWasCorrect
                        ? ' option-btn--correct'
                        : ' option-btn--incorrect';
                    }
                    return (
                      <button
                        key={i}
                        className={optionClass}
                        onClick={() => selectOption(option)}
                        disabled={selectedAnswer !== null}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {isNumberInput && (
                <div className="number-input-section">
                  <div className="answer-display">
                    <span className="answer-label">Answer:</span>
                    <span className="answer-value">{userAnswer || '_'}</span>
                  </div>
                  <Keypad
                    value={userAnswer}
                    onChange={handleInput}
                    onSubmit={submitTypedAnswer}
                    onClear={() => handleInput('')}
                    disabled={status !== 'playing'}
                  />
                </div>
              )}

              {currentProblem.answerType === 'fill-word' && (
                <div className="text-input-section">
                  <input
                    type="text"
                    className="word-input"
                    value={userAnswer}
                    onChange={(e) => handleInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitTypedAnswer()}
                    placeholder="Type your answer..."
                    disabled={status !== 'playing'}
                    autoFocus
                  />
                  <button
                    className="submit-btn"
                    onClick={submitTypedAnswer}
                    disabled={!userAnswer.trim()}
                  >
                    Submit
                  </button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="action-buttons">
              {level.showHints && !showHint && (
                <button className="hint-btn" onClick={requestHint}>
                  💡 Hint
                </button>
              )}
              <button className="skip-btn" onClick={skipProblem}>
                Skip →
              </button>
            </div>

            {/* Attempts indicator */}
            {attempts > 0 && (
              <div className="attempts-indicator">
                Attempt {attempts} of {config.maxAttempts}
              </div>
            )}
          </div>
        )}

        <FeedbackMessage isCorrect={previousWasCorrect} show={showFeedback} />
      </PlayingLayout>

      {/* Pause Overlay */}
      {isPaused && (
        <PauseOverlay onResume={resumeGame} />
      )}
    </AppLayout>
  );
}
