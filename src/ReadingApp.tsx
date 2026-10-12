import { useEffect, useRef, useCallback, useState } from 'react';
import { useReadingGameState } from './hooks/useReadingGameState';
import { useReadingVoiceRecognition } from './hooks/useReadingVoiceRecognition';
import { useProgressTracking } from './hooks/useProgressTracking';
import { useAppNavigation } from './hooks/useAppNavigation';
import { readingConfig } from './config/readingConfig';
import { WinScreen } from './components/WinScreen';
import { WordDisplay } from './components/WordDisplay';
import { ReadingControls } from './components/ReadingControls';
import { Stats } from './components/Stats';
import { CandylandPath } from './components/CandylandPath';
import { FeedbackMessage } from './components/FeedbackMessage';
import { LevelSelect, GenericLevel } from './components/LevelSelect';
import { AppLayout, SelectionScreen, PlayingLayout, PauseOverlay } from './components/AppLayout';
import './App.css';
import './ReadingApp.css';

import { GameMode } from './config/readingConfig';

interface ReadingAppProps {
  onSwitchMode: (targetMode?: GameMode | null) => void;
}

export function ReadingApp({ onSwitchMode }: ReadingAppProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVoiceIndicator, setShowVoiceIndicator] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    status,
    level,
    currentWord,
    previousWord,
    previousWasCorrect,
    nextWord,
    timeRemaining,
    stats,
    wordsCompleted,
    showingHint,
    isSkipping,
    wrongAttempts,
    levels,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    submitAnswer,
    hearWord,
    skipWord,
    recordWrongAttempt,
    checkWordMatch,
  } = useReadingGameState();

  // Determine navigation state for browser history
  const navState = status === 'idle' ? null : 'playing';

  // Handle browser back button
  useAppNavigation({
    state: navState,
    onBack: () => {
      if (status !== 'idle') {
        resetGame();
      } else {
        onSwitchMode(null);
      }
    },
  });

  // Progress tracking
  const { submitOnGameEnd, resetSubmission } = useProgressTracking({
    gameMode: 'reading',
    levelId: level.id,
    levelName: level.name,
  });

  // Submit score when game ends
  useEffect(() => {
    if (status === 'won' || status === 'lost') {
      submitOnGameEnd(status, {
        correct: stats.correct,
        total: stats.total,
        accuracy: stats.accuracy,
        bestStreak: 0,
      }, stats.timeElapsed);
    }
  }, [status, stats, submitOnGameEnd]);

  // Reset submission tracking when starting new game
  const handleStartGame = useCallback((levelId?: number) => {
    resetSubmission();
    startGame(levelId);
  }, [startGame, resetSubmission]);

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

  // Handle correct word detection from voice
  const handleCorrectWord = useCallback(
    (word: string, _transcript: string) => {
      if (status !== 'playing' || !currentWord || isSkipping) return;
      if (!checkWordMatch(word, currentWord)) return;
      setShowVoiceIndicator(true);
      setTimeout(() => setShowVoiceIndicator(false), 500);
      submitAnswer(word);
    },
    [status, currentWord, isSkipping, submitAnswer, checkWordMatch]
  );

  // Handle wrong attempts from voice
  const handleWrongAttempt = useCallback(
    (_spokenWord: string) => {
      if (status !== 'playing' || !currentWord || isSkipping) return;
      recordWrongAttempt();
    },
    [status, currentWord, isSkipping, recordWrongAttempt]
  );

  const {
    isListening,
    isSupported: voiceSupported,
    transcript,
    startListening,
    stopListening,
    resetRecognition,
  } = useReadingVoiceRecognition({
    onCorrectWord: handleCorrectWord,
    onWrongAttempt: handleWrongAttempt,
    expectedWord: currentWord,
    enabled: status === 'playing' && readingConfig.voiceEnabled && !isSkipping,
    childMode: true,
  });

  // Start/stop voice recognition
  useEffect(() => {
    if (status === 'playing' && readingConfig.voiceEnabled && voiceSupported && !isSkipping) {
      startListening();
    } else {
      stopListening();
    }
  }, [status, startListening, stopListening, voiceSupported, isSkipping]);

  // Reset voice after answer
  useEffect(() => {
    if (previousWasCorrect !== null && readingConfig.voiceEnabled) {
      const timer = setTimeout(() => {
        resetRecognition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [previousWasCorrect, resetRecognition]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || (e.key === ' ' && status !== 'idle')) {
        e.preventDefault();
        if (status === 'playing') pauseGame();
        else if (status === 'paused') resumeGame();
      }
      if ((e.key === 'h' || e.key === 'H') && status === 'playing') {
        e.preventDefault();
        hearWord();
      }
      if ((e.key === 's' || e.key === 'S') && status === 'playing' && !isSkipping) {
        e.preventDefault();
        skipWord();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, pauseGame, resumeGame, hearWord, skipWord, isSkipping]);

  const showSidePanels = window.innerWidth >= 768;

  const togglePause = useCallback(() => {
    if (status === 'playing') pauseGame();
    else if (status === 'paused') resumeGame();
  }, [status, pauseGame, resumeGame]);

  const handleBackToMenu = useCallback(() => {
    resetGame();
    onSwitchMode();
  }, [resetGame, onSwitchMode]);

  // Start screen
  if (status === 'idle') {
    return (
      <AppLayout ref={containerRef} variant="selection">
        <SelectionScreen
          title="Reading Skills"
          emoji="📖"
          subtitle="Read words out loud to earn points!"
          onBack={() => onSwitchMode(null)}
        >
          {/* Level Selection */}
          <LevelSelect
            levels={levels.map(l => ({
              id: l.id,
              name: l.name,
              description: l.description,
              emoji: l.emoji,
              color: l.color,
              metaItems: [
                { label: '/min', value: l.targetWordsPerMinute },
                { label: 'to win', value: l.wordsToWin },
              ],
            } as GenericLevel))}
            currentLevelId={level.id}
            gameMode="reading"
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
      <AppLayout ref={containerRef}>
        <WinScreen
          stats={{
            correct: stats.correct,
            incorrect: stats.total - stats.correct,
            total: stats.total,
            accuracy: stats.accuracy,
            answersPerMinute: stats.wordsPerMinute,
            timeElapsed: stats.timeElapsed,
          }}
          level={{
            ...level,
            puzzlePieces: level.wordsToWin,
            targetCorrectPerMinute: level.targetWordsPerMinute,
            addition: { min: 0, max: 0 },
            subtraction: { minuendMax: 0 },
            multiplication: { min: 0, max: 0 },
            division: { dividendMax: 0 },
          }}
          timeRemaining={timeRemaining}
          isWin={status === 'won'}
          onPlayAgain={handleStartGame}
          onChangeLevel={handleBackToMenu}
        />
      </AppLayout>
    );
  }

  const isPaused = status === 'paused';

  return (
    <AppLayout ref={containerRef} variant="playing">
      <PlayingLayout
        gameName="Reading Skills"
        gameEmoji="📖"
        levelName={level.name}
        levelEmoji={level.emoji}
        levelColor={level.color}
        timeRemaining={timeRemaining}
        onBack={handleBackToMenu}
        onPause={togglePause}
        onFullscreen={toggleFullscreen}
        isPaused={isPaused}
        isFullscreen={isFullscreen}
        showVoice={voiceSupported && readingConfig.voiceEnabled}
        isListening={isListening}
        voiceSuccess={showVoiceIndicator}
        transcript={transcript}
        sidebarContent={
          <>
            <Stats
              stats={{
                correct: stats.correct,
                incorrect: stats.total - stats.correct,
                total: stats.total,
                accuracy: stats.accuracy,
                answersPerMinute: stats.wordsPerMinute,
                timeElapsed: stats.timeElapsed,
              }}
              puzzlePiecesCompleted={wordsCompleted}
              puzzlePiecesTotal={level.wordsToWin}
              targetPerMinute={level.targetWordsPerMinute}
            />
            <CandylandPath
              completed={wordsCompleted}
              total={level.wordsToWin}
            />
          </>
        }
      >
        <div style={{ position: 'relative' }}>
          <WordDisplay
            currentWord={currentWord}
            previousWord={previousWord}
            previousWasCorrect={previousWasCorrect}
            nextWord={nextWord}
            showSyllables={level.showSyllables}
            showSidePanels={showSidePanels}
            isSkipping={isSkipping}
          />
          <FeedbackMessage isCorrect={previousWasCorrect} show={showFeedback} />
        </div>

        <ReadingControls
          onHearWord={hearWord}
          onSkip={skipWord}
          disabled={status !== 'playing'}
          isSkipping={isSkipping}
          showingHint={showingHint}
          wrongAttempts={wrongAttempts}
        />
      </PlayingLayout>

      {isPaused && <PauseOverlay onResume={resumeGame} />}
    </AppLayout>
  );
}
