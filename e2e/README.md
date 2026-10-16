# REI end-to-end tests

These run the real app (web build) and the real server code against the local Firebase emulators.
Two test users go through sign-up, email verification and onboarding, then 12 simulated days of meals,
chats, workouts and weigh-ins. Every night the screens are compared with an independent recount from
the raw database, using the app's own shared formulas (`oracle.mts`).

Nothing here touches the production Firebase project. REI's replies, programs and voices are real
(OpenRouter, Fish, ElevenLabs speech-to-text, LiveKit), so runs cost a little.

## One-time setup

```bash
cd e2e && npm install && npx playwright install chromium
voice/make.sh
```

The emulated server needs its keys in `functions/.secret.local` (git-ignored): `OPENROUTER_API_KEY`,
`FISH_API_KEY`, `LIVEKIT_API_SECRET` and `TTS_API_KEY`. Copy `functions/.env.reical-2bba7` to
`functions/.env.local` for its settings. Delete both when you're done.

## Start the backend and the app

Two terminals, from the repo root. The clock file lets the test move the server through the days: only
the function workers read it, so the emulators' own clocks stay real.

```bash
npm --prefix functions run build
REI_CLOCK_FILE=$PWD/e2e/.out/clock-offset NODE_OPTIONS="--require $PWD/e2e/clock.cjs" npx firebase emulators:start --project demo-rei --only auth,firestore,functions,storage
```

```bash
cd app && EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1 npx expo start --web --port 8082
```

Don't set `CI=1` for the app: it turns file watching off, so code changes wouldn't reach the test.

Allow the two testers in the emulator:

```bash
cd functions && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/allow.mjs --project demo-rei hem.e2e@example.com priya.e2e@example.com
```

## The full story (about an hour)

```bash
cd e2e
npm run onboard hem && npm run onboard priya
npm run days 1 12
```

`run.log` and the screenshots land in `e2e/.out/`. Each night prints `CHECK D<n> <user>: OK`, or
`MISMATCH` with the screen value next to the expected one. To start over, wipe the emulators:

```bash
curl -X DELETE "http://127.0.0.1:8080/emulator/v1/projects/demo-rei/databases/(default)/documents"
curl -X DELETE "http://127.0.0.1:9099/emulator/v1/projects/demo-rei/accounts"
```

## Focused checks

The story covers screens and numbers. These repeat one behaviour several times, because REI's replies
vary from run to run. Run from `e2e/`. Trials that import TypeScript run with `npx tsx` from `functions/`.

| Check | Command | What passes |
|---|---|---|
| Meal not logged twice from chat | `node trials/trial-dup.mjs 6` | 0 duplicates |
| Follow-up on plans (calls and chat) | `node trials/trial-cont.mjs 3` | every situation 3/3 |
| Portions (grams vs units) | `node trials/trial-portions.mjs 4` | 0 absurd meals |
| Weight told to REI, plan asked once | `node trials/trial-fixes.mjs` | 3/3 and 0/3 |
| Workout not logged twice from chat | `node trials/trial-workout.mjs` | 12/12 |
| Talking about a meal vs eating it again | `node trials/trial-later.mjs` | 3/3 |
| Target changes saved | `node trials/trial-target.mjs` | 9/9 |
| Programs from their own numbers | `cd ../functions && npx tsx ../e2e/trials/trial-program.mjs` | beginner starts light |
| Tap-to-talk (speech, reply, voice) | `node trials/trial-voice.mjs` (Deepgram key in the environment) | meal logged, audio matches |
| Tone: no narrating, no swearing first | `node trials/trial-tone.mjs` (after other runs) | 0 and 0 |
| Users can't reach each other's data | `npm run isolation` | all PASS |
| Two people, one phone | `npm run same-phone` | clean for the second person |
| Models side by side | `cd ../functions && npx tsx ../e2e/bench-models.mts` | correctness, speed, cost |

## A real live call

This needs the real clock (`echo 0 > .out/clock-offset`) and the deployed LiveKit agent:

```bash
node call-token.mjs voice/call.json
../voice-agent/.venv/bin/python voice_call.py voice/call.json voice/u1.wav voice/u2.wav voice/u3.wav
```

It prints REI's opener, what each side said, the tools REI called, and when REI's voice started. The script
answers REI's tools the way the app does (today's totals after a meal). Set `REI_RECORD=rei.wav` to keep REI's
audio, to check what the voice actually said (the transcript keeps "kcal"; the voice says "calories").

To call agent code that isn't deployed, add `LIVEKIT_AGENT=rei-dev` to `functions/.env.local` before starting the
emulators, and run the agent locally under that name (`REI_STT=soniox` in front to try Soniox):

```bash
cd voice-agent && REI_AGENT_NAME=rei-dev .venv/bin/python agent.py start
```

When restarting it, let the old process exit first (it drains for a few seconds after Ctrl-C and keeps port 8081).
Otherwise the new one fails to start, or a call goes to the one shutting down and the agent joins about 35 s late.
