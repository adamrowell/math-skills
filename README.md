# Math Skills

Short, fun math, reading, geography and logic practice for a young child (about 7). It is built for iPad and iPhone
(Safari or the Home Screen) and for desktop browsers, and hosted free on GitHub Pages. There are no
accounts, no ads and no server. Progress stays in the browser on each device.

Points work as a reward currency: a grown-up can see them in the "Grown-ups" area (behind a hold-and-answer gate) and
redeem them for real rewards.

## The apps

| Group | App | What it practises |
|---|---|---|
| Math | **Times Tables** | 0–12 × 0–12: Sprint 60, Race 20 or Practice, with an adaptive fact picker and a 12 × 12 mastery grid |
| | **Division** | The matching ÷ facts |
| | **Big Adding** | 2-digit sums, set out in columns like a workbook (ones first, optional carry marks) |
| | **Mixed Blitz** | + − × ÷ mixed together |
| | **Dot Drawing** | Coordinates: plot (x, y) points to reveal a picture |
| | **Quick Algebra** | Find the missing number (`□ + 7 = 15`) |
| | **Story Problems** | Short word problems read aloud on request; a hint first, then a worked answer |
| Reading | **Read Words** | Phonics levels: read the word out loud |
| | **Read Sentences** | Read a whole sentence out loud |
| World | **Maps** | Find US states and countries; the World pack covers continents, oceans, seas, gulfs and big lakes (Land & Sea → Seas & Gulfs → Bays & Lakes → Whole World) |
| | **Flags** | 64 flags: *Find it* (see the flag, tap the country), *Which flag?* (pick from 4, with look-alikes), a 45-second *Flag Spotter*, and a sticker album |
| | **Landmarks** | 103 landmarks with real photos (Eiffel Tower, Great Wall, Grand Canyon…): see the photo and tap the country, or the state on the USA level; passport stamps |
| Brain | **Brain Puzzles** | Basic IQ-test style puzzles in 20 families: number and shape sequences, 3 × 3 picture grids, mirror images, turns, paper folding, symmetry, counting shapes, odd one out, analogies, code breaking, balance scales, mini sudoku, mazes and more. Easy / medium / hard or adaptive, every puzzle generated fresh |

Every app works the same way: tap an app on the hub, then the big green **PLAY** button. Answers go
in with the on-screen keypad, a keyboard, or by voice (math and reading), or by tapping the map or a
picture (World and Brain). After a wrong answer the child retypes or taps the right one for no
points, and every wrong tap costs points, so guessing never pays.

## Voice

Answers can be spoken. Speech recognition runs **on the device** (Moonshine, via transformers.js
and onnxruntime-web WASM). It takes about 0.2 s per answer. The model, about 30–65 MB, downloads
once from the Hugging Face CDN and is cached by the browser. While the model downloads, the
browser's own speech recognition (Web Speech API) fills in where available. Smaller iPhones, and
any device that ran out of memory while loading, get the smaller model automatically.

- The microphone only works on secure origins: the GitHub Pages site (`https://…github.io`) or `localhost`.
- On iPad/iPhone, Safari asks for microphone permission the first time. To change it later:
  Safari: **aA → Website Settings → Microphone**. Home Screen app: **Settings → Safari → Microphone**.
- Grown-ups → **Test the microphone** (`#/grownups/mic`) checks the mic step by step: secure page,
  permission, level and a test phrase.

## Grown-ups area

On the hub, press and hold **Grown-ups**, then answer the multiplication question. There you can see
points for today, the week and all time, and the **Bank** of unredeemed points. You can also redeem
points with a note, set a reward goal (it shows as a bar on the hub), change the daily goal, name,
sound and voice settings, test the mic, and export or import progress as a file.

## Using it on an iPad or iPhone

1. Open the site in **Safari**.
2. Tap **Share → Add to Home Screen**. The app then opens full screen with its own icon.
3. Tap PLAY and allow the microphone if you want voice answers.

Both orientations work. On a phone held upright, Maps suggests turning the phone sideways.

Needs iOS / iPadOS **16.4 or newer** (Safari). Older versions show broken layouts and no on-device voice.

**Keep the points safe.** Points and progress are stored only on the device, in the browser.

- Use the **Home Screen app** every day. Safari can delete a website's data after 7 days without a
  visit; the Home Screen app is not affected.
- The Home Screen app and a Safari tab keep **separate** points. Pick one and stick with it. If points
  were earned in Safari first, use Grown-ups → **Export** in Safari and **Import** in the Home Screen app.
- Export now and then as a backup (Grown-ups → Export).

## Develop

Requires Node 22+.

```bash
npm install          # also copies the onnxruntime WASM into public/ort/ and the flag SVGs into public/flags/ (both git-ignored)
npm run dev          # http://localhost:5183
VITE_HTTPS=1 npm run dev   # https on your LAN (self-signed) so a phone/iPad can use the mic
npm run build        # type-check + production build into dist/
npm run lint
npm run test:unit    # vitest
npm run check:privacy  # fails if personal paths, names or e-mails would be committed

npx playwright install chromium webkit   # once
npx playwright test  # Desktop Chrome + WebKit iPad (landscape/portrait) + WebKit iPhone 15 (portrait/landscape)
npm run test:voice   # real speech model through a fake mic (downloads the model on first run)

# Production build under a GitHub-Pages-style sub-path:
npm run build && npm run preview:pages &       # http://localhost:4183/math-skills/
PAGES_URL=http://localhost:4183/math-skills npx playwright test tests/pages.spec.ts

# Screenshots of every app on 5 devices (written outside the repo):
npm run screenshots -- --out /path/to/folder
```

Code map: `src/hub` (home screen and grown-ups), `src/apps/<id>` (one folder per app, registered in
`src/apps/registry.ts`), `src/drill` (shared drill engine), `src/voice` (speech), `src/core`
(rewards, settings, UI kit), `src/platform` (iOS helpers), `src/styles` (theme and phone overrides).
Design notes are in `docs/`. Older v1 code (the `src/*App.tsx` files, `src/components`, `src/games`)
is kept for reference but not routed.

## Deploy to GitHub Pages

1. Push the repo to GitHub.
2. In **Settings → Pages → Build and deployment**, set **Source: GitHub Actions**.
3. Push to `main`, or run the workflow by hand. `.github/workflows/deploy.yml` installs, runs the
   privacy check, lint and unit tests, builds, and publishes `dist/`.

The site appears at `https://<user>.github.io/<repo>/`. The build uses a relative base (`./`) and
hash routes (`#/multiplication`), so any repo name works. A `404.html` sends stray paths back to the
app, and `.nojekyll` makes Pages serve every file as-is. GitHub Pages serves the `.wasm` runtime
with the right MIME type. The app does not need cross-origin isolation (single-threaded WASM).

## Privacy

There is no backend, no analytics and no tracking. Progress, settings and points live in the
browser's `localStorage`. Speech is recognised on the device: audio never leaves it, except when the
browser's own speech service fills in while the model downloads. The fonts come from Google Fonts
and the speech model from the Hugging Face CDN.

Flag images: [flag-icons](https://github.com/lipis/flag-icons) (MIT). Maps: Natural Earth (public domain).
Landmark photos: Wikimedia Commons (public domain, CC0, CC BY and CC BY-SA), self-hosted and listed with
their authors and licenses in [docs/IMAGE-CREDITS.md](docs/IMAGE-CREDITS.md) and on the in-app
Photo credits screen.

## License

[MIT](LICENSE)
