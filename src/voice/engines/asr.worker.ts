/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * On-device ASR worker (transformers.js v4 + onnxruntime-web, single-threaded WASM).
 *
 * Per utterance:
 *   1. encoder runs once on the 16 kHz clip;
 *   2. trie-constrained beam search: the decoder may only follow token paths that spell a
 *      valid answer (" 56" / " Fifty-six" / " cat" …) and end in EOT. Every candidate in
 *      the answer set competes, so a clear "fifty-four" can never be pushed into "fifty-six";
 *   3. mustScore candidates (the expected answer) are force-scored if the beam pruned them;
 *   4. optional free greedy decode for logs / adaptation / sentences.
 * Returns the ranked candidates with log-probs and the winner's margin.
 */
import { AutoProcessor, AutoTokenizer, MoonshineForConditionalGeneration, WhisperForConditionalGeneration, Tensor, cat, env } from '@huggingface/transformers';
import type { AsrDevice, AsrModelSpec, AsrScore, FromWorker, ToWorker } from './asrProtocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: FromWorker) => ctx.postMessage(m);

let model: any = null;
let processor: any = null;
let tok: any = null;
let prefix: number[] = [];
let eot = 0;
let family: AsrModelSpec['family'] = 'moonshine';
let suppressFirst = new Set<number>();
let loading: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Cancellation (stale speculative decodes)
// ---------------------------------------------------------------------------
/** Jobs the engine abandoned ({type:'cancel'}); checked before a job and between decoder steps. */
const cancelled = new Set<number>();
/** The recognize job running now (null: load / warm-up, never cancelled). */
let currentJob: number | null = null;
class CancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}
/** A macrotask yield (MessageChannel: no setTimeout clamping) so a 'cancel' message can land. */
const yieldCh = new MessageChannel();
const yieldWaiters: (() => void)[] = [];
yieldCh.port1.onmessage = () => yieldWaiters.shift()?.();
function yieldTask(): Promise<void> {
  return new Promise((r) => {
    yieldWaiters.push(r);
    yieldCh.port2.postMessage(0);
  });
}
/** Between decoder steps: let messages in, then stop if this job was cancelled. */
async function checkpoint(): Promise<void> {
  if (currentJob === null) return;
  await yieldTask();
  if (cancelled.has(currentJob)) throw new CancelledError();
}

// ---------------------------------------------------------------------------
// Candidate surface forms + trie
// ---------------------------------------------------------------------------
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function words(n: number, and = false): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  const r = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${r ? `${and ? ' and' : ''} ${words(r)}` : ''}`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const formCache = new Map<string, number[][]>();
function forms(c: string): number[][] {
  const hit = formCache.get(c);
  if (hit) return hit;
  let f: string[];
  if (c === '') {
    // "Nothing was said": EOT straight away.
    const ids = [[eot]];
    formCache.set(c, ids);
    return ids;
  }
  if (/^\d+$/.test(c)) {
    const n = parseInt(c, 10);
    f = [` ${n}`, ` ${cap(words(n))}`];
    if (n > 100 && n % 100) f.push(` ${cap(words(n, true))}`);
  } else {
    f = [` ${c}`, ` ${cap(c)}`];
  }
  const ids = [...new Set(f)].map((s) => [...(tok.encode(s, { add_special_tokens: false }) as number[]), eot]);
  formCache.set(c, ids);
  return ids;
}

interface TrieNode {
  next: Map<number, TrieNode>;
  cand: string | null;
}
let trie: TrieNode | null = null;
let trieKey = '';
function getTrie(cands: string[]): TrieNode {
  const key = cands.join('|');
  if (trie && trieKey === key) return trie;
  const root: TrieNode = { next: new Map(), cand: null };
  for (const c of cands) {
    for (const ids of forms(c)) {
      let node = root;
      for (const t of ids) {
        let n = node.next.get(t);
        if (!n) {
          n = { next: new Map(), cand: null };
          node.next.set(t, n);
        }
        if (t === eot) n.cand = c;
        node = n;
      }
    }
  }
  trie = root;
  trieKey = key;
  return root;
}

// ---------------------------------------------------------------------------
// Model helpers
// ---------------------------------------------------------------------------
function inputKey(): string {
  return family === 'moonshine' ? 'input_values' : 'input_features';
}

async function encode(audio: Float32Array): Promise<any> {
  const feats = await processor(audio);
  const key = inputKey();
  const input = feats[key];
  const r = await model._prepare_encoder_decoder_kwargs_for_generation({
    inputs_tensor: input,
    model_inputs: { [key]: input },
    model_input_name: key,
    generation_config: model.generation_config,
  });
  return { enc: r.encoder_outputs, input };
}

async function decodeBatch(enc: any, seqs: number[][]): Promise<{ data: Float32Array; V: number; T: number }> {
  const T = prefix.length + Math.max(...seqs.map((s) => s.length));
  const nb = seqs.length;
  const ids = new BigInt64Array(nb * T);
  for (let b = 0; b < nb; b++) {
    const full = [...prefix, ...seqs[b]];
    for (let t = 0; t < T; t++) ids[b * T + t] = BigInt(full[t] ?? eot);
  }
  const e = nb === 1 ? enc : cat(Array.from({ length: nb }, () => enc), 0);
  const out = await model({ encoder_outputs: e, decoder_input_ids: new Tensor('int64', ids, [nb, T]) });
  return { data: out.logits.data as Float32Array, V: out.logits.dims[2] as number, T };
}

// ---------------------------------------------------------------------------
// KV-cached incremental decoding (the merged decoder's cache branch)
//
// Without a cache every beam step re-runs the decoder over the whole prefix and projects
// the encoder states into cross-attention K/V again, for every beam — and the 32k-way LM
// head runs on every position. With the cache each step feeds one token per beam and
// reuses the encoder K/V computed once per utterance: ~4–6× less work per utterance.
// ---------------------------------------------------------------------------
type KV = Record<string, any>;
interface DecodeCtx {
  enc: any;
  /** Encoder (cross-attention) K/V for batch 1, from the first decoder call. */
  encKV: KV;
  /** Tiled copies per batch size (encoder K/V + encoder states). */
  tiled: Map<number, { kv: KV; enc: any }>;
}
/** When the cache path fails once (an exported graph without a usable cache branch), stay on the legacy path. */
let kvBroken = false;

function pastName(present: string): string {
  return present.replace(/^present/, 'past_key_values');
}

function tileRows(t: any, n: number): any {
  if (n === 1) return t;
  const d = t.data as Float32Array;
  const out = new (d.constructor as Float32ArrayConstructor)(d.length * n);
  for (let i = 0; i < n; i++) out.set(d, i * d.length);
  return new Tensor(t.type, out, [t.dims[0] * n, ...t.dims.slice(1)]);
}

/** Gather batch rows (dim 0) of a tensor: rows[i] = source row index for output row i. */
function gatherRows(t: any, rows: number[]): any {
  const d = t.data as Float32Array;
  const per = d.length / t.dims[0];
  const out = new (d.constructor as Float32ArrayConstructor)(per * rows.length);
  rows.forEach((r, i) => out.set(d.subarray(r * per, (r + 1) * per), i * per));
  return new Tensor(t.type, out, [rows.length, ...t.dims.slice(1)]);
}

function tiledFor(c: DecodeCtx, nb: number): { kv: KV; enc: any } {
  let hit = c.tiled.get(nb);
  if (!hit) {
    const kv: KV = {};
    for (const [k, v] of Object.entries(c.encKV)) kv[k] = tileRows(v, nb);
    hit = { kv, enc: tileRows(c.enc, nb) };
    c.tiled.set(nb, hit);
  }
  return hit;
}

/**
 * First decoder call: the forced prefix (decoder start token), batch 1.
 * Returns the next-token logits and the decoder self-attention cache for one row.
 */
async function decodeStart(enc: any): Promise<{ ctx: DecodeCtx; logits: Float32Array; V: number; selfKV: KV }> {
  const ids = new BigInt64Array(prefix.map((t) => BigInt(t)));
  const out = await model({ encoder_outputs: enc, decoder_input_ids: new Tensor('int64', ids, [1, prefix.length]) });
  const encKV: KV = {};
  const selfKV: KV = {};
  for (const [k, v] of Object.entries(out)) {
    if (!k.startsWith('present')) continue;
    (k.includes('.encoder.') ? encKV : selfKV)[pastName(k)] = v;
  }
  if (!Object.keys(encKV).length || !Object.keys(selfKV).length) throw new Error('decoder exposes no KV cache');
  const V = out.logits.dims[2] as number;
  const T = out.logits.dims[1] as number;
  const logits = (out.logits.data as Float32Array).subarray((T - 1) * V, T * V);
  return { ctx: { enc, encKV, tiled: new Map() }, logits, V, selfKV };
}

/**
 * One cached step: `tokens[i]` (one id, or several of equal count per row) is appended to row
 * `rows[i]` of `selfKV`. Returns [nb, T, V] logits + the new cache.
 */
async function decodeStep(c: DecodeCtx, selfKV: KV, rows: number[], tokens: number[] | number[][]): Promise<{ logits: Float32Array; V: number; selfKV: KV }> {
  const nb = tokens.length;
  const seqs = tokens.map((t) => (Array.isArray(t) ? t : [t]));
  const T = seqs[0].length;
  const past: KV = {};
  const identity = rows.length === (Object.values(selfKV)[0] as any).dims[0] && rows.every((r, i) => r === i);
  for (const [k, v] of Object.entries(selfKV)) past[k] = identity ? v : gatherRows(v, rows);
  const t = tiledFor(c, nb);
  Object.assign(past, t.kv);
  const ids = new BigInt64Array(nb * T);
  seqs.forEach((q, b) => q.forEach((x, k) => (ids[b * T + k] = BigInt(x))));
  const out = await model({ encoder_outputs: t.enc, decoder_input_ids: new Tensor('int64', ids, [nb, T]), past_key_values: past });
  const next: KV = {};
  for (const [k, v] of Object.entries(out)) if (k.startsWith('present') && !k.includes('.encoder.')) next[pastName(k)] = v;
  return { logits: out.logits.data as Float32Array, V: out.logits.dims[2] as number, selfKV: next };
}

function logZ(data: Float32Array, off: number, V: number): number {
  let mx = -Infinity;
  for (let i = 0; i < V; i++) if (data[off + i] > mx) mx = data[off + i];
  let s = 0;
  for (let i = 0; i < V; i++) s += Math.exp(data[off + i] - mx);
  return mx + Math.log(s);
}

/**
 * Teacher-forced total log-prob of each token sequence. `cached` (number force-scoring: a few
 * short forms) uses the KV cache; the reading apps' large text batches keep the full path
 * (tiling the encoder cache 48× would cost tens of MB on an iPad).
 */
async function scoreBatch(enc: any, seqs: number[][], cached = false): Promise<number[]> {
  if (cached && !kvBroken && !legacyDecode) {
    try {
      return await scoreBatchCached(enc, seqs);
    } catch (e) {
      if (e instanceof CancelledError) throw e;
      kvBroken = true;
      console.warn('asr: KV-cached decoding unavailable, using full decoding', e);
    }
  }
  return scoreBatchLegacy(enc, seqs);
}

/** Prefix once (batch 1), then every sequence in one batched call on top of its cache. */
async function scoreBatchCached(enc: any, seqs: number[][]): Promise<number[]> {
  const start = await decodeStart(enc);
  const V = start.V;
  const lz0 = logZ(start.logits, 0, V);
  // Feed all tokens but the last (it is only predicted); pad rows to equal length (causal: padding never affects earlier positions).
  const L = Math.max(1, ...seqs.map((q) => q.length - 1));
  const feed = seqs.map((q) => Array.from({ length: L }, (_, k) => q[k] ?? eot));
  const r = await decodeStep(start.ctx, start.selfKV, seqs.map(() => 0), feed);
  return seqs.map((q, b) => {
    let lp = start.logits[q[0]] - lz0;
    for (let k = 1; k < q.length; k++) {
      const off = (b * L + k - 1) * V;
      lp += r.logits[off + q[k]] - logZ(r.logits, off, V);
    }
    return lp;
  });
}

/** Teacher-forced total log-prob of each token sequence (one batched decoder call, no cache). */
async function scoreBatchLegacy(enc: any, seqs: number[][]): Promise<number[]> {
  // The last token (EOT) is predicted from the previous position; feed all but it.
  const { data, V, T } = await decodeBatch(enc, seqs.map((ids) => ids.slice(0, -1)));
  return seqs.map((ids, b) => {
    let lp = 0;
    for (let k = 0; k < ids.length; k++) {
      const off = (b * T + prefix.length - 1 + k) * V;
      lp += data[off + ids[k]] - logZ(data, off, V);
    }
    return lp;
  });
}

/**
 * A beam that is this far below the best finished candidate can only finish lower still. The
 * decisions only look at margins up to WRONG_MARGIN (3) + slack, so anything farther is noise:
 * pruning it saves the long-tail decoder calls ("One hundred and …" forms).
 */
const PRUNE_NATS = 4.5;

/** trieBeam on the KV cache (same search; scores equal up to activation-quantisation noise). */
async function trieBeamCached(enc: any, cands: string[], width = 5, maxSteps = 12): Promise<Map<string, number>> {
  const root = getTrie(cands);
  const best = new Map<string, number>();
  let bestDone = -Infinity;
  const start = await decodeStart(enc);
  const c = start.ctx;
  let selfKV = start.selfKV;
  let logits = start.logits;
  const V = start.V;
  let beams: { lp: number; node: TrieNode; row: number; tok: number }[] = [{ lp: 0, node: root, row: 0, tok: -1 }];
  for (let step = 0; step < maxSteps && beams.length; step++) {
    const exp: typeof beams = [];
    beams.forEach((b, bi) => {
      const off = bi * V;
      const lz = logZ(logits, off, V);
      for (const [t, n] of b.node.next) {
        const lp = b.lp + logits[off + t] - lz;
        if (t === eot) {
          if (n.cand !== null && (!best.has(n.cand) || (best.get(n.cand) as number) < lp)) best.set(n.cand, lp);
          if (lp > bestDone) bestDone = lp;
        } else exp.push({ lp, node: n, row: bi, tok: t });
      }
    });
    exp.sort((x, y) => y.lp - x.lp);
    beams = exp.slice(0, width).filter((b) => b.lp > bestDone - PRUNE_NATS);
    if (!beams.length || step + 1 >= maxSteps) break;
    await checkpoint();
    const r = await decodeStep(c, selfKV, beams.map((b) => b.row), beams.map((b) => b.tok));
    logits = r.logits;
    selfKV = r.selfKV;
  }
  return best;
}

/** Cached path when the graph supports it, legacy full-prefix decoding otherwise. */
async function trieSearch(enc: any, cands: string[], width = 5, maxSteps = 12): Promise<Map<string, number>> {
  if (!kvBroken && !legacyDecode) {
    try {
      return await trieBeamCached(enc, cands, width, maxSteps);
    } catch (e) {
      if (e instanceof CancelledError) throw e;
      kvBroken = true;
      console.warn('asr: KV-cached decoding unavailable, using full decoding', e);
    }
  }
  return trieBeam(enc, cands, width, maxSteps);
}
/** Debug/A-B switch (lab): force the legacy decoder. */
let legacyDecode = false;

async function trieBeam(enc: any, cands: string[], width = 5, maxSteps = 12): Promise<Map<string, number>> {
  const root = getTrie(cands);
  let beams: { seq: number[]; lp: number; node: TrieNode }[] = [{ seq: [], lp: 0, node: root }];
  const best = new Map<string, number>();
  let bestDone = -Infinity;
  for (let step = 0; step < maxSteps && beams.length; step++) {
    if (step > 0) await checkpoint();
    const { data, V, T } = await decodeBatch(enc, beams.map((b) => b.seq));
    const exp: typeof beams = [];
    beams.forEach((b, bi) => {
      const off = (bi * T + prefix.length - 1 + b.seq.length) * V;
      const lz = logZ(data, off, V);
      for (const [t, n] of b.node.next) {
        const lp = b.lp + data[off + t] - lz;
        if (t === eot) {
          if (n.cand !== null && (!best.has(n.cand) || (best.get(n.cand) as number) < lp)) best.set(n.cand, lp);
          if (lp > bestDone) bestDone = lp;
        } else exp.push({ seq: [...b.seq, t], lp, node: n });
      }
    });
    exp.sort((x, y) => y.lp - x.lp);
    // Keep beams that could still finish within 8 nats of the best (they set the margin).
    beams = exp.slice(0, width).filter((b) => b.lp > bestDone - 8);
  }
  return best;
}

function pickNext(data: Float32Array, off: number, V: number, step: number): number {
  let bi = -1;
  let bv = -Infinity;
  for (let i = 0; i < V; i++) {
    if (step === 0 && suppressFirst.has(i)) continue;
    if (family === 'whisper' && i > eot) continue;
    if (data[off + i] > bv) {
      bv = data[off + i];
      bi = i;
    }
  }
  return bi;
}

function looping(seq: number[]): boolean {
  // Moonshine sometimes loops on short clips ("four four four…"): stop on a 3x repeat.
  const n = seq.length;
  return n >= 6 && seq[n - 1] === seq[n - 3] && seq[n - 2] === seq[n - 4] && seq[n - 3] === seq[n - 5];
}

async function greedy(enc: any, audioSec: number): Promise<string> {
  if (!kvBroken && !legacyDecode) {
    try {
      return await greedyCached(enc, audioSec);
    } catch (e) {
      kvBroken = true;
      console.warn('asr: KV-cached decoding unavailable, using full decoding', e);
    }
  }
  return greedyLegacy(enc, audioSec);
}

async function greedyCached(enc: any, audioSec: number): Promise<string> {
  const seq: number[] = [];
  const maxSteps = Math.max(4, Math.ceil(audioSec * (family === 'moonshine' ? 6.5 : 5)));
  const start = await decodeStart(enc);
  let logits = start.logits;
  let selfKV = start.selfKV;
  for (let step = 0; step < maxSteps; step++) {
    const bi = pickNext(logits, 0, start.V, step);
    if (bi === eot || bi < 0) break;
    seq.push(bi);
    if (looping(seq) || step + 1 >= maxSteps) break;
    const r = await decodeStep(start.ctx, selfKV, [0], [bi]);
    logits = r.logits;
    selfKV = r.selfKV;
  }
  return seq.length ? (tok.decode(seq, { skip_special_tokens: true }) as string).trim() : '';
}

async function greedyLegacy(enc: any, audioSec: number): Promise<string> {
  const seq: number[] = [];
  const maxSteps = Math.max(4, Math.ceil(audioSec * (family === 'moonshine' ? 6.5 : 5)));
  for (let step = 0; step < maxSteps; step++) {
    const { data, V } = await decodeBatch(enc, [seq]);
    const off = (prefix.length - 1 + seq.length) * V;
    let bi = -1;
    let bv = -Infinity;
    for (let i = 0; i < V; i++) {
      if (step === 0 && suppressFirst.has(i)) continue;
      if (family === 'whisper' && i > eot) continue;
      if (data[off + i] > bv) {
        bv = data[off + i];
        bi = i;
      }
    }
    if (bi === eot || bi < 0) break;
    seq.push(bi);
    // Moonshine sometimes loops on short clips ("four four four…"): stop on a 3x repeat.
    const n = seq.length;
    if (n >= 6 && seq[n - 1] === seq[n - 3] && seq[n - 2] === seq[n - 4] && seq[n - 3] === seq[n - 5]) break;
  }
  return seq.length ? (tok.decode(seq, { skip_special_tokens: true }) as string).trim() : '';
}

async function longForm(input: any, audioSec: number): Promise<string> {
  const max_new_tokens = Math.max(8, Math.ceil(audioSec * 6.5));
  const out = await model.generate({ [inputKey()]: input, max_new_tokens });
  const ids = (out.tolist ? out.tolist() : out)[0].map((x: bigint | number) => Number(x));
  return (tok.decode(ids, { skip_special_tokens: true }) as string).trim();
}

function pad(audio: Float32Array): Float32Array {
  // ≥ 120 ms silence on each side and ≥ 1.0 s overall (very short clips decode poorly).
  const sr = 16000;
  const minLen = sr;
  const side = Math.max(Math.round(0.12 * sr), Math.ceil((minLen - audio.length) / 2));
  const out = new Float32Array(audio.length + 2 * side);
  out.set(audio, side);
  return out;
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
async function load(spec: AsrModelSpec, device: AsrDevice, wasmBase: string | null): Promise<void> {
  const t0 = performance.now();
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  const onnx = (env.backends as any).onnx;
  onnx.wasm.numThreads = 1; // GitHub Pages cannot send COOP/COEP → no SharedArrayBuffer
  onnx.wasm.proxy = false;
  if (device === 'wasm' && wasmBase) {
    onnx.wasm.wasmPaths = {
      mjs: new URL('ort-wasm-simd-threaded.mjs', wasmBase).href,
      wasm: new URL('ort-wasm-simd-threaded.wasm', wasmBase).href,
    };
  }
  family = spec.family;
  const opts = { revision: spec.revision ?? 'main' };
  const progress_callback = (p: any) => {
    if (p && (p.status === 'progress' || p.status === 'done' || p.status === 'initiate')) {
      post({ type: 'progress', file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0, status: p.status });
    }
  };
  processor = await AutoProcessor.from_pretrained(spec.id, { ...opts, progress_callback } as any);
  tok = processor.tokenizer ?? (await AutoTokenizer.from_pretrained(spec.id, opts as any));
  const MC: any = spec.family === 'moonshine' ? MoonshineForConditionalGeneration : WhisperForConditionalGeneration;
  model = await MC.from_pretrained(spec.id, { ...opts, device, dtype: spec.dtype, progress_callback });
  const gc = model.generation_config;
  if (spec.family === 'moonshine') {
    prefix = [gc.decoder_start_token_id ?? model.config.decoder_start_token_id];
    eot = gc.eos_token_id ?? model.config.eos_token_id;
  } else {
    prefix = [gc.decoder_start_token_id, gc.no_timestamps_token_id].filter((x: unknown) => x != null) as number[];
    eot = gc.eos_token_id ?? tok.model.tokens_to_ids.get('<|endoftext|>');
  }
  if (Array.isArray(eot)) eot = eot[0];
  suppressFirst = new Set<number>(gc.begin_suppress_tokens ?? []);
  formCache.clear();
  trie = null;
  trieKey = '';
  const loadMs = performance.now() - t0;
  // Warm-up: one silent second through encoder + a small trie, so the first answer is fast.
  const w0 = performance.now();
  const { enc } = await encode(new Float32Array(16000));
  const warmCands = Array.from({ length: 145 }, (_, i) => String(i));
  await trieSearch(enc, warmCands, 5, 3);
  post({ type: 'ready', device, loadMs, warmMs: performance.now() - w0 });
}

// ---------------------------------------------------------------------------
// Recognize
// ---------------------------------------------------------------------------
async function recognize(m: Extract<ToWorker, { type: 'recognize' }>, recvAt: number): Promise<void> {
  const t0 = performance.now();
  const startAt = performance.timeOrigin + t0;
  legacyDecode = !!m.legacyDecode;
  const audio = pad(m.audio);
  const audioSec = audio.length / 16000;
  const { enc, input } = await encode(audio);
  const t1 = performance.now();
  await checkpoint();

  let ranked: AsrScore[] = [];
  let forced: AsrScore[] = [];
  let margin = 0;
  let text = '';
  let freeDone = false;
  let cands = m.candidates;
  if (cands && cands.length && m.addFreeWords) {
    // Whatever the model hears freely also competes, so a misread word outside the
    // vocabulary cannot be squeezed into the target.
    text = await greedy(enc, audioSec);
    freeDone = true;
    const heard = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
    const extra = heard.filter((w) => !cands!.includes(w) && !(m.mustScore ?? []).includes(w));
    if (extra.length) cands = [...cands, ...extra];
  }
  if (cands && cands.length) {
    const best = await trieSearch(enc, cands);
    // Force-score expected answers the beam pruned — all their forms in ONE batched call.
    const missing = (m.mustScore ?? []).filter((c) => !best.has(c) && cands!.includes(c));
    if (missing.length) {
      const seqs: number[][] = [];
      const owner: string[] = [];
      for (const c of missing) for (const ids of forms(c)) {
        seqs.push(ids);
        owner.push(c);
      }
      const lps = await scoreBatch(enc, seqs, true);
      lps.forEach((lp, i) => {
        const c = owner[i];
        if (!best.has(c) || (best.get(c) as number) < lp) best.set(c, lp);
      });
    }
    const all = [...best.entries()].map(([cand, lp]) => ({ cand, lp })).sort((a, b) => b.lp - a.lp);
    ranked = all.slice(0, 5);
    forced = (m.mustScore ?? []).map((c) => ({ cand: c, lp: best.get(c) ?? -Infinity }));
    margin = all.length >= 2 ? all[0].lp - all[1].lp : all.length === 1 ? 8 : 0;
  }
  const t2 = performance.now();

  const wantFree =
    !freeDone &&
    (m.freeDecode === 'always' ||
    (m.freeDecode === 'if-unsure' &&
      (!ranked.length || margin < (m.unsureMargin ?? 1) || (m.freeIfTop ?? []).includes(ranked[0].cand))));
  if (m.longForm) text = await longForm(input, audioSec);
  else if (wantFree) text = await greedy(enc, audioSec);

  // Reading apps: teacher-forced scores of exact texts (+ the free transcript), one batch.
  let textScores: number[] | undefined;
  let freeLp: number | undefined;
  if ((m.scoreTexts && m.scoreTexts.length) || (m.scoreFree && text)) {
    const texts = [...(m.scoreTexts ?? [])];
    const withFree = !!(m.scoreFree && text);
    if (withFree) texts.push(` ${text}`);
    const seqs = texts.map((t) => [...(tok.encode(t, { add_special_tokens: false }) as number[]), eot]);
    const lps: number[] = [];
    // Bounded batches keep peak memory small on iPad.
    for (let i = 0; i < seqs.length; i += 48) lps.push(...(await scoreBatch(enc, seqs.slice(i, i + 48))));
    if (withFree) freeLp = lps.pop();
    textScores = lps;
  }
  const t3 = performance.now();

  post({
    type: 'result',
    id: m.id,
    text,
    ranked,
    forced,
    margin,
    textScores,
    freeLp,
    audioMs: Math.round((m.audio.length / 16000) * 1000),
    encMs: t1 - t0,
    scoreMs: t2 - t1,
    freeMs: t3 - t2,
    totalMs: t3 - t0,
    recvAt,
    startAt,
    doneAt: performance.timeOrigin + performance.now(),
  });
}

// Process strictly in order; the engine never sends more than one at a time anyway.
let chain: Promise<void> = Promise.resolve();

ctx.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.type === 'load') {
    if (!loading) {
      loading = load(m.model, m.device, m.wasmBase).catch((err) => {
        loading = null;
        post({ type: 'error', phase: 'load', message: String((err as Error)?.message ?? err) });
      });
    }
    return;
  }
  if (m.type === 'recognize') {
    const recvAt = performance.timeOrigin + performance.now();
    chain = chain.then(async () => {
      try {
        if (cancelled.has(m.id)) throw new CancelledError();
        if (!model) throw new Error('model not loaded');
        currentJob = m.id;
        await recognize(m, recvAt);
      } catch (err) {
        post({ type: 'error', id: m.id, phase: 'recognize', message: String((err as Error)?.message ?? err) });
      } finally {
        currentJob = null;
        cancelled.delete(m.id);
      }
    });
    return;
  }
  if (m.type === 'cancel') {
    for (const id of m.ids) cancelled.add(id);
    // Bounded: ids of jobs that already finished are never looked up again.
    if (cancelled.size > 64) for (const id of [...cancelled].slice(0, cancelled.size - 64)) cancelled.delete(id);
    return;
  }
  if (m.type === 'dispose') {
    void (async () => {
      try {
        await model?.dispose?.();
      } catch {
        /* ignore */
      }
      model = null;
      processor = null;
      tok = null;
      loading = null;
      ctx.close();
    })();
  }
};
