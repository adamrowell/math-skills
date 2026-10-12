import { useRef, useState } from 'react';
import {
  BigButton,
  TopBar,
  flushAllStores,
  last7,
  persist,
  pointsByApp,
  thisWeekKeys,
  rewards,
  rewardsStore,
  settingsStore,
  shortDayName,
  resetCoach,
  toast,
  todayPoints,
  updateSettings,
  useRewards,
  useSettings,
  weekPoints,
} from '../core';
import {
  clearCorrections,
  getCorrections,
  getVoiceDiagnostics,
  MicTest,
  retryVoicePreload,
  useVoiceInput,
  useVoiceState,
  voiceImplemented,
  voicePrefsStore,
} from '../voice';
import type { VoiceEnginePreference } from '../voice';
import { masteryStore } from '../drill';
import { APPS } from '../apps/registry';
import { ParentGate } from './ParentGate';
import './hub.css';

/** Session-only unlock: re-gated after a reload. */
let unlocked = false;

interface Props {
  onExit: () => void;
}

const PRESETS = [50, 100, 250, 500];
const noop = () => {};

const ENGINE_NAMES: Record<string, string> = {
  webspeech: "the browser's speech recognition",
  moonshine: 'the on-device voice brain (Moonshine)',
  whisper: 'the on-device voice brain (Whisper)',
};

/** One plain-English line for the parent (no raw enum values). */
/** When progress was last exported (kept outside the ms2: namespace, so it is not exported itself). */
const LAST_EXPORT_KEY = 'math-skills:lastExport';

function voiceStatusLine(
  modelState: 'idle' | 'loading' | 'ready' | 'failed',
  engine: string | null,
  progress: { fraction: number } | null,
): string {
  const brain =
    modelState === 'ready'
      ? 'Voice brain: downloaded and ready.'
      : modelState === 'loading'
        ? `Voice brain: downloading${progress ? ` (${Math.round(progress.fraction * 100)}%)` : ''}…`
        : modelState === 'failed'
          ? 'Voice brain: download failed.'
          : 'Voice brain: not downloaded yet.'
  ;
  const using = engine ? ` Last used: ${ENGINE_NAMES[engine] ?? engine}.` : '';
  return brain + using;
}

function VoicePanel() {
  const voice = useVoiceInput({ enabled: false, mode: 'number', onTranscript: noop });
  const snap = useVoiceState();
  const caps = voice.capabilities;
  const yes = (b: boolean) => (b ? '✅' : '—');
  if (!voiceImplemented) {
    return <p className="pa-muted">Voice engine is still being set up in this build. Typing works everywhere.</p>;
  }
  return (
    <div className="pa-voice">
      <div className="pa-row">
        <label className="pa-label" htmlFor="pa-engine">
          Engine
        </label>
        <select
          id="pa-engine"
          className="pa-input"
          defaultValue={voicePrefsStore.get().engine}
          onChange={(e) => voice.setEngine(e.target.value as VoiceEnginePreference)}
        >
          <option value="auto">Auto (best available)</option>
          <option value="moonshine">Moonshine (on-device)</option>
          <option value="whisper">Whisper (on-device)</option>
          <option value="webspeech">Browser speech</option>
        </select>
      </div>
      <ul className="pa-caps">
        <li>Secure page (needed for mic): {yes(caps.secureContext)}</li>
        <li>On-device models: {yes(caps.onDevice)}</li>
        <li>WebGPU: {yes(caps.webgpu)}</li>
        <li>Browser speech: {yes(caps.webspeech)}</li>
        <li data-testid="voice-status">{voiceStatusLine(snap.modelState, voice.engine, voice.loadProgress)}</li>
        {voice.error && voice.error.code !== 'aborted' && <li className="pa-err">{voice.error.message}</li>}
      </ul>
      {snap.modelState === 'failed' ? (
        <>
          <p className="pa-muted" data-testid="voice-failed">
            The voice brain could not download (offline or blocked?). The browser&apos;s own speech recognition is used
            instead, so talking still works.
          </p>
          <BigButton size="md" variant="ghost" onClick={() => void retryVoicePreload()} data-testid="voice-retry">
            Download again
          </BigButton>
        </>
      ) : snap.modelState !== 'ready' ? (
        <BigButton size="md" variant="ghost" onClick={() => void voice.preload().catch(noop)}>
          Download voice brain now (~65 MB, once)
        </BigButton>
      ) : null}
      <VoiceDiagnostics />
    </div>
  );
}

function VoiceDiagnostics() {
  const [, setTick] = useState(0);
  let d: ReturnType<typeof getVoiceDiagnostics> | null = null;
  try {
    d = getVoiceDiagnostics();
  } catch {
    d = null;
  }
  if (!d) return null;
  const learned = getCorrections().filter((c) => c.count >= 2).length;
  const ms = (x: number | null | undefined) => (typeof x === 'number' ? `${Math.round(x)} ms` : '—');
  return (
    <details className="pa-diag" data-testid="voice-diagnostics">
      <summary>Voice details</summary>
      <ul className="pa-caps">
        <li>
          Model: <b>{d.model ?? '—'}</b> {d.backend ? `(${d.backend})` : ''} · load {ms(d.loadMs)} · warm-up {ms(d.warmMs)}
        </li>
        <li>
          Answer delay: p50 {ms(d.latencyP50)} · p90 {ms(d.latencyP90)}
        </li>
        <li>
          Adapting to his voice: accept bar {d.acceptMargin.toFixed(2)} · learned phrases {learned}
        </li>
      </ul>
      {d.samples.length > 0 ? (
        <table className="pa-diag__table">
          <thead>
            <tr>
              <th>Heard</th>
              <th>Result</th>
              <th>Delay</th>
            </tr>
          </thead>
          <tbody>
            {d.samples
              .slice()
              .reverse()
              .map((x, i) => (
                <tr key={`${x.ts}-${i}`}>
                  <td>{x.text || '(nothing)'}</td>
                  <td>{x.verdict ?? '—'}</td>
                  <td className="k-num">{ms(x.latencyMs)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p className="pa-muted">Nothing heard yet this session.</p>
      )}
      <div className="pa-row">
        <BigButton size="md" variant="ghost" onClick={() => setTick((t) => t + 1)}>
          Refresh
        </BigButton>
        <BigButton
          size="md"
          variant="ghost"
          onClick={() => {
            clearCorrections();
            setTick((t) => t + 1);
          }}
        >
          Forget learned voice
        </BigButton>
      </div>
    </details>
  );
}

function ParentHome({ onExit, onMicTest }: Props & { onMicTest?: () => void }) {
  const r = useRewards();
  const settings = useSettings();
  const bank = Math.max(0, r.lifetime - r.redeemed);
  const days = last7(r);
  const maxDay = Math.max(1, ...days.map((d) => d.points));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalEmoji, setGoalEmoji] = useState('🎁');
  const [goalTarget, setGoalTarget] = useState('1000');
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetApp, setResetApp] = useState('');
  const byApp = pointsByApp(thisWeekKeys(), r);
  const appRows = APPS.filter((a) => a.enabled)
    .map((a) => ({ app: a, points: Math.max(0, byApp[a.id] ?? 0) }))
    .sort((a, b) => b.points - a.points);
  const maxApp = Math.max(1, ...appRows.map((x) => x.points));

  const doRedeem = (pts: number, why: string) => {
    if (!(pts > 0)) {
      toast.show('Enter how many points', { emoji: '✏️' });
      return;
    }
    if (pts > bank) {
      toast.show(`Only ${bank} points in the bank`, { emoji: '⚠️' });
      return;
    }
    rewards.redeem(pts, why || 'Reward');
    setAmount('');
    setNote('');
    toast.show(`Redeemed ${pts} points`, { emoji: '🎁', kind: 'success' });
  };

  const rg = r.rewardGoal;
  const rgProgress = rg ? Math.max(0, r.lifetime - rg.startPoints) : 0;

  const [lastExport, setLastExport] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(LAST_EXPORT_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const backupDue = bank > 0 && Date.now() - lastExport > 14 * 24 * 3600 * 1000;

  const exportData = () => {
    flushAllStores();
    try {
      localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
    } catch {
      /* storage blocked */
    }
    setLastExport(Date.now());
    const data: Record<string, unknown> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ms2:')) data[k] = JSON.parse(localStorage.getItem(k) ?? 'null');
      }
    } catch {
      /* storage blocked */
    }
    const blob = new Blob([JSON.stringify({ app: 'math-skills', exportedAt: new Date().toISOString(), data }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `math-skills-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { data?: Record<string, unknown> };
      if (!parsed.data || typeof parsed.data !== 'object') throw new Error('bad file');
      if (!window.confirm('Replace all progress on this device with the file?')) return;
      // Validate/repair every known store before writing it (an old or hand-edited file must
      // never white-screen the app).
      const known: Record<string, { hydrate: (raw: unknown) => unknown }> = {
        'ms2:rewards:v1': rewardsStore,
        'ms2:settings:v1': settingsStore,
        'ms2:mastery:multiplication:v1': masteryStore('multiplication'),
      };
      for (const [k, v] of Object.entries(parsed.data)) {
        if (!k.startsWith('ms2:')) continue;
        const store = known[k];
        localStorage.setItem(k, JSON.stringify(store ? store.hydrate(v) : v));
      }
      window.location.reload();
    } catch {
      toast.show('That file could not be read', { emoji: '⚠️' });
    }
  };

  /** Forget one app's progress (mastery, levels, stars, gallery). Points and trophies are kept. */
  const resetOneApp = () => {
    const app = APPS.find((a) => a.id === resetApp);
    if (!app) return;
    if (!window.confirm(`Reset all ${app.title} progress on this device? Points are kept.`)) return;
    flushAllStores();
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ms2:') && k.split(':').includes(app.id)) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  return (
    <div className="k-screen pa" data-testid="parent-area">
      <TopBar onBack={onExit} title={<>Grown-ups</>} />
      <main className="pa-main">
        {!persist.available && (
          <div className="pa-warn">Saving is off on this browser (private mode?). Progress lasts until the page closes.</div>
        )}

        <section className="pa-card">
          <h2>Points</h2>
          <div className="pa-totals">
            <div className="pa-total">
              <div className="pa-total__v k-num">{todayPoints(r).toLocaleString()}</div>
              <div className="pa-total__l">Today</div>
            </div>
            <div className="pa-total">
              <div className="pa-total__v k-num">{weekPoints(r).toLocaleString()}</div>
              <div className="pa-total__l">This week</div>
            </div>
            <div className="pa-total">
              <div className="pa-total__v k-num">{r.lifetime.toLocaleString()}</div>
              <div className="pa-total__l">All time</div>
            </div>
            <div className="pa-total pa-total--bank">
              <div className="pa-total__v k-num" data-testid="pa-bank">
                {bank.toLocaleString()}
              </div>
              <div className="pa-total__l">Bank (not yet redeemed)</div>
            </div>
          </div>
          <div className="pa-bars" aria-label="Points per day, last 7 days">
            {days.map((d) => (
              <div key={d.key} className="pa-bar">
                <div className="pa-bar__v k-num">{d.points || ''}</div>
                <div className="pa-bar__col">
                  <div className="pa-bar__fill" style={{ height: `${(d.points / maxDay) * 100}%` }} />
                </div>
                <div className="pa-bar__d">{shortDayName(d.key)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="pa-card" data-testid="pa-by-app">
          <h2>Points by app (this week)</h2>
          <div className="pa-apps">
            {appRows.map(({ app, points }) => (
              <div key={app.id} className="pa-app">
                <span className="pa-app__name">
                  <span className="k-emoji">{app.emoji}</span> {app.title}
                </span>
                <span className="pa-app__bar">
                  <span className="pa-app__fill" style={{ width: `${(points / maxApp) * 100}%`, background: `var(${app.color})` }} />
                </span>
                <span className="pa-app__v k-num">{points.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="pa-card">
          <h2>Redeem points</h2>
          <div className="pa-presets">
            {PRESETS.map((p) => (
              <button key={p} type="button" className="pa-preset" onClick={() => setAmount(String(p))}>
                {p}
              </button>
            ))}
          </div>
          <div className="pa-row">
            <input
              className="pa-input pa-input--num"
              inputMode="numeric"
              placeholder="Points"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 6))}
              data-testid="redeem-amount"
            />
            <input
              className="pa-input"
              placeholder="For what? e.g. 30 min Minecraft"
              value={note}
              maxLength={80}
              onChange={(e) => setNote(e.target.value)}
              data-testid="redeem-note"
            />
          </div>
          <BigButton variant="primary" onClick={() => doRedeem(Number(amount), note)} data-testid="redeem">
            Redeem
          </BigButton>
          {r.redemptions.length > 0 && (
            <ul className="pa-history">
              {r.redemptions.slice(0, 15).map((x) => (
                <li key={x.id}>
                  <span>{new Date(x.ts).toLocaleDateString()}</span>
                  <span className="pa-history__note">{x.note}</span>
                  <b className="k-num">−{x.points}</b>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pa-card">
          <h2>Reward goal</h2>
          {rg ? (
            <div className="pa-goal">
              <div>
                <span className="k-emoji">{rg.emoji}</span> <b>{rg.title}</b> —{' '}
                <span className="k-num">
                  {Math.min(rgProgress, rg.targetPoints)} / {rg.targetPoints}
                </span>
              </div>
              <div className="pa-row">
                {rgProgress >= rg.targetPoints && (
                  <BigButton
                    size="md"
                    variant="success"
                    onClick={() => {
                      doRedeem(rg.targetPoints, rg.title);
                      if (rg.targetPoints <= bank) rewards.setRewardGoal(null);
                    }}
                  >
                    Give reward
                  </BigButton>
                )}
                <BigButton size="md" variant="ghost" onClick={() => rewards.setRewardGoal(null)}>
                  Clear
                </BigButton>
              </div>
            </div>
          ) : (
            <>
              <p className="pa-muted">Shows a progress bar on the home screen, counting points earned from now.</p>
              <div className="pa-row">
                <input
                  className="pa-input pa-input--emoji"
                  value={goalEmoji}
                  maxLength={4}
                  onChange={(e) => setGoalEmoji(e.target.value)}
                  aria-label="Emoji"
                />
                <input
                  className="pa-input"
                  placeholder="e.g. Ice cream trip"
                  value={goalTitle}
                  maxLength={40}
                  onChange={(e) => setGoalTitle(e.target.value)}
                />
                <input
                  className="pa-input pa-input--num"
                  inputMode="numeric"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  aria-label="Points needed"
                />
              </div>
              <BigButton
                size="md"
                variant="primary"
                onClick={() => {
                  const t = Number(goalTarget);
                  if (!goalTitle.trim() || !(t > 0)) {
                    toast.show('Add a name and points', { emoji: '✏️' });
                    return;
                  }
                  rewards.setRewardGoal({ title: goalTitle.trim(), emoji: goalEmoji || '🎁', targetPoints: t });
                  setGoalTitle('');
                }}
              >
                Set goal
              </BigButton>
            </>
          )}
        </section>

        <section className="pa-card">
          <h2>Settings</h2>
          <div className="pa-row">
            <label className="pa-label" htmlFor="pa-name">
              Child's name
            </label>
            <input
              id="pa-name"
              className="pa-input"
              value={settings.kidName}
              maxLength={20}
              onChange={(e) => updateSettings({ kidName: e.target.value })}
            />
          </div>
          <div className="pa-row">
            <label className="pa-label" htmlFor="pa-goal">
              Daily goal: <b className="k-num">{settings.dailyGoal}</b> points
            </label>
            <input
              id="pa-goal"
              type="range"
              min={200}
              max={3000}
              step={50}
              value={settings.dailyGoal}
              onChange={(e) => updateSettings({ dailyGoal: Number(e.target.value) })}
            />
          </div>
          <label className="pa-toggle">
            <input type="checkbox" checked={settings.soundOn} onChange={(e) => updateSettings({ soundOn: e.target.checked })} />
            Sounds
          </label>
          <label className="pa-toggle">
            <input
              type="checkbox"
              checked={settings.voice.enabled}
              onChange={(e) => updateSettings({ voice: { ...settings.voice, enabled: e.target.checked } })}
            />
            Voice answers (microphone)
          </label>
          <label className="pa-toggle">
            <input
              type="checkbox"
              checked={settings.showHiddenApps}
              onChange={(e) => updateSettings({ showHiddenApps: e.target.checked })}
            />
            Show unfinished apps on the home screen
          </label>
          <div className="pa-row">
            <label className="pa-label" htmlFor="pa-wb">
              Workbook typing (2-digit + and −)
            </label>
            <select
              id="pa-wb"
              className="pa-select"
              value={settings.workbookEntry ?? 'ones'}
              onChange={(e) => updateSettings({ workbookEntry: e.target.value === 'ltr' ? 'ltr' : 'ones' })}
              data-testid="pa-workbook-entry"
            >
              <option value="ones">Ones first, like on paper</option>
              <option value="ltr">Left to right</option>
            </select>
          </div>
          <div className="pa-row">
            <BigButton
              size="md"
              variant="ghost"
              onClick={() => {
                resetCoach();
                toast.show('Tips will show again', { emoji: '👆' });
              }}
              data-testid="pa-show-tips"
            >
              <span className="k-emoji">👆</span> Show the tips again
            </BigButton>
          </div>
        </section>

        <section className="pa-card">
          <h2>Voice</h2>
          {onMicTest && (
            <BigButton size="md" onClick={onMicTest} data-testid="mic-test-open">
              <span className="k-emoji">🎤</span> Test the microphone
            </BigButton>
          )}
          <VoicePanel />
        </section>

        <section className="pa-card">
          <h2>Progress data</h2>
          <p className="pa-muted" data-testid="pa-storage-note">
            Points live only on this device. On iPad/iPhone use the Home Screen app: Safari can delete a site&rsquo;s data after 7 days
            without a visit, and Safari and the Home Screen app keep separate points.
          </p>
          {backupDue && (
            <p className="pa-warn" data-testid="pa-backup-due">
              No backup in a while. Tap Export to save a copy of the points.
            </p>
          )}
          <div className="pa-row pa-row--wrap">
            <BigButton size="md" variant="ghost" onClick={exportData}>
              Export
            </BigButton>
            <BigButton size="md" variant="ghost" onClick={() => fileRef.current?.click()}>
              Import
            </BigButton>

          </div>
          <div className="pa-row pa-row--wrap">
            <select className="pa-select" value={resetApp} onChange={(e) => setResetApp(e.target.value)} data-testid="reset-app-select" aria-label="App to reset">
              <option value="">Reset one app…</option>
              {APPS.filter((a) => a.enabled).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <BigButton size="md" variant="danger" onClick={resetOneApp} disabled={!resetApp} data-testid="reset-app">
              Reset progress
            </BigButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importData(f);
                e.target.value = '';
              }}
            />
          </div>
        </section>
      </main>
    </div>
  );
}


export function ParentArea({ onExit, sub, navigate }: Props & { sub?: string; navigate?: (to: string) => void }) {
  const [ok, setOk] = useState(unlocked);
  if (!ok) {
    return (
      <ParentGate
        onPass={() => {
          unlocked = true;
          setOk(true);
        }}
        onFail={onExit}
      />
    );
  }
  // Grown-ups → Test the microphone (docs/UX-V3.md §4.4).
  if (sub === 'mic') return <MicTest onBack={() => (navigate ? navigate('/grownups') : onExit())} />;
  return <ParentHome onExit={onExit} onMicTest={navigate ? () => navigate('/grownups/mic') : undefined} />;
}
