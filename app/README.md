# REI · iOS app

REI (零, "zero excuses") is a personal AI fitness companion: a tough-love coach that tracks your training, food and goal and calls you out when you slip. This is the iOS app built from the prototype in [`../design/REI.dc.html`](../design/REI.dc.html).

Built with Expo (React Native + TypeScript) and Expo Router. Data syncs through Firebase, and REI's replies stream from Claude through the backend in [`../functions`](../functions). Setup for the backend is in the [root README](../README.md).

## Screens

| Screen | File | What it does |
|---|---|---|
| Today 今日 | `src/app/(tabs)/index.tsx` | Integrity score, REI's call-out, next directive, today's protocol, week grid, weight trajectory |
| Fuel 食 | `src/app/(tabs)/fuel.tsx` | Calories and macros left, REI's verdict, log a meal in plain words |
| Vow 誓 | `src/app/(tabs)/vow.tsx` | Goal in your words, deadline, body stats, daily targets, disciplines, benchmarks |
| Talk | `src/app/talk.tsx` | Chat with REI. It can log meals and rewrite the vow from the conversation |
| Voice 声 | `src/app/voice.tsx` | Talk to REI; replies are read aloud |
| Session | `src/app/session.tsx` | Today's workout: timer, sets to tick off, live coaching line |
| Settings, Appearance | `src/app/settings.tsx`, `src/app/appearance.tsx` | Intensity, themes (six anime-inspired palettes), accent, typeface, text size, emblem watermark |

## Run it on your iPhone

```bash
cd app
npm install
npm start
```

Install **Expo Go** from the App Store, then scan the QR code from the terminal with the iPhone camera.

With no `.env`, the app runs as an on-device demo with offline replies. To connect it to your Firebase project, copy `.env.example` to `.env` and paste in your web app config. Testers then sign in with email and password, and only emails on the allowlist get in.

## How it stays fast

- **Local-first.** Screens read and write the on-device store, so logging a meal or ticking a set updates within a frame. Firestore syncs in the background and listeners merge changes from other devices.
- **Streamed replies.** `src/lib/api.ts` streams REI's reply from the `chat` function word by word. Quick chat goes to Claude Haiku 4.5; planning and analysis go to Claude Opus 5.5.
- **No key in the app.** The Claude API key lives only in Firebase Secret Manager.

## Build for the App Store

Use EAS (no Mac required):

```bash
npx eas-cli@latest build --platform ios
npx eas-cli@latest submit --platform ios
```

The bundle identifier is `com.alphacal.rei` in `app.json`; change it to one you own before your first build.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

## What's real and what's demo data

Signed in, everything is real and synced: meals, chat, completed sessions, the vow and targets, weigh-ins and settings. The week grid and integrity score come from the sessions you actually logged, and the trajectory from your weigh-ins.

Still to come (see the backend plan): steps and sleep from Apple Health (shown as "no data" until then), the premium voice, AI-written weekly programs, food photos and proactive check-ins.

In demo mode (no account), past days, steps and sleep come from the *Week scenario* setting, as in the prototype.

## Layout

```
src/
  app/          routes (Expo Router)
  components/   Core (animated REI orb), Backdrop, TabBar, Screen, ui primitives
  lib/          theme, firebase (setup), sync (Firestore reads/writes), api (streaming chat client)
  state/        store (local-first state + sync), account (sign-in and tester activation)

../packages/shared   logic shared with the backend: types, data, derive (screen numbers and copy), rei (prompt), route
```
