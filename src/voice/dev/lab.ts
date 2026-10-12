/**
 * Dev-only Voice Lab (served by `vite` at /src/voice/dev/lab.html; not part of the build).
 * Exposes window.__voiceLab for Playwright: run fixture clips straight through the engine
 * (accuracy / latency) and drive the real mic path (fake-mic WAV in Chromium).
 */
import { getVoiceManager, type VoiceConsumer } from '../manager';
import { MIN_TOP_LP, NUMBER_GARBAGE, type OnDeviceHypothesis } from '../engines/onDevice';
import { SPEC, specVerdict } from '../engines/speculative';
import { getAcceptMargin } from '../match/corrections';
import { matchNumberHypothesis, matchWordHypothesis } from '../match/hypothesis';
import { alignSentence } from '../match/words';
import type { VoiceEnginePreference, VoiceHypothesis, VoiceMode, VoiceStatus } from '../types';

const mgr = getVoiceManager();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const logEl = $('log');
const log = (s: string) => {
  logEl.textContent = `${s}\n${logEl.textContent ?? ''}`.slice(0, 20000);
};

async function loadWav(url: string): Promise<Float32Array> {
  const buf = await (await fetch(url)).arrayBuffer();
  const dv = new DataView(buf);
  let off = 12;
  let sr = 16000;
  let channels = 1;
  let bits = 16;
  while (off + 8 <= dv.byteLength) {
    const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
    const size = dv.getUint32(off + 4, true);
    if (id === 'fmt ') {
      channels = dv.getUint16(off + 10, true);
      sr = dv.getUint32(off + 12, true);
      bits = dv.getUint16(off + 22, true);
    } else if (id === 'data') {
      if (bits !== 16 || sr !== 16000) throw new Error(`fixture must be 16 kHz PCM16 (got ${sr} Hz, ${bits} bit)`);
      const n = Math.floor(size / 2 / channels);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = dv.getInt16(off + 8 + i * 2 * channels, true) / 32768;
      return out;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error('no data chunk');
}

interface LabEvent {
  t: number;
  hyp: OnDeviceHypothesis;
}

const events: LabEvent[] = [];
const statuses: { t: number; s: VoiceStatus }[] = [];
let consumer: VoiceConsumer | null = null;
let nextId = 9000;

const lab = {
  get capabilities() {
    return mgr.capabilities();
  },
  events,
  statuses,
  async preload(pref: VoiceEnginePreference = 'moonshine') {
    const t0 = performance.now();
    await mgr.preload(pref);
    const d = mgr.diagnostics();
    return { ms: Math.round(performance.now() - t0), model: d.model, backend: d.backend, loadMs: d.loadMs, warmMs: d.warmMs };
  },
  /** Run one fixture through the engine with the same decision rules as live use. */
  async recognize(url: string, mode: VoiceMode, bias?: { numbers?: number[]; words?: string[] }) {
    const audio = await loadWav(url);
    const eng = mgr.onDevice('moonshine');
    const t0 = performance.now();
    const hyp = await eng.recognizeForMode(audio, (audio.length / 16000) * 1000, performance.now(), { mode, bias });
    return { ...hyp, wallMs: Math.round(performance.now() - t0) };
  },
  /** Recognise + judge against an expected answer. */
  async judgeNumber(url: string, expected: number, operands?: number[]) {
    const h = await lab.recognize(url, 'number', { numbers: [expected] });
    const r = matchNumberHypothesis(h as VoiceHypothesis, { expected, operands });
    return { verdict: r.verdict, heard: r.heard, text: h.text, top: h.top, margin: h.margin, topLp: h.topLp, free: h.freeText, ms: h.wallMs, inferenceMs: h.inferenceMs };
  },
  async judgeWord(url: string, target: string) {
    const h = await lab.recognize(url, 'word', { words: [target] });
    const r = matchWordHypothesis(h as VoiceHypothesis, target);
    return { verdict: r.verdict, heard: r.heard, text: h.text, top: h.top, margin: h.margin, topLp: h.topLp, free: h.freeText, ms: h.wallMs };
  },
  async judgeSentence(url: string, sentence: string) {
    const h = await lab.recognize(url, 'sentence');
    const a = alignSentence(h.text, sentence.split(/\s+/));
    return { hitRatio: a.hitRatio, text: h.text, ms: h.wallMs };
  },
  /** Open the mic (call from a click for real browsers; Playwright uses --use-fake-ui). */
  startMic(mode: VoiceMode = 'number', bias?: { numbers?: number[]; words?: string[] }, preferredEngine?: VoiceEnginePreference) {
    consumer = {
      id: ++nextId,
      mode,
      bias,
      preferredEngine,
      onTranscript: (h) => {
        events.push({ t: performance.now(), hyp: h as OnDeviceHypothesis });
        const oh = h as OnDeviceHypothesis;
        log(`${h.isFinal ? 'FINAL' : 'interim'} [${h.engine}] "${h.text}" top=${oh.top ?? ''} m=${oh.margin?.toFixed(2) ?? ''} lp=${oh.topLp?.toFixed(2) ?? ''} free="${oh.freeText ?? ''}" lat=${h.latencyMs ?? ''}ms inf=${oh.inferenceMs ?? ''}ms`);
      },
      onStatus: (s) => {
        statuses.push({ t: performance.now(), s });
        $('status').textContent = s;
      },
      onLevel: (r) => {
        $('level').textContent = '▮'.repeat(Math.round(r * 20));
      },
      onError: (e) => log(`ERROR ${e.code}: ${e.message}`),
    };
    return mgr.start(consumer);
  },
  setBias(bias: { numbers?: number[]; words?: string[] }) {
    if (consumer) {
      consumer.bias = bias;
      mgr.update(consumer);
    }
  },
  stopMic() {
    mgr.stop();
  },
  /** A/B the decoder implementations on one clip (number mode request). */
  async compareDecode(url: string, expected: number) {
    const audio = await loadWav(url);
    const eng = mgr.onDevice('moonshine');
    const cands = [...Array.from({ length: 145 }, (_, i) => String(i)), 'Hmm', 'Um', 'Uh', "I don't know", 'What', 'Okay', 'Yes', 'No', 'Wait'];
    const req = { candidates: cands, mustScore: [String(expected)], freeDecode: 'always' as const };
    const a = await eng.recognizeClip(audio.slice(), { ...req, legacyDecode: true });
    const b = await eng.recognizeClip(audio.slice(), req);
    return {
      legacy: { ranked: a.ranked, text: a.text, enc: a.encMs, score: a.scoreMs, free: a.freeMs },
      cached: { ranked: b.ranked, text: b.text, enc: b.encMs, score: b.scoreMs, free: b.freeMs },
    };
  },
  /**
   * Speculative-accept stress test: decode the clip cut `cuts[i]` frames after (+) or before (−)
   * its last voiced frame — negative cuts drop the end of the word, as if a soft ending had stayed
   * under the VAD threshold — and apply the early-accept rule as if the child were silent since.
   */
  async specSweep(url: string, expected: number, cuts: number[]) {
    const audio = await loadWav(url);
    const F = 160;
    const n = Math.floor(audio.length / F);
    let last = -1;
    let first = -1;
    for (let i = 0; i < n; i++) {
      let e = 0;
      for (let k = 0; k < F; k++) e += audio[i * F + k] ** 2;
      if (Math.sqrt(e / F) > 0.006) {
        last = i;
        if (first < 0) first = i;
      }
    }
    const start = Math.max(0, first - 30);
    const eng = mgr.onDevice('moonshine');
    const cands = [...Array.from({ length: 145 }, (_, i) => String(i)), ...NUMBER_GARBAGE];
    const out: { cut: number; top?: string; margin: number; verdict: string }[] = [];
    for (const cut of cuts) {
      const end = Math.min(n, last + 1 + cut);
      const clip = audio.slice(start * F, end * F);
      const r = await eng.recognizeClip(clip, { candidates: cands, mustScore: [String(expected)], freeDecode: 'never' });
      const v = specVerdict(r, String(expected), cands, {
        acceptMargin: getAcceptMargin(),
        minTopLp: MIN_TOP_LP,
        quietMs: 1000,
        voicedAfter: 0,
        speechMs: (last - first + 1) * 10,
      });
      out.push({ cut, top: r.ranked[0]?.cand, margin: r.margin, verdict: v.kind });
    }
    return { out, spec: SPEC };
  },
  /** Judge an arbitrary hypothesis the way the drill does. */
  match(h: VoiceHypothesis, expected: number, maxPlausible = 144, operands?: number[]) {
    return matchNumberHypothesis(h, { expected, maxPlausible, operands, minConfidence: 0.5 });
  },
  diagnostics: () => mgr.diagnostics(),
  snapshot: () => mgr.getSnapshot(),
};

(window as unknown as { __voiceLab: typeof lab }).__voiceLab = lab;

$('preload').onclick = () => {
  log('loading…');
  lab.preload().then((r) => log(`ready ${JSON.stringify(r)}`), (e) => log(`load failed ${e?.message ?? e}`));
};
$('start').onclick = () => {
  const mode = ($('mode') as HTMLSelectElement).value as VoiceMode;
  const exp = ($('expected') as HTMLInputElement).value.trim();
  const bias = exp ? (mode === 'number' ? { numbers: [Number(exp)] } : { words: [exp] }) : undefined;
  const engine = new URLSearchParams(location.search).get('engine') as VoiceEnginePreference | null;
  lab.startMic(mode, bias, engine ?? undefined).catch((e) => log(`start failed ${e?.code ?? ''} ${e?.message ?? e}`));
};
$('stop').onclick = () => lab.stopMic();
mgr.subscribe(() => {
  const s = mgr.getSnapshot();
  if (s.loadProgress && s.loadProgress.phase !== 'done') $('status').textContent = `${s.status} ${Math.round(s.loadProgress.fraction * 100)}%`;
});
log(`capabilities ${JSON.stringify(mgr.capabilities())}`);
