# REI's brain: what is computed, what the model does, and how it is measured

15 November 2026. Baseline: commit `f4e93ed`.

REI used to be handed a few numbers and left to work out the rest: the weekday, how long until the
session, what is left after a meal, how many calories are in two rotis. Models get those wrong often
enough to matter. Now everything that can be computed is computed by the app and given to REI as text,
and the model is used for what needs language and judgement: understanding what was said, deciding
whether it calls for an action, and saying it in REI's voice.

## What is computed now

| Was the model's job | Now |
|---|---|
| Today's date, weekday, time of day (the prompt had no year) | `FACTS` block, from the user's own clock (`packages/shared/src/facts.ts`) |
| Days to the deadline, day of the vow, minutes until or since the session, time since the last meal | `FACTS` |
| What is left today after what's logged; yesterday's meals; the last workout | `FACTS` |
| "Next Friday" as a date | `COMING DAYS` in `FACTS`; and a plain "move my deadline to Friday" is parsed without the model (`vowText.ts`) |
| Calories and macros of a meal | The food list (IFCT, USDA, dishes) wherever it has the food; the model's estimate only for the rest, marked by an empty food id |
| What is left after the meal just eaten | `MEAL MATH` block, added up before the model answers (`functions/src/chat/brain.ts`) |
| What to eat next, what to do next | `SUGGESTIONS` block from rules (`recommend.ts`): 2-3 meals with portions and macros from the food list, plus the next training action |
| How long a workout was, when they didn't say | Never guessed: not logged, and REI asks (`groundWorkout` in `workout.ts`) |
| A target change the model only talked about | Applied from the user's own words (`vowFromText`) |

After the model answers, its tool calls are checked against what was actually said (`interpret` in
`brain.ts`), and its words are checked against what was actually stored: any calorie or protein figure in
a reply about a logged meal must be one the app computed (`looseFigures`), or the reply is redone.

## The eval

`e2e/eval-brain.mts`: one fixed user at one fixed moment (Sunday 15 November 2026, 14:05; 740 kcal and
32 g protein eaten of 2100 and 150; calisthenics at 18:30; deadline 31 December), and 27 messages that
each have one right outcome. It runs the same `prepare` → model → `interpret` → second-pass code the chat
endpoint runs, and judges what would be stored and said, not the wording.

```bash
cd functions && OPENROUTER_API_KEY=... npx tsx ../e2e/eval-brain.mts            # both fast models, 2 runs
cd functions && OPENROUTER_API_KEY=... npx tsx ../e2e/eval-brain.mts --runs 3 --models openai/gpt-6-luna --verbose
cd functions && OPENROUTER_API_KEY=... npx tsx ../e2e/eval-live.mts             # the live call's model
```

About $0.03 a run on GPT-6 Luna, $0.17 on Gemini 3.8 Flash, $0.01 for the live eval.

The cases: meals in English, Hinglish, Hindi and Telugu, a restaurant plate, a shake, the Fuel screen;
"when's my workout", "how long until it", the date, days to the deadline, time since the last meal,
what I ate today and yesterday, what's left; what to eat (a vegetarian who eats no eggs; in Hinglish);
changing a target, a deadline in words, a weigh-in; "log my snack" with no food, a walk with no
duration, a walk with one, a pizza only being considered, a lunch already logged; a remembered
allergy; a question in Hindi.

## Results

Chat, replies right out of all replies (cases right on every run out of 27):

| Model | Before | After | First word | Prompt tokens | Cost per reply |
|---|---|---|---|---|---|
| `openai/gpt-6-luna` (first choice), 3 runs | 62/81 (18/27) | **81/81 (27/27)** | 1.07 s → 1.05 s | 1718 → 2893 | $0.00022 → $0.00034 |
| `google/gemini-3.8-flash` (fallback), 2 runs | 44/54 (21/27) | **54/54 (27/27)** | 1.88 s → 2.01 s | 1780 → 3109 | $0.0020 → $0.0032 |

Live call (`openai/gpt-oss-120b` on Groq, 8 cases, 5 runs): 34/40 → **40/40**; median reply 444 ms → 472 ms;
prompt 2167 → 3293 tokens.

What failed before, on both chat models unless noted:

| Case | Before | Why |
|---|---|---|
| Days to the deadline | never right: "411 days" (it is 46) | The prompt said "now Sun 15 Nov" with no year, so the model assumed last year |
| Meal told in Hindi or Telugu | never logged | Only English words counted as "they ate", so the safety check refused every such meal |
| What did I eat yesterday | "I only have today's meals" | Yesterday was not in the prompt |
| Numbers in a meal reply | "1,010 left" beside a logged 274 kcal (1,086 left) | The model writes its reply before the meal is added up from the food list |
| "Change my protein target to 160" | changed about half the time (Luna) | The model said "Protein target set to 160 g" and made no call |
| A long walk, no duration | logged as 45 or 60 minutes about 1 run in 10 in chat, 2 in 9 on a call | The tool required minutes, so the model made them up |
| Deadline "this coming Friday" | once written as 2020-11-20 (Gemini) | No year in the prompt |
| What to eat (vegetarian) | once "128 g protein left" (it is 118) | The model's own subtraction |

Found while building the "after" and fixed before it was measured: "what did I eat yesterday?" logged
yesterday's whole day as a meal today; "log my snack" logged REI's own suggestion; the model sometimes
writes a tool call out as text.

## What it costs

- Prompt: about 1,150 more tokens a message, in roughly equal parts the facts, the suggestions and longer
  rules (plus the meal math when the message is a meal). On GPT-6 Luna that is $0.00012 more a reply.
  Time to the first word did not move.
- Second passes, each one more fast-model call (about a second, after the reply has streamed), only when needed:
  a meal reply with a figure the app didn't compute (mostly meals in Hindi or Telugu script, or with a
  food the list lacks), a workout with no duration, a meal with no food named, a target changed by rule,
  "noted" or "logged" said without the call.
- The live call's join token carries the prompt: about 8.3 KB → 11 KB. `voiceSession` logs `tokenBytes`.

## Models

Kept as they are. GPT-6 Luna first for quick chat: half the time to first word of Gemini 3.8 Flash and a
tenth of its cost, and with the computed facts both now pass every case. The fallback order stays
Luna → Gemini. No change to the deep, program, photo or live models.

## Known limits

- A meal typed in Hindi or Telugu script is still read by the model; the food list is then looked up by
  the English names the model gives. A food the list lacks keeps the model's estimate (its item has no food id).
- The eval is 27 cases at one moment for one user. It is a regression check, not proof.
- On calls, the duration check and the food-list items run on the phone, so they need an app build that
  has them. Older builds get the new prompt and tool descriptions only.
- Suggestions are built from 39 fixed everyday meals. Diet and allergies come from what REI remembers;
  a restriction nobody told REI isn't respected.
