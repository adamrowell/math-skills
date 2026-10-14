# Geography & Logic — Maps contrast, Land & Sea, Flags, Landmarks, Logic Puzzles

Status: lead game-design spec for four parallel builders (ownership in §F). Everything in
`docs/DESIGN.md` and `docs/UX-V3.md` still stands (AppHome + green PlayButton start flow, points via
`src/core` rewards, hash routes, persisted stores with `sanitize`, phone layouts, privacy gate).
Audience unchanged: one 7-year-old, iPad + desktop; points are a real reward currency, so every
mode below is **un-gameable by construction** (random tapping is net ≤ 0).

Parent feedback this spec answers:
1. Greyed-out countries are too faint — "he can't see the world".
2. Oceans is good but too easy and repeats too much → merge with Land & Sea, make it richer.
3. A Flags game "just like the country names" (find it on the map).
4. A Landmarks game with photos: 50+ (we do 103) — tap the country.
5. A Logic Puzzles app: sequences, patterns, reflections, matrices, odd-one-out… easy / medium / hard,
   lots of variety so it can't be gamed and never gets boring.

Already landed by the architect (do not redo): `AppId` + `AppGroup` in `src/core/types.ts`
(`'flags' | 'landmarks' | 'logic'`, group `'brain'`), theme tokens `--k-app-flags: #e11d48`,
`--k-app-landmarks: #d97706`, `--k-app-logic: #6366f1`, the hub's `World` (3-col) and `Brain` groups,
`appProgress()` lines for the three apps, `NO_MIC` entries, the test seed list in `tests/helpers.ts`,
and the frozen contract `src/apps/logic/engine/types.ts`.

---

## 0. Audit: what the current Maps app looks like (played with Playwright, desktop + iPad)

| Where | Finding | Measured |
|---|---|---|
| Countries map, "Giant Countries" | Every inactive country is one flat light-grey mass (`#E4E9F2`) on light-blue sea (`#D3EBFF`) with white hairline borders. Africa + Europe read as fog; coastlines vanish. | land-off vs sea **1.01 : 1** (identical luminance), border white vs land-off 1.22 : 1 |
| US map | Same: `#E4E9F2` states on `#EAF5FF` sea, white 1.2 px borders. | 1.10 : 1 |
| Continents map (Oceans stage) | Continents have **no borders at all** (`stroke = fill`), so Europe/Asia is one blob; inactive oceans keep their colours while inactive land is grey (inconsistent). | — |
| Oceans stage | 5 targets, 12 questions → each ocean asked 2–3 times per round. | `pickTarget` only guarantees no-repeat when `n ≥ 12` |
| Explore | `BOX_FILL[0] = '#E4E9F2'` (same fog) | — |
| Generated data | `MapData.outline` exists for the US (nation mesh) but **MapView never draws it**. World maps have no outline. | `src/apps/maps/MapView.tsx` |

What is good and stays: the colour-by-neighbour active fills, the hint circle, the reveal pulse,
labels with white halo, tap halos for tiny regions, the NE-states inset, Name-it zoom, the Explore
mastery view, `pickTarget`'s weighting and comeback queue.

---

## A. Maps contrast (builder 1)

### A.1 Tokens — add to `maps.css` on `.mp-screen` (light theme)

```css
.mp-screen {
  --mp-sea: #cfe6fc;         /* world sphere + .mp-mapwrap bg; was #d3ebff */
  --mp-sea-us: #e6f2fd;      /* US map background; was #eaf5ff */
  --mp-grat: rgba(255, 255, 255, 0.55);
  --mp-land-off: #d3cec4;    /* inactive land: warm sand-grey (hue-separated from the cool sea); was #e4e9f2 */
  --mp-border-off: #8a94a8;  /* inactive borders; was #fff */
  --mp-border-on: #ffffff;   /* active borders (unchanged) */
  --mp-coast: #6f7b93;       /* coastline rim under the land layer (new) */
  --mp-hover: #1b2559;       /* hover ring (desktop) */
  --mp-correct: #34d27a; --mp-correct-ink: #15803d;
  --mp-wrong: #ff7b7f;   --mp-wrong-ink: #c81e1e;
  --mp-reveal: #ffc43d;  --mp-reveal-ink: #e07b00;   /* reveal / target / selected */
  --mp-lake: #9fd3f7;    --mp-lake-ink: #ffffff;
}
```

Dark theme: the shell has none (`color-scheme: light`); do **not** wire one. Keep this token
set in a comment block for the day it exists (verified ratios below):
`--mp-sea #1a2238 · --mp-land-off #5b6271 · --mp-border-off #8e97aa · --mp-coast #8e97aa · labels #f3f5fa`.

### A.2 Rules (replace the corresponding blocks in `maps.css`; `MapView.tsx` drops the `DIM` constant and lets CSS colour `.is-off`)

```css
.mp-mapwrap { background: var(--mp-sea); box-shadow: inset 0 0 0 2px #bfd8f3; }
.mp-sea { fill: var(--mp-sea); }  .mp-sea--us { fill: var(--mp-sea-us); }
.mp-grat { stroke: var(--mp-grat); }

/* Coastline rim: data.outline drawn BELOW the land layer. Land fills cover the inner half, so only
   a ~1.1 px dark rim remains where land meets water. One path, zero per-frame cost. */
.mp-coast { fill: none; stroke: var(--mp-coast); stroke-width: 2.2; stroke-linejoin: round;
            vector-effect: non-scaling-stroke; pointer-events: none; }

.mp-land.is-off { fill: var(--mp-land-off); stroke: var(--mp-border-off); stroke-width: 0.9; }
.mp-map--countries .mp-land.is-off { stroke-width: 0.8; }
.mp-land.is-on  { stroke: var(--mp-border-on); stroke-width: 1.2; }
.mp-map--countries .mp-land.is-on { stroke-width: 0.8; }
.mp-land.is-continent { stroke: var(--mp-border-on); stroke-width: 0.9; }   /* was stroke = fill */

/* Water regions (oceans, seas, lakes — §B): off = invisible against the sea. */
.mp-ocean.is-off, .mp-sea-zone.is-off { fill: var(--mp-sea); stroke: none; }
.mp-ocean.is-on,  .mp-sea-zone.is-on  { stroke: rgba(255,255,255,.95); stroke-width: 1.5; stroke-dasharray: 5 5; }
.mp-lake { fill: var(--mp-lake); stroke: var(--mp-lake-ink); stroke-width: 0.8; vector-effect: non-scaling-stroke; }
.mp-lake.is-off { fill: color-mix(in srgb, var(--mp-lake) 55%, var(--mp-sea)); }

@media (hover: hover) {
  .mp-map:not(.is-disabled) .mp-land.is-on:hover,
  .mp-map:not(.is-disabled) .mp-ocean.is-on:hover,
  .mp-map:not(.is-disabled) .mp-sea-zone.is-on:hover,
  .mp-map:not(.is-disabled) .mp-lake.is-on:hover { filter: brightness(1.06) saturate(1.1); stroke: var(--mp-hover); stroke-width: 1.8; }
  .mp-map:not(.is-disabled) .mp-land.is-off:hover { stroke: var(--mp-coast); stroke-width: 1.4; }  /* "tappable: hear its name" */
}
.mp-land.is-correct, .mp-ocean.is-correct, .mp-sea-zone.is-correct, .mp-lake.is-correct { fill: var(--mp-correct); }
.mp-land.is-wrong,   … { fill: var(--mp-wrong); }
.mp-land.is-reveal, .is-target, .is-selected … { fill: var(--mp-reveal); }
.mp-outline.is-correct { stroke: var(--mp-correct-ink); }  .mp-outline.is-wrong { stroke: var(--mp-wrong-ink); }
.mp-outline.is-reveal, .mp-outline.is-target { stroke: var(--mp-reveal-ink); }   /* widths/pulse unchanged */
```

`ExploreScreen.BOX_FILL[0]` → `'#d3cec4'` (= `--mp-land-off`); legend "New" swatch follows.

### A.3 MapView changes

1. Render `data.outline` once as `<path d={data.outline} className="mp-coast" />` **between the
   water layers and `.mp-landlayer`** (main map and inside the inset's transform group).
2. Remove `DIM`/inline `--fill` for off regions: `style={{'--fill': on ? colour : undefined}}` and
   `.mp-land { fill: var(--fill, var(--mp-land-off)) }`.
3. Water layers: `map.water` (oceans + seas, drawn under land, class `mp-ocean` for `kind: 'ocean'`
   and `mp-sea-zone` for `'sea'`) and `map.lakes` (drawn **above** land, class `mp-lake`). See §B.3.

### A.4 `gen-geo.mjs`: emit `outline` for the world maps

`countries-110m.json` and `countries-50m.json` both carry `objects.land`; `topojson.mesh(topo,
topo.objects.land)` is the coastline (no internal borders). Project with `proj`, simplify 0.25
(110m) / 0.2 (50m), `ringsToPath`, and write it as `outline` for `CONTINENTS_MAP` and `COUNTRIES_MAP`
(US already has it). Inputs are the three files named in the script header (download to a scratch
folder; never into the repo). Fallback if regeneration is blocked: render the land layer twice (a
`fill:none; stroke: var(--mp-coast); stroke-width: 2.2` copy under the real one) — same visual.

### A.5 Verified contrast (WCAG relative-luminance ratios; pastel fills next to each other never
reach 3:1, so shapes are made legible by **hue separation + a ≥ 2:1 border + a ≥ 3:1 coast rim**)

| Pair | Before | After |
|---|---|---|
| inactive land vs world sea | 1.01 | **1.22** (plus hue: warm vs cool) |
| inactive land vs US sea | 1.10 | **1.38** |
| inactive border vs sea | 1.22 (white) | **2.38** |
| inactive border vs inactive land | 1.22 | **1.95** |
| coast rim vs sea / US sea | — | **3.32 / 3.75** (meets 1.4.11 non-text 3:1) |
| coast rim vs inactive land | — | 2.72 |
| hover ring vs inactive land / active fills | — | 9.2 / ≥ 9 |
| correct / wrong / reveal outline vs inactive land | — | 3.20 / 3.66 / 1.91 (reveal also pulses, 4 px) |
| labels ink vs sea / inactive land | 11.8 / 9.4 | 11.3 / 9.2 |
| active fills vs inactive land (7 colours) | 1.02–1.30 | 1.00–1.27 — unchanged by design: active land is *saturated*, inactive is *unsaturated*; the border + rim carry the shape |
| dark set (not wired): land-off vs sea · coast vs sea · labels vs land-off | — | 2.58 · 5.38 · 5.61 |

### A.6 Acceptance (builder 1, `tests/maps.spec.ts` additions)
- A `.mp-coast` path exists on `#/maps/find/giants` and `#/maps/find/us-big`.
- Computed `fill` of an `.mp-land.is-off` path is `rgb(211, 206, 196)` and its `stroke`
  `rgb(138, 148, 168)`; an `.is-on` path keeps a white stroke.
- Screenshot pass (manual, attach to the PR): giants / europe / us-big / earth on desktop and iPad
  landscape — every inactive country outline readable at arm's length.

---

## B. "Land & Sea" — richer world water game (builder 1; replaces the Oceans stage)

### B.1 Target catalog (`src/apps/maps/stages.ts` + `tools/gen-geo.mjs`)

Regions by kind. Oceans and continents exist. **Seas/gulfs/bays** are hand-drawn lon/lat polygons
drawn *under* land exactly like the current oceans (land wins, so rough edges on the land side are
free); they are drawn after the oceans so they win on water. **Lakes** come from Natural Earth
110m lakes (real geometry, drawn *above* land). Rivers are **deferred** (line features need their
own hit model; not requested by the parent).

| id | label | kind | label point (lon, lat) | prior | group hint |
|---|---|---|---|---|---|
| pacific / atlantic / indian / arctic / southern | (existing) | ocean | existing | 0.9–1.2 | — |
| north-america … antarctica | (existing 7) | land | existing | 0.6–1.0 | — |
| mediterranean | Mediterranean Sea | sea | 16, 36 | 1.0 | between Europe and Africa |
| caribbean | Caribbean Sea | sea | -75, 15 | 1.0 | south of the USA |
| gulf-mexico | Gulf of Mexico | sea | -90, 25 | 1.0 | south of the USA |
| red-sea | Red Sea | sea | 38, 20 | 1.1 | next to Egypt |
| black-sea | Black Sea | sea | 34, 43.5 | 1.3 | north of Turkey |
| north-sea | North Sea | sea | 3, 56 | 1.2 | next to the UK |
| baltic | Baltic Sea | sea | 19, 58 | 1.3 | north of Poland |
| south-china | South China Sea | sea | 114, 13 | 1.2 | south of China |
| arabian | Arabian Sea | sea | 63, 15 | 1.3 | west of India |
| bengal | Bay of Bengal | sea | 88, 14 | 1.2 | east of India |
| persian-gulf | Persian Gulf | sea | 52, 27 | 1.4 | next to Saudi Arabia |
| hudson-bay | Hudson Bay | sea | -85, 59 | 1.2 | inside Canada |
| bering | Bering Sea | sea | -175, 58 | 1.3 | between Alaska and Russia |
| sea-japan | Sea of Japan | sea | 135, 40 | 1.3 | between Japan and Korea |
| coral | Coral Sea | sea | 152, -18 | 1.3 | next to Australia |
| tasman | Tasman Sea | sea | 160, -38 | 1.4 | between Australia and New Zealand |
| gulf-guinea | Gulf of Guinea | sea | 2, 1 | 1.4 | the bend of Africa |
| gulf-alaska | Gulf of Alaska | sea | -147, 56 | 1.3 | south of Alaska |
| great-lakes | Great Lakes | lake | -84, 45 | 1.0 | USA / Canada |
| caspian | Caspian Sea | lake | 51, 42 | 1.3 | the biggest lake |
| victoria | Lake Victoria | lake | 33, -1 | 1.3 | Africa |
| baikal | Lake Baikal | lake | 108, 53.5 | 1.4 | the deepest lake, Russia |

Sea polygons (lon, lat; paste into `gen-geo.mjs` next to the oceans; densified by `lonLatPoly`):

```js
const SEAS = [
  ['mediterranean', 'Mediterranean Sea', [[-6,35],[-6,44],[5,44.5],[12,46],[20,46],[27.5,41],[36,37],[36,31],[20,30],[10,33]], [16,36]],
  ['black-sea', 'Black Sea', [[27.5,40.8],[27.5,47],[42,47],[42,40.8]], [34,43.5]],                 // after mediterranean (wins at Marmara)
  ['red-sea', 'Red Sea', [[32,30],[35.5,30],[44,12.5],[43,11],[39,15],[32,27]], [38,20]],
  ['persian-gulf', 'Persian Gulf', [[47,30.5],[50.5,30.5],[57,27],[56.5,24],[50,23.5],[47,28]], [52,27]],
  ['arabian', 'Arabian Sea', [[44,12.5],[52,16],[59,22],[69,25],[78,8],[73,-2],[51,2],[50,10]], [63,15]],
  ['bengal', 'Bay of Bengal', [[78,8],[80,16],[86,23],[93,22],[98,13],[92,5],[82,4]], [88,14]],
  ['south-china', 'South China Sea', [[99,1],[105,3],[109,21],[122,23],[122,18],[118,8],[110,0],[104,-1]], [114,13]],
  ['caribbean', 'Caribbean Sea', [[-88,9],[-88,21],[-74,21],[-60,18],[-60,10],[-75,8]], [-75,15]],
  ['gulf-mexico', 'Gulf of Mexico', [[-98,18],[-98,31],[-80,31],[-80,25],[-88,21],[-91,18]], [-90,25]],
  ['north-sea', 'North Sea', [[-4,51],[-4,61],[7,62],[9,57],[9,53],[2,51]], [3,56]],
  ['baltic', 'Baltic Sea', [[9,53.5],[9,58],[20,66],[31,66],[31,59],[26,54],[12,53]], [19,58]],
  ['hudson-bay', 'Hudson Bay', [[-95,51],[-95,65],[-76,65],[-76,51]], [-85,59]],
  ['bering', 'Bering Sea', [[-180,51],[-180,66],[-157,66],[-157,54],[-170,51]], [-175,58], [[180,51],[163,51],[163,66],[180,66]]],
  ['sea-japan', 'Sea of Japan', [[128,33],[128,42],[136,48],[142,48],[142,42],[134,35]], [135,40]],
  ['coral', 'Coral Sea', [[142,-10],[142,-28],[158,-30],[165,-12],[150,-8]], [152,-18]],
  ['tasman', 'Tasman Sea', [[150,-45],[150,-30],[170,-30],[170,-47]], [160,-38]],
  ['gulf-guinea', 'Gulf of Guinea', [[-8,6],[12,6],[12,-6],[-8,-2]], [2,1]],
  ['gulf-alaska', 'Gulf of Alaska', [[-160,54],[-145,62],[-132,55],[-140,50],[-160,50]], [-147,56]],
];
```
(`bering` has a second polygon for the west side of the antimeridian, like `pacificWest`.)
The builder eyeballs each zone against the coast in Explore and nudges vertices; the only hard
rule is **no visible overlap between two water zones**.

Lakes: download `ne_110m_lakes.zip` (public domain, naturalearthdata.com), unzip in a scratch
folder, add `shapefile@0.6.6` (BSD-3) as a devDependency, read `ne_110m_lakes.shp` in `gen-geo.mjs`
(4th CLI argument), keep `name ∈ {Lake Superior, Lake Michigan, Lake Huron, Lake Erie, Lake Ontario}`
merged into `great-lakes`, plus `Caspian Sea → caspian`, `Lake Victoria → victoria`, `Lake Baikal →
baikal`; project with `proj`, simplify 0.15, `lr` from `labelPoint`. Emit as `lakes` in
`CONTINENTS_MAP`. If the shapefile path is absent the script skips lakes (so a clean checkout still
builds the other data).

### B.2 Types (`src/apps/maps/types.ts`)

```ts
export type WaterKind = 'ocean' | 'sea' | 'lake';
export interface MapRegionData { …existing…; kind?: 'land' | WaterKind }   // generated; default 'land'
export interface MapData { …; oceans?: MapRegionData[]; seas?: MapRegionData[]; lakes?: MapRegionData[]; outline?: string }
export interface Region extends MapRegionData { label; group?; prior; kind: 'land' | WaterKind; isOcean?: boolean /* = kind !== 'land', kept for RoundScreen */ }
export interface LoadedMap { kind; data; byId; land: Region[]; water: Region[] /* oceans + seas */; lakes: Region[] }
export interface StageDef { …; /** questions per round; default ROUND_LENGTH (12) */ roundLength?: number }
```
`mapLoader.build` fills `water`/`lakes`; `regionMeta('continents', …)` gets the new labels/priors
(`WORLD_META`), with `group` = the "group hint" column (shown in the miss-1 label: "Look near
Egypt!" — rendered as the existing hint circle; the text goes in `.mp-prompt__verb`).

### B.3 Stages — World pack becomes

| id | title | emoji | targets | unlock |
|---|---|---|---|---|
| `earth` | Land & Sea | 🐳 | 7 continents + 5 oceans (12) | open |
| `seas` | Seas & Gulfs | 🌊 | mediterranean, caribbean, gulf-mexico, red-sea, black-sea, north-sea, baltic, south-china, arabian, bengal, persian-gulf, sea-japan (12) | 2★ on earth |
| `bays-lakes` | Bays & Lakes | 🏞️ | hudson-bay, bering, coral, tasman, gulf-guinea, gulf-alaska, great-lakes, caspian, victoria, baikal + atlantic, pacific (12) | 2★ on seas |
| `water-world` | Whole World | 🌐 | all 36 | 2★ on bays-lakes |

`continents` and `oceans` stage ids are **removed** (the parent's complaint). Their stars in
`ms2:maps:progress:v1` stay as dead keys (harmless; `sanitize` keeps numbers). `tests/maps.spec.ts`
`STAGE_IDS` and the `allUnlocked()` helper follow. Pack `exploreStage` → `water-world`.
`PACKS[world].title` → "World" (unchanged), hero subtitle → "Find the land and the water!".

### B.4 Scheduler — no repeats, spaced, un-gameable

`pickTarget` already blocks repeats when `n ≥ 12`; all four stages now have `n ≥ 12`, so a 12-question
round asks **12 different targets** (every target exactly once on the 12-target stages, a
mastery-weighted 12 of 36 on Whole World). Add to `logic.ts`:

- **Across rounds**: `asked` is seeded with the previous round's last 4 targets of the same stage
  (`ms2:maps:recent:v1`, `stageId → string[]`), so two consecutive rounds never open with the same
  question and the 12-of-36 draw rotates. Weight already includes `recency` 0.15 for the recent block.
- **Freshness** (`maps/logic.ts` `freshness`, added after review): never-asked targets weigh × 4 and
  targets answered right in the last 20 minutes × 0.3, so on pools bigger than a round (Whole World,
  Landmarks, Flags) the next rounds cover the places he has not met yet instead of re-asking the
  same ones (unit test: a 24-place pool is covered in 2–3 perfect rounds).
- **Spaced repetition** (`maps/logic.ts` `dueBoost`): weight × 2 when `now − mastery.lastSeen > 3 days`
  and box ≥ 3 (things he knew but hasn't seen); × 0.6 when box = 5 and seen < 1 day ago.
- **Missed-target comeback** stays (3–5 later; on a 12-of-12 stage the comeback replaces a not-yet-asked
  target and that target is asked next round first — see the recent-seed above).
- `roundLength` = `stage.roundLength ?? 12` everywhere `ROUND_LENGTH` is used in `RoundScreen`/`MapsHome`.

### B.5 Scoring, hints, mastery (unchanged economy, documented so it is explicit)

First-try `8 + 8·prior` (+8 ≤ 4 s, +4 ≤ 8 s) × combo; miss 1 −5 + hint circle **and** the group hint
text ("Look near Egypt!"); miss 2 −5 + reveal (pulsing outline, 7 s auto-advance, 0 points); tapping
an off-level water zone/land just names it (no penalty). Water regions use the same `applyMastery`
keyed `continents:<id>`. Stars = first-try/12 (3★ = all). **Water Master** mastery on the Maps home:
`🌊 n/36 water learned` when the World pack is selected.

### B.6 Name-it for water

`buildChoices` uses label points (works for seas). `zoomTo` caps width at `map.data.width × 1.05`; for
oceans use the full stage view instead of zooming (`region.kind === 'ocean'` → no zoom).

### B.7 Tests
- vitest (`logic.test.ts`): 12-target stage × 12 questions → 12 distinct ids (500 trials); recent seed
  prevents the first question equalling any of the previous round's last 4; `dueBoost` ordering.
- vitest (`stages.test.ts`, new): every stage target id exists in the loaded map (`continents.gen`),
  no two water polygons' label points fall inside each other's bbox, every stage has ≥ 12 targets.
- Playwright: `#/maps/find/seas` renders 12 `.mp-sea-zone.is-on` paths; tapping `red-sea` when asked
  "Red Sea" pays; `#/maps/find/bays-lakes` renders `.mp-lake` paths above land (DOM order).

---

## C. Flags app (builder 1) — `src/apps/flags/**`, registry id `flags`

Hub card: 🏳️ **Flags** · tagline "Whose flag is it?" · group `world` · colour `--k-app-flags` (crimson).
Routes: `#/flags` home · `#/flags/find/<level>` · `#/flags/which/<level>` · `#/flags/spotter` · `#/flags/album`.
Reuses from `../maps`: `MapView`, `useMap('countries')`, `speak`/`primeSpeech`, `pickTarget`,
`scheduleComeback`, `answerPoints`, `comboMultiplier`, `missPenalty`, `starsFor`, stage views
(`WORLD_NO_ANTARCTICA`, Europe/Asia-Africa views exported from `stages.ts`).

### C.1 Assets

`flag-icons@7.5.0` (MIT; flag designs themselves are public domain). `npm i -D flag-icons@7.5.0`
(exact, no caret). `scripts/copy-flags.mjs` (run from `postinstall` and `prebuild`, like `copy-ort.mjs`)
copies `node_modules/flag-icons/flags/4x3/<cc>.svg` for the 64 codes in `src/apps/flags/data/flags.ts`
into `public/flags/4x3/`; `public/flags/.gitignore` = `*` + `!.gitignore` (same pattern as
`public/ort`). The app loads `./flags/4x3/${cc}.svg` via `<img>` (relative base, works on Pages).
A `Flag` component renders the image inside a 4:3 frame with a 2 px `--k-line` border and 12 px
radius (white-heavy flags like Japan/Finland need the frame). `README` gets one line crediting
flag-icons; `docs/IMAGE-CREDITS.md` (builder 2 creates it) gets a "Flags" section that builder 1 appends.

### C.2 Flag catalog — `src/apps/flags/data/flags.ts`

```ts
export interface FlagDef {
  cc: string;        // ISO alpha-2 lower-case = file name
  id: string;        // ISO numeric = COUNTRIES_MAP region id ('840')
  name: string;      // kid-facing, matches COUNTRY_LABELS
  tier: 1 | 2 | 3;
  colors: string;    // dominant colours, letters of r g b y w k(black) o(orange) p(purple) — for distractors
  groups: string[];  // look-alike group ids (below)
  fact: string;      // one sentence, ≤ 14 words
}
```

Tier 1 — "Famous flags" (16): us 840 "Stars and stripes: 50 stars, one for each state." · ca 124
"A red maple leaf — the tree's leaves turn red in fall." · gb 826 "The Union Jack mixes three
crosses from England, Scotland and Ireland." · fr 250 "Blue, white, red stripes — the French
tricolore." · jp 392 "A red sun on white — Japan is the Land of the Rising Sun." · br 076 "A green
field, a yellow diamond and a starry night sky." · cn 156 "Red with five yellow stars." · au 036
"The Union Jack plus the Southern Cross stars." · mx 484 "An eagle eating a snake on a cactus!" ·
it 380 "Green, white and red — same colours as pizza toppings." · de 276 "Black, red and gold
stripes." · in 356 "Orange, white, green, with a blue wheel in the middle." · es 724 "Red and yellow
with a coat of arms." · kr 410 "A red-and-blue yin-yang circle with four black trigrams." · gr 300
"Nine blue-and-white stripes and a cross." · ch 756 "A white cross on red — and it is square!"

Tier 2 — "World flags" (24): ar 032 "Sky blue, white, sky blue with a smiling sun." · eg 818 "Red,
white, black with a golden eagle." · za 710 "Six colours in a sideways Y." · ru 643 "White, blue, red
stripes." · se 752 "A yellow cross on blue." · no 578 "A blue cross with a white edge on red." · dk 208
"A white cross on red — the oldest flag still used." · ie 372 "Green, white, orange — green first." ·
pt 620 "Green and red with a globe and shield." · nl 528 "Red, white, blue stripes." · tr 792 "A white
moon and star on red." · sa 682 "Green with white writing and a sword." · il 376 "A blue star of David
between two blue stripes." · ke 404 "Black, red, green with a shield and two spears." · ng 566 "Green,
white, green." · jm 388 "A yellow X splits green and black." · vn 704 "A big yellow star on red." ·
th 764 "Red, white, blue, white, red — the blue stripe is widest." · ph 608 "A sun with eight rays and
three stars." · nz 554 "The Union Jack with four red stars." · ua 804 "Blue sky over a yellow wheat
field." · pl 616 "White on top, red below." · cu 192 "Blue and white stripes with a red triangle." ·
pe 604 "Red, white, red — up and down."

Tier 3 — "Look-alikes" (24): td 148 "Blue, yellow, red — almost the same as Romania!" · ro 642
"Blue, yellow, red — a lighter blue than Chad." · id 360 "Red on top, white below — Monaco's twin." ·
mc 492 "Red over white, like Indonesia — but a squarer shape." · ci 384 "Orange, white, green —
Ireland backwards!" · lu 442 "Red, white, light blue — the Netherlands' lighter cousin." · is 352
"A red cross with a white edge on blue — Norway's colours swapped." · fi 246 "A blue cross on white."
· co 170 "Yellow (big), blue, red." · ec 218 "Yellow, blue, red with a coat of arms in the middle." ·
ve 862 "Yellow, blue, red with an arc of stars." · at 040 "Red, white, red — side to side." · lv 428
"Dark red, white, dark red — thinner white stripe." · ml 466 "Green, yellow, red — up and down." · sn 686
"Green, yellow, red with a green star." · gn 324 "Red, yellow, green — Mali flipped." · sk 703 "White,
blue, red with a shield on the left." · si 705 "White, blue, red with a mountain shield." · qa 634
"Maroon and white with a zig-zag edge." · bh 048 "Red and white with a zig-zag — five points." · hu
348 "Red, white, green stripes." · bg 100 "White, green, red stripes." · ad 020 "Blue, yellow, red with
a coat of arms." · md 498 "Blue, yellow, red with an eagle."

Look-alike groups (a flag can be in several): `tricolor-byr` [td ro ad md], `red-white-halves`
[id mc pl], `green-white-orange` [ie ci it], `southern-cross` [au nz gb], `rwb-horizontal` [nl lu ru sk
si], `nordic-cross` [no is se fi dk], `ybr-horizontal` [co ec ve], `red-white-red` [at lv pe ca], `pan-
african` [ml sn gn], `zigzag` [qa bh], `rwg-horizontal` [hu bg ir? no — hu bg it mx], `blue-white`
[gr il fi ar], `moon-star` [tr pk? not included → tr sa], `stars-stripes` [us cu].

Unit test: every `id` exists in `COUNTRIES_MAP.regions`; the ≤ 3 that do not (tiny states, e.g.
Monaco if Natural Earth 50m lacks it) are marked `mapless` at load and never appear in Find mode.

### C.3 Modes

**Find the country** (the "just like country names" mode). Flag shown big (≈ 220 px wide, max 40 %
of the prompt row) + name under it (`🔊` reads "Find the flag of France"). He taps the country on the
countries map. Camera: level view = the tier's countries' union bbox padded 12 % (Famous flags →
world; Look-alikes → mostly Europe + Africa; Whole World → world + Europe inset). **Auto-zoom rule**:
if the target's bbox is < 28 px on screen at the level view, the camera tweens to `zoomTo(target)`
(×3 margin) before the question shows, prompt chip says `🔍 Zoomed in`. Same miss economy as Maps
(miss 1 −5 + hint circle + "It's in Europe!", miss 2 −5 + reveal, 0). Off-level countries just get
named. Mastery `flags:find:<id>`.

*After review:* the name is hidden ("Whose flag? Find the country!", × 1.5 points) as soon as the
flag's sticker is won, so Find it tests the flag rather than reading. A `👀 Name?` chip shows it for
that question at × 0.7 (no gold frame, no box promotion). The two pairs that look identical in our
pictures (Indonesia/Monaco, Chad/Romania, `TWINS` in `data/flags.ts`) are never name-hidden and never
offered side by side. Countries too small to find (Monaco, Andorra, Bahrain, Qatar —
`TOO_SMALL_TO_FIND`) are left out of Find it; the zoom camera narrows for slivers like Luxembourg so
the target is ≈ 28 px on screen, and several tiny-country dots on one camera get different colours.

**Which flag?** (unlocks at 2★ Find on that level). The country is highlighted (`target` mark +
zoomTo) and named; 4 flags appear in a 2×2 grid (phone: 2×2, 120 px tall). Distractors: 1–2 from the
answer's look-alike groups, then same `colors` (≥ 2 shared letters), then same continent, never a
flag that was wrong in the last 3 questions. Points `5 + 4·prior` (+4 ≤ 3 s), miss 1 −5 + the wrong
flag greys with its name ("That's Chad"), miss 2 −5 + reveal. Mastery `flags:which:<id>`.

**Flag spotter** (speed round; unlocks at 2★ Which-flag on World flags). 45 s. Six flags in a 3×2
grid; the prompt names one ("Tap **Japan**"). Correct +6 (+2 ≤ 1.5 s), wrong −5 and the round
continues (no hint, no reveal); the grid reshuffles every question, the target is never the same
cell twice in a row, and 1 of the 6 is always a look-alike of the target. PB = correct count
(`flags:spotter`). This mode is pure recognition practice; the −5 keeps mashing net-negative.

### C.4 Levels

| level | targets | Find | Which | notes |
|---|---|---|---|---|
| `famous` | tier 1 (16) | open | 2★ Find | big, distinct, kid-known |
| `world` | tier 1+2 (40) | 2★ famous | 2★ Find | 12 asked of 40, mastery-weighted |
| `lookalikes` | tier 3 + their partners (≈ 34) | 2★ world | 2★ Find | distractors always from the groups |
| `all` | 64 | 2★ lookalikes | 2★ Find | — |

Round = 12 questions (`pickTarget`, no repeats). Stars = first-try/12. Hero: `PLAY · Find it ·
Famous flags`; More ways to play: Which flag? · Flag spotter · Levels · **Album**.

### C.5 Scoring summary (per round)
Find: as Maps. Which: as Name-it. Spotter: above. Round bonuses via `roundBonuses` (perfect +40 at
12/12, first round of the day +50 when ≥ 10 answered and ≥ 80 % first-try — reuse the `real` rule
from `RoundScreen.finish`). `rewards.addPoints('flags', …)`.

### C.6 Sticker album (the motivator) — `ms2:flags:progress:v1`

```ts
interface FlagsProgress { version: 1; stars: Record<string, number>; plays: Record<string, number>;
  collected: Record<string, number /* ts */>; gold: Record<string, number>; level: LevelId; best: Record<string, number> }
```
A flag is **collected** (sticker peels onto the page with `pop` + confetti burst) the first time it is
answered first-try in Find **or** twice first-try in Which; **gold** frame when its Find mastery box
≥ 4. `#/flags/album`: 8-per-row grid (phone 4) of all 64 slots in tier order; uncollected = grey
dashed outline with `?`; tap a sticker → big flag, name, fact, 🔊. Header: `🏳️ 23/64 collected · ⭐ 9
gold`. The hub card line reads `🏳️ n flags` (already wired in `appProgress`).

### C.7 Tests
- vitest: catalog integrity (64 entries, unique cc/id, every id on the map or ≤ 3 mapless, every
  flag has ≥ 1 group or ≥ 2 colours); `buildFlagChoices` always includes a group look-alike when one
  exists and never the answer twice; spotter never repeats the target cell.
- Playwright (`tests/flags.spec.ts`): home → PLAY → Find round starts with a flag `<img>` whose
  `src` ends with `/flags/4x3/<cc>.svg` and `naturalWidth > 0`; correct tap pays, miss −5; Which-flag
  shows 4 flags and greys a wrong one; album shows 64 slots and the collected count increments
  after a correct answer; all on Desktop Chrome + iPad landscape + iPhone 15 (no overflow).

---

## D. Landmarks app (builder 2) — `src/apps/landmarks/**`, `public/landmarks/**`, registry id `landmarks`

Hub card: 🗼 **Landmarks** · tagline "Where in the world?" · group `world` · colour `--k-app-landmarks` (amber).
Routes: `#/landmarks` · `#/landmarks/find/<level>` · `#/landmarks/passport` · `#/landmarks/credits`.
Reuses `../maps` exactly like Flags (MapView, loaders, logic, speech).

### D.1 Data — `src/apps/landmarks/data/landmarks.ts`

```ts
export type LandmarkCategory = 'building' | 'nature' | 'ancient' | 'modern';
export interface LandmarkDef {
  id: string; name: string; cc: string /* ISO alpha-2 */; id3: string /* ISO numeric = map region id */;
  state?: string /* US postal code; omit for DC */; lat: number; lon: number;
  tier: 1 | 2 | 3; category: LandmarkCategory;
  accept?: string[] /* other alpha-2 that also count (border landmarks) */;
  fact: string /* one kid sentence */; commonsFile?: string /* 'Tour_Eiffel_Wikimedia_Commons_(cropped).jpg' */;
}
```
Port the 60 entries of `src/data/geography/landmarks.ts` (coordinates, facts, `commonsFile` = the
file name inside the legacy `imageUrl`), then add the rest below. Facts in the legacy file are good;
shorten to ≤ 16 words. **103 landmarks** (tier 1 = 24 super-famous, 2 = 38, 3 = 41):

| id | name | cc · state | lat, lon | tier | cat | accept | kid fact |
|---|---|---|---|---|---|---|---|
| eiffel-tower | Eiffel Tower | FR | 48.858, 2.295 | 1 | building | | It was meant to be torn down after 20 years. |
| statue-liberty | Statue of Liberty | US · NY | 40.689, -74.045 | 1 | building | | A gift from France, shipped in 350 pieces. |
| great-wall | Great Wall of China | CN | 40.432, 116.570 | 1 | ancient | | Over 13,000 miles long. |
| pyramids-giza | Pyramids of Giza | EG | 29.979, 31.134 | 1 | ancient | | The oldest of the Seven Wonders, and the only one left. |
| taj-mahal | Taj Mahal | IN | 27.175, 78.042 | 1 | building | | Built from white marble that glows pink at sunrise. |
| colosseum | Colosseum | IT | 41.890, 12.492 | 1 | ancient | | 50,000 Romans watched shows here. |
| big-ben | Big Ben | GB | 51.501, -0.125 | 1 | building | | Big Ben is really the bell inside the clock tower. |
| sydney-opera | Sydney Opera House | AU | -33.857, 151.215 | 1 | modern | | Its roof looks like sails on the harbour. |
| golden-gate | Golden Gate Bridge | US · CA | 37.820, -122.478 | 1 | modern | | Painted "international orange" so ships see it in fog. |
| mount-fuji | Mount Fuji | JP | 35.361, 138.727 | 1 | nature | | A volcano — and Japan's tallest mountain. |
| grand-canyon | Grand Canyon | US · AZ | 36.054, -112.140 | 1 | nature | | A river carved it for 6 million years. |
| niagara-falls | Niagara Falls | US · NY | 43.083, -79.074 | 1 | nature | CA | Enough water for a million bathtubs every second. |
| mount-everest | Mount Everest | NP | 27.988, 86.925 | 1 | nature | CN | The highest mountain on Earth. |
| leaning-tower | Leaning Tower of Pisa | IT | 43.723, 10.396 | 1 | building | | It started leaning while it was still being built. |
| christ-redeemer | Christ the Redeemer | BR | -22.952, -43.210 | 1 | building | | A 98-foot statue with open arms above Rio. |
| machu-picchu | Machu Picchu | PE | -13.163, -72.545 | 1 | ancient | | A city in the clouds built by the Inca. |
| stonehenge | Stonehenge | GB | 51.179, -1.826 | 1 | ancient | | Giant stones set up 5,000 years ago — nobody knows exactly how. |
| tower-bridge | Tower Bridge | GB | 51.506, -0.075 | 1 | building | | The road opens in the middle to let ships through. |
| burj-khalifa | Burj Khalifa | AE | 25.197, 55.274 | 1 | modern | | The tallest building in the world. |
| mount-rushmore | Mount Rushmore | US · SD | 43.879, -103.459 | 1 | building | | Four presidents' faces carved into a mountain. |
| hollywood-sign | Hollywood Sign | US · CA | 34.134, -118.322 | 1 | modern | | Each letter is 45 feet tall. |
| white-house | White House | US | 38.898, -77.037 | 1 | building | | Where the US president lives and works. |
| uluru | Uluru | AU | -25.344, 131.037 | 1 | nature | | A giant red rock in the middle of Australia. |
| great-barrier-reef | Great Barrier Reef | AU | -18.287, 147.699 | 1 | nature | | The biggest living thing — you can see it from space. |
| petra | Petra | JO | 30.329, 35.444 | 2 | ancient | | A whole city carved into pink rock. |
| angkor-wat | Angkor Wat | KH | 13.413, 103.867 | 2 | ancient | | The largest temple in the world, hidden in the jungle. |
| empire-state | Empire State Building | US · NY | 40.748, -73.986 | 2 | building | | Built in just 410 days. |
| sagrada-familia | Sagrada Família | ES | 41.404, 2.174 | 2 | building | | Builders have been working on it since 1882. |
| st-basils | St Basil's Cathedral | RU | 55.753, 37.623 | 2 | building | | Its onion domes look like swirly candy. |
| forbidden-city | Forbidden City | CN | 39.916, 116.397 | 2 | ancient | | A palace with 9,000 rooms. |
| brandenburg-gate | Brandenburg Gate | DE | 52.516, 13.378 | 2 | building | | A horse-drawn chariot stands on top. |
| neuschwanstein | Neuschwanstein Castle | DE | 47.558, 10.750 | 2 | building | | The castle that inspired Sleeping Beauty's. |
| acropolis | Acropolis & Parthenon | GR | 37.972, 23.726 | 2 | ancient | | A temple on a hill, 2,500 years old. |
| chichen-itza | Chichén Itzá | MX | 20.684, -88.568 | 2 | ancient | | Clap at the pyramid and it chirps like a bird. |
| moai | Easter Island Moai | CL | -27.113, -109.350 | 2 | ancient | | Nearly 900 giant stone heads. |
| victoria-falls | Victoria Falls | ZW | -17.924, 25.857 | 2 | nature | ZM | The locals call it "the smoke that thunders". |
| kilimanjaro | Mount Kilimanjaro | TZ | -3.067, 37.356 | 2 | nature | | Snow on top, even though it is near the equator. |
| sahara | Sahara Desert | MA | 31.100, -4.000 | 2 | nature | DZ,LY,EG,TN,ML,NE,TD,SD,MR | As big as the whole United States. |
| amazon | Amazon Rainforest | BR | -3.100, -60.000 | 2 | nature | PE,CO | One in ten animal species lives here. |
| yellowstone | Old Faithful, Yellowstone | US · WY | 44.460, -110.828 | 2 | nature | | A geyser that erupts about every 90 minutes. |
| hagia-sophia | Hagia Sophia | TR | 41.009, 28.980 | 2 | building | | Nearly 1,500 years old with a giant dome. |
| arc-triomphe | Arc de Triomphe | FR | 48.874, 2.295 | 2 | building | | Twelve roads meet in a circle around it. |
| louvre | Louvre Museum | FR | 48.861, 2.338 | 2 | building | | A glass pyramid is the door to the Mona Lisa. |
| notre-dame | Notre-Dame | FR | 48.853, 2.350 | 2 | building | | Famous for gargoyles and giant bells. |
| alhambra | Alhambra | ES | 37.176, -3.588 | 2 | ancient | | A red palace with lion fountains. |
| grand-canal | Grand Canal, Venice | IT | 45.437, 12.333 | 2 | building | | A city with boats instead of cars. |
| matterhorn | Matterhorn | CH | 45.976, 7.658 | 2 | nature | IT | A mountain shaped like a pyramid. |
| iguazu | Iguazu Falls | AR | -25.695, -54.437 | 2 | nature | BR | 275 waterfalls side by side. |
| table-mountain | Table Mountain | ZA | -33.963, 18.424 | 2 | nature | | Flat like a table, with a cloud "tablecloth". |
| gateway-arch | Gateway Arch | US · MO | 38.625, -90.185 | 2 | modern | | A silver arch 630 feet high — you can ride to the top. |
| space-needle | Space Needle | US · WA | 47.621, -122.349 | 2 | modern | | Built for a World's Fair about the future. |
| cn-tower | CN Tower | CA | 43.643, -79.387 | 2 | modern | | You can walk on a glass floor 1,100 feet up. |
| galapagos | Galápagos Islands | EC | -0.600, -90.400 | 2 | nature | | Giant tortoises that live 100 years. |
| petronas | Petronas Towers | MY | 3.158, 101.712 | 2 | modern | | Twin towers joined by a sky bridge. |
| marina-bay | Marina Bay Sands | SG | 1.283, 103.860 | 2 | modern | | A boat-shaped pool on top of three towers. |
| ha-long-bay | Ha Long Bay | VN | 20.910, 107.180 | 2 | nature | | Thousands of rocky islands rising from the sea. |
| dead-sea | Dead Sea | JO | 31.500, 35.500 | 2 | nature | IL | So salty you float like a cork. |
| vesuvius | Mount Vesuvius & Pompeii | IT | 40.821, 14.426 | 2 | nature | | The volcano that buried a Roman city in ash. |
| northern-lights | Northern Lights, Tromsø | NO | 69.649, 18.955 | 2 | nature | IS,SE,FI | Glowing curtains of green light in the night sky. |
| geysir | Strokkur Geyser | IS | 64.313, -20.302 | 2 | nature | | Shoots hot water 100 feet up every few minutes. |
| lake-louise | Lake Louise, Banff | CA | 51.417, -116.217 | 2 | nature | | A turquoise lake under glaciers. |
| golden-temple | Golden Temple | IN | 31.620, 74.876 | 2 | building | | Covered in real gold, surrounded by water. |
| alamo | The Alamo | US · TX | 29.426, -98.486 | 3 | ancient | | An old mission where a famous battle happened. |
| kennedy-space | Kennedy Space Center | US · FL | 28.573, -80.649 | 3 | modern | | Where rockets to the Moon took off. |
| yosemite | Half Dome, Yosemite | US · CA | 37.746, -119.533 | 3 | nature | | A granite dome climbers love. |
| monument-valley | Monument Valley | US · AZ | 36.983, -110.111 | 3 | nature | | Red rock towers from cowboy movies (also in Utah). |
| denali | Denali | US · AK | 63.069, -151.007 | 3 | nature | | North America's tallest mountain. |
| kilauea | Kīlauea Volcano | US · HI | 19.421, -155.287 | 3 | nature | | One of the most active volcanoes on Earth. |
| everglades | Everglades | US · FL | 25.300, -80.900 | 3 | nature | | A river of grass full of alligators. |
| alcatraz | Alcatraz | US · CA | 37.827, -122.423 | 3 | building | | A prison on an island that nobody escaped from. |
| arches | Delicate Arch | US · UT | 38.743, -109.499 | 3 | nature | | A natural stone arch on Utah's license plates. |
| brooklyn-bridge | Brooklyn Bridge | US · NY | 40.706, -73.997 | 3 | building | | 21 elephants walked across to prove it was safe. |
| lincoln-memorial | Lincoln Memorial | US | 38.889, -77.050 | 3 | building | | A giant marble Lincoln sitting in a chair. |
| buckingham-palace | Buckingham Palace | GB | 51.501, -0.142 | 3 | building | | The King's home, with 775 rooms. |
| edinburgh-castle | Edinburgh Castle | GB | 55.948, -3.199 | 3 | building | | A castle on top of an old volcano. |
| giants-causeway | Giant's Causeway | GB | 55.241, -6.512 | 3 | nature | | 40,000 stone columns — a giant's stepping stones. |
| cliffs-moher | Cliffs of Moher | IE | 52.972, -9.427 | 3 | nature | | Cliffs 700 feet straight down to the ocean. |
| mont-saint-michel | Mont-Saint-Michel | FR | 48.636, -1.511 | 3 | building | | An island abbey — the tide cuts it off twice a day. |
| versailles | Palace of Versailles | FR | 48.805, 2.120 | 3 | building | | A hall of 357 mirrors. |
| charles-bridge | Charles Bridge | CZ | 50.086, 14.411 | 3 | building | | A stone bridge lined with 30 statues. |
| kinderdijk | Kinderdijk Windmills | NL | 51.883, 4.640 | 3 | building | | Nineteen windmills that pump water off the land. |
| atomium | Atomium | BE | 50.895, 4.342 | 3 | modern | | A giant iron crystal, 165 billion times bigger. |
| little-mermaid | The Little Mermaid | DK | 55.693, 12.599 | 3 | building | | A small bronze mermaid by the harbour. |
| santorini | Santorini | GR | 36.393, 25.461 | 3 | nature | | White houses with blue roofs on a volcano's rim. |
| plitvice | Plitvice Lakes | HR | 44.881, 15.616 | 3 | nature | | Sixteen lakes linked by waterfalls. |
| cappadocia | Cappadocia balloons | TR | 38.643, 34.828 | 3 | nature | | Hot-air balloons over fairy chimneys. |
| pamukkale | Pamukkale | TR | 37.924, 29.123 | 3 | nature | | White terraces of warm water — "cotton castle". |
| lalibela | Lalibela churches | ET | 12.032, 39.041 | 3 | ancient | | Churches carved down into the rock. |
| serengeti | Serengeti | TZ | -2.333, 34.833 | 3 | nature | KE | A million wildebeest migrate here every year. |
| potala | Potala Palace | CN | 29.656, 91.117 | 3 | building | | A palace with 1,000 rooms high in Tibet. |
| terracotta-army | Terracotta Army | CN | 34.385, 109.279 | 3 | ancient | | 8,000 clay soldiers guarding an emperor. |
| himeji | Himeji Castle | JP | 34.839, 134.694 | 3 | building | | A white castle nicknamed the White Heron. |
| fushimi-inari | Fushimi Inari Shrine | JP | 34.967, 135.773 | 3 | building | | A path through 10,000 red gates. |
| gyeongbokgung | Gyeongbokgung Palace | KR | 37.580, 126.977 | 3 | building | | A 600-year-old palace with changing of the guard. |
| borobudur | Borobudur | ID | -7.608, 110.204 | 3 | ancient | | The biggest Buddhist temple, with 504 statues. |
| bagan | Bagan temples | MM | 21.172, 94.860 | 3 | ancient | | Over 2,000 temples on one plain. |
| sigiriya | Sigiriya | LK | 7.957, 80.760 | 3 | ancient | | A palace on top of a giant rock with lion paws. |
| twelve-apostles | Twelve Apostles | AU | -38.665, 143.104 | 3 | nature | | Rock stacks standing in the ocean. |
| milford-sound | Milford Sound | NZ | -44.672, 167.925 | 3 | nature | | Cliffs and waterfalls dropping into the sea. |
| angel-falls | Angel Falls | VE | 5.970, -62.536 | 3 | nature | | The tallest waterfall in the world. |
| salar-uyuni | Salar de Uyuni | BO | -20.134, -67.489 | 3 | nature | | A salt flat that becomes a giant mirror. |
| panama-canal | Panama Canal | PA | 9.080, -79.680 | 3 | modern | | Ships are lifted over a country in water elevators. |
| teotihuacan | Teotihuacan | MX | 19.692, -98.844 | 3 | ancient | | Pyramids of the Sun and the Moon. |

(That is 24 + 38 + 41 = 103; `tier` counts must be asserted by a unit test.) `id3` is derived at load
from a shared `ALPHA2_TO_NUMERIC` table in `src/apps/landmarks/data/iso.ts` (builder 2 writes it;
builder 1's `flags.ts` lists numerics explicitly, a test cross-checks the overlap).

### D.2 Projected pins — `scripts/gen-landmark-px.mjs` → `src/apps/landmarks/data/landmarks.gen.ts`

The maps have no runtime projection, so pin positions are precomputed with `d3-geo` (already in
`node_modules`): world `geoNaturalEarth1().fitWidth(1000, {type:'Sphere'})` (identical to `gen-geo`)
→ `wx, wy`; US `geoAlbersUsa().scale(1300).translate([487.5, 305])` (us-atlas' projection) → `ux, uy`
for entries with `state`. Emits `{ id, wx, wy, ux?, uy? }[]`. Unit test: the world point of each
landmark lies inside its country's path (`SVGGeometryElement.isPointInFill` in jsdom is unavailable
→ use the bbox of `COUNTRIES_MAP` region `id3` ± 2 px) and the US point inside the state's bbox.

### D.3 Photos — `scripts/fetch-landmarks.mjs` (run manually by the builder, outputs are committed)

1. For each landmark: if `commonsFile` is set, query
   `https://commons.wikimedia.org/w/api.php?action=query&titles=File:<name>&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1000&format=json`;
   else search `action=query&list=search&srnamespace=6&srsearch=<name> <country> filetype:bitmap&srlimit=8`
   and take the first hit whose `extmetadata.LicenseShortName` ∈ {`CC0`, `Public domain`, `CC BY 2.0|2.5|3.0|4.0`,
   `CC BY-SA 2.0|2.5|3.0|4.0`} and whose width ≥ 1000. Polite: `User-Agent: math-skills-landmarks/1.0 (educational app)`, ≤ 2 req/s.
2. Download `thumburl` (≈ 1000 px), then with `sharp@0.33.5` (devDependency, exact): `resize({ width: 800,
   height: 600, fit: 'cover', position: 'attention' })` → `.webp({ quality: 72 })`; metadata is stripped
   by default (no `withMetadata()` → no EXIF/GPS). If > 80 KB retry `quality 60`, then `640×480`. Write
   `public/landmarks/<id>.webp` (+ `<id>-thumb.webp` 240×180 for the passport/credits, ≤ 12 KB).
3. Write `src/apps/landmarks/data/credits.json`: `{ id, file, title, author (HTML-stripped), license,
   licenseUrl, sourceUrl ("https://commons.wikimedia.org/wiki/File:…"), modified: "cropped and resized" }`
   and `docs/IMAGE-CREDITS.md` (one table) — both generated, header says so. Any CC BY-SA photo keeps
   that license for our resized copy; say so in the md and in the Credits screen footer.
4. Also write `public/landmarks/contact.html` (gitignored) — a contact sheet the builder opens to
   reject bad picks (wrong subject, watermark, people as the subject): set `commonsFile` by hand and
   re-run. The script is idempotent (skips existing files unless `--force`).
Budget: 103 × ≤ 80 KB ≈ 7 MB committed once (the repo already dropped 33 MB of screenshots).

### D.4 Gameplay — "Find it" round (12 questions, `pickTarget` over the level's landmarks, mastery `landmarks:<id>`)

Prompt row: photo (left, 4:3, height = 100 % of the prompt row, ≈ 150 px desktop / 110 px phone)
+ name big (`.mp-prompt__name`) + `🔊` ("Where is the Eiffel Tower?"). Map: countries map (world
view with Europe inset for levels with European targets; auto-zoom rule from §C.3 for small
countries); **US level** uses the US map and "tap the state". Correct = tapping `id3` **or any
`accept`** country (all of them light up on reveal). Then the **pin drops**: a 📍 at `(wx, wy)`
(SVG `<g class="lm-pin">` scaled by `k`, 650 ms drop with overshoot) + a fact card slides under the
prompt for 2.4 s (`🔊` reads the fact once, free), then next. Miss economy as Maps (miss 1 −5 + hint
circle around the country + continent text "It's in Europe!"; miss 2 −5 + reveal; a tap on an
off-level country names it). Points first-try `8 + 8·prior` (+8 ≤ 5 s, +4 ≤ 10 s) × combo; `prior` =
0.8 / 1.0 / 1.3 by tier. Stars = first-try/12.

### D.5 Levels
| level | targets | map | unlock |
|---|---|---|---|
| `famous` Super Famous | tier 1 (24) | world | open |
| `world` World Famous | tier 1–2 (60) | world | 2★ famous |
| `usa` Across the USA | entries with `state` (20) | **US map, tap the state** | 2★ famous |
| `explorer` Explorer | tier 3 (36) | world | 2★ world |
| `grand-tour` Grand Tour | all 103 | world | 2★ explorer |
| `world-tour` World Tour (mixed) | 6 landmarks + 6 flags | world | 2★ world **and** Flags `world` 2★ — see §D.8 |

### D.6 Home
`AppHome`: level chip `🗼 Super Famous ★★☆`, PLAY, subtitle "See the photo, tap the country!",
bestLine `🛂 n stamps`. More: Levels · **Passport** · "Just look" (a scrolling gallery of all
unlocked-level photos with names; tap = 🔊 + fact; free) · Credits (small link, also in the gallery).

### D.7 Explorer passport — `ms2:landmarks:progress:v1`
```ts
interface LandmarksProgress { version: 1; stars; plays; level; stamps: Record<string, number /* ts */>; countries: Record<string, number>; best }
```
A **stamp** (`🛂` ink stamp animation, `pop`) is earned on the first first-try correct of a landmark;
a **country page** fills when all its landmarks are stamped (France = 6). `#/landmarks/passport`:
pages per continent, a stamp grid (thumb + name, grey outline when missing), `n/103` header.

### D.8 World Tour (mixed with Flags) — second pass, after both apps land
Builder 2 imports `FLAGS` from `../flags/data/flags` (the `FlagDef` shape in §C.2 is frozen for
this). The round alternates 6 landmark items and 6 flag items (same "tap the country" input, same
economy); Flags' mastery store is updated through `masteryStore('flags')` with the same keys.
If `../flags/data/flags` does not exist at integration time the level is hidden (dynamic import
`catch` → `false`).

### D.9 Credits screen `#/landmarks/credits`
List: thumb · title · "Photo: <author> · <license (link)> · <source (link)>"; footer: "Photos from
Wikimedia Commons, cropped and resized; CC BY-SA photos remain under the same license. Flags:
flag-icons (MIT)". Plain, scrollable, TopBar back. Required by the licenses — do not skip.

### D.10 Tests
- vitest: 103 entries, unique ids, tiers 24/38/41, every `cc`/`accept` in the ISO table and on the map,
  20 with `state`, every fact ≤ 16 words, every id has a `public/landmarks/<id>.webp` ≤ 80 KB and a
  `credits.json` row with a license in the allow-list, no EXIF (`sharp(file).metadata().exif` undefined).
- Playwright (`tests/landmarks.spec.ts`): PLAY → photo `<img>` with `naturalWidth > 0`; correct tap → `.lm-pin`
  appears and the fact card shows; `accept` country also correct; USA level loads the US map and
  pays on the state tap; passport count increments; credits page lists ≥ 103 rows; no overflow on
  the five viewports.
- `npm run check:privacy` stays clean (author names from Commons are not "personal paths"; the
  generated credits are allowed — but never include e-mail addresses from Commons metadata: strip
  anything matching `@`).

---

## E. Logic Puzzles app (builders 3 + 4) — `src/apps/logic/**`, registry id `logic`

Hub card: 🧠 **Brain Puzzles** · tagline "Spot the pattern" · group `brain` · colour `--k-app-logic` (indigo).
Routes: `#/logic` · `#/logic/play/<mode>` (`adaptive | easy | medium | hard`) · `#/logic/map` (brain map).
The contract is `src/apps/logic/engine/types.ts` (frozen). Read it first; this section explains how
the pieces fit and what each family must do.

### E.1 Architecture

```
engine/types.ts        (architect)  contracts
engine/rng.ts          (3)  mulberry32(seed) + hashSeed(family, difficulty, n) → deterministic puzzles; puzzle.id = `${family}:${d}:${seedHex}`
engine/registry.ts     (3)  FAMILIES: PuzzleFamily[] = [...numberFamilies, ...visualFamilies]; byId()
engine/session.ts      (3)  createRound({mode, progress, rng}) → next() / answer() / finish(); scheduling + adaptive + scoring
engine/scoring.ts      (3)  pointsFor(difficulty, ms, misses, combo); comboMultiplier (same tiers as Maps: 1 / 1.15 / 1.3 / 1.5)
engine/Visual.tsx      (3)  <Visual spec size/> — the ONLY renderer of VisualSpec (pure, deterministic)
engine/shapes.ts       (4)  pure helpers that build VisualSpec nodes (signatures in §E.5) — used by every family
engine/harness.test.ts (3)  the generator contract test that runs over every registered family (§E.9)
families/*.ts          (3)  seq-number, number-box, rule-machine, code-break, balance, clock-calendar, mini-sudoku, maze-path, odd-one-out, analogy
families/visual/*.ts   (4)  seq-shape, growing-pattern, matrix, mirror, rotation, symmetry-fill, paper-fold, count-figures, pattern-block, tangram-fit
families/index.ts      (3)  export const numberFamilies;  families/visual/index.ts (4) export const visualFamilies
ui/LogicHome.tsx, ui/PlayScreen.tsx, ui/ChoiceGrid.tsx, ui/CellGrid.tsx, ui/SudokuGrid.tsx, ui/BrainCoach.tsx, ui/BrainMap.tsx, logic.css   (3)
progress.ts            (3)  ms2:logic:progress:v1 (LogicProgress in types.ts) + masteryStore('logic') keyed `${family}:${difficulty}`
```

### E.2 Round flow (builder 3)

1. PLAY (AppHome; default mode **Adaptive**; chips Easy / Medium / Hard in More). Countdown is not
   needed (no mic): the first puzzle shows immediately with a 300 ms slide-in.
2. `next()`: pick a family (§E.3) → `difficulty` = adaptive level for that family (or the fixed
   mode) → `generate(d, rng)` with a fresh seed; reject and regenerate (≤ 20 tries) if `id ∈
   progress.seen` or `validate(p).length > 0` (log a `console.warn` in dev; the harness makes this
   rare). Shuffle options with the round rng (`answerIndex` follows). Push the id to `seen` (cap 300).
3. Screen: TopBar (progress dots 1/10, points today, combo flame) · prompt card (`🔊` reads
   `speak ?? prompt`) · `<Visual>` (fills the stage, max 46 dvh on phone) · answer area:
   - `choice` → `ChoiceGrid` 2×2 / 2×3 (phone portrait: 2 columns; landscape: one row of 4–6 at
     ≤ 120 px tall); each option is a `<Visual size="sm">` or big text; ≥ 64 px targets.
   - `number` → core `Keypad` with the drill auto-accept rule (`input === String(answer)`; wrong when
     the typed length reaches `maxDigits`).
   - `cells` → `CellGrid`: the editable grid is rendered by `<Visual>` with `gridId` cells as
     `<rect data-cell="r,c">`; tapping toggles the palette colour (single colour) or cycles the
     palette; a green **Check ✓** button (`PlayButton` variant `go` is NOT used — green is PLAY only;
     use `BigButton` app colour) judges.
   - `sudoku` → `SudokuGrid`: tap a cell → symbol tray (4 chips) → fills; **Check ✓** judges; a cell
     that conflicts with givens flashes red on check.
4. **Anti-guessing**: a wrong pick costs **−5** (`MISS_PENALTY`), greys that option (choice) / flashes
   wrong cells (cells, sudoku) / shows "Not 14" (number), and he may try once more for
   `SECOND_TRY_POINTS` (+5 flat). The second miss costs −5 again, ends the item with **Brain Coach**
   (§E.7) and 0 points; combo resets on any miss. Options are **locked for the first 700 ms** after a
   puzzle appears (mash guard; no visual lock, taps are just ignored). With 4/5/6 options and a −5
   per miss, blind guessing averages ≤ 0 points per item at every difficulty (E[easy] = 0.25·15 +
   0.75·(−5 + ⅓·5 − ⅔·5) = 0; medium/hard negative) — he has to think.
5. Correct: `correct` sfx, option/cells flash green, `+N` burst, 900 ms, next. A **Why?** chip
   (`BigButton` ghost) on the correct flash opens the same Brain Coach for free (skip = tap anywhere).
6. After 10 items → `RoundSummary` ("Big brain!" at 10/10 first-try, else "Nice thinking!") with stats
   First try / Misses / Best streak, bonuses: perfect +40 (10/10 first try), first round of the day +50
   (`claimFirstRound('logic')`, requires ≥ 10 answered and ≥ 80 % first-try like Maps), new best
   first-try count +50 (`rewards.recordBest('logic:<mode>', firstTry, true)` only when ≥ 8/10).
   "Remember" chips: the rule of each missed puzzle (`puzzle.rule`). Again → straight into a new round.
   Leaving mid-round keeps points earned (events are already in rewards).

### E.3 Scheduling — variety is the anti-boredom mechanism

- A round draws **10 puzzles from ≥ 6 distinct families**, never the same family twice in a row,
  never the same `variant` twice in a round, and at most 2 items per family.
- Family weight = `1 + 3·(1 − familyMastery)` × `recency` (0 if used in the last 2 items, 0.4 if in the
  last 4) × `groupBalance` (×0.6 when its `FamilyGroup` already has 3 items this round), where
  `familyMastery` = mean `masteryScore` of `${family}:${d}` across difficulties with box > 0 (0 if unseen).
  Unseen families get ×1.5 so every family appears within the first 3 rounds.
- `mode: 'adaptive'`: per-family level from `progress.level` (default 1). **2 up / 1 down**: two
  consecutive first-try corrects at a level → level + 1 (cap 3, `streak` reset); one missed-out item
  (2 misses) → level − 1 (floor 1). A second-try correct keeps the level and resets the streak.
  Fixed modes use that difficulty for every family and do not move levels.
- Mastery: `applyMastery` with `factId = ${family}:${difficulty}`, `tier` from `FAST_MS`/`OK_MS` for
  the item's difficulty; a missed-out item = wrong. The **Brain Map** (`#/logic/map`) shows 20 tiles
  (family emoji + title) with three dots (easy/medium/hard) coloured by box like the Maps Explore
  legend, and the adaptive level badge. Tapping a tile starts a 10-round of that family only
  (`#/logic/play/adaptive?family=…` → segments `['play','adaptive','family','mirror']`) — practice,
  points ×0.5 (the hub soft cap already halves runaway farming; this keeps single-family drilling honest).

### E.4 `<Visual>` renderer (builder 3) — palette and rules

Palette (fills): red `#ff5a5f` · blue `#3d7bff` · green `#22c55e` · yellow `#ffc43d` · purple `#8b5cf6`
· orange `#ff9f1c` · pink `#f472b6` · teal `#14b8a6` · brown `#a16207` · grey `#cbd2df` · ink `#1b2559`
· white `#ffffff`. Every fill has ≥ 3:1 against white except yellow (3.0 with the ink outline) — so
**every shape always has its 2.5-unit ink outline**; patterns (`striped` 45° 4-unit stripes, `dotted`
3-unit dots on a 7-unit lattice, `hatched` cross stripes, `half` left half filled) are drawn with
`<pattern>` defs keyed by colour, ids prefixed with `useId()`. `shape` kinds are drawn from a fixed
polygon table (`engine/Visual.tsx` `SHAPE_PATHS`, unit size 1, centred at 0,0) scaled by `size`;
`rotate`/`flipX`/`flipY` compose as `translate(x y) rotate(r) scale(sx sy)`. `grid` draws cells as
rects with `--k-line` strokes (2 units), `unknown` cells dashed with a 0.6·cell `?`. `clock`: face,
12 ticks, hour hand 0.5 r, minute hand 0.8 r. `scale`: a stand, a beam tilted ±8°, two pans hanging
from the ends with the given children translated to each pan's centre. Text uses `--k-font`, weight
900, `tabular-nums`. Output `<svg viewBox="0 0 w h" role="img" aria-label={label}>` with
`preserveAspectRatio="xMidYMid meet"`, `data-testid="visual"` and `data-vis={shortHash(spec)}`
(tests compare options). Highlights: nodes whose `id ∈ highlight` get `class="is-hl"` (pulsing
outline). Deterministic: no randomness, no `Date`, no measurement.

### E.5 `engine/shapes.ts` (builder 4) — pure helpers both builders use

```ts
export const shape = (kind: ShapeKind, x: number, y: number, size: number, o?: Partial<ShapeNode>): ShapeNode;
export const text = (x: number, y: number, t: string, o?: Partial<TextNode>): TextNode;
export const line = (x1: number, y1: number, x2: number, y2: number, o?: Partial<LineNode>): LineNode;
export const group = (children: VisualNode[], o?: Partial<GroupNode>): GroupNode;
export const grid = (x: number, y: number, rows: number, cols: number, cell: number, o?: Partial<GridNode>): GridNode;
/** Lay nodes out left→right centred on y, `gap` apart; returns a group whose children keep their ids. */
export const row = (items: VisualNode[], o: { x: number; y: number; gap: number }): GroupNode;
/** A `w`×`h` spec; `fit` recomputes w/h from the nodes' extents with padding (shapes only). */
export const spec = (w: number, h: number, nodes: VisualNode[], label?: string): VisualSpec;
export const mirrorSpec = (s: VisualSpec, axis: 'x' | 'y'): VisualSpec;   // flips every node across the spec's centre line
export const rotateSpec = (s: VisualSpec, deg: 90 | 180 | 270): VisualSpec;
/** Canonical equality for "is this the same picture" (sorts nodes, rounds to 0.5 units, ignores ids). */
export const sameVisual = (a: VisualSpec, b: VisualSpec): boolean;
/** Attribute vocabularies for sequence/matrix/odd-one-out rules. */
export const KINDS_EASY: ShapeKind[]  // circle square triangle star
export const KINDS_ALL: ShapeKind[]
export const shuffle = <T>(xs: T[], rng: Rng): T[];  export const pick = <T>(xs: T[], rng: Rng): T;
```
`sameVisual` is what validators use to prove options are distinct and that exactly one equals the
derived answer. Builder 3 may inline raw nodes until `shapes.ts` lands (it lands in builder 4's
first hour, as stubs with the above signatures).

### E.6 Family catalog — what each generator does per difficulty, how the validator proves uniqueness, how distractors are built

Conventions: options = `OPTION_COUNT[d]`; every wrong option is produced by **one rule violation**
(wrong next step, wrong attribute, mirrored instead of rotated, off-by-one count…) and carries `why`;
the validator re-derives the answer independently (it never trusts `answerIndex`) and checks that
exactly one option matches (`sameVisual` / value equality) and that no two options are equal. Prompts
are ≤ 60 characters and read aloud. Numbers stay small (≤ 100 at easy, ≤ 200 medium, ≤ 1000 hard).

**Builder 3**

| family | easy (1) | medium (2) | hard (3) | validator |
|---|---|---|---|---|
| `seq-number` "What number comes next?" (text options or keypad at hard) | +1/+2/+5/+10, −1/−2; 5 terms shown | +3/+4/+6/+7/+9, ×2, −3, alternating (+2,+3,+2,+3), 4–5 terms | ×3, squares, triangular, Fibonacci-like (a+b), "+1, +2, +3", two interleaved sequences (hard variant `zip`) | re-fit each rule family to the shown terms; exactly one rule fits and yields exactly one option; distractors = other rules' predictions, ±1, the previous term |
| `number-box` "Which number goes in the box?" | 3-column sum box (rows add up), 2×2 add tables | 3×3 with row+column sums, missing cell | magic-square-like (all rows/cols same total), function box `in → ×2+1` | recompute the missing cell from the stated relation; options unique |
| `rule-machine` "What comes out?" (pairs `3 → 7`, `5 → 11`, `8 → ?`) | +n, ×2 | ×2+1, ×3−1, ×n | two-step with squares (`n² + 1`), reverse ("what went in?") | fit all machine templates to the given pairs; exactly one fits; distractors from near-miss templates |
| `code-break` "Each shape is a number" (rows of symbols with totals) | 2 symbols, 2 rows, sums ≤ 20 | 3 symbols, 3 rows | 3 symbols with a product row or a difference row | solve the linear system with small integers; exactly one solution; asked = a symbol's value or a new row's total (keypad) |
| `balance` "Which is heaviest?" / "How many 🍎 balance the 🍉?" | 2 scales, 3 emoji objects, direct comparison | 3 scales, transitive (A>B, B>C) | ratio scales (2🍎 = 1🍐, 3🍐 = 1🍉 → how many 🍎 for 1🍉; keypad) | derive the order / ratio from the scales; one consistent answer; distractors = other objects / off-by-one counts |
| `clock-calendar` "What time will it be in 2 hours?" / "Which clock comes next?" | o'clock and half-past, +1/+2 h, day-after-tomorrow | quarter hours, +90 min, clocks advancing by a fixed step (which clock is next), "3 days after Tuesday" | minutes (+25), backwards ("what time was it 45 min ago"), weeks + days | compute; options are clocks (`ClockNode`) or text; distractors = hour hand only moved, ±15 min, am/pm confusion not used |
| `mini-sudoku` "Fill the grid: every row, column and box has 1-2-3-4 once" | 4×4, 8–9 givens, digits | 4×4, 6–7 givens, shapes at d2 | 4×4, 5 givens, or a 6×6 with 2×3 boxes at hard | backtracking solver counts solutions; must be exactly 1; the answer is the full grid (`sudoku`) |
| `maze-path` "Which path is shortest?" / "How many steps from 🐭 to 🧀?" | 5×5 grid, 3 coloured routes drawn, pick the shortest (options = colour names) | 7×7, 4 routes, two differ by 1 | step count by keypad (BFS shortest), 8×8 | BFS on the grid; drawn routes are valid paths with distinct lengths; exactly one shortest |
| `odd-one-out` "Which one does not belong?" | 4 items; one attribute differs (colour / shape / size / count) and all others share everything | 5 items; items vary in 2 attributes but exactly one breaks the shared rule (e.g. all have 3 sides except one; all striped except one) | 6 items; the rule is relational (one is rotated 45°, one has a different number of dots than sides, one is the mirror image) | for each attribute, the item that is unique in that attribute; exactly one item is unique in exactly one attribute and no other item is unique in any attribute; options = the items themselves |
| `analogy` "A is to B as C is to ?" | colour swap, size change, add-one-dot | rotate 90°, fill ↔ empty, count ×2 | two transformations at once (rotate + recolour), number analogies (2:4 :: 5:?) | apply the transformation derived from A→B to C; exactly one option equals it; distractors = each single transformation alone, the transformation applied to A, C unchanged |

**Builder 4**

| family | easy (1) | medium (2) | hard (3) | validator |
|---|---|---|---|---|
| `seq-shape` "What comes next?" (5 shown, `?` sixth) | one attribute cycles: colour ABAB / ABC, shape ABAB | two attributes cycle with different periods (colour period 2, shape period 3), size grows | rotation steps (+45°/+90°) combined with a colour cycle; a count that grows 1,2,3; ABBA-style patterns | infer each attribute's period from the shown terms (periods 1–4); the continuation is unique; distractors = one attribute wrong, the term before, the mirror |
| `growing-pattern` "How many dots in figure 4?" / "Which figure comes next?" | +2 per figure, 3 figures shown, options are figures | +3, L-shapes growing on two sides, keypad count at d2 | squares n², triangles n(n+1)/2, "staircases" | compute figure n from the generator's rule and re-derive the rule from the 3 counts (exactly one of the rule templates fits); counts verified by counting nodes |
| `matrix` 3×3 "Which piece fits the empty square?" | one rule per row (same shape, colour changes left→right by a fixed cycle) | row rule + column rule (shape by row, colour by column, count by column) | three attributes (shape, fill pattern, rotation) each on a different axis; "add/subtract" rows (cell3 = cell1 ⊕ cell2 on dots) | rebuild the 3×3 from the inferred axis rules; the bottom-right cell is unique; distractors = each attribute wrong once, the cell above, the cell to the left |
| `mirror` "Which is the mirror image?" (a dashed mirror line is drawn) | asymmetric 2-shape figure, vertical line | 3-shape figure with an `L`/arrow, line vertical or horizontal | figure with rotation + a diagonal mirror line at d3 | `mirrorSpec` of the figure equals exactly one option; distractors = rotated 180°, the figure itself, mirrored across the other axis, one shape not flipped |
| `rotation` "Which is the same shape, just turned?" | one asymmetric figure (`L`, arrow+dot), 90° steps | 2-part figures, 45° at d2 | figures where the mirror image looks close; 270° | one option equals `rotateSpec(figure, k)`; every other option is a flipped (`mirrorSpec`) or altered figure, verified unequal to every rotation of the figure |
| `symmetry-fill` "Make it symmetrical — tap the squares" (`cells`) | 6×6 grid, vertical axis, 4–6 cells to fill, one colour | 8×8, horizontal or vertical axis, 2 colours | 8×8 with a diagonal axis, or both axes (4-fold) | target = reflection of the given cells; locked = the given cells; the reflection must not overlap the givens (regenerate) |
| `paper-fold` "Unfold the paper — which one?" (hard family; d1 is a gentle version) | fold once, one hole: options are 4 unfolded sheets | fold twice (same axis or both axes), one or two holes | fold diagonally; three folds at d3 | simulate the folds on a 4×4/6×6 cell grid (reflect holes back through each fold in reverse); exactly one option equals the simulated sheet |
| `count-figures` "How many triangles?" (keypad) | overlapping squares (2–4) or triangles in a divided triangle (up to 5) | a triangle split into rows (triangles of both sizes) | grids of squares (all sizes: 1×1, 2×2, 3×3), stars of David | count by brute force over the figure's line segments (every combination of lines that closes the shape); the figure is built from a line set so the count is exact; the explanation lists the sizes (3 small, 1 big) |
| `pattern-block` "Which piece completes the pattern?" | a 2×2 tiling with one tile missing; tiles are coloured squares/triangles | a 3×3 tessellation with rotated tiles | a hole in a shape; options are pieces (one fits exactly, others are rotated/mirrored/one cell off) | the missing tile/piece is unique by construction; distractors verified `!sameVisual` to the answer and to each other |
| `tangram-fit` "Which two pieces make this shape?" | square target; options are pairs of pieces (triangle + triangle, square + triangle…) | rectangle / house / arrow targets | parallelogram targets with rotated pieces | area + outline check: only the answer pair's union equals the target polygon (polygon union on a unit grid) |

Every family exports `variants` (e.g. `seq-number`: `plus, minus, times, alternate, zip, fib,
square, tri`) and the harness asserts each variant shows up.

### E.7 Brain Coach (builder 3 UI; families supply `explanation`)

A card over the puzzle: "🧠 Let's look" + step 1 text + its visual (if any) with highlights; `Next ›`
through 1–4 steps; last step shows the answer option outlined green and the rule in one line; `Got it`
(ghost) closes → next puzzle. Reads each step aloud with `speak` (Maps' `speech.ts`; copy it into
`src/apps/logic/speech.ts` — no cross-app import for builder 3). The first time he misses out a
family, the coach also shows a one-line "how to think" tip per family (`families/tips.ts`, builder 3,
e.g. mirror → "Pretend the line is a mirror. What's closest to the mirror stays closest!").

### E.8 Home + progress

`AppHome`: level chip `🧠 Adaptive · 10 puzzles` (chips in More: Adaptive / Easy / Medium / Hard),
PLAY, subtitle "Patterns, puzzles, brain teasers!", bestLine `🏅 Best 9/10`. More: Modes ·
**Brain map** (20 tiles) · "Show me one of each" (a free gallery that cycles a sample puzzle per
family with its coach — for the parent and for curiosity; no points). `ms2:logic:progress:v1` =
`LogicProgress` (types.ts) with `sanitize`. Hub card line `🧠 n rounds · 🔥 k at hard` (wired).

### E.9 Tests
- `engine/harness.test.ts` (builder 3; both builders run it): for every family in `FAMILIES` ×
  d ∈ {1,2,3} × 200 seeds: `validate(p)` is empty; `p.id` unique across the 200; `answerIndex` in range;
  option count = `OPTION_COUNT[d]` for choice answers; no two options `sameVisual`/equal text; every
  wrong option has `why`; prompt ≤ 60 chars; `explanation.length ∈ 1..4`; `visual.w ≤ 400, h ≤ 300`;
  every `variant` appears within 60 draws; generation of one puzzle < 5 ms (p95).
- `session.test.ts` (3): 10 items from ≥ 6 families, no family twice in a row, no repeated id
  across 50 rounds with a shared `seen`; adaptive 2-up/1-down; scoring table (first-try 15/25/40 +
  speed, second try 5, miss −5, combo tiers); blind-guess simulation on 1,000 items averages ≤ 0.
- Each visual family (4): a focused test per family on its invariant (e.g. `mirror`: the answer equals
  `mirrorSpec(figure)` and no distractor equals any rotation; `count-figures`: brute-force count
  equals the stated answer for 300 figures; `symmetry-fill`: target ∪ givens is symmetric).
- Playwright (`tests/logic.spec.ts`, 3): PLAY → first puzzle in < 2 s; options ignored for 700 ms;
  a wrong option greys and costs 5; a second wrong shows Brain Coach and advances; keypad family
  auto-accepts; `cells` family: tapping the target cells and Check pays; summary after 10 with
  Again → new round; no overflow at 393×659 and 852×340 (options ≥ 64 px).

---

## F. Ownership, order of landing, shared contracts

| Builder | Owns (may edit) | Must not touch |
|---|---|---|
| **1** Maps contrast + Land & Sea + Flags | `src/apps/maps/**` (incl. `tools/gen-geo.mjs`, `data/*.gen.ts`, `maps.css`), `src/apps/flags/**`, `scripts/copy-flags.mjs`, `public/flags/`, `package.json` (add `flag-icons@7.5.0`, `shapefile@0.6.6`, the `copy-flags` script lines), the `flags` registry entry, `tests/maps.spec.ts`, `tests/flags.spec.ts`, `src/hub/hub.css` world-group rule if needed | `src/apps/landmarks/**`, `src/apps/logic/**`, `src/core/**` |
| **2** Landmarks | `src/apps/landmarks/**`, `public/landmarks/**` (+ `.gitignore` for `contact.html`), `scripts/fetch-landmarks.mjs`, `scripts/gen-landmark-px.mjs`, `docs/IMAGE-CREDITS.md`, `package.json` (add `sharp@0.33.5`), the `landmarks` registry entry, `tests/landmarks.spec.ts` | `src/apps/maps/**` (import only), `src/apps/flags/**` (import `data/flags` only, second pass) |
| **3** Logic engine + number families + UI | `src/apps/logic/**` **except** `families/visual/**` and `engine/shapes.ts`, the `logic` registry entry, `tests/logic.spec.ts` | `engine/types.ts` (frozen), builder 4's files |
| **4** Logic visual families | `src/apps/logic/families/visual/**`, `src/apps/logic/engine/shapes.ts` (+ `shapes.test.ts`) | everything else under `logic/` (read-only), UI |

Shared, already done by the architect: `src/core/types.ts` (`AppId`, `AppGroup`), `src/styles/theme.css`
tokens, `src/hub/Hub.tsx` groups/layout, `src/hub/hub.css` world 3-col, `src/hub/appProgress.ts`,
`src/core/ui/startPlay.ts` `NO_MIC`, `tests/helpers.ts` seed list, `src/apps/logic/engine/types.ts`.
`src/apps/registry.ts`: each builder adds **only its own entry** (append in the order flags →
landmarks → logic after `maps`; `enabled: true` only when the app passes its own tests), with
`load: () => import('./<id>')` and `input: ['pointer']`.

Contract change procedure: a builder who needs a change to `logic/engine/types.ts`, `maps/types.ts`
(§B.2 shape) or `flags/data/flags.ts`'s `FlagDef` posts the diff to the orchestrator; nobody edits
another builder's file.

Order of landing:
1. Builder 1 lands §A + §B.2 types + `data/*.gen.ts` regeneration first (Flags and Landmarks both
   render the countries map; the contrast fix benefits all three apps). Builder 4 lands `shapes.ts`
   stubs in its first hour; builder 3 lands `rng.ts`, `registry.ts`, `Visual.tsx` stub.
2. Everything else in parallel. §D.8 World Tour last, after Flags and Landmarks both exist.
3. Each builder: `npm run build && npm run lint && npm run test:unit`, its Playwright spec on all
   five projects, `npm run check:privacy`. No personal paths/names in code, data, credits, docs or
   test fixtures; downloads (topojson, Natural Earth zip, Commons photos) go to a scratch folder,
   only generated outputs are committed.


## G. Review fixes (after the four builders landed)

Two independent reviews played every app on all five devices and re-checked every puzzle family with
their own solvers. Everything they flagged as critical, high or medium was fixed:

**Maps / Flags / Landmarks**
- *Tap halos* (`MapView.tsx` `resolveTap`): the invisible tap circles and tiny-country dots that make
  small places hittable no longer steal taps from in-play neighbours. A big in-play shape under the
  finger wins unless the finger is within 10 px of the small place's own spot and nearer to it; among
  small shapes the nearest spot wins. Playwright checks Europe/North America/Asia/Red Sea/North Sea on
  Whole World and Germany/Netherlands/France/Italy/Ukraine/Cuba on All Flags, on every device.
- *Repeats across rounds*: see B.4 `freshness`.
- Antarctica is a pale ice tint (white read as a hole); the "turn your phone sideways" banner hides
  after 5 s.
- Landmarks: the Amazon also accepts Ecuador, Bolivia, Venezuela, Guyana and Suriname; the Sahara
  accepts Western Sahara; the Northern Lights accept Canada. New photos for the Space Needle, Burj
  Khalifa and Dead Sea. The fact card already auto-advances after 3.6 s (Next skips).

**Brain Puzzles**
- `count-figures`: the collinearity / on-segment / same-point tests now use a 0.5 px distance
  tolerance, so the slanted lines of triangle grids with gaps (drawn rounded to 0.01 px) are merged
  again and the big triangles are counted; the generator counts on the exact geometry and the
  validator re-counts from the rounded drawing. A lattice test counts triangles independently.
- `analogy`: never a colour change together with a fill change (an empty shape shows no colour);
  `readFigure` reports an empty shape's colour as invisible, so look-alike options are rejected; no
  option may differ from the answer only by yellow/orange or blue/purple; picture pairs that a child
  could defend were removed (🥚→🐣, 🐝→🍯, and per-picture "also fits" exclusions such as 🌾 for 🐰).
- `matrix`: no dotted fills on counting grids and never dotted next to plain white; easy
  distractors are a 2 × 2 set (wrong rule 1, wrong rule 2, both); medium/hard use `pickWrongFair`.
- `pickWrongFair` (`visual/common.ts`): chooses each distractor set so the answer is (nearly) never
  the most typical, the biggest or the smallest option; used by seq-shape (which also gained double
  slips and a size overshoot), matrix, growing-pattern, paper-fold and pattern-block. A new property
  test checks those three shortcuts stay within chance + 20 points for every visual family.
- `paper-fold`: easy uses round holes only; shaped holes are drawn larger.
- `odd-one-out`: a box that is the only one made of 3-sided (or star, or curvy) shapes counts as a
  second odd one, so those puzzles are regenerated.
- `pattern-block`: never blue next to purple, never orange on yellow; double-slip distractors.
- `symmetry-fill`: the four-way prompt says "Mirror it into all four corners!".
- `growing-pattern`: the coach explains "the right count is not enough: it keeps the same shape"
  when the same-count trap is among the options.
- UI: the n/10 counter no longer clips on narrow phones; the shared round summary puts Again and Home
  side by side on phones held sideways; the "Why?" chip stays 2.4 s; Mini Sudoku starts with the first
  empty square selected so the tray is live.
- The generation-time checks assert the median (< 5 ms) and a generous p95 (< 15 ms), so they do not
  flake while a build runs in parallel.
