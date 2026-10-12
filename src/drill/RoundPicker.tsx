import { useState } from 'react';
import type { FactSetDescriptor, RoundFormat, RoundPickerProps } from './types';
import { formatBest } from './formats';
import './drill.css';

function Chip({ s, on, onClick, tile }: { s: FactSetDescriptor; on: boolean; onClick: () => void; tile?: boolean }) {
  // Numeric hints only ("2·5·10"); word chips would just repeat the title.
  const sub = !tile && s.chip && /\d/.test(s.chip) ? s.chip : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      className={`dr-chip${on ? ' is-on' : ''}${tile ? ' dr-chip--tile' : ''}`}
      onClick={onClick}
      data-testid={`set-${s.id}`}
      title={s.description ?? s.title}
    >
      {s.emoji && !tile && <span className="k-emoji">{s.emoji}</span>}
      {tile ? (s.chip ?? s.title) : s.title}
      {sub && <span className="dr-chip__sub k-num">{sub}</span>}
    </button>
  );
}

export interface SetChipsProps {
  sets: FactSetDescriptor[];
  selectedSetId: string;
  onSelectSet: (setId: string) => void;
  /** Ids shown as chips (≤ 4, in order). Everything else lives behind one "more" chip. Default: first 4 non-table sets. */
  primary?: string[];
  /** Label of the "more" chip, e.g. "One table". */
  moreLabel?: string;
  moreEmoji?: string;
}

/**
 * "Which facts" (UX-V3 §2.2): at most four chips plus one chip that opens a tile grid with the rest
 * (single tables, 3·4, 11·12 …). Choosing never starts a round.
 */
export function SetChips({ sets, selectedSetId, onSelectSet, primary, moreLabel = 'One table', moreEmoji = '🔢' }: SetChipsProps) {
  const ids = primary ?? sets.filter((s) => !s.id.startsWith('table-')).slice(0, 4).map((s) => s.id);
  const main = ids.map((id) => sets.find((s) => s.id === id)).filter((s): s is FactSetDescriptor => Boolean(s));
  const rest = sets.filter((s) => !ids.includes(s.id));
  const inRest = rest.some((s) => s.id === selectedSetId);
  const [open, setOpen] = useState(inRest);
  const showRest = open && rest.length > 0;
  const selectedRest = rest.find((s) => s.id === selectedSetId);
  return (
    <div className="dr-picker">
      <div className="dr-chips" role="radiogroup" aria-label="Which facts">
        {main.map((s) => (
          <Chip key={s.id} s={s} on={s.id === selectedSetId} onClick={() => onSelectSet(s.id)} />
        ))}
        {rest.length > 0 && (
          <button
            type="button"
            className={`dr-chip dr-chip--more${showRest ? ' is-open' : ''}${inRest ? ' is-on' : ''}`}
            aria-expanded={showRest}
            onClick={() => setOpen((o) => !o)}
            data-testid="pick-table"
          >
            <span className="k-emoji">{moreEmoji}</span>
            {selectedRest ? (selectedRest.chip ?? selectedRest.title) : moreLabel}
            <span aria-hidden="true">{showRest ? '▴' : '▾'}</span>
          </button>
        )}
      </div>
      {showRest && (
        <div className="dr-chips dr-chips--tables" role="radiogroup" aria-label={moreLabel} data-testid="table-chips">
          {rest.map((s) => (
            <Chip key={s.id} s={s} tile on={s.id === selectedSetId} onClick={() => onSelectSet(s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export interface FormatCardsProps {
  formats: RoundFormat[];
  setId: string;
  /** Plays that format immediately with the current set. */
  onStart: (format: RoundFormat, setId: string) => void;
  bests: Record<string, number | null>;
}

/** Other round formats as cards; tapping one plays it right away (UX-V3 §2.2). Best only when one exists. */
export function FormatCards({ formats, setId, onStart, bests }: FormatCardsProps) {
  return (
    <div className="dr-formats">
      {formats.map((f) => {
        const best = bests[`${f.id}:${setId}`];
        return (
          <button key={f.id} type="button" className="dr-format" onClick={() => onStart(f, setId)} data-testid={`format-${f.id}`}>
            <span className="k-emoji dr-format__emoji">{f.emoji}</span>
            <span className="dr-format__title">{f.title}</span>
            <span className="dr-format__desc">{f.description}</span>
            {f.bestMetric !== 'none' && best !== null && best !== undefined && (
              <span className="dr-format__best">
                <span className="k-emoji">🏅</span> Best <span className="k-num">{formatBest(f, best)}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Legacy combined picker (chips + format cards). */
export function RoundPicker({ formats, sets, selectedSetId, onSelectSet, onStart, bests }: RoundPickerProps) {
  return (
    <div className="dr-picker">
      <SetChips sets={sets} selectedSetId={selectedSetId} onSelectSet={onSelectSet} />
      <FormatCards formats={formats} setId={selectedSetId} onStart={onStart} bests={bests} />
    </div>
  );
}
