import { useState, useCallback, useEffect, useRef } from 'react';
import { useAlgebraGameState } from './hooks/useAlgebraGameState';
import { useGraphExplorerState } from './hooks/useGraphExplorerState';
import { useProgressTracking } from './hooks/useProgressTracking';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useVoiceRecognition } from './hooks/useVoiceRecognition';
import { AlgebraMode, equationBuilderLevels, mysteryNumberLevels, equationMasterLevels, graphExplorerLevels } from './config/algebraConfig';
import { EquationDisplay } from './components/Algebra/EquationDisplay';
import { BalanceScale } from './components/Algebra/BalanceScale';
import { CoordinatePlot } from './components/Algebra/CoordinatePlot';
import { Stats } from './components/Stats/Stats';
import { Keypad } from './components/Keypad/Keypad';
import { FeedbackMessage } from './components/FeedbackMessage/FeedbackMessage';
import { WinScreen } from './components/WinScreen/WinScreen';
import { LevelSelect, GenericLevel } from './components/LevelSelect/LevelSelect';
import { CandylandPath } from './components/CandylandPath';
import { AppLayout, SelectionScreen, PlayingLayout, PauseOverlay } from './components/AppLayout';
import './AlgebraApp.css';

interface AlgebraAppProps {
  onSwitchMode: () => void;
}

type ActiveGame = 'none' | 'algebra' | 'graph';

// Voice recognition enabled for algebra games
const ALGEBRA_VOICE_ENABLED = true;
const GRAPH_VOICE_ENABLED = true;

export default function AlgebraApp({ onSwitchMode }: AlgebraAppProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [activeGame, setActiveGame] = useState<ActiveGame>('none');
  const [algebraMode, setAlgebraMode] = useState<AlgebraMode>('equations');
  const containerRef = useRef<HTMLDivElement>(null);

  // Algebra game state
  const algebra = useAlgebraGameState();

  // Graph game state
  const graph = useGraphExplorerState();

  // Determine navigation state for browser history
  const navState = activeGame === 'none' ? null : activeGame;

  // Handle browser back button
  useAppNavigation({
    state: navState,
    onBack: () => {
      if (activeGame !== 'none') {
        handleBackToLevels();
      } else {
        onSwitchMode();
      }
    },
  });

  // Progress tracking for algebra
  const { submitOnGameEnd: submitAlgebraProgress, resetSubmission: resetAlgebraSubmission } = useProgressTracking({
    gameMode: 'algebra',
    levelId: algebra.level.id,
    levelName: algebra.level.name,
  });

  // Progress tracking for graphs
  const { submitOnGameEnd: submitGraphProgress, resetSubmission: resetGraphSubmission } = useProgressTracking({
    gameMode: 'graphExplorer',
    levelId: graph.level.id,
    levelName: graph.level.name,
  });

  // Submit progress when algebra game ends
  useEffect(() => {
    if (activeGame === 'algebra' && (algebra.status === 'won' || algebra.status === 'lost')) {
      submitAlgebraProgress(algebra.status, {
        correct: algebra.stats.correct,
        total: algebra.stats.total,
        accuracy: algebra.stats.accuracy,
        bestStreak: 0,
      }, algebra.stats.timeElapsed);
    }
  }, [activeGame, algebra.status, algebra.stats, submitAlgebraProgress]);

  // Submit progress when graph game ends
  useEffect(() => {
    if (activeGame === 'graph' && (graph.status === 'won' || graph.status === 'lost')) {
      submitGraphProgress(graph.status, {
        correct: graph.stats.correct,
        total: graph.stats.total,
        accuracy: graph.stats.accuracy,
        bestStreak: 0,
      }, graph.stats.timeElapsed);
    }
  }, [activeGame, graph.status, graph.stats, submitGraphProgress]);

  // Voice recognition for algebra games
  const handleAlgebraVoiceResult = useCallback(
    (number: number) => {
      if (algebra.status !== 'playing' || !algebra.currentProblem) return;
      if (number === algebra.currentProblem.answer) {
        algebra.submitAnswer(number);
      }
    },
    [algebra]
  );

  const handleAlgebraAnswerDetected = useCallback(
    (answer: number, _transcript: string) => {
      if (algebra.status !== 'playing' || !algebra.currentProblem) return;
      algebra.submitAnswer(answer);
    },
    [algebra]
  );

  const {
    isListening: algebraIsListening,
    isSupported: algebraVoiceSupported,
    transcript: algebraTranscript,
    startListening: startAlgebraListening,
    stopListening: stopAlgebraListening,
    resetRecognition: resetAlgebraRecognition,
  } = useVoiceRecognition({
    continuous: true,
    onResult: handleAlgebraVoiceResult,
    onAnswerDetected: handleAlgebraAnswerDetected,
    expectedAnswer: algebra.currentProblem?.answer ?? null,
    enabled: activeGame === 'algebra' && algebra.status === 'playing' && ALGEBRA_VOICE_ENABLED,
    childMode: true,
  });

  // Voice recognition for graph games
  const handleGraphVoiceResult = useCallback(
    (number: number) => {
      if (graph.status !== 'playing' || !graph.currentProblem) return;
      // For number input type questions
      if (!graph.currentProblem.options && number === graph.currentProblem.answer) {
        graph.handleInput(String(number));
        setTimeout(() => graph.submitTypedAnswer(), 100);
      }
    },
    [graph]
  );

  const handleGraphAnswerDetected = useCallback(
    (answer: number, _transcript: string) => {
      if (graph.status !== 'playing' || !graph.currentProblem) return;
      // For number input type questions
      if (!graph.currentProblem.options) {
        graph.handleInput(String(answer));
        setTimeout(() => graph.submitTypedAnswer(), 100);
      }
    },
    [graph]
  );

  // Get expected numeric answer for graph voice recognition (only for numeric answers)
  const graphExpectedNumericAnswer = (() => {
    const answer = graph.currentProblem?.answer;
    if (typeof answer === 'number') return answer;
    return null;
  })();

  const {
    isListening: graphIsListening,
    isSupported: graphVoiceSupported,
    transcript: graphTranscript,
    startListening: startGraphListening,
    stopListening: stopGraphListening,
    resetRecognition: resetGraphRecognition,
  } = useVoiceRecognition({
    continuous: true,
    onResult: handleGraphVoiceResult,
    onAnswerDetected: handleGraphAnswerDetected,
    expectedAnswer: graphExpectedNumericAnswer,
    enabled: activeGame === 'graph' && graph.status === 'playing' && GRAPH_VOICE_ENABLED && !graph.currentProblem?.options && graphExpectedNumericAnswer !== null,
    childMode: true,
  });

  // Start/stop algebra voice recognition based on game status
  useEffect(() => {
    if (activeGame === 'algebra' && algebra.status === 'playing' && ALGEBRA_VOICE_ENABLED && algebraVoiceSupported) {
      startAlgebraListening();
    } else {
      stopAlgebraListening();
    }
  }, [activeGame, algebra.status, startAlgebraListening, stopAlgebraListening, algebraVoiceSupported]);

  // Reset algebra voice recognition after each answer
  useEffect(() => {
    if (algebra.previousWasCorrect !== null && ALGEBRA_VOICE_ENABLED) {
      const timer = setTimeout(() => {
        resetAlgebraRecognition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [algebra.previousWasCorrect, resetAlgebraRecognition]);

  // Start/stop graph voice recognition based on game status
  useEffect(() => {
    if (activeGame === 'graph' && graph.status === 'playing' && GRAPH_VOICE_ENABLED && graphVoiceSupported && !graph.currentProblem?.options) {
      startGraphListening();
    } else {
      stopGraphListening();
    }
  }, [activeGame, graph.status, graph.currentProblem?.options, startGraphListening, stopGraphListening, graphVoiceSupported]);

  // Reset graph voice recognition after each answer
  useEffect(() => {
    if (graph.previousWasCorrect !== null && GRAPH_VOICE_ENABLED) {
      const timer = setTimeout(() => {
        resetGraphRecognition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [graph.previousWasCorrect, resetGraphRecognition]);

  // Show feedback when answer is submitted
  useEffect(() => {
    const wasCorrect = activeGame === 'graph' ? graph.previousWasCorrect : algebra.previousWasCorrect;
    if (wasCorrect !== null) {
      setShowFeedback(true);
      const timer = setTimeout(() => setShowFeedback(false), 800);
      return () => clearTimeout(timer);
    }
  }, [activeGame, algebra.previousWasCorrect, graph.previousWasCorrect]);

  // Auto-submit correct answers for algebra (0.25s delay)
  useEffect(() => {
    if (activeGame !== 'algebra' || !algebra.userAnswer || !algebra.currentProblem || algebra.status !== 'playing') return;

    const numAnswer = parseInt(algebra.userAnswer, 10);
    if (!isNaN(numAnswer) && numAnswer === algebra.currentProblem.answer) {
      const timer = setTimeout(() => {
        algebra.submitAnswer(numAnswer);
      }, 250); // 0.25 second auto-submit
      return () => clearTimeout(timer);
    }
  }, [activeGame, algebra]);

  // Keyboard support for submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (activeGame === 'algebra' && algebra.userAnswer && algebra.status === 'playing') {
          const numAnswer = parseInt(algebra.userAnswer, 10);
          if (!isNaN(numAnswer)) {
            algebra.submitAnswer(numAnswer);
          }
        } else if (activeGame === 'graph' && graph.userAnswer && graph.status === 'playing') {
          graph.submitTypedAnswer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGame, algebra, graph]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  // Handle starting an algebra level
  const handleStartAlgebraLevel = useCallback((levelId: number, mode: AlgebraMode) => {
    resetAlgebraSubmission();
    setAlgebraMode(mode);
    algebra.changeMode(mode);
    algebra.selectLevel(levelId);
    algebra.startGame(levelId);
    setActiveGame('algebra');
  }, [algebra, resetAlgebraSubmission]);

  // Handle starting a graph level
  const handleStartGraphLevel = useCallback((levelId: number) => {
    resetGraphSubmission();
    graph.selectLevel(levelId);
    graph.startGame(levelId);
    setActiveGame('graph');
  }, [graph, resetGraphSubmission]);

  // Handle going back to level select
  const handleBackToLevels = useCallback(() => {
    if (activeGame === 'algebra') {
      algebra.resetGame();
    } else if (activeGame === 'graph') {
      graph.resetGame();
    }
    setActiveGame('none');
  }, [activeGame, algebra, graph]);

  // Handle play again
  const handlePlayAgain = useCallback(() => {
    if (activeGame === 'algebra') {
      algebra.startGame(algebra.level.id);
    } else if (activeGame === 'graph') {
      graph.startGame(graph.level.id);
    }
  }, [activeGame, algebra, graph]);

  // Handle manual submit for algebra
  const handleAlgebraSubmit = () => {
    if (algebra.userAnswer) {
      const numAnswer = parseInt(algebra.userAnswer, 10);
      if (!isNaN(numAnswer)) {
        algebra.submitAnswer(numAnswer);
      }
    }
  };

  // Level select screen (idle state)
  if (activeGame === 'none') {
    return (
      <AppLayout ref={containerRef} variant="selection">
        <SelectionScreen
          title="Algebra Adventures"
          emoji="🧮"
          subtitle="Master equations and explore linear graphs!"
          onBack={onSwitchMode}
        >
          {/* Equation Builder levels */}
          <LevelSelect
            levels={equationBuilderLevels.map(l => ({
              id: l.id,
              name: l.name,
              description: l.description,
              emoji: l.emoji,
              color: l.color,
              metaItems: [
                { label: 'Questions', value: l.questionsToWin },
                { label: 'Time', value: `${Math.floor(l.timerDuration / 60)}m` },
              ],
            } as GenericLevel))}
            currentLevelId={algebraMode === 'equations' ? algebra.level.id : 0}
            gameMode="algebra"
            onSelectLevel={(l) => handleStartAlgebraLevel(l.id, 'equations')}
            title="Equation Builder"
          />

          {/* Mystery Number levels */}
          <div style={{ marginTop: '16px' }}>
            <LevelSelect
              levels={mysteryNumberLevels.map(l => ({
                id: l.id,
                name: l.name,
                description: l.description,
                emoji: l.emoji,
                color: l.color,
                metaItems: [
                  { label: 'Questions', value: l.questionsToWin },
                  { label: 'Time', value: `${Math.floor(l.timerDuration / 60)}m` },
                ],
              } as GenericLevel))}
              currentLevelId={algebraMode === 'solveForX' ? algebra.level.id : 0}
              gameMode="algebra"
              onSelectLevel={(l) => handleStartAlgebraLevel(l.id, 'solveForX')}
              title="Mystery Number"
            />
          </div>

          {/* Equation Master levels */}
          <div style={{ marginTop: '16px' }}>
            <LevelSelect
              levels={equationMasterLevels.map(l => ({
                id: l.id,
                name: l.name,
                description: l.description,
                emoji: l.emoji,
                color: l.color,
                metaItems: [
                  { label: 'Questions', value: l.questionsToWin },
                  { label: 'Time', value: `${Math.floor(l.timerDuration / 60)}m` },
                ],
              } as GenericLevel))}
              currentLevelId={algebraMode === 'advanced' ? algebra.level.id : 0}
              gameMode="algebra"
              onSelectLevel={(l) => handleStartAlgebraLevel(l.id, 'advanced')}
              title="Equation Master"
            />
          </div>

          {/* Graph Explorer levels */}
          <div style={{ marginTop: '16px' }}>
            <LevelSelect
              levels={graphExplorerLevels.map(l => ({
                id: l.id,
                name: l.name,
                description: l.description,
                emoji: l.emoji,
                color: l.color,
                metaItems: [
                  { label: 'Questions', value: l.questionsToWin },
                  { label: 'Time', value: `${Math.floor(l.timerDuration / 60)}m` },
                ],
              } as GenericLevel))}
              currentLevelId={graph.level.id}
              gameMode="graphExplorer"
              onSelectLevel={(l) => handleStartGraphLevel(l.id)}
              title="Graph Explorer"
            />
          </div>
        </SelectionScreen>
      </AppLayout>
    );
  }

  // Active algebra game
  if (activeGame === 'algebra') {
    const { status, level, currentProblem, timeRemaining, stats, questionsCompleted, userAnswer, mode, showSteps } = algebra;

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
        <AppLayout ref={containerRef}>
          <WinScreen
            stats={gameStats}
            level={{
              ...level,
              puzzlePieces: level.questionsToWin,
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

    const isPaused = status === 'paused';

    // Playing view
    return (
      <AppLayout ref={containerRef} variant="playing">
        <PlayingLayout
          gameName="Algebra"
          gameEmoji="🧮"
          levelName={level.name}
          levelEmoji={level.emoji}
          levelColor={level.color}
          timeRemaining={timeRemaining}
          onBack={handleBackToLevels}
          onPause={algebra.pauseGame}
          onFullscreen={toggleFullscreen}
          isPaused={isPaused}
          isFullscreen={isFullscreen}
          showVoice={algebraVoiceSupported && ALGEBRA_VOICE_ENABLED}
          isListening={algebraIsListening}
          transcript={algebraTranscript}
          stats={{
            correct: stats.correct,
            progress: `${questionsCompleted}/${level.questionsToWin}`,
            accuracy: stats.accuracy,
          }}
          sidebarContent={
            <>
              <Stats
                stats={{
                  correct: stats.correct,
                  incorrect: stats.incorrect,
                  total: stats.total,
                  accuracy: stats.accuracy,
                  answersPerMinute: stats.answersPerMinute,
                  timeElapsed: stats.timeElapsed,
                }}
                puzzlePiecesCompleted={questionsCompleted}
                puzzlePiecesTotal={level.questionsToWin}
                targetPerMinute={5}
              />
              <CandylandPath
                completed={questionsCompleted}
                total={level.questionsToWin}
              />
            </>
          }
        >
          <div className="algebra-game-content">
            {currentProblem && (
              <div className="algebra-problem-section">
                <EquationDisplay
                  parts={currentProblem.displayParts}
                  size="large"
                  showAnimation={true}
                />

                {/* Show balance scale for solve-for-x problems */}
                {(mode === 'solveForX' || mode === 'advanced') && currentProblem.visualData && (
                  <BalanceScale
                    leftValue={currentProblem.visualData.leftSide}
                    rightValue={currentProblem.visualData.rightSide}
                    showSymbols={true}
                  />
                )}

                {/* Solution steps (togglable) */}
                {currentProblem.steps && currentProblem.steps.length > 0 && (
                  <div className="steps-section">
                    <button className="steps-toggle" onClick={algebra.toggleSteps}>
                      {showSteps ? 'Hide Steps' : 'Show Steps'}
                    </button>
                    {showSteps && (
                      <div className="solution-steps">
                        {currentProblem.steps.map((step, i) => (
                          <div key={i} className="solution-step">
                            <span className="solution-step__number">{i + 1}</span>
                            <div className="solution-step__content">
                              <div className="solution-step__description">{step.description}</div>
                              <div className="solution-step__equation">{step.equation}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <FeedbackMessage isCorrect={algebra.previousWasCorrect} show={showFeedback} />
              </div>
            )}

            <div className="algebra-input-section">
              <div className="answer-display">
                <span className="answer-label">Your Answer:</span>
                <span className="answer-value">{userAnswer || '_'}</span>
              </div>

              <Keypad
                value={userAnswer}
                onChange={algebra.handleInput}
                onSubmit={handleAlgebraSubmit}
                onClear={algebra.clearInput}
                disabled={status !== 'playing'}
              />
            </div>
          </div>
        </PlayingLayout>

        {isPaused && <PauseOverlay onResume={algebra.resumeGame} />}
      </AppLayout>
    );
  }

  // Active graph game
  if (activeGame === 'graph') {
    const { status, level, currentProblem, timeRemaining, stats, questionsCompleted, selectedAnswer, userAnswer } = graph;

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
        <AppLayout ref={containerRef}>
          <WinScreen
            stats={gameStats}
            level={{
              ...level,
              puzzlePieces: level.questionsToWin,
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

    const isPaused = status === 'paused';
    const isMultipleChoice = currentProblem?.options && currentProblem.options.length > 0;

    // Playing view
    return (
      <AppLayout ref={containerRef} variant="playing">
        <PlayingLayout
          gameName="Graph Explorer"
          gameEmoji="📈"
          levelName={level.name}
          levelEmoji={level.emoji}
          levelColor={level.color}
          timeRemaining={timeRemaining}
          onBack={handleBackToLevels}
          onPause={graph.pauseGame}
          onFullscreen={toggleFullscreen}
          isPaused={isPaused}
          isFullscreen={isFullscreen}
          showVoice={graphVoiceSupported && GRAPH_VOICE_ENABLED && !isMultipleChoice}
          isListening={graphIsListening}
          transcript={graphTranscript}
          stats={{
            correct: stats.correct,
            progress: `${questionsCompleted}/${level.questionsToWin}`,
            accuracy: stats.accuracy,
          }}
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
                puzzlePiecesCompleted={questionsCompleted}
                puzzlePiecesTotal={level.questionsToWin}
                targetPerMinute={5}
              />
              <CandylandPath
                completed={questionsCompleted}
                total={level.questionsToWin}
              />
            </>
          }
          className="graph-playing"
        >
          <div className="graph-game-layout">
            <div className="graph-area">
              {currentProblem && (
                <CoordinatePlot
                  slope={currentProblem.slope}
                  yIntercept={currentProblem.yIntercept}
                  width={340}
                  height={340}
                  gridSize={10}
                  showEquation={true}
                  highlightX={currentProblem.xValue}
                  highlightY={currentProblem.yValue}
                  animate={true}
                  compareLine={currentProblem.compareSlope !== undefined ? {
                    slope: currentProblem.compareSlope,
                    yIntercept: currentProblem.yIntercept,
                  } : undefined}
                />
              )}
            </div>

            <div className="question-area">
              {currentProblem && (
                <div className="graph-question">
                  <p className="graph-question__text">{currentProblem.questionText}</p>

                  {isMultipleChoice ? (
                    <div className="graph-question__options">
                      {currentProblem.options?.map((option, i) => {
                        let optionClass = 'graph-question__option';
                        if (selectedAnswer === option) {
                          optionClass += graph.previousWasCorrect
                            ? ' graph-question__option--correct'
                            : ' graph-question__option--incorrect';
                        }
                        return (
                          <button
                            key={i}
                            className={optionClass}
                            onClick={() => graph.selectOption(option)}
                            disabled={selectedAnswer !== null}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="graph-input">
                      <div className="answer-display">
                        <span className="answer-label">Answer:</span>
                        <span className="answer-value">{userAnswer || '_'}</span>
                      </div>
                      <Keypad
                        value={userAnswer}
                        onChange={graph.handleInput}
                        onSubmit={graph.submitTypedAnswer}
                        onClear={() => graph.handleInput('')}
                        disabled={status !== 'playing'}
                      />
                    </div>
                  )}
                </div>
              )}

              <FeedbackMessage isCorrect={graph.previousWasCorrect} show={showFeedback} />
            </div>
          </div>
        </PlayingLayout>

        {isPaused && <PauseOverlay onResume={graph.resumeGame} />}
      </AppLayout>
    );
  }

  return null;
}
