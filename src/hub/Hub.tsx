import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  CoachMark,
  FIRST_ROUND_POINTS,
  IdleHint,
  MIX_BONUS_APPS,
  MIX_BONUS_POINTS,
  PlayButton,
  ProgressRing,
  TROPHIES,
  appsPlayedToday,
  beginPlay,
  coachDone,
  currentGoalStreak,
  firstRoundAvailableIn,
  rankFor,
  sfx,
  todayPoints,
  useCoachPending,
  useLastPlayed,
  useRewards,
  useSettings,
  weekPoints,
} from '../core';
import type { AppDefinition, AppGroup, RewardsState } from '../core';
import { APPS, getApp } from '../apps/registry';
import { TrophySheet } from './TrophySheet';
import { preloadVoice, retryVoicePreload, useVoiceState, voiceImplemented, voiceModelState } from '../voice';
import { appProgress, flushProgress } from './appProgress';
import './hub.css';

const GROUPS: Array<{ id: AppGroup; title: string; emoji: string }> = [
  { id: 'math', title: 'Math', emoji: '🧮' },
  { id: 'reading', title: 'Reading', emoji: '📖' },
  { id: 'world', title: 'Maps', emoji: '🌍' },
];

interface HubProps {
  navigate: (to: string) => void;
}

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Hi' : 'Good evening';
  return name ? `${part}, ${name}!` : `${part}!`;
}

function AppCard({ app, rewards, bonus, anyPlayed, onOpen }: { app: AppDefinition; rewards: RewardsState; bonus: boolean; anyPlayed: boolean; onOpen: () => void }) {
  const ready = app.enabled && Boolean(app.load);
  const progress = ready ? appProgress(app.id, rewards) : null;
  const played = progress && !progress.fresh && progress.text;
  return (
    <button
      type="button"
      className={`hub-app${ready ? '' : ' is-soon'}`}
      style={{ ['--k-app' as string]: `var(${app.color})` } as CSSProperties}
      onClick={ready || app.load ? onOpen : undefined}
      data-testid={`app-${app.id}`}
      aria-disabled={!(ready || app.load)}
      aria-label={`${app.title}. ${played ? progress.text : app.tagline}. Tap to play.`}
    >
      <span className="k-emoji hub-app__emoji">{app.emoji}</span>
      <span className="hub-app__text">
        <span className="hub-app__title">{app.title}</span>
        {played ? (
          <span className="hub-app__progress" data-testid={`progress-${app.id}`}>
            {progress.text}
          </span>
        ) : (
          <span className="hub-app__tag">{ready ? app.tagline : 'Coming soon'}</span>
        )}
      </span>
      {/* On a brand-new device every card is new, so the chip would say nothing: show it once he has played something. */}
      {anyPlayed && progress?.fresh && <span className="hub-app__new">✨ New!</span>}
      {bonus && (
        <span className="hub-app__bonus" data-testid={`bonus-${app.id}`} title="First round today pays a bonus">
          ⭐ +{FIRST_ROUND_POINTS}
        </span>
      )}
      <span className="hub-app__go" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}

/** Press-and-hold 1.5 s to open the parent area (so a 7-year-old doesn't wander in). */
function GrownUpsButton({ onOpen }: { onOpen: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => cancel, []);
  return (
    <button
      type="button"
      className={`hub-grownups${holding ? ' is-holding' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        setHolding(true);
        timer.current = setTimeout(() => {
          setHolding(false);
          sfx.play('pop');
          onOpen();
        }, 1500);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="grownups"
      aria-label="Grown-ups: press and hold"
    >
      <span className="hub-grownups__fill" aria-hidden="true" />
      <span className="hub-grownups__label">
        <span className="k-emoji">🔒</span> Grown-ups
      </span>
      {holding && <span className="hub-grownups__hint">keep holding…</span>}
    </button>
  );
}

/** Fetch + warm the on-device voice model while he is looking at the hub (one-time ~65 MB). */
function useVoicePreload(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !voiceImplemented) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    // A download that failed earlier (offline, flaky wifi) is retried on the next hub visit.
    const run = () => void (voiceModelState() === 'failed' ? retryVoicePreload() : preloadVoice());
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(run, 1200);
    return () => clearTimeout(t);
  }, [enabled]);
}

function VoiceBrainChip() {
  const v = useVoiceState();
  const p = v.loadProgress;
  if (v.modelState === 'failed' || v.modelState === 'ready') return null;
  if (!p || p.phase === 'done' || p.fraction >= 1) return null;
  const pct = Math.round(Math.max(0, Math.min(1, p.fraction)) * 100);
  return (
    <div className="hub-brain" data-testid="voice-brain" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className="k-emoji">🧠</span> Voice brain loading <b className="k-num">{pct}%</b>
      <span className="hub-brain__bar">
        <span style={{ transform: `scaleX(${pct / 100})` }} />
      </span>
    </div>
  );
}

/** Where "Continue" goes: the last round he started, else Times Tables Sprint. */
function useContinue(showHidden: boolean) {
  const last = useLastPlayed();
  const def = last.app ? getApp(last.app) : undefined;
  if (last.route && def && (def.enabled || showHidden) && def.load) {
    return { app: def.id, route: last.route, label: last.label, text: `PLAY · ${def.title}${last.label ? ` · ${last.label}` : ''}` };
  }
  return { app: 'multiplication' as const, route: '/multiplication/play/sprint60/all', label: 'Sprint · Everything', text: 'START HERE · Times Tables' };
}

export function Hub({ navigate }: HubProps) {
  const r = useRewards();
  const settings = useSettings();
  const today = todayPoints(r);
  const week = weekPoints(r);
  const bank = Math.max(0, r.lifetime - r.redeemed);
  const rank = rankFor(r.lifetime);
  const streak = currentGoalStreak(r);
  const goal = settings.dailyGoal;
  const goalDone = today >= goal;
  const apps = APPS.filter((a) => a.enabled || settings.showHiddenApps);
  const playedToday = appsPlayedToday(r).length;
  // Rounds that just ended may still be in a write buffer: flush once so the cards are current.
  useState(flushProgress);
  const rg = r.rewardGoal;
  const rgProgress = rg ? Math.max(0, r.lifetime - rg.startPoints) : 0;
  useVoicePreload(settings.voice.enabled);
  const [sheet, setSheet] = useState(false);
  const closeSheet = useCallback(() => setSheet(false), []);
  const cont = useContinue(settings.showHiddenApps);
  const continueRef = useRef<HTMLButtonElement>(null);
  const coachPending = useCoachPending('hub');
  const trophyCount = Object.keys(r.trophies).length;

  const playContinue = () => {
    coachDone('hub');
    beginPlay({ app: cont.app, label: cont.label, route: cont.route, continueRoute: cont.route });
    navigate(cont.route);
  };

  return (
    <div className="k-screen hub" data-testid="hub">
      <header className="hub-hero">
        <h1 className="hub-hello__title">{greeting(settings.kidName)}</h1>
        <div className="hub-stats">
          <div className="hub-stat hub-stat--today" aria-label={`${today} points today, goal ${goal}`}>
            <ProgressRing
              value={today / goal}
              size={64}
              stroke={8}
              color={goalDone ? 'var(--k-success)' : 'var(--k-accent)'}
              label={<span className="k-emoji hub-ring__icon">{goalDone ? '✅' : '⭐'}</span>}
            />
            <span className="hub-stat__body">
              <b className="k-num hub-stat__big" data-testid="hub-today">
                {today.toLocaleString()}
              </b>
              <span className="hub-stat__small">today · goal {goal.toLocaleString()}</span>
            </span>
          </div>
          <div className="hub-stat" data-testid="rank" title={rank.next ? `${rank.pointsToNext} to ${rank.next.name}` : 'Top rank!'}>
            <span className="k-emoji hub-stat__emoji">{rank.rank.emoji}</span>
            <span className="hub-stat__body">
              <b className="hub-stat__name">{rank.rank.name}</b>
              {rank.next && (
                <span className="hub-stat__bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(4, rank.progress * 100)}%` }} />
                </span>
              )}
            </span>
          </div>
          {streak > 0 && (
            <div className="hub-stat hub-stat--streak">
              <span className="k-emoji">🔥</span> <b className="k-num">{streak}</b>
            </div>
          )}
          <button type="button" className="hub-stat hub-stat--trophy" onClick={() => setSheet(true)} data-testid="trophies">
            <span className="k-emoji">🏆</span>{' '}
            <b className="k-num">
              {trophyCount}/{TROPHIES.length}
            </b>
          </button>
        </div>
      </header>

      {rg && (
        <div className="hub-reward" data-testid="reward-goal">
          <span className="k-emoji hub-reward__emoji">{rg.emoji || '🎁'}</span>
          <div className="hub-reward__body">
            <div className="hub-reward__title">
              {rg.title}
              <span className="k-num">
                {' '}
                {Math.min(rgProgress, rg.targetPoints).toLocaleString()} / {rg.targetPoints.toLocaleString()}
              </span>
            </div>
            <div className="hub-bar hub-bar--reward">
              <div className="hub-bar__fill" style={{ width: `${Math.min(1, rgProgress / rg.targetPoints) * 100}%` }} />
            </div>
          </div>
          {rgProgress >= rg.targetPoints && <span className="hub-reward__done">Ask a grown-up!</span>}
        </div>
      )}

      <PlayButton ref={continueRef} variant="continue" label={cont.text} onClick={playContinue} data-testid="continue" className="hub-continue" />

      {playedToday > 0 && playedToday < MIX_BONUS_APPS && (
        <div className="hub-mix" data-testid="mix-bonus">
          <span className="k-emoji">🌈</span> Play {MIX_BONUS_APPS - playedToday} more different {MIX_BONUS_APPS - playedToday === 1 ? 'app' : 'apps'} today for <b>+{MIX_BONUS_POINTS}</b>
        </div>
      )}

      {(() => {
        const anyPlayed = apps.some((a) => a.enabled && a.load && !appProgress(a.id, r).fresh);
        const section = (g: (typeof GROUPS)[number]) => {
          const list = apps.filter((a) => a.group === g.id);
          if (!list.length) return null;
          // The first-round bonus badge shows on at most one card per group (none on a brand-new device).
          const bonusId = !anyPlayed ? undefined : list.find((a) => a.enabled && a.load && firstRoundAvailableIn(r, a.id))?.id;
          return (
            <section key={g.id} className={`hub-group hub-group--${g.id}`} aria-label={g.title} data-testid={`group-${g.id}`}>
              <h2 className="hub-group__title">
                <span className="k-emoji">{g.emoji}</span> {g.title}
              </h2>
              <div className="hub-apps">
                {list.map((a) => (
                  <AppCard
                    key={a.id}
                    app={a}
                    rewards={r}
                    bonus={a.id === bonusId}
                    anyPlayed={anyPlayed}
                    onOpen={() => {
                      sfx.play('click');
                      navigate(`/${a.id}`);
                    }}
                  />
                ))}
              </div>
            </section>
          );
        };
        const [math, ...rest] = GROUPS;
        return (
          <>
            {section(math)}
            <div className="hub-row">{rest.map(section)}</div>
          </>
        );
      })()}

      {settings.voice.enabled && voiceImplemented && <VoiceBrainChip />}

      <footer className="hub-foot">
        <GrownUpsButton onOpen={() => navigate('/grownups')} />
      </footer>

      {sheet && <TrophySheet rewards={r} today={today} week={week} bank={bank} streak={streak} onClose={closeSheet} />}
      {coachPending ? (
        <CoachMark target={continueRef} text="Tap here to play!" onDismiss={() => coachDone('hub')} show={!sheet} />
      ) : (
        <IdleHint target={continueRef} on={!sheet} />
      )}
    </div>
  );
}
