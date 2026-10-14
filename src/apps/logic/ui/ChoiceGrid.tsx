import type { ChoiceOption } from '../engine/types';
import { Visual } from '../engine/Visual';

const EMOJI_ONLY = /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\u{FE0F}\u{200D}]*$/u;

interface Props {
  options: ChoiceOption[];
  /** Greyed (already tried) options. */
  wrong: number[];
  /** Outline this option green (correct pick / reveal). */
  right?: number | null;
  onPick: (i: number, el: HTMLElement) => void;
  disabled?: boolean;
}

/** 4 / 5 / 6 big answer buttons: pictures or words. */
export function ChoiceGrid({ options, wrong, right, onPick, disabled }: Props) {
  const isText = options.every((o) => o.text !== undefined);
  const emojiOnly = isText && options.every((o) => EMOJI_ONLY.test(o.text ?? ''));
  const longest = isText ? Math.max(...options.map((o) => o.text?.length ?? 0)) : 0;
  const cls = [
    'lg-choices',
    `lg-choices--n${options.length}`,
    isText ? 'lg-choices--text' : 'lg-choices--visual',
    emojiOnly ? 'lg-choices--emoji' : '',
    isText && !emojiOnly && longest > 7 ? 'lg-choices--long' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} data-testid="choices" role="group" aria-label="Answers">
      {options.map((o, i) => {
        const isWrong = wrong.includes(i);
        const isRight = right === i;
        return (
          <button
            key={i}
            type="button"
            className={`lg-choice${isWrong ? ' is-wrong' : ''}${isRight ? ' is-right' : ''}`}
            data-testid={`choice-${i}`}
            data-choice={i}
            disabled={isWrong || disabled}
            aria-label={o.text ?? o.visual?.label ?? `Answer ${i + 1}`}
            onClick={(e) => onPick(i, e.currentTarget)}
          >
            {o.visual ? (
              <Visual spec={o.visual} size="sm" testId="option-visual" />
            ) : (
              <span className={`lg-choice__text${emojiOnly ? ' k-emoji' : ''}`}>{o.text}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
