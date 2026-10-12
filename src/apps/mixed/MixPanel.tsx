import { masteryStore } from '../../drill';
import { mixSummary } from './facts';

const NAMES = { mul: 'Times', div: 'Divide', add: 'Add', sub: 'Take away' } as const;

/** "Your mix": the four operations, how much of a round each one is, and how strong he is at it. */
export function MixPanel() {
  const mixed = masteryStore('mixed').useStore();
  const multiplication = masteryStore('multiplication').useStore();
  const division = masteryStore('division').useStore();
  const addition = masteryStore('addition').useStore();
  const rows = mixSummary(mixed, { multiplication, division, addition });
  return (
    <section className="mx-mix" data-testid="mix-panel" aria-label="Your mix">
      <h2 className="mx-mix__title">Your mix</h2>
      <div className="mx-mix__grid">
        {rows.map((r) => {
          const pct = r.total ? r.strong / r.total : 0;
          return (
            <div key={r.op} className={`mx-op mx-op--${r.op}`} data-testid={`mix-${r.op}`}>
              <div className="mx-op__sym k-num">{r.symbol}</div>
              <div className="mx-op__name">{NAMES[r.op]}</div>
              <div className="mx-op__bar" aria-label={`${r.strong} of ${r.total} strong`}>
                <span style={{ width: `${Math.max(3, pct * 100)}%` }} />
              </div>
              <div className="mx-op__meta">
                <span className="k-emoji">⭐</span> <b className="k-num">{r.strong}</b>/{r.total} strong
              </div>
              <div className="mx-op__meta">{r.share}% of a round</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
