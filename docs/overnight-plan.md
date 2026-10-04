# Overnight plan (Oct 4, 2026)

Asked for: no kanji labels in the app (anime-style icons instead), voice per onboarding character, a proper
training page, game layer (ranks, badges, leaderboard, unlock animations), REI that continues the conversation
instead of "what's up?" every time, faster calorie logging, a tidy settings page, a unique look inside the app
(not "AI generated"), sign up / log in first (email + verification) then onboarding, per-user separation,
research on Apple Health and "Hey REI". Screenshots and benchmarks after each round.

Order: things everything else builds on first (icons, navigation, data), then behaviour, then polish.

| # | Work | What "done" means |
|---|------|-------------------|
| 1 | **Icon set** | `components/icons.tsx`: hand-drawn SVG glyphs (ramen bowl = fuel, onigiri, drumstick = protein, rice grain = carbs, droplet = fat, gi + belt = training, katana = strength, sandal = steps, moon = sleep, scroll = vow, torii = home, flame = streak, crest = rank). Every kanji label in the app replaced. Onboarding keeps its manga kanji (chapter art). |
| 2 | **Dojo tab** | A real training page: today's session, quick log (run, walk, ride, sport, gym) on one sheet, this week, training log, rank card. Tab bar: Today · Fuel · REI · Dojo · Vow. |
| 3 | **Game layer** | `packages/shared/src/game.ts` (pure, tested): XP from what's already logged (sessions, protein days, meals, streaks, weigh-ins), ranks, ~16 badges with unlock rules. Badge unlock animation (burst + stamp). Weekly leaderboard in Firestore (`leaderboard/{week}/players/{uid}`, own doc only). |
| 4 | **Settings** | One clean hub with grouped sections that open focused pages: Profile, REI (personality, voice character, live engine), Look, Notifications, Account & data. |
| 5 | **Auth first** | Opening screen: Log in / Sign up. Sign up = email + password, then Firebase sends a verification link; the app waits on "check your inbox" and continues into onboarding once verified. No account step at the end of onboarding. |
| 6 | **REI continuity** | Openers that continue: "welcome back" with what you talked about last, how long ago, and what's open today; never the same opener twice. Applies to live calls (both engines) and the chat screen. Eval script with a conversation-continuity benchmark. |
| 7 | **Voice characters** | Shared list of characters (placeholders until voice IDs arrive), picked in onboarding and Settings; live calls and spoken replies use the character's Fish voice; REI's own voice is the fallback. |
| 8 | **Calorie logging speed** | Measure the current text and photo paths, then: instant estimate from the food list when the meal matches, fast model with calorie anchors for the rest, the slower check only when needed. |
| 9 | **Look** | Bring onboarding's manga language (panels, halftone, speed lines, offset shadows) into the app screens; REI's tomoe as the brand mark. |
| 10 | **Research** | Apple Health (what's there, what it takes) and "Hey REI" (Siri / App Shortcuts / deep links), with what can ship now. Deep links (`rei://live`, `rei://log`) so a Siri Shortcut works today. |
| 11 | **Check** | Tests, typecheck, lint, web screenshots of every screen, functions + rules deployed, live agent redeployed, report. |

## Status (stopped at usage limit)

Done: 1 icons · 2 Dojo · 3 game layer (rules deployed) · 4 settings · 6 continuity (benchmark 12/24 → 23/24, deployed) · 7 voice characters (Fish key set as secret, deployed; voice IDs still placeholders except Naruto).
Night 2 (05 Oct): 5 auth-first done (sign-in restyled, email verification, chapters only after the account exists; activate requires a verified email, deployed) · onboarding restyled with icons, Partner chapter with character hellos · Fuel/Vow restyled earlier · bug round (validator, NaN countdown, double logs, minutes) with 195 shared tests.
Not started: 8 calorie logging speed · 9 restyle Talk in the manga look · 10 Apple Health and "Hey REI" research + deep links · 11 Simulator screenshots of everything.
