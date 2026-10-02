// The food list: Indian ingredients (IFCT 2017), common dishes, and each tester's own foods.
// Search, quantity parsing and portion maths all run on the device, so picking a food logs
// it instantly and works offline. REI uses the same list to match what you type.
import type { Meal, MealItem } from '../types';
import { DISHES } from './dishes';
import { IFCT } from './ifct';

export { DISHES } from './dishes';
export { IFCT } from './ifct';

export interface Unit {
  /** e.g. "roti", "katori", "100 g". */
  n: string;
  g: number;
}

export type FoodSource = 'ifct' | 'dish' | 'barcode' | 'mine';

export interface Food {
  /** "i:A003" (IFCT), "d:roti" (dish), "b:8901063010147" (barcode), "m:…" (yours). */
  id: string;
  name: string;
  /** Other names to search by. */
  alt?: string;
  /** The macros below are for this many grams (for a saved meal, one serving). */
  per: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** Portions; the first is the default. Grams always work too, unless `serving` is set. */
  units: Unit[];
  src: FoodSource;
  brand?: string;
  barcode?: string;
  /** A saved meal: counted in servings, not grams. */
  serving?: boolean;
  fav?: boolean;
  /** Epoch ms of the last time it was logged (your foods only). */
  usedAt?: number;
}

const kcalOf = (p: number, c: number, f: number, fib = 0) => Math.round(4 * p + 4 * c + 9 * f + 2 * fib);

// Portions for common IFCT foods, which otherwise come per 100 g.
const IFCT_UNITS: Record<string, Unit[]> = {};
const hint = (codes: string[], units: [string, number][]) => codes.forEach(c => (IFCT_UNITS[c] = units.map(([n, g]) => ({ n, g }))));
hint(['M001', 'M004', 'M008', 'M009'], [['egg', 50]]);
hint(['M002', 'M005'], [['white', 33]]);
hint(['L001', 'L002'], [['glass', 250]]);
hint(['L003'], [['100 g', 100], ['cube', 20]]);
hint(['E001', 'E002', 'E003', 'E004'], [['apple', 150]]);
hint(['E009', 'E010', 'E011', 'E012'], [['banana', 100]]);
hint(['E047'], [['orange', 130]]);
hint(['E036', 'E037', 'E038', 'E039', 'E040', 'E041', 'E042'], [['mango', 200]]);
hint(['E028', 'E029'], [['guava', 150]]);
hint(['E017', 'E018', 'E019'], [['date', 8]]);
hint(['E049', 'E053', 'E065', 'E066'], [['katori', 150]]);
hint(['H001'], [['10 almonds', 12]]);
hint(['H005'], [['10 cashews', 15]]);
hint(['H012'], [['handful', 30]]);
hint(['H021'], [['walnut', 4]]);
hint(['T001', 'T002', 'T003', 'T004', 'T005', 'T006', 'T007', 'T008', 'T009', 'T010', 'T011', 'T012', 'T013', 'T014'], [['tsp', 5], ['tbsp', 14]]);
hint(['I001'], [['piece', 10]]);
hint(['K002'], [['glass', 250]]);

let built: Food[] | null = null;

/** Every built-in food: dishes first (what people usually mean), then IFCT ingredients. */
export function catalog(): Food[] {
  built ??= [
    ...DISHES.map(([id, name, alt, units, kcal, p, c, f]): Food => ({
      id: `d:${id}`, name, alt, per: units[0][1], kcal, p, c, f, units: units.map(([n, g]) => ({ n, g })), src: 'dish',
    })),
    ...IFCT.map(([code, name, alt, p, c, f, fib]): Food => ({
      id: `i:${code}`, name, alt, per: 100, kcal: kcalOf(p, c, f, fib), p, c, f, units: IFCT_UNITS[code] ?? [{ n: '100 g', g: 100 }], src: 'ifct',
    })),
  ];
  return built;
}

// ---- Search -------------------------------------------------------------------

const STOP = new Set(['a', 'an', 'the', 'of', 'some', 'my', 'had', 'ate', 'just', 'i', 'for', 'in', 'little', 'bit', 'small', 'big', 'large']);

function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('oes')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => normalize(s).split(' ').filter(w => w && !STOP.has(w)).map(stem);

interface Indexed {
  food: Food;
  name: string[];
  alt: string[];
  phrases: string[];
}

const indexCache = new WeakMap<Food, Indexed>();
function indexed(food: Food): Indexed {
  let x = indexCache.get(food);
  if (!x) {
    const alts = (food.alt ?? '').split(',').map(normalize).filter(Boolean);
    x = {
      food,
      name: tokens(food.name + (food.brand ? ' ' + food.brand : '')),
      alt: alts.flatMap(tokens),
      phrases: [normalize(food.name), ...alts].map(p => p.split(' ').map(stem).join(' ')),
    };
    indexCache.set(food, x);
  }
  return x;
}

const SOURCE_BONUS: Record<FoodSource, number> = { mine: 4, barcode: 4, dish: 0.6, ifct: 0 };

export interface Match {
  food: Food;
  score: number;
  /** Share of the query's words that matched. */
  coverage: number;
}

function scoreFood(q: string[], phrase: string, x: Indexed): Match | null {
  let total = 0, hit = 0;
  for (const w of q) {
    let best = 0;
    for (const t of x.name) best = Math.max(best, t === w ? 3 : w.length >= 3 && t.startsWith(w) ? 1.5 : 0);
    for (const t of x.alt) best = Math.max(best, t === w ? 2.5 : w.length >= 3 && t.startsWith(w) ? 1 : 0);
    if (best) hit++;
    total += best;
  }
  if (!hit) return null;
  const coverage = hit / q.length;
  if (x.phrases.includes(phrase)) total += 4;
  else if (x.phrases.some(p => p.startsWith(phrase + ' ') || p.startsWith(phrase))) total += 1.5;
  // Prefer the plainest match: "Rice, cooked" over "Rice, raw, milled" for "rice".
  total -= 0.15 * Math.max(0, x.name.length - hit);
  total += SOURCE_BONUS[x.food.src] + (x.food.fav ? 0.5 : 0);
  return { food: x.food, score: total + coverage * 4, coverage };
}

/** Best matches for a query, yours first when they match as well. */
export function searchFoods(query: string, foods: Food[], max = 8): Match[] {
  const q = tokens(query);
  if (!q.length) return [];
  const phrase = q.join(' ');
  const out: Match[] = [];
  for (const f of foods) {
    const m = scoreFood(q, phrase, indexed(f));
    if (m && m.coverage >= 0.5) out.push(m);
  }
  return out.sort((a, b) => b.coverage - a.coverage || b.score - a.score).slice(0, max);
}

// ---- Portions -----------------------------------------------------------------

const UNIT_ALIAS: Record<string, string> = {
  bowl: 'katori', bowls: 'katori', katoris: 'katori', vati: 'katori', cups: 'cup', plates: 'plate', glasses: 'glass',
  pieces: 'piece', pc: 'piece', pcs: 'piece', slices: 'slice', scoops: 'scoop', tablespoon: 'tbsp', tablespoons: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', servings: 'serving', packet: 'pack', packets: 'pack', packs: 'pack', cans: 'can',
};
/** Typical sizes for portions a food doesn't define itself. */
const GENERIC: Record<string, number> = { katori: 150, cup: 160, plate: 250, glass: 250, tbsp: 15, tsp: 5, scoop: 30, handful: 30, slice: 25, can: 330 };
const GRAMS: Record<string, number> = { g: 1, gm: 1, gms: 1, gram: 1, grams: 1, ml: 1, kg: 1000, l: 1000 };

/** The portion `name` means for this food, or the default portion. */
export function unitFor(food: Food, name?: string): Unit {
  const raw = name?.toLowerCase() ?? '';
  const n = UNIT_ALIAS[raw] ?? raw;
  if (n && !food.serving && GRAMS[n]) return { n: 'g', g: GRAMS[n] };
  const own = food.units.find(u => u.n.toLowerCase() === raw || u.n.toLowerCase() === n) ?? (n === 'piece' || n === 'serving' ? food.units[0] : undefined);
  if (own) return own;
  if (n && !food.serving && GENERIC[n]) return { n, g: GENERIC[n] };
  return food.units[0] ?? { n: 'g', g: 1 };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** `qty` of a portion of `food`, with its macros. */
export function itemFor(food: Food, qty: number, unit?: string): MealItem {
  const u = unitFor(food, unit);
  const g = qty * u.g;
  const k = g / (food.per || 1);
  return { food: food.id, name: food.name, qty, unit: u.n, g: food.serving ? 0 : Math.round(g), kcal: Math.round(food.kcal * k), p: r1(food.p * k), c: r1(food.c * k), f: r1(food.f * k) };
}

/** "2 roti", "150 g", "1.5 katori". */
export function amountLabel(i: Pick<MealItem, 'qty' | 'unit'>): string {
  const q = +i.qty.toFixed(2);
  if (i.unit === 'g') return `${q} g`;
  if (/^\d/.test(i.unit)) return q === 1 ? i.unit : `${q} × ${i.unit}`;
  return `${q} ${i.unit}`;
}

export function mealFromItems(items: MealItem[], time: string, src: Meal['src'], name?: string): Meal {
  const sum = (k: 'kcal' | 'p' | 'c' | 'f') => Math.round(items.reduce((a, i) => a + i[k], 0));
  const label = name?.trim() || items.map(i => (i.qty !== 1 && i.unit !== 'g' && !/^\d/.test(i.unit) ? `${+i.qty.toFixed(2)} ${i.name}` : i.name)).join(' + ');
  const n = label.slice(0, 60);
  return { time, name: n.charAt(0).toUpperCase() + n.slice(1), kcal: sum('kcal'), p: sum('p'), c: sum('c'), f: sum('f'), items, src };
}

// ---- Free text ----------------------------------------------------------------

const WORD_QTY: Record<string, number> = { a: 1, an: 1, one: 1, half: 0.5, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2 };
const UNIT_RE = `(${[...Object.keys(GRAMS), ...Object.keys(GENERIC), ...Object.keys(UNIT_ALIAS), 'piece', 'serving', 'pack', 'katori'].sort((a, b) => b.length - a.length).join('|')})`;
const PIECE_RE = new RegExp(`^(?:(\\d+(?:\\.\\d+)?|\\d+/\\d+)\\s*|(${Object.keys(WORD_QTY).join('|')})\\s+)?(?:${UNIT_RE}\\b\\.?\\s*(?:of\\s+)?)?(.*)$`);

export interface ParsedPiece {
  text: string;
  qty: number;
  unit?: string;
  query: string;
}

/** "2 rotis and a katori of dal, 200g chicken" → pieces with amounts. */
export function splitMealText(text: string): ParsedPiece[] {
  const s = text.toLowerCase().replace(/^\s*(just\s+)?(i\s+)?(had|ate|eaten|having)\s*:?\s*/, '').replace(/\bfor (breakfast|lunch|dinner|snack)\b/g, '');
  return s
    .split(/\s*(?:,|\+|&|;|\n|\band\b|\bwith\b|\bplus\b)\s*/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const m = PIECE_RE.exec(p)!;
      const [, num, word, unit, rest] = m;
      const qty = num ? (num.includes('/') ? +num.split('/')[0] / +num.split('/')[1] : parseFloat(num)) : word ? WORD_QTY[word] : 1;
      return { text: p, qty: qty > 0 ? qty : 1, unit: unit || undefined, query: (rest ?? '').trim() };
    })
    .filter(p => p.query);
}

export interface TextMatch {
  items: MealItem[];
  /** Pieces nothing matched confidently. */
  unmatched: string[];
}

/** A confident match: every word found, and clearly ahead of the runner-up or an exact name. */
function confident(ms: Match[], query: string): Match | null {
  const [a, b] = ms;
  if (!a || a.coverage < 1) return null;
  const exact = indexed(a.food).phrases.includes(tokens(query).join(' '));
  // Varieties of one ingredient ("Banana, ripe, robusta" and "…, poovam") are close enough.
  const variant = !!b && a.food.src === 'ifct' && b.food.src === 'ifct' && a.food.name.split(',')[0] === b.food.name.split(',')[0];
  return exact || variant || !b || a.score - b.score >= 1 ? a : null;
}

/** "idli sambar": two foods with no "and" between them. The amount goes with the first. */
function splitPair(p: ParsedPiece, foods: Food[]): MealItem[] | null {
  const words = p.query.split(' ');
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(' '), right = words.slice(i).join(' ');
    const a = confident(searchFoods(left, foods, 3), left), b = a && confident(searchFoods(right, foods, 3), right);
    if (a && b) return [itemFor(a.food, p.qty, p.unit), itemFor(b.food, 1)];
  }
  return null;
}

/** Match typed food to the list, on the device. Unmatched pieces go to REI to estimate. */
export function matchMealText(text: string, foods: Food[]): TextMatch {
  const items: MealItem[] = [], unmatched: string[] = [];
  for (const p of splitMealText(text)) {
    const m = confident(searchFoods(p.query, foods, 3), p.query);
    const pair = m ? null : splitPair(p, foods);
    if (m) items.push(itemFor(m.food, p.qty, p.unit));
    else if (pair) items.push(...pair);
    else unmatched.push(p.text);
  }
  return { items, unmatched };
}

/** Foods REI may pick from for this message: the best few for each piece. */
export function foodCandidates(text: string, foods: Food[], max = 16): Food[] {
  const seen = new Map<string, Food>();
  for (const p of splitMealText(text)) for (const m of searchFoods(p.query, foods, 4)) if (m.coverage >= 1) seen.set(m.food.id, m.food);
  return [...seen.values()].slice(0, max);
}

/** The food list block of REI's prompt. */
export function foodListPrompt(foods: Food[]): string {
  if (!foods.length) return '';
  const lines = foods.map(f => `${f.id} | ${f.name}${f.brand ? ` (${f.brand})` : ''} | ${f.units.map(u => `${u.n}${f.serving ? '' : ` = ${u.g} g`}`).join(', ')} | ${f.serving ? 'per serving' : `per ${f.per} g`}: ${f.kcal} kcal, P${f.p} C${f.c} F${f.f}`);
  return `Food list (id | name | portions | macros). When an item the user ate is on it, use its id and one of its portions (or "g"):\n${lines.join('\n')}`;
}

/** An item REI returned: a food id from the list, or "none" with its own estimate. */
export interface AiItem {
  food_id: string;
  name: string;
  qty: number;
  unit: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

/** Use the list's numbers for anything REI matched; keep REI's estimate for the rest. */
export function resolveAiItems(items: AiItem[], foods: Food[]): MealItem[] {
  const byId = new Map(foods.map(f => [f.id, f]));
  return items.map(i => {
    const food = byId.get(i.food_id);
    if (food && i.qty > 0) return itemFor(food, i.qty, i.unit);
    return { food: '', name: i.name, qty: i.qty > 0 ? i.qty : 1, unit: i.unit || 'serving', g: 0, kcal: Math.round(i.kcal), p: r1(i.p), c: r1(i.c), f: r1(i.f) };
  });
}

// ---- Barcodes (Open Food Facts) -------------------------------------------------

export const OFF_FIELDS = 'product_name,product_name_en,brands,nutriments,serving_quantity,quantity';

/** An Open Food Facts product response → a food, or null when it lacks the numbers. */
export function offToFood(code: string, body: unknown): Food | null {
  const prod = (body as { status?: number; product?: Record<string, unknown> } | null)?.product;
  if (!prod) return null;
  const n = (prod.nutriments ?? {}) as Record<string, unknown>;
  const num = (k: string) => (typeof n[k] === 'number' ? (n[k] as number) : typeof n[k] === 'string' ? parseFloat(n[k] as string) : NaN);
  const p = num('proteins_100g'), c = num('carbohydrates_100g'), f = num('fat_100g');
  let kcal = num('energy-kcal_100g');
  if (!Number.isFinite(kcal)) kcal = num('energy_100g') / 4.184;
  if (![p, c, f].every(Number.isFinite) && !Number.isFinite(kcal)) return null;
  const name = String(prod.product_name_en || prod.product_name || '').trim();
  if (!name) return null;
  const brand = String(prod.brands ?? '').split(',')[0].trim() || undefined;
  const units: Unit[] = [];
  const serving = typeof prod.serving_quantity === 'number' ? prod.serving_quantity : parseFloat(String(prod.serving_quantity ?? ''));
  if (serving > 0) units.push({ n: 'serving', g: Math.round(serving) });
  const pack = /([\d.]+)\s*(g|ml)\b/i.exec(String(prod.quantity ?? ''));
  if (pack && +pack[1] > 0 && +pack[1] <= 5000) units.push({ n: 'pack', g: Math.round(+pack[1]) });
  units.push({ n: '100 g', g: 100 });
  const safe = (v: number) => (Number.isFinite(v) && v >= 0 ? r1(v) : 0);
  return {
    id: `b:${code}`, name: name.slice(0, 60), brand, barcode: code, per: 100,
    kcal: Number.isFinite(kcal) ? Math.round(kcal) : kcalOf(safe(p), safe(c), safe(f)),
    p: safe(p), c: safe(c), f: safe(f), units, src: 'barcode',
  };
}

/** Save a logged meal as one of your foods, counted in servings. */
export function foodFromMeal(meal: Meal, id: string): Food {
  return { id, name: meal.name, per: 1, kcal: meal.kcal, p: meal.p, c: meal.c, f: meal.f, units: [{ n: 'serving', g: 1 }], src: 'mine', serving: true };
}

/** Basic checks before a food is stored (also enforced by the security rules). */
export function validFood(f: Food): boolean {
  const ok = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
  return typeof f.id === 'string' && /^[a-z]:[A-Za-z0-9_-]{1,40}$/.test(f.id) && typeof f.name === 'string' && f.name.trim().length > 0 && f.name.length <= 80
    && ok(f.per, 5000) && f.per > 0 && ok(f.kcal, 10000) && ok(f.p, 1000) && ok(f.c, 2000) && ok(f.f, 1000)
    && Array.isArray(f.units) && f.units.length > 0 && f.units.length <= 6 && f.units.every(u => typeof u.n === 'string' && u.n.length <= 24 && ok(u.g, 5000) && u.g > 0);
}
