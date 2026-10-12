# Voice: manual iPad / Safari checklist

Automated tests cover Chromium with a fake microphone (`npm run test:voice`). Safari on
iPad cannot be automated with a real mic, so run this list on the device after deploys that
touch `src/voice/**`.

Setup: open the GitHub Pages URL (https) in Safari. For a local build, use
`npm run dev -- --host` with HTTPS (the mic needs a secure context) and accept the
certificate once. Developer page: `<url>/src/voice/dev/lab.html` (dev server only).

| # | Step | Expected |
|---|------|----------|
| 1 | First visit, open the hub | Mic chip shows "Voice NN%" while the model downloads (~65 MB, one time). The keypad works the whole time. |
| 2 | Tap **Sprint!** | Safari asks for the microphone once, from that tap. No prompt appears in the middle of a round. |
| 3 | Say the answer normally | Accepted in under 1 s after you stop talking. The chip goes listening → hearing → thinking → listening. |
| 4 | Say a wrong answer clearly | Card shows "I heard 54" and the retype step. |
| 5 | Mumble, cough, or say "um" | Nothing is marked wrong. A "?" bubble appears and it keeps listening. |
| 6 | Say "fifty… six" with a pause | Accepted (the partial is merged). |
| 7 | Read the question aloud ("seven times eight") | Not marked wrong. |
| 8 | During a round, switch apps for 10 s, then come back | The mic re-arms by itself, or the chip shows "tap to retry" and one tap fixes it. |
| 9 | Finish the round | The mic indicator in the status bar turns off and speaker volume returns to normal. |
| 10 | Reload the page in airplane mode (after step 1) | Voice still works because the model is cached. |
| 11 | Turn on Low Power Mode, play 3 rounds | No crash or reload, and latency stays under about 1.5 s. |
| 12 | Grown-ups → voice diagnostics | Shows engine `moonshine`, backend `wasm`, and the last transcripts with latencies. |

If the model cannot load (old iPad, storage full), voice falls back to Web Speech (Siri).
That needs Settings → Siri & Search → Siri/Dictation turned on.

## Mic UX v3 (docs/UX-V3.md §4) — verify on the real iPad / iPhone

1. Grown-ups → **Test the microphone** (`#/grownups/mic`): tap *Start test*, say "fifty-six".
   All four ticks must turn green (secure page · mic allowed · I can hear you · heard "56").
   Note the engine line and the delay. Repeat in Safari **and** in the Home-Screen app.
2. **Home-Screen app hypothesis:** in standalone mode `webkitSpeechRecognition` may be missing or
   silent. Expected: the panel never shows "I'm listening" unless audio is confirmed
   (`onaudiostart`); with the model still downloading it shows "Getting my ears ready… N %",
   and after ≤ 2.5 s without audio it falls back (W3) instead of an ear that hears nothing.
3. **Second mic track:** on iOS the Web Speech meter is driven by the recognizer's own events
   (no AnalyserNode track). Check the 5 bars move while he talks during the first session.
4. **Meter:** at normal volume 50 cm from the iPad the bars must clearly move (`data-level` ≥ 0.4).
5. **Background:** start a round, switch apps for 10 s, come back → *Keep going* → the panel
   returns to "I'm listening" within ~1 s and answers are heard.
6. **Fix it:** block the mic (aA → Website Settings → Microphone → Deny), start a round → the
   panel shows "Mic is blocked 🚫 [Fix it] [I'll type]"; the steps shown match the device.
7. **Noisy room:** TV on / fan running: no answer is accepted from the noise alone and
   "Hmm…" never lasts more than 2 s.
