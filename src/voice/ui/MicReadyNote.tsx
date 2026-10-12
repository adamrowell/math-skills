import type { UseVoiceInputResult } from '../types';
import { useVoiceState } from '../useVoiceInput';
import { loadFraction } from './micLook';

/**
 * Ready-card line telling him how voice works right now (one short sentence). Hidden while the
 * browser's own speech service is already listening (the better model is just on its way).
 */
export function MicReadyNote({ voice, on }: { voice: UseVoiceInputResult; on: boolean }) {
  const { modelState } = useVoiceState();
  if (!on) return null;
  const webspeechLive = voice.engine === 'webspeech' && voice.status !== 'off' && voice.status !== 'error';
  const brain = webspeechLive ? null : loadFraction(voice.loadProgress, modelState);
  if (voice.error && !voice.error.recoverable) return null;
  if (voice.error)
    return (
      <div className="dr-ready__tip is-err" data-testid="voice-note">
        <span className="k-emoji">🎤</span> Mic is not working. Use the keys!
      </div>
    );
  if (brain !== null)
    return (
      <div className="dr-ready__tip dr-brain" data-testid="voice-note">
        <div className="dr-brain__row">
          <span className="k-emoji">🧠</span> Getting my ears ready… <b className="k-num">{Math.round(brain * 100)}%</b>
        </div>
        <div className="dr-brain__bar">
          <span style={{ transform: `scaleX(${brain})` }} />
        </div>
        <div className="dr-brain__sub">You can type meanwhile!</div>
      </div>
    );
  return (
    <div className="dr-ready__tip" data-testid="voice-note">
      Type it or say it <span className="k-emoji">👂</span>
    </div>
  );
}
