/**
 * One home-screen pattern for every app (UX-V3 §2.2): a hero card with the level chip, the universal
 * PLAY button and one plain sentence, then a collapsed "More ways to play". The app passes data; the
 * layout is fixed.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { TopBar } from './TopBar';
import { PlayButton } from './PlayButton';
import { CoachMark } from './CoachMark';
import { IdleHint } from './IdleHint';
import { coachDone, useCoachPending } from './coach';
import { appUiStore } from './appUi';
import { beginPlay } from './startPlay';
import { sfx } from '../sound/sfx';
import { updateSettings, useSettings } from '../settings/settingsStore';
import { rewardsStore, todayPoints } from '../rewards/rewardsStore';
import type { AppId } from '../types';
import { MicChip, useVoiceInput, voiceImplemented } from '../../voice';
import './apphome.css';

export interface AppHomeMore {
  id: string;
  title: string;
  node: ReactNode;
}

export interface AppHomeProps {
  appId: AppId;
  title: string;
  emoji: string;
  hero: { levelChip?: ReactNode; subtitle: string; bestLine?: ReactNode; above?: ReactNode; below?: ReactNode };
  /** Navigate to the round. AppHome wraps it with §2.3 (unlock, armMic, markAutostart, rememberLast). */
  onPlay: () => void;
  /** What the hub's Continue button says for this round, e.g. "Sprint 60 · All". */
  playLabel?: string;
  /** The round route onPlay opens (tightens the autostart match). */
  playRoute?: string;
  /** Route the hub's Continue opens (default: the round route that autostarted). */
  continueRoute?: string;
  /** Rendered inside "More ways to play", in order. */
  more: AppHomeMore[];
  /** The More section the level chip opens to (default: the second section, else the first). */
  levelSection?: string;
  /** TopBar right slot; default is the shared 🎤 On/Off toggle. */
  topRight?: ReactNode;
  onBack: () => void;
  /** Disable PLAY (e.g. nothing to play yet). */
  playDisabled?: boolean;
  testId?: string;
  className?: string;
  children?: ReactNode;
}

const selectToday = (s: Parameters<typeof todayPoints>[0]) => todayPoints(s);

const noTranscript = () => {};

/** The shared home 🎤 chip (same icon and place as in play, UX-V3 §2.2). */
export function HomeMicToggle() {
  const settings = useSettings();
  const on = settings.voice.enabled;
  const voice = useVoiceInput({ enabled: false, mode: 'number', onTranscript: noTranscript });
  if (!voiceImplemented || !voice.isSupported) return null;
  return (
    <span data-testid="voice-toggle" aria-pressed={on} className="k-home__mic">
      <MicChip
        voice={voice}
        on={on}
        variant="home"
        onToggle={() => {
          sfx.play('click');
          updateSettings({ voice: { ...settings.voice, enabled: !on } });
        }}
      />
    </span>
  );
}

export function AppHome({
  appId,
  title,
  emoji,
  hero,
  onPlay,
  playLabel,
  playRoute,
  continueRoute,
  more,
  levelSection,
  topRight,
  onBack,
  playDisabled,
  testId,
  className = '',
  children,
}: AppHomeProps) {
  const today = rewardsStore.useStore(selectToday);
  const store = appUiStore(appId);
  const moreOpen = store.useStore((s) => s.moreOpen);
  const playRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const coachPending = useCoachPending('home');

  const play = useCallback(() => {
    if (playDisabled) return;
    coachDone('home');
    beginPlay({ app: appId, label: playLabel ?? title, route: playRoute, continueRoute });
    onPlay();
  }, [appId, onPlay, playDisabled, playLabel, playRoute, continueRoute, title]);

  const setMore = (open: boolean) => store.update((s) => ({ ...s, moreOpen: open }));
  const toggleMore = () => {
    sfx.play('click');
    setMore(!moreOpen);
  };
  const openLevel = () => {
    sfx.play('click');
    setMore(true);
    const id = levelSection ?? (more[1] ?? more[0])?.id;
    requestAnimationFrame(() => {
      const el = id ? document.getElementById(`more-${appId}-${id}`) : moreRef.current;
      try {
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        el?.scrollIntoView();
      }
    });
  };

  // Enter = PLAY on the home (when nothing else has focus).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && t !== document.body && t.closest('button, input, select, textarea, a, [role="radio"]')) return;
      e.preventDefault();
      play();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play]);

  const style = { ['--k-app' as string]: `var(--k-app-${appId})` } as CSSProperties;

  return (
    <div className={`k-screen k-home ${className}`} style={style} data-testid={testId ?? `${appId}-home`}>
      <TopBar
        onBack={onBack}
        title={
          <>
            <span className="k-emoji">{emoji}</span> {title}
          </>
        }
        right={topRight === undefined ? <HomeMicToggle /> : topRight}
        points={today}
      />
      <main className="k-home__main">
        <section className="k-home__hero" data-testid="home-hero">
          {hero.above ?? (
            <span className="k-emoji k-home__emoji" aria-hidden="true">
              {emoji}
            </span>
          )}
          {hero.levelChip && (
            <button type="button" className="k-home__chip" onClick={openLevel} data-testid="level-chip" aria-label="Change level">
              <span className="k-home__chip-text">{hero.levelChip}</span>
              {more.length > 0 && (
                <span className="k-home__chip-caret" aria-hidden="true">
                  ▾
                </span>
              )}
            </button>
          )}
          <PlayButton ref={playRef} onClick={play} disabled={playDisabled} />
          <p className="k-home__sub">{hero.subtitle}</p>
          {hero.bestLine && (
            <div className="k-home__best" data-testid="best-line">
              {hero.bestLine}
            </div>
          )}
          {hero.below}
        </section>

        {more.length > 0 && (
          <div className={`k-more${moreOpen ? ' is-open' : ''}`} ref={moreRef}>
            <button type="button" className="k-more__toggle" onClick={toggleMore} aria-expanded={moreOpen} data-testid="more">
              <span>More ways to play</span>
              <span className="k-more__caret" aria-hidden="true">
                ▸
              </span>
            </button>
            {moreOpen && (
              <div className="k-more__body" data-testid="more-body">
                {more.map((m) => (
                  <section key={m.id} className="k-more__section" id={`more-${appId}-${m.id}`} data-testid={`more-${m.id}`}>
                    <h2 className="k-more__title">{m.title}</h2>
                    {m.node}
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
        {children}
      </main>
      {coachPending ? (
        <CoachMark target={playRef} text="Tap the big green button!" onDismiss={() => coachDone('home')} />
      ) : (
        <IdleHint target={playRef} on={!playDisabled} />
      )}
    </div>
  );
}
