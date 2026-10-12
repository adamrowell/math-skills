import { useState, useCallback, useEffect, useRef } from 'react';
import {
  readingConfig,
  readingLevels,
  ReadingLevelConfig,
  ReadingWord,
  getRandomWord,
} from '../config/readingConfig';
import { doesWordMatch } from './useReadingVoiceRecognition';

export type ReadingGameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export interface ReadingGameStats {
  correct: number;
  skipped: number;
  total: number;
  accuracy: number;
  wordsPerMinute: number;
  timeElapsed: number;
}

export interface ReadingGameState {
  status: ReadingGameStatus;
  currentWord: ReadingWord | null;
  previousWord: ReadingWord | null;
  previousWasCorrect: boolean | null;
  nextWord: ReadingWord | null;
  timeRemaining: number;
  stats: ReadingGameStats;
  wordsCompleted: number;
  level: ReadingLevelConfig;
  showingHint: boolean;
  isSkipping: boolean;
  wrongAttempts: number; // Track consecutive wrong attempts for current word
}

const initialStats: ReadingGameStats = {
  correct: 0,
  skipped: 0,
  total: 0,
  accuracy: 100,
  wordsPerMinute: 0,
  timeElapsed: 0,
};

export function useReadingGameState() {
  const [status, setStatus] = useState<ReadingGameStatus>('idle');
  const [level, setLevel] = useState<ReadingLevelConfig>(readingLevels[0]); // Default to Letter Sounds
  const [currentWord, setCurrentWord] = useState<ReadingWord | null>(null);
  const [previousWord, setPreviousWord] = useState<ReadingWord | null>(null);
  const [previousWasCorrect, setPreviousWasCorrect] = useState<boolean | null>(null);
  const [nextWord, setNextWord] = useState<ReadingWord | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(readingConfig.timerDuration);
  const [stats, setStats] = useState<ReadingGameStats>(initialStats);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [showingHint, setShowingHint] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const skipTimeoutRef = useRef<number | null>(null);

  // Update stats
  const updateStats = useCallback((correct: boolean, skipped = false) => {
    setStats((prev) => {
      const newCorrect = prev.correct + (correct ? 1 : 0);
      const newSkipped = prev.skipped + (skipped ? 1 : 0);
      const newTotal = prev.total + 1;
      const timeElapsed = startTimeRef.current
        ? (Date.now() - startTimeRef.current) / 1000
        : 0;
      const wordsPerMinute =
        timeElapsed > 0 ? (newCorrect / timeElapsed) * 60 : 0;

      return {
        correct: newCorrect,
        skipped: newSkipped,
        total: newTotal,
        accuracy: newTotal > 0 ? Math.round((newCorrect / newTotal) * 100) : 100,
        wordsPerMinute: Math.round(wordsPerMinute * 10) / 10,
        timeElapsed: Math.round(timeElapsed),
      };
    });
  }, []);

  // Advance to next word
  const advanceWord = useCallback(() => {
    setPreviousWord(currentWord);
    setCurrentWord(nextWord);
    setNextWord(getRandomWord(level, nextWord?.word));
    setShowingHint(false);
    setIsSkipping(false);
    setWrongAttempts(0); // Reset wrong attempts for new word
  }, [currentWord, nextWord, level]);

  // Check if spoken word matches (with pronunciation alternatives)
  // Uses the same matching logic as the voice recognition hook for consistency
  const checkWordMatch = useCallback((spokenWord: string, targetWord: ReadingWord): boolean => {
    return doesWordMatch(spokenWord, targetWord);
  }, []);

  // Submit a spoken answer
  const submitAnswer = useCallback(
    (spokenWord: string) => {
      if (!currentWord || status !== 'playing') return false;

      const isCorrect = checkWordMatch(spokenWord, currentWord);
      setPreviousWasCorrect(isCorrect);
      updateStats(isCorrect, false);

      if (isCorrect) {
        setWordsCompleted((prev) => {
          const newCount = prev + 1;
          // Check win condition
          if (newCount >= level.wordsToWin) {
            setStatus('won');
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
          return newCount;
        });
        advanceWord();
      }

      return isCorrect;
    },
    [currentWord, status, level.wordsToWin, checkWordMatch, updateStats, advanceWord]
  );

  // Speak the current word using TTS with high-quality voice selection
  const speakWord = useCallback((word?: string) => {
    const textToSpeak = word || currentWord?.word;
    if (!textToSpeak) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = readingConfig.speechRate;
    utterance.pitch = readingConfig.speechPitch;
    utterance.lang = 'en-US';

    // Ranked list of high-quality voices (best first)
    // These are known to sound clear and natural across different platforms
    const preferredVoiceNames = [
      // macOS/iOS high-quality voices
      'Samantha', 'Karen', 'Daniel', 'Moira', 'Tessa',
      // Google/Chrome voices
      'Google US English', 'Google UK English Female',
      // Microsoft Edge voices (high quality)
      'Microsoft Zira', 'Microsoft David', 'Microsoft Jenny',
      // Android voices
      'English United States',
    ];

    const voices = window.speechSynthesis.getVoices();

    // Find the best available voice from our ranked list
    let selectedVoice: SpeechSynthesisVoice | undefined;

    for (const preferred of preferredVoiceNames) {
      selectedVoice = voices.find(
        v => v.name.includes(preferred) && v.lang.startsWith('en')
      );
      if (selectedVoice) break;
    }

    // Fallback to any US English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang === 'en-US');
    }

    // Final fallback to any English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith('en'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, [currentWord]);

  // Handle "Hear Word" button
  const hearWord = useCallback(() => {
    setShowingHint(true);
    setTimeout(() => speakWord(), readingConfig.hearWordDelay);
  }, [speakWord]);

  // Handle skip - speaks word multiple times then advances
  const skipWord = useCallback(() => {
    if (!currentWord || status !== 'playing' || isSkipping) return;

    setIsSkipping(true);
    setPreviousWasCorrect(false);
    updateStats(false, true);

    // Speak the word multiple times
    let repeatCount = 0;
    const repeatWord = () => {
      if (repeatCount < readingConfig.repeatOnSkip) {
        speakWord();
        repeatCount++;
        skipTimeoutRef.current = window.setTimeout(repeatWord, 1500);
      } else {
        // After repeats, advance to next word
        advanceWord();
      }
    };

    repeatWord();
  }, [currentWord, status, isSkipping, updateStats, speakWord, advanceWord]);

  // Start game - accepts optional levelId to avoid stale closure issues
  const startGame = useCallback((levelId?: number) => {
    // Determine which level to use - if levelId provided, find it directly
    let gameLevel = level;
    if (levelId !== undefined) {
      const foundLevel = readingLevels.find(l => l.id === levelId);
      if (foundLevel) {
        gameLevel = foundLevel;
        setLevel(foundLevel); // Also update state for consistency
      }
    }

    setStatus('playing');
    setTimeRemaining(readingConfig.timerDuration);
    setStats(initialStats);
    setWordsCompleted(0);
    setPreviousWord(null);
    setPreviousWasCorrect(null);
    setShowingHint(false);
    setIsSkipping(false);
    setWrongAttempts(0);

    // Generate initial words using the resolved level
    const first = getRandomWord(gameLevel);
    const second = getRandomWord(gameLevel, first.word);
    setCurrentWord(first);
    setNextWord(second);

    startTimeRef.current = Date.now();

    // Start timer
    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          setStatus('lost');
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }, [level]);

  // Pause game
  const pauseGame = useCallback(() => {
    if (status === 'playing') {
      setStatus('paused');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      window.speechSynthesis.cancel();
    }
  }, [status]);

  // Resume game
  const resumeGame = useCallback(() => {
    if (status === 'paused') {
      setStatus('playing');
      timerRef.current = window.setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setStatus('lost');
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
  }, [status]);

  // Reset game
  const resetGame = useCallback(() => {
    setStatus('idle');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
      skipTimeoutRef.current = null;
    }
    window.speechSynthesis.cancel();
    setTimeRemaining(readingConfig.timerDuration);
    setStats(initialStats);
    setWordsCompleted(0);
    setCurrentWord(null);
    setPreviousWord(null);
    setPreviousWasCorrect(null);
    setNextWord(null);
    setShowingHint(false);
    setIsSkipping(false);
    setWrongAttempts(0);
    startTimeRef.current = null;
  }, []);

  // Select level
  const selectLevel = useCallback((levelId: number) => {
    const selectedLevel = readingLevels.find((l) => l.id === levelId);
    if (selectedLevel) {
      setLevel(selectedLevel);
      resetGame();
    }
  }, [resetGame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  // Load voices on mount
  useEffect(() => {
    // Some browsers need this to load voices
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }, []);

  // Record a wrong attempt (for pulsing hint)
  const recordWrongAttempt = useCallback(() => {
    setWrongAttempts(prev => prev + 1);
  }, []);

  return {
    // State
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
    levels: readingLevels,
    config: readingConfig,

    // Actions
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    selectLevel,
    submitAnswer,
    hearWord,
    skipWord,
    speakWord,
    checkWordMatch,
    recordWrongAttempt,
  };
}
