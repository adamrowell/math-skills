import { useState, useEffect, useCallback, useRef } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './ClockMasterGame.css';

interface ClockMasterGameProps {
  onBack: () => void;
}

type QuestionType = 'readClock' | 'quarterTo' | 'halfPast' | 'quarterPast' | 'oClockTo';

interface TimeQuestion {
  type: QuestionType;
  hour: number;
  minute: number;
  display: string;
  acceptedAnswers: string[];
}

export function ClockMasterGame({ onBack }: ClockMasterGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [currentQuestion, setCurrentQuestion] = useState<TimeQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [correctAnswerDisplay, setCorrectAnswerDisplay] = useState('');

  // Stats
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('clockMaster_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Voice recognition
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate time question based on level
  const generateQuestion = useCallback((): TimeQuestion => {
    // Level 1-2: Simple o'clock times (3:00, 6:00)
    // Level 3-4: Add half past (3:30)
    // Level 5-6: Add quarter past (3:15)
    // Level 7+: Add quarter to (2:45)

    let questionTypes: QuestionType[] = ['readClock'];

    if (level >= 3) questionTypes.push('halfPast');
    if (level >= 5) questionTypes.push('quarterPast');
    if (level >= 7) questionTypes.push('quarterTo');

    const type = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const hour = Math.floor(Math.random() * 12) + 1; // 1-12

    let minute: number;
    let display: string;
    let acceptedAnswers: string[] = [];

    switch (type) {
      case 'readClock':
        // For early levels, just o'clock
        if (level <= 2) {
          minute = 0;
          display = `What time is shown?`;
          acceptedAnswers = [
            `${hour} o'clock`,
            `${hour}:00`,
            `${hour} oclock`,
            `${hour}`,
          ];
        } else {
          // Random times at 5-minute intervals
          const intervals = level <= 4 ? [0, 15, 30, 45] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
          minute = intervals[Math.floor(Math.random() * intervals.length)];
          display = `What time is shown?`;
          acceptedAnswers = getTimeAnswers(hour, minute);
        }
        break;

      case 'halfPast':
        minute = 30;
        display = `What is "half past ${hour}"?`;
        acceptedAnswers = [
          `${hour}:30`,
          `${hour} 30`,
          `${hour}30`,
          `half past ${hour}`,
        ];
        break;

      case 'quarterPast':
        minute = 15;
        display = `What is "quarter past ${hour}"?`;
        acceptedAnswers = [
          `${hour}:15`,
          `${hour} 15`,
          `${hour}15`,
          `quarter past ${hour}`,
        ];
        break;

      case 'quarterTo':
        minute = 45;
        const nextHour = hour === 12 ? 1 : hour + 1;
        display = `What is "quarter to ${nextHour}"?`;
        acceptedAnswers = [
          `${hour}:45`,
          `${hour} 45`,
          `${hour}45`,
          `quarter to ${nextHour}`,
        ];
        break;

      default:
        minute = 0;
        display = `What time is shown?`;
        acceptedAnswers = [`${hour}:00`, `${hour} o'clock`];
    }

    return { type, hour, minute, display, acceptedAnswers };
  }, [level]);

  // Get all acceptable answers for a given time
  const getTimeAnswers = (hour: number, minute: number): string[] => {
    const answers: string[] = [];
    const minStr = minute.toString().padStart(2, '0');

    // Standard formats
    answers.push(`${hour}:${minStr}`);
    answers.push(`${hour} ${minStr}`);
    answers.push(`${hour}${minStr}`);

    if (minute === 0) {
      answers.push(`${hour} o'clock`);
      answers.push(`${hour} oclock`);
      answers.push(`${hour}`);
    } else if (minute === 15) {
      answers.push(`quarter past ${hour}`);
      answers.push(`${hour} fifteen`);
    } else if (minute === 30) {
      answers.push(`half past ${hour}`);
      answers.push(`${hour} thirty`);
    } else if (minute === 45) {
      const nextHour = hour === 12 ? 1 : hour + 1;
      answers.push(`quarter to ${nextHour}`);
      answers.push(`${hour} forty five`);
      answers.push(`${hour} forty-five`);
    }

    return answers;
  };

  // Check if answer is correct (with tolerance)
  const checkAnswer = useCallback((answer: string): boolean => {
    if (!currentQuestion) return false;

    const normalizedAnswer = answer.toLowerCase().trim()
      .replace(/[^\w\s:]/g, '')
      .replace(/\s+/g, ' ');

    // Check against accepted answers
    for (const accepted of currentQuestion.acceptedAnswers) {
      const normalizedAccepted = accepted.toLowerCase().trim()
        .replace(/[^\w\s:]/g, '')
        .replace(/\s+/g, ' ');

      if (normalizedAnswer === normalizedAccepted) return true;

      // Allow some flexibility
      if (normalizedAnswer.includes(normalizedAccepted)) return true;
      if (normalizedAccepted.includes(normalizedAnswer) && normalizedAnswer.length >= 2) return true;
    }

    // Check for time format with tolerance (off by 1-2 minutes is OK)
    const timeMatch = normalizedAnswer.match(/(\d{1,2})\s*[:\s]?\s*(\d{2})?/);
    if (timeMatch) {
      const answerHour = parseInt(timeMatch[1], 10);
      const answerMinute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

      const hourMatch = answerHour === currentQuestion.hour ||
        answerHour === (currentQuestion.hour === 12 ? 0 : currentQuestion.hour);
      const minuteDiff = Math.abs(answerMinute - currentQuestion.minute);

      // Allow up to 2 minutes off
      if (hourMatch && minuteDiff <= 2) return true;
    }

    return false;
  }, [currentQuestion]);

  // Start new round
  const startRound = useCallback(() => {
    const question = generateQuestion();
    setCurrentQuestion(question);
    setUserAnswer('');
    setTranscript('');
    setShowFeedback(null);
    setCorrectAnswerDisplay(question.acceptedAnswers[0]);

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [generateQuestion]);

  // Start game
  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setGameStatus('playing');
    startRound();
  }, [startRound]);

  // Submit answer
  const submitAnswer = useCallback((answer: string) => {
    if (!answer || showFeedback) return;

    setTotalAnswers(prev => prev + 1);

    if (checkAnswer(answer)) {
      audioManager.playCorrect();
      setShowFeedback('correct');
      setCorrectAnswers(prev => prev + 1);
      setStreak(prev => prev + 1);

      const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      const points = (100 + level * 25) * streakMultiplier;
      setScore(prev => prev + points);

      // Level up every 4 correct
      if ((correctAnswers + 1) % 4 === 0) {
        setLevel(prev => prev + 1);
        audioManager.playLevelUp();
      }

      setTimeout(startRound, 1500);
    } else {
      audioManager.playWrong();
      setShowFeedback('wrong');
      setStreak(0);

      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setTimeout(() => setGameStatus('gameover'), 2000);
        } else {
          setTimeout(startRound, 2000);
        }
        return newLives;
      });
    }
  }, [showFeedback, checkAnswer, streak, correctAnswers, level, startRound]);

  // Voice recognition
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      const text = result[0].transcript.trim();

      setTranscript(text);

      // Auto-submit on final result
      if (result.isFinal && text.length > 0) {
        setUserAnswer(text);
        submitAnswer(text);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening && gameStatus === 'playing' && !showFeedback) {
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
  }, [submitAnswer, isListening, gameStatus, showFeedback]);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Start/stop speech recognition
  useEffect(() => {
    if (gameStatus === 'playing' && !showFeedback) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }
    return () => stopSpeechRecognition();
  }, [gameStatus, showFeedback]);

  // Handle manual input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userAnswer.length > 0 && !showFeedback) {
      submitAnswer(userAnswer);
    }
  };

  // Save high score
  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('clockMaster_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  // Calculate clock hand angles
  const getHourAngle = (h: number, m: number) => (h % 12) * 30 + m * 0.5;
  const getMinuteAngle = (m: number) => m * 6;

  // Render start screen
  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Clock Master"
        gameEmoji="🕐"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="clock-master__start">
          <h1 className="clock-master__title">🕐 Clock Master</h1>
          <p className="clock-master__description">
            Learn to tell time like a pro!<br />
            Say or type the time you see.
          </p>

          <div className="clock-master__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Look at the clock and say the time</li>
              <li>Answer "quarter past", "half past", "quarter to" questions</li>
              <li>Speak naturally or type your answer</li>
              <li>Close answers (off by a minute) are accepted!</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="clock-master__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="clock-master__start-button" onClick={startGame}>
            🕐 Start Learning!
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
      gameName="Clock Master"
      gameEmoji="🕐"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="clock-master">
        {/* Question prompt */}
        <div className="clock-master__question">
          {currentQuestion?.display}
        </div>

        {/* Analog clock display */}
        {currentQuestion && (currentQuestion.type === 'readClock' || showFeedback) && (
          <div className="clock-master__clock">
            <div className="clock-master__clock-face">
              {/* Hour markers - simple numbered divs positioned by CSS */}
              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num) => (
                <div key={num} className="clock-master__hour-marker">
                  {num}
                </div>
              ))}

              {/* Clock hands */}
              <div
                className="clock-master__hand clock-master__hand--hour"
                style={{ transform: `rotate(${getHourAngle(currentQuestion.hour, currentQuestion.minute)}deg)` }}
              />
              <div
                className="clock-master__hand clock-master__hand--minute"
                style={{ transform: `rotate(${getMinuteAngle(currentQuestion.minute)}deg)` }}
              />
              <div className="clock-master__center-dot" />
            </div>
          </div>
        )}

        {/* Voice indicator */}
        <div className="clock-master__voice-area">
          {isListening && (
            <div className="clock-master__listening">
              <span className="clock-master__mic">🎤</span>
              <span>Listening...</span>
            </div>
          )}
          {transcript && !showFeedback && (
            <div className="clock-master__transcript">
              "{transcript}"
            </div>
          )}
        </div>

        {/* Manual input */}
        <div className="clock-master__input-area">
          <input
            ref={inputRef}
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            className="clock-master__input"
            placeholder="Type or speak the time..."
            disabled={!!showFeedback}
          />
          <button
            className="clock-master__submit"
            onClick={() => submitAnswer(userAnswer)}
            disabled={userAnswer.length === 0 || !!showFeedback}
          >
            ✓
          </button>
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`clock-master__feedback clock-master__feedback--${showFeedback}`}>
            {showFeedback === 'correct'
              ? '✓ Correct!'
              : `✗ The answer was ${correctAnswerDisplay}`}
          </div>
        )}

        {/* Level hint */}
        <div className="clock-master__hint">
          Level {level}:
          {level <= 2 && " O'clock times"}
          {level >= 3 && level <= 4 && " Adding half past"}
          {level >= 5 && level <= 6 && " Adding quarter past"}
          {level >= 7 && " All time phrases!"}
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
