/**
 * Emoji pictures for a story, made for counting: rows of five (like a ten frame), groups in
 * boxes, two rows lined up for "how many more", number tiles for sequences.
 * `solved` shows the worked version (take-away crossed out, sharing dealt into groups, extras lit).
 */
import type { CSSProperties } from 'react';
import type { Pic } from './problems';

function sizeFor(n: number): number {
  return n <= 10 ? 36 : n <= 16 ? 30 : 26;
}

function Row({ emoji, count, crossFrom, litFrom, testId }: { emoji: string; count: number; crossFrom?: number; litFrom?: number; testId?: string }) {
  return (
    <span className="st-pics" data-testid={testId} data-count={count}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`st-pic k-emoji${crossFrom !== undefined && i >= crossFrom ? ' is-gone' : ''}${litFrom !== undefined && i >= litFrom ? ' is-lit' : ''}${i % 5 === 4 ? ' is-five' : ''}`}
        >
          {emoji}
        </span>
      ))}
    </span>
  );
}

export function Picture({ pic, solved = false, input = '', answer }: { pic: Pic; solved?: boolean; input?: string; answer?: number }) {
  if (pic.kind === 'seq') {
    return (
      <div className="st-seq" data-testid="story-seq">
        {pic.items.map((v, i) => (
          <span key={i} className={`st-seq__tile k-num${v === null ? ' is-box' : ''}${v === null && solved ? ' is-solved' : ''}`}>
            {v === null ? (solved ? answer : input || '?') : v}
          </span>
        ))}
      </div>
    );
  }
  const max =
    pic.kind === 'join' ? pic.parts.reduce((a, b) => a + b, 0) : pic.kind === 'take' ? pic.total : pic.kind === 'compare' ? Math.max(...pic.rows.map((r) => r.count)) : pic.kind === 'groups' ? pic.groups * pic.each : pic.total;
  const style = { ['--st-pic' as string]: `${sizeFor(max)}px` } as CSSProperties;

  if (pic.kind === 'join') {
    return (
      <div className="st-picture st-picture--join" style={style} data-testid="story-picture">
        {pic.parts.map((p, i) => (
          <span key={i} className="st-picture__part">
            {i > 0 && <span className="st-picture__op">+</span>}
            <Row emoji={pic.emoji} count={p} />
          </span>
        ))}
        {solved && <span className="st-picture__eq k-num">= {pic.parts.reduce((a, b) => a + b, 0)}</span>}
      </div>
    );
  }
  if (pic.kind === 'take') {
    return (
      <div className="st-picture st-picture--take" style={style} data-testid="story-picture">
        <Row emoji={pic.emoji} count={pic.total} crossFrom={solved ? pic.total - pic.away : undefined} />
        {solved && <span className="st-picture__eq k-num">{pic.total - pic.away} left</span>}
      </div>
    );
  }
  if (pic.kind === 'compare') {
    const min = Math.min(...pic.rows.map((r) => r.count));
    return (
      <div className="st-picture st-picture--compare" style={style} data-testid="story-picture">
        {pic.rows.map((r) => (
          <div key={r.label} className="st-compare">
            <span className="st-compare__label">{r.label}</span>
            <Row emoji={pic.emoji} count={r.count} litFrom={solved ? min : undefined} />
          </div>
        ))}
      </div>
    );
  }
  if (pic.kind === 'groups') {
    return (
      <div className="st-picture st-picture--groups" style={style} data-testid="story-picture">
        {Array.from({ length: pic.groups }, (_, i) => (
          <span key={i} className="st-group">
            <Row emoji={pic.emoji} count={pic.each} />
          </span>
        ))}
      </div>
    );
  }
  // share
  const each = pic.total / pic.groups;
  return (
    <div className="st-picture st-picture--groups" style={style} data-testid="story-picture">
      {solved ? (
        Array.from({ length: pic.groups }, (_, i) => (
          <span key={i} className="st-group">
            <Row emoji={pic.emoji} count={each} />
          </span>
        ))
      ) : (
        <>
          <Row emoji={pic.emoji} count={pic.total} />
          <span className="st-picture__op">→</span>
          {Array.from({ length: pic.groups }, (_, i) => (
            <span key={i} className="st-group is-empty" aria-hidden="true" />
          ))}
        </>
      )}
    </div>
  );
}
