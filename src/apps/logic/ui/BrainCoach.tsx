/**
 * Brain Coach (docs/GEO-LOGIC.md §E.7): steps through the puzzle's explanation, then shows the
 * answer and the rule. Opens after a second miss, or for free from "Why?" after a right answer.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BigButton, getSettings, sfx } from '../../../core';
import type { Puzzle } from '../engine/types';
import { Visual } from '../engine/Visual';
import { speak, stopSpeaking } from '../speech';

interface Props {
  puzzle: Puzzle;
  /** The answer, drawn the way it was asked (option picture, number, grid). */
  answer: ReactNode;
  /** One-line "how to think" tip (first miss-out of a family). */
  tip?: string;
  /** Opened from "Why?" after a right answer. */
  afterCorrect?: boolean;
  onClose: () => void;
}

export function BrainCoach({ puzzle, answer, tip, afterCorrect, onClose }: Props) {
  const steps = puzzle.explanation;
  const [i, setI] = useState(0);
  const last = i >= steps.length;
  const step = last ? null : steps[i];

  useEffect(() => {
    if (!getSettings().soundOn) return;
    speak(step ? step.text : `The rule: ${puzzle.rule}.`);
  }, [step, puzzle.rule]);
  useEffect(() => () => stopSpeaking(), []);

  const next = () => {
    sfx.play('click');
    setI((x) => x + 1);
  };

  return (
    <div className="lg-coach" role="dialog" aria-modal="true" aria-label="Brain Coach" data-testid="coach">
      <div className="lg-coach__card">
        <div className="lg-coach__head">
          <span className="k-emoji">🧠</span> {afterCorrect ? 'Here’s why' : 'Let’s look'}
          <span className="lg-coach__dots" aria-hidden="true">
            {steps.map((_, k) => (
              <span key={k} className={k <= i ? 'is-on' : ''} />
            ))}
            <span className={last ? 'is-on' : ''} />
          </span>
        </div>
        {tip && i === 0 && (
          <div className="lg-coach__tip" data-testid="coach-tip">
            <span className="k-emoji">💡</span> {tip}
          </div>
        )}
        {step ? (
          <>
            <p className="lg-coach__text" data-testid="coach-text">
              {step.text}
            </p>
            {step.visual && (
              <div className="lg-coach__visual">
                <Visual spec={step.visual} highlight={step.highlight} testId="coach-visual" />
              </div>
            )}
          </>
        ) : (
          <>
            <p className="lg-coach__text">The answer:</p>
            <div className="lg-coach__answer" data-testid="coach-answer">
              {answer}
            </div>
            <p className="lg-coach__rule" data-testid="coach-rule">
              <span className="k-emoji">✨</span> {puzzle.rule}
            </p>
          </>
        )}
        <div className="lg-coach__actions">
          {last ? (
            <BigButton size="lg" onClick={onClose} data-testid="coach-done" autoFocus>
              Got it
            </BigButton>
          ) : (
            <>
              <BigButton size="md" variant="ghost" onClick={onClose} data-testid="coach-skip">
                Skip
              </BigButton>
              <BigButton size="lg" onClick={next} data-testid="coach-next" autoFocus>
                Next ›
              </BigButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
