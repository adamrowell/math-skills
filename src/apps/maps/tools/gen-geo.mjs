#!/usr/bin/env node
/**
 * Generates the static, pre-projected SVG map data used by the Maps app.
 *
 *   node src/apps/maps/tools/gen-geo.mjs <states-albers-10m.json> <countries-110m.json> <countries-50m.json>
 *
 * Inputs (ISC licensed, public-domain geometry from the US Census / Natural Earth):
 *   https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-albers-10m.json
 *   https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json
 *   https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
 *
 * Output: src/apps/maps/data/{us,continents,countries}.gen.ts — projected path strings, bounding
 * boxes and a label point inside each shape (so the app needs no projection code, no network and
 * renders crisp vectors at any zoom).
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const d3 = require('d3-geo');
const topojson = require('topojson-client');

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'data');
const [usPath, w110Path, w50Path] = process.argv.slice(2);
if (!usPath || !w110Path || !w50Path) {
  console.error('usage: gen-geo.mjs <states-albers-10m.json> <countries-110m.json> <countries-50m.json>');
  process.exit(1);
}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ---------------------------------------------------------------------------------------------
// Geometry helpers (projected px space)
// ---------------------------------------------------------------------------------------------

const r1 = (n) => Math.round(n * 10) / 10;

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return a / 2;
}

function sqSegDist(p, a, b) {
  let x = a[0], y = a[1];
  let dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas–Peucker on a closed ring (keeps first point). */
function simplify(ring, tol) {
  if (ring.length < 5) return ring;
  const sq = tol * tol;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = sqSegDist(ring[i], ring[s], ring[e]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > sq && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  // A closed ring whose first and last point coincide: also keep the farthest point.
  let far = 0, fi = -1;
  for (let i = 1; i < ring.length - 1; i++) {
    const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (d > far) { far = d; fi = i; }
  }
  if (fi > 0) keep[fi] = 1;
  return ring.filter((_, i) => keep[i]);
}

/** Collect projected rings from d3.geoPath via a context. */
function projectRings(geo, projection) {
  const rings = [];
  let cur = null;
  const ctx = {
    moveTo(x, y) { cur = [[x, y]]; rings.push(cur); },
    lineTo(x, y) { cur.push([x, y]); },
    closePath() { cur = null; },
    arc() {},
  };
  d3.geoPath(projection, ctx)(geo);
  return rings;
}

function ringsToPath(rings) {
  let d = '';
  for (const r of rings) {
    if (r.length < 3) continue;
    d += 'M' + r1(r[0][0]) + ' ' + r1(r[0][1]);
    let last = d;
    void last;
    for (let i = 1; i < r.length; i++) d += (i === 1 ? 'L' : ' ') + r1(r[i][0]) + ' ' + r1(r[i][1]);
    d += 'Z';
  }
  return d;
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToRing(x, y, ring) {
  let m = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) m = Math.min(m, sqSegDist([x, y], ring[j], ring[i]));
  return Math.sqrt(m);
}

/** Pole of inaccessibility of the biggest ring (grid search + refinement). */
function labelPoint(rings) {
  let best = null;
  for (const r of rings) if (r.length > 2 && (!best || Math.abs(ringArea(r)) > Math.abs(ringArea(best)))) best = r;
  if (!best) return { x: 0, y: 0, r: 0 };
  let [x0, y0, x1, y1] = bboxOf([best]);
  let bx = (x0 + x1) / 2, by = (y0 + y1) / 2, bd = -1;
  for (let pass = 0; pass < 4; pass++) {
    const n = 24;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * j) / n;
        if (!pointInRing(x, y, best)) continue;
        const d = distToRing(x, y, best);
        if (d > bd) { bd = d; bx = x; by = y; }
      }
    }
    const w = (x1 - x0) / 6, h = (y1 - y0) / 6;
    x0 = bx - w; x1 = bx + w; y0 = by - h; y1 = by + h;
  }
  return { x: r1(bx), y: r1(by), r: r1(Math.max(0, bd)) };
}

function bboxOf(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [r1(x0), r1(y0), r1(x1), r1(y1)];
}

function region(id, name, geo, projection, tol, minArea = 0) {
  let rings = projectRings(geo, projection).map((r) => simplify(r, tol)).filter((r) => r.length >= 3);
  if (minArea > 0) {
    const big = rings.filter((r) => Math.abs(ringArea(r)) >= minArea);
    if (big.length) rings = big;
  }
  const lp = labelPoint(rings);
  return { id, name, d: ringsToPath(rings), bbox: bboxOf(rings), lx: lp.x, ly: lp.y, lr: lp.r };
}

function emit(file, constName, data) {
  const body =
    '// GENERATED by src/apps/maps/tools/gen-geo.mjs — do not edit by hand.\n' +
    "import type { MapData } from '../types';\n\n" +
    `export const ${constName}: MapData = ${JSON.stringify(data)};\n`;
  writeFileSync(join(outDir, file), body);
  console.log(file, (body.length / 1024).toFixed(0) + ' KB', data.regions.length, 'regions');
}

// ---------------------------------------------------------------------------------------------
// USA (already projected with geoAlbersUsa into 975×610)
// ---------------------------------------------------------------------------------------------

const ABBR = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT',
  Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI',
  Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH',
  Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
  Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV',
  Wisconsin: 'WI', Wyoming: 'WY',
};

{
  const topo = readJson(usPath);
  const fc = topojson.feature(topo, topo.objects.states);
  const identity = d3.geoIdentity();
  const byName = new Map(fc.features.map((f) => [f.properties.name, f]));
  const regions = [];
  for (const [name, abbr] of Object.entries(ABBR)) {
    let geo = byName.get(name);
    if (!geo) throw new Error('missing state ' + name);
    // DC is part of Maryland's shape here (it is not a state, and too small to tap).
    if (abbr === 'MD') {
      const dc = byName.get('District of Columbia');
      geo = { type: 'GeometryCollection', geometries: [geo.geometry, dc.geometry] };
    }
    regions.push(region(abbr, name, geo, identity, 0.18));
  }
  const nation = topojson.mesh(topo, topo.objects.nation);
  const outline = ringsToPath(projectRings(nation, identity).map((r) => simplify(r, 0.25)));
  emit('us.gen.ts', 'US_MAP', { width: 975, height: 610, regions, outline });
}

// ---------------------------------------------------------------------------------------------
// World (Natural Earth projection, 1000 wide)
// ---------------------------------------------------------------------------------------------

const W = 1000;
const worldProjection = () => {
  const p = d3.geoNaturalEarth1();
  p.fitWidth(W, { type: 'Sphere' });
  return p;
};
const proj = worldProjection();
const worldH = Math.ceil(d3.geoPath(proj).bounds({ type: 'Sphere' })[1][1]);
const sphere = ringsToPath(projectRings({ type: 'Sphere' }, proj));
const graticule = ringsToPath(projectRings(d3.geoGraticule10(), proj).map((r) => r));

/** Densified lon/lat polygon (so straight lon/lat edges follow the projection's curves). */
function lonLatPoly(points) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 2));
    for (let s = 0; s < steps; s++) out.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps]);
  }
  return out;
}

/** Project a planar lon/lat polygon point by point (no spherical interpretation). */
function planarRegion(id, name, polys, label) {
  const rings = polys.map((poly) => lonLatPoly(poly).map((p) => proj(p)));
  const [lx, ly] = proj(label);
  return { id, name, d: ringsToPath(rings), bbox: bboxOf(rings), lx: r1(lx), ly: r1(ly), lr: 40 };
}

// --- continents (110m, per-polygon continent assignment; Russia split at the Urals) ----------

const OVERRIDE = {
  Eritrea: 'africa', Cyprus: 'asia', 'N. Cyprus': 'asia', Malta: 'europe', Georgia: 'asia', Armenia: 'asia',
  Azerbaijan: 'asia', Kazakhstan: 'asia', Greenland: 'north-america', Iceland: 'europe',
};

function continentOf(name, lon, lat) {
  if (OVERRIDE[name]) return OVERRIDE[name];
  if (name === 'Turkey') return lon < 29 ? 'europe' : 'asia';
  if (lat < -60) return 'antarctica';
  if (lat < -40 && lon > 30 && lon < 110) return 'antarctica';
  if (lon < -140 && lat < 30) return 'oceania';
  if (lon < -25) {
    if (lat < 7.2) return 'south-america';
    // Venezuela, Guyana, Trinidad … sit north of 7° but east of Panama.
    if (lat < 12.3 && lon > -79.5) return 'south-america';
    return 'north-america';
  }
  if (lon > 60) {
    if (lat < -10 && lon > 110) return 'oceania';
    if (lon > 130 && lat < 25 && lat > -10 && !(lon < 142 && lat > -3 && lat < 0)) return lat < 0 || lon > 134 ? 'oceania' : 'asia';
    return 'asia';
  }
  if (lat >= 37) return lon > 44 ? 'asia' : 'europe';
  if (lon > 34 && lat > 12) return 'asia';
  return 'africa';
}

function polyCentroid(poly) {
  // lon/lat centroid of the exterior ring (planar, fine for assignment)
  const ring = poly[0];
  let x = 0, y = 0;
  for (const [a, b] of ring) { x += a; y += b; }
  return [x / ring.length, y / ring.length];
}

/** Sutherland–Hodgman clip of a lon/lat ring against lon < cut (keepWest) or lon >= cut. */
function clipRing(ring, cut, keepWest) {
  const inside = (p) => (keepWest ? p[0] < cut : p[0] >= cut);
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i], prev = ring[(i + ring.length - 1) % ring.length];
    const ci = inside(cur), pi = inside(prev);
    if (ci) {
      if (!pi) out.push([cut, prev[1] + ((cur[1] - prev[1]) * (cut - prev[0])) / (cur[0] - prev[0])]);
      out.push(cur);
    } else if (pi) {
      out.push([cut, prev[1] + ((cur[1] - prev[1]) * (cut - prev[0])) / (cur[0] - prev[0])]);
    }
  }
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
  return out.length >= 4 ? out : null;
}

const CONTINENTS = [
  ['north-america', 'North America'],
  ['south-america', 'South America'],
  ['europe', 'Europe'],
  ['africa', 'Africa'],
  ['asia', 'Asia'],
  ['oceania', 'Australia'],
  ['antarctica', 'Antarctica'],
];

{
  const topo = readJson(w110Path);
  const fc = topojson.feature(topo, topo.objects.countries);
  const buckets = Object.fromEntries(CONTINENTS.map(([id]) => [id, []]));
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const name = f.properties.name;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      if (name === 'Russia') {
        const unwrapped = poly.map((ring) => ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]));
        const wrap = (ring) => ring.map(([lon, lat]) => [lon > 180 ? lon - 360 : lon, lat]);
        for (const [keepWest, cont] of [[true, 'europe'], [false, 'asia']]) {
          const rings = unwrapped.map((r) => clipRing(r, 60, keepWest)).filter(Boolean);
          if (rings.length && clipRing(unwrapped[0], 60, keepWest)) buckets[cont].push(rings.map(wrap));
        }
        continue;
      }
      const [lon, lat] = polyCentroid(poly);
      buckets[continentOf(name, lon, lat)].push(poly);
    }
  }
  const regions = CONTINENTS.map(([id, name]) =>
    region(id, name, { type: 'MultiPolygon', coordinates: buckets[id] }, proj, 0.25, 0.6),
  );
  // Label points that read better than the pole of inaccessibility.
  const LABEL = { europe: [22, 52], asia: [92, 48], 'north-america': [-100, 45], oceania: [134, -25], antarctica: [40, -80] };
  for (const reg of regions) {
    if (LABEL[reg.id]) { const [x, y] = proj(LABEL[reg.id]); reg.lx = r1(x); reg.ly = r1(y); }
  }

  // Oceans: lon/lat zones drawn under the land (land wins where they overlap).
  const NORTH = 66;
  const SOUTH = -60;
  const pacificEast = [[-180, SOUTH], [-68, SOUTH], [-72, -20], [-77, 7], [-90, 15], [-104, 24], [-110, 40], [-110, NORTH], [-180, NORTH]];
  const pacificWest = [[180, SOUTH], [147, SOUTH], [147, -40], [140, -25], [131, -12], [116, -8.5], [106, -6.8], [103, 1.5], [101, 13], [100, NORTH], [180, NORTH]];
  const atlantic = [[-68, SOUTH], [20, SOUTH], [20, -34], [25, 0], [30, 30], [42, 42], [45, NORTH], [-110, NORTH], [-110, 40], [-104, 24], [-90, 15], [-77, 7], [-72, -20]];
  const indian = [[20, SOUTH], [147, SOUTH], [147, -40], [140, -25], [131, -12], [116, -8.5], [106, -6.8], [103, 1.5], [101, 13], [100, 40], [55, 40], [30, 30], [25, 0], [20, -34]];
  const arctic = [[-180, NORTH], [180, NORTH], [180, 90], [-180, 90]];
  const southern = [[-180, -90], [180, -90], [180, SOUTH], [-180, SOUTH]];
  const oceans = [
    planarRegion('pacific', 'Pacific Ocean', [pacificEast, pacificWest], [-140, 5]),
    planarRegion('atlantic', 'Atlantic Ocean', [atlantic], [-35, 15]),
    planarRegion('indian', 'Indian Ocean', [indian], [78, -22]),
    planarRegion('arctic', 'Arctic Ocean', [arctic], [10, 80]),
    planarRegion('southern', 'Southern Ocean', [southern], [-30, -62]),
  ];
  // Second Pacific label point (west half) for learn mode / reveal.
  emit('continents.gen.ts', 'CONTINENTS_MAP', { width: W, height: worldH, regions, oceans, sphere, graticule });
}

// --- countries (50m) ---------------------------------------------------------------------------

{
  const topo = readJson(w50Path);
  const fc = topojson.feature(topo, topo.objects.countries);
  const regions = [];
  const seen = new Map();
  for (const f of fc.features) {
    if (!f.geometry) continue;
    const name = f.properties.name;
    let id = (f.id ?? name).toString();
    if (seen.has(id)) id = id + '-' + name.replace(/\W+/g, '').toLowerCase();
    seen.set(id, true);
    // Small islands far from the main land would pull the label point; drop rings < 0.4 px² only
    // when the country has big rings (keeps tiny island nations visible).
    regions.push(region(id, name, f, proj, 0.2, 0.4));
  }
  emit('countries.gen.ts', 'COUNTRIES_MAP', { width: W, height: worldH, regions, sphere, graticule });
}
