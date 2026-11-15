// A meal read from a photo: the model names what is on the plate and how much, and the numbers come
// from the food list wherever it has the food. No Firebase here, so it can be tested on its own.
import { type AiItem, type Food, type Meal, mealFromItems, type Nutrition, type Profile, resolveAiItems } from '@rei/shared';
import { mealEstimates, parseMeal } from './chat/tools';

const item = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'The food in plain English, e.g. "roti", "dal", "chicken curry", "cooked rice"' },
    qty: { type: 'number', description: 'How many of unit, e.g. 2' },
    unit: { type: 'string', description: 'piece, katori, plate, cup, glass, tbsp, slice or g' },
    kcal: { type: 'integer', description: 'Your estimate for this amount' },
    p: { type: 'integer', description: 'Protein, grams' },
    c: { type: 'integer', description: 'Carbohydrates, grams' },
    f: { type: 'integer', description: 'Fat, grams' },
  },
  required: ['name', 'qty', 'unit', 'kcal', 'p', 'c', 'f'],
  additionalProperties: false,
} as const;

export const PHOTO_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Short name for the meal' },
    items: { type: 'array', description: 'Each food on the plate, in the amount you see', items: item },
    kcal: { type: 'integer', description: 'Total calories (the sum of the items)' },
    p: { type: 'integer', description: 'Protein, grams' },
    c: { type: 'integer', description: 'Carbohydrates, grams' },
    f: { type: 'integer', description: 'Fat, grams' },
    fib: { type: 'number', description: 'Fibre, grams' },
    sug: { type: 'number', description: 'Total sugars, grams' },
    sfa: { type: 'number', description: 'Saturated fat, grams' },
    na: { type: 'integer', description: 'Sodium, mg (count salt in cooking)' },
    confidence: { type: 'number', description: '0 to 1: how sure you are of the portion and contents' },
    verdict: { type: 'string', description: 'REI’s reaction to the plate in one sentence, in REI’s voice, without any numbers: the app adds the exact calories and what is left. If unsure, one short question about what is in it or how much.' },
  },
  required: ['name', 'items', 'kcal', 'p', 'c', 'f', 'fib', 'sug', 'sfa', 'na', 'confidence', 'verdict'],
  additionalProperties: false,
} as const;

/** Added to REI's prompt for a photo. */
export const PHOTO_PROMPT = 'The user sent a photo of what they are eating. Estimate it like a nutrition coach: list each item with its amount (Indian home portions: a katori is about 150 g), judge portion sizes from plate and cutlery scale, and count oil and sauces. Name foods plainly in English so the app can look them up in its food database; its numbers replace yours where it has the food.';

const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : null);

/** The items of a photo estimate, checked like any other tool input. */
function photoItems(raw: unknown): AiItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AiItem[] = [];
  for (const r of raw.slice(0, 15)) {
    const o = (r ?? {}) as Record<string, unknown>;
    const kcal = int(o.kcal, 6000), p = int(o.p, 600), c = int(o.c, 1000), f = int(o.f, 400);
    const qty = typeof o.qty === 'number' && Number.isFinite(o.qty) && o.qty > 0 && o.qty <= 5000 ? o.qty : null;
    if (typeof o.name !== 'string' || !o.name.trim() || qty === null || kcal === null || p === null || c === null || f === null) continue;
    out.push({ food_id: 'none', name: o.name.trim().slice(0, 60), qty, unit: typeof o.unit === 'string' ? o.unit.trim().slice(0, 24) : '', kcal, p, c, f });
  }
  return out;
}

export interface PhotoRead {
  /** The meal to log, or null when the model wasn't sure enough (it asks instead). */
  meal: Meal | null;
  confidence: number;
  /** REI's own words about the plate. */
  verdict: string;
  /** How many items took the food list's numbers, and how many stayed estimates. */
  listed: number;
  estimated: number;
}

/**
 * The model's JSON for a photo → the meal. Items the food list has take its numbers (when they agree
 * with the model's own figure for that item); the rest stay the model's estimate. With no usable
 * items (an older prompt, a bare total), the whole-meal estimate is used as before.
 */
export function photoMeal(out: unknown, foods: Food[], time: string): PhotoRead {
  const est = parseMeal(out);
  const confidence = Number((out as { confidence?: unknown } | null)?.confidence ?? 0) || 0;
  const verdict = est?.verdict || 'Couldn’t read that plate. Tell me what it is and roughly how much.';
  if (!est || confidence < 0.5) return { meal: null, confidence, verdict, listed: 0, estimated: 0 };
  const name = est.name.charAt(0).toUpperCase() + est.name.slice(1);
  const items = resolveAiItems(photoItems((out as { items?: unknown }).items), foods);
  const whole = mealEstimates(out);
  if (!items.length) return { meal: { time, name, kcal: est.kcal, p: est.p, c: est.c, f: est.f, src: 'photo', ...(whole ? { n: whole } : {}) }, confidence, verdict, listed: 0, estimated: 1 };
  const meal = mealFromItems(items, time, 'photo', name);
  const listed = items.filter(i => i.food).length;
  // Fibre, sodium and the rest: the list's when every item is on it, otherwise the model's for the whole plate.
  const n = listed === items.length ? meal.n : whole;
  const { n: _, ...bare } = meal;
  return { meal: { ...bare, ...(n ? { n } : {}) }, confidence, verdict, listed, estimated: items.length - listed };
}

/** The exact numbers, added after REI's words: what was logged and what that leaves today. */
export function photoNumbers(meal: Meal, profile: Profile, before: Pick<Nutrition, 'kcal' | 'protein'>): string {
  const kcalLeft = Math.round((parseFloat(profile.kcal) || 0) - before.kcal - meal.kcal);
  const proteinLeft = Math.round((parseFloat(profile.protein) || 0) - before.protein - meal.p);
  const left = kcalLeft >= 0 ? `${kcalLeft} kcal left today` : `${-kcalLeft} kcal over today`;
  return `${meal.kcal} kcal, ${meal.p} g protein. ${left}, ${proteinLeft > 0 ? `${proteinLeft} g protein to go` : 'protein hit'}.`;
}

/** About 1.5 MB of JPEG; the app sends ~150 KB (1024 px, quality 0.7). */
const MAX_BASE64 = 2_000_000;

/** The base64 of one JPEG from the request, or null: the right size, and nothing but base64 (a data: prefix is dropped). */
export function photoInput(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const image = raw.replace(/^data:image\/[a-z]+;base64,/i, '').replace(/\s+/g, '');
  if (image.length < 100 || image.length > MAX_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) return null;
  return image;
}
