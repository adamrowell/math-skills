# Math Skills v2 — Product Spec, Visual Direction, Architecture

Status: architect's spec for the rebuild. Three builders work from this in parallel:
**A = Shell** (`src/core`, `src/hub`, `src/App.tsx`, build/PWA), **B = Drill + Multiplication**
(`src/drill`, `src/apps/multiplication`), **C = Voice** (`src/voice`). See §3.2 for the
ownership map. Type contracts live in the repo as real files:
`src/core/types.ts`, `src/drill/types.ts`, `src/voice/types.ts` (+ `src/voice/index.ts` stub).

Audience: one 7-year-old on an iPad (Safari, home-screen web app) and a desktop (Chrome, mouse),
served from GitHub Pages. Parent uses points as a reward currency.

---

## 0. Key decisions (read first)

| Area | Decision | Why |
|---|---|---|
| Scope now | Shell + rewards + **Multiplication** + voice engine. 8 other apps are registered but `enabled: false`. Old modes stay on disk, unrouted. | Fewer, better apps. Nothing deleted, nothing reachable. |
| Fast-facts engine | One generic `src/drill` engine (generator → adaptive scheduler → scoring → round hook → DrillScreen). Multiplication is the first `FactGenerator`; Division, Addition, Mixed are generators + a home screen each. | Division/Addition/Mixed become ~1 day each. |
| Fact selection | Weighted sampling: `prior × (1 + 3·(1 − mastery)) × wrongBoost × recencyPenalty`, Leitner boxes 0–5 per fact. 0s/1s carry prior 0.10/0.15 (≈5% of draws combined); 6·7, 7·8, 8·9 class carries 1.9. | Hard facts dominate; trivial ones still appear so he never "forgets" them. |
| Input | Keypad (no `<input>` element ever), physical keyboard, voice. Correct answers auto-accept as soon as the typed digits equal the answer. Wrong = typed length reaches the answer's length and differs. | Zero friction; no "GO" tap on the fast path. |
| Anti-guessing | Wrong answer → combo resets, correct answer shown big, he must **retype it** (0 points) before moving on. Tap-based apps (Coordinates, Maps) charge −5 per miss, give teaching hints, and cool down after 2 misses. Algebra: 2 tries, then worked solution, 0 points. No multiple choice anywhere. | Guessing is strictly worse than thinking. |
| Points | Credited **per correct answer** (never lost by quitting a round). Base 10 + speed (0/3/6/10) + difficulty (round(prior×5)), × combo multiplier (1 / 1.5 / 2 / 3 at 5/10/20 streak). Round-end bonuses for PB, accuracy. First round each day = **Daily Double** (2×). | Legible, fast, rewards both speed and hard facts. |
| Rewards | Lifetime points, today, this week, **Bank** (unredeemed). Parent area (hold 1.5 s + 2-digit×1-digit gate) shows totals, redeems points with a note, sets daily goal and an optional **Reward Goal** ("Ice cream: 640 / 1000"). | Parent's reward system is first-class. |
| Voice | On-device **Moonshine tiny** (transformers.js v4, ONNX) in a Web Worker; WebGPU if present, else single-threaded WASM (no SharedArrayBuffer). Energy VAD with 350 ms end-of-speech for numbers. Fallbacks: Whisper tiny.en → Web Speech API. Expected-answer-aware matcher with homophones and spoken-prefix merging; learned aliases from "unclear → typed" corrections. | Moonshine processes variable-length audio (no 30 s padding) → lowest latency for 1-second answers. Web Speech stays as instant fallback. |
| Routing | Hash router (`#/multiplication/play/sprint60/all`). `vite base: './'`. | Works at any repo path on Pages, browser Back works, no 404 fallback needed. |
| PWA | `manifest.webmanifest` + Apple meta tags, icons. **No service worker in v1** (model is cached by transformers.js via Cache API). | Avoid stale-bundle bugs; add SW later if offline is wanted. |
| Sounds | Synthesized with WebAudio (one unlocked `AudioContext`), not base64 WAV `<audio>` clones. | Reliable on iOS after the first tap; zero decode latency. |
| Persistence | `localStorage`, versioned keys `ms2:<store>:v1`, try/catch everywhere, in-memory fallback. | Works in private mode / blocked storage. |
| Reuse | Word lists `src/data/words/*.json`, geography data `src/data/geography`, `canvas-confetti`, number-word tables from `src/utils/numberParser.ts` (ported into `src/voice/match/numbers.ts`). | Everything else is replaced; old files remain for reference only. |

---

## 1. Product spec

### 1.0 Shared mechanics (all apps)

#### 1.0.1 The loop
1. Hub → tap an app card → app home (big primary button "Sprint!" + format cards + best stats).
2. Tap a format → round starts immediately (the tap is the user gesture that unlocks audio and starts the mic).
3. Round → summary card (points, PB, trophies, rank-up) → **Again** (big) / **Home**.
Back is always available (TopBar ←, browser Back, iPad swipe). Leaving mid-round keeps points earned so far.

#### 1.0.2 Answer submission rules (typed)
- Digits append to the display (max = answer digit count, or 3 when unknown). The display is a `<div>`; never an `<input>` (prevents the iPad keyboard).
- **Auto-accept**: the instant `input === String(answer)` → correct. No Enter needed.
- **Wrong**: when `input.length === String(answer).length && input !== answer`, or Enter/"✓" pressed with a non-empty non-matching input. Backspace is allowed before that.
- After wrong: red shake + soft buzz, big card shows `7 × 8 = 56`, input clears, prompt "Type 56". Retyping it correctly → next problem (0 points, combo already reset). If not retyped within 6 s → auto-advance (no dead ends). A second wrong during the retype just re-shows the answer.
- Keyboard: `0-9` (+numpad), `Backspace`, `Enter` (explicit submit), `Escape` (clear). Keypad: 3×4 grid `1-9 / ⌫ 0 ✓`, 64 px+ targets. Optional `−` key only in apps that allow negatives (Algebra L5+).
- Timing: correct → next problem after **350 ms** (sprint) / 450 ms (practice). Wrong → retype path.

#### 1.0.3 Answer submission rules (voice)
- Only **final** hypotheses are judged. Interim text (Web Speech) shows in the "heard" bubble.
- `matchNumberAnswer(text, {expected, maxPlausible, operands, minConfidence})`:
  - `correct` → identical to a typed correct, `via: 'voice'`.
  - `wrong` (a different plausible number was clearly heard) → identical to typed wrong, but the card also shows "I heard 54".
  - `unclear` → no sound; bubble shows "?" + heard text for 1.5 s; keep listening. If `partial` (he said "fifty" of "fifty-six"), the drill keeps the text for 1.5 s and prepends it to the next final.
- Mishear safety: voice `wrong` with `confidence < 0.5` (Web Speech) is downgraded to `unclear`. Operand echoes ("seven times eight", "seven eight") are `unclear`, never wrong.
- Adaptation: if a transcript was `unclear` and he then **types** the correct answer within the same question, `recordCorrection(text, answer)`. An alias activates after it has been recorded twice for the same answer, and only ever makes that exact text accept that exact answer.
- The mic stays open between questions; it is released at round end (also restores iOS speaker volume).

#### 1.0.4 Scoring (fast-facts drills)
```
base        = 10
speed       = ms ≤ fastMs → 10 | ms ≤ okMs → 6 | ms ≤ 2·okMs → 3 | else 0
difficulty  = round(prior × 5)                         (0–10)
comboMult   = combo ≥ 20 → 3 | ≥ 10 → 2 | ≥ 5 → 1.5 | else 1   (combo counted after this answer)
dailyDouble = 2 if this is the first round started today, else 1
points      = attempt > 1 ? 0 : round((base + speed + difficulty) × comboMult) × dailyDouble
```
`ms` = problem shown → accepted. Per-generator thresholds: Multiplication fast 2000 / ok 4000; Division 3000 / 6000; Addition (2-digit) 5000 / 10000; Mixed = per-fact; Algebra base 25, fast 8000 / ok 15000.
Round-end bonuses: new PB **+50**, accuracy ≥ 95 % with ≥ 15 answers **+25** ("Sharp Shooter"), 100 % with ≥ 10 answers **+40** ("Perfect"). Points are integers; a typical competent 60 s sprint yields 250–600.

#### 1.0.5 Combo / streak
Consecutive correct answers in a round. Flame chip in the TopBar shows `🔥 7`. Milestones 5 / 10 / 20 play the combo sound, grow the flame, and toast "Combo ×1.5!". Any wrong (typed or voice `wrong`) resets to 0. Best combo is tracked per app and lifetime.

#### 1.0.6 Ranks (lifetime points)
Rookie 0 · Explorer 500 · Whiz 1,500 · Ace 3,500 · Champion 7,000 · Master 12,000 · Grand Master 20,000 · Legend 35,000 · Wizard 60,000 · Infinity 100,000. Each has an emoji badge; the hub shows the badge + progress bar to the next rank. Rank-up = full-screen overlay (2 s or tap) + fanfare + confetti.

#### 1.0.7 Daily goal
Default 300 points/day (parent sets 100–2000). Ring on the hub; hitting it → "Daily goal!" toast + `goalStreak++`. Streak shown as `🔥 4 days` on the hub (consecutive days that hit the goal). Trophy at 7 and 30 days.

#### 1.0.8 Trophies (lifetime, persisted, `TrophyId`)
`first-round`, `combo-10`, `combo-25`, `combo-50`, `speed-demon` (10 answers ≤ fastMs in one round), `sharp-shooter` (95 %+ on 20+), `perfect-20`, `table-tamer` (every fact of one ×table in box ≥ 4), `grid-master` (all 144 at box 5), `goal-7`, `goal-30`, `thousand-club` (1,000 lifetime), `ten-k-club`. Unlock → chime + toast on the summary card; hub has a trophy shelf.

#### 1.0.9 Parent area ("Grown-ups")
- Entry: small `Grown-ups` button bottom-right of the hub; **press-and-hold 1.5 s** → gate prompt: random `(14..29) × (3..9)` typed on the keypad. Wrong → back to hub.
- Shows: points today / this week (bar per day, last 7) / lifetime / **Bank** (lifetime − redeemed), redemption history, **Redeem** (amount + note, e.g. "30 min Minecraft"), Reward Goal (title, emoji, target points → progress bar on hub; clears on redeem), daily goal, kid name, sounds, voice (engine `auto|moonshine|whisper|webspeech`, auto-start), show-hidden-apps (dev), reset mastery per app, export/import progress JSON, voice diagnostics (engine, backend, last 20 latencies & transcripts).

#### 1.0.10 Feedback & sound timing
| Event | t=0 | then |
|---|---|---|
| Correct | `correct` ding, green flash, `+N` floats up from the card | next problem at 350 ms |
| Wrong | `wrong` soft bonk, red shake, answer shown big, "Type 56" | advance 300 ms after retype (or 6 s) |
| Combo 5/10/20 | `combo` arpeggio, flame grows, toast 800 ms | — |
| Last 10 s of sprint | `tick` each second, timer bar turns orange | — |
| Round end | 400 ms pause → summary slides in; PB → `pb` fanfare + confetti 2.5 s | trophies queue as toasts |
| Voice unclear | no sound; "?" bubble 1.5 s | — |
All sounds are WebAudio-synthesized (≤ 150 ms), volume 0.5, off switch in settings, `prefers-reduced-motion` → no confetti/shake.

---

### 1.1 Multiplication (enabled now) — `multiplication`
Facts `a × b`, `a,b ∈ 0..12` (169 facts, commutative pairs tracked separately but a correct answer gives the mirror fact half credit).

**Priors** (`prior(a,b)`, both orders):
| Class | prior |
|---|---|
| any 0 | 0.10 |
| any 1 (no 0) | 0.15 |
| any 10 | 0.40 |
| any 2 | 0.50 |
| any 5 (other ≤ 5 or 10) / (other ∈ 6..9,11,12) | 0.70 / 0.90 |
| any 11 with other ≤ 9 / 11×11, 11×12 | 0.60 / 1.50 |
| 3s & 4s with each other or 5 | 0.90 |
| 3s & 4s with 6..9, 12 | 1.20 |
| squares 6², 7², 8², 9² | 1.30 |
| 6..9 × 6..9 (non-notorious) | 1.60 |
| **notorious**: 6×7, 7×8, 6×8, 7×9, 8×9, 6×9, 12×6, 12×7, 12×8, 12×9, 12×11, 12×12 | 1.90 |
| remaining 12s (12×3, 12×4) | 1.30 |
Resulting share of 0s+1s ≈ 5 % with fresh mastery; it shrinks further as hard facts stay weak.

**Mastery** (per fact): Leitner box 0–5, attempts, correct, EMA answer time, lastSeen, lastWrong.
Update on answer: correct & fast (≤ fastMs) → `box+1`; correct & ok → `box+1` if box < 2 else unchanged; correct & slow → unchanged; wrong → `box = max(0, box−2)`. Mirror fact gets the same update at half strength (box moves only on fast correct, or on wrong). `masteryScore = 0.7·box/5 + 0.3·speedScore` where `speedScore = clamp(1 − (avgMs − fastMs)/(okMs·2), 0, 1)`.

**Scheduler** weight per fact: `prior × (1 + 3·(1 − mastery)) × wrongBoost × recency`, where `wrongBoost = 4` if wrong this session and not yet answered correctly twice since; `recency = 0` for the last 3 asked, `0.3` for the next 3, else 1. Wrong facts are also force-scheduled to reappear 3–5 questions later (a "comeback" queue that preempts sampling). Sample with weighted random.

**Sets** (`setId`): `all`, `easy` (2s 5s 10s), `threes-fours`, `hard` (6s 7s 8s 9s), `elevens-twelves`, `table-N` (N ∈ 2..12; `N×0..12` plus mirrors), `weak` (the 20 lowest-mastery facts, min 8).

**Round formats**:
- **Sprint 60** (default, the fast mode): 60 s, as many as possible. PB = correct count. Timer bar + big count.
- **Challenge 20**: 20 questions, PB = total seconds (shown as a stopwatch). Tie-break by accuracy.
- **Practice**: 20 questions from a chosen set, gentle (no timer bar, stopwatch hidden), same scoring. Ends with "Table check" showing which facts went up a box.
- **Grid** (not a round): 12×12 mastery heat map (grey → blue → gold by box; tap a cell to see `7 × 8 = 56`, attempts, best time; tap a row/column header → Practice that table). This is the long-term motivator.

**Home screen**: `Sprint!` hero button, three format cards, table picker chips (2…12, Hard, Weak), "Best sprint: 23 · Best 20: 48 s · Grid: 61 % gold", mic chip.

### 1.2 Division — `division`
Facts `(b·q) ÷ b`, `b ∈ 1..12`, `q ∈ 0..12` (156 facts). Prompt "56 ÷ 8". Prior = `prior_mult(b,q)` except `b = 1 → 0.10`, `q = 0 → 0.10`, `q = 1 → 0.25`. Grid rows = divisor, cols = quotient. Same formats, sets (`table-N` = divide by N, `hard`, `weak`, `all`), scoring (fast 3000 / ok 6000). On first use the scheduler **seeds** mastery from multiplication mastery (weak 6×7 → weak 42÷7, 42÷6, box seeded at `max(0, multBox − 1)`). Everything else is `src/drill` reuse: ~1 generator file + home screen.

### 1.3 Two-digit Addition — `addition`
Mastery is per **bucket**, not per fact: `1d+1d (≤20)`, `2d+1d no-carry`, `2d+1d carry`, `2d+2d no-carry`, `2d+2d carry-ones`, `2d+2d sum ≥ 100`. Generator draws a bucket by weight (priors 0.4 / 0.6 / 0.9 / 1.0 / 1.4 / 1.5) then random operands in it; `Fact.id` = bucket id so mastery works unchanged. Formats: Sprint 60, Challenge 20, Practice (bucket chips: "No carry", "Carry", "Big sums"). Speed fast 5000 / ok 10000. After a wrong answer the retype card shows a column layout (ones column then tens, the carry drawn as a small `1`). Answers ≤ 198 → max 3 digits. Later: subtraction toggle in the same app.

### 1.4 Mixed Fast Math — `mixed`
A composite `FactGenerator` that pulls ×, ÷, + (buckets), − (within 100) with op shares 35 / 25 / 25 / 15 %. Uses each source app's mastery store (read-only) and writes to its own mastery keyed by the source fact id, so mastery flows both ways. Per-fact `speed` override from the source generator. Formats: Sprint 60 and Challenge 20 only. The challenge is switching operations; priors are unchanged.

### 1.5 Coordinate Drawing — `coordinates` (mouse / tap)
Pictures are ordered point lists on a grid; as he plots points the picture draws itself (segments connect consecutive points; `moveTo` breaks allowed). Quadrant I `0..10` first (≈ 14 pictures: house, boat, rocket, fish, star, cat face, heart, tree, kite, crown, car, robot, dinosaur, sailboat), four-quadrant `−6..6` set unlocked after 5 pictures. The target shows big: `(3, 7)`, with `x` and `y` in two colors matching the axis labels.
- Correct tap (≤ 0.35 cell from the intersection): dot pops, segment draws, **+20** (+10 if ≤ 4 s, +5 if ≤ 8 s), combo as usual.
- Miss 1: red ✕ fades at the tap, **−5**, hint = the `x` column lights up.
- Miss 2: **−5**, the `y` row lights up too (the intersection is now obvious), 1.5 s cooldown before the next tap counts.
- Miss 3: the point auto-places, 0 points, combo reset.
- Taps are debounced 300 ms; tapping the same wrong spot twice is one miss. A picture never goes below 0.
- Finish: colored fill reveal + confetti; **+50 "Clean Draw"** if ≤ 2 misses total; picture saved to a gallery (persisted) with its miss count and time. Reverse mode later: a dot is shown, he types `x` then `y` on the keypad.
Desktop uses the mouse (pointer events; hover highlights the nearest intersection). iPad uses tap.

### 1.6 Quick Algebra — `algebra`
Typed answers only, mental or on paper. Levels (chips): **L1** missing addend/subtrahend ≤ 20 (`☐ + 7 = 15`, `15 − ☐ = 9`), **L2** missing factor/divisor within 12×12 (`☐ × 6 = 42`, `42 ÷ ☐ = 7`), **L3** two-digit (`x + 27 = 53`, `x − 18 = 25`), **L4** two-step (`2x + 3 = 11`, `3x − 4 = 11`), **L5** both sides / negatives later. L1–L2 use `☐`; L3+ use `x` with a one-line explainer the first time.
- Round = **Set of 10** (PB = seconds; Daily Double applies). Base 25, speed fast 8000 / ok 15000.
- First try correct → full points. First wrong → hint card ("Take 7 from both sides" / "What times 6 makes 42?"), 2 s cooldown, second try correct → **+10**, second wrong → worked solution shown line by line, 0 points, combo reset, next.
- Mastery per template (e.g. `add-missing-addend`, `two-step-mul-add`) with the same Leitner boxes; the level chip shows a mastery bar.

### 1.7 Reading Words — `words` (voice)
Reuses `src/data/words/*.json` (CVC 177, Dolch pre-primer 207, Grade 1 367, Grade 2 647, Advanced 291) with their `pronunciations`/`syllables`. Bands (chips): **Basic** (CVC + pre-primer), **Grade 1**, **Grade 2**, **Advanced**; each word has a Leitner box; selection = same scheduler with prior by band (0.8 / 1.0 / 1.2 / 1.4).
Round = **Read 15**. Word shows huge; mic in `word` mode, always on during the round. `matchWord(text, target, alternates)`:
- `correct` → ding, **+15** (+5 if ≤ 2 s), combo.
- `unclear` for 4 s → "Try again" prompt; tap 🔊 to hear it (`speechSynthesis`), repeat → **+5**.
- `wrong` (a clearly different word) → gentle "Not quite", word shown split into syllables, repeat → **+5**; second wrong → next, 0, box−1.
- Skip button: 0 points, box−1, flagged "tricky" for the parent list.
Matching uses homophone sets (`read/red`, `there/their/they're`, `to/two/too`, …), phonetic keys (metaphone) and a Levenshtein threshold scaled by word length; ASR output is normalized (case, punctuation, hyphens). Words with homophones are accepted when any homophone is heard.

### 1.8 Reading Sentences — `sentences` (voice)
Sentences from the word JSON `sentence` fields (≥ 1,600 short sentences, 2–8 words) plus a curated 2nd-grade set. Mic in `sentence` mode (900 ms end-silence, 15 s max). `alignSentence(text, words)` does DP alignment with fuzzy word equality; words turn green as matched, missed words orange.
- ≥ 90 % words hit → **+30** + 2 per word, combo.
- 70–89 % → missed words highlighted, he re-reads just those (one retry) → +15.
- < 70 % → "Let's try again" once, then move on with 0.
Round = **Read 8**. PB = words per minute (shown, not pushed). Sentence mastery is per sentence id; band chips as in Words.

### 1.9 Maps — `maps` (mouse / tap, later voice)
Reuses `src/data/geography/*` and the existing `react-simple-maps` world map / US map components (restyled). Modes: **Find the State** (50, grouped by region with priors West 1.0 / Midwest 1.2 / Northeast 1.4 / South 1.1; home state 0.5), **Continents & Oceans** (12), **Big Countries** (~30 chosen for a 7-year-old). Same tap economy as Coordinates: first tap correct **+20** (+speed), miss 1 −5 + region highlight, miss 2 −5 + pulsing outline + cooldown, miss 3 auto-reveal 0. Round = Find 12. Voice mode later: "say the state" via `matchWord` with the name list as alternates.

---

## 2. Visual design direction

**Feel**: bright, chunky, playful, high-contrast, *fast*. Think a friendly arcade scoreboard, not a worksheet. One light theme (kid-readable in daylight); dark mode is a token swap for later.

**Type**: `Nunito` (Google Fonts, weights 700/800/900, `font-display: swap`) → fallback `system-ui, -apple-system, Segoe UI, Roboto`. `font-variant-numeric: tabular-nums` on every number. Scale: problem `clamp(56px, 12vw, 128px)` weight 900; answer display same size, primary color; keypad 32 px; TopBar 20 px; body ≥ 18 px; never below 16 px. Minimal text: icons + 1–3 words per label.

**Tokens** (`src/styles/theme.css`, prefix `--k-`, Shell builder owns):
```
--k-bg:#F6F8FF  --k-surface:#FFFFFF  --k-ink:#1B2559  --k-ink-soft:#5B6487  --k-line:#E3E8F6
--k-primary:#3D7BFF  --k-accent:#FFC43D  --k-success:#22C55E  --k-danger:#FF5A5F  --k-warn:#FF9F1C
--k-app-multiplication:#7C5CFF  --k-app-division:#FF7A59  --k-app-addition:#14B8A6  --k-app-mixed:#F43F8E
--k-app-coordinates:#0EA5E9  --k-app-algebra:#8B5CF6  --k-app-words:#22C55E  --k-app-sentences:#F59E0B  --k-app-maps:#06B6D4
--k-radius-sm:12px --k-radius:20px --k-radius-lg:28px
--k-shadow-card:0 8px 24px rgba(27,37,89,.08)  --k-shadow-press:0 6px 0 rgba(27,37,89,.18)  (chunky 3-D buttons; :active translates 4px and shrinks the shadow)
--k-ease:cubic-bezier(.2,.9,.3,1.2)  --k-fast:150ms  --k-normal:220ms
```
Each app sets `--k-app` on its root; TopBar, hero button and accents use it. Text contrast ≥ 4.5:1 everywhere (ink on surface; white on app colors only at weight ≥ 700 and ≥ 20 px).

**Layout** (`.k-screen` = `100dvh` grid, `padding: env(safe-area-inset-*)`, `overscroll-behavior: none`, `touch-action: manipulation`, `user-select: none` on game surfaces):
- iPad landscape / desktop ≥ 900 px: TopBar; two columns — problem card (left, 60 %) and keypad (right, max 360 px).
- Portrait / narrow: TopBar; problem card; keypad pinned to the bottom (≥ 64 px keys, 8 px gaps).
- Hub: hero (greeting, today's points, goal ring, rank badge, reward-goal bar), then app cards grid (1 col < 600 px, 2 cols ≥ 600, 3 ≥ 1100), trophy shelf, `Grown-ups` corner button.
- Hit targets: keypad ≥ 64 px, all other buttons ≥ 48 px, grid intersections ≥ 44 px effective.

**Motion**: 150–220 ms with a slight overshoot; `+N` floats up 600 ms; correct flash 250 ms; wrong shake 300 ms; confetti via `canvas-confetti` (reuse) for PB / rank-up / picture complete. Honor `prefers-reduced-motion`.

**Icons**: emoji in a fixed-width span (consistent across iOS/desktop) — no icon font. App icons & PWA icons: simple flat PNGs 192/512 + 180 apple-touch (Shell builder generates them, solid `--k-primary` background with a white `×`).

---

## 3. Architecture

### 3.1 File layout (new code; `(A|B|C)` = owner)
```
index.html                                   (A) meta/PWA tags, Nunito link, manifest
vite.config.ts                               (A) base './', worker format 'es', chunking
package.json                                 (A) adds @huggingface/transformers ^4.3.1, vitest ^5, @vitejs/plugin-basic-ssl (dev iPad testing)
public/manifest.webmanifest  public/icons/*  public/.nojekyll          (A)
playwright.config.ts                         (A) testIgnore legacy, iPad landscape+portrait projects
tests/legacy/*  (moved old specs, ignored)   (A)
tests/shell.spec.ts (A)  tests/multiplication.spec.ts (B)  tests/voice.spec.ts (C)
src/main.tsx                                 (A) mounts <App/>; imports index.css + styles/theme.css
src/App.tsx                                  (A) hash router → Hub | ParentArea | registry app (React.lazy)
src/styles/theme.css                         (A) --k-* tokens, base/reset for the new shell
src/core/types.ts                            (architect) shared contracts — do not edit without telling all builders
src/core/index.ts                            (A) barrel: everything B needs
src/core/router/useHashRoute.ts              (A)
src/core/store/persist.ts                    (A) createPersistedStore<T>(key, version, migrate) + useStore
src/core/rewards/{rewardsStore,ranks,trophies}.ts  (A)
src/core/settings/settingsStore.ts           (A)
src/core/sound/{audioContext,sfx}.ts         (A) getAudioContext(), unlockAudio(), sfx.play()
src/core/time/dateKey.ts                     (A) local YYYY-MM-DD, week helpers
src/core/ui/{TopBar,Keypad,BigButton,PointsBurst,ComboFlame,Celebration,RoundSummary,ProgressRing,Toast}.tsx(+css)  (A)
src/hub/{Hub,AppCard,TrophyShelf,ParentArea,ParentGate}.tsx(+css)   (A)
src/apps/registry.ts                         (A) all 9 AppDefinitions; only multiplication enabled
src/drill/types.ts                           (architect)
src/drill/{scheduler,scoring,mastery,masteryStore,useDrillRound,util}.ts   (B)
src/drill/{DrillScreen,ProblemCard,RoundPicker,MasteryGrid,RetypeCard}.tsx(+css)  (B)
src/drill/index.ts                           (B) barrel
src/apps/multiplication/{index.tsx,facts.ts,MultiplicationHome.tsx,sets.ts}   (B)
src/voice/types.ts                           (architect)
src/voice/index.ts                           (architect stub → C replaces with real exports)
src/voice/useVoiceInput.ts                   (C)
src/voice/engines/{webspeech,onDevice,engineRegistry}.ts  src/voice/engines/asr.worker.ts   (C)
src/voice/audio/{capture,resample,vad}.ts  src/voice/audio/capture.worklet.js   (C)
src/voice/match/{numbers,words,sentences,corrections,normalize}.ts   (C)
src/voice/ui/{MicChip,HeardBubble,VoiceLoadCard}.tsx(+css)   (C)
src/voice/**/*.test.ts  src/drill/**/*.test.ts  (vitest; `npm run test:unit`)
```
Legacy (`src/MathApp.tsx`, `src/games/**`, `src/components/**`, `src/hooks/**`, `src/utils/**`, `src/config/**`, `src/types/game.ts`) stays, compiles, is not imported by the new shell. `src/data/**` is reused by future apps. Nobody edits legacy files in this workflow except A moving `tests/*.spec.ts` → `tests/legacy/`.

### 3.2 Ownership & dependency rules
| Builder | Owns | May import from | Must not touch |
|---|---|---|---|
| A Shell | `src/App.tsx`, `src/main.tsx`, `src/core/**` (except `types.ts`), `src/hub/**`, `src/apps/registry.ts`, `src/styles/theme.css`, `index.html`, `vite.config.ts`, `package.json`, `public/**`, `playwright.config.ts`, `tests/shell.spec.ts`, `tests/legacy/**`, `README.md` | `src/voice` (MicChip status only, via `index.ts`), `src/apps/multiplication` (lazy, via registry) | `src/drill`, `src/voice` internals |
| B Drill+Mult | `src/drill/**` (except `types.ts`), `src/apps/multiplication/**`, `tests/multiplication.spec.ts` | `src/core` (barrel only), `src/voice` (barrel only) | `src/core/**`, `src/voice/**`, registry (A flips `load`) |
| C Voice | `src/voice/**` (except `types.ts`; replaces `index.ts`), `tests/voice.spec.ts`, `tests/fixtures/*.wav` | `src/core/settings` (read voice prefs) and `src/core/store/persist` only | `src/core/ui`, `src/drill`, apps |
Contract files (`*/types.ts`) are frozen; a builder who needs a change posts the diff to the orchestrator and all three apply it.
Order: A lands `src/core` skeleton + registry + router within the first pass so B compiles; C is independent (consumes only `persist.ts`, which A ships first). The registry entry for multiplication is `load: () => import('./multiplication')` from the start; B's `index.tsx` must `export default` a component taking `AppProps`.

### 3.3 Contracts (authoritative copies in `src/core/types.ts`, `src/drill/types.ts`, `src/voice/types.ts`)

**Registry / routing** (`core/types.ts`): `AppId`, `AppDefinition {id,title,emoji,color,tagline,group,enabled,input[],load?}`, `AppProps {segments, navigate(to,{replace}), goHome()}`. `App.tsx` resolves `#/` → Hub, `#/grownups` → ParentArea, `#/<appId>/...` → lazy app (disabled or unknown → `navigate('/', {replace:true})`). Every `navigate` pushes a hash entry, so browser Back/forward just works; `TopBar.onBack` calls `history.back()` when the previous entry is ours, else `goHome()`.

**Rewards** (`core/types.ts`): `rewards.addPoints(appId, points, kind, note?)`, `today()`, `thisWeek()`, `lifetime()`, `bank()`, `rank()`, `redeem(points, note)`, `unlockTrophy(id)`, `recordBest(key, value, higherIsBetter)`, `setRewardGoal()`, `startRound(appId) → {dailyDouble}`; `useRewards()` snapshot via `useSyncExternalStore`. Events older than 60 days compact into `dayTotals`.

**Core UI** props: `KeypadProps`, `TopBarProps`, `RoundSummaryProps`, `ComboFlameProps`, `PointsBurstHandle`, `celebrate(kind)`, `sfx.play(SoundName)`, `toast(msg, emoji?)`. B codes against these exactly.

**Drill** (`drill/types.ts`): `Fact`, `FactGenerator`, `FactMastery`, `MasteryState`, `pickNextFact(opts)`, `scoreAnswer(input)`, `RoundFormat`, `RoundState`, `UseDrillRound`. `DrillScreen` takes `{generator, format, setId, onExit}` and does everything (timer, keypad, keyboard, mic, feedback, summary, rewards calls). A future app = `facts.ts` (generator) + `index.tsx` (home + routes) only.

**Voice** (`voice/types.ts`): `VoiceEngineKind = 'webspeech'|'moonshine'|'whisper'`, `VoiceStatus = 'off'|'loading'|'ready'|'listening'|'hearing'|'processing'|'error'`, `useVoiceInput({enabled, mode, onTranscript, preferredEngine?, onLevel?}) → {status, engine, error, loadProgress, level, isSupported, capabilities, start, stop, setEngine, preload}`, `matchNumberAnswer`, `matchWord`, `alignSentence`, `recordCorrection`. The stub `index.ts` exports `voiceImplemented = false` so UIs hide the mic chip until C lands.

### 3.4 Voice engine design (C)
```
                tap "Sprint!" (user gesture)
                        │ getUserMedia() synchronously in the handler, THEN await the rest
                        ▼
  MediaStream ─► AudioContext (device rate 44.1/48k) ─► AudioWorklet (capture.worklet.js)
                        │ Float32 frames @ device rate
                        ▼
              resample → 16 kHz mono (linear / polyphase) ─► ring buffer (≤ 20 s)
                        │
                        ▼
   energy VAD: noiseFloor = EMA of RMS while silent (min 0.004); speech if RMS > 3·floor for ≥ 150 ms;
   end if RMS < 1.5·floor for endSilence (number 350 ms · word 400 ms · sentence 900 ms); max 4 / 3 / 15 s;
   preRoll 200 ms; status → 'hearing' on start, 'processing' on end
                        │ Float32Array segment (padded to ≥ 1.0 s with silence)
                        ▼
   Worker (asr.worker.ts): transformers.js v4 pipeline('automatic-speech-recognition',
     'onnx-community/moonshine-tiny-ONNX', { device: webgpu?'webgpu':'wasm', dtype: webgpu?'fp32':'q8' })
     env.backends.onnx.wasm.numThreads = 1 (no SharedArrayBuffer on Pages); env.backends.onnx.wasm.proxy = false
     warm-up: one 1 s silent inference after load; report progress {file, loaded, total}
                        │ text, latencyMs
                        ▼
   VoiceHypothesis {text, isFinal:true, engine:'moonshine', latencyMs, durationMs} → onTranscript
```
- **Engine order** (`preferredEngine: 'auto'`): moonshine → whisper (`onnx-community/whisper-tiny.en`, same worker) → webspeech. While an on-device model is still loading, `useVoiceInput` runs Web Speech if available so the mic works on the very first round; it hot-swaps when the model is ready (status `ready` → `listening`).
- **WebGPU probe**: try in the worker; if `navigator.gpu` is absent there but present on the main thread, run the pipeline on the main thread with WebGPU (async, no jank); else WASM in the worker. Never WASM on the main thread.
- **Preload**: Hub mounts → if `settings.voice.enabled && isSecureContext` → `preload()` during idle; progress shown in the hub mic chip ("Voice 43 %"). Models come from the Hugging Face CDN and are cached by transformers.js in the Cache API (≈ 35 MB for moonshine-tiny q8; one-time). `VITE_ASR_MODEL_BASE` env lets the parent self-host under `public/models/` later.
- **iOS specifics**: `getUserMedia` inside the gesture; `audioContext.resume()` on every `pointerdown` + `visibilitychange`; re-arm capture after backgrounding; stop tracks at round end; `playsinline`; expect lower speaker volume while the mic is open (iOS "play and record" session) — keep sfx gain at 0.8 while listening.
- **Web Speech engine**: `continuous=false`, `interimResults=true`, `maxAlternatives=5`, auto-restart on `end` while listening, all alternatives passed to the matcher (first `correct` wins). iOS Safari supports `webkitSpeechRecognition` (server-side); treat `not-allowed`/`service-not-allowed` as `permission-denied`.
- **Latency budget (number mode)**: target **p50 ≤ 300 ms, p90 ≤ 450 ms** from end of speech to the green card (desktop, WASM). Every hypothesis carries `latencyMs` and a `trace` (VAD end → worker receive/start/done → delivered); the parent diagnostics panel shows the last 20; `tests/voice-latency.spec.ts` measures the whole pipeline per stage.
  - **KV-cached decoding** (`asr.worker.ts`): the decoder start token runs once, then every beam step feeds one token per beam on top of the cached self-attention K/V and the encoder (cross-attention) K/V computed once per utterance; force-scoring of the expected answer is one cached batched call; the beam prunes paths > 4.5 nats below the best finished answer (decisions only look at margins ≤ 3). Encoder ~60 ms + scoring ~115 ms for a 1 s clip on an M2 (was ~75 + ~310 ms). `?asrLegacy=1` A/Bs the old path. Reading's `scoreTexts` batches stay on the full path (memory).
  - **Speculative accept** (`engines/speculative.ts`): the worklet streams the open utterance (10 ms frames + voiced flag). At a quiet onset (2 quiet frames) the engine decodes the audio so far with the full answer set (never queued behind another job; at most 3 decodes per utterance, a re-decode needs ≥ 8 new voiced frames, none once the utterance spans > 1.8 s; a decode the child talked past is cancelled in the worker). The expected answer is accepted early only if it wins by the accept margin + 0.5 (≥ 2.0, and ≥ 2.0 over its teen/-ty look-alikes), no speech followed the snapshot, the child has been quiet ≥ 90 ms, the utterance spans < 1.8 s (first → last voiced frame, pauses included), and the answer is not **risky**. Risky = a spoken prefix of another plausible answer ("fifty", "one hundred", "one") or a unit that starts a teen/-ty word (2–9 and 102–109: "six…teen", "three-teen", "five-teen"). A child can pause 200–350 ms inside such a word and a soft "-teen" can stay under the VAD threshold, so risky answers are **never** accepted early (adversarial sweep: early accept took "six…teen" as 6 in 60/128 trials before this rule). Their decode starts once the audio equals the endpoint segment (speech + 200 ms quiet) and is reused at the endpoint only if nothing was said after it; the same "segment only" reuse applies when the decode's top is risky. Wrong / unclear verdicts are made at the endpoint, reusing the speculative decode when it covers all the speech. `?voiceSpec=0` disables it.
  - **Teen/-ty look-alikes** (`onDevice.ts` `PARTNER_MARGIN`): a winner within 2.0 of its look-alike (6 ↔ 16 ↔ 60, 9 ↔ 19 ↔ 90, 106 ↔ 116 ↔ 160) is 'unclear' — never accepted, never 'wrong', and not rescued by the free transcript. A free transcript with several numbers is used only for an equation / self-correction ("7 times 8 is 56", "54 no 56") or when it ends on the scorer's own pick ("One thumb through the eighteen" said for 118 is not 18).
  - **WebGPU**: measured on an M2 (real Metal): q8 733 ms p50 (slower than WASM), fp32 144 ms p50 but a ~250 MB download and lower accuracy at the q8-tuned margins → WASM q8 everywhere for now.
  - Measured (M2 Max, heavily loaded machine): before 729 / 862 ms (p50 / p90, live fake mic → hypothesis); after ~200 / ~340 ms; the drill paints the green card ≤ 5 ms after the hypothesis.
- **Memory**: one model loaded at a time; `dispose()` on engine switch; q8 weights on WASM; the ring buffer is the only retained audio.

**Matcher rules** (`match/numbers.ts`, port the word tables from `src/utils/numberParser.ts` and extend):
1. Normalize: lowercase, hyphens → spaces, strip punctuation, collapse spaces, digits stay digits.
2. Token map with homophones: `for/fore→4, to/too/tu→2, won/wun→1, ate/ait→8, free/tree/twee/fwee→3, sex/siks→6, tin→10, oh/o→0, sebben/seben→7, nein/nyne→9, hive/fiv→5, foh→4, twenny→20, fourty→40, leven→11, twelf→12, a hundred→100`.
3. Parse all number candidates left→right with compound rules (`sixty four`, `one hundred forty four`, `hundred and eight`, `twenty-one`), digits included.
4. Verdict: candidates empty → `unclear`. Last candidate `== expected` → `correct`. Candidates exactly equal the `operands` in order (echo) → `unclear`. Last candidate is a spoken prefix of expected (`50` of `56`, `100` of `108`) → `unclear, partial: true`. Last candidate `> maxPlausible` or `< 0` → `unclear`. Else → `wrong` with `heard` (downgraded to `unclear` when `confidence < minConfidence`).
5. Learned aliases: exact normalized text → answer, active after 2 recordings; applied before step 3 only when `alias.answer === expected`.
`matchWord`: normalize both; equal → correct; homophone set → correct; `pronunciations`/`alternates` → correct; metaphone equal and Levenshtein ≤ 1 (len ≤ 4) / ≤ 2 (len ≤ 7) / ≤ 3 → `correct` with `similarity`; a different dictionary word with similarity < 0.5 → `wrong`; else `unclear`. `alignSentence`: Needleman–Wunsch over word tokens with `matchWord`-style equality, returns per-word `hit|close|miss` and `hitRatio`.

### 3.5 Drill engine design (B)
- `useDrillRound({generator, format, setId})` owns: timer (`performance.now()` + 100 ms interval; pause on `visibilitychange` with a "Paused — tap to continue" overlay), current fact, input string, verdict state machine `ready → running → (retype) → running → finished`, combo, points (calls `rewards.addPoints` per correct), answered log, comeback queue, voice partial buffer.
- `DrillScreen` renders TopBar (back, timer/progress, points today, combo flame, mic chip), `ProblemCard` (problem + answer display + heard bubble + `+N` burst), `Keypad`, `RetypeCard` overlay, then `RoundSummary`. It binds keyboard via `Keypad keyboard` prop, and voice via `useVoiceInput({enabled: settings.voice.enabled && voiceImplemented, mode:'number', onTranscript})`.
- Round-end: `rewards.recordBest('multiplication:sprint60:all', correct, true)` → PB bonus; trophies checked here; mastery persisted; summary shows `correct / wrong / best combo / fastest / points / PB delta` and the facts that moved up a box.
- `MasteryGrid` is generic: `{generator, mastery, onCell?, onHeader?}` using `generator.grid`.
- Unit tests (vitest): scheduler share test (100k draws, fresh mastery: 0s+1s < 7 %, notorious class ≥ 2.5× the 2s class per fact; wrong fact returns within 5 draws), scoring table, mastery transitions, `useDrillRound` via `@testing-library/react` optional.

### 3.6 Persistence (A owns `persist.ts`; others use it)
`createPersistedStore<T>({key:'ms2:rewards:v1', version:1, initial, migrate?})` → `{get, set, update, subscribe, useStore}`; writes debounced 250 ms and flushed on `pagehide`; every read/write in try/catch; if storage throws, the store stays in memory and sets `persist.available = false` (hub shows nothing, parent area shows "Saving is off on this browser"). Keys: `ms2:settings:v1`, `ms2:rewards:v1`, `ms2:mastery:<appId>:v1`, `ms2:voice:prefs:v1`, `ms2:voice:corrections:v1`, `ms2:gallery:coordinates:v1`. Legacy keys are never read or removed.

### 3.7 Build, Pages, PWA (A)
- `vite.config.ts`: `base: './'`, `worker: { format: 'es' }`, `build.target: 'es2022'`, `optimizeDeps.exclude: ['@huggingface/transformers']` if dev prebundling breaks the worker, manualChunks `react`, `transformers`, `maps`, `charts`. Remove the `GITHUB_PAGES` env switch (keep the script harmless). Deploy workflow unchanged except `node-version: 22`.
- Workers/worklets are referenced as `new URL('./asr.worker.ts', import.meta.url)` and `audioContext.audioWorklet.addModule(new URL('./capture.worklet.js', import.meta.url))` so the relative base works.
- `index.html`: `viewport-fit=cover`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-mobile-web-app-title`, `apple-touch-icon` (180), `theme-color`, `<link rel="manifest" href="./manifest.webmanifest">`, Nunito `<link>` with preconnect. Manifest: `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `orientation: "any"`, icons 192/512 (+ maskable).
- `public/.nojekyll`. No service worker (decision §0). Model cache = transformers.js Cache API; note in README that adding to the Home Screen makes Safari keep that cache.
- Local iPad testing: `npm run dev -- --host` with `@vitejs/plugin-basic-ssl` (`VITE_HTTPS=1`) because the mic needs a secure context; accept the cert once on the iPad.

### 3.8 Testing & acceptance (every builder: `npm run build`, `npm run lint`, no console errors)
- A `tests/shell.spec.ts`: hub shows exactly one app card (Multiplication) with hidden ones absent from the DOM; `#/division` redirects home; Back from app → hub; points persist across reload; parent hold-gate works and rejects a wrong answer; app renders with `localStorage` stubbed to throw (`page.addInitScript`).
- B `tests/multiplication.spec.ts` (Desktop Chrome + iPad Pro portrait & landscape): Sprint starts on tap; keypad digits auto-accept a correct answer (read the problem from the DOM, compute, type); wrong answer shows the retype card and gives 0 points; combo chip increments; timer reaches 0 → summary with Again/Home; keyboard digits work; PB shown on second run; grid page renders 144 cells and a header tap opens Practice; no horizontal scroll at 768×1024.
- C: vitest matcher table (≥ 60 cases incl. "sixty for"→64, "fifty sex"→56, "ate"→8, "7 times 8 is 56" with operands → correct, "seven eight" → unclear, "fifty" of 56 → partial, "fifteen" vs 50 → wrong, "um" → unclear, "a hundred and forty four"→144) and `alignSentence` cases; Playwright with Chromium flags `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=tests/fixtures/fifty-six.wav` driving the real WASM engine end-to-end (status reaches `listening`, a hypothesis containing 56 arrives ≤ 3 s after audio ends); manual iPad checklist in `tests/IPAD_CHECKLIST.md` (permission prompt from the tap, first-answer latency, background/foreground recovery, speaker volume).

### 3.9 Decisions log (why)
- **Moonshine over Whisper first**: Moonshine's encoder handles variable-length input, so a 1.2 s answer costs ~1.2 s of compute, not a padded 30 s window; it is English-only and small (27 M params). Whisper tiny.en remains as a fallback because it is the better-trodden path in transformers.js. Web Speech remains because it needs no download and is decent on iOS.
- **No SharedArrayBuffer**: Pages cannot send COOP/COEP; `coi-serviceworker` is possible but flaky on iOS, so the design assumes single-threaded WASM and leans on WebGPU where present (Safari 26+/Chrome).
- **Hash routing + relative base**: zero server config, any repo name, browser Back for free.
- **WebAudio synth sounds**: the legacy base64 WAV + `cloneNode()` approach is unreliable on iOS and adds decode latency.
- **Points per answer, not per round**: quitting never loses points → no frustration loop; the parent's balance is always consistent.
- **No service worker yet**: the biggest failure mode on a kid's iPad is a stale cached bundle; revisit once the suite is stable.
