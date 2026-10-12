import { expect, type Page } from '@playwright/test';

/**
 * A scripted SpeechRecognition (Web Speech engine): the test "says" text with window.__say().
 * Lets the reading apps run their real voice path (manager → webspeech engine → matcher)
 * in every browser project, without a microphone or the on-device model.
 */
export const FAKE_SPEECH = `
  (() => {
    const live = new Set();
    class FakeSR {
      constructor() { this.lang = 'en-US'; this.continuous = false; this.interimResults = true; this.maxAlternatives = 1; }
      start() { live.add(this); setTimeout(() => { this.onstart && this.onstart(); this.onaudiostart && this.onaudiostart(); }, 10); }
      stop() { if (live.delete(this)) setTimeout(() => this.onend && this.onend(), 10); }
      abort() { this.stop(); }
    }
    window.webkitSpeechRecognition = FakeSR;
    window.SpeechRecognition = FakeSR;
    window.__srLive = () => live.size;
    window.__say = (text) => {
      const sr = [...live].pop();
      if (!sr) return false;
      const r = [{ transcript: text, confidence: 0.9 }];
      r.isFinal = true;
      sr.onspeechstart && sr.onspeechstart();
      sr.onresult && sr.onresult({ resultIndex: 0, results: [r] });
      return true;
    };
    // speechSynthesis stub: instant, records what was said.
    window.__spoken = [];
    try {
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
        speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 30); },
        cancel() {}, getVoices() { return []; }, onvoiceschanged: null,
      }});
      if (typeof window.SpeechSynthesisUtterance === 'undefined') window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    } catch {}
  })();
`;

/** Fresh state with voice ON through the scripted Web Speech engine; hidden apps routable. */
export async function readingStart(page: Page, opts: { voice?: boolean; extra?: Record<string, unknown> } = {}) {
  const voice = opts.voice ?? true;
  await page.route(/huggingface\.co|hf\.co|cdn-lfs/, (r) => r.abort());
  if (voice) await page.addInitScript(FAKE_SPEECH);
  await page.addInitScript(
    ([v, extra]) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      localStorage.setItem('ms2:coach:v1', JSON.stringify({ version: 1, hub: true, home: true, play: true }));
      // Specs drive the controls inside "More ways to play"; open it on every home (the collapsed default is covered in tests/start-flow.spec.ts).
      for (const app of ['multiplication', 'division', 'addition', 'mixed', 'coordinates', 'algebra', 'words', 'sentences', 'maps', 'stories'])
        localStorage.setItem(`ms2:ui:${app}:v1`, JSON.stringify({ version: 1, setId: 'all', moreOpen: true }));
      localStorage.setItem(
        'ms2:settings:v1',
        JSON.stringify({ version: 2, kidName: 'Sam', soundOn: false, dailyGoal: 500, voice: { enabled: v, askedMic: true }, showHiddenApps: true }),
      );
      localStorage.setItem('ms2:voice:prefs:v1', JSON.stringify({ version: 1, engine: 'webspeech', autoStart: true, showHeard: true }));
      for (const [k, val] of Object.entries(extra as Record<string, unknown>)) localStorage.setItem(k, JSON.stringify(val));
    },
    [voice, opts.extra ?? {}] as const,
  );
}

/** Say something into the fake recognizer (waits until it is listening). */
export async function say(page: Page, text: string) {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __srLive: () => number }).__srLive()), { timeout: 5000 }).toBeGreaterThan(0);
  await page.evaluate((t) => (window as unknown as { __say: (t: string) => boolean }).__say(t), text);
}

export async function todayPoints(page: Page): Promise<number> {
  return Number(((await page.getByTestId('points-today').first().textContent()) ?? '0').replace(/[^0-9]/g, ''));
}
