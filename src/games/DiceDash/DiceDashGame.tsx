import { useState, useEffect, useCallback, useRef } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './DiceDashGame.css';

interface DiceDashGameProps {
  onBack: () => void;
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// Number pad buttons for easy input
const NUMBER_PAD: (number | 'clear' | null)[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [null, 0, 'clear'],
];

export function DiceDashGame({ onBack }: DiceDashGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [dice, setDice] = useState<number[]>([1, 1]);
  const [isRolling, setIsRolling] = useState(false);
  const [targetAnswer, setTargetAnswer] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(15); // More time!
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Voice recognition
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Stats
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('diceDash_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const timerRef = useRef<number | null>(null);
  const autoSubmitTimerRef = useRef<number | null>(null);

  const startRoundRef = useRef<() => void>(() => {});

  // Auto-submit when correct answer is entered
  const checkAutoSubmit = useCallback((input: string) => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
    }

    const userAnswer = parseInt(input, 10);
    if (isNaN(userAnswer) || isRolling || showFeedback) return;

    if (userAnswer === targetAnswer) {
      autoSubmitTimerRef.current = window.setTimeout(() => {
        if (timerRef.current) clearInterval(timerRef.current);

        audioManager.playCorrect();
        setShowFeedback('correct');
        setCorrectAnswers(ca => ca + 1);
        setTotalAnswers(ta => ta + 1);
        setStreak(s => s + 1);

        const timeBonus = timeRemaining * 10;
        const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
        const points = (100 + timeBonus + level * 20) * streakMultiplier;
        setScore(s => s + points);

        if ((correctAnswers + 1) % 5 === 0) {
          setLevel(l => l + 1);
          audioManager.playLevelUp();
        }

        setUserInput('');
        setTimeout(() => startRoundRef.current(), 800);
      }, 250);
    }
  }, [targetAnswer, isRolling, showFeedback, timeRemaining, streak, correctAnswers, level]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        // Update transcript display
        setTranscript(interimTranscript || finalTranscript);

        // Try to extract a number from the speech
        const text = (finalTranscript || interimTranscript).toLowerCase();
        const numberMatch = extractNumber(text);
        if (numberMatch !== null) {
          setUserInput(numberMatch.toString());
          checkAutoSubmit(numberMatch.toString());
        }
      };

      recognition.onerror = (event) => {
        console.log('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Restart if still playing
        if (gameStatus === 'playing' && !isRolling) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore - already started
          }
        }
      };

      recognitionRef.current = recognition as SpeechRecognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [gameStatus, isRolling]);

  // Extract number from speech text
  const extractNumber = (text: string): number | null => {
    // Common word-to-number mappings
    const wordNumbers: Record<string, number> = {
      'zero': 0, 'one': 1, 'two': 2, 'to': 2, 'too': 2, 'three': 3, 'four': 4, 'for': 4,
      'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'ate': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      'twenty one': 21, 'twenty-one': 21, 'twenty two': 22, 'twenty-two': 22,
      'twenty three': 23, 'twenty-three': 23, 'twenty four': 24, 'twenty-four': 24,
      'twenty five': 25, 'twenty-five': 25, 'twenty six': 26, 'twenty-six': 26,
      'twenty seven': 27, 'twenty-seven': 27, 'twenty eight': 28, 'twenty-eight': 28,
      'twenty nine': 29, 'twenty-nine': 29, 'thirty': 30,
      'thirty one': 31, 'thirty-one': 31, 'thirty two': 32, 'thirty-two': 32,
      'thirty three': 33, 'thirty-three': 33, 'thirty four': 34, 'thirty-four': 34,
      'thirty five': 35, 'thirty-five': 35, 'thirty six': 36, 'thirty-six': 36,
    };

    // Check for word numbers first
    for (const [word, num] of Object.entries(wordNumbers)) {
      if (text.includes(word)) {
        return num;
      }
    }

    // Try to find a numeric digit
    const digitMatch = text.match(/\d+/);
    if (digitMatch) {
      return parseInt(digitMatch[0], 10);
    }

    return null;
  };

  // Start/stop voice recognition
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        // Already started
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        // Ignore
      }
    }
  }, [isListening]);

  // Roll dice with animation
  const rollDice = useCallback(() => {
    setIsRolling(true);
    setUserInput('');
    setTranscript('');
    setShowFeedback(null);
    audioManager.play('whoosh');

    // Animate rolling
    let rollCount = 0;
    const rollInterval = setInterval(() => {
      setDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
      rollCount++;
      if (rollCount >= 10) {
        clearInterval(rollInterval);
        // Final roll
        const finalDice = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ];
        setDice(finalDice);

        // ALWAYS addition for simplicity - dice max is 6+6=12
        const answer = finalDice[0] + finalDice[1];
        setTargetAnswer(answer);
        setIsRolling(false);
        setTimeRemaining(15); // More time!
      }
    }, 100);
  }, []);

  // Start new round
  const startRound = useCallback(() => {
    rollDice();
  }, [rollDice]);

  // Keep ref up to date
  startRoundRef.current = startRound;

  // Start game
  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setShowFeedback(null);
    setGameStatus('playing');
    startListening();
  }, [startListening]);

  // Initialize first round
  useEffect(() => {
    if (gameStatus === 'playing' && !isRolling && dice[0] === 1 && dice[1] === 1 && timeRemaining === 15) {
      startRound();
    }
  }, [gameStatus, isRolling, dice, timeRemaining, startRound]);

  // Timer
  useEffect(() => {
    if (gameStatus !== 'playing' || isRolling || showFeedback) return;

    timerRef.current = window.setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          audioManager.playWrong();
          setShowFeedback('wrong');
          setStreak(0);
          setTotalAnswers(ta => ta + 1);
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              setTimeout(() => setGameStatus('gameover'), 1500);
            } else {
              setTimeout(startRound, 1500);
            }
            return newLives;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStatus, isRolling, showFeedback, startRound]);

  // Submit answer
  const submitAnswer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const userAnswer = parseInt(userInput, 10);
    setTotalAnswers(ta => ta + 1);

    if (userAnswer === targetAnswer) {
      // Correct!
      audioManager.playCorrect();
      setShowFeedback('correct');
      setCorrectAnswers(ca => ca + 1);
      setStreak(s => s + 1);

      const timeBonus = timeRemaining * 10;
      const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      const points = (100 + timeBonus + level * 20) * streakMultiplier;
      setScore(s => s + points);

      // Level up every 5 correct
      if ((correctAnswers + 1) % 5 === 0) {
        setLevel(l => l + 1);
        audioManager.playLevelUp();
      }

      setTimeout(startRound, 1000);
    } else {
      // Wrong!
      audioManager.playWrong();
      setShowFeedback('wrong');
      setStreak(0);
      setLives(l => {
        const newLives = l - 1;
        if (newLives <= 0) {
          setTimeout(() => setGameStatus('gameover'), 1500);
        } else {
          setTimeout(startRound, 1500);
        }
        return newLives;
      });
    }
  }, [userInput, targetAnswer, timeRemaining, streak, correctAnswers, level, startRound]);

  // Handle number pad click
  const handleNumberPadClick = (value: number | 'clear' | null) => {
    if (value === null || isRolling || showFeedback) return;

    if (value === 'clear') {
      setUserInput('');
    } else {
      // Append digit, max 2 digits for dice (max answer is 12)
      setUserInput(prev => {
        const newValue = prev + value.toString();
        return newValue.length <= 2 ? newValue : prev;
      });
    }
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userInput.length > 0 && !isRolling && !showFeedback) {
      submitAnswer();
    }
  };

  // Stop listening on game over
  useEffect(() => {
    if (gameStatus === 'gameover') {
      stopListening();
    }
  }, [gameStatus, stopListening]);

  // Save high score
  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('diceDash_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  // Render start screen
  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Dice Dash"
        gameEmoji="🎲"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="dice-dash__start">
          <h1 className="dice-dash__title">🎲 Dice Dash</h1>
          <p className="dice-dash__description">
            Roll the dice and add them up!<br />
            Use the number pad, keyboard, or your voice!
          </p>

          <div className="dice-dash__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Dice will roll automatically</li>
              <li>Add the two dice together</li>
              <li>Tap numbers or say the answer!</li>
              <li>You have plenty of time - no rush!</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="dice-dash__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="dice-dash__start-button" onClick={startGame}>
            🎲 Roll the Dice!
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

  // Render game
  return (
    <ArcadeGameLayout
      gameName="Dice Dash"
      gameEmoji="🎲"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="dice-dash">
        {/* Timer */}
        <div className="dice-dash__timer" style={{ color: timeRemaining <= 5 ? '#ff4444' : '#fff' }}>
          ⏱️ {timeRemaining}s
        </div>

        {/* Voice indicator */}
        {isListening && (
          <div className="dice-dash__voice-indicator">
            🎤 {transcript || 'Listening...'}
          </div>
        )}

        {/* Dice display */}
        <div className="dice-dash__dice-container">
          <div className={`dice-dash__die ${isRolling ? 'dice-dash__die--rolling' : ''}`}>
            {DICE_FACES[dice[0] - 1]}
          </div>
          <div className="dice-dash__operation">+</div>
          <div className={`dice-dash__die ${isRolling ? 'dice-dash__die--rolling' : ''}`}>
            {DICE_FACES[dice[1] - 1]}
          </div>
          <div className="dice-dash__equals">=</div>
          <div className="dice-dash__answer-display">
            {userInput || '?'}
          </div>
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`dice-dash__feedback dice-dash__feedback--${showFeedback}`}>
            {showFeedback === 'correct' ? '✓ Correct!' : `✗ The answer was ${targetAnswer}`}
          </div>
        )}

        {/* Visible input field */}
        <div className="dice-dash__input-area">
          <div className="dice-dash__input-wrapper">
            <input
              type="number"
              value={userInput}
              onChange={(e) => {
                const val = e.target.value.slice(0, 2);
                setUserInput(val);
                checkAutoSubmit(val);
              }}
              onKeyDown={handleKeyDown}
              className="dice-dash__input"
              placeholder="Type answer..."
              disabled={isRolling || !!showFeedback}
              autoFocus
            />
            {isListening && <span className="dice-dash__mic-icon">🎤</span>}
          </div>
          <button
            className="dice-dash__submit-btn"
            onClick={submitAnswer}
            disabled={userInput.length === 0 || isRolling || !!showFeedback}
          >
            ✓
          </button>
        </div>

        {/* Number pad - optional for touch users */}
        <div className="dice-dash__number-pad">
          {NUMBER_PAD.map((row, rowIndex) => (
            <div key={rowIndex} className="dice-dash__number-row">
              {row.map((value, colIndex) => (
                <button
                  key={colIndex}
                  className={`dice-dash__number-btn ${value === 'clear' ? 'dice-dash__number-btn--clear' : ''} ${value === null ? 'dice-dash__number-btn--empty' : ''}`}
                  onClick={() => handleNumberPadClick(value)}
                  disabled={isRolling || !!showFeedback || value === null}
                >
                  {value === 'clear' ? '⌫' : value}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
