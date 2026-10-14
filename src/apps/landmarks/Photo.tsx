import { useState } from 'react';

/** Self-hosted landmark photo (public/landmarks/<id>.webp); relative to the app base so it works on Pages. */
const photoUrl = (id: string, thumb = false) => `${import.meta.env.BASE_URL}landmarks/${id}${thumb ? '-thumb' : ''}.webp`;

interface Props {
  id: string;
  alt: string;
  thumb?: boolean;
  className?: string;
  eager?: boolean;
  testId?: string;
}

/** A 4:3 photo with a soft placeholder while it loads (and if it ever fails). Remounts per id. */
export function Photo(props: Props) {
  return <PhotoImg key={`${props.id}${props.thumb ? '-t' : ''}`} {...props} />;
}

function PhotoImg({ id, alt, thumb, className = '', eager, testId }: Props) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  return (
    <span className={`lm-photo is-${state} ${className}`} data-testid={testId}>
      {state !== 'error' && (
        <img
          src={photoUrl(id, thumb)}
          alt={alt}
          width={thumb ? 240 : 800}
          height={thumb ? 180 : 600}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
        />
      )}
      {state === 'error' && <span className="k-emoji lm-photo__fallback">🏞️</span>}
    </span>
  );
}
