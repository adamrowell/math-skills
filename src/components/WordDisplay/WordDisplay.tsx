import { ReadingWord } from '../../config/readingConfig';
import './WordDisplay.css';

interface WordDisplayProps {
  currentWord: ReadingWord | null;
  previousWord: ReadingWord | null;
  previousWasCorrect: boolean | null;
  nextWord: ReadingWord | null;
  showSyllables: boolean;
  showSidePanels?: boolean;
  isSkipping?: boolean;
}

export function WordDisplay({
  currentWord,
  previousWord,
  previousWasCorrect,
  nextWord,
  showSyllables,
  showSidePanels = true,
  isSkipping = false,
}: WordDisplayProps) {
  if (!currentWord) {
    return (
      <div className="word-display">
        <div className="word-display__loading">Loading...</div>
      </div>
    );
  }

  // Highlight the word in the sentence
  const renderSentence = (word: ReadingWord) => {
    const wordLower = word.word.toLowerCase();
    const sentenceLower = word.sentence.toLowerCase();
    const index = sentenceLower.indexOf(wordLower);

    if (index === -1) {
      return <span>{word.sentence}</span>;
    }

    const before = word.sentence.slice(0, index);
    const match = word.sentence.slice(index, index + word.word.length);
    const after = word.sentence.slice(index + word.word.length);

    return (
      <>
        {before}
        <span className="word-display__sentence-highlight">{match}</span>
        {after}
      </>
    );
  };

  // Render syllables with visual separation
  const renderSyllables = (word: ReadingWord) => {
    if (!word.syllables || word.syllables.length <= 1) {
      return null;
    }

    return (
      <div className="word-display__syllables">
        {word.syllables.map((syllable, i) => (
          <span key={i} className="word-display__syllable">
            {syllable}
            {i < word.syllables!.length - 1 && (
              <span className="word-display__syllable-dot">·</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="word-display">
      {/* Previous word (left side panel) */}
      {showSidePanels && previousWord && (
        <div
          className={`word-display__side word-display__side--prev ${
            previousWasCorrect === true
              ? 'word-display__side--correct'
              : previousWasCorrect === false
              ? 'word-display__side--incorrect'
              : ''
          }`}
        >
          <span className="word-display__side-word">{previousWord.word}</span>
          {previousWasCorrect !== null && (
            <span className="word-display__side-indicator">
              {previousWasCorrect ? '✓' : '✗'}
            </span>
          )}
        </div>
      )}

      {/* Current word (center) */}
      <div className={`word-display__main ${isSkipping ? 'word-display__main--skipping' : ''}`}>
        <div className="word-display__card">
          {/* The main word */}
          <div className="word-display__word-container">
            <span className="word-display__word">{currentWord.word}</span>
          </div>

          {/* Syllable breakdown (if enabled and available) */}
          {showSyllables && renderSyllables(currentWord)}

          {/* Example sentence */}
          <div className="word-display__sentence">
            {renderSentence(currentWord)}
          </div>

          {/* Skip overlay */}
          {isSkipping && (
            <div className="word-display__skip-overlay">
              <span className="word-display__skip-text">Listen carefully...</span>
            </div>
          )}
        </div>
      </div>

      {/* Next word (right side panel) */}
      {showSidePanels && nextWord && (
        <div className="word-display__side word-display__side--next">
          <span className="word-display__side-label">Next:</span>
          <span className="word-display__side-word word-display__side-word--blurred">
            {nextWord.word}
          </span>
        </div>
      )}
    </div>
  );
}
