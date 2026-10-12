import { useEffect, useState } from 'react';
import './FeedbackMessage.css';

interface FeedbackMessageProps {
  isCorrect: boolean | null;
  show: boolean;
}

const encouragingMessages = {
  correct: [
    'Great job!',
    'You\'re on fire!',
    'Amazing!',
    'Keep going!',
    'Awesome!',
    'You rock!',
    'Fantastic!',
    'Super smart!',
    'You did it!',
    'Brilliant!',
  ],
  incorrect: [
    'Try again!',
    'Almost!',
    'You got this!',
    'Keep trying!',
    'So close!',
    'Nice try!',
    'Don\'t give up!',
    'You can do it!',
    'One more time!',
    'Keep practicing!',
  ],
};

export function FeedbackMessage({ isCorrect, show }: FeedbackMessageProps) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (show && isCorrect !== null) {
      const messages = isCorrect ? encouragingMessages.correct : encouragingMessages.incorrect;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      setMessage(randomMessage);
    }
  }, [show, isCorrect]);

  if (!show || isCorrect === null) {
    return null;
  }

  return (
    <div className={`feedback-message ${isCorrect ? 'feedback-message--correct' : 'feedback-message--incorrect'}`}>
      <span className="feedback-message__text">{message}</span>
      {isCorrect && <span className="feedback-message__icon">&#9733;</span>}
    </div>
  );
}
