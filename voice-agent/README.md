# REI live voice agent (LiveKit + Fish)

Our own live voice engine, an alternative to the ElevenLabs agent, at a fraction of the per-minute cost:
Deepgram Flux listens and decides when you've finished talking, OpenRouter thinks (the same fast models as chat), Fish Audio speaks.

How a call works:

1. The app calls the `voiceSession` Cloud Function with `engine: 'livekit'` (Settings → Live voice engine → Fish).
2. The function returns a LiveKit join token for a fresh room. The token dispatches the `rei` agent with the
   session baked in (prompt, greeting, Fish voice, models and tool schemas), gzipped.
3. The agent joins, greets the user and talks. Its tools (log meal, log workout, update vow, remember,
   rebuild program) run on the phone over LiveKit RPC, through the same code as the ElevenLabs engine.
4. Calls are capped at 10 minutes; the function caps calls per day.

## Setup

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env.local   # then fill in the keys
```

On an Intel Mac, the `silero` plugin (voice activity, for snappier cut-ins) can't install: there's no onnxruntime
build. The agent works without it; Flux's own speech events handle interruptions. Install the rest without it:

```bash
.venv/bin/pip install "livekit-agents[deepgram,openai]==1.8.4" livekit-plugins-fishaudio==1.8.4 python-dotenv
```

## Check, run, deploy

```bash
.venv/bin/python test_agent.py          # the spoken-text cleaner
.venv/bin/python fish_check.py          # Fish key + voice: time to first audio, saves fish-check.mp3
.venv/bin/python agent.py dev           # run locally against LiveKit Cloud (stop the cloud agent first, or calls split)
```

Deployed on LiveKit Cloud as agent `CA_YcpzaXWLKKGj` in ap-south (see `livekit.toml`). `lk cloud auth` doesn't
take input in the app's terminal, so the CLI reads the project keys from `.env.local` instead:

```bash
grep -v '^LIVEKIT_' .env.local > .env.cloud      # cloud secrets: LiveKit adds its own LIVEKIT_* vars
set -a && source .env.local && set +a && lk agent deploy .                              # new version
set -a && source .env.local && set +a && lk agent update-secrets --secrets-file .env.cloud  # changed keys
set -a && source .env.local && set +a && lk agent logs                                  # tail the cloud agent
```
