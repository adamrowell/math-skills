import { useState } from 'react';
import { FLAG_BY_CC, flagSrc } from './data/flags';

interface Props {
  cc: string;
  /** Accessible name; defaults to "Flag of <country>". Pass '' for decorative flags next to the name. */
  alt?: string;
  className?: string;
}

/** A flag in a 4:3 frame with a thin border (white-heavy flags like Japan need the edge). */
export function Flag({ cc, alt, className }: Props) {
  const [broken, setBroken] = useState(false);
  const name = FLAG_BY_CC.get(cc)?.name ?? cc.toUpperCase();
  return (
    <span className={`fl-flag${className ? ` ${className}` : ''}`} data-cc={cc}>
      {broken ? (
        <span className="fl-flag__fallback">{cc.toUpperCase()}</span>
      ) : (
        <img src={flagSrc(cc)} alt={alt ?? `Flag of ${name}`} draggable={false} onError={() => setBroken(true)} data-testid="flag-img" />
      )}
    </span>
  );
}
