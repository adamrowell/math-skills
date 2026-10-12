import { BigButton, sfx } from '../../core';
import { Equation } from './Equation';
import type { Tok } from './problems';
import type { ExplainerKind } from './explainerKind';

const n = (v: number): Tok => ({ t: 'n', v });
const EQ: Tok = { t: 'op', v: '=' };

const CONTENT: Record<ExplainerKind, { emoji: string; title: string; rows: Array<{ eq: Tok[]; say: string }> }> = {
  x: {
    emoji: '❎',
    title: 'Meet x — the mystery number!',
    rows: [
      { eq: [{ t: 'x' }, { t: 'op', v: '+' }, n(5), EQ, n(12)], say: 'What plus 5 makes 12? x is 7!' },
      { eq: [{ t: 'x', c: 3 }, EQ, n(24)], say: '3x means 3 × x. So x is 8.' },
      { eq: [{ t: 'frac', c: 4 }, EQ, n(6)], say: 'x on top of 4 means x ÷ 4. So x is 24.' },
    ],
  },
  paper: {
    emoji: '✏️',
    title: 'Two steps — grab some paper!',
    rows: [
      { eq: [{ t: 'x', c: 2 }, { t: 'op', v: '+' }, n(3), EQ, n(11)], say: 'Step 1: take 3 from both sides.' },
      { eq: [{ t: 'x', c: 2 }, EQ, n(8)], say: 'Step 2: what times 2 makes 8?' },
      { eq: [{ t: 'x' }, EQ, n(4)], say: 'No clock here. Being right in a row earns more!' },
    ],
  },
  pics: {
    emoji: '🍎',
    title: 'Crack the picture code!',
    rows: [
      { eq: [{ t: 'pic', v: '🍎' }, { t: 'op', v: '+' }, { t: 'pic', v: '🍎' }, EQ, n(10)], say: 'Two apples make 10, so one 🍎 is 5.' },
      { eq: [{ t: 'pic', v: '🍎' }, { t: 'op', v: '+' }, { t: 'pic', v: '🍌' }, EQ, n(8)], say: '5 + 🍌 = 8, so 🍌 is 3!' },
    ],
  },
};

export function Explainer({ kind, onDone }: { kind: ExplainerKind; onDone: () => void }) {
  const c = CONTENT[kind];
  return (
    <div className="al-explainer" data-testid="explainer">
      <div className="al-explainer__title">
        <span className="k-emoji">{c.emoji}</span> {c.title}
      </div>
      <ul className="al-explainer__rows">
        {c.rows.map((r, i) => (
          <li key={i} className="al-explainer__row" style={{ animationDelay: `${i * 250}ms` }}>
            <Equation lines={[r.eq]} size="mid" />
            <span className="al-explainer__say">{r.say}</span>
          </li>
        ))}
      </ul>
      <BigButton
        size="xl"
        onClick={() => {
          sfx.unlock();
          sfx.play('pop');
          onDone();
        }}
        data-testid="explainer-ok"
      >
        Got it! <span className="k-emoji">👍</span>
      </BigButton>
    </div>
  );
}
