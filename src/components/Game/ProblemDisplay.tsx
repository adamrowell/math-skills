import { MathProblem } from '../../utils/mathGenerator';
import './ProblemDisplay.css';

interface ProblemDisplayProps {
  currentProblem: MathProblem | null;
  previousProblem: MathProblem | null;
  previousWasCorrect: boolean | null;
  nextProblem: MathProblem | null;
  showSidePanels: boolean;
}

export function ProblemDisplay({
  currentProblem,
  previousProblem,
  previousWasCorrect,
  nextProblem,
  showSidePanels,
}: ProblemDisplayProps) {
  return (
    <div className={`problem-display ${showSidePanels ? 'problem-display--with-panels' : ''}`}>
      {showSidePanels && (
        <div className="problem-display__side problem-display__side--prev">
          {previousProblem && (
            <div
              className={`problem-card problem-card--previous ${previousWasCorrect ? 'problem-card--correct' : 'problem-card--incorrect'}`}
            >
              <span className="problem-card__label">Previous</span>
              <span className="problem-card__text">{previousProblem.displayText}</span>
              <span className="problem-card__answer">
                = {previousProblem.answer}
                {previousWasCorrect ? ' ✓' : ' ✗'}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="problem-display__main">
        {currentProblem ? (
          <div className="problem-card problem-card--current">
            <span className="problem-card__inline">
              <span className="problem-card__expression">{currentProblem.displayText}</span>
              <span className="problem-card__equals">=</span>
              <span className="problem-card__question">?</span>
            </span>
          </div>
        ) : (
          <div className="problem-card problem-card--empty">
            <span>Get ready!</span>
          </div>
        )}
      </div>

      {showSidePanels && (
        <div className="problem-display__side problem-display__side--next">
          {nextProblem && (
            <div className="problem-card problem-card--next">
              <span className="problem-card__label">Next up</span>
              <span className="problem-card__text problem-card__text--blurred">
                {nextProblem.displayText}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
