import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { UseVoiceInput, UseVoiceInputOptions, UseVoiceInputResult, VoiceEnginePreference } from './types';
import { getVoiceManager, type VoiceConsumer } from './manager';

let nextConsumerId = 1;

/**
 * React binding for the shared voice manager.
 *
 *   const voice = useVoiceInput({ enabled, mode: 'number', bias: { numbers: [answer] }, onTranscript });
 *   <button onClick={() => { voice.start(); startRound(); }}>Sprint!</button>
 *
 * - start() must be called from a tap/click handler the first time (iOS).
 * - The mic stays open across questions while `enabled` stays true; pass the current
 *   answer in `bias.numbers` so the on-device scorer always scores it.
 * - enabled=false or unmount releases the mic.
 */
export const useVoiceInput: UseVoiceInput = (options: UseVoiceInputOptions): UseVoiceInputResult => {
  const mgr = getVoiceManager();
  const snap = useSyncExternalStore(mgr.subscribe, mgr.getSnapshot, mgr.getSnapshot);

  const optsRef = useRef(options);
  useLayoutEffect(() => {
    optsRef.current = options;
  });

  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = nextConsumerId++;

  // A stable consumer whose fields always read the latest options.
  const consumer = useMemo<VoiceConsumer>(() => {
    const id = idRef.current;
    return {
      id,
      get mode() {
        return optsRef.current.mode;
      },
      get bias() {
        return optsRef.current.bias;
      },
      get preferredEngine() {
        return optsRef.current.preferredEngine;
      },
      onTranscript: (h) => {
        if (optsRef.current.enabled) optsRef.current.onTranscript(h);
      },
      onLevel: (r) => optsRef.current.onLevel?.(r),
      onError: (e) => optsRef.current.onError?.(e),
      onStatus: (s) => optsRef.current.onStatus?.(s),
    };
  }, []);

  const { enabled, mode } = options;
  const biasKey = JSON.stringify(options.bias ?? null);

  // enabled → false (round over) or unmount: release the mic.
  useEffect(() => {
    if (!enabled) mgr.release(consumer.id);
  }, [enabled, mgr, consumer]);
  useEffect(() => () => mgr.release(consumer.id), [mgr, consumer]);

  // Mode / bias / engine changed while listening → retarget without reopening the mic.
  useEffect(() => {
    if (enabled) mgr.update(consumer);
  }, [enabled, mode, biasKey, options.preferredEngine, mgr, consumer]);

  const start = useCallback((): Promise<void> => {
    if (!optsRef.current.enabled) return Promise.resolve();
    return mgr.start(consumer);
  }, [mgr, consumer]);

  const stop = useCallback(() => mgr.release(consumer.id), [mgr, consumer]);
  const setEngine = useCallback((p: VoiceEnginePreference) => mgr.setEngine(p), [mgr]);
  const preload = useCallback(() => mgr.preload(optsRef.current.preferredEngine), [mgr]);

  const capabilities = mgr.capabilities();
  const isSupported = capabilities.secureContext && (capabilities.onDevice || capabilities.webspeech);

  return {
    status: snap.status,
    engine: snap.engine,
    error: snap.error,
    loadProgress: snap.loadProgress,
    level: snap.level,
    isSupported,
    capabilities,
    start,
    stop,
    setEngine,
    preload,
  };
};

/** Read-only view of the shared voice state (hub chip, parent diagnostics). */
export function useVoiceState() {
  const mgr = getVoiceManager();
  return useSyncExternalStore(mgr.subscribe, mgr.getSnapshot, mgr.getSnapshot);
}
