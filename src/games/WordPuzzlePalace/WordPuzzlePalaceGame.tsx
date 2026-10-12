import { useState, useEffect, useCallback } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './WordPuzzlePalaceGame.css';

interface WordPuzzlePalaceGameProps {
  onBack: () => void;
}

const PUZZLES = [
  { question: "Why was 6 afraid of 7?", answer: "7 8 9", hint: "Seven ate nine" },
  { question: "What do you call a number that can't stay in one place?", answer: "roamin numeral", hint: "Roman numeral" },
  { question: "What did zero say to eight?", answer: "nice belt", hint: "Nice belt!" },
  { question: "Why is math like love?", answer: "rational", hint: "It's rational" },
  { question: "What's a math teacher's favorite dessert?", answer: "pi", hint: "Pi/Pie" },
  { question: "Why did the two 4s skip lunch?", answer: "already 8", hint: "They already ate (8)" },
  { question: "What do you get when you cross geometry with McDonald's?", answer: "plane cheeseburger", hint: "Plane cheeseburger" },
  { question: "Why was the equal sign so humble?", answer: "not greater or less", hint: "It's not greater or less" },
  { question: "What's a bird's favorite type of math?", answer: "owlgebra", hint: "Owl-gebra" },
  { question: "How do you make seven even?", answer: "remove s", hint: "Remove the S" },
];

export function WordPuzzlePalaceGame({ onBack }: WordPuzzlePalaceGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [currentPuzzle, setCurrentPuzzle] = useState(PUZZLES[0]);
  const [userInput, setUserInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [usedPuzzles, setUsedPuzzles] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(30);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('wordPuzzle_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const nextPuzzle = useCallback(() => {
    const available = PUZZLES.filter((_, i) => !usedPuzzles.includes(i));
    if (available.length === 0) {
      setUsedPuzzles([]);
      setCurrentPuzzle(PUZZLES[Math.floor(Math.random() * PUZZLES.length)]);
    } else {
      const index = Math.floor(Math.random() * available.length);
      const puzzleIndex = PUZZLES.indexOf(available[index]);
      setCurrentPuzzle(PUZZLES[puzzleIndex]);
      setUsedPuzzles(prev => [...prev, puzzleIndex]);
    }
    setUserInput('');
    setShowHint(false);
    setTimeRemaining(30);
  }, [usedPuzzles]);

  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setUsedPuzzles([]);
    setShowHint(false);
    setGameStatus('playing');
  }, []);

  useEffect(() => {
    if (gameStatus === 'playing' && currentPuzzle === PUZZLES[0] && correctAnswers === 0) {
      nextPuzzle();
    }
  }, [gameStatus, currentPuzzle, correctAnswers, nextPuzzle]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          audioManager.playWrong();
          setStreak(0);
          setTotalAnswers(ta => ta + 1);
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              setGameStatus('gameover');
            } else {
              nextPuzzle();
            }
            return newLives;
          });
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, nextPuzzle]);

  const submitAnswer = useCallback(() => {
    const normalized = userInput.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
    const correctNormalized = currentPuzzle.answer.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');

    setTotalAnswers(ta => ta + 1);

    if (normalized === correctNormalized) {
      audioManager.playCorrect();
      setCorrectAnswers(ca => ca + 1);
      setStreak(s => s + 1);

      const hintPenalty = showHint ? 0.5 : 1;
      const timeBonus = timeRemaining * 10;
      const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      const points = Math.floor((200 + timeBonus) * hintPenalty * streakMultiplier);
      setScore(s => s + points);

      if ((correctAnswers + 1) % 5 === 0) {
        setLevel(l => l + 1);
        audioManager.playLevelUp();
      }

      nextPuzzle();
    } else {
      audioManager.playWrong();
      setStreak(0);
      setLives(l => {
        const newLives = l - 1;
        if (newLives <= 0) {
          setGameStatus('gameover');
        } else {
          nextPuzzle();
        }
        return newLives;
      });
    }
  }, [userInput, currentPuzzle, showHint, timeRemaining, streak, correctAnswers, nextPuzzle]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userInput.length > 0) {
      submitAnswer();
    }
  };

  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('wordPuzzle_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout gameName="Word Puzzle Palace" gameEmoji="🧩" score={0} lives={3} level={1} streak={0} onBack={onBack} showScore={false} showLives={false} showLevel={false}>
        <div className="word-puzzle__start">
          <h1 className="word-puzzle__title">🧩 Word Puzzle Palace</h1>
          <p className="word-puzzle__description">Solve math jokes and riddles!<br />Think outside the box and have fun.</p>
          <div className="word-puzzle__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>Read the math joke or riddle</li>
              <li>Type the punchline or answer</li>
              <li>Use hints if you're stuck (reduces points)</li>
              <li>Solve quickly for bonus points!</li>
            </ul>
          </div>
          {highScore > 0 && <div className="word-puzzle__high-score">High Score: {highScore.toLocaleString()}</div>}
          <button className="word-puzzle__start-button" onClick={startGame}>🧩 Start Puzzling!</button>
        </div>
      </ArcadeGameLayout>
    );
  }

  if (gameStatus === 'gameover') {
    return <GameOverOverlay score={score} highScore={highScore} isNewHighScore={score > highScore} level={level} correctAnswers={correctAnswers} totalAnswers={totalAnswers} onPlayAgain={startGame} onBack={onBack} />;
  }

  return (
    <ArcadeGameLayout gameName="Word Puzzle Palace" gameEmoji="🧩" score={score} lives={lives} level={level} streak={streak} onBack={onBack} onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')} isPaused={gameStatus === 'paused'}>
      <div className="word-puzzle">
        <div className="word-puzzle__timer" style={{ color: timeRemaining <= 10 ? '#ff4444' : '#fff' }}>
          ⏱️ {timeRemaining}s
        </div>

        <div className="word-puzzle__question-box">
          <div className="word-puzzle__question">{currentPuzzle.question}</div>
          {showHint && <div className="word-puzzle__hint">💡 Hint: {currentPuzzle.hint}</div>}
        </div>

        <div className="word-puzzle__input-area">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="word-puzzle__input"
            placeholder="Type your answer..."
            autoFocus
          />
          <button className="word-puzzle__submit" onClick={submitAnswer} disabled={userInput.length === 0}>
            Submit
          </button>
        </div>

        <button className="word-puzzle__hint-button" onClick={() => setShowHint(true)} disabled={showHint}>
          💡 Show Hint (-50% points)
        </button>
      </div>
    </ArcadeGameLayout>
  );
}
