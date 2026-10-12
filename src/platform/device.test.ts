import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noteModelLoad, preferSmallSpeechModel } from './device';

function setup(ua: string, screenW: number, deviceMemory?: number) {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('navigator', { userAgent: ua, maxTouchPoints: 5, deviceMemory });
  vi.stubGlobal('screen', { width: screenW, height: 800 });
  vi.stubGlobal('addEventListener', () => {});
  return store;
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15';

describe('preferSmallSpeechModel', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the base model on iPad and modern iPhones', () => {
    setup(IPAD, 820);
    expect(preferSmallSpeechModel()).toBe(false);
    setup(IPHONE, 393);
    expect(preferSmallSpeechModel()).toBe(false);
  });

  it('uses the small model on small iPhones and low-RAM Chromium devices', () => {
    setup(IPHONE, 375);
    expect(preferSmallSpeechModel()).toBe(true);
    setup('Mozilla/5.0 (Linux; Android 10) Chrome/120', 412, 2);
    expect(preferSmallSpeechModel()).toBe(true);
  });

  it('remembers a load that never finished (tab killed) and switches to the small model', () => {
    setup(IPAD, 820);
    noteModelLoad('start'); // visit 1: killed mid-load, no pagehide
    expect(preferSmallSpeechModel()).toBe(false);
    noteModelLoad('start'); // visit 2 sees the stale marker
    expect(preferSmallSpeechModel()).toBe(true);
    noteModelLoad('done');
    expect(preferSmallSpeechModel()).toBe(true); // sticky: the small model worked, keep it
  });

  it('a finished or failed load clears the marker', () => {
    setup(IPAD, 820);
    noteModelLoad('start');
    noteModelLoad('done');
    noteModelLoad('start');
    expect(preferSmallSpeechModel()).toBe(false);
    noteModelLoad('failed');
    noteModelLoad('start');
    expect(preferSmallSpeechModel()).toBe(false);
  });
});
