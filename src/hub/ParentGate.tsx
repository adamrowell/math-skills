import { useState } from 'react';
import { Keypad, TopBar, sfx } from '../core';
import './hub.css';

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

interface Props {
  onPass: () => void;
  onFail: () => void;
}

/** A 2-digit × 1-digit question: easy for a grown-up, not for a 7-year-old. */
export function ParentGate({ onPass, onFail }: Props) {
  const [q] = useState(() => ({ a: rand(14, 29), b: rand(3, 9) }));
  const [input, setInput] = useState('');
  const answer = String(q.a * q.b);

  const check = (v: string) => {
    if (v === answer) {
      sfx.play('correct');
      onPass();
    } else {
      sfx.play('wrong');
      onFail();
    }
  };

  return (
    <div className="k-screen pa-gate" data-testid="parent-gate">
      <TopBar onBack={onFail} title="Grown-ups only" />
      <div className="pa-gate__body">
        <div className="pa-gate__q k-num" data-testid="gate-question">
          {q.a} × {q.b} = <span className="pa-gate__a">{input || '?'}</span>
        </div>
        <Keypad
          size="md"
          value={input}
          onDigit={(d) => {
            const v = (input + d).slice(0, 4);
            setInput(v);
            if (v.length >= answer.length) check(v);
          }}
          onBackspace={() => setInput((s) => s.slice(0, -1))}
          onClear={() => setInput('')}
          onSubmit={() => input && check(input)}
        />
      </div>
    </div>
  );
}
