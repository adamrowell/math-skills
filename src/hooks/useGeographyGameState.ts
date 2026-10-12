import { useState, useEffect, useCallback, useRef } from 'react';
import { geographyLevels, GeographyLevelConfig, geographyConfig, GeographyGameMode } from '../config/geographyConfig';
import { USStateData, getRandomState } from '../data/geography/usStates';
import { CountryData, getRandomCountry } from '../data/geography/countries';
import { BodyOfWaterData, getRandomBodyOfWater } from '../data/geography/bodiesOfWater';
import { LandmarkData, getRandomLandmark } from '../data/geography/landmarks';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

// Union type for all location types
export type GeographyItem = USStateData | CountryData | BodyOfWaterData | LandmarkData;

export interface GeographyGameStats {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  itemsPerMinute: number;
  timeElapsed: number;
  streak: number;
  bestStreak: number;
  score: number;
}

export interface GeographyGameState {
  status: GameStatus;
  level: GeographyLevelConfig;
  levels: GeographyLevelConfig[];
  currentItem: GeographyItem | null;
  previousItem: GeographyItem | null;
  previousWasCorrect: boolean | null;
  nextItem: GeographyItem | null;
  timeRemaining: number;
  stats: GeographyGameStats;
  itemsCompleted: number;
  currentGameMode: GeographyGameMode; // 'say', 'click', or 'combined'
  isClickMode: boolean; // current turn is click mode (for combined)
  showingHint: boolean;
  usedItems: string[]; // IDs of items already shown
  multipleChoiceMode: boolean; // Show 3 options instead of all
  decoyItems: GeographyItem[]; // 2 decoy items when in multiple choice mode
}

export function useGeographyGameState() {
  const [status, setStatus] = useState<GameStatus>('idle');
  const [level, setLevel] = useState<GeographyLevelConfig>(geographyLevels[0]);
  const [currentItem, setCurrentItem] = useState<GeographyItem | null>(null);
  const [previousItem, setPreviousItem] = useState<GeographyItem | null>(null);
  const [previousWasCorrect, setPreviousWasCorrect] = useState<boolean | null>(null);
  const [nextItem, setNextItem] = useState<GeographyItem | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(geographyConfig.timerDuration);
  const [itemsCompleted, setItemsCompleted] = useState(0);
  const [showingHint, setShowingHint] = useState(false);
  const [usedItems, setUsedItems] = useState<string[]>([]);
  const [isClickMode, setIsClickMode] = useState(true);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [lastWrongClick, setLastWrongClick] = useState<string | null>(null);
  const maxWrongAttempts = 3; // Give 3 chances before moving on
  const [multipleChoiceMode, setMultipleChoiceMode] = useState(false);
  const [decoyItems, setDecoyItems] = useState<GeographyItem[]>([]);
  const [stats, setStats] = useState<GeographyGameStats>({
    correct: 0,
    incorrect: 0,
    total: 0,
    accuracy: 0,
    itemsPerMinute: 0,
    timeElapsed: 0,
    streak: 0,
    bestStreak: 0,
    score: 0,
  });

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastAnswerTimeRef = useRef<number>(0);

  // Get item based on level category
  const getItemForLevel = useCallback((levelConfig: GeographyLevelConfig, exclude: string[] = []): GeographyItem => {
    switch (levelConfig.category) {
      case 'us-states':
      case 'us-state-capitals': // Same data, just displayed differently
        return getRandomState(exclude);
      case 'countries-africa':
        return getRandomCountry('Africa', exclude);
      case 'countries-asia':
        return getRandomCountry('Asia', exclude);
      case 'countries-europe':
        return getRandomCountry('Europe', exclude);
      case 'countries-north-america':
        return getRandomCountry('North America', exclude);
      case 'countries-south-america':
        return getRandomCountry('South America', exclude);
      case 'countries-oceania':
        return getRandomCountry('Oceania', exclude);
      case 'oceans':
        return getRandomBodyOfWater(undefined, exclude);
      case 'landmarks':
        return getRandomLandmark(undefined, exclude);
      default:
        return getRandomState(exclude);
    }
  }, []);

  // Get item ID for tracking used items
  const getItemId = (item: GeographyItem): string => {
    if ('abbreviation' in item) return (item as USStateData).abbreviation;
    if ('countryCode' in item) return (item as CountryData | LandmarkData).id;
    return item.id;
  };

  // Generate 2 decoy items for multiple choice mode
  const generateDecoys = useCallback((correctItem: GeographyItem, levelConfig: GeographyLevelConfig): GeographyItem[] => {
    const correctId = getItemId(correctItem);
    const decoys: GeographyItem[] = [];
    const usedIds = [correctId];

    // Generate 2 unique decoys
    for (let i = 0; i < 2; i++) {
      const decoy = getItemForLevel(levelConfig, usedIds);
      decoys.push(decoy);
      usedIds.push(getItemId(decoy));
    }

    return decoys;
  }, [getItemForLevel]);

  // Toggle multiple choice mode
  const toggleMultipleChoiceMode = useCallback(() => {
    setMultipleChoiceMode(prev => {
      const newMode = !prev;
      // If turning ON and we have a current item, generate decoys immediately
      if (newMode && currentItem) {
        setDecoyItems(generateDecoys(currentItem, level));
      } else if (!newMode) {
        // If turning OFF, clear decoys
        setDecoyItems([]);
      }
      return newMode;
    });
  }, [currentItem, level, generateDecoys]);

  // Generate new item
  const generateNewItem = useCallback((exclude: string[] = []) => {
    return getItemForLevel(level, exclude);
  }, [level, getItemForLevel]);

  // Select level
  const selectLevel = useCallback((levelId: number) => {
    const newLevel = geographyLevels.find(l => l.id === levelId);
    if (newLevel) {
      setLevel(newLevel);
    }
  }, []);

  // Start game - accepts optional levelId to avoid stale closure issues
  // When called from level selection, pass the levelId to ensure correct level is used
  const startGame = useCallback((levelId?: number) => {
    // Determine which level to use - if levelId provided, find it directly
    // This avoids stale closure issues when level state hasn't updated yet
    let gameLevel = level;
    if (levelId !== undefined) {
      const foundLevel = geographyLevels.find(l => l.id === levelId);
      if (foundLevel) {
        gameLevel = foundLevel;
        setLevel(foundLevel); // Also update state for consistency
      }
    }

    const firstItem = getItemForLevel(gameLevel);
    const secondItem = getItemForLevel(gameLevel, [getItemId(firstItem)]);

    setCurrentItem(firstItem);
    setNextItem(secondItem);
    setPreviousItem(null);
    setPreviousWasCorrect(null);
    setUsedItems([getItemId(firstItem), getItemId(secondItem)]);
    setItemsCompleted(0);
    setTimeRemaining(geographyConfig.timerDuration);
    setShowingHint(false);
    setIsClickMode(gameLevel.gameMode === 'click' || (gameLevel.gameMode === 'combined' && Math.random() > 0.5));
    setWrongAttempts(0);
    setLastWrongClick(null);
    setShowCorrectAnswer(false);
    // Generate decoys for multiple choice mode
    if (multipleChoiceMode) {
      setDecoyItems(generateDecoys(firstItem, gameLevel));
    } else {
      setDecoyItems([]);
    }
    setStats({
      correct: 0,
      incorrect: 0,
      total: 0,
      accuracy: 0,
      itemsPerMinute: 0,
      timeElapsed: 0,
      streak: 0,
      bestStreak: 0,
      score: 0,
    });
    startTimeRef.current = Date.now();
    lastAnswerTimeRef.current = Date.now();
    setStatus('playing');
  }, [level, getItemForLevel]);

  // Pause game
  const pauseGame = useCallback(() => {
    setStatus('paused');
  }, []);

  // Resume game
  const resumeGame = useCallback(() => {
    setStatus('playing');
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    setStatus('idle');
    setCurrentItem(null);
    setPreviousItem(null);
    setPreviousWasCorrect(null);
    setNextItem(null);
    setItemsCompleted(0);
    setUsedItems([]);
    setTimeRemaining(geographyConfig.timerDuration);
    setShowingHint(false);
    setShowCorrectAnswer(false);
    setWrongAttempts(0);
    setLastWrongClick(null);
    setStats({
      correct: 0,
      incorrect: 0,
      total: 0,
      accuracy: 0,
      itemsPerMinute: 0,
      timeElapsed: 0,
      streak: 0,
      bestStreak: 0,
      score: 0,
    });
  }, []);

  // State to show correct answer after max wrong attempts
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  // Submit answer (for both click and voice modes)
  const submitAnswer = useCallback((correct: boolean, forceAdvance = false) => {
    if (status !== 'playing' || !currentItem) return;

    const now = Date.now();
    const answerTime = now - lastAnswerTimeRef.current;
    lastAnswerTimeRef.current = now;

    const timeElapsed = (now - startTimeRef.current) / 1000;

    // Calculate score
    let pointsEarned = 0;
    let newStreak = stats.streak;
    let newBestStreak = stats.bestStreak;

    if (correct) {
      pointsEarned = geographyConfig.basePoints;

      // Speed bonus
      if (answerTime < geographyConfig.speedBonusThreshold) {
        pointsEarned += geographyConfig.speedBonusPoints;
      }

      // Streak bonus
      newStreak = stats.streak + 1;
      pointsEarned += newStreak * geographyConfig.streakBonusPoints;

      if (newStreak > newBestStreak) {
        newBestStreak = newStreak;
      }
    } else {
      newStreak = 0;
    }

    const newCorrect = correct ? stats.correct + 1 : stats.correct;
    const newIncorrect = correct ? stats.incorrect : stats.incorrect + 1;
    const newTotal = stats.total + 1;
    const newScore = stats.score + pointsEarned;

    setStats({
      correct: newCorrect,
      incorrect: newIncorrect,
      total: newTotal,
      accuracy: newTotal > 0 ? Math.round((newCorrect / newTotal) * 100) : 0,
      itemsPerMinute: timeElapsed > 0 ? Math.round((newCorrect / timeElapsed) * 60 * 10) / 10 : 0,
      timeElapsed,
      streak: newStreak,
      bestStreak: newBestStreak,
      score: newScore,
    });

    setPreviousItem(currentItem);
    setPreviousWasCorrect(correct);
    setShowingHint(false);
    setShowCorrectAnswer(false); // Clear show correct answer state

    if (correct || forceAdvance) {
      if (correct) {
        const newCompleted = itemsCompleted + 1;
        setItemsCompleted(newCompleted);

        // Check win condition
        if (newCompleted >= level.itemsToWin) {
          setStatus('won');
          return;
        }
      }

      // Move to next item
      setCurrentItem(nextItem);
      setWrongAttempts(0); // Reset wrong attempts for new item
      setLastWrongClick(null); // Clear wrong click feedback

      // Generate decoys for the new current item (nextItem becomes current)
      if (multipleChoiceMode && nextItem) {
        setDecoyItems(generateDecoys(nextItem, level));
      }

      // Generate new next item
      const newUsedItems = [...usedItems];
      const newItem = generateNewItem(newUsedItems);
      newUsedItems.push(getItemId(newItem));
      setUsedItems(newUsedItems);
      setNextItem(newItem);

      // Toggle mode for combined
      if (level.gameMode === 'combined') {
        setIsClickMode(!isClickMode);
      }
    }
  }, [status, currentItem, nextItem, stats, itemsCompleted, level, generateNewItem, usedItems, isClickMode, multipleChoiceMode, generateDecoys]);

  // Show hint
  const showHint = useCallback(() => {
    if (status !== 'playing') return;
    setShowingHint(true);
  }, [status]);

  // Record wrong attempt (for Say mode - give multiple chances)
  const recordWrongAttempt = useCallback((clickedName?: string) => {
    if (status !== 'playing' || !currentItem) return;

    const newWrongAttempts = wrongAttempts + 1;
    setWrongAttempts(newWrongAttempts);
    if (clickedName) {
      setLastWrongClick(clickedName);
    }

    // After max attempts, show correct answer and require click to continue
    if (newWrongAttempts >= maxWrongAttempts) {
      setShowCorrectAnswer(true);
    }
  }, [status, currentItem, wrongAttempts, maxWrongAttempts]);

  // When showing correct answer, require correct click to advance
  const confirmCorrectAnswer = useCallback(() => {
    if (status !== 'playing' || !showCorrectAnswer) return;
    submitAnswer(false, true); // Mark as incorrect but force advance
  }, [status, showCorrectAnswer, submitAnswer]);

  // Skip current item - always force advance
  const skipItem = useCallback(() => {
    if (status !== 'playing' || !currentItem) return;
    submitAnswer(false, true); // Force advance even if showCorrectAnswer is true
  }, [status, currentItem, submitAnswer]);

  // Timer effect
  useEffect(() => {
    if (status === 'playing') {
      timerRef.current = window.setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setStatus('lost');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  return {
    status,
    level,
    levels: geographyLevels,
    currentItem,
    previousItem,
    previousWasCorrect,
    nextItem,
    timeRemaining,
    stats,
    itemsCompleted,
    currentGameMode: level.gameMode,
    isClickMode: level.gameMode === 'click' || (level.gameMode === 'combined' && isClickMode),
    showingHint,
    usedItems,
    wrongAttempts,
    maxWrongAttempts,
    lastWrongClick,
    showCorrectAnswer,
    multipleChoiceMode,
    decoyItems,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    selectLevel,
    submitAnswer,
    showHint,
    skipItem,
    recordWrongAttempt,
    confirmCorrectAnswer,
    toggleMultipleChoiceMode,
  };
}

export default useGeographyGameState;
