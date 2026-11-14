// The food list: Indian ingredients (IFCT 2017), common dishes, and each tester's own foods.
// Search, quantity parsing and portion maths all run on the device, so picking a food logs
// it instantly and works offline. REI uses the same list to match what you type.
import { addNutrients, cleanNutrients, type Nutrients, nutrientsFromRow, scaleNutrients } from '../nutrients';
import type { Meal, MealItem } from '../types';
import { DISHES } from './dishes';
import { IFCT } from './ifct';
import { USDA } from './usda';

export { DISHES } from './dishes';
export { IFCT } from './ifct';
export { USDA } from './usda';

export interface Unit {
  /** e.g. "roti", "katori", "100 g". */
  n: string;
  g: number;
}

export type FoodSource = 'ifct' | 'dish' | 'usda' | 'barcode' | 'mine';

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
  /** Fibre, sugar, sodium, vitamins and minerals for `per` grams, where known. */
  n?: Nutrients;
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
const HUNDRED: Unit[] = [{ n: '100 g', g: 100 }];

/** Every built-in food: dishes first (what people usually mean), then IFCT ingredients, then USDA. */
export function catalog(): Food[] {
  built ??= [
    ...DISHES.map(([id, name, alt, units, kcal, p, c, f, extra]): Food => ({
      id: `d:${id}`, name, alt, per: units[0][1], kcal, p, c, f, units: units.map(([n, g]) => ({ n, g })), src: 'dish', n: nutrientsFromRow(extra),
    })),
    ...IFCT.map(([code, name, alt, p, c, f, fib, nutr]): Food => ({
      id: `i:${code}`, name, alt, per: 100, kcal: kcalOf(p, c, f, fib), p, c, f, units: IFCT_UNITS[code] ?? [{ n: '100 g', g: 100 }], src: 'ifct', n: nutrientsFromRow(nutr),
    })),
    // Everything else, from USDA: ranked below the Indian lists when both match.
    ...USDA.map(([id, name, kcal, p, c, f, nutr]): Food => ({ id: `u:${id}`, name, per: 100, kcal, p, c, f, units: HUNDRED, src: 'usda', n: nutrientsFromRow(nutr) })),
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

/** Foods whose name before the comma names them: dishes, and IFCT foods with a portion of their own. */
const headed = (food: Food) => food.name.includes(',') && (food.src === 'dish' || (food.src === 'ifct' && food.units[0]?.n !== '100 g'));

const indexCache = new WeakMap<Food, Indexed>();
function indexed(food: Food): Indexed {
  let x = indexCache.get(food);
  if (!x) {
    const alts = (food.alt ?? '').split(',').map(normalize).filter(Boolean);
    x = {
      food,
      name: tokens(food.name + (food.brand ? ' ' + food.brand : '')),
      alt: alts.flatMap(tokens),
      // "Dosa, plain" is what "dosa" means; the same for the IFCT foods eaten as they are (fruit, milk, eggs, nuts).
      phrases: [normalize(food.name), ...(headed(food) ? [normalize(food.name.split(',')[0])] : []), ...alts].map(p => p.split(' ').map(stem).join(' ')),
    };
    indexCache.set(food, x);
  }
  return x;
}

const SOURCE_BONUS: Record<FoodSource, number> = { mine: 4, barcode: 4, dish: 0.6, ifct: 0, usda: -0.5 };

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
  // The words together and in order ("almond milk" in "Beverages, almond milk, …").
  else if (q.length > 1 && x.phrases.some(p => (' ' + p + ' ').includes(' ' + phrase + ' '))) total += 2;
  // Prefer the plainest match: "Rice, cooked" over "Rice, raw, milled" for "rice".
  total -= 0.15 * Math.max(0, x.name.length - hit);
  total += SOURCE_BONUS[x.food.src] + (x.food.fav ? 0.5 : 0);
  return { food: x.food, score: total + coverage * 4, coverage };
}

// The built-in list is indexed once (token → foods, plus sorted tokens for prefixes), so a
// keystroke only scores the foods that share a word with the query. Your own foods, a few
// hundred at most, are scanned directly.
interface CatalogIndex {
  byToken: Map<string, Food[]>;
  sorted: string[];
  members: Set<Food>;
}
let catIndex: CatalogIndex | null = null;

function buildIndex(all: Food[]): CatalogIndex {
  const byToken = new Map<string, Food[]>();
  for (const f of all) {
    const x = indexed(f);
    for (const t of new Set([...x.name, ...x.alt])) {
      const list = byToken.get(t);
      if (list) list.push(f);
      else byToken.set(t, [f]);
    }
  }
  return { byToken, sorted: [...byToken.keys()].sort(), members: new Set(all) };
}

function catalogIndex(): CatalogIndex {
  catIndex ??= buildIndex(catalog());
  return catIndex;
}

/** Foods with a token equal to `w`, or starting with it (3+ letters), as scoreFood counts them. */
function lookup(ix: CatalogIndex, w: string, into: Set<Food>) {
  ix.byToken.get(w)?.forEach(f => into.add(f));
  if (w.length < 3) return;
  let lo = 0, hi = ix.sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ix.sorted[mid] < w) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < ix.sorted.length && ix.sorted[i].startsWith(w); i++) ix.byToken.get(ix.sorted[i])!.forEach(f => into.add(f));
}

// Per list passed in: each food's position (results keep the list's order on ties) and a
// small index of the foods that aren't built in (yours). Cached by array identity.
const views = new WeakMap<Food[], { pos: Map<Food, number>; extras: CatalogIndex }>();
function view(foods: Food[]) {
  let v = views.get(foods);
  if (!v) {
    const { members } = catalogIndex();
    v = { pos: new Map(foods.map((f, i) => [f, i])), extras: buildIndex(foods.filter(f => !members.has(f))) };
    views.set(foods, v);
  }
  return v;
}

/** Build the index ahead of time (call once the first screen has drawn). */
export function warmFoodSearch(): void {
  catalogIndex();
}

/** Best matches for a query, yours first when they match as well. */
export function searchFoods(query: string, foods: Food[], max = 8): Match[] {
  const q = tokens(query);
  if (!q.length) return [];
  const phrase = q.join(' ');
  const ix = catalogIndex(), v = view(foods);
  // How many query words each food matches. Results rank by that first, so only
  // foods at the top match levels can make the cut; the rest are never scored.
  const hits = new Map<Food, number>();
  for (const w of q) {
    const set = new Set<Food>();
    lookup(ix, w, set);
    lookup(v.extras, w, set);
    set.forEach(f => v.pos.has(f) && hits.set(f, (hits.get(f) ?? 0) + 1));
  }
  const byLevel = new Map<number, Food[]>();
  hits.forEach((n, f) => (byLevel.get(n) ?? byLevel.set(n, []).get(n)!).push(f));
  const min = Math.ceil(q.length * 0.5);
  const cand: Food[] = [];
  for (let n = q.length; n >= min && cand.length < max; n--) cand.push(...(byLevel.get(n) ?? []));
  const pool = cand.sort((a, b) => v.pos.get(a)! - v.pos.get(b)!);
  const out: Match[] = [];
  for (const f of pool) {
    const m = scoreFood(q, phrase, indexed(f));
    if (m && m.coverage >= 0.5) out.push(m);
  }
  return out.sort((a, b) => b.coverage - a.coverage || b.score - a.score).slice(0, max);
}

/** The scan the index replaces; kept to check the index returns the same results. */
export function searchFoodsLinear(query: string, foods: Food[], max = 8): Match[] {
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

/** How many pieces a portion named like "6 puris" or "10 almonds" holds; 0 for any other portion ("katori", "100 g"). */
export function piecesIn(u: Unit): number {
  const m = /^(\d+)\s+(?!g\b|gm\b|ml\b|inch\b)[a-z]/i.exec(u.n);
  return m && +m[1] > 1 ? +m[1] : 0;
}

/** The portion `name` means for this food, or the default portion. */
export function unitFor(food: Food, name?: string): Unit {
  const raw = name?.toLowerCase() ?? '';
  const n = UNIT_ALIAS[raw] ?? raw;
  if (n && !food.serving && GRAMS[n]) return { n: 'g', g: GRAMS[n] };
  const named = food.units.find(u => u.n.toLowerCase() === raw || u.n.toLowerCase() === n);
  if (named) return named;
  // One piece of a portion that is several ("6 puris", "2 slices", "10 almonds"): a puri, a slice, an almond.
  const many = n ? food.units.find(u => piecesIn(u) && (n === 'piece' || stem(u.n.replace(/^\d+\s+/, '').toLowerCase()) === stem(n))) : undefined;
  if (many) return { n, g: many.g / piecesIn(many) };
  const own = n === 'piece' || n === 'serving' ? food.units[0] : undefined;
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
  const n = scaleNutrients(food.n, k);
  return { food: food.id, name: food.name, qty, unit: u.n, g: food.serving ? 0 : Math.round(g), kcal: Math.round(food.kcal * k), p: r1(food.p * k), c: r1(food.c * k), f: r1(food.f * k), ...(n ? { n } : {}) };
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
  const nutr = items.some(i => i.n) ? addNutrients(...items.map(i => i.n)) : undefined;
  return { time, name: n.charAt(0).toUpperCase() + n.slice(1), kcal: sum('kcal'), p: sum('p'), c: sum('c'), f: sum('f'), items, src, ...(nutr ? { n: nutr } : {}) };
}

/**
 * A meal whose totals were corrected by hand (a photo estimate, say). Fibre, sodium and the rest
 * scale with the calories, so they describe the corrected portion rather than the old one.
 */
export function withTotals(meal: Meal, t: { kcal: number; p: number; c: number; f: number }): Meal {
  const kcal = Math.round(t.kcal);
  const { n: _, ...rest } = meal;
  const n = kcal === meal.kcal ? meal.n : meal.kcal > 0 && kcal > 0 ? scaleNutrients(meal.n, kcal / meal.kcal) : undefined;
  return { ...rest, kcal, p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f), ...(n ? { n } : {}) };
}

// ---- Free text ----------------------------------------------------------------

const WORD_QTY: Record<string, number> = { a: 1, an: 1, one: 1, half: 0.5, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, ek: 1, teen: 3, chaar: 4, paanch: 5, aadha: 0.5 };
const UNIT_WORDS = [...Object.keys(GRAMS), ...Object.keys(GENERIC), ...Object.keys(UNIT_ALIAS), 'piece', 'serving', 'pack', 'katori'].sort((a, b) => b.length - a.length);
const UNIT_RE = `(${UNIT_WORDS.join('|')})`;
const NUM = String.raw`\d+(?:\.\d+)?|\d+/\d+`;
const PIECE_RE = new RegExp(`^(?:(${NUM})\\s*|(${Object.keys(WORD_QTY).join('|')})\\s+)?(?:${UNIT_RE}\\b\\.?\\s*(?:of\\s+)?)?(.*)$`);
/** "samosa 2", "paneer 100g", "pani puri 6 pieces", "ghee 1 tsp": the amount after the food. */
const TRAILING_AMOUNT = new RegExp(`^(.*?[a-z])\\s+(${NUM})\\s*${UNIT_RE}?$`);
/** "chicken biryani plate", "buttermilk glass": the portion after the food. */
const TRAILING_UNIT = new RegExp(`^(.+?)\\s+${UNIT_RE}$`);
const IS_UNIT = new RegExp(`^${UNIT_RE}$`);
const IS_AMOUNT = new RegExp(`^(?:${NUM})(?:g|gm|gms|ml|kg)?$`);

/**
 * Words around the food in what people type or say ("I just had … for breakfast"), in English and in
 * romanised Hindi, Telugu and Tamil ("maine abhi … khaya", "… tinnanu"). None of them names a food.
 */
const AROUND = new RegExp(
  String.raw`\b(?:i|ive|im|we|just|had|have|having|ate|eaten|eating|drank|drinking|finished|grabbed|took|then|also|today|tonight|right now|` +
    String.raw`this (?:morning|afternoon|evening)|in the (?:morning|afternoon|evening)|at (?:night|home|work|office)|` +
    String.raw`for (?:my )?(?:breakfast|brunch|lunch|dinner|supper|snacks?)|(?:pre|post|after|before)[- ]?(?:workout|gym)|` +
    String.raw`bro|yo|bhai|yaar|um|uh|okay|ok|maine|mene|abhi|aaj|subah|dopahar|shaam ko|shaam|raat ko|raat|nashte (?:mein|me)|khaya|khayi|khaye|khaa|kha|liya|liye|piya|piyi|tha|thi|hai|hoon|` +
    String.raw`tinnanu|thinnanu|tinna|thinna|tagaanu|saptaen|sapten|saapten)\b`,
  'g',
);
/** What separates two foods: "and", "with", a comma, and the same in romanised Hindi and Telugu. */
const BETWEEN = /\s*(,|\+|&|;|\n|\band\b|\bwith\b|\bplus\b|\balong with\b|\baur\b|\bke saath\b|\bsaath\b|\bmariyu\b)\s*/;

export interface ParsedPiece {
  text: string;
  qty: number;
  unit?: string;
  query: string;
  /** They typed an amount ("2", "two", "a"); otherwise qty is the 1 we assumed. */
  counted?: boolean;
  /**
   * The words before an amount or portion was read off their end ("chicken 65", "burrito bowl"): when
   * that is itself a food's name, it is the food, and the number or portion word belongs to the name.
   */
  whole?: string;
  /** The word that joined this piece to the one before ("with", "and"), when there was one. */
  sep?: string;
}

/** With no amount typed, a dish means a helping of it ("paneer tikka" is a plate, not one piece). */
const MEAL_UNIT = /^(plate|bowl|katori|serving|glass|cup|thali)$/i;
const defaultUnit = (food: Food, p: ParsedPiece) =>
  // "6 pani puri" is six puris, not six plates of six.
  p.unit ?? (p.counted ? (food.units[0] && piecesIn(food.units[0]) ? 'piece' : undefined) : food.units.find(u => MEAL_UNIT.test(u.n))?.n);

const amount = (num: string | undefined, word: string | undefined) => (num ? (num.includes('/') ? +num.split('/')[0] / +num.split('/')[1] : parseFloat(num)) : word ? WORD_QTY[word] : 1);

/** "1 bowl dal 2 roti 1 bowl rice": a new food starts at each amount that has a food after it. */
function splitAtAmounts(piece: string): string[] {
  const words = piece.split(' ');
  const out: string[] = [];
  let cur: string[] = [];
  words.forEach((w, k) => {
    if (IS_AMOUNT.test(w) && cur.some(x => !IS_AMOUNT.test(x) && !IS_UNIT.test(x) && x !== 'of')) {
      let rest = words.slice(k + 1);
      if (IS_UNIT.test(rest[0] ?? '')) rest = rest.slice(1);
      if (rest[0] === 'of') rest = rest.slice(1);
      // Nothing after it but a portion word: the amount trails the food before it ("samosa 2", "ghee 1 tsp").
      if (rest.length) {
        out.push(cur.join(' '));
        cur = [];
      }
    }
    cur.push(w);
  });
  out.push(cur.join(' '));
  return out;
}

function parsePiece(text: string, sep?: string): ParsedPiece {
  const [, num, word, unit, rest0] = PIECE_RE.exec(text)!;
  const rest = (rest0 ?? '').trim();
  const lead = amount(num, word);
  const base = { text, ...(sep ? { sep } : {}) };
  // The amount after the food, when none came before it.
  const after = !num && !word && !unit ? TRAILING_AMOUNT.exec(rest) : null;
  if (after) {
    const qty = amount(after[2], undefined);
    return { ...base, qty: qty > 0 ? qty : 1, unit: after[3] || undefined, query: after[1].trim(), counted: true, whole: rest };
  }
  const tail = !unit ? TRAILING_UNIT.exec(rest) : null;
  if (tail) return { ...base, qty: lead > 0 ? lead : 1, unit: tail[2], query: tail[1].trim(), counted: !!(num || word), whole: rest };
  return { ...base, qty: lead > 0 ? lead : 1, unit: unit || undefined, query: rest, counted: !!(num || word) };
}

/** "2 rotis and a katori of dal, 200g chicken" → pieces with amounts. */
export function splitMealText(text: string): ParsedPiece[] {
  const s = text.toLowerCase().replace(/[’']/g, '').replace(/[.!?]+(\s|$)/g, ' ').replace(AROUND, ' ').replace(/^\s*:\s*/, '').replace(/[ \t]+/g, ' ');
  const parts = s.split(BETWEEN);
  const out: ParsedPiece[] = [];
  // split() with a capture group: foods at even positions, what joined them at odd ones.
  for (let i = 0; i < parts.length; i += 2) {
    const sep = i > 0 ? parts[i - 1].trim() : '';
    const piece = parts[i].trim().replace(/^(?:my|the|some)\s+/, '');
    if (!piece) continue;
    splitAtAmounts(piece).forEach((p, k) => {
      const parsed = parsePiece(p.trim(), k === 0 && /^[a-z ]+$/.test(sep) ? sep : undefined);
      if (parsed.query) out.push(parsed);
    });
  }
  return out;
}

export interface TextMatch {
  items: MealItem[];
  /** Pieces nothing matched confidently. */
  unmatched: string[];
}

const isExact = (m: Match, query: string) => indexed(m.food).phrases.includes(tokens(query).join(' '));

/** A confident match: every word found, and clearly ahead of the runner-up or an exact name. */
function confident(ms: Match[], query: string): Match | null {
  const [a, b] = ms;
  if (!a || a.coverage < 1) return null;
  const exact = isExact(a, query);
  // Varieties of one ingredient ("Banana, ripe, robusta" and "…, poovam") are close enough.
  const variant = !!b && a.food.src === 'ifct' && b.food.src === 'ifct' && a.food.name.split(',')[0] === b.food.name.split(',')[0];
  return exact || variant || !b || a.score - b.score >= 1 ? a : null;
}

/** The food whose name (or one of its other names) is exactly these words. */
function exactFood(query: string, foods: Food[]): Food | null {
  const a = searchFoods(query, foods, 3)[0];
  return a && a.coverage >= 1 && isExact(a, query) ? a.food : null;
}

/**
 * "idli sambar", "2 roti dal sabzi": several foods with no "and" between them, longest names first.
 * The amount goes with the first. Each part has to be a food's own name (or one of its other names),
 * so a stray word never turns into a food.
 */
function splitRun(words: string[], foods: Food[], depth = 0): Food[] | null {
  if (depth > 4) return null;
  for (let i = words.length - 1; i >= 1; i--) {
    const left = words.slice(0, i).join(' '), right = words.slice(i).join(' ');
    const a = exactFood(left, foods);
    if (!a) continue;
    const whole = exactFood(right, foods);
    const rest = whole ? [whole] : splitRun(words.slice(i), foods, depth + 1);
    if (rest) return [a, ...rest];
  }
  return null;
}

function runItems(p: ParsedPiece, foods: Food[]): MealItem[] | null {
  const run = splitRun(p.query.split(' '), foods);
  if (!run) return null;
  // "whey protein shake": both halves name the same food, so it's one serving of it, not two.
  const distinct = run.filter((f, i) => run.findIndex(x => x.id === f.id) === i);
  return distinct.map((f, i) => (i === 0 ? itemFor(f, p.qty, defaultUnit(f, p)) : itemFor(f, 1, defaultUnit(f, { ...p, unit: undefined, counted: false }))));
}

/** Match typed food to the list, on the device. Unmatched pieces go to REI to estimate. */
export function matchMealText(text: string, foods: Food[]): TextMatch {
  const items: MealItem[] = [], unmatched: string[] = [];
  const pieces = splitMealText(text);
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    // "oats with milk", "bread and butter": a dish whose own name has the joining word in it.
    const next = pieces[i + 1];
    const joined = next?.sep && !next.counted && !next.unit && !p.whole && !p.unit && p.qty === 1 ? exactFood(`${p.query} ${next.sep} ${next.query}`, foods) : null;
    if (joined) {
      items.push(itemFor(joined, p.qty, defaultUnit(joined, p)));
      i++;
      continue;
    }
    // "chicken 65", "burrito bowl": the whole thing is a food's name.
    const named = p.whole ? exactFood(p.whole, foods) : null;
    if (named) {
      const lead = PIECE_RE.exec(p.text)!;
      const q = lead[1] || lead[2] ? amount(lead[1], lead[2]) : 1;
      const asTyped: ParsedPiece = { text: p.text, qty: q > 0 ? q : 1, query: p.whole!, counted: !!(lead[1] || lead[2]) };
      items.push(itemFor(named, asTyped.qty, defaultUnit(named, asTyped)));
      continue;
    }
    const m = confident(searchFoods(p.query, foods, 3), p.query);
    const run = m ? null : runItems(p, foods);
    if (m) items.push(itemFor(m.food, p.qty, defaultUnit(m.food, p)));
    else if (run) items.push(...run);
    else unmatched.push(p.text);
  }
  return { items, unmatched };
}

/**
 * The food a name means, when the list has it for sure ("roti", "paneer butter masala"): for foods
 * REI names itself instead of picking from the list (on calls, from photos, or in another language).
 */
export function foodByName(name: string, foods: Food[]): Food | null {
  const q = normalize(name);
  if (!q) return null;
  return exactFood(q, foods) ?? confident(searchFoods(q, foods, 3), q)?.food ?? null;
}

/** Foods REI may pick from for this message: the best few for each piece. */
export function foodCandidates(text: string, foods: Food[], max = 16): Food[] {
  const seen = new Map<string, Food>();
  for (const p of splitMealText(text)) for (const q of p.whole ? [p.whole, p.query] : [p.query]) for (const m of searchFoods(q, foods, 4)) if (m.coverage >= 1) seen.set(m.food.id, m.food);
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
  /** REI's estimate of fibre, sugar and saturated fat (g) and sodium (mg), when it gave one. */
  fib?: number;
  sug?: number;
  sfa?: number;
  na?: number;
}

/** Use the list's numbers for anything REI matched; keep REI's estimate for the rest. */
export function resolveAiItems(items: AiItem[], foods: Food[]): MealItem[] {
  const byId = new Map(foods.map(f => [f.id, f]));
  return items.map(i => {
    const picked = byId.get(i.food_id);
    // Not picked from the list (or a made-up id): the list may still have it under the name REI gave.
    const food = picked ?? foodByName(i.name, foods) ?? undefined;
    const n = cleanNutrients({ fib: i.fib, sug: i.sug, sfa: i.sfa, na: i.na });
    if (food && i.qty > 0) {
      const listed = itemFor(food, i.qty, i.unit);
      if (!(i.kcal > 0)) return listed;
      // REI sometimes sends grams with a portion unit ("100 banana" for 100 g, "16 tbsp" for 16 g).
      // Its own estimate for the item is the check: take the reading closest to it, or its estimate.
      const off = (k: number) => Math.abs(Math.log((k + 10) / (i.kcal + 10)));
      /** Up to 2 kg and 2,000 kcal of one food: anything more is a mix-up, not a meal. */
      const believable = (x: MealItem) => x.kcal <= 2000 && (food.serving || x.g <= 2000);
      // "6" of a "6 puris" portion usually means six puris, not six plates.
      const perPiece = piecesIn(unitFor(food, i.unit)) ? [itemFor(food, i.qty, 'piece')] : [];
      const readings = (unitFor(food, i.unit).n === 'g' ? [listed] : [listed, ...perPiece, itemFor(food, i.qty, 'g')]).filter(believable);
      const best = readings.length ? readings.reduce((x, y) => (off(y.kcal) < off(x.kcal) ? y : x)) : null;
      if (best && off(best.kcal) <= Math.log(2.5)) return best;
      // Nothing agrees: a food REI picked from the list wins while its amount is believable (REI's guess
      // may be the wrong one). A food matched by its name alone has to agree with REI's numbers to
      // replace them; otherwise REI's own estimate is kept.
      if (picked && believable(listed)) return listed;
    }
    return { food: '', name: i.name, qty: i.qty > 0 ? i.qty : 1, unit: i.unit || 'serving', g: 0, kcal: Math.round(i.kcal), p: r1(i.p), c: r1(i.c), f: r1(i.f), ...(n ? { n } : {}) };
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
  // Label nutrients per 100 g; OFF gives everything in grams, so minerals and vitamins are converted.
  const label = cleanNutrients({
    fib: num('fiber_100g'), sug: num('sugars_100g'), sfa: num('saturated-fat_100g'), na: num('sodium_100g') * 1000,
    k: num('potassium_100g') * 1000, ca: num('calcium_100g') * 1000, fe: num('iron_100g') * 1000, mg: num('magnesium_100g') * 1000, zn: num('zinc_100g') * 1000,
    va: num('vitamin-a_100g') * 1e6, vc: num('vitamin-c_100g') * 1000, vd: num('vitamin-d_100g') * 1e6,
  });
  return {
    id: `b:${code}`, name: name.slice(0, 60), brand, barcode: code, per: 100,
    kcal: Number.isFinite(kcal) ? Math.round(kcal) : kcalOf(safe(p), safe(c), safe(f)),
    p: safe(p), c: safe(c), f: safe(f), units, src: 'barcode', ...(label ? { n: label } : {}),
  };
}

/** Save a logged meal as one of your foods, counted in servings. */
export function foodFromMeal(meal: Meal, id: string): Food {
  return { id, name: meal.name, per: 1, kcal: meal.kcal, p: meal.p, c: meal.c, f: meal.f, units: [{ n: 'serving', g: 1 }], src: 'mine', serving: true, ...(meal.n ? { n: meal.n } : {}) };
}

/** Basic checks before a food is stored (also enforced by the security rules). */
export function validFood(f: Food): boolean {
  const ok = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
  return typeof f.id === 'string' && /^[a-z]:[A-Za-z0-9_-]{1,40}$/.test(f.id) && typeof f.name === 'string' && f.name.trim().length > 0 && f.name.length <= 80
    && ok(f.per, 5000) && f.per > 0 && ok(f.kcal, 10000) && ok(f.p, 1000) && ok(f.c, 2000) && ok(f.f, 1000)
    && Array.isArray(f.units) && f.units.length > 0 && f.units.length <= 6 && f.units.every(u => typeof u.n === 'string' && u.n.length <= 24 && ok(u.g, 5000) && u.g > 0);
}
