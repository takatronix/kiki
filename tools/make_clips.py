#!/usr/bin/env python
"""Make the 「シェード」 clips with Kokoro-82M (the page only plays the files).
One clip per button = the whole KiKi sequence: "Hello KiKi" + WAIT seconds of silence (KiKi answers "I'm here")
+ the command (clips/commands.json). Voice af_heart, mono 24 kHz MP3 (the Tesla's Chromium plays MP3),
loudness-normalised. Writes clips/<id>.mp3 for every id that has no clip yet (--all: every id).
Run (farm3):  HF_HUB_CACHE=~/tts-work/kokoro/models ~/tts-work/kokoro/.venv/bin/python tools/make_clips.py [--all]"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

SR = 24000
WAIT = 2.2
VOICE = "af_heart"
OUT = Path(__file__).resolve().parent.parent / "clips"
FFMPEG = str(Path.home() / ".local/bin/ffmpeg")
CAT = json.loads((OUT / "commands.json").read_text())
# misaki reads "KiKi" as two letters ("kai kai"); the manual's reading is キキ. Cyan as in its サイアン.
PRON = {"KiKi": "[KiKi](/kˈiki/)", "cyan": "[cyan](/sˈIˌæn/)"}


def trim(a, thr=0.01, pad=0.05):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx):
        return a
    p = int(SR * pad)
    return a[max(0, idx[0] - p):idx[-1] + p]


def say(pipe, text):
    for w, ph in PRON.items():
        text = text.replace(w, ph)
    # a full stop gives every phrase a falling end, as a person says it
    a = np.concatenate([c[2].numpy() for c in pipe(text + ".", voice=VOICE) if c[2] is not None])
    return trim(a.astype(np.float32))


def to_mp3(a, dst):
    with tempfile.NamedTemporaryFile(suffix=".wav") as t:
        sf.write(t.name, a, SR)
        subprocess.run([FFMPEG, "-loglevel", "error", "-y", "-i", t.name, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                        "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "48k", str(dst)], check=True)


def main():
    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    wake = say(pipe, CAT["wake"])
    gap = np.zeros(int(SR * WAIT), np.float32)
    made = 0
    for cid, text in CAT["commands"].items():
        dst = OUT / f"{cid}.mp3"
        if dst.exists() and "--all" not in sys.argv:
            continue
        to_mp3(np.concatenate([wake, gap, say(pipe, text)]), dst)
        made += 1
    print(made, "clips made,", len(CAT["commands"]), "in all")


if __name__ == "__main__":
    main()
