/**
 * Grown-ups → Test the microphone (`#/grownups/mic`, docs/UX-V3.md §4.4). What a parent opens
 * when "speech doesn't work": a big live meter, one button, one word to say, and a checklist
 * that turns green as each link of the chain is proven:
 *
 *   ✅ Secure page · ✅ Mic allowed · ✅ I can hear you · ✅ Heard "56" in 0.4 s
 *
 * Below: engine in use, model state, Home-Screen flag, the last transcripts with their delay,
 * engine switch and "forget learned phrases".
 */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { PlayButton } from '../../core/ui/PlayButton';
import { TopBar } from '../../core/ui/TopBar';
import { getVoiceManager, micGranted } from '../manager';
import { useVoiceInput, useVoiceState } from '../useVoiceInput';
import { matchNumberHypothesis } from '../match/hypothesis';
import { clearCorrections, getCorrections } from '../match/corrections';
import type { VoiceEnginePreference, VoiceHypothesis } from '../types';
import { MicPanel } from './MicPanel';
import { loadFraction, type HeardChip } from './micLook';
import './voice-ui.css';

const TARGET = 56;
const ENGINE_NAMES: Record<string, string> = {
  moonshine: 'On-device (Moonshine)',
  whisper: 'On-device (Whisper)',
  webspeech: "Browser's speech service",
};

interface Row {
  at: number;
  text: string;
  verdict: string;
  latencyMs?: number;
  engine: string;
}

function standalone(): boolean {
  try {
    return (navigator as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export function MicTest({ onBack }: { onBack?: () => void }) {
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [heard, setHeard] = useState<HeardChip | null>(null);
  const [passMs, setPassMs] = useState<number | null>(null);
  const [heardLevel, setHeardLevel] = useState(false);
  const [allowed, setAllowed] = useState(() => micGranted());
  const [, setTick] = useState(0);
  const snap = useVoiceState();
  const n = useRef(0);

  const onTranscript = (h: VoiceHypothesis) => {
    const r = matchNumberHypothesis(h, { expected: TARGET, maxPlausible: 200 });
    if (!h.isFinal && r.verdict !== 'correct') {
      setHeard({ kind: 'partial', text: h.text });
      return;
    }
    n.current++;
    setRows((xs) => [{ at: Date.now(), text: h.text, verdict: r.verdict, latencyMs: h.latencyMs, engine: h.engine }, ...xs].slice(0, 5));
    if (r.verdict === 'correct') {
      setHeard({ kind: 'ok', text: String(TARGET), id: n.current });
      setPassMs((p) => p ?? (typeof h.latencyMs === 'number' ? h.latencyMs : 0));
    } else if (r.verdict === 'wrong') setHeard({ kind: 'wrong', text: r.heard !== undefined ? String(r.heard) : h.text, id: n.current });
    else setHeard({ kind: 'unsure', text: h.text || 'Say it again?', id: n.current });
  };

  const voice = useVoiceInput({
    enabled: running,
    mode: 'number',
    bias: { numbers: [TARGET] },
    onTranscript,
    onLevel: (l) => {
      if (l > 0.05) setHeardLevel(true);
    },
  });

  useEffect(() => {
    if (voice.status === 'listening' || voice.status === 'hearing') setAllowed(true);
    if (voice.error?.code === 'permission-denied') setAllowed(false);
  }, [voice.status, voice.error]);

  // Stop listening when leaving the page.
  const stopRef = useRef(voice.stop);
  useEffect(() => {
    stopRef.current = voice.stop;
  });
  useEffect(() => () => stopRef.current(), []);

  const start = () => {
    setPassMs(null);
    setHeard(null);
    setHeardLevel(false);
    // Render enabled=true synchronously, then open the mic while still inside the tap (iOS).
    flushSync(() => setRunning(true));
    try {
      void voice.start().catch(() => {});
    } catch {
      /* shown via the panel */
    }
  };
  const stop = () => {
    voice.stop();
    setRunning(false);
  };

  const caps = voice.capabilities;
  const frac = loadFraction(snap.loadProgress, snap.modelState);
  const model =
    snap.modelState === 'ready'
      ? 'Downloaded'
      : snap.modelState === 'loading'
        ? `Downloading${frac !== null ? ` ${Math.round(frac * 100)}%` : '…'}`
        : snap.modelState === 'failed'
          ? 'Download failed'
          : 'Not yet';
  const live = running && (voice.status === 'listening' || voice.status === 'hearing' || voice.status === 'processing');
  const checks: { id: string; ok: boolean; bad?: boolean; text: string }[] = [
    { id: 'secure', ok: caps.secureContext, bad: !caps.secureContext, text: caps.secureContext ? 'Secure page' : 'Not a secure page (needs https://)' },
    { id: 'allowed', ok: allowed, bad: voice.error?.code === 'permission-denied', text: voice.error?.code === 'permission-denied' ? 'Mic is blocked' : 'Mic allowed' },
    { id: 'hear', ok: heardLevel, text: 'I can hear you' },
    {
      id: 'heard',
      ok: passMs !== null,
      text: passMs !== null ? `Heard “${TARGET}” in ${(passMs / 1000).toFixed(1)} s` : `Heard “${TARGET}”`,
    },
  ];
  const passed = checks.every((c) => c.ok);
  const pref = (() => {
    try {
      return getVoiceManager().prefs.engine;
    } catch {
      return 'auto' as VoiceEnginePreference;
    }
  })();
  const learned = getCorrections().filter((c) => c.count >= 2).length;

  return (
    <div className="k-screen vmt-screen" data-testid="mic-test" style={{ overflowY: 'auto' }}>
      {onBack && <TopBar onBack={onBack} title="🎤 Test the microphone" />}
      <main className="vmt">
        <section className="vmt__card">
          <MicPanel voice={voice} size="lg" heard={heard} on={running} reserve say={`say “fifty-six”`} />
          {!live ? (
            <PlayButton variant="mic" label={running ? 'Starting…' : 'Start test'} onClick={start} data-testid="mic-test-start" />
          ) : (
            <button type="button" className="vmp__btn is-ghost is-big" onClick={stop} data-testid="mic-test-stop" style={{ justifySelf: 'center' }}>
              Stop
            </button>
          )}
          <div className="vmt__prompt">
            Say: <b>“fifty-six”</b>
          </div>
          <ul className="vmt__checks" data-testid="mic-checks" data-pass={passed ? 'yes' : 'no'}>
            {checks.map((c) => (
              <li key={c.id} className={c.ok ? 'is-ok' : c.bad ? 'is-bad' : ''} data-testid={`check-${c.id}`} data-ok={c.ok ? 'yes' : 'no'}>
                <span aria-hidden="true">{c.ok ? '✅' : c.bad ? '❌' : '⬜'}</span> {c.text}
              </li>
            ))}
          </ul>
          {passed && <p className="vmt__prompt" style={{ fontSize: 22 }}>All good — talking works here! 🎉</p>}
        </section>

        <section className="vmt__card">
          <table className="vmt__table">
            <tbody>
              <tr>
                <th>Listening with</th>
                <td data-testid="mic-test-engine">{voice.engine ? ENGINE_NAMES[voice.engine] ?? voice.engine : '—'}</td>
              </tr>
              <tr>
                <th>Engine setting</th>
                <td>{pref === 'auto' ? 'Auto (best available)' : ENGINE_NAMES[pref] ?? pref}</td>
              </tr>
              <tr>
                <th>On-device voice brain</th>
                <td data-testid="mic-test-model">
                  {model}
                  {snap.modelState !== 'ready' && snap.modelState !== 'loading' && caps.onDevice && (
                    <>
                      {' '}
                      <button type="button" className="vmp__btn" onClick={() => void getVoiceManager().retryPreload().catch(() => {})}>
                        Download now (~65 MB)
                      </button>
                    </>
                  )}
                </td>
              </tr>
              <tr>
                <th>Status</th>
                <td>{voice.status}{voice.error ? ` — ${voice.error.message}` : ''}</td>
              </tr>
              <tr>
                <th>Home-Screen app</th>
                <td>{standalone() ? 'Yes' : 'No'}</td>
              </tr>
              <tr>
                <th>Browser speech service</th>
                <td>{caps.webspeech ? 'Available' : 'Not available'}</td>
              </tr>
            </tbody>
          </table>
          {rows.length > 0 ? (
            <ul className="vmt__log" data-testid="mic-test-log">
              {rows.map((r) => (
                <li key={r.at}>
                  <span>
                    “{r.text || '(nothing)'}” · {r.verdict}
                  </span>
                  <span className="k-num">{typeof r.latencyMs === 'number' ? `${(r.latencyMs / 1000).toFixed(2)} s` : '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: 'var(--k-ink-soft, #6b7280)' }}>Nothing heard yet.</p>
          )}
          <div className="vmt__row">
            {(['auto', 'webspeech', 'moonshine'] as VoiceEnginePreference[]).map((e) => (
              <button
                key={e}
                type="button"
                className={`vmp__btn${pref === e ? ' is-fix' : ''}`}
                onClick={() => {
                  getVoiceManager().setEngine(e);
                  setTick((t) => t + 1);
                }}
                data-testid={`mic-engine-${e}`}
              >
                {e === 'auto' ? 'Auto' : e === 'webspeech' ? 'Browser ears' : 'On-device ears'}
              </button>
            ))}
            <button
              type="button"
              className="vmp__btn is-ghost"
              onClick={() => {
                clearCorrections();
                setTick((t) => t + 1);
              }}
            >
              Forget learned phrases ({learned})
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
