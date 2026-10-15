"""Checks the Fish Audio key and voice before anything deploys: time to first audio, total time, and a clip to listen to.

    .venv/bin/python fish_check.py ["[laughs] Yo, what's good? Ready to lift?"]
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv(".env.local")

key = os.environ.get("FISH_API_KEY")
voice = os.environ.get("FISH_VOICE_ID", "6870e7b6e1f54a0a9d6a4c29b7ac7105")
model = os.environ.get("FISH_MODEL", "s2.1-pro-free")
text = sys.argv[1] if len(sys.argv) > 1 else "[laughs] Yo, what's good? You hit legs today or are we skipping again? [whispers] Don't lie to me."
if not key:
    sys.exit("FISH_API_KEY is missing: add it to voice-agent/.env.local")

body = json.dumps({"text": text, "reference_id": voice, "format": "mp3", "latency": "balanced"}).encode()
req = urllib.request.Request(
    "https://api.fish.audio/v1/tts",
    data=body,
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "model": model},
)
t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=60) as res:
        first = res.read(1024)
        ttfa = time.time() - t0
        audio = first + res.read()
except urllib.error.HTTPError as e:
    sys.exit(f"Fish said {e.code}: {e.read().decode(errors='replace')[:300]}")
total = time.time() - t0
out = os.path.abspath("fish-check.mp3")
with open(out, "wb") as f:
    f.write(audio)
print(f"model {model} · voice {voice}")
print(f"first audio {ttfa * 1000:.0f} ms · done {total * 1000:.0f} ms · {len(audio) // 1024} KB")
print(f"saved {out}  (play: afplay {out})")
