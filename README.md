# Alphacal

REI, a personal AI fitness companion for iPhone.

| Folder | What it is |
|---|---|
| [`app/`](app/) | The iOS app (Expo + React Native + TypeScript). See [`app/README.md`](app/README.md). |
| [`functions/`](functions/) | Firebase Cloud Functions in asia-south1 (Mumbai). See the table below. |
| [`packages/shared/`](packages/shared/) | Logic used by both: types, prompt, model routing, the numbers each screen shows. |
| `firestore.rules`, `storage.rules` | Each tester can read and write only their own data. |
| [`design/`](design/) | The original interactive prototype. |

### Functions

| Function | What it does |
|---|---|
| `chat` | Streams REI's replies. Quick chat goes to Claude Haiku 4.5; planning and analysis go to Claude Opus 5.5. Logs meals, updates the vow and queues program rebuilds through tools. |
| `mealFromPhoto` | Reads a meal photo with Claude Opus 5.5 and logs the macros. |
| `rebuildProgram`, `weeklyPrograms`, `runJob` | REI writes the training week: on demand, every Sunday at 21:00 IST, and when asked in chat. |
| `coach` | Every 15 minutes, checks each tester and sends a check-in when they slip (late session, over calories, low protein, missed days, bedtime). |
| `tts`, `stt` | Premium voice through ElevenLabs: REI's replies spoken as they stream, and your speech transcribed. |
| `activate` | Grants invited testers access. |

### Food data

The food list ships inside the app, so searching and logging from it is instant and works offline.

- **Indian ingredients:** 542 foods from the Indian Food Composition Tables 2017 (T. Longvah et al., National Institute of Nutrition), via [`@ifct2017/compositions`](https://www.npmjs.com/package/@ifct2017/compositions). Values are per 100 g, mostly raw. Regenerate with `npm --workspace @rei/shared run build:ifct`.
- **Dishes:** about 120 common Indian and everyday dishes in typical home portions (`packages/shared/src/food/dishes.ts`). These are typical estimates. A tester who corrects one saves it as their own food.
- **Packaged foods:** looked up by barcode in [Open Food Facts](https://world.openfoodfacts.org) (open data, ODbL), straight from the phone. Products it lacks are typed in once from the label.
- **Your foods:** favourites, scanned products and saved meals are stored in `users/{uid}/foods`.

When you type a meal, the app first matches it against the list ("2 rotis and dal"). If everything matches, it logs immediately with the list's numbers. Anything it can't place goes to REI, which gets the closest list entries and uses their numbers; it only estimates foods that aren't on the list.

## Set up the backend (one time)

1. **Install** from the repo root: `npm install`, then `npm --prefix functions install`.
2. **Firebase console**, in your project:
   - Upgrade to the **Blaze** plan (Cloud Functions need it).
   - **Authentication** → Sign-in method → enable **Email/Password**.
   - Create **Firestore** and **Storage**, both in **asia-south1 (Mumbai)**.
   - Project settings → Your apps → add a **Web app** and copy its config into `app/.env` (template in `app/.env.example`).
3. **Point the CLI at your project:** `npx firebase login`, then `npx firebase use --add` and pick it.
4. **Store the keys** (they never go in the app):
   - `npx firebase functions:secrets:set ANTHROPIC_API_KEY`
   - `npx firebase functions:secrets:set TTS_API_KEY`: your ElevenLabs key. Until you have one, enter `none`; voice mode then uses the iPhone's voice and keyboard dictation.
   - Optional: set `TTS_VOICE_ID` in `functions/.env.<project-id>` to pick REI's ElevenLabs voice.
5. **Deploy** functions, rules and indexes: `npm run deploy`
6. **Invite testers.** In the console, add a document to the `allowlist` collection whose ID is the tester's email in lowercase. Or from the terminal, after `gcloud auth application-default login`:
   `npm --prefix functions run allow -- --project <project-id> you@example.com friend@example.com`

Then run the app (`npm run app`) and sign up with an invited email.

The chat function keeps one warm instance (`CHAT_MIN_INSTANCES`, default 1) so replies never wait on a cold start. That costs a few dollars a month; set it to 0 in `functions/.env.<project-id>` to save it.

## Local development

```bash
npm run emulators          # Auth, Firestore, Functions, Storage on this machine
```

- Set `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` in `app/.env` to this computer's LAN IP, and invite yourself in the emulator with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm --prefix functions run allow -- --project demo-rei you@example.com`.
- For real REI replies in the emulator, put `ANTHROPIC_API_KEY=...` (and optionally `TTS_API_KEY=...`) in `functions/.secret.local` (git-ignored).
- Scheduled functions (`coach`, `weeklyPrograms`) only run in the emulator if you add `pubsub` to the emulators.

## Checks

```bash
npm run typecheck    # app, shared, functions
npm run lint
npm test             # unit tests
npm run test:rules   # security rules, on the emulator
```
