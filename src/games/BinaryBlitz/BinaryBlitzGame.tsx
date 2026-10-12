import { useState, useEffect, useCallback, useRef } from 'react';
import { ArcadeGameLayout } from '../../components/Arcade/ArcadeGameLayout';
import { GameOverOverlay } from '../../components/Arcade/GameOverOverlay';
import { audioManager } from '../../utils/audioManager';
import './BinaryBlitzGame.css';

interface BooleanBlitzGameProps {
  onBack: () => void;
}

type Operation = 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR';

interface BooleanProblem {
  operation: Operation;
  input1: boolean;
  input2?: boolean; // NOT only has one input
  answer: boolean;
  display: string;
}

export function BinaryBlitzGame({ onBack }: BooleanBlitzGameProps) {
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [currentProblem, setCurrentProblem] = useState<BooleanProblem | null>(null);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Stats
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('booleanBlitz_highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const autoSubmitTimerRef = useRef<number | null>(null);

  // Generate boolean problem based on level
  const generateProblem = useCallback((): BooleanProblem => {
    // Level 1-2: AND and OR only
    // Level 3-4: Add NOT
    // Level 5-6: Add XOR
    // Level 7+: Add NAND, NOR

    let operations: Operation[] = ['AND', 'OR'];
    if (level >= 3) operations.push('NOT');
    if (level >= 5) operations.push('XOR');
    if (level >= 7) operations = [...operations, 'NAND', 'NOR'];

    const operation = operations[Math.floor(Math.random() * operations.length)];
    const input1 = Math.random() > 0.5;
    const input2 = Math.random() > 0.5;

    let answer: boolean;
    let display: string;

    switch (operation) {
      case 'AND':
        answer = input1 && input2;
        display = `${input1 ? 'TRUE' : 'FALSE'} AND ${input2 ? 'TRUE' : 'FALSE'}`;
        break;
      case 'OR':
        answer = input1 || input2;
        display = `${input1 ? 'TRUE' : 'FALSE'} OR ${input2 ? 'TRUE' : 'FALSE'}`;
        break;
      case 'NOT':
        answer = !input1;
        display = `NOT ${input1 ? 'TRUE' : 'FALSE'}`;
        return { operation, input1, answer, display };
      case 'XOR':
        answer = (input1 || input2) && !(input1 && input2);
        display = `${input1 ? 'TRUE' : 'FALSE'} XOR ${input2 ? 'TRUE' : 'FALSE'}`;
        break;
      case 'NAND':
        answer = !(input1 && input2);
        display = `${input1 ? 'TRUE' : 'FALSE'} NAND ${input2 ? 'TRUE' : 'FALSE'}`;
        break;
      case 'NOR':
        answer = !(input1 || input2);
        display = `${input1 ? 'TRUE' : 'FALSE'} NOR ${input2 ? 'TRUE' : 'FALSE'}`;
        break;
      default:
        answer = input1 && input2;
        display = `${input1 ? 'TRUE' : 'FALSE'} AND ${input2 ? 'TRUE' : 'FALSE'}`;
    }

    return { operation, input1, input2, answer, display };
  }, [level]);

  // Start new round
  const startRound = useCallback(() => {
    const problem = generateProblem();
    setCurrentProblem(problem);
    setShowFeedback(null);
  }, [generateProblem]);

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
  const submitAnswer = useCallback((userAnswer: boolean) => {
    if (!currentProblem || showFeedback) return;

    setTotalAnswers(prev => prev + 1);

    if (userAnswer === currentProblem.answer) {
      audioManager.playCorrect();
      setShowFeedback('correct');
      setCorrectAnswers(prev => prev + 1);
      setStreak(prev => prev + 1);

      const streakMultiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      const points = (100 + level * 30) * streakMultiplier;
      setScore(prev => prev + points);

      // Level up every 5 correct
      if ((correctAnswers + 1) % 5 === 0) {
        setLevel(prev => prev + 1);
        audioManager.playLevelUp();
      }

      // Next round after brief pause
      autoSubmitTimerRef.current = window.setTimeout(startRound, 800);
    } else {
      audioManager.playWrong();
      setShowFeedback('wrong');
      setStreak(0);

      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setTimeout(() => setGameStatus('gameover'), 1500);
        } else {
          autoSubmitTimerRef.current = window.setTimeout(startRound, 1500);
        }
        return newLives;
      });
    }
  }, [currentProblem, showFeedback, streak, correctAnswers, level, startRound]);

  // Keyboard controls
  useEffect(() => {
    if (gameStatus !== 'playing' || showFeedback) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T' || e.key === '1') {
        e.preventDefault();
        submitAnswer(true);
      } else if (e.key === 'f' || e.key === 'F' || e.key === '0') {
        e.preventDefault();
        submitAnswer(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus, showFeedback, submitAnswer]);

  // Save high score
  useEffect(() => {
    if (gameStatus === 'gameover' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('booleanBlitz_highScore', score.toString());
    }
  }, [gameStatus, score, highScore]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, []);

  // Get operation explanation
  const getOperationHelp = (op: Operation): string => {
    switch (op) {
      case 'AND': return 'Both must be TRUE';
      case 'OR': return 'At least one must be TRUE';
      case 'NOT': return 'Flips TRUE to FALSE and vice versa';
      case 'XOR': return 'Exactly one must be TRUE';
      case 'NAND': return 'NOT (both TRUE)';
      case 'NOR': return 'NOT (either TRUE)';
      default: return '';
    }
  };

  // Render start screen
  if (gameStatus === 'idle') {
    return (
      <ArcadeGameLayout
        gameName="Boolean Blitz"
        gameEmoji="🔲"
        score={0}
        lives={3}
        level={1}
        streak={0}
        onBack={onBack}
        showScore={false}
        showLives={false}
        showLevel={false}
      >
        <div className="boolean-blitz__start">
          <h1 className="boolean-blitz__title">🔲 Boolean Blitz</h1>
          <p className="boolean-blitz__description">
            Master boolean logic!<br />
            Learn AND, OR, NOT, and more.
          </p>

          <div className="boolean-blitz__truth-tables">
            <div className="boolean-blitz__table">
              <h4>AND</h4>
              <div>T AND T = T</div>
              <div>T AND F = F</div>
              <div>F AND T = F</div>
              <div>F AND F = F</div>
            </div>
            <div className="boolean-blitz__table">
              <h4>OR</h4>
              <div>T OR T = T</div>
              <div>T OR F = T</div>
              <div>F OR T = T</div>
              <div>F OR F = F</div>
            </div>
            <div className="boolean-blitz__table">
              <h4>NOT</h4>
              <div>NOT T = F</div>
              <div>NOT F = T</div>
            </div>
          </div>

          <div className="boolean-blitz__instructions">
            <h3>How to Play</h3>
            <ul>
              <li>See a boolean expression</li>
              <li>Click TRUE or FALSE (or press T/F)</li>
              <li>Learn AND, OR, NOT, XOR as you level up!</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="boolean-blitz__high-score">
              High Score: {highScore.toLocaleString()}
            </div>
          )}

          <button className="boolean-blitz__start-button" onClick={startGame}>
            🔲 Start Learning!
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
      gameName="Boolean Blitz"
      gameEmoji="🔲"
      score={score}
      lives={lives}
      level={level}
      streak={streak}
      onBack={onBack}
      onPause={() => setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused')}
      isPaused={gameStatus === 'paused'}
    >
      <div className="boolean-blitz">
        {/* Operation hint */}
        {currentProblem && (
          <div className="boolean-blitz__hint">
            <span className="boolean-blitz__operation">{currentProblem.operation}</span>
            <span className="boolean-blitz__help">{getOperationHelp(currentProblem.operation)}</span>
          </div>
        )}

        {/* Problem display */}
        {currentProblem && (
          <div className="boolean-blitz__problem">
            <div className="boolean-blitz__expression">
              {currentProblem.display}
            </div>
            <div className="boolean-blitz__equals">= ?</div>
          </div>
        )}

        {/* Visual representation */}
        {currentProblem && (
          <div className="boolean-blitz__visual">
            <div className={`boolean-blitz__box ${currentProblem.input1 ? 'boolean-blitz__box--true' : 'boolean-blitz__box--false'}`}>
              {currentProblem.input1 ? '1' : '0'}
            </div>
            {currentProblem.input2 !== undefined && (
              <>
                <div className="boolean-blitz__op-symbol">{currentProblem.operation}</div>
                <div className={`boolean-blitz__box ${currentProblem.input2 ? 'boolean-blitz__box--true' : 'boolean-blitz__box--false'}`}>
                  {currentProblem.input2 ? '1' : '0'}
                </div>
              </>
            )}
            {currentProblem.operation === 'NOT' && (
              <div className="boolean-blitz__op-symbol">NOT</div>
            )}
          </div>
        )}

        {/* Answer buttons */}
        <div className="boolean-blitz__buttons">
          <button
            className={`boolean-blitz__answer boolean-blitz__answer--true ${showFeedback === 'correct' && currentProblem?.answer === true ? 'boolean-blitz__answer--selected-correct' : ''} ${showFeedback === 'wrong' && currentProblem?.answer === true ? 'boolean-blitz__answer--was-correct' : ''}`}
            onClick={() => submitAnswer(true)}
            disabled={!!showFeedback}
          >
            <span className="boolean-blitz__btn-text">TRUE</span>
            <span className="boolean-blitz__btn-key">(T)</span>
          </button>
          <button
            className={`boolean-blitz__answer boolean-blitz__answer--false ${showFeedback === 'correct' && currentProblem?.answer === false ? 'boolean-blitz__answer--selected-correct' : ''} ${showFeedback === 'wrong' && currentProblem?.answer === false ? 'boolean-blitz__answer--was-correct' : ''}`}
            onClick={() => submitAnswer(false)}
            disabled={!!showFeedback}
          >
            <span className="boolean-blitz__btn-text">FALSE</span>
            <span className="boolean-blitz__btn-key">(F)</span>
          </button>
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`boolean-blitz__feedback boolean-blitz__feedback--${showFeedback}`}>
            {showFeedback === 'correct'
              ? '✓ Correct!'
              : `✗ The answer was ${currentProblem?.answer ? 'TRUE' : 'FALSE'}`}
          </div>
        )}

        {/* Level info */}
        <div className="boolean-blitz__level-info">
          Level {level}:
          {level <= 2 && ' AND & OR'}
          {level >= 3 && level <= 4 && ' + NOT'}
          {level >= 5 && level <= 6 && ' + XOR'}
          {level >= 7 && ' + NAND & NOR'}
        </div>
      </div>
    </ArcadeGameLayout>
  );
}
