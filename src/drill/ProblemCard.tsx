import { forwardRef } from 'react';
import type { RoundState } from './types';
import type { DrillRoundExtras } from './useDrillRound';
import { entryOrderFor } from './useDrillRound';
import { layoutFor } from './columns';
import { Workbook } from './Workbook';
import { useSettings } from '../core';

interface ProblemCardProps {
  state: RoundState;
  extras: DrillRoundExtras;
  /** Sprint: show the running correct count. */
  showCount: boolean;
  /** Widest answer this generator can ask (digits): the box never hints at the answer's length. */
  answerDigits: number;
}

function RetypeTimer({ until }: { until: number }) {
  const total = until - performance.now();
  return (
    <div className="dr-retype-timer" aria-hidden="true">
      <div className="dr-retype-timer__fill" style={{ animationDuration: `${Math.max(0, total)}ms` }} />
    </div>
  );
}

/** Problem + answer display (a div, never an input) + retype + heard bubble. */
export const ProblemCard = forwardRef<HTMLDivElement, ProblemCardProps>(function ProblemCard(
  { state, extras, showCount, answerDigits },
  ref,
) {
  const { current, input, status, lastVerdict, heard, pendingPartial } = state;
  const settings = useSettings() as unknown as { workbookEntry?: unknown };
  const retype = status === 'retype' || (status === 'paused' && lastVerdict === 'wrong');
  const last = state.answered[state.answered.length - 1];
  const given = retype && last && !last.correct ? last.given : undefined;
  const lastVia = last?.via;

  if (!current) return <div className="dr-card" ref={ref} />;
  const boxWidth = `${Math.max(2, answerDigits) * 0.68 + 0.6}em`;

  const verdictClass = lastVerdict === 'correct' ? ' is-correct' : retype ? ' is-wrong' : '';
  // Multi-digit + / −: workbook columns, typed ones-first (UX-V3 §5).
  const layout = layoutFor(current);
  const order = entryOrderFor(current, settings.workbookEntry);
  const wb = layout === 'workbook';

  return (
    <div
      className={`dr-card${verdictClass}${wb ? ' dr-card--wb' : ''}`}
      ref={ref}
      data-testid="problem-card"
      data-status={status}
      data-q={state.questionIndex}
      data-layout={layout}
      data-entry={order}
    >
      {showCount && (
        <div className="dr-card__count" aria-label={`${state.correctCount} correct`}>
          <span className="k-emoji">✅</span>{' '}
          <span className="k-num" data-testid="correct-count">
            {state.correctCount}
          </span>
        </div>
      )}
      <div className="dr-card__score" aria-label={`${state.points} points this round`}>
        <span className="k-emoji">⭐</span>{' '}
        <span className="k-num dr-card__score-n" key={state.points} data-testid="round-points">
          {state.points.toLocaleString()}
        </span>
      </div>

      {!retype && wb ? (
        <>
          <span className="k-visually-hidden" data-testid="problem" aria-live="polite">
            {current.prompt}
          </span>
          <Workbook
            key={state.questionIndex}
            fact={current}
            input={input}
            order={order}
            answerDigits={answerDigits}
            mode={lastVerdict === 'correct' ? 'correct' : 'play'}
          />
          <span className="k-visually-hidden" data-testid="answer">
            {input}
          </span>
        </>
      ) : !retype ? (
        <>
          <div className="dr-problem k-num" data-testid="problem" key={state.questionIndex}>
            {current.prompt}
          </div>
          <div className="dr-answer-row">
            <span className="dr-eq">=</span>
            <div
              className={`dr-answer k-num${input ? '' : ' is-empty'}`}
              data-testid="answer"
              aria-live="polite"
              style={{ minWidth: boxWidth }}
            >
              {input || <span className="dr-caret" />}
            </div>
          </div>
        </>
      ) : (
        <div className="dr-retype do-shake" key={`r${extras.nudge}`} data-testid="retype">
          {given !== undefined && (
            <div className="dr-retype__given">
              {lastVia === 'voice' ? 'I heard' : 'Not'} <s className="k-num">{given}</s>
            </div>
          )}
          {wb ? (
            <>
              <span className="k-visually-hidden" data-testid="problem">
                {current.prompt} = {current.answer}
              </span>
              <Workbook
                key={`r${state.questionIndex}`}
                fact={current}
                input={input}
                order={order}
                answerDigits={answerDigits}
                mode="retype"
              />
            </>
          ) : (
            <div className="dr-problem dr-problem--retype k-num" data-testid="problem">
              {current.prompt} = <b className="dr-retype__ans">{current.answer}</b>
            </div>
          )}
          <div className="dr-retype__hint">
            Type <b className="k-num">{current.answer}</b>
          </div>
          {wb ? (
            <span className="k-visually-hidden" data-testid="answer">
              {input}
            </span>
          ) : (
            <div className="dr-answer-row">
              <div
                className={`dr-answer dr-answer--retype k-num${input ? '' : ' is-empty'}`}
                data-testid="answer"
                style={{ minWidth: boxWidth }}
              >
                {input || <span className="dr-caret" />}
              </div>
            </div>
          )}
          {extras.retypeUntil && status === 'retype' && (
            <RetypeTimer until={extras.retypeUntil} key={extras.retypeUntil} />
          )}
        </div>
      )}

      <div className="dr-heard-slot">
        {(heard || extras.unclear) && (
          <div className={`dr-heard${extras.unclear ? ' is-unclear' : ''}`} data-testid="heard">
            <span className="k-emoji">{extras.unclear ? '❓' : '👂'}</span>
            <span>{pendingPartial ? `${pendingPartial}…` : heard}</span>
          </div>
        )}
      </div>
    </div>
  );
});
