#!/usr/bin/env python3
"""Generate voice test fixtures with macOS `say` + `afconvert` (16 kHz mono PCM16 WAV).

    python3 -I tests/fixtures/audio/generate.py

Writes clips/*.wav, manifest.json, and mic-*.wav (sequences with silence gaps for the
Chromium fake microphone, which loops the file). "Kid" voices are made by relabelling a
16 kHz clip as 20 kHz (25 % faster + higher pitch) and resampling back to 16 kHz.
"""
import json
import os
import struct
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
CLIPS = os.path.join(HERE, 'clips')
os.makedirs(CLIPS, exist_ok=True)

ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
        'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']


def words(n):
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ('-' + ONES[n % 10] if n % 10 else '')
    r = n % 100
    return ONES[n // 100] + ' hundred' + (' ' + words(r) if r else '')


VOICES = [
    ('samantha', 'Samantha', False),
    ('flo', 'Flo (English (US))', False),
    ('juniorkid', 'Junior', True),
    ('shelleykid', 'Shelley (English (US))', True),
]
NUMBERS = [0, 4, 8, 12, 14, 15, 18, 21, 24, 27, 30, 36, 40, 42, 48, 49, 50, 54, 56, 63, 64, 72, 81, 96, 108, 132, 144]
WORDS = ['cat', 'dog', 'house', 'jump', 'ship', 'red', 'bed', 'because', 'little', 'friend', 'play', 'said', 'water', 'green', 'night', 'school']
SENTENCES = ['The cat sat on the mat.', 'I like to play with my dog.', 'We went to the park today.', 'My friend has a red ball.']
EXTRAS = [  # (id, text, kind, value)
    ('echo-7x8-56', 'seven times eight is fifty six', 'number', 56),
    ('um-56', 'um, fifty six', 'number', 56),
    ('idk', "I don't know", 'none', None),
    ('hmm', 'hmmm', 'none', None),
]


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def kidify(path):
    with open(path, 'rb') as f:
        data = bytearray(f.read())
    # Find "fmt " chunk and rewrite sample rate + byte rate.
    i = data.find(b'fmt ')
    sr, = struct.unpack_from('<I', data, i + 12)
    block_align, = struct.unpack_from('<H', data, i + 20)
    new_sr = int(sr * 1.25)
    struct.pack_into('<I', data, i + 12, new_sr)
    struct.pack_into('<I', data, i + 16, new_sr * block_align)
    tmp = path + '.fast.wav'
    with open(tmp, 'wb') as f:
        f.write(data)
    run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', tmp, path])
    os.remove(tmp)


def synth(voice, text, out, kid, rate=190):
    with tempfile.TemporaryDirectory() as td:
        aiff = os.path.join(td, 'x.aiff')
        run(['say', '-v', voice, '-r', str(rate), '-o', aiff, text])
        run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, out])
    if kid:
        kidify(out)


def main():
    manifest = []
    for vid, voice, kid in VOICES:
        for n in NUMBERS:
            name = f'n{n:03d}_{vid}.wav'
            synth(voice, words(n).replace('-', ' '), os.path.join(CLIPS, name), kid)
            manifest.append({'file': f'clips/{name}', 'kind': 'number', 'value': n, 'voice': vid})
    for vid, voice, kid in VOICES[:2] + VOICES[2:3]:
        for w in WORDS:
            name = f'w_{w}_{vid}.wav'
            synth(voice, w, os.path.join(CLIPS, name), kid, rate=170)
            manifest.append({'file': f'clips/{name}', 'kind': 'word', 'value': w, 'voice': vid})
    for vid, voice, kid in VOICES[:1] + VOICES[2:3]:
        for k, s in enumerate(SENTENCES):
            name = f's{k}_{vid}.wav'
            synth(voice, s, os.path.join(CLIPS, name), kid, rate=170)
            manifest.append({'file': f'clips/{name}', 'kind': 'sentence', 'value': s, 'voice': vid})
        for eid, text, kind, val in EXTRAS:
            name = f'x_{eid}_{vid}.wav'
            synth(voice, text, os.path.join(CLIPS, name), kid)
            manifest.append({'file': f'clips/{name}', 'kind': kind, 'value': val, 'voice': vid, 'text': text})
    with open(os.path.join(HERE, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)

    # Fake-mic sequences: 1 s lead silence, clips separated by 2.5 s, 2 s tail.
    def seq(out, files):
        frames = []
        sr = 16000
        silence = lambda s: b'\x00\x00' * int(sr * s)
        frames.append(silence(1.0))
        for k, fn in enumerate(files):
            with wave.open(os.path.join(HERE, fn), 'rb') as w:
                frames.append(w.readframes(w.getnframes()))
            frames.append(silence(2.5 if k < len(files) - 1 else 2.0))
        with wave.open(os.path.join(HERE, out), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(b''.join(frames))

    seq('mic-numbers.wav', ['clips/n056_samantha.wav', 'clips/n072_juniorkid.wav', 'clips/n144_flo.wav', 'clips/n008_shelleykid.wav', 'clips/n049_samantha.wav'])
    seq('mic-words.wav', ['clips/w_cat_samantha.wav', 'clips/w_house_juniorkid.wav', 'clips/w_jump_flo.wav'])
    print(f'{len(manifest)} clips')


if __name__ == '__main__':
    sys.exit(main())
