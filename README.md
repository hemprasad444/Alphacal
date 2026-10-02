# Alphacal

REI, a personal AI fitness companion for iPhone.

| Folder | What it is |
|---|---|
| [`app/`](app/) | The iOS app (Expo + React Native + TypeScript). See [`app/README.md`](app/README.md). |
| [`functions/`](functions/) | Firebase Cloud Functions in asia-south1 (Mumbai): `chat` streams REI's replies from Claude; `activate` admits invited testers. |
| [`packages/shared/`](packages/shared/) | Logic used by both: types, prompt, model routing, the numbers each screen shows. |
| `firestore.rules`, `storage.rules` | Each tester can read and write only their own data. |
| [`design/`](design/) | The original interactive prototype. |

## Set up the backend (one time)

1. **Install** from the repo root: `npm install`, then `npm --prefix functions install`.
2. **Firebase console**, in your project:
   - Upgrade to the **Blaze** plan (Cloud Functions need it).
   - **Authentication** → Sign-in method → enable **Email/Password**.
   - Create **Firestore** and **Storage**, both in **asia-south1 (Mumbai)**.
   - Project settings → Your apps → add a **Web app** and copy its config into `app/.env` (template in `app/.env.example`).
3. **Point the CLI at your project:** `npx firebase login`, then `npx firebase use --add` and pick it.
4. **Store the Claude key** (it never goes in the app): `npx firebase functions:secrets:set ANTHROPIC_API_KEY`
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
- For real REI replies in the emulator, put `ANTHROPIC_API_KEY=...` in `functions/.secret.local` (git-ignored).

## Checks

```bash
npm run typecheck    # app, shared, functions
npm run lint
npm test             # unit tests
npm run test:rules   # security rules, on the emulator
```
