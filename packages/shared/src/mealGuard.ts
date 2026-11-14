// A safety net for meals REI logs from a chat message: the model sometimes re-logs a meal from
// earlier in the conversation ("going to a movie" logged the lunch again). A meal is only stored
// when the message itself talks about eating or names the food, and never twice in a row by
// accident. Logging from the Fuel screen doesn't go through this: there, logging is the intent.
import type { Meal, SessionLog } from './types';

const EATING_EN = /\b(ate|eat|eating|eaten|had|have|having|drank|drink|drinking|finished|grabbed|ordered|munch\w*|snack\w*|breakfast|brunch|lunch|dinner|supper|meal|food|cooked|devoured|demolished|smashed)\b/i;
/** The same in romanised Hindi, Telugu and Tamil ("2 roti khayi", "idli tinnanu", "dosa sapten"). */
const EATING_ROMAN = /\b(kha(?:ya|yi|ye|a|na)?|kha (?:liya|li|rah\w+)|piya|piyi|pi (?:liya|li)|nashta|nashte|tinna\w*|thinna\w*|taga\w*|tagaanu|sap(?:t|p)\w+|saapt\w+|kudicha\w*)\b/i;
/**
 * And in their own scripts (Hindi, Marathi, Telugu, Tamil, Kannada, Malayalam, Bengali, Gujarati): a meal
 * told to REI in Hindi was never logged, because only English words counted as "they ate".
 */
const EATING_SCRIPT = /खा|पी लि|पिया|पी ली|नाश्ता|भोजन|తిన్న|తిన|తాగ|భోజన|టిఫిన్|சாப்பி|குடி|ತಿಂದ|ಕುಡಿ|ಊಟ|കഴിച്ച|കുടിച്ച|খেয়ে|খেলাম|খাই|ખાધ|પીધ/;
const EATING = { test: (s: string) => EATING_EN.test(s) || EATING_ROMAN.test(s) || EATING_SCRIPT.test(s) };
/** They point at a meal REI already knows of rather than naming the food. */
const REFERS = /\b(usual|same|again|another|leftovers?|rest of|that|those|this|these|it|them|yesterday|earlier|before|regular|normal|wahi|same hi)\b/i;
const AGAIN =/\b(another|again|more|second|2nd|one more|seconds|extra|also)\b/i;
const STOP = new Set(['and', 'the', 'with', 'from', 'for', 'some', 'cup', 'cups', 'bowl', 'plate', 'piece', 'pieces', 'slice', 'slices', 'glass', 'serving', 'small', 'large', 'medium', 'half', 'full', 'home', 'style', 'cooked', 'fried', 'boiled', 'raw', 'office', 'canteen', 'breakfast', 'brunch', 'lunch', 'dinner', 'supper', 'snack', 'snacks', 'meal', 'food']);

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w)));
/** "rotis" and "roti", "eggs" and "egg" are the same word here. */
const stem = (w: string) => w.replace(/(es|s)$/, '');

/** Food words from the meal's items (the foods themselves), or its name when it has no items. */
function mealWords(meal: Pick<Meal, 'name' | 'items'>): Set<string> {
  // Not the name when there are items: the model names re-logged meals after the chat ("Movie outing").
  const names = meal.items?.length ? meal.items.map(i => i.name).join(' ') : meal.name;
  return new Set([...words(names)].map(stem));
}

const sameMeal = (a: Meal, b: Meal) => {
  const wa = mealWords(a), wb = mealWords(b);
  const shared = [...wa].filter(w => wb.has(w)).length;
  return shared > 0 && shared >= Math.min(wa.size, wb.size) / 2 && Math.abs(a.kcal - b.kcal) <= Math.max(a.kcal, b.kcal) * 0.35;
};

/** The message talks about eating or drinking something ("had", "ate", "lunch", "khaya", "खाया"). */
export const mentionsEating = (message: string) => EATING.test(message);

/** The most meals one day holds (the database rules allow the same). */
export const MAX_MEALS = 60;

/**
 * A day's meals in the order they were eaten: by time, keeping log order within the same minute.
 * An edit queued offline is stored at the end of the day's list, so this puts it back in its place.
 */
export function byTime(meals: Meal[]): Meal[] {
  return meals.map((m, i) => [m, i] as const).sort(([a, i], [b, j]) => (a.time < b.time ? -1 : a.time > b.time ? 1 : i - j)).map(([m]) => m);
}

/** The same stored value: key order and undefined fields don't matter (Firestore drops those). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => sameValue(x, (b as unknown[])[i]));
  const keys = (o: object) => Object.keys(o).filter(k => (o as Record<string, unknown>)[k] !== undefined).sort();
  const ka = keys(a), kb = keys(b);
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

const withoutId = ({ id: _, ...m }: Meal) => m;

/**
 * Where `target` is in a day's meals: by id; for an older meal without one, the first identical
 * meal (one without an id first, then one that has since been given an id). -1 when it's gone.
 */
export function findMeal(meals: Meal[], target: Meal): number {
  if (target.id) return meals.findIndex(m => m.id === target.id);
  const bare = meals.findIndex(m => !m.id && sameValue(m, target));
  return bare >= 0 ? bare : meals.findIndex(m => sameValue(withoutId(m), target));
}

/** One meal per id, where an edit raced another and left two copies: the later copy, in the earlier one's place. */
function onePerId(meals: Meal[]): Meal[] {
  const last = new Map<string, Meal>();
  for (const m of meals) if (m.id) last.set(m.id, m);
  const seen = new Set<string>();
  return meals.flatMap(m => {
    if (!m.id) return [m];
    if (seen.has(m.id)) return [];
    seen.add(m.id);
    return [last.get(m.id)!];
  });
}

/** A day's meals as stored → as shown and counted: one per id, in the order they were eaten. */
export function dayMeals(meals: Meal[]): Meal[] {
  return byTime(onePerId(meals));
}

/**
 * The stored meals with just `target` replaced by `next` (removed when `next` is null): one
 * occurrence only, even when an older identical meal sits beside it. Every meal comes out with an
 * id. Null when `target` isn't there any more (deleted or changed on another device).
 */
export function changeMeals(meals: Meal[], target: Meal, next: Meal | null, newId: () => string): Meal[] | null {
  const cur = onePerId(meals);
  const i = findMeal(cur, target);
  if (i < 0) return null;
  const out = next ? cur.map((m, k) => (k === i ? { ...next, id: next.id ?? cur[i].id ?? newId() } : m)) : cur.filter((_, k) => k !== i);
  return out.map(m => (m.id ? m : { ...m, id: newId() }));
}

const minutesOf = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? +m[1] * 60 + +m[2] : null;
};

/**
 * Should a meal REI wants to log from this chat message be stored? `today` is what's already
 * logged today; `now` is the time of day as "HH:MM".
 */
export function shouldLogMeal(message: string, meal: Meal, today: Meal[], now: string, namesFood?: boolean): { ok: boolean; why?: string } {
  const said = new Set([...words(message)].map(stem));
  const named = [...mealWords(meal)].some(w => said.has(w));
  if (!named && !EATING.test(message)) return { ok: false, why: 'not mentioned' };
  // "Log my snack please", "just had dinner": they ate, but never said what. Whatever REI would log is made
  // up (once it logged its own suggestion), so nothing is, and REI asks. Skipped when they point at a meal
  // REI can know ("the usual", "same as yesterday"), give a number ("about 800 calories out"), or write
  // in a script whose food words we can't read here. `namesFood`: the message names a food on the list.
  if (!named && namesFood === false && said.size > 0 && !/\d/.test(message) && !REFERS.test(message)) return { ok: false, why: 'no food named' };
  // The same food already logged today: a repeat within three hours, or any time they don't say they ate
  // it again ("the biryani was so good" isn't a second biryani; "had 2 eggs for dinner" is a new meal).
  const t = minutesOf(now);
  const same = today.filter(m => sameMeal(m, meal));
  const soon = same.some(m => {
    const at = minutesOf(m.time);
    return t === null || at === null || t - at <= 180;
  });
  if (same.length && !AGAIN.test(message) && (soon || !EATING.test(message))) return { ok: false, why: 'already logged' };
  return { ok: true };
}

/** What kind of training a session is, to spot the same one twice: gym, a run, a given sport. */
const kindOf = (s: SessionLog) => (s.cardio ? `cardio:${s.cardio.kind}` : s.activity ? `activity:${s.activity.id}` : 'session');

/**
 * Should a workout REI wants to log from a chat message or call be stored? Not when the same kind is
 * already logged today ("just smashed push day" after saving the workout in the app), unless they say
 * it was another one.
 */
export function shouldLogWorkout(message: string, log: SessionLog, today: SessionLog[]): { ok: boolean; why?: string } {
  if (today.some(s => kindOf(s) === kindOf(log)) && !AGAIN.test(message)) return { ok: false, why: 'already logged' };
  return { ok: true };
}

const N = String.raw`(\d{2,3}(?:\.\d{1,2})?)(?![\d.])`;
const UNIT = String.raw`\s*(kg|kgs|kilos?|lbs?|pounds)?(?!\s*(?:g|gm|gms|grams?|ml)\b)`;
/** "weighed 83.5", "I weigh 84", "weigh-in: 83.2", "scale says 83.4", "83.5 on the scale". */
const WEIGHED = [
  new RegExp(String.raw`\b(?:weighed(?: in)?(?: at)?|i weigh|weigh-?in(?: was| is|:)?|(?:the )?scale (?:says|said|shows|showed|reads?))\s*(?:at\s*)?${N}${UNIT}`, 'i'),
  new RegExp(String.raw`\b${N}\s*(kg|kgs|kilos?)?\s+on the scale\b`, 'i'),
];
/** "I'm 84 kg", "down to 82.6 kilos": only with the unit, and not about a lift ("up to 85 kg on bench"). */
const AT_KG = new RegExp(String.raw`\b(?:i'?m|i am|now|down to|up to)\s*(?:at\s*)?${N}\s*(kg|kgs|kilos?)\b`, 'i');
const LIFT = /\b(bench\w*|squat\w*|deadlift\w*|press\w*|row|rows|curl\w*|lift\w*|dumbbells?|barbell|plates?|pr|reps?|sets?)\b|\d\s?x\s?\d/i;
const NOT_TODAY = /\b(want|wanna|goal|target|aim|hope|used to|(to|should|will|would|gonna) weigh|last (year|month|week)|(years?|months?|weeks?) ago|when i was)\b/i;

/**
 * Today's weight from what they told REI ("weighed 83.5 this morning", "scale says 83.2"), for when the
 * model replies to it without calling update_vow. Only a plausible reading within 10% of their current
 * weight; never a goal ("want to weigh 75"), a past weight, pounds or a lift.
 */
export function weighInFrom(message: string, currentKg: number): number | null {
  if (NOT_TODAY.test(message)) return null;
  const m = WEIGHED.map(re => re.exec(message)).find(Boolean) ?? (LIFT.test(message) ? null : AT_KG.exec(message));
  if (!m) return null;
  const kg = parseFloat(m[1]);
  if (/^(lb|lbs|pounds)$/i.test(m[2] ?? '') || !(kg >= 30 && kg <= 250)) return null;
  if (currentKg > 0 && Math.abs(kg - currentKg) > currentKg * 0.1) return null;
  return kg;
}

/**
 * Does the message give this number ("weighed 83.5", "I'm 82 now")? A weight REI records is a weigh-in,
 * so it must come from what they said: once "night shift killed me yesterday" was stored as one.
 */
export function saysNumber(message: string, n: number): boolean {
  return [...message.matchAll(/\d+(?:\.\d+)?/g)].some(m => Math.abs(parseFloat(m[0]) - n) < 0.05);
}
