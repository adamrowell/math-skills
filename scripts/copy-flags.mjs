#!/usr/bin/env node
/**
 * Copy the flag SVGs the Flags app uses (src/apps/flags/data/flags.ts) from the `flag-icons`
 * package (MIT; the flag designs themselves are public domain) into public/flags/4x3/, so the
 * app serves them from its own origin. Same pattern as src/voice/tools/copy-ort.mjs.
 *
 * Runs on postinstall / predev / prebuild. Idempotent: copies only when size differs.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/flag-icons/flags/4x3');
const catalog = join(root, 'src/apps/flags/data/flags.ts');
const outDir = join(root, 'public/flags/4x3');

if (!existsSync(src)) {
  console.warn('[copy-flags] flag-icons not installed — the Flags app will show empty frames.');
  process.exit(0);
}
if (!existsSync(catalog)) process.exit(0);

const codes = [...new Set([...readFileSync(catalog, 'utf8').matchAll(/(?:\bcc:\s*|\bf\()'([a-z]{2})'/g)].map((m) => m[1]))];
mkdirSync(outDir, { recursive: true });
const ignore = join(root, 'public/flags/.gitignore');
if (!existsSync(ignore)) writeFileSync(ignore, '*\n!.gitignore\n');

let copied = 0;
const missing = [];
for (const cc of codes) {
  const from = join(src, `${cc}.svg`);
  const to = join(outDir, `${cc}.svg`);
  if (!existsSync(from)) {
    missing.push(cc);
    continue;
  }
  if (!existsSync(to) || statSync(to).size !== statSync(from).size) {
    copyFileSync(from, to);
    copied++;
  }
}
if (missing.length) console.warn(`[copy-flags] no SVG for: ${missing.join(', ')}`);
if (copied) console.log(`[copy-flags] copied ${copied} flag(s) → public/flags/4x3/`);
