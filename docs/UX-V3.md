# UX v3 — "Where do I tap?" spec

Status: lead-UX spec for five parallel builders (A–E, ownership in §10). Supersedes the UX parts of
`docs/DESIGN.md` §1.0.1, §2 (layout) and the home-screen paragraphs of each app; everything else in
DESIGN.md still stands. Audience is unchanged: one 7-year-old, iPad (Safari + Home Screen app),
iPhone, desktop Chrome, served from GitHub Pages; points are a real reward currency.

Parent feedback this spec answers:
1. "UX is hard to follow. It can be hard to tell where to click to start the games."
2. "For 2-digit addition (or subtraction etc.) show the numbers vertically like a workbook."
3. "Speech didn't seem to work when I tried it."
4. "Add back some of the other good apps."
5. Repo goes public; 6. Pages must just work; 7. Works well on iPad **and** iPhone.

---

## 0. What the audit found (play-through on 5 viewports)

Every app was played with Playwright on Desktop Chrome 1280×800, WebKit iPad 1180×820 and
820×1180, WebKit iPhone 15 393×745 (Safari viewport) and 852×340 (landscape, Safari chrome
removed). Screens were screenshotted and inspected; DOM metrics were measured. Findings, most
severe first:

| # | Where | What a 7-year-old sees | Measured / cause |
|---|---|---|---|
| F1 | **Hub** | Nine coloured tiles that look like stat cards (title, tagline, "✨ New!", "+50"). Nothing says *play* or *tap*. The top third is a grown-up dashboard (rank bar, ring, Today/This week/Bank). | iPhone: first game card at y=397 of a 745 px viewport; hub is 2164 px tall (3 screens). Desktop/iPad: fine columns (3 at 1180). Playwright's "iPad (gen 11) landscape" descriptor is 944 px wide → 2 columns; real iPad is 1180 → 3 columns. |
| F2 | **Start flow** | Three taps and two different "start" buttons before the first question: card → app home (**Sprint!** / **Draw!** / **Play!** / **Read!** / **Find it!**, each a different word, colour and position) → a second card with **GO!** → 3-2-1. On first run the GO card is replaced by **Turn on talking**, which looks like the start button. | `DrillScreen` ready card exists because the mic needs a user gesture after the route change. |
| F3 | **Mic (why "speech didn't work")** | A 48 px chip in the top-right corner turns green with an ear the instant GO is tapped — *before* any recognizer confirmed it is running — and then nothing on the screen moves when he talks. | `manager.startWebSpeech()` patches `status:'listening'` before `rec.onstart`. The Web Speech engine never calls `onLevel`, so during the whole first session (model still downloading, Web Speech bridging) the level ring is static. `onDevice.pump()` has no timeout around `recognizeForMode()` → "Thinking" can last forever. `MicButton` emits `is-ear/is-error`; `drill.css` also styles `.is-live/.is-err` (dead CSS). The parent area has no way to test the mic. |
| F4 | **iPhone landscape** | Play screen is unusable: the problem card sits on top of the keypad (only `0` and `⌫` peek out); GO overlaps keys. | `.dr-body` side-by-side layout needs `min-width: 900px`; 852 px phone gets the stacked layout inside `height: 100dvh; overflow: hidden`. Every Playwright click timed out. |
| F5 | **iPhone portrait** | Top bar wraps to two rows in play (timer bar drops under the back button); the problem is 56 px in a card with 60 % empty space; Maps pack tabs overflow (4 px horizontal scroll); Maps round shows a stamp-sized USA with un-tappable states; Big Adding home is 1853 px tall, Read Words home 1374 px. | `k-topbar` 109 px tall at 393 px; `.mp-packs` not wrapping; map fills width only. |
| F6 | **Big Adding** | `12 + 30 = 42` horizontal on the play and retype cards. | Known leftover; no column layout exists in `ProblemCard`. |
| F7 | **App homes** | Format cards (Race 20 / Practice) and 6–8 set chips with `⭐×1.2` / `×½` tags have the same weight as the hero; "—" placeholder stats; Big Adding shows a 9-tile skill ladder; Read Words shows 16 locked level cards. | Fine for a parent, noisy for a kid. |
| F8 | **Repo** | Four stray test reports in the root, `tests/_dbg/dbg.spec.ts` with an absolute scratch-directory screenshot path that embeds the home-folder user name, `ARCADE_GAMES_TEST_REPORT.md` with an absolute cloud-storage path, `docs/screenshots/` 33 MB of PNGs, README describes "one app". | All would be committed by `git add .`. `public/ort` already ignores the WASM (good). |

Things that are already good and must be kept: the chunky 3-D button language, the retype card
("Not ~~96~~ · 9 × 4 = **36** · Type 36"), the drill card on iPad landscape, the round summary,
the Dot Drawing and Algebra homes (equation preview + Play), the reading word card, the pause sheet.

---

## 1. Five rules (apply everywhere)

1. **One word, one colour, one place.** The primary action on every screen is a single green
   `PLAY ▶` pill (`--k-play`), centred, in the same position, the biggest thing on the screen. Nothing
   else on the screen is green and pill-shaped.
2. **Two taps to a question** from the hub (card → PLAY), one tap from the hub's *Continue* button.
   No screen whose only job is a second start button.
3. **Prove it is listening.** When the mic is on, something on the screen moves with his voice within
   100 ms of him speaking, and it is next to the problem, not in a corner.
4. **Nothing waits silently.** Any state that can hang (model download, inference, permission
   prompt) has a visible progress or a 2 s watchdog that turns it into a friendly "say it again".
5. **Phone is a first-class layout**, not a squeezed tablet: 393 px portrait and 852×340 landscape
   are tested viewports in `playwright.config.ts`.

---

## 2. Start flow

### 2.1 Hub (owner A)

```
┌─────────────────────────────────────────────────────────────┐
│ Hi Sam!   ⭐ 120 today   (ring 64px)   🐣 Rookie    🏆 3/13   │  ← one compact row (phone: two rows)
├─────────────────────────────────────────────────────────────┤
│ ▶  CONTINUE · Times Tables · Sprint 60               [big]   │  ← green PLAY pill, full width
├─────────────────────────────────────────────────────────────┤
│ 🧮 Math                                                      │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│ │ ✖️  Times     │ │ ➗ Division   │ │ ➕ Big Adding │           │
│ │    Tables    │ │              │ │              │           │
│ │ Best 23  (▶) │ │ New!     (▶) │ │ New!     (▶) │           │
│ └──────────────┘ └──────────────┘ └──────────────┘           │
│ …                                                            │
│                                         🔒 Grown-ups (hold)  │
└─────────────────────────────────────────────────────────────┘
```

- **Hero row** replaces the current two-card header: greeting (h1, 28–36 px), `⭐ {today} today`,
  goal ring (64 px, stroke 8, number inside), rank emoji + name, trophy chip `🏆 n/13`. *This week* and
  *Bank* move to Grown-ups. Reward-goal bar (when set) stays as its own slim row under the hero.
  Phone (< 600 px): greeting on row 1, the four stats on row 2 as chips; total hero height ≤ 120 px.
- **Continue button**: full-width `PlayButton` (§2.4) labelled `▶ PLAY · {lastApp} · {lastFormat}`
  when `ms2:ui:last:v1` exists, else `▶ START HERE · Times Tables`. Tapping it runs the exact §2.3
  sequence for that app/format/set (one tap → countdown). It is the only green pill on the hub.
- **App card** (`.hub-app`, min-height 100 px, phone 88 px): emoji tile 56 px, title 24 px, one line
  under the title = progress if played (`🏅 Best 23 · 🌟 22 gold`) else tagline, and a **white 40 px
  circle with the app-coloured ▶** in the bottom-right corner (`.hub-app__go`, already in CSS, unused).
  The whole card is the tap target; the ▶ circle is the cue. Press state = translateY(6px) (exists).
  `✨ New!` chip stays (small). The `⭐ +50` bonus badge shows on **at most one card per group** (the
  first un-played app of the group today), never on all nine.
- **Trophy shelf** leaves the hub body: the `🏆 n/13` chip in the hero opens a bottom sheet with the
  shelf (same markup, `TrophySheet`). Hub body = hero + continue + 3 groups + Grown-ups.
- **Columns**: `@media (min-width: 900px) .hub-group--math .hub-apps { grid-template-columns:
  repeat(3, 1fr) }` and `minmax(280px, 1fr)` below, so 944 px (Playwright iPad descriptor) and 1180 px
  (real iPad) both give 3 columns; 600–899 px → 2; < 600 → 1.
- Hub must fit in **one screen** on iPad landscape (1180×820 incl. Safari chrome ≈ 1180×700) and in
  **two screens** on iPhone portrait (≤ 1500 px tall).

### 2.2 App home — one pattern for all nine apps (owner A)

A shared `AppHome` component (`src/core/ui/AppHome.tsx`) renders every app's home. The app passes
data; the layout is fixed.

```
TopBar  ←   ✖️ Times Tables                                    🎤 On   ⭐ 120
┌───────────────────── hero card (white, radius-lg) ──────────────────────┐
│                    [chip] Sprint 60 · All tables  ▾                     │  ← current choice (tappable → More)
│                                                                        │
│                 ┌───────────────────────────────┐                      │
│                 │        ▶   P L A Y             │  ← universal PlayButton │
│                 └───────────────────────────────┘                      │
│                 60 seconds, as many as you can!                        │  ← one plain sentence
│                 🏅 Best 23      (only when a best exists)               │
└────────────────────────────────────────────────────────────────────────┘
▸ More ways to play                                      (collapsed row)
   ┌ formats ┐ ┌ which facts / level ┐ ┌ grid / gallery / skills ┐
```

- **Hero** (`AppHome.hero`): `levelChip` (what will be played: `Sprint 60 · All tables`,
  `Level 2 · Short i & o ★★☆`, `Mystery picture · Medium`, `Big States ★☆☆`), the `PlayButton`,
  `subtitle` (≤ 7 words, plain English), optional `bestLine`. **No "—" placeholders ever**; when there
  is no best, show nothing. The level chip has a `▾` and opens *More ways to play* scrolled to the
  level/set picker.
- **More ways to play** (`AppHome.more`): a disclosure row (`<details>`-like, 56 px tall, label
  "More ways to play ▸", `data-testid="more"`). **Collapsed by default on every device**; its open
  state is remembered per app (`ms2:ui:<app>:v1.moreOpen`). Inside, in this order:
  1. *Formats* — the other round formats as cards (Race 20, Practice). Cards keep emoji + title +
     one-line description + best. Tapping a card plays that format **immediately** with the current
     set (§2.3), it does not just select it.
  2. *Which facts / Level* — a `role=radiogroup` of **at most 4 chips** + one "more" chip:
     - Times Tables / Division: `🌈 All` · `😊 Easy` (2·5·10) · `💪 Hard` (6–9) · `🎯 Tricky` (weak
       facts) · `🔢 One table ▾` (opens a 2–12 grid sheet, 64 px cells coloured by mastery; `3·4` and
       `11·12` live in the sheet as tiles).
     - Big Adding: `🌈 All` · `🌤️ Warm up` · `💪 Carry` · `🚀 Big sums` (No-carry moves into the
       skills list).
     - Mixed: none (single set) — the mix panel is shown instead.
     - Reading: the level path (current ± 2 on phone with "See all 16", full grid ≥ 600 px).
     - Algebra: level list (unchanged markup). Coordinates: 4 level cards. Maps: pack tabs + stages.
     The `⭐×1.2` / `×½` multiplier tags **leave the chips**; they appear only as a second line in the
     sheet/description text ("Carry · ⭐ ×1.2").
  3. *Progress* — grid tile (`🌟 22/144 · My grid ›`), skills ladder, gallery strip, mix panel.
     On phone these are single-row strips with a `›`, never a 9-tile grid.
- **Choosing a set/level does not start a round**; it updates the level chip and plays `click`. Only
  PLAY and the format cards start rounds.
- **Mic toggle** in the TopBar (`🎤 On/Off`, 48 px) is replaced by the shared `MicChip` from §4 in its
  `home` variant (same states, same shape as in play, so he learns one icon).
- Keep per app: Dot Drawing's `(3, 7) → across / up` how-to box (under the subtitle), Algebra's
  equation preview (above the chip), Maps' Explore button (inside *More*).

### 2.3 Starting a round — PLAY is the gesture (owner A; C supplies `armMic`)

```
PLAY tap (user gesture)
  ├─ sfx.unlock()
  ├─ if settings.voice.enabled && micGranted():  armMic()        // C: opens getUserMedia now,
  │                                                              //    keeps the stream ≤ 5 s for the next start()
  ├─ markAutostart(route)                                        // core/router: sessionStorage 'ms2:autostart' = {route, t}
  ├─ rememberLast(app, format, set)                              // ms2:ui:last:v1 (feeds Continue)
  └─ navigate(route)
Round screen mounts
  ├─ consumeAutostart(route) → true when < 3000 ms old and route matches (cleared on read)
  ├─ needMicStep (first run, permission unknown)?  → show MicStep card (the ONLY time a card precedes play)
  └─ else go(): countdown 3 · 2 · 1 (450 ms each, "Get ready…" above, mic line below) → first question
```

- The ready card (`dr-ready`, `al-ready`, `rd-ready`) stays in code for: deep links / reload
  (no autostart flag), returning from the pause sheet's *Stop*, and the first-run `MicStep`. Its
  button is the same `PlayButton` labelled `▶ GO`.
- **Again** on the summary → `round.reset(); go()` directly (no ready card). Reading/Maps "Again"
  must also go straight to the countdown.
- **MicStep** copy: title `Can I listen to your answers?`, big `PlayButton` variant `mic` labelled
  `🎤 Yes, turn on my ears`, ghost `I'll type instead`. After *Yes* the browser prompt appears; on
  allow → countdown starts immediately (no second tap); on deny → toast "Okay, typing it is" + countdown.
- **Countdown**: digits `clamp(120px, 24vw, 220px)`; under them one line: `👂 I'm listening` (mic
  live) / `🧠 Getting my ears ready…` (loading) / nothing (mic off). If the mic is still `loading` when
  the countdown ends, play starts anyway (typing works) and the MicPanel shows the progress.
- Keyboard: Enter/Space still start from the ready card; on the app home Enter = PLAY.

### 2.4 `PlayButton` — the one primary button (owner A, `src/core/ui/PlayButton.tsx`)

- Tokens (A adds to `theme.css`): `--k-play: #22c55e; --k-play-deep: #15803d; --k-play-ink: #fff;`
  `--k-play-glow: rgba(34,197,94,.45)`.
- Size: `width: min(100%, 440px); min-height: 96px` (phone portrait 84 px, phone landscape 64 px);
  `border-radius: 999px`; label `PLAY` 900 / 36 px letter-spacing .04em + `▶` 28 px on the left;
  `box-shadow: 0 8px 0 var(--k-play-deep)`; `:active` translateY(6px). Variants: `go` (label `GO`),
  `continue` (label `PLAY · Times Tables · Sprint`, 26 px, truncates), `mic` (🎤 label), `again`
  (`AGAIN ↻`, used on summaries so "play again" is also green).
- Motion: `play-breathe` 1.8 s ease-in-out infinite: scale 1 → 1.03 and a 0 → 14 px glow ring
  (`--k-play-glow`); stops while pressed; `prefers-reduced-motion` → static.
- Always `data-testid="play"`. Tests/helpers that use `sprint`, `draw`, `read-now`, `go` are updated
  by A (`go` keeps its id on the ready card; the card's button is `PlayButton variant="go"`).
- Every other button on a home/summary screen is `BigButton` (app colour or ghost), never green.

### 2.5 Summary card (owner A)

Unchanged content; actions become `PlayButton variant="again"` (green) + ghost `Home`. Stats grid on
phone: 2×2 (never 3+1). The *Remember* chips stay.

---

## 3. First-time tour and idle hints (owner A)

### 3.1 Coach marks — 3 steps, once per device

Store `ms2:coach:v1 = { version: 1, hub: boolean, home: boolean, play: boolean }` (persist.ts).
`CoachMark` (`src/core/ui/CoachMark.tsx`): a dark scrim (`rgba(27,37,89,.55)`) with a rounded cut-out
over the target element (measured with `getBoundingClientRect`, 12 px padding, re-measured on resize),
a speech bubble (≤ 8 words, 22 px, 900) pointing at the cut-out with a bouncing `👆`, and a ghost
`Got it` button. Tapping the target itself performs the action **and** dismisses; tapping the scrim
dismisses; Escape dismisses. Each step shows once; never during a countdown or while a toast is up.

| Step | Screen | Target | Bubble |
|---|---|---|---|
| 1 | Hub, first visit | Continue button (or first math card if none) | `Tap here to play! 👆` |
| 2 | Any app home, first visit | PlayButton | `Tap the big green button!` |
| 3 | First question of the first round | Keypad (or MicPanel when the mic is live) | `Type the answer 👇` / `Say the answer! 🎤` |

Grown-ups → Settings gets `Show the tips again` (resets the store). Playwright `freshStart` seeds the
store as all-true so existing specs are unaffected; one new spec covers the tour.

### 3.2 Idle hints

`useIdleHint(ref, { after: 5000, on: boolean })` (`src/core/ui/useIdleHint.ts`): when no
`pointerdown`/`keydown` happened for 5 s on a screen with a primary action, render `IdleHint`: a
`👆` 40 px emoji anchored to the target's bottom-right, `k-wiggle`-style bob (1 s), plus the target's
glow ring pulsing faster (0.9 s). Cancels on any input; re-arms after 10 s; at most 3 shows per screen
visit; off under `prefers-reduced-motion`. Attach to: hub Continue, every PlayButton (home + ready
card), the summary *Again*, the MicStep *Yes*. In play: after 8 s with empty input, a soft chip under
the card `Say it or type it 👇` (no hand), cleared on input.

---

## 4. Microphone UX (owner C; A places the panel)

### 4.1 States and visuals — `MicPanel` + `MicChip`

`src/voice/ui/MicPanel.tsx` (new) is the on-screen voice status; `src/voice/ui/MicChip.tsx` (rewrite
of today's `MicChip`/`MicButton`/`ReadingMic`) is the 48 px toggle in the TopBar. Both read one
`MicLook` computed in `src/voice/ui/micLook.ts` from `UseVoiceInputResult` + the watchdogs below, so
every app shows identical states. `drill/MicButton.tsx` and `reading/ReadingUI.tsx`'s `ReadingMic`
are deleted; `dr-mic*`/`rd-mic*` CSS moves to `voice-ui.css`.

| `MicLook` | Chip (TopBar) | Panel (next to the problem) | Leaves state when |
|---|---|---|---|
| `off` | 🎤 grey with slash | hidden (0 height reserved only in drills: 56 px slot stays so the card never jumps) | tap chip |
| `arming` | 🧠, thin progress ring | `🧠 Getting my ears ready… 43 %` + 180 px progress bar + `You can type meanwhile` | recognizer confirmed (§4.2) |
| `listening` | 👂 green | 5-bar level meter (bars idle at 10 %, slow bob) + `I'm listening — say the answer` | speech starts |
| `hearing` | 👂 green, ring follows level | meter follows level (10–100 %), text `…` | VAD end |
| `thinking` | 💭 + 3 dots | `Hmm…` + dots, **max 2000 ms** | hypothesis or watchdog |
| `heard-ok` | ✅ flash 600 ms | green chip `✓ 56` for 900 ms | next question |
| `heard-wrong` | 👂 | red chip `I heard 54` (stays through the retype card) | next question |
| `unsure` | ❓ amber | amber chip `❓ Say it again?` for 1500 ms (or partial: `fifty…`) | timer / speech |
| `cant-hear` | 👂 with amber dot | `Can't hear you — tap 🎤 to check` (soft, dismissible) | any `hearing` |
| `error` | 🎤 red with `!` | red card: `Mic is blocked 🚫` + `[Fix it]` + `[I'll type]` | tap / retry success |

- **Placement is the same in every app**: the panel is the last child of the stage, directly under
  the problem card (drills, algebra) or under the word/sentence (reading), full card width, 56 px tall
  (one line); on phone portrait 48 px. The chip is always the right-most TopBar item before the points.
- **Meter**: 5 bars, 6 px wide, heights `8 + 32 × h` px where `h = clamp((level × 4) ^ 0.7, 0.1, 1)`,
  attack 30 ms, decay 220 ms, colour `--k-success`; middle bar tallest (bars scaled ×0.6/0.85/1/0.85/0.6).
  Must visibly move when a child speaks at normal volume 50 cm from an iPad.
- **Level source**: on-device → worklet RMS (exists). Web Speech → C adds an `AnalyserNode` on a
  `getUserMedia` audio track on desktop/Android; on iOS (`/iP(hone|ad)/` UA) do **not** open a second
  track (verify on device whether it starves `webkitSpeechRecognition`); if not possible, drive the
  meter synthetically from `onsoundstart`/`onspeechstart`/interim `onresult` (bars animate 60–100 % while
  speech events are flowing) so there is still motion when he talks.
- `Fix it` opens a sheet with the two-line fix for the current platform: iOS Safari `Tap "aA" →
  Website Settings → Microphone → Allow`, iOS Home-Screen app `Settings → Safari → Microphone → Allow`
  (or re-add to Home Screen), Chrome `Tap the lock icon → Microphone → Allow`. Then `Try again` (calls
  `voice.start()` inside the tap) and `I'll type` (turns voice off for this round only).
- Heard text for reading keeps today's `I heard "zzz"` line; it moves into the panel.
- **Minimal pairs (short a/e)**: when `matchWord` finds the heard word differs from the target by a
  single vowel (`said/sad`, `bed/bad`, `pen/pan`, `men/man`) the verdict is `unclear` (not `wrong`): the
  panel says `❓ Almost — say it again` and the 🔊 button pulses once. Two such in a row → `wrong` path.

### 4.2 Honesty rule — "listening" means listening

`status` may only become `listening` after the engine confirms audio: Web Speech → `onstart` **and**
(`onaudiostart` or first `onresult`/`onsoundstart`); on-device → first worklet frame delivered. Until
then the status is `loading` (`arming`). `manager.startWebSpeech()` must therefore patch
`status:'loading'` first (today it patches `listening` immediately).

### 4.3 Watchdogs (engine/manager level, C) — nothing sits in "Thinking" > 2 s

| Id | Condition | Action |
|---|---|---|
| W1 | `processing` for > **2000 ms** (`pump()` wraps `recognizeForMode` in a timeout) | `cancel` the worker job, drop the segment, status → `listening`, emit `voice:timeout` (panel shows `unsure`). 3 in a row → switch engine (`moonshine` → `webspeech`, or the reverse) + toast `Switching ears 👂`; diagnostics record it. |
| W2 | `hearing` longer than the mode's `maxUtteranceMs` + 300 ms | force endpoint (VAD) and process. |
| W3 | Web Speech `start()` with no `onstart` within **1500 ms** (or `onstart` with no `onaudiostart` within 2500 ms) | treat as `unknown` error → fall back (on-device if loaded, else `error` look with *Fix it*). |
| W4 | `listening` ≥ 15 s with zero `hearing`, while ≥ 3 answers were typed | `cant-hear` look (soft chip). Never auto-switch here. |
| W5 | Model download: no progress event for 20 s | retry once; then `modelState: failed`, panel `Using browser ears for now`, hub re-tries next visit (exists). |
| W6 | `visibilitychange → visible` mid-round, or `audioContext.state !== 'running'` on `pointerdown` | re-arm capture within 500 ms; if it fails → `error` look. |
| W7 | A hypothesis arrives for a question that is no longer current | ignored (exists, keep). |

The panel also has a UI-level belt-and-braces: if it has rendered `thinking` for 2000 ms it switches to
`unsure` by itself.

### 4.4 Parent mic test page (`#/grownups/mic`) — C builds `src/voice/ui/MicTest.tsx`; A adds the route and a `Test the microphone` button in the Grown-ups *Voice* card

Shows, top to bottom: the `MicPanel` at size `lg` (meter 2×), a `PlayButton variant="mic"` labelled
`Start test`, the prompt `Say: "fifty-six"`, and a checklist that turns green live:
`✅ Secure page` · `✅ Mic allowed` · `✅ I can hear you` (level > 0.05 seen) · `✅ Heard "56" in 0.4 s`.
Below: engine in use, model state (`Downloaded` / `Downloading 43 %` / `Not yet` + button),
Home-Screen-app flag (`navigator.standalone`), last 5 transcripts with latency, `Switch to browser
ears / on-device`, `Forget learned phrases`. Pass = all four ticks. This page is what the parent opens
when "speech doesn't work".

Hypothesis to verify on the real iPad (C, in `tests/voice-ipad-checklist.md`): in a Home-Screen web
app `webkitSpeechRecognition` may be absent or silent, so with the model still downloading nothing
could answer. Required behaviour: in standalone mode never rely on Web Speech silently — if the model
is not ready the panel shows the download progress (and the hub keeps preloading).

---

## 5. Workbook (vertical) layout for multi-digit + and − (owner B)

Applies in `ProblemCard` when `fact.op ∈ {'+','−'}` **and** `max(operands) ≥ 10` (any 2-digit
operand) — Big Adding, the +/− facts inside Mixed Blitz, and any future subtraction app. Single-digit
facts (`8 + 7`, `15 − 7`) and all × ÷ stay horizontal. `Fact` already carries `operands` and `op`; no
contract change.

### 5.1 Anatomy

```
            carry row  ·   [1]  ·        ← 0.45em digits, tappable slots above tens/hundreds (never required)
                            4    7       ← top operand, right-aligned by column
                   +        3    8       ← operator in its own column left of the bottom operand
            ─────────────────────────    ← rule, 6px, --k-ink, spans operator..ones
                       ┌──┐┌──┐┌──┐
                       │  ││  ││▌ │      ← answer boxes, one per column; caret in the ONES box first
                       └──┘└──┘└──┘
```

- Grid: `display: grid; grid-template-columns: [op] 0.9em repeat(N, 1em)` where `N = max digits of
  answer the generator can produce` (3 for Big Adding, `maxPlausible 198`; 2 for subtraction within
  100). Every digit sits in its own 1 em cell, `text-align: center`, so columns align regardless of
  font metrics; `font-variant-numeric: tabular-nums; font-feature-settings: "tnum"`.
- Font: `--wb-size: clamp(44px, 8.5vw, 80px)` for operands and answer digits (weight 900, line-height
  1.05); operator same size, `--k-ink-soft`; carry digits `0.45em`, `--k-accent-ink`. Whole block
  height ≈ 4.3 em → 344 px at 80 px, fits the 520 px card; on a 393 px phone `--wb-size` = 44 px →
  190 px.
- Answer boxes: `1em × 1.15em`, `border: 3px solid color-mix(in srgb, var(--k-app) 35%, transparent)`,
  radius 10 px; the box that will take the next digit has the solid app-colour border and the blinking
  caret; filled boxes show the digit in `--k-app`. The hundreds box exists on every Big Adding problem
  (so it never leaks whether the answer is ≥ 100) but is drawn dashed until used.
- Top/bottom operands render leading-empty cells as blank (no "0").

### 5.2 Entry order — ones first

In workbook layout typed digits fill the boxes **right to left**: the first digit goes in the ones
box, the next in the tens, then hundreds. Implementation in `useDrillRound.typeDigit` when
`layout === 'workbook'`: `input = digit + input` (prepend) instead of append; `backspace` removes the
most recently entered (left-most filled) digit. The accept/wrong rules are unchanged and still work
on the string: `input === String(answer)` → correct; `input.length === String(answer).length && input
!== answer` → wrong. The caret cue makes the order self-evident (he sees which box lights up), and it
matches how he writes on paper. Voice answers fill all boxes at once. Physical keyboard follows the
same order. Grown-ups → Settings gets `Workbook typing: ones first (default) / left to right`
(`settings.workbookEntry: 'ones' | 'ltr'`, A adds the key; B reads it).

### 5.3 Carry / borrow marks (optional, cosmetic)

- Addition: a 0.45 em tap slot above each column except ones; tap toggles a small `1` (sfx `pop`).
  Never scored, never required, cleared on the next problem. Slots are invisible until the first digit
  is typed or 3 s have passed (so a fast kid never sees them).
- Subtraction: tapping the **top** operand's tens digit toggles the borrow mark: the digit gets a
  diagonal strike, `n−1` appears above it (0.45 em), and a small `1` appears before the ones digit.
  Same rules as above.

### 5.4 Retype / wrong card in workbook layout

Same grid. The wrong attempt shows as today (`Not ~~85~~` above). The correct answer is filled in the
boxes in `--k-success`, and **the carry `1`s are shown automatically** where a carry happened (computed
from the operands); for subtraction the borrow marks are shown. `Type 95` under the block. As he
retypes (ones first), each box flips from green to `--k-ink` so he traces the answer; the retype timer
bar stays. Mixed Blitz uses this card for its +/− facts and the horizontal one for × ÷.

### 5.5 Sizes per viewport (B verifies with screenshots)

| Viewport | `--wb-size` | Block height | Notes |
|---|---|---|---|
| Desktop / iPad landscape | 80 px | ≈ 344 px | card beside keypad |
| iPad portrait | 70 px | ≈ 300 px | |
| iPhone portrait 393 | 44 px | ≈ 190 px | card + 48 px MicPanel + 4×58 px keys fit in 745 px |
| iPhone landscape 852×340 | 40 px | ≈ 172 px | side-by-side (§6) |

Summary "Remember" chips show `47 + 48 = 95` horizontally (fine).

---

## 6. iPhone layout rules (owner E in `src/styles/phone.css`; app owners keep their files)

Breakpoints: **phone portrait** `@media (max-width: 480px)`; **phone landscape**
`@media (max-height: 500px) and (orientation: landscape)`. `phone.css` is imported last from
`main.tsx` and contains only media-query overrides (no edits to `ui.css`/`drill.css`), so it never
conflicts with A/B/C.

Portrait (393×745 Safari, 393×852 Home Screen):
- `.k-topbar`: height 56 px, padding 6 px 10 px, back 44×44, title hidden in play, points chip
  compact (`⭐ 120`, 36 px), MicChip 44 px. **The timer bar moves out of the TopBar** into the top edge
  of the problem card (`.dr-timer` becomes `position:absolute; top:0; left:0; right:0; height:8px` inside
  `.dr-card`, seconds badge top-right) — A's DrillScreen renders `center` inside the card below 480 px.
  Reading progress dots: max 8 dots then `3/15` text.
- Problem: `.dr-problem` `clamp(52px, 15vw, 64px)` (= 59 px at 393); card `min-height: 200px;
  max-height: 46dvh`; `.dr-stage` gap 8 px.
- Keypad: 3 cols, `min-height: 58px`, gap 8 px, font 30 px, width `calc(100% - 24px)`, pinned to the
  bottom with `padding-bottom: max(10px, env(safe-area-inset-bottom))`.
- Home screens: hero card padding 16 px; PlayButton 84 px; chips wrap to ≤ 2 rows; *More ways to play*
  collapsed; progress strips single-row.
- Hub: §2.1 phone hero; card 88 px; page ≤ 1500 px tall.
- Maps home: pack tabs are a horizontally scrolling row (`overflow-x: auto; scroll-snap`), no page
  overflow. Maps round in portrait: the map fills the width **and** a `RotateHint` overlay
  (`src/platform/RotateHint.tsx`, E) says `Turn your phone sideways 🔄` until landscape; small states
  (area < 44 px²) get a 2× magnifier bubble on press-and-hold (E, in `MapView`, ≤ 30 lines).
- Dot Drawing portrait: grid fills the width; target card above it, 56 px; fine as is.

Landscape (852×340 Safari, 852×393 Home Screen):
- `.dr-body` becomes two columns at any width: `grid-template-columns: minmax(0,1fr) 300px; gap 12px;
  padding 0 max(12px, env(safe-area-inset-left)) 8px max(12px, env(safe-area-inset-right))`.
- `.k-topbar` 48 px; `.dr-card` `max-height: calc(100dvh - 64px)`; `.dr-problem`
  `clamp(40px, 9vh, 64px)`; MicPanel 40 px.
- Keypad: 4 rows × 48 px, gap 6 px (= 210 px), font 26 px; fits 340 − 48 = 292 px.
- Ready/MicStep/countdown cards: PlayButton 64 px, title 24 px, description hidden if height < 360.
- Reading/Maps/Dot Drawing: content `max-height: calc(100dvh - 56px)`, word `clamp(56px, 22vh, 120px)`.

Safe areas and touch (E, `theme.css`): `.k-screen` already pads with `env(safe-area-inset-*)`;
`.k-topbar` and `.dr-pad` add `max(…, env(...))` as above; `html { -webkit-text-size-adjust: 100% }`;
game surfaces `touch-action: manipulation; -webkit-touch-callout: none; user-select: none`; body
`overscroll-behavior: none` (exists); no `maximum-scale` lock. Status bar: `black-translucent` +
`theme-color` per DESIGN §3.7. `playwright.config.ts` adds projects **iPhone 15** (portrait) and
**iPhone 15 landscape** (WebKit, `viewport: { width: 852, height: 340 }` to simulate Safari chrome);
`tests/layout.spec.ts` asserts: no horizontal overflow, keypad fully inside the viewport, `.k-key` ≥ 44
px, PlayButton visible without scrolling on every home.

---

## 7. Legacy audit and the apps to bring back (owner D)

Inspected: `src/WordProblemsApp.tsx` + `config/wordProblemsConfig.ts` + `data/wordProblems/allProblems.ts`
(115 problems: 95 multiple-choice, 20 fill-number; categories letter-pattern 20, rhyming 20,
synonym/antonym 15, word-math 25, sequence 15, comprehension 20), `src/ChartApp.tsx` +
`config/chartGameConfig.ts` + `data/charts/chartDataGenerator.ts` (6 levels, bar/pictograph/line/pie/
multi-line/grid, Recharts), `src/ReadingApp.tsx`, `src/GeographyApp.tsx`, `src/AlgebraApp.tsx`,
`src/ComparisonApp.tsx`, `src/TableApp.tsx`, `src/ArcadeApp.tsx`.

| Legacy app | Verdict | Why |
|---|---|---|
| **Word Problems** | **Rebuild now as `stories`** | The word-math + sequence content is exactly Grade-1/2 (join, take-away, how-many-more, skip counting) and is the one thing no current app covers: *reading a situation and choosing the operation*. Needs a numeric-answer redesign (DESIGN forbids multiple choice). |
| **Charts** | Rebuild second (`charts`), if time | Reading bar graphs and pictographs is a Grade-2 standard and the tap/keypad economy already exists (Dot Drawing). Legacy levels 1–2 are good; 3–6 (line charts, pie, 100-range) are too old for 7. Drop Recharts; draw SVG. |
| Reading, Geography, Algebra (legacy) | Superseded | Read Words/Sentences, Maps, Quick Algebra cover them better. |
| Comparison (fractions, decimals, negatives, π) | No | Too advanced; multiple choice. |
| Table game | No | The mastery grid + Practice covers it. |
| Arcade (15 games) | No (parent's instruction) | — |

### 7.1 `stories` — Story Problems (owner D, `src/apps/stories/**`, registry entry, hub group `math`, colour `--k-app-stories: #F97316`, emoji 📚, tagline "Read it, work it out")

**Content** (`problems.ts` + `gen.ts`):
- Port the 20 `fill-number` word-math items and the 6 numeric sequences from `allProblems.ts` as
  seed items (keep `hint1`, `explanation`); rewrite the numeric-in-disguise multiple-choice items
  (`Who has more?` → `How many more toys does Alex have?`). Letter/rhyme/synonym/comprehension items
  are **not** ported (they need text answers; a voice version is a later app).
- A template generator makes the pool effectively infinite: `join` (A has x, gets y more),
  `take-away`, `how-many-more`, `two-groups`, `equal-groups` (3 bags of 4), `share` (12 ÷ 3),
  `skip-count` (`2, 4, 6, 8, _`), `missing-in-sequence`, `two-step` (L5). Names (12), objects with emoji
  (apples 🍎, cars 🚗, stickers ⭐, fish 🐟, cookies 🍪, balloons 🎈 …), places. Numbers: L1 within 20,
  L2 within 100 no regroup, L3 regroup, L4 × ÷ within 5×5, L5 two-step within 100. Mastery per
  template id with the same Leitner boxes (`masteryStore('stories')`).
- **Presentation**: story in 2–3 short sentences, ≥ 26 px (phone 22 px), each sentence on its own line;
  L1–L2 show the quantities as emoji groups under the text (`🍎🍎🍎  +  🍎🍎`) so he can count; the
  question line bold with the number sentence hidden until the hint. A `🔊 Read it to me` button
  (speechSynthesis, exists in `reading/speech.ts`) is always present and is **free** (reading is not what
  is scored). Answer via keypad/voice number mode with the drill rules (auto-accept, same-length wrong).
- **Anti-guess**: wrong → hint card (`hint1`, else the number sentence with a box `3 + 2 = ☐`),
  second try = half points; second wrong → worked answer (emoji groups merge/split, `3 + 2 = 5`), retype
  for 0, combo reset. Same as Algebra.
- **Round**: `Story 8` (8 problems, no timer; stopwatch hidden). Points base 20, speed fast 15 s / ok
  30 s, difficulty `round(prior×5)`, combo as usual; `Perfect story` +40 for 8/8 first try. Stars per
  level (3 = 8/8 first try, 2 = ≥ 6, 1 = finished) like Reading; level N+1 unlocks at 2 stars.
- **Home**: `AppHome` with level chip `Level 2 · Within 100 ★☆☆`, PlayButton, subtitle `8 stories ·
  read, think, type`; *More*: level list (5), "🔊 always reads to me" toggle.
- Tests: generator never produces negative/invalid answers; a Playwright flow (play, wrong → hint →
  retype, summary, stars).

### 7.2 `charts` — Chart Reading (owner D, second priority; same AppHome/tap economy)

Levels: 1 *Picture graphs* (pictograph, 3–4 rows, 1 symbol = 1), 2 *Bar graphs with numbers*, 3 *Bar
graphs, read the scale* (scale 2/5), 4 *Compare* (how many more). Questions: `Tap the one with the
most/fewest` (tap, miss −5, hint highlights the tallest bar on miss 2), `How many 🐶?` (keypad/voice),
`How many more 🐱 than 🐟?` (keypad). Round = `Chart 10`, points like Dot Drawing. Plain SVG bars with
emoji labels; themes from `chartThemes`. Not started until `stories` ships.

---

## 8. Public repo, Pages and iOS platform (owner E)

- Delete: `ARCADE_GAMES_TEST_REPORT.md`, `FINDINGS_SUMMARY.txt`, `READING_SKILLS_TEST_REPORT.md`,
  `TEST_REPORT.md`, `tests/_dbg/`, `docs/screenshots/` (33 MB; regenerate into a scratch dir with
  `scripts/screenshots.mjs` that takes `--out <dir>`).
- `.gitignore` adds: `docs/screenshots/`, `tests/_dbg/`, `*.png` under `test-results/`, `*REPORT*.md`,
  `FINDINGS*.txt`, `.playwright-mcp/`, `.env*`, `public/models/` (self-hosted models, if ever).
  Keep `public/ort/.gitignore` (`*` + `!.gitignore`) — the WASM is produced by `postinstall` on the
  Pages runner.
- `scripts/check-privacy.mjs` greps every tracked/untracked file (excluding `node_modules`, `dist`,
  `test-results`, `playwright-report`) for absolute home-directory paths (macOS, Linux and Windows user-profile
  prefixes), cloud-storage folder names, scratch/temp directory paths and the
  local user name (read from `os.userInfo().username`, never written to the repo); the patterns live
  in the script, not in docs. It must report nothing; add it as `npm run check:privacy` and a CI step
  before build. No real names,
  emails or usernames in `package.json` (`author` absent), LICENSE (MIT, "Math Skills contributors"),
  README, tests, fixtures metadata, or `docs/`.
- README rewrite: all nine apps, points/parent area, voice (on-device + fallback, HTTPS/mic note,
  Home-Screen note), develop/test commands, deploy, the mic test page; no device names, no paths.
- `index.html`: description `Fast, fun math and reading practice for kids`; `apple-mobile-web-app-
  status-bar-style: black-translucent`; keep `viewport-fit=cover`; `theme-color` `#3D7BFF`;
  manifest `description` updated; `orientation: any` stays.
- Pages: workflow unchanged (`npm ci` → `postinstall` copies ORT → `npm run build` → `dist`), plus
  `check:privacy`, `lint`, `test:unit` before build. `vite.config.ts` keeps `base: './'` and hash
  routes; confirm the worker/worklet URLs resolve under `/math-skills/` with `tests/pages.spec.ts`.
  Model files come from the HF CDN (document `VITE_ASR_MODEL_BASE` for self-hosting). Mic works on
  `https://*.github.io` (secure context); the README says the dev server needs `VITE_HTTPS=1` for
  phone testing.
- iOS: §6 safe areas/touch rules; `audioContext.resume()` on `pointerdown` + `visibilitychange`
  (exists, verify); `playsinline` not needed (no video).

---

## 9. Acceptance (Playwright, per builder; all on Desktop Chrome + iPad land/port + iPhone port/land)

- A: hub shows exactly one green PlayButton (Continue); card → home → PLAY → first question in 2
  taps and < 2.5 s; `Again` → countdown without a ready card; coach marks show once and never again
  after reload; idle hint appears after 5 s on a home and disappears on tap; all nine homes have
  `[data-testid="play"]` visible without scrolling at 393×745.
- B: a 2-digit `+` problem renders `.wb` grid with N boxes; typing `5` then `9` for 95 fills ones then
  tens and auto-accepts; a same-length wrong shows the workbook retype card with the carry `1`; `8 + 7`
  stays horizontal; Mixed shows both layouts in one round; no overflow at 393 px.
- C: with the scripted recognizer, status is `loading` until `onstart`, then `listening`; a 2.5 s
  stalled inference (worker stub) ends in `unsure` within 2.1 s and the third stall switches engine;
  `MicPanel` meter height changes when `level` changes; the mic test page ticks all four checks with
  the fake mic; `said` for `sad` is `unclear` once, `wrong` twice.
- D: stories generator property tests; story round flow; registry entry enabled; hub shows 10 cards.
- E: `check:privacy` clean; `layout.spec.ts` passes on the two iPhone projects (no overflow, keypad in
  view, keys ≥ 44 px); Pages preview spec passes; `git status` after `npm run build` shows no
  untracked junk.

---

## 10. Ownership and shared contracts

| Builder | Owns (may edit) | Adds | Must not touch |
|---|---|---|---|
| **A** start flow / hub / app home / coach | `src/hub/**`, `src/core/**` except mic (`core/ui/*` incl. `TopBar`, `Keypad`, `RoundSummary`, `BigButton`), `src/drill/DrillScreen.tsx` (ready/countdown/autostart + where `MicPanel`/`ProblemCard` are placed), every app's home: `MultiplicationHome.tsx`, `division/FactsHome.tsx`, `coordinates/CoordHome.tsx`, `algebra/AlgebraHome.tsx`, `words/ReadingHome.tsx`, `maps/MapsHome.tsx`, `mixed/MixPanel.tsx`; ≤ 10-line autostart hooks in `AlgebraRound`, `WordRound`, `SentenceRound`, `maps/RoundScreen`, `coordinates/PlayScreen`; `drill.css` **Ready / countdown** block only; `tests/helpers.ts`, `shell/flows/multiplication/*` spec updates for new test ids | `core/ui/PlayButton.tsx`, `AppHome.tsx`, `CoachMark.tsx`, `IdleHint.tsx` + `useIdleHint.ts`, `TrophySheet.tsx`, `core/router/autostart.ts`, `core/ui/last.ts` (`ms2:ui:last:v1`), settings keys `workbookEntry`, `coachDone`, theme tokens `--k-play*`, Grown-ups route `/grownups/mic` + button | `ProblemCard`, `useDrillRound`, `src/voice/**`, `phone.css` |
| **B** workbook layout | `src/drill/ProblemCard.tsx`, `src/drill/useDrillRound.ts` (entry order, carry state), `src/drill/drill.css` **Card / problem / answer / retype / workbook** blocks, `src/apps/addition/**`, `src/apps/mixed/**` in-play code (`facts.ts`, `subtraction.ts`) | `src/drill/Workbook.tsx` (+ `workbook.css` if preferred), `src/drill/columns.ts` (digit/carry maths, unit-tested), `tests/workbook.spec.ts` | `DrillScreen` (ask A for prop changes), `MicButton`/mic CSS, homes |
| **C** mic UX / robustness | `src/voice/**` (engines, manager, `useVoiceInput`, `ui/**`), `src/drill/MicButton.tsx` (delete), `src/apps/words/reading/ReadingUI.tsx` `ReadingMic`/`VoiceNote`/`BrainBar` + `reading.css` mic block, `useReadingVoice.ts`, the single `<MicPanel/>` placement line in `WordRound`/`SentenceRound`, `tests/voice*.spec.ts`, `mic-hygiene.spec.ts`, `tests/voice-ipad-checklist.md` | `voice/ui/MicPanel.tsx`, `MicChip.tsx` (rewrite), `micLook.ts`, `MicTest.tsx`, `voice/watchdog.ts`, `armMic()` + `micGranted()` exports in `voice/index.ts`, `voice:timeout` event | `DrillScreen` layout (A places `<MicPanel voice={voice} />` under the card and passes `voice`), `ProblemCard` |
| **D** legacy port | `src/apps/stories/**` (then `src/apps/charts/**`), its registry entry, `tests/stories.spec.ts`, `--k-app-stories` token line | — | anything else; uses `AppHome`, `PlayButton`, `MicPanel`, drill `Keypad` via barrels |
| **E** privacy / Pages / platform | `.gitignore`, `.github/**`, `index.html`, `vite.config.ts`, `public/**`, `README.md`, `LICENSE`, `scripts/**`, `package.json` scripts, `src/styles/theme.css`, `src/styles/phone.css` (new), `src/platform/**` (new: `RotateHint.tsx`, one-line mount in `maps/RoundScreen.tsx`, ≤ 30-line magnifier in `maps/MapView.tsx`), `playwright.config.ts` (iPhone projects), `tests/layout.spec.ts`, `tests/pages.spec.ts`, deleting stray reports and `docs/screenshots`, `tests/_dbg` | `scripts/screenshots.mjs`, `scripts/check-privacy.mjs` | app code beyond the listed one-liners |

Contracts the builders code against (A lands these in the first hour, as stubs if needed):

```ts
// core/ui/PlayButton.tsx (A)
export function PlayButton(p: { variant?: 'play'|'go'|'continue'|'again'|'mic'; label?: string;
  onClick: () => void; size?: 'md'|'lg'; className?: string; 'data-testid'?: string }): JSX.Element;

// core/ui/AppHome.tsx (A)
export interface AppHomeProps {
  appId: AppId; title: string; emoji: string;
  hero: { levelChip: ReactNode; subtitle: string; bestLine?: ReactNode; above?: ReactNode; below?: ReactNode };
  onPlay: () => void;                 // A wraps it with §2.3 (unlock, armMic, markAutostart, rememberLast)
  more: Array<{ id: string; title: string; node: ReactNode }>;   // rendered inside "More ways to play"
  topRight?: ReactNode;               // MicChip home variant, injected by the app
}

// core/router/autostart.ts (A)
export function markAutostart(route: string): void;
export function consumeAutostart(route: string): boolean;

// voice/index.ts additions (C)
export function armMic(): Promise<void>;        // getUserMedia inside the gesture; stream kept ≤ 5 s for the next start()
export function micGranted(): boolean;          // last known permission (persisted), never prompts
export function MicPanel(p: { voice: UseVoiceInputResult; size?: 'sm'|'md'|'lg'; heard?: HeardChip | null }): JSX.Element;
export function MicChip(p: { voice: UseVoiceInputResult; on: boolean; onToggle: () => void; variant?: 'home'|'play' }): JSX.Element;
export type HeardChip = { kind: 'ok'|'wrong'|'unsure'|'partial'; text: string };

// drill/ProblemCard.tsx prop additions (B)
layout: 'horizontal' | 'workbook';   // decided inside ProblemCard from fact.op/operands; DrillScreen passes nothing new
// useDrillRound (B): state.input semantics unchanged; typeDigit prepends in workbook layout; state.carry: Record<number, boolean>

// settings (A): workbookEntry: 'ones'|'ltr' (default 'ones'); coach via ms2:coach:v1
```

Order of landing: A's tokens/`PlayButton`/`AppHome`/`autostart` stubs and settings keys first (so B,
C, D compile); C's `armMic`/`micGranted`/`MicPanel` stubs next (A can place them); then everyone in
parallel. Each builder runs `npm run build && npm run lint && npm run test:unit` and the relevant
Playwright projects before handing off; E's privacy check runs last.
