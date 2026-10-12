#!/usr/bin/env python3
"""Background-noise beds for the voice robustness e2e (tests/voice-robustness.spec.ts).

    python3 -I tests/fixtures/audio/noise/generate.py [OUT_DIR]

Needs macOS `say` + `afconvert` and `sox`. Writes 16 kHz mono PCM16 WAVs (default OUT_DIR:
node_modules/.cache/voice-noise, so nothing large is committed):

  fan.wav      steady brown/pink noise (a fan or air conditioner)
  tv.wav       one far-away adult voice reading news + a quiet music bed (TV in the next room)
  chatter.wav  four overlapping voices talking at once (a busy kitchen)
  silence.wav  digital silence (control)

Each bed is 8 s long and normalised to -26 dBFS RMS; the spec mixes answers on top at a known
level, so "noise only" must never be accepted and "answer + noise" should still be.
"""
import os
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, 'node_modules', '.cache', 'voice-noise')
os.makedirs(OUT, exist_ok=True)
DUR = 8.0

NEWS = [
    'Good evening. Tonight the city council met to discuss the new bridge, and the weather will be cloudy with light rain.',
    'In sports, the home team won again, and fans are already lining up for tickets to the final game next week.',
]
CHAT = [
    ('Samantha', 'Did you remember to buy milk? We need it for the pancakes tomorrow morning.'),
    ('Fred', 'I think the game starts after dinner, so we should leave a little early to find parking.'),
    ('Karen', 'My sister is coming over on Sunday with the kids, they love the new playground.'),
    ('Daniel', 'Can you pass me the salt? This soup is really good, where did you get the recipe?'),
]


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def say(voice, text, out, rate=180):
    with tempfile.TemporaryDirectory() as td:
        aiff = os.path.join(td, 'x.aiff')
        try:
            run(['say', '-v', voice, '-r', str(rate), '-o', aiff, text])
        except subprocess.CalledProcessError:
            run(['say', '-r', str(rate), '-o', aiff, text])
        run(['sox', aiff, '-r', '16000', '-c', '1', '-b', '16', out])


def norm(src, dst, db=-26):
    # Pad/trim to DUR, then set RMS to `db` dBFS (sox `gain -n` peak-normalises; use stats for RMS).
    tmp = dst + '.tmp.wav'
    run(['sox', src, '-r', '16000', '-c', '1', '-b', '16', tmp, 'trim', '0', str(DUR), 'pad', '0', str(DUR)])
    run(['sox', tmp, dst, 'trim', '0', str(DUR)])
    out = subprocess.run(['sox', dst, '-n', 'stats'], capture_output=True, text=True).stderr
    rms = next((float(l.split()[-1]) for l in out.splitlines() if l.startswith('RMS lev dB')), -30.0)
    run(['sox', dst, tmp, 'gain', str(db - rms)])
    os.replace(tmp, dst)


def main():
    with tempfile.TemporaryDirectory() as td:
        # Fan: brown + a little pink noise, gentle low-pass.
        raw = os.path.join(td, 'fan.wav')
        run(['sox', '-n', '-r', '16000', '-c', '1', '-b', '16', raw, 'synth', str(DUR), 'brownnoise', 'synth', str(DUR), 'pinknoise', 'mix', 'lowpass', '1800'])
        norm(raw, os.path.join(OUT, 'fan.wav'), -28)

        # TV: a news reader + a soft chord bed, reverberant and band-limited (through a wall).
        parts = []
        for i, t in enumerate(NEWS):
            p = os.path.join(td, f'news{i}.wav')
            say('Fred' if i % 2 == 0 else 'Karen', t, p, 175)
            parts.append(p)
        news = os.path.join(td, 'news.wav')
        run(['sox', *parts, news])
        music = os.path.join(td, 'music.wav')
        run(['sox', '-n', '-r', '16000', '-c', '1', '-b', '16', music, 'synth', str(DUR), 'sine', '220', 'sine', '277', 'sine', '330', 'tremolo', '3', '40', 'vol', '0.08'])
        tv = os.path.join(td, 'tv.wav')
        run(['sox', '-m', news, music, tv, 'highpass', '200', 'lowpass', '3500', 'reverb', '40'])
        norm(tv, os.path.join(OUT, 'tv.wav'), -27)

        # Chatter: four voices at once, slightly offset.
        voices = []
        for i, (v, t) in enumerate(CHAT):
            p = os.path.join(td, f'c{i}.wav')
            say(v, t, p, 190)
            q = os.path.join(td, f'c{i}p.wav')
            run(['sox', p, q, 'pad', str(0.35 * i), '0', 'vol', '0.7'])
            voices.append(q)
        chat = os.path.join(td, 'chat.wav')
        run(['sox', '-m', *voices, chat, 'reverb', '30'])
        norm(chat, os.path.join(OUT, 'chatter.wav'), -26)

        run(['sox', '-n', '-r', '16000', '-c', '1', '-b', '16', os.path.join(OUT, 'silence.wav'), 'trim', '0', str(DUR)])
    print(OUT)


if __name__ == '__main__':
    main()
