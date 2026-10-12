import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { useTableGameState } from './hooks/useTableGameState';
import { useComparisonGameState } from './hooks/useComparisonGameState';
import { useVoiceRecognition } from './hooks/useVoiceRecognition';
import { useComparisonVoiceRecognition } from './hooks/useComparisonVoiceRecognition';
import { useProgressTracking } from './hooks/useProgressTracking';
import { useAppNavigation } from './hooks/useAppNavigation';
import { config } from './config/gameConfig';
import { tableLevels } from './config/tableGameConfig';
import { comparisonLevels, ComparisonResult } from './config/comparisonConfig';
import { WinScreen } from './components/WinScreen';
import { ProblemDisplay } from './components/Game';
import { MultiplicationTable } from './components/MultiplicationTable';
import { Stats } from './components/Stats';
import { Keypad } from './components/Keypad';
import { CandylandPath } from './components/CandylandPath';
import { FeedbackMessage } from './components/FeedbackMessage';
import { FractionDisplay } from './components/FractionDisplay';
import { NumberLineVisualization } from './components/NumberLineVisualization';
import { FractionBarVisualization } from './components/FractionBarVisualization';
import { FractionPieChart } from './components/FractionPieChart';
import { LevelSelect, GenericLevel } from './components/LevelSelect';
import { AppLayout, SelectionScreen, PlayingLayout, PauseOverlay } from './components/AppLayout';
import './App.css';
import './components/FractionPieChart.css';
import './TableApp.css';
import './ComparisonApp.css';

import { GameMode } from './config/readingConfig';

interface MathAppProps {
  onSwitchMode: (targetMode?: GameMode | null) => void;
}

// Voice recognition enabled for comparison and table games
const COMPARISON_VOICE_ENABLED = true;
const TABLE_VOICE_ENABLED = true;

export function MathApp({ onSwitchMode }: MathAppProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [tableGameActive, setTableGameActive] = useState(false);
  const [comparisonGameActive, setComparisonGameActive] = useState(false);
  const autoSubmitTimeoutRef = useRef<number | null>(null);
  const tableAutoSubmitTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Regular math game state
  const {
    status,
    level,
    currentProblem,
    previousProblem,
    previousWasCorrect,
    nextProblem,
    timeRemaining,
    stats,
    puzzlePiecesCompleted,
    userAnswer,
    levels,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    selectLevel,
    submitAnswer,
    handleInput,
    clearInput,
  } = useGameState();

  // Table game state
  const tableGame = useTableGameState();

  // Comparison game state
  const comparisonGame = useComparisonGameState();

  // Determine current navigation state for browser back button
  const getNavigationState = () => {
    if (tableGameActive) return 'table';
    if (comparisonGameActive) return 'comparison';
    if (status !== 'idle') return 'playing';
    return null;
  };

  // Handle going back from comparison game to start screen
  const handleBackFromComparison = useCallback(() => {
    comparisonGame.resetGame();
    setComparisonGameActive(false);
  }, [comparisonGame]);

  // Handle going back from table game to start screen
  const handleBackFromTable = useCallback(() => {
    tableGame.resetGame();
    setTableGameActive(false);
  }, [tableGame]);

  // Handle going back to mode selection
  const handleBackToMenu = useCallback(() => {
    resetGame();
    tableGame.resetGame();
    comparisonGame.resetGame();
    setTableGameActive(false);
    setComparisonGameActive(false);
    onSwitchMode();
  }, [resetGame, tableGame, comparisonGame, onSwitchMode]);

  // Navigation back handler
  const handleNavigationBack = useCallback(() => {
    if (tableGameActive) {
      handleBackFromTable();
    } else if (comparisonGameActive) {
      handleBackFromComparison();
    } else if (status !== 'idle') {
      resetGame();
    } else {
      onSwitchMode();
    }
  }, [tableGameActive, comparisonGameActive, status, handleBackFromTable, handleBackFromComparison, resetGame, onSwitchMode]);

  // Browser back button support
  useAppNavigation({
    state: getNavigationState(),
    onBack: handleNavigationBack,
  });

  // Progress tracking for main math game
  const { submitOnGameEnd: submitMathProgress, resetSubmission: resetMathSubmission } = useProgressTracking({
    gameMode: 'math',
    levelId: level.id,
    levelName: level.name,
  });

  // Progress tracking for embedded table game
  const { submitOnGameEnd: submitTableProgress, resetSubmission: resetTableSubmission } = useProgressTracking({
    gameMode: 'tables',
    levelId: tableGame.level.id,
    levelName: tableGame.level.name,
  });

  // Progress tracking for embedded comparison game
  const { submitOnGameEnd: submitComparisonProgress, resetSubmission: resetComparisonSubmission } = useProgressTracking({
    gameMode: 'comparison',
    levelId: comparisonGame.level.id,
    levelName: comparisonGame.level.name,
  });

  // Submit progress when main math game ends
  useEffect(() => {
    if (status === 'won' || status === 'lost') {
      submitMathProgress(status, {
        correct: stats.correct,
        total: stats.total,
        accuracy: stats.accuracy,
        bestStreak: 0, // Math game doesn't track streaks
      }, stats.timeElapsed);
    }
  }, [status, stats, submitMathProgress]);

  // Submit progress when embedded table game ends
  useEffect(() => {
    if (tableGameActive && (tableGame.status === 'won' || tableGame.status === 'lost')) {
      submitTableProgress(tableGame.status, {
        correct: tableGame.stats.correct,
        total: tableGame.stats.total,
        accuracy: tableGame.stats.accuracy,
        bestStreak: 0, // TableGame doesn't track streaks
      }, tableGame.stats.timeElapsed);
    }
  }, [tableGameActive, tableGame.status, tableGame.stats, submitTableProgress]);

  // Submit progress when embedded comparison game ends
  useEffect(() => {
    if (comparisonGameActive && (comparisonGame.status === 'won' || comparisonGame.status === 'lost')) {
      submitComparisonProgress(comparisonGame.status, {
        correct: comparisonGame.stats.correct,
        total: comparisonGame.stats.total,
        accuracy: comparisonGame.stats.accuracy,
        bestStreak: comparisonGame.stats.bestStreak,
      }, comparisonGame.stats.timeElapsed);
    }
  }, [comparisonGameActive, comparisonGame.status, comparisonGame.stats, submitComparisonProgress]);

  // Show feedback message when answer is submitted (regular math or table game or comparison)
  useEffect(() => {
    const wasCorrect = comparisonGameActive
      ? comparisonGame.previousWasCorrect
      : tableGameActive
        ? tableGame.previousWasCorrect
        : previousWasCorrect;
    if (wasCorrect !== null) {
      setShowFeedback(true);
      const timer = setTimeout(() => {
        setShowFeedback(false);
      }, comparisonGameActive ? 1200 : 800);
      return () => clearTimeout(timer);
    }
  }, [previousWasCorrect, tableGame.previousWasCorrect, comparisonGame.previousWasCorrect, tableGameActive, comparisonGameActive]);

  // Handle voice recognition result - fires when any number is recognized
  const handleVoiceResult = useCallback(
    (number: number) => {
      if (status !== 'playing' || !currentProblem) return;

      // Check if the spoken number matches the answer
      if (number === currentProblem.answer) {
        submitAnswer(number);
      }
    },
    [status, currentProblem, submitAnswer]
  );

  // Handle when the expected answer is detected in speech
  // This is more lenient and catches phrases like "2 x 5 equals 10"
  const handleAnswerDetected = useCallback(
    (answer: number, _transcript: string) => {
      if (status !== 'playing' || !currentProblem) return;
      submitAnswer(answer);
    },
    [status, currentProblem, submitAnswer]
  );

  const {
    isListening,
    isSupported: voiceSupported,
    transcript,
    startListening,
    stopListening,
    resetRecognition,
  } = useVoiceRecognition({
    continuous: true,
    onResult: handleVoiceResult,
    onAnswerDetected: handleAnswerDetected,
    expectedAnswer: currentProblem?.answer ?? null,
    enabled: status === 'playing' && config.voiceEnabled,
    childMode: true, // Enable child-friendly recognition
  });

  // Start/stop voice recognition based on game status
  useEffect(() => {
    if (status === 'playing' && config.voiceEnabled && voiceSupported) {
      startListening();
    } else {
      stopListening();
    }
  }, [status, startListening, stopListening, voiceSupported]);

  // Reset voice recognition after each answer to clear the buffer
  useEffect(() => {
    if (previousWasCorrect !== null && config.voiceEnabled) {
      const timer = setTimeout(() => {
        resetRecognition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [previousWasCorrect, resetRecognition]);

  // Comparison voice recognition
  const handleComparisonVoiceResult = useCallback(
    (answer: ComparisonResult, _transcript: string) => {
      if (comparisonGame.status !== 'playing' || comparisonGame.userAnswer !== null) return;
      comparisonGame.submitAnswer(answer);
    },
    [comparisonGame]
  );

  const {
    isListening: comparisonIsListening,
    isSupported: comparisonVoiceSupported,
    transcript: comparisonTranscript,
    startListening: startComparisonListening,
    stopListening: stopComparisonListening,
    resetRecognition: resetComparisonRecognition,
  } = useComparisonVoiceRecognition({
    enabled: comparisonGameActive && comparisonGame.status === 'playing' && COMPARISON_VOICE_ENABLED && comparisonGame.userAnswer === null,
    onResult: handleComparisonVoiceResult,
  });

  // Start/stop comparison voice recognition
  useEffect(() => {
    if (comparisonGameActive && comparisonGame.status === 'playing' && COMPARISON_VOICE_ENABLED && comparisonVoiceSupported && comparisonGame.userAnswer === null) {
      startComparisonListening();
    } else {
      stopComparisonListening();
    }
  }, [comparisonGameActive, comparisonGame.status, comparisonGame.userAnswer, startComparisonListening, stopComparisonListening, comparisonVoiceSupported]);

  // Reset comparison voice after answer
  useEffect(() => {
    if (comparisonGame.previousWasCorrect !== null && COMPARISON_VOICE_ENABLED) {
      const timer = setTimeout(() => {
        resetComparisonRecognition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [comparisonGame.previousWasCorrect, resetComparisonRecognition]);

  // Table game voice recognition handler
  const handleTableVoiceResult = useCallback(
    (number: number) => {
      if (tableGame.status !== 'playing' || !tableGame.currentQuestion) return;

      // Check if the spoken number matches the answer
      if (number === tableGame.currentQuestion.answer) {
        tableGame.submitAnswer(number);
      }
    },
    [tableGame]
  );

  // Handle when expected answer is detected in table game speech
  const handleTableAnswerDetected = useCallback(
    (answer: number, _transcript: string) => {
      if (tableGame.status !== 'playing' || !tableGame.currentQuestion) return;
      tableGame.submitAnswer(answer);
    },
    [tableGame]
  );

  // Table game voice recognition
  const {
    isListening: tableIsListening,
    isSupported: tableVoiceSupported,
    transcript: tableTranscript,
    startListening: startTableListening,
    stopListening: stopTableListening,
    resetRecognition: resetTableRecognition,
  } = useVoiceRecognition({
    continuous: true,
    onResult: handleTableVoiceResult,
    onAnswerDetected: handleTableAnswerDetected,
    expectedAnswer: tableGame.currentQuestion?.answer ?? null,
    enabled: tableGameActive && tableGame.status === 'playing' && TABLE_VOICE_ENABLED,
    childMode: true,
  });

  // Start/stop table voice recognition based on game status
  useEffect(() => {
    if (tableGameActive && tableGame.status === 'playing' && TABLE_VOICE_ENABLED && tableVoiceSupported) {
      startTableListening();
    } else {
      stopTableListening();
    }
  }, [tableGameActive, tableGame.status, startTableListening, stopTableListening, tableVoiceSupported]);

  // Reset table voice recognition after each answer
  useEffect(() => {
    if (tableGame.previousWasCorrect !== null && TABLE_VOICE_ENABLED) {
      const timer = setTimeout(() => {
        resetTableRecognition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [tableGame.previousWasCorrect, resetTableRecognition]);

  // Auto-submit for table game when correct answer is typed
  useEffect(() => {
    if (!tableGameActive || tableGame.status !== 'playing' || !tableGame.currentQuestion || !tableGame.userAnswer) return;

    const typedAnswer = parseInt(tableGame.userAnswer, 10);
    if (isNaN(typedAnswer)) return;

    // Check if answer is correct
    if (typedAnswer === tableGame.currentQuestion.answer) {
      // Clear any existing timeout
      if (tableAutoSubmitTimeoutRef.current) {
        clearTimeout(tableAutoSubmitTimeoutRef.current);
      }

      // Set timeout for auto-submit (0.25 seconds)
      tableAutoSubmitTimeoutRef.current = window.setTimeout(() => {
        tableGame.submitAnswer(typedAnswer);
      }, 250);
    }

    return () => {
      if (tableAutoSubmitTimeoutRef.current) {
        clearTimeout(tableAutoSubmitTimeoutRef.current);
      }
    };
  }, [tableGameActive, tableGame.userAnswer, tableGame.currentQuestion, tableGame.status, tableGame.submitAnswer]);

  // Auto-submit when correct answer is typed
  useEffect(() => {
    if (status !== 'playing' || !currentProblem || !userAnswer) return;

    const typedAnswer = parseInt(userAnswer, 10);
    if (isNaN(typedAnswer)) return;

    // Check if answer is correct
    if (typedAnswer === currentProblem.answer) {
      // Clear any existing timeout
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }

      // Set timeout for auto-submit
      autoSubmitTimeoutRef.current = window.setTimeout(() => {
        submitAnswer(typedAnswer);
      }, config.autoSubmitDelay);
    }

    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
    };
  }, [userAnswer, currentProblem, status, submitAnswer]);

  // Handle manual submit
  const handleSubmit = useCallback(() => {
    if (!userAnswer || !currentProblem) return;

    const answer = parseInt(userAnswer, 10);
    if (!isNaN(answer)) {
      // Clear auto-submit timeout
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
      submitAnswer(answer);
    }
  }, [userAnswer, currentProblem, submitAnswer]);

  // Detect if we should show side panels (desktop/iPad)
  const showSidePanels = window.innerWidth >= 768;

  // Handle starting a table game
  const handleStartTableGame = useCallback((levelId: number) => {
    resetTableSubmission();
    setTableGameActive(true);
    setComparisonGameActive(false);
    tableGame.startGame(levelId);
  }, [tableGame, resetTableSubmission]);

  // Handle starting a comparison game
  const handleStartComparisonGame = useCallback((levelId: number) => {
    resetComparisonSubmission();
    setComparisonGameActive(true);
    setTableGameActive(false);
    comparisonGame.startGame(levelId);
  }, [comparisonGame, resetComparisonSubmission]);

  // Handle starting the main math game
  const handleStartMathGame = useCallback(() => {
    resetMathSubmission();
    startGame();
  }, [startGame, resetMathSubmission]);

  // Handle comparison answer
  const handleComparisonAnswer = useCallback((answer: ComparisonResult) => {
    if (comparisonGame.status === 'playing' && comparisonGame.userAnswer === null) {
      comparisonGame.submitAnswer(answer);
    }
  }, [comparisonGame]);

  // Render based on game status
  // When idle and not in any sub-game - show start screen with all sections
  if (status === 'idle' && !tableGameActive && !comparisonGameActive) {
    return (
      <AppLayout ref={containerRef}>
        <SelectionScreen
          title="Math Skills"
          emoji="🔢"
          subtitle="Speed math practice - answer quickly to win!"
          onBack={() => onSwitchMode(null)}
        >
          {/* Regular math levels */}
          <LevelSelect
            levels={levels.map(l => ({
              id: l.id,
              name: l.name,
              description: l.description,
              emoji: l.emoji,
              color: l.color,
              metaItems: [
                { label: '/min', value: l.targetCorrectPerMinute },
                { label: 'to win', value: l.puzzlePieces },
              ],
            } as GenericLevel))}
            currentLevelId={level.id}
            gameMode="math"
            onSelectLevel={(l) => {
              selectLevel(l.id);
              handleStartMathGame();
            }}
            title="Math Practice"
          />

          {/* Times Table Section */}
          <div style={{ marginTop: '24px' }}>
            <LevelSelect
              levels={tableLevels.map(tl => ({
                id: tl.id,
                name: tl.name,
                description: tl.description,
                emoji: tl.emoji,
                color: tl.color,
                metaItems: tl.questionsToWin > 0 ? [
                  { label: '/min', value: tl.targetPerMinute },
                  { label: 'to win', value: tl.questionsToWin },
                ] : [],
              } as GenericLevel))}
              currentLevelId={tableGame.level.id}
              gameMode="tables"
              onSelectLevel={(l) => handleStartTableGame(l.id)}
              title="Times Tables"
            />
          </div>

          {/* Comparison Games Section */}
          <div style={{ marginTop: '24px' }}>
            <LevelSelect
              levels={comparisonLevels.map(cl => ({
                id: cl.id,
                name: cl.name,
                description: cl.description,
                emoji: cl.emoji,
                color: cl.color,
                metaItems: [
                  { label: 'questions', value: cl.questionsToWin },
                ],
              } as GenericLevel))}
              currentLevelId={comparisonGame.level.id}
              gameMode="comparison"
              onSelectLevel={(l) => handleStartComparisonGame(l.id)}
              title="Compare Numbers"
            />
          </div>
        </SelectionScreen>
      </AppLayout>
    );
  }

  // Table game active - render table game UI
  if (tableGameActive) {
    const tableStatus = tableGame.status;

    // Table game win/lose
    if (tableStatus === 'won' || tableStatus === 'lost') {
      return (
        <AppLayout ref={containerRef} className="table-app">
          <WinScreen
            stats={tableGame.stats}
            level={{
              ...tableGame.level,
              puzzlePieces: tableGame.level.questionsToWin,
              targetCorrectPerMinute: tableGame.level.targetPerMinute,
              addition: { min: 0, max: 0 },
              subtraction: { minuendMax: 0 },
              multiplication: { min: 0, max: 12 },
              division: { dividendMax: 144 },
            }}
            timeRemaining={tableGame.timeRemaining}
            isWin={tableStatus === 'won'}
            onPlayAgain={() => handleStartTableGame(tableGame.level.id)}
            onChangeLevel={handleBackFromTable}
          />
        </AppLayout>
      );
    }

    // Table game playing
    return (
      <AppLayout ref={containerRef} className="table-app">
        <PlayingLayout
          gameName="Times Tables"
          gameEmoji="✖️"
          levelName={tableGame.level.name}
          timeRemaining={tableGame.timeRemaining}
          showTimer={true}
          isPaused={tableStatus === 'paused'}
          showVoice={tableVoiceSupported && TABLE_VOICE_ENABLED}
          isListening={tableIsListening}
          transcript={tableTranscript}
          stats={{
            correct: tableGame.stats.correct,
            progress: `${tableGame.questionsCompleted}/${tableGame.level.questionsToWin}`,
            accuracy: tableGame.stats.accuracy,
          }}
          onBack={handleBackFromTable}
          onPause={tableGame.pauseGame}
          sidebarContent={
            <>
              <Stats
                stats={{
                  correct: tableGame.stats.correct,
                  incorrect: tableGame.stats.incorrect,
                  total: tableGame.stats.total,
                  accuracy: tableGame.stats.accuracy,
                  answersPerMinute: tableGame.stats.answersPerMinute || 0,
                  timeElapsed: tableGame.stats.timeElapsed,
                }}
                puzzlePiecesCompleted={tableGame.questionsCompleted}
                puzzlePiecesTotal={tableGame.level.questionsToWin}
                targetPerMinute={tableGame.level.targetPerMinute}
              />

              <CandylandPath
                completed={tableGame.questionsCompleted}
                total={tableGame.level.questionsToWin}
              />
            </>
          }
        >
          {/* Question display */}
          {tableGame.currentQuestion && (
            <div className="table-question-display">
              <span className="table-question-display__text">{tableGame.currentQuestion.displayText}</span>
            </div>
          )}

          {/* Keypad on the left side */}
          <div className="table-keypad-area">
            <Keypad
              value={tableGame.userAnswer}
              onChange={tableGame.handleInput}
              onSubmit={() => {
                const answer = parseInt(tableGame.userAnswer, 10);
                if (!isNaN(answer)) tableGame.submitAnswer(answer);
              }}
              onClear={tableGame.clearInput}
              disabled={tableStatus !== 'playing'}
            />
          </div>

          {/* Multiplication table with feedback in center */}
          <div className="table-area">
            <div className="table-wrapper">
              <MultiplicationTable
                hiddenCells={tableGame.hiddenCells}
                highlightPattern={tableGame.activePattern}
                highlightNumber={tableGame.patternNumber}
                currentQuestion={tableGame.currentQuestion}
              />
              <FeedbackMessage isCorrect={tableGame.previousWasCorrect} show={showFeedback} />
            </div>
          </div>
        </PlayingLayout>

        {tableStatus === 'paused' && (
          <PauseOverlay onResume={tableGame.resumeGame} />
        )}
      </AppLayout>
    );
  }

  // Comparison game active - render comparison game UI
  if (comparisonGameActive) {
    const comparisonStatus = comparisonGame.status;
    const comparisonAnswered = comparisonGame.userAnswer !== null;

    // Comparison game win/lose
    if (comparisonStatus === 'won' || comparisonStatus === 'lost') {
      return (
        <AppLayout ref={containerRef}>
          <WinScreen
            stats={comparisonGame.stats}
            level={{
              ...comparisonGame.level,
              puzzlePieces: comparisonGame.level.questionsToWin,
              targetCorrectPerMinute: comparisonGame.level.targetPerMinute,
              addition: { min: 0, max: 0 },
              subtraction: { minuendMax: 0 },
              multiplication: { min: 0, max: 0 },
              division: { dividendMax: 0 },
            }}
            timeRemaining={comparisonGame.timeRemaining}
            isWin={comparisonStatus === 'won'}
            onPlayAgain={() => handleStartComparisonGame(comparisonGame.level.id)}
            onChangeLevel={handleBackFromComparison}
          />
        </AppLayout>
      );
    }

    // Comparison game playing
    return (
      <AppLayout ref={containerRef} className="comparison-app--playing">
        <PlayingLayout
          gameName="Compare Numbers"
          gameEmoji="⚖️"
          levelName={comparisonGame.level.name}
          timeRemaining={comparisonGame.timeRemaining}
          showTimer={true}
          isPaused={comparisonStatus === 'paused'}
          showVoice={comparisonVoiceSupported && COMPARISON_VOICE_ENABLED}
          isListening={comparisonIsListening}
          transcript={comparisonTranscript}
          stats={{
            correct: comparisonGame.stats.correct,
            progress: `${comparisonGame.questionsCompleted}/${comparisonGame.level.questionsToWin}`,
            streak: comparisonGame.stats.streak,
          }}
          onBack={handleBackFromComparison}
          onPause={comparisonGame.pauseGame}
        >
            {comparisonGame.currentQuestion && (
              <div className="comparison-game">
                {/* Question prompt */}
                <div className="comparison-prompt">
                  <span className="comparison-prompt__text">Which is <strong>bigger</strong>?</span>
                </div>

                {/* Comparison area */}
                <div className="comparison-area">
                  {/* Left value */}
                  <button
                    className={`comparison-card ${
                      comparisonAnswered ? (
                        comparisonGame.currentQuestion.correctAnswer === 'left'
                          ? 'comparison-card--correct'
                          : comparisonGame.userAnswer === 'left'
                            ? 'comparison-card--incorrect'
                            : 'comparison-card--dimmed'
                      ) : ''
                    }`}
                    onClick={() => handleComparisonAnswer('left')}
                    disabled={comparisonAnswered}
                  >
                    <FractionDisplay display={comparisonGame.currentQuestion.left.display} className="comparison-card__value" />
                  </button>

                  {/* Equal button */}
                  <button
                    className={`comparison-equal ${
                      comparisonAnswered ? (
                        comparisonGame.currentQuestion.correctAnswer === 'equal'
                          ? 'comparison-equal--correct'
                          : comparisonGame.userAnswer === 'equal'
                            ? 'comparison-equal--incorrect'
                            : 'comparison-equal--dimmed'
                      ) : ''
                    }`}
                    onClick={() => handleComparisonAnswer('equal')}
                    disabled={comparisonAnswered}
                  >
                    =
                  </button>

                  {/* Right value */}
                  <button
                    className={`comparison-card ${
                      comparisonAnswered ? (
                        comparisonGame.currentQuestion.correctAnswer === 'right'
                          ? 'comparison-card--correct'
                          : comparisonGame.userAnswer === 'right'
                            ? 'comparison-card--incorrect'
                            : 'comparison-card--dimmed'
                      ) : ''
                    }`}
                    onClick={() => handleComparisonAnswer('right')}
                    disabled={comparisonAnswered}
                  >
                    <FractionDisplay display={comparisonGame.currentQuestion.right.display} className="comparison-card__value" />
                  </button>
                </div>

                {/* Feedback message */}
                <FeedbackMessage isCorrect={comparisonGame.previousWasCorrect} show={showFeedback} />

                {/* Hint button */}
                {!comparisonAnswered && !comparisonGame.showHint && (
                  <button className="comparison-hint-btn" onClick={comparisonGame.requestHint}>
                    Need a hint?
                  </button>
                )}

                {/* Hint display */}
                {comparisonGame.showHint && comparisonGame.currentQuestion.hint && (
                  <div className="comparison-hint">
                    <span className="comparison-hint__icon">💡</span>
                    {comparisonGame.currentQuestion.hint}
                  </div>
                )}
              </div>
            )}

            {/* Previous Question Review Section */}
            {comparisonGame.previousQuestion && !comparisonAnswered && (
              <div className="previous-question-review">
                <div className="previous-question-review__header">
                  <span className="previous-question-review__label">
                    {comparisonGame.previousWasCorrect ? '\u2713 Previous (Correct!)' : '\u2717 Previous (Let\'s learn!)'}
                  </span>
                </div>

                <div className="previous-question-review__content">
                  {/* Mini comparison display */}
                  <div className="previous-question-review__comparison">
                    <div className={`previous-question-review__value ${comparisonGame.previousQuestion.correctAnswer === 'left' ? 'previous-question-review__value--winner' : ''}`}>
                      <FractionDisplay display={comparisonGame.previousQuestion.left.display} className="previous-question-review__fraction" />
                      <span className="previous-question-review__decimal">= {comparisonGame.previousQuestion.left.numericValue}</span>
                    </div>

                    <div className="previous-question-review__symbol">
                      {comparisonGame.previousQuestion.correctAnswer === 'equal' ? '=' : comparisonGame.previousQuestion.correctAnswer === 'left' ? '>' : '<'}
                    </div>

                    <div className={`previous-question-review__value ${comparisonGame.previousQuestion.correctAnswer === 'right' ? 'previous-question-review__value--winner' : ''}`}>
                      <FractionDisplay display={comparisonGame.previousQuestion.right.display} className="previous-question-review__fraction" />
                      <span className="previous-question-review__decimal">= {comparisonGame.previousQuestion.right.numericValue}</span>
                    </div>
                  </div>

                  {/* Your answer indicator */}
                  {comparisonGame.previousUserAnswer && !comparisonGame.previousWasCorrect && (
                    <div className="previous-question-review__your-answer">
                      You chose: <strong>{comparisonGame.previousUserAnswer === 'left' ? comparisonGame.previousQuestion.left.display : comparisonGame.previousUserAnswer === 'right' ? comparisonGame.previousQuestion.right.display : 'Equal'}</strong>
                    </div>
                  )}

                  {/* Visualizations */}
                  <div className="previous-question-review__visualizations">
                    {/* Pie chart for values <= 1 */}
                    {(comparisonGame.previousQuestion.left.numericValue <= 1 && comparisonGame.previousQuestion.left.numericValue >= 0) ||
                     (comparisonGame.previousQuestion.right.numericValue <= 1 && comparisonGame.previousQuestion.right.numericValue >= 0) ? (
                      <div className="previous-question-review__viz">
                        <FractionPieChart
                          left={comparisonGame.previousQuestion.left}
                          right={comparisonGame.previousQuestion.right}
                          highlightCorrect
                        />
                      </div>
                    ) : null}

                    {/* Number line if applicable */}
                    {(comparisonGame.previousQuestion.left.visualizable || comparisonGame.previousQuestion.right.visualizable) && (
                      <div className="previous-question-review__viz">
                        <NumberLineVisualization
                          left={comparisonGame.previousQuestion.left}
                          right={comparisonGame.previousQuestion.right}
                          highlightCorrect
                        />
                      </div>
                    )}

                    {/* Fraction bar if applicable */}
                    {(comparisonGame.previousQuestion.left.type === 'fraction' ||
                      comparisonGame.previousQuestion.right.type === 'fraction' ||
                      comparisonGame.previousQuestion.left.type === 'percentage' ||
                      comparisonGame.previousQuestion.right.type === 'percentage') && (
                      <div className="previous-question-review__viz">
                        <FractionBarVisualization
                          left={comparisonGame.previousQuestion.left}
                          right={comparisonGame.previousQuestion.right}
                          highlightCorrect
                        />
                      </div>
                    )}
                  </div>

                  {/* Result summary */}
                  <div className="previous-question-review__result">
                    {comparisonGame.previousQuestion.correctAnswer === 'equal'
                      ? `${comparisonGame.previousQuestion.left.display} and ${comparisonGame.previousQuestion.right.display} are equal!`
                      : comparisonGame.previousQuestion.correctAnswer === 'left'
                        ? `${comparisonGame.previousQuestion.left.display} (${comparisonGame.previousQuestion.left.numericValue}) is bigger than ${comparisonGame.previousQuestion.right.display} (${comparisonGame.previousQuestion.right.numericValue})`
                        : `${comparisonGame.previousQuestion.right.display} (${comparisonGame.previousQuestion.right.numericValue}) is bigger than ${comparisonGame.previousQuestion.left.display} (${comparisonGame.previousQuestion.left.numericValue})`
                    }
                  </div>
                </div>
              </div>
            )}
        </PlayingLayout>

        {/* Pause overlay */}
        {comparisonStatus === 'paused' && (
          <PauseOverlay onResume={comparisonGame.resumeGame} />
        )}
      </AppLayout>
    );
  }

  if (status === 'won' || status === 'lost') {
    return (
      <AppLayout ref={containerRef}>
        <WinScreen
          stats={stats}
          level={level}
          timeRemaining={timeRemaining}
          isWin={status === 'won'}
          onPlayAgain={handleStartMathGame}
          onChangeLevel={handleBackToMenu}
        />
      </AppLayout>
    );
  }

  const isPaused = status === 'paused';

  return (
    <AppLayout ref={containerRef}>
      <PlayingLayout
        gameName="Math Skills"
        gameEmoji="🔢"
        levelName={level.name}
        timeRemaining={timeRemaining}
        showTimer={true}
        isPaused={isPaused}
        showVoice={voiceSupported && config.voiceEnabled}
        isListening={isListening}
        transcript={transcript}
        stats={{
          correct: stats.correct,
          progress: `${puzzlePiecesCompleted}/${level.puzzlePieces}`,
          accuracy: stats.accuracy,
        }}
        onBack={handleBackToMenu}
        onPause={pauseGame}
        sidebarContent={
          <>
            <Stats
              stats={stats}
              puzzlePiecesCompleted={puzzlePiecesCompleted}
              puzzlePiecesTotal={level.puzzlePieces}
              targetPerMinute={level.targetCorrectPerMinute}
            />

            <CandylandPath
              completed={puzzlePiecesCompleted}
              total={level.puzzlePieces}
            />
          </>
        }
      >
        <div style={{ position: 'relative' }}>
          <ProblemDisplay
            currentProblem={currentProblem}
            previousProblem={previousProblem}
            previousWasCorrect={previousWasCorrect}
            nextProblem={nextProblem}
            showSidePanels={showSidePanels}
          />
          <FeedbackMessage isCorrect={previousWasCorrect} show={showFeedback} />
        </div>

        <Keypad
          value={userAnswer}
          onChange={handleInput}
          onSubmit={handleSubmit}
          onClear={clearInput}
          disabled={status !== 'playing'}
        />
      </PlayingLayout>

      {/* Pause Overlay */}
      {isPaused && (
        <PauseOverlay onResume={resumeGame} />
      )}
    </AppLayout>
  );
}
