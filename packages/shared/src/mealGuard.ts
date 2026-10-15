// A safety net for meals REI logs from a chat message: the model sometimes re-logs a meal from
// earlier in the conversation ("going to a movie" logged the lunch again). A meal is only stored
// when the message itself talks about eating or names the food, and never twice in a row by
// accident. Logging from the Fuel screen doesn't go through this: there, logging is the intent.
import type { Meal, SessionLog } from './types';

const EATING = /\b(ate|eat|eating|eaten|had|have|having|drank|drink|drinking|finished|grabbed|ordered|munch\w*|snack\w*|breakfast|brunch|lunch|dinner|supper|meal|food|cooked|devoured|demolished|smashed)\b/i;
const AGAIN = /\b(another|again|more|second|2nd|one more|seconds|extra|also)\b/i;
const STOP = new Set(['and', 'the', 'with', 'from', 'for', 'some', 'cup', 'cups', 'bowl', 'plate', 'piece', 'pieces', 'slice', 'slices', 'glass', 'serving', 'small', 'large', 'medium', 'half', 'full', 'home', 'style', 'cooked', 'fried', 'boiled', 'raw', 'office', 'canteen']);

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

const minutesOf = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? +m[1] * 60 + +m[2] : null;
};

/**
 * Should a meal REI wants to log from this chat message be stored? `today` is what's already
 * logged today; `now` is the time of day as "HH:MM".
 */
export function shouldLogMeal(message: string, meal: Meal, today: Meal[], now: string): { ok: boolean; why?: string } {
  const said = new Set([...words(message)].map(stem));
  const named = [...mealWords(meal)].some(w => said.has(w));
  if (!named && !EATING.test(message)) return { ok: false, why: 'not mentioned' };
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
