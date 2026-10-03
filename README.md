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
| `chat` | Streams REI's replies. Quick chat and planning use the models set per job (see below). Logs meals, updates the vow, remembers lasting facts (diet, injuries, schedule) and queues program rebuilds through tools. |
| `mealFromPhoto` | Reads a meal photo with a vision model and logs the macros. |
| `rebuildProgram`, `weeklyPrograms`, `runJob` | REI writes the training week: on demand, every Sunday at 21:00 IST, and when asked in chat. |
| `weeklyReports`, `weeklyReport` | REI's weekly report: every Sunday at 20:30 IST (before the next week is planned), or on demand from Progress. |
| `coach` | Every 15 minutes, checks each tester and sends a check-in when they slip (late session, over calories, low protein, missed days, bedtime). |
| `tts`, `stt` | Premium voice through ElevenLabs: REI's replies spoken as they stream, and your speech transcribed. |
| `activate` | Grants invited testers access. |

### Food and exercise data

The food list and exercise library ship inside the app, so searching and logging from it is instant and works offline.

- **Indian ingredients:** 542 foods from the Indian Food Composition Tables 2017 (T. Longvah et al., National Institute of Nutrition), via [`@ifct2017/compositions`](https://www.npmjs.com/package/@ifct2017/compositions). Values are per 100 g, mostly raw. Regenerate with `npm --workspace @rei/shared run build:ifct`.
- **Dishes:** 400 Indian (by region) and everyday dishes in typical home portions (`packages/shared/src/food/dishes.ts`). These are typical estimates. A tester who corrects one saves it as their own food.
- **Packaged foods:** looked up by barcode in [Open Food Facts](https://world.openfoodfacts.org) (open data, ODbL), straight from the phone. Products it lacks are typed in once from the label.
- **Your foods:** favourites, scanned products and saved meals are stored in `users/{uid}/foods`.

- **More foods:** 5,937 foods from USDA FoodData Central SR Legacy (public domain), as packaged in [`tempo-food-db`](https://www.npmjs.com/package/tempo-food-db) by TempoLife (CC-BY-4.0: "Food nutrition data from TempoLife, tempolife.app"). Ranked below the Indian lists. Regenerate with `npm --workspace @rei/shared run build:usda`.
- **Sports and activities:** about 70 with MET values from the Compendium of Physical Activities (Ainsworth et al.); calories ≈ MET × weight × hours.
- **Exercises:** 876 exercises with muscles, equipment, form steps and photos from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain). The data ships in the app. `npm run deploy` also builds 360 px WebP thumbnails into `hosting/exercises/` and serves them from Firebase Hosting with a one-year cache; set `EXPO_PUBLIC_IMAGES_BASE_URL=https://<project-id>.web.app/exercises` in `app/.env` to use them (otherwise photos load from GitHub). Regenerate it with `npm --workspace @rei/shared run build:exercises -- <exercises.json>`.

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
   - `npx firebase functions:secrets:set OPENROUTER_API_KEY`: one OpenRouter key for every model.
   - `npx firebase functions:secrets:set TTS_API_KEY`: your ElevenLabs key. Until you have one, enter `none`; voice mode then uses the iPhone's voice and keyboard dictation.
   - Optional: set `TTS_VOICE_ID` in `functions/.env.<project-id>` to pick REI's ElevenLabs voice.
   - Optional: choose the model for each job in `functions/.env.<project-id>` with `LLM_FAST`, `LLM_DEEP`, `LLM_PHOTO`, `LLM_PROGRAM` and `LLM_REPORT`. Each takes an [OpenRouter model id](https://openrouter.ai/models), or a comma-separated list where later models answer if the first fails (defaults are in `functions/src/llm.ts`).
5. **Deploy** functions, rules and indexes: `npm run deploy`
6. **Invite testers.** In the console, add a document to the `allowlist` collection whose ID is the tester's email in lowercase. Or from the terminal, after `gcloud auth application-default login`:
   `npm --prefix functions run allow -- --project <project-id> you@example.com friend@example.com`

Then run the app (`npm run app`) and sign up with an invited email.

The chat function keeps one warm instance (`CHAT_MIN_INSTANCES`, default 1) so replies never wait on a cold start. That costs a few dollars a month; set it to 0 in `functions/.env.<project-id>` to save it.

## Speed

- **Local-first.** Every screen reads data already on the phone. Each part of the state (settings, meals, sessions…) is saved separately, in SQLite on the phone (`app/src/lib/sliceStore.native.ts`) and in browser storage on web, so a change writes only what it touched. Firestore syncs in the background.
- **Small redraws.** Components subscribe to the slice they show (`useStore(s => s.accent)`), and REI's streaming reply updates only its own bubble, at most once a frame. Long lists (chat, exercise library, training log) render only the rows on screen.
- **Search.** Food and exercise indexes are built right after the first screen draws; a keystroke scores only foods that can reach the top results.
- **Budgets in CI.** `.github/workflows/ci.yml` runs typecheck, lint, unit tests, speed budgets (`packages/shared/src/__tests__/perf.test.ts`), rules tests and a 5 MB bundle check (`npm run check:bundle`).

## Local development

```bash
npm run emulators          # Auth, Firestore, Functions, Storage on this machine
```

- Set `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` in `app/.env` to this computer's LAN IP, and invite yourself in the emulator with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm --prefix functions run allow -- --project demo-rei you@example.com`.
- For real REI replies in the emulator, put `OPENROUTER_API_KEY=...` (and optionally `TTS_API_KEY=...`) in `functions/.secret.local` (git-ignored).
- Scheduled functions (`coach`, `weeklyPrograms`) only run in the emulator if you add `pubsub` to the emulators.

## Checks

```bash
npm run typecheck    # app, shared, functions
npm run lint
npm test             # unit tests
npm run test:rules   # security rules, on the emulator
```
