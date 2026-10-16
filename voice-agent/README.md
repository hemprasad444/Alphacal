# REI live voice agent (LiveKit + Fish)

REI's live voice engine:
Deepgram Flux or Soniox listens and decides when you've finished talking (`REI_STT`), OpenRouter thinks (the same
fast models as chat), Fish Audio speaks. Soniox also hears Hindi and Telugu mixed into English, and Indian food names.

How a call works:

1. The app calls the `voiceSession` Cloud Function, listing the actions it can carry out.
2. The function returns a LiveKit join token for a fresh room. The token dispatches the `rei` agent with the
   session baked in (prompt, greeting, Fish voice, models and tool schemas), gzipped.
3. The agent joins, greets the user and talks. Its tools (log meal, log workout, update vow, remember,
   forget, rebuild program) run on the phone over LiveKit RPC (app/src/components/LiveVoice.tsx).
4. Calls are capped at 10 minutes; the function caps calls per day.

## Setup

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env.local   # then fill in the keys
```

On an Intel Mac, the `silero` plugin (voice activity, for snappier cut-ins) can't install: there's no onnxruntime
build. The agent works without it; the STT's own speech events handle interruptions. Install the rest without it:

```bash
.venv/bin/pip install "livekit-agents[deepgram,openai,soniox]==1.8.4" livekit-plugins-fishaudio==1.8.4 python-dotenv
```

## Check, run, deploy

```bash
.venv/bin/python test_agent.py          # the spoken-text cleaner and the early end-of-turn signal
.venv/bin/python fish_check.py          # Fish key + voice: time to first audio, saves fish-check.mp3
REI_AGENT_NAME=rei-dev .venv/bin/python agent.py start   # a local agent next to the cloud one
```

A local agent registers under its own name, so it never takes real calls. Point the emulated `voiceSession` at it
with `LIVEKIT_AGENT=rei-dev` in `functions/.env.local`, then call it with `e2e/voice_call.py` (see `e2e/README.md`).
Add `REI_STT=soniox` in front to try the other listener; in `.env.local` it sets the cloud agent's listener too, at
the next secrets update. Never put `REI_AGENT_NAME` in `.env.local`: the cloud agent would stop answering real calls.

Deployed on LiveKit Cloud as agent `CA_YcpzaXWLKKGj` in ap-south (see `livekit.toml`). `lk cloud auth` doesn't
take input in the app's terminal, so the CLI reads the project keys from `.env.local` instead:

```bash
grep -v '^LIVEKIT_' .env.local > .env.cloud      # cloud secrets: LiveKit adds its own LIVEKIT_* vars
set -a && source .env.local && set +a && lk agent deploy .                              # new version
set -a && source .env.local && set +a && lk agent update-secrets --secrets-file .env.cloud  # changed keys
set -a && source .env.local && set +a && lk agent logs                                  # tail the cloud agent
```
