import { useState, useCallback, useEffect, useRef } from 'react';
import { GameMode } from './config/readingConfig';
import { ModeSelect } from './ModeSelect';
import { MathApp } from './MathApp';
import { ReadingApp } from './ReadingApp';
import { GeographyApp } from './GeographyApp';
import ChartApp from './ChartApp';
import AlgebraApp from './AlgebraApp';
import WordProblemsApp from './WordProblemsApp';
import { ArcadeApp } from './ArcadeApp';
import './App.css';

function LegacyApp() {
  const [currentMode, setCurrentMode] = useState<GameMode | null>(null);
  const isInitializedRef = useRef(false);

  // Manage browser history at the app level
  useEffect(() => {
    if (!isInitializedRef.current) {
      // On mount, set initial state
      window.history.replaceState({ mode: null }, '');
      isInitializedRef.current = true;
      return;
    }

    // Push state when mode changes to a non-null value
    if (currentMode !== null) {
      window.history.pushState({ mode: currentMode }, '');
    }
  }, [currentMode]);

  // Handle browser back button at app level
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If we're going back to null (home), set mode to null
      if (!event.state || event.state.mode === null) {
        setCurrentMode(null);
      } else if (event.state.mode) {
        setCurrentMode(event.state.mode);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectMode = useCallback((mode: GameMode) => {
    setCurrentMode(mode);
  }, []);

  const handleSwitchMode = useCallback((targetMode?: GameMode | null) => {
    // Guard against event objects being passed (e.g., from onClick handlers)
    // Check if targetMode is a valid GameMode string or null/undefined
    if (targetMode && typeof targetMode === 'object') {
      // Event object was passed, treat as going back to home
      setCurrentMode(null);
      return;
    }

    if (targetMode !== undefined) {
      setCurrentMode(targetMode);
    } else {
      // Going back to home - set mode to null directly
      // The browser history is managed by useEffect and popstate handler
      setCurrentMode(null);
    }
  }, []);

  // Mode selection screen
  if (currentMode === null) {
    return <ModeSelect onSelectMode={handleSelectMode} />;
  }

  // Math mode
  if (currentMode === 'math') {
    return <MathApp onSwitchMode={handleSwitchMode} />;
  }

  // Reading mode
  if (currentMode === 'reading') {
    return <ReadingApp onSwitchMode={handleSwitchMode} />;
  }

  // Geography mode
  if (currentMode === 'geography') {
    return <GeographyApp onSwitchMode={handleSwitchMode} />;
  }

  // Charts mode
  if (currentMode === 'charts') {
    return <ChartApp onBack={handleSwitchMode} />;
  }

  // Arcade mode
  if (currentMode === 'arcade') {
    return <ArcadeApp onSwitchMode={handleSwitchMode} />;
  }

  // Algebra mode
  if (currentMode === 'algebra') {
    return <AlgebraApp onSwitchMode={handleSwitchMode} />;
  }

  // Word Problems mode
  if (currentMode === 'wordProblems') {
    return <WordProblemsApp onSwitchMode={handleSwitchMode} />;
  }

  return null;
}

export default LegacyApp;
