/**
 * Photo credits (docs/GEO-LOGIC.md §D.9) — required by the CC BY / CC BY-SA licenses. Generated data
 * (scripts/fetch-landmarks.mjs → data/credits.json).
 */
import { TopBar } from '../../core';
import credits from './data/credits.json';
import { Photo } from './Photo';

interface CreditRow {
  id: string;
  name: string;
  file: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

const ROWS = (credits as { photos: CreditRow[] }).photos;

export function Credits({ onBack }: { onBack: () => void }) {
  return (
    <div className="k-screen lm-screen lm-credits" style={{ ['--k-app' as string]: 'var(--k-app-landmarks)' }} data-testid="credits-screen">
      <TopBar onBack={onBack} title="Photo credits" />
      <div className="lm-scroll">
        <ul className="lm-credits__list">
          {ROWS.map((r) => (
            <li key={r.id} className="lm-credits__row" data-testid="credit-row">
              <Photo id={r.id} alt={r.name} thumb />
              <div className="lm-credits__text">
                <b>{r.name}</b>
                <span>
                  Photo: {r.author} ·{' '}
                  {r.licenseUrl ? (
                    <a href={r.licenseUrl} target="_blank" rel="noopener noreferrer">
                      {r.license}
                    </a>
                  ) : (
                    r.license
                  )}{' '}
                  ·{' '}
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                    source
                  </a>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="lm-credits__foot">
          Photos from Wikimedia Commons, cropped and resized; CC BY-SA photos remain under the same license. Flags: flag-icons (MIT).
        </p>
      </div>
    </div>
  );
}
