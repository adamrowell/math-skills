import { useState, useEffect, useCallback, useRef } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './CardSharkGame.css';

interface Card {
  suit: '♠' | '♥' | '♦' | '♣';
  value: string;
  numericValue: number;
}

interface CardSharkGameProps {
  onBack: () => void;
}

const SUITS: Card['suit'][] = ['♠', '♥', '♦', '♣'];
// Simpler values for kids - just 1-10, no face cards initially
const VALUES_EASY: { display: string; numeric: number }[] = [
  { display: '1', numeric: 1 },
  { display: '2', numeric: 2 },
  { display: '3', numeric: 3 },
  { display: '4', numeric: 4 },
  { display: '5', numeric: 5 },
];

const VALUES_MEDIUM: { display: string; numeric: number }[] = [
  { display: '1', numeric: 1 },
  { display: '2', numeric: 2 },
  { display: '3', numeric: 3 },
  { display: '4', numeric: 4 },
  { display: '5', numeric: 5 },
  { display: '6', numeric: 6 },
  { display: '7', numeric: 7 },
  { display: '8', numeric: 8 },
  { display: '9', numeric: 9 },
  { display: '10', numeric: 10 },
];

// MUCH more time - 30 seconds to start, minimum 15 seconds
const INITIAL_TIME = 30000;
const MIN_TIME = 15000;
const TIME_DECREASE_PER_LEVEL = 1500;

export function CardSharkGame({ onBack }: CardSharkGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [cards, setCards] = useState<Card[]>([]);
  const [userInput, setUserInput] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(INITIAL_TIME);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [showHint, setShowHint] = useState(false);

  // Stats
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('cardShark_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSubmitTimerRef = useRef<number | null>(null);

  // Voice recognition
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Get values based on level
  const getValues = useCallback(() => {
    return level <= 3 ? VALUES_EASY : VALUES_MEDIUM;
  }, [level]);

  // Generate random card
  const generateCard = useCallback((): Card => {
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const values = getValues();
    const value = values[Math.floor(Math.random() * values.length)];
    return {
      suit,
      value: value.display,
      numericValue: value.numeric,
    };
  }, [getValues]);

  // Calculate time based on level
  const getTimeForRound = useCallback(() => {
    return Math.max(MIN_TIME, INITIAL_TIME - (level - 1) * TIME_DECREASE_PER_LEVEL);
  }, [level]);

  // Get cards per round based on level - start with just 2!
  const getCardsPerRound = useCallback(() => {
    if (level <= 2) return 2;
    if (level <= 4) return 3;
    return Math.min(4, 2 + Math.floor(level / 2));
  }, [level]);

  // Start new round
  const startRound = useCallback(() => {
    const numCards = getCardsPerRound();
    const newCards = Array.from({ length: numCards }, () => generateCard());
    const total = newCards.reduce((sum, card) => sum + card.numericValue, 0);

    setCards(newCards);
    setCorrectAnswer(total);
    setUserInput('');
    setTimeRemaining(getTimeForRound());
    setShowFeedback(null);
    setShowHint(false);
    setGameStatus('playing');

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [getCardsPerRound, generateCard, getTimeForRound]);

  // Start game
  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    startRound();
  }, [startRound]);

  // Auto-submit when answer is correct (after 0.25s delay)
  const checkAutoSubmit = useCallback((input: string) => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
    }

    const userAnswer = parseInt(input, 10);
    if (isNaN(userAnswer)) return;

    if (userAnswer === correctAnswer) {
      autoSubmitTimerRef.current = window.setTimeout(() => {
        // Clear timer
        if (timerRef.current) clearInterval(timerRef.current);

        audioManager.playCorrect();
        setShowFeedback('correct');
        setCorrectAnswers(prev => prev + 1);
        setTotalAnswers(prev => prev + 1);
        setStreak(prev => prev + 1);

        const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
        const levelBonus = level * 25;
        const points = (50 + levelBonus) * streakMultiplier;
        setScore(prev => prev + points);

        if ((correctAnswers + 1) % 3 === 0) {
          setLevel(prev => prev + 1);
          audioManager.playLevelUp();
        }

        setTimeout(startRound, 1000);
      }, 250);
    }
  }, [correctAnswer, streak, correctAnswers, level, startRound]);

  // Speech recognition setup
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim();

      const numbers = transcript.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        const spokenNumber = numbers[numbers.length - 1];
        setUserInput(spokenNumber);
        checkAutoSubmit(spokenNumber);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening && gameStatus === 'playing') {
        try {
          recognition.start();
        } catch (e) {
          // Ignore
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      // Ignore
    }
  }, [checkAutoSubmit, isListening, gameStatus]);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Start speech recognition when game starts
  useEffect(() => {
    if (gameStatus === 'playing') {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }
    return () => stopSpeechRecognition();
  }, [gameStatus]);

  // Timer countdown
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const interval = 100;
    timerRef.current = window.setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - interval;
        if (newTime <= 0) {
          audioManager.playWrong();
          setShowFeedback('wrong');
          setStreak(0);
          setTotalAnswers(t => t + 1);

          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              setTimeout(() => setGameStatus('gameover'), 1000);
            } else {
              setTimeout(startRound, 1500);
            }
            return newLives;
          });

          return 0;
        }
        return newTime;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, [gameStatus, startRound]);

  // Submit answer
  const submitAnswer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const userAnswer = parseInt(userInput, 10);
    setTotalAnswers(prev => prev + 1);

    if (userAnswer === correctAnswer) {
      audioManager.playCorrect();
      setShowFeedback('correct');
      setCorrectAnswers(prev => prev + 1);
      setStreak(prev => prev + 1);

      const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      const levelBonus = level * 25;
      const points = (50 + levelBonus) * streakMultiplier;
      setScore(prev => prev + points);

      if ((correctAnswers + 1) % 3 === 0) {
        setLevel(prev => prev + 1);
        audioManager.playLevelUp();
      }

      setTimeout(startRound, 1000);
    } else {
      audioManager.playWrong();
      setShowFeedback('wrong');
      setStreak(0);

      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setTimeout(() => setGameStatus('gameover'), 1500);
        } else {
          setTimeout(startRound, 1500);
        }
        return newLives;
      });
    }
  }, [userInput, correctAnswer, streak, correctAnswers, level, startRound]);

  // Handle input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userInput.length > 0 && !showFeedback) {
      submitAnswer();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserInput(value);
    checkAutoSubmit(value);
  };

  // Save high score
  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('cardShark_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  // Get card color
  const getCardColor = (suit: Card['suit']) => {
    return suit === '♥' || suit === '♦' ? '#dc3545' : '#333';
  };

  // Render start screen
  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Card Shark"
        gameEmoji="🃏"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="card-shark__start">
          <h1 className="card-shark__title">🃏 Card Shark</h1>
          <p className="card-shark__description">
            Add up the cards yourself!<br />
            Look at the numbers and type or say the total.
          </p>

          <div className="card-shark__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>All cards are shown at once</li>
              <li>Add up all the numbers in your head</li>
              <li>Type or speak the total</li>
              <li>Press "Need Hint?" if you need help</li>
              <li>Correct answers auto-submit!</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="card-shark__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="card-shark__start-button" onClick={startGame}>
            🎰 Deal Me In!
          </button>
        </div>
      </ArcadeGameLayout>
    );
  }

  // Render game over
  if (gameStatus === 'gameover') {
    return (
      <GameOverOverlay
        score={score}
        highScore={highScore}
        isNewHighScore={score > highScore}
        level={level}
        correctAnswers={correctAnswers}
        totalAnswers={totalAnswers}
        onPlayAgain={startGame}
        onBack={onBack}
      />
    );
  }

  // Render game - show ALL cards at once
  return (
    <ArcadeGameLayout
      gameName="Card Shark"
      gameEmoji="🃏"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="card-shark">
        {/* Timer bar */}
        <div className="card-shark__timer">
          <div
            className="card-shark__timer-bar"
            style={{
              width: `${(timeRemaining / getTimeForRound()) * 100}%`,
              backgroundColor: timeRemaining < 5000 ? '#ff4444' : '#4CAF50'
            }}
          />
        </div>

        <div className="card-shark__timer-text">
          {Math.ceil(timeRemaining / 1000)}s
        </div>

        {/* Prompt */}
        <div className="card-shark__prompt">
          Add up all the cards! What's the total?
        </div>

        {/* Show ALL cards at once */}
        <div className="card-shark__cards-row">
          {cards.map((card, index) => (
            <div
              key={index}
              className="card-shark__card card-shark__card--small"
              style={{ color: getCardColor(card.suit) }}
            >
              <span className="card-shark__card-value">{card.value}</span>
              <span className="card-shark__card-suit">{card.suit}</span>
            </div>
          ))}
        </div>

        {/* Hint button - shows equation when clicked */}
        {!showHint ? (
          <button
            className="card-shark__hint-button"
            onClick={() => setShowHint(true)}
          >
            💡 Need Hint?
          </button>
        ) : (
          <div className="card-shark__equation">
            {cards.map((card, index) => (
              <span key={index}>
                {index > 0 && <span className="card-shark__plus">+</span>}
                <span className="card-shark__num">{card.numericValue}</span>
              </span>
            ))}
            <span className="card-shark__equals">=</span>
            <span className="card-shark__answer">?</span>
          </div>
        )}

        {/* Input area - always visible */}
        <div className="card-shark__input-area">
          <div className="card-shark__input-wrapper">
            <input
              ref={inputRef}
              type="number"
              value={userInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className={`card-shark__input ${showFeedback === 'correct' ? 'card-shark__input--correct' : ''} ${showFeedback === 'wrong' ? 'card-shark__input--wrong' : ''}`}
              placeholder="?"
              autoFocus
              disabled={!!showFeedback}
            />
            {isListening && <span className="card-shark__mic-indicator">🎤</span>}
          </div>
          <button
            className="card-shark__submit"
            onClick={submitAnswer}
            disabled={userInput.length === 0 || !!showFeedback}
          >
            ✓
          </button>
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`card-shark__feedback card-shark__feedback--${showFeedback}`}>
            {showFeedback === 'correct' ? '✓ Correct!' : `✗ The answer was ${correctAnswer}`}
          </div>
        )}

        {/* Level info */}
        <div className="card-shark__level-info">
          Level {level} • {cards.length} cards
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
