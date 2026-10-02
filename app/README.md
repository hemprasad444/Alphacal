# REI · iOS app

REI (零, "zero excuses") is a personal AI fitness companion: a tough-love coach that tracks your training, food and goal and calls you out when you slip. This is the iOS app built from the prototype in [`../design/REI.dc.html`](../design/REI.dc.html).

Built with Expo (React Native + TypeScript) and Expo Router. REI's replies come from Claude.

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

## Connect REI to Claude

Without configuration REI answers from built-in offline replies, so the whole app works with no setup. To get real replies, copy `.env.example` to `.env` and set one of:

- `EXPO_PUBLIC_REI_API_URL`: a small proxy you host that forwards `POST /v1/messages` to the Claude API and adds your API key on the server. Use this for any build that leaves your hands.
- `EXPO_PUBLIC_ANTHROPIC_API_KEY`: calls Claude directly from the phone. **Development only**: anything prefixed `EXPO_PUBLIC_` is bundled into the app and can be extracted.

Requests use `claude-opus-5-5` at low effort (short, fast chat replies), with server-side refusal fallback enabled. See `src/lib/claude.ts`.

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

Real and saved on the device: meals you log, chat history, sessions you complete, your vow, targets and all settings. A new day starts with an empty food log.

Demo for now:

- **Earlier days this week, steps and sleep** come from the *Week scenario* setting (Slipping or Strong), as in the prototype.
- **Weigh-in history** is a fixed list of past weights (`WEIGHT_HISTORY` in `src/lib/data.ts`).

Natural next steps:

- Read steps, sleep and weight from Apple Health.
- Keep a real per-day history so the week grid and integrity score come from what you actually did.
- Add on-device speech recognition so voice mode hears you directly. Today you dictate with the keyboard mic, and REI speaks its replies.
- Send proactive check-in notifications.
- Add a chat portrait for REI. The design has an image slot for one; the app shows the theme's kanji for now.

## Layout

```
src/
  app/          routes (Expo Router)
  components/   Core (animated REI orb), Backdrop, TabBar, Screen, ui primitives
  lib/          theme, data, derive (all screen numbers and copy), rei (prompt + parsing), claude (API client)
  state/        store: app state, persisted with AsyncStorage
```
