#!/usr/bin/env python3
"""Adversarial voice clips for tests/voice-adversarial.spec.ts (written to node_modules/.cache/voice-adv).

    python3 -I tests/fixtures/audio/adversarial/generate.py

Voices: several macOS `say` voices, sox pitch/tempo "kid" versions, fast/slow rates.
Writes single words/numbers, syllable pieces ("teen", "tee"), soft-tail and noisy mixes,
and trials.json (what to play, gaps, said value, expected answer, must-accept / must-not).
"""
import json, os, subprocess, sys, tempfile, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../..'))
OUT = os.path.join(ROOT, 'node_modules/.cache/voice-adv')
os.makedirs(OUT, exist_ok=True)
SR = 16000

ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
        'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
def words(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + (' ' + ONES[n % 10] if n % 10 else '')
    r = n % 100
    return 'one hundred' + (' ' + words(r) if r else '')

# id: (say voice, rate, sox effects)
VOICES = {
    'sam': ('Samantha', 170, []),
    'samkid': ('Samantha', 170, ['pitch', '550']),            # higher pitch, same tempo
    'juniorkid': ('Junior', 170, ['speed', '1.25']),           # pitch+tempo up (like generate.py)
    'shelleykid': ('Shelley (English (US))', 160, ['speed', '1.35']),
    'flo': ('Flo (English (US))', 170, []),
    'eddyfast': ('Eddy (English (US))', 280, []),
    'danslow': ('Daniel (English (UK))', 110, []),
    'flokidslow': ('Flo (English (US))', 120, ['pitch', '450']),
}

def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def read(path):
    with wave.open(path, 'rb') as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768

def write(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())

def synth(vid, text):
    name = f"{vid}__{text.replace(' ', '_')}.wav"
    out = os.path.join(OUT, name)
    if os.path.exists(out): return name
    voice, rate, fx = VOICES[vid]
    with tempfile.TemporaryDirectory() as td:
        aiff = os.path.join(td, 'x.aiff'); raw = os.path.join(td, 'x.wav')
        run(['say', '-v', voice, '-r', str(rate), '-o', aiff, text])
        run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, raw])
        run(['sox', raw, '-r', '16000', '-c', '1', '-b', '16', out] + fx + (['rate', '16000'] if fx else []))
    return name

def trim(x, thr_db=-35):
    n = 160
    rms = np.sqrt(np.convolve(x * x, np.ones(n) / n, 'same'))
    peak = rms.max()
    idx = np.where(rms > peak * 10 ** (thr_db / 20))[0]
    return x[max(0, idx[0] - 160): idx[-1] + 160] if len(idx) else x

def mix(name, parts):
    """parts: list of (array, gap_ms_before, gain_db). 300 ms lead/tail silence."""
    out = os.path.join(OUT, name)
    seq = [np.zeros(int(0.3 * SR), np.float32)]
    for a, gap, g in parts:
        seq.append(np.zeros(int(gap / 1000 * SR), np.float32))
        seq.append(a * 10 ** (g / 20))
    seq.append(np.zeros(int(0.5 * SR), np.float32))
    write(out, np.concatenate(seq))
    return name

rng = np.random.default_rng(7)
def pink(n):
    w = rng.standard_normal(n)
    f = np.fft.rfft(w); k = np.arange(len(f)); k[0] = 1
    p = np.fft.irfft(f / np.sqrt(k), n)
    return (p / np.std(p)).astype(np.float32)

def noisy(name, speech_name, kind, snr_db, babble=None):
    out = os.path.join(OUT, name)
    s = read(os.path.join(OUT, speech_name))
    s = np.concatenate([np.zeros(int(0.5 * SR), np.float32), trim(s), np.zeros(int(0.6 * SR), np.float32)])
    sp = trim(read(os.path.join(OUT, speech_name)))
    ps = np.mean(sp ** 2)
    if kind == 'white': nz = rng.standard_normal(len(s)).astype(np.float32)
    elif kind == 'pink': nz = pink(len(s))
    else:  # babble: other speech looped
        b = np.tile(babble, int(np.ceil(len(s) / len(babble)) + 1))[:len(s)]
        nz = b / (np.std(b) + 1e-9)
    nz = nz * np.sqrt(ps / 10 ** (snr_db / 10))
    write(out, s + nz)
    return name

trials = []
def T(cat, files, gaps, said, expected, must_not, note=''):
    trials.append({'cat': cat, 'files': files, 'gaps': gaps, 'said': said, 'expected': expected, 'mustNot': must_not, 'note': note})

# 1. Confusable single numbers: said -> expected (must NOT accept); plus said -> said (should accept)
PAIRS = [(8, 18), (8, 80), (18, 8), (80, 8), (18, 80), (80, 18), (14, 40), (40, 14), (4, 14), (4, 40), (14, 4), (40, 4),
         (13, 30), (30, 13), (3, 13), (15, 50), (50, 15), (5, 15), (16, 60), (60, 16), (16, 6), (60, 6), (6, 16), (6, 60),
         (17, 70), (70, 17), (17, 7), (70, 7), (7, 17), (19, 90), (90, 19), (19, 9), (90, 9), (9, 19), (100, 120),
         (120, 100), (1, 100), (100, 1), (108, 8), (118, 18), (11, 7), (7, 11), (9, 5), (5, 9), (12, 20), (20, 12),
         (106, 6), (64, 4), (56, 6), (48, 8), (88, 8), (88, 80), (66, 60), (77, 70), (114, 140), (140, 114)]
for vid in VOICES:
    said_set = sorted({p[0] for p in PAIRS})
    for n in said_set: synth(vid, words(n))
    for said, exp in PAIRS:
        T('confusable', [synth(vid, words(said))], [], said, exp, True, vid)
    for n in said_set:
        T('correct', [synth(vid, words(n))], [], n, n, False, vid)

# 2. Split words: unit + pause + "teen"/"tee" (a hesitant kid: "six ... teen"), tens + pause + unit
for vid in VOICES:
    for piece in ['teen', 'tee']: synth(vid, piece)
    for unit in [3, 4, 5, 6, 7, 8, 9]:
        u = synth(vid, words(unit))
        for piece, mult in [('teen', 1), ('tee', 2)]:
            said = unit + 10 if mult == 1 else unit * 10
            for gap in [120, 200, 260, 320]:
                T('split-syllable', [u, synth(vid, piece)], [gap], said, unit, True, f'{vid} "{words(unit)}" {gap}ms "{piece}"')
    for first, second, exp, said in [(50, 6, 50, 56), (100, 20, 100, 120), (20, 4, 20, 24), (100, 8, 100, 108), (60, 4, 60, 64),
                                     (1, None, 1, 100), (80, 8, 80, 88), (100, 14, 100, 114)]:
        a = synth(vid, words(first)); b = synth(vid, 'hundred' if second is None else words(second))
        for gap in [150, 250, 320]:
            T('split-number', [a, b], [gap], said, exp, True, f'{vid} "{words(first)}" {gap}ms "{"hundred" if second is None else words(second)}"')

# 3. Soft tail: unit + 40 ms + attenuated "teen"/"tee" (soft unstressed syllable under the VAD threshold)
for vid in ['sam', 'juniorkid', 'flo', 'samkid']:
    for unit in [4, 6, 7, 8, 9, 3, 5]:
        u = trim(read(os.path.join(OUT, synth(vid, words(unit)))))
        for piece, said in [('teen', unit + 10), ('tee', unit * 10)]:
            p = trim(read(os.path.join(OUT, synth(vid, piece))))
            for g in [-18, -26, -34]:
                f = mix(f'soft__{vid}__{unit}_{piece}_{-g}.wav', [(u, 0, 0), (p, 40, g)])
                T('soft-tail', [f], [], said, unit, True, f'{vid} "{words(unit)}"+{piece}@{g}dB')

# 4. Noise: confusables and corrects with white / pink / babble noise
bab = trim(read(os.path.join(OUT, synth('flo', 'the cat sat on the mat and we went to the park today with my friend'))))
for vid in ['sam', 'juniorkid', 'shelleykid']:
    for said, exp in [(16, 6), (60, 6), (14, 40), (40, 14), (18, 8), (80, 8), (17, 7), (19, 9), (50, 15), (15, 50), (100, 120), (6, 16), (8, 18)]:
        for kind, snr in [('white', 15), ('pink', 8), ('babble', 10)]:
            f = noisy(f'noise__{vid}__{said}_{kind}{snr}.wav', synth(vid, words(said)), kind, snr, bab)
            T('noise', [f], [], said, exp, True, f'{vid} {kind}@{snr}dB')
    for n in [6, 7, 8, 14, 18, 40, 56]:
        f = noisy(f'noise__{vid}__{n}_pink8.wav', synth(vid, words(n)), 'pink', 8, bab)
        T('noise-correct', [f], [], n, n, False, f'{vid} pink@8dB')

with open(os.path.join(OUT, 'trials.json'), 'w') as fh:
    json.dump(trials, fh, indent=0)
from collections import Counter
print(len(trials), Counter(t['cat'] for t in trials))
