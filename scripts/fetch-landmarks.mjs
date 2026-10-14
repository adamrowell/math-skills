#!/usr/bin/env node
/**
 * Fetches one freely-licensed Wikimedia Commons photo per landmark, self-hosts it and writes the
 * attribution the licenses require (docs/GEO-LOGIC.md §D.3). Run by hand; outputs are committed.
 *
 *   node scripts/fetch-landmarks.mjs                 # fetch what is missing (or whose file changed)
 *   node scripts/fetch-landmarks.mjs --force         # refetch everything
 *   node scripts/fetch-landmarks.mjs --only a,b      # just these ids (implies --force for them)
 *
 * Photo choice: `commonsFile` in src/apps/landmarks/data/landmarks.ts when set, else the lead image
 * of the landmark's English Wikipedia article (`wiki`), else a Commons search. Only files whose
 * license is CC0 / public domain / CC BY / CC BY-SA are used.
 *
 * Outputs
 *   public/landmarks/<id>.webp        800×600, ≤ 80 KB, no metadata (sharp strips EXIF/GPS by default)
 *   public/landmarks/<id>-thumb.webp  240×180, ≤ 12 KB
 *   src/apps/landmarks/data/credits.json   (generated) author, license, source per photo
 *   docs/IMAGE-CREDITS.md                  (generated) the same as a table
 *   public/landmarks/contact.html          (gitignored) contact sheet to eyeball every pick
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadLandmarks, repoRoot } from './lib/load-landmarks.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const UA = 'math-skills-landmarks/1.1 (open-source kids geography game; one-off photo fetch, batched)';
const OUT = join(repoRoot, 'public/landmarks');
const CREDITS = join(repoRoot, 'src/apps/landmarks/data/credits.json');
const DOC = join(repoRoot, 'docs/IMAGE-CREDITS.md');
const MAX_BYTES = 80 * 1024;
const MAX_THUMB = 12 * 1024;

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyArg = args[args.indexOf('--only') + 1];
const only = args.includes('--only') && onlyArg ? new Set(onlyArg.split(',')) : null;

/** CC0, public domain, CC BY and CC BY-SA (any version 1.0–4.0, ported versions too). */
export function licenseOk(short) {
  const s = (short ?? '').trim();
  return /^(cc0|cc0 1\.0|public domain|pd\b.*|cc by(-sa)? [1-4]\.[05]( [a-z]{2,3})?)$/i.test(s);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;
async function getJson(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = 1100 - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } }).catch(() => null);
    if (!res) {
      await sleep(3000); // network blip
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      // Be polite: honour Retry-After, else back off 5 s, 10 s, 20 s…
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 5000 * 2 ** attempt);
      continue;
    }
    throw new Error(`${res.status} ${url}`);
  }
  throw new Error(`gave up: ${url}`);
}

async function getBuffer(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (!res) {
      await sleep(3000); // network blip
      continue;
    }
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 5000 * 2 ** attempt);
      continue;
    }
    throw new Error(`${res.status} ${url}`);
  }
  throw new Error(`gave up: ${url}`);
}

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const ENWIKI = 'https://en.wikipedia.org/w/api.php';
const qs = (o) => new URLSearchParams({ format: 'json', ...o }).toString();

/** Follows `normalized` and `redirects` in an API answer: original title → final title. */
function finalTitles(query, titles) {
  const hop = new Map();
  for (const n of query?.normalized ?? []) hop.set(n.from, n.to);
  for (const r of query?.redirects ?? []) hop.set(r.from, r.to);
  const out = new Map();
  for (const t of titles) {
    let cur = t;
    for (let i = 0; i < 4 && hop.has(cur); i++) cur = hop.get(cur);
    out.set(t, cur);
  }
  return out;
}

const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

/** Lead images of many Wikipedia articles, 50 per request (keeps us far below the API rate limits). */
const leadCache = new Map();
async function prefetchLeads(titles) {
  const todo = [...new Set(titles)].filter((t) => !leadCache.has(t));
  for (const part of chunks(todo, 50)) {
    const j = await getJson(`${ENWIKI}?${qs({ action: 'query', prop: 'pageimages', piprop: 'name', redirects: '1', titles: part.join('|') })}`);
    const map = finalTitles(j.query, part);
    const byTitle = new Map(Object.values(j.query?.pages ?? {}).map((p) => [p.title, p.pageimage ?? null]));
    for (const t of part) leadCache.set(t, byTitle.get(map.get(t)) ?? null);
  }
}

async function leadImage(title) {
  await prefetchLeads([title]);
  return leadCache.get(title) ?? null;
}

/** Commons image info, 25 files per request. Keys are file names without "File:". */
const infoCache = new Map();
const fileKey = (f) => {
  const s = f.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
async function prefetchInfo(files) {
  const todo = [...new Set(files.filter(Boolean).map(fileKey))].filter((f) => !infoCache.has(f));
  for (const part of chunks(todo, 25)) {
    const titles = part.map((f) => `File:${f}`);
    const j = await getJson(
      `${COMMONS}?${qs({ action: 'query', titles: titles.join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '1280' })}`,
    );
    const map = finalTitles(j.query, titles);
    const byTitle = new Map(Object.values(j.query?.pages ?? {}).map((p) => [p.title, p]));
    for (const t of titles) {
      const page = byTitle.get(map.get(t));
      const ok = page && page.missing === undefined && page.imageinfo?.length;
      infoCache.set(t.replace(/^File:/, ''), ok ? { title: page.title.replace(/^File:/, ''), ...page.imageinfo[0] } : null);
    }
  }
}

async function commonsInfo(file) {
  await prefetchInfo([file]);
  return infoCache.get(fileKey(file)) ?? null;
}

async function searchCommons(q) {
  const j = await getJson(`${COMMONS}?${qs({ action: 'query', list: 'search', srnamespace: '6', srsearch: `${q} filetype:bitmap`, srlimit: '10' })}`);
  return (j.query?.search ?? []).map((s) => s.title.replace(/^File:/, ''));
}

const meta = (ii, k) => ii.extmetadata?.[k]?.value ?? '';
const stripHtml = (s) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\S+@\S+/g, '') // never keep e-mail addresses from Commons metadata
    .replace(/\s+/g, ' ')
    .trim();

/** Commons "Artist" fields are sometimes a whole sentence; keep just the name. */
export function cleanAuthor(a) {
  const s = stripHtml(a ?? '');
  const m = /(?:taken|created|photographed)(?: or created)? by\s+(.+?)\s*(?:\s\.|\.\s+(?:To|Feel|Please|For|See)\b|;|\(|$)/i.exec(s);
  const name = (m ? m[1] : s).replace(/\s+/g, ' ').trim();
  return name.length > 80 ? name.slice(0, 77).trimEnd() + '…' : name || 'Unknown author';
}

function usable(ii) {
  if (!ii) return false;
  if (!/^image\/(jpeg|png|webp|tiff)$/.test(ii.mime ?? '')) return false;
  if ((ii.width ?? 0) < 900 || (ii.height ?? 0) < 600) return false;
  return licenseOk(meta(ii, 'LicenseShortName'));
}

async function pick(l) {
  const tried = [];
  const tryFile = async (file, how) => {
    if (!file) return null;
    const ii = await commonsInfo(file);
    tried.push(`${how}: ${file} → ${ii ? meta(ii, 'LicenseShortName') || 'no license' : 'not on Commons'}`);
    return usable(ii) ? { ii, how } : null;
  };
  if (l.commonsFile) {
    const hit = await tryFile(l.commonsFile, 'pinned');
    if (hit) return hit;
    throw new Error(`${l.id}: pinned file unusable\n  ${tried.join('\n  ')}`);
  }
  const lead = await leadImage(l.wiki);
  const hit = await tryFile(lead, 'wikipedia');
  if (hit) return hit;
  const found = await searchCommons(`${l.name}`);
  await prefetchInfo(found);
  for (const f of found) {
    const h = await tryFile(f, 'search');
    if (h) return h;
  }
  throw new Error(`${l.id}: no usable photo\n  ${tried.join('\n  ')}`);
}

async function encode(input, w, h, maxBytes, qualities, position = 'attention') {
  let last = null;
  // Busy photos (foliage, crowds) need a lower quality or a slightly smaller size to fit the budget.
  for (const [ww, hh] of [
    [w, h],
    [Math.round(w * 0.9), Math.round(h * 0.9)],
    [Math.round(w * 0.8), Math.round(h * 0.8)],
  ]) {
    for (const quality of qualities) {
      const buf = await sharp(input).rotate().resize({ width: ww, height: hh, fit: 'cover', position }).webp({ quality, effort: 6 }).toBuffer();
      last = buf;
      if (buf.length <= maxBytes) return buf;
    }
  }
  return last;
}

function readCredits() {
  try {
    const j = JSON.parse(readFileSync(CREDITS, 'utf8'));
    return new Map(j.photos.map((p) => [p.id, p]));
  } catch {
    return new Map();
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mdCell = (s) => String(s).replace(/\|/g, '\\|');

function writeOutputs(LANDMARKS, credits) {
  // Generated outputs (in catalog order; rows for removed ids are dropped).
  const rows = LANDMARKS.map((l) => credits.get(l.id))
    .filter(Boolean)
    .map((r) => ({ ...r, author: cleanAuthor(r.author) }));
  writeFileSync(
    CREDITS,
    JSON.stringify(
      {
        generated: 'scripts/fetch-landmarks.mjs — do not edit by hand',
        note: 'Photos from Wikimedia Commons, cropped and resized. CC BY-SA photos remain under the same license.',
        photos: rows,
      },
      null,
      1,
    ) + '\n',
  );

  const md = [
    '# Image credits',
    '',
    '<!-- GENERATED by scripts/fetch-landmarks.mjs — do not edit by hand. -->',
    '',
    'Landmark photos in `public/landmarks/` come from [Wikimedia Commons](https://commons.wikimedia.org/).',
    'Each was cropped and resized (800×600 and 240×180 WebP, metadata removed). Photos under a',
    'CC BY-SA license remain under that same license; CC BY photos require the attribution below;',
    'public-domain and CC0 photos are credited as a courtesy.',
    '',
    '| Landmark | Photo | Author | License |',
    '|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${mdCell(r.name)} | [${mdCell(r.file)}](${r.sourceUrl}) | ${mdCell(r.author)} | ${r.licenseUrl ? `[${mdCell(r.license)}](${r.licenseUrl})` : mdCell(r.license)} |`,
    ),
    '',
  ].join('\n');
  // Keep any section another tool appended after ours (e.g. "## Flags").
  let tail = '';
  try {
    const old = readFileSync(DOC, 'utf8');
    const i = old.indexOf('\n## ');
    if (i >= 0) tail = old.slice(i);
  } catch {
    /* first run */
  }
  writeFileSync(DOC, md + tail);

  const cards = rows
    .map((r) => {
      const l = LANDMARKS.find((x) => x.id === r.id);
      const kb = existsSync(join(OUT, `${r.id}.webp`)) ? (statSync(join(OUT, `${r.id}.webp`)).size / 1024).toFixed(0) : '?';
      return `<figure><img src="${r.id}.webp" loading="lazy"><figcaption><b>${esc(r.name)}</b> <i>${l?.cc}${l?.state ? ' · ' + l.state : ''} · t${l?.tier}</i><br><small>${esc(r.id)} · ${kb} KB · ${esc(r.license)}<br>${esc(r.file)}</small></figcaption></figure>`;
    })
    .join('\n');
  writeFileSync(
    join(OUT, 'contact.html'),
    `<!doctype html><meta charset="utf-8"><title>Landmarks contact sheet</title><style>body{font:13px system-ui;margin:12px;background:#222;color:#eee}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}figure{margin:0;background:#333;padding:6px;border-radius:6px}img{width:100%;aspect-ratio:4/3;display:block}small{color:#aaa}</style><main>${cards}</main>`,
  );

  return rows;
}

async function main() {
  const LANDMARKS = await loadLandmarks();
  const credits = readCredits();
  const failures = [];
  const needs = (l) => {
    if (only) return only.has(l.id);
    const prev = credits.get(l.id);
    const pinnedChanged = l.commonsFile && prev && prev.file !== fileKey(l.commonsFile);
    return force || pinnedChanged || !prev || !existsSync(join(OUT, `${l.id}.webp`)) || !existsSync(join(OUT, `${l.id}-thumb.webp`));
  };
  const work = LANDMARKS.filter(needs);
  // Two batched lookups up front instead of two requests per landmark.
  await prefetchLeads(work.filter((l) => !l.commonsFile).map((l) => l.wiki));
  await prefetchInfo([...work.map((l) => l.commonsFile), ...work.map((l) => !l.commonsFile && leadCache.get(l.wiki))].filter(Boolean));

  for (const l of LANDMARKS) {
    if (!work.includes(l)) continue;
    const img = join(OUT, `${l.id}.webp`);
    const thumb = join(OUT, `${l.id}-thumb.webp`);
    try {
      const { ii, how } = await pick(l);
      const src = await getBuffer(ii.thumburl ?? ii.url);
      const big = await encode(src, 800, 600, MAX_BYTES, [72, 62, 52, 44], l.focus);
      const small = await encode(src, 240, 180, MAX_THUMB, [60, 50, 40], l.focus);
      writeFileSync(img, big);
      writeFileSync(thumb, small);
      const license = meta(ii, 'LicenseShortName');
      credits.set(l.id, {
        id: l.id,
        name: l.name,
        file: ii.title,
        author: stripHtml(meta(ii, 'Artist')) || stripHtml(meta(ii, 'Credit')) || 'Unknown author',
        license,
        licenseUrl: meta(ii, 'LicenseUrl'),
        sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(ii.title.replace(/ /g, '_'))}`,
        modified: 'cropped and resized',
      });
      writeOutputs(LANDMARKS, credits); // save as we go (a long run can be interrupted)
      console.log(`✓ ${l.id.padEnd(20)} ${how.padEnd(9)} ${(big.length / 1024).toFixed(0)} KB  ${license}  ${ii.title}`);
    } catch (e) {
      failures.push(l.id);
      console.error(`✗ ${e.message}`);
    }
  }

  const rows = writeOutputs(LANDMARKS, credits);
  console.log(`\n${rows.length}/${LANDMARKS.length} photos credited.${failures.length ? ` Failed: ${failures.join(', ')}` : ''}`);
  if (failures.length) process.exitCode = 1;
}

await main();
