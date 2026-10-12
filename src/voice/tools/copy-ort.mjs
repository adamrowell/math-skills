#!/usr/bin/env node
/**
 * Copy the single-threaded SIMD onnxruntime-web WASM build into public/ort/ so the voice
 * model runs from our own origin (GitHub Pages serves it gzip'd: ~3.7 MB instead of the
 * 27 MB asyncify build transformers.js would otherwise pull from jsDelivr).
 *
 * Runs on postinstall / predev / prebuild. Idempotent: copies only when size differs.
 */
import { copyFileSync, existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(join(root, 'package.json'));

function findOrtDist() {
  const candidates = [
    join(root, 'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist'),
    join(root, 'node_modules/onnxruntime-web/dist'),
  ];
  for (const c of candidates) if (existsSync(join(c, 'ort-wasm-simd-threaded.wasm'))) return c;
  try {
    const main = require.resolve('onnxruntime-web');
    let d = dirname(main);
    while (d !== dirname(d) && !existsSync(join(d, 'ort-wasm-simd-threaded.wasm'))) d = dirname(d);
    if (existsSync(join(d, 'ort-wasm-simd-threaded.wasm'))) return d;
  } catch {
    /* fallthrough */
  }
  return null;
}

const dist = findOrtDist();
if (!dist) {
  console.warn('[copy-ort] onnxruntime-web not found — on-device voice will load the runtime from the CDN.');
  process.exit(0);
}
const outDir = join(root, 'public/ort');
mkdirSync(outDir, { recursive: true });
let copied = 0;
for (const f of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  const src = join(dist, f);
  const dst = join(outDir, f);
  if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) {
    copyFileSync(src, dst);
    copied++;
  }
}
let version = 'unknown';
try {
  version = JSON.parse(readFileSync(join(dist, '..', 'package.json'), 'utf8')).version;
} catch {
  /* ignore */
}
writeFileSync(join(outDir, 'VERSION.txt'), `onnxruntime-web ${version}\n`);
if (copied) console.log(`[copy-ort] copied ${copied} file(s) from onnxruntime-web ${version} → public/ort/`);
