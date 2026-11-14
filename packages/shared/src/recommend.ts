// What to eat next and what to do next, from rules. Given what's left today, the time, what they eat
// and don't, what they've already had and the training plan, this proposes two or three real meals
// with portions and macros straight from the food list, plus the next training action. REI is handed
// these as facts and picks and phrases; it doesn't invent a meal or its numbers.
import { SESSION_TIME, type SessionPlan, type WeekProgram } from './data';
import { nextPlan } from './derive';
import { amountLabel, catalog, type Food, itemFor, mealFromItems } from './food';
import { span } from './facts';
import type { MemoryItem } from './memory';
import { clockMinutes } from './time';
import type { Meal, MealItem, Nutrition, Profile } from './types';

export type Diet = 'vegan' | 'veg' | 'egg' | 'nonveg';
export type Slot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'late';

/** Vegan food suits everyone; meat only suits someone who eats it. */
const RANK: Record<Diet, number> = { vegan: 0, veg: 1, egg: 2, nonveg: 3 };

type Tag = 'dairy' | 'gluten' | 'nuts' | 'peanut' | 'egg' | 'fish' | 'chicken' | 'mutton' | 'soy' | 'whey' | 'rice' | 'paneer' | 'caffeine';

interface Template {
  slots: Slot[];
  diet: Diet;
  /** [food id, amount, portion, scalable]: scalable items grow or shrink to fit what's left. */
  items: [string, number, string, boolean?][];
  tags: Tag[];
}

const T = (slots: Slot[], diet: Diet, items: Template['items'], tags: Tag[] = []): Template => ({ slots, diet, items, tags });
const MAIN: Slot[] = ['lunch', 'dinner'];
const LIGHT: Slot[] = ['snack', 'late'];

/**
 * Everyday Indian meals, each built from rows of the food list (so the numbers are the list's, never
 * typed in here). Order matters only to break ties.
 */
const TEMPLATES: Template[] = [
  // Breakfast
  T(['breakfast'], 'vegan', [['d:idli', 3, 'idli', true], ['d:sambar', 1, 'katori']]),
  T(['breakfast'], 'veg', [['d:oats', 1, 'bowl', true], ['i:E012', 1, 'banana']], ['dairy', 'gluten']),
  T(['breakfast'], 'veg', [['d:besan-chilla', 2, 'chilla', true], ['d:curd', 1, 'katori']], ['dairy']),
  T(['breakfast'], 'veg', [['d:poha', 1, 'katori', true], ['d:curd', 1, 'katori']], ['dairy']),
  T(['breakfast'], 'veg', [['d:paneer-bhurji', 1, 'katori'], ['d:roti', 2, 'roti', true]], ['dairy', 'gluten', 'paneer']),
  T(['breakfast'], 'vegan', [['d:moong-chilla', 2, 'chilla', true], ['d:sprouts', 1, 'katori']]),
  T(['breakfast'], 'veg', [['d:greek-yogurt', 1, 'cup'], ['i:E012', 1, 'banana'], ['d:almonds', 1, '10 almonds']], ['dairy', 'nuts']),
  T(['breakfast'], 'egg', [['d:omelette', 1, 'omelette', true], ['d:brown-bread', 2, 'slice', true]], ['egg', 'gluten']),
  T(['breakfast'], 'egg', [['d:boiled-egg', 3, 'egg', true], ['d:brown-bread', 2, 'slice'], ['i:E012', 1, 'banana']], ['egg', 'gluten']),
  T(['breakfast'], 'veg', [['d:protein-shake-milk', 1, 'shake'], ['i:E012', 1, 'banana']], ['dairy', 'whey']),
  // Lunch and dinner
  T(MAIN, 'veg', [['d:roti', 2, 'roti', true], ['d:dal', 1, 'katori', true], ['d:mixed-veg', 1, 'katori'], ['d:curd', 1, 'katori']], ['dairy', 'gluten']),
  T(MAIN, 'vegan', [['d:rajma', 1, 'katori', true], ['d:rice', 1, 'katori', true], ['d:salad', 1, 'katori']], ['rice']),
  T(MAIN, 'veg', [['d:paneer-bhurji', 1, 'katori', true], ['d:roti', 2, 'roti', true], ['d:salad', 1, 'katori']], ['dairy', 'gluten', 'paneer']),
  T(MAIN, 'vegan', [['d:soya-chunks', 1, 'katori', true], ['d:rice', 1, 'katori', true], ['d:mixed-veg', 1, 'katori']], ['soy', 'rice']),
  T(MAIN, 'vegan', [['d:chole', 1, 'katori', true], ['d:roti', 2, 'roti', true], ['d:salad', 1, 'katori']], ['gluten']),
  T(MAIN, 'veg', [['d:palak-paneer', 1, 'katori'], ['d:roti', 2, 'roti', true]], ['dairy', 'gluten', 'paneer']),
  T(MAIN, 'veg', [['d:khichdi', 1, 'katori', true], ['d:curd', 1, 'katori']], ['dairy', 'rice']),
  T(MAIN, 'vegan', [['d:tofu', 150, 'g', true], ['d:rice', 1, 'katori', true], ['d:mixed-veg', 1, 'katori']], ['soy', 'rice']),
  T(MAIN, 'vegan', [['d:dal', 1, 'katori', true], ['d:rice', 1, 'katori', true], ['d:mixed-veg', 1, 'katori']], ['rice']),
  T(MAIN, 'egg', [['d:egg-curry', 1, 'katori'], ['d:roti', 2, 'roti', true], ['d:salad', 1, 'katori']], ['egg', 'gluten']),
  T(MAIN, 'egg', [['d:egg-bhurji', 1, 'katori', true], ['d:roti', 2, 'roti', true], ['d:salad', 1, 'katori']], ['egg', 'gluten']),
  T(MAIN, 'nonveg', [['d:grilled-chicken', 150, 'g', true], ['d:rice', 1, 'katori', true], ['d:salad', 1, 'katori']], ['chicken', 'rice']),
  T(MAIN, 'nonveg', [['d:chicken-curry', 1, 'katori', true], ['d:roti', 2, 'roti', true], ['d:salad', 1, 'katori']], ['chicken', 'gluten']),
  T(MAIN, 'nonveg', [['d:fish-curry', 1, 'katori', true], ['d:rice', 1, 'katori', true], ['d:salad', 1, 'katori']], ['fish', 'rice']),
  T(MAIN, 'nonveg', [['d:tandoori-chicken', 2, 'piece', true], ['d:roti', 1, 'roti', true], ['d:salad', 1, 'katori']], ['chicken', 'gluten']),
  T(MAIN, 'nonveg', [['d:chicken-biryani', 0.5, 'plate', true], ['d:raita', 1, 'katori']], ['chicken', 'rice', 'dairy']),
  // Snacks and late
  T(LIGHT, 'veg', [['d:whey', 1, 'scoop'], ['d:water', 1, 'glass']], ['dairy', 'whey']),
  T(LIGHT, 'vegan', [['d:roasted-chana', 1, 'handful', true]]),
  T(LIGHT, 'vegan', [['d:sprouts', 1, 'katori', true]]),
  T(LIGHT, 'veg', [['d:greek-yogurt', 1, 'cup']], ['dairy']),
  T(LIGHT, 'egg', [['d:boiled-egg', 2, 'egg', true]], ['egg']),
  T(LIGHT, 'veg', [['i:L003', 100, 'g', true]], ['dairy', 'paneer']),
  T(['snack'], 'vegan', [['i:E012', 1, 'banana'], ['d:peanut-butter', 1, 'tbsp']], ['peanut', 'nuts']),
  T(['snack'], 'veg', [['d:chaas', 1, 'glass'], ['d:makhana', 1, 'bowl']], ['dairy']),
  T(['snack'], 'vegan', [['i:E001', 1, 'apple'], ['d:almonds', 1, '10 almonds']], ['nuts']),
  T(['snack'], 'nonveg', [['d:chicken-tikka', 6, 'piece', true]], ['chicken']),
];

/** Before training: quick carbs, little fat. */
const PRE_WORKOUT: Template[] = [
  T(['snack'], 'vegan', [['i:E012', 1, 'banana'], ['d:black-coffee', 1, 'cup']], ['caffeine']),
  T(['snack'], 'vegan', [['i:E012', 2, 'banana']]),
  T(['snack'], 'veg', [['d:brown-bread', 2, 'slice'], ['d:peanut-butter', 1, 'tbsp']], ['gluten', 'peanut', 'nuts']),
];

/** Every food the suggestions are built from, to check the food list still has each one. */
export const suggestionFoodIds = () => [...new Set([...TEMPLATES, ...PRE_WORKOUT].flatMap(t => t.items.map(i => i[0])))];

const NON_VEG = /\bnon[- ]?veg(?:etarian)?\b/i;

/** How they eat, from what they told REI (their onboarding diet and remembered facts). */
export function dietOf(texts: string[]): Diet {
  const s = texts.join(' . ').toLowerCase();
  if (/\bvegan\b/.test(s)) return 'vegan';
  // Fish but no meat: everything is open except the meat, which avoidedTags rules out.
  if (/\bpescatarian\b/.test(s)) return 'nonveg';
  const noEggs = /\b(no|not|never|without|doesn['’]?t eat|does not eat|don['’]?t eat|avoids?)\s+(?:any\s+)?eggs?\b/.test(s);
  if (/\beggetarian|eggitarian|ovo[- ]?veg/.test(s)) return 'egg';
  const veg = /\b(pure[- ]veg(?:etarian)?|vegetarian|veg\b|jain|no meat|doesn['’]?t eat meat|does not eat meat)/.test(s.replace(NON_VEG, ' '));
  if (veg) return !noEggs && /\beats? eggs?\b|\beggs? (?:are |is )?(?:ok|okay|fine)\b|\bwith eggs?\b|\band eggs?\b|\+\s*eggs?\b/.test(s) ? 'egg' : 'veg';
  return 'nonveg';
}

const AVOID: [RegExp, Tag[]][] = [
  [/lactose|dairy|milk/, ['dairy', 'whey', 'paneer']],
  [/gluten|celiac|coeliac|wheat/, ['gluten']],
  [/peanut|groundnut/, ['peanut']],
  [/\bnuts?\b|almond|cashew|walnut/, ['nuts', 'peanut']],
  [/\beggs?\b/, ['egg']],
  [/fish|seafood|prawn|shellfish/, ['fish']],
  [/chicken/, ['chicken']],
  [/mutton|lamb|goat|red meat/, ['mutton']],
  [/soy|soya|tofu/, ['soy']],
  [/paneer/, ['paneer']],
  [/whey|protein powder|supplement/, ['whey']],
  [/\brice\b/, ['rice']],
  [/caffeine|coffee/, ['caffeine']],
];
/** "allergic to peanuts", "lactose intolerant", "no fish", "doesn't eat paneer", "hates soya", "avoids gluten". */
const NEGATION = /(allerg\w*(?: to)?|intoleran\w*|\bno\b|\bnot\b|never|without|doesn['’]?t (?:eat|like|drink)|does not (?:eat|like|drink)|don['’]?t (?:eat|like|drink)|can['’]?t (?:eat|have|drink)|cannot (?:eat|have)|avoids?|hates?|dislikes?|free\b)/;

/** What to keep off their plate, from remembered facts. */
export function avoidedTags(texts: string[]): Tag[] {
  const out = new Set<Tag>();
  for (const text of texts) {
    if (/\bpescatarian\b/i.test(text)) (['chicken', 'mutton'] as Tag[]).forEach(t => out.add(t));
    // Clause by clause, so "eats eggs; no fish" only rules out fish.
    for (const clause of text.toLowerCase().split(/[;.,]|\bbut\b/)) {
      if (!NEGATION.test(clause)) continue;
      for (const [re, tags] of AVOID) if (re.test(clause)) tags.forEach(t => out.add(t));
    }
  }
  return [...out];
}

export interface MealOption {
  /** "2 roti + 1 katori Dal, tadka + …". */
  label: string;
  items: MealItem[];
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export interface RecommendInput {
  /** Wall-clock time in their zone. */
  now: Date;
  profile: Profile;
  /** Today's totals so far. */
  nutrition: Nutrition;
  /** Today's meals. */
  meals: Meal[];
  /** Yesterday's meals, so the same dinner isn't suggested two nights running. */
  recent?: Meal[];
  memory?: Pick<MemoryItem, 'text' | 'kind'>[];
  plan: SessionPlan | null;
  sessionDone: boolean;
  program?: WeekProgram | null;
  /** Their own foods are not used here; pass a list only to test with a different catalog. */
  foods?: Food[];
}

export interface Recommendation {
  slot: Slot;
  diet: Diet;
  /** What's left today (negative when over). */
  left: { kcal: number; protein: number; carbs: number; fat: number };
  /** Calories this meal should come in around. */
  budget: number;
  meals: MealOption[];
  /** Why there are no meals, or a caution to pass on. */
  foodNote: string;
  /** The next training action. */
  training: string;
  /** Dinner options for later today, when it is still before the evening. */
  later?: { slot: 'dinner'; budget: number; meals: MealOption[] };
}

export function slotAt(now: Date): Slot {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m >= 5 * 60 && m < 11 * 60) return 'breakfast';
  if (m >= 11 * 60 && m < 15 * 60 + 30) return 'lunch';
  if (m >= 15 * 60 + 30 && m < 19 * 60) return 'snack';
  if (m >= 19 * 60 && m < 23 * 60) return 'dinner';
  return 'late';
}

/** The share of what's left that this meal may take: the rest of the day still has to eat. */
const SHARE: Record<Slot, number> = { breakfast: 0.3, lunch: 0.45, snack: 0.2, dinner: 0.85, late: 0.5 };
const num = (s: string) => parseFloat(s) || 0;

/** A step that makes sense on a plate: whole rotis and eggs, half katoris, 25 g. */
function scaled(qty: number, unit: string, k: number): number {
  const v = qty * k;
  if (unit === 'g') return Math.max(25, Math.round(v / 25) * 25);
  if (/^(katori|bowl|plate|cup|glass|shake|handful)$/.test(unit)) return Math.max(0.5, Math.round(v * 2) / 2);
  return Math.max(1, Math.round(v));
}

function build(t: Template, k: number, byId: Map<string, Food>): MealOption | null {
  const items: MealItem[] = [];
  for (const [id, qty, unit, scalable] of t.items) {
    const food = byId.get(id);
    if (!food) return null;
    items.push(itemFor(food, scalable ? scaled(qty, unit, k) : qty, unit));
  }
  const m = mealFromItems(items, '', 'food');
  return { label: items.filter(i => i.kcal > 0 || items.length === 1).map(describe).join(' + '), items, kcal: m.kcal, p: m.p, c: m.c, f: m.f };
}

/** "Dal, tadka" → "tadka dal"; "Banana, ripe, robusta" (an IFCT variety) → "banana"; "Omelette, 2 eggs" → "omelette (2 eggs)". */
function plainName(i: MealItem): string {
  const [head, ...tail] = i.name.split(',').map(x => x.trim().toLowerCase());
  if (!tail.length || i.food.startsWith('i:')) return head;
  return /^\d/.test(tail[0]) ? `${head} (${tail.join(', ')})` : `${tail.join(' ')} ${head}`;
}

/** One item as a person would say it: "2 roti", "1 katori tadka dal", "150 g grilled chicken breast", "10 almonds". */
function describe(i: MealItem): string {
  const name = plainName(i);
  const q = +i.qty.toFixed(2);
  if (/^\d/.test(i.unit)) return q === 1 ? i.unit : `${q} × ${i.unit}`;
  // The portion is the food itself ("roti", "egg", "banana"): "3 boiled eggs", not "3 egg boiled egg".
  if (i.unit !== 'g' && name.split(/[^a-z]+/).includes(i.unit)) return `${q} ${name}${q > 1 && !/(s|roti|idli)$/.test(name) && name.endsWith(i.unit) ? 's' : ''}`;
  if (i.unit === 'piece' || i.unit === 'slice') return `${q} ${i.unit}${q > 1 ? 's' : ''} of ${name}`;
  return `${amountLabel(i)} ${name}`;
}

const foodIds = (meals: Meal[]) => new Set(meals.flatMap(m => (m.items ?? []).map(i => i.food)).filter(Boolean));
const words = (meals: Meal[]) => new Set(meals.flatMap(m => m.name.toLowerCase().split(/[^a-z]+/)).filter(w => w.length >= 4));
/** The dish a meal is built around: its biggest item that isn't a staple side. */
const SIDES = new Set(['d:roti', 'd:rice', 'd:salad', 'd:curd', 'd:water', 'd:brown-bread', 'i:E012', 'd:raita']);
const mainOf = (t: Template) => t.items.find(([id]) => !SIDES.has(id))?.[0] ?? t.items[0][0];

function nextTraining(i: RecommendInput): string {
  const p = i.profile, nu = i.nutrition;
  const nowMin = i.now.getHours() * 60 + i.now.getMinutes();
  const at = clockMinutes(p.sessionTime) === null ? SESSION_TIME : p.sessionTime.trim();
  const bed = clockMinutes(p.bedtime) ?? 23 * 60;
  const toBed = ((bed - nowMin + 1440 + 360) % 1440) - 360;
  const stepsT = num(p.steps);
  const stepsLeft = nu.steps == null ? null : Math.max(0, Math.round(stepsT - nu.steps));
  // About 100 steps a minute at a brisk walk.
  const walk = stepsLeft === null ? (stepsT ? `Steps aren't synced today; the target is ${stepsT}.` : '') : stepsLeft > 0 ? `${stepsLeft} steps to go, about ${Math.max(5, Math.round(stepsLeft / 100 / 5) * 5)} min of brisk walking.` : 'Steps target is hit.';
  const next = nextPlan(i.now, i.program);
  const after = next ? ` Next session: ${next.day}, ${next.plan.title}.` : '';
  const proteinLeft = Math.max(0, Math.round(num(p.protein) - nu.protein));
  if (!i.plan) return `Rest day: no session. ${walk}${after}`.trim();
  if (i.sessionDone) return `Today's training is done. Recovery now: ${proteinLeft > 0 ? `${proteinLeft} g protein still to eat` : 'protein is hit'}, bed by ${p.bedtime || '23:00'}. ${walk}${after}`.trim();
  const until = clockMinutes(at)! - nowMin;
  const short = Math.min(30, i.plan.minutes);
  if (until > 0) return `${i.plan.title} (${i.plan.minutes} min) at ${at}, in ${span(until)}.${until <= 120 ? ' Eat something light with carbs about an hour before.' : ''} ${walk}`.trim();
  // Past its time: still worth doing while there's an hour of evening left after it.
  if (toBed >= short + 60) return `${i.plan.title} was due at ${at} (${span(-until)} ago) and isn't done: start now${toBed < i.plan.minutes + 60 ? `, the ${short}-minute version (main lifts only)` : ''}. ${walk}`.trim();
  return `${i.plan.title} wasn't done and bedtime (${p.bedtime || '23:00'}) is ${toBed > 0 ? `in ${span(toBed)}` : 'past'}: too late to train well. Sleep on time; don't stack it onto tomorrow without asking them.${after}`.trim();
}

let builtIn: Map<string, Food> | null = null;
const catalogById = () => (builtIn ??= new Map(catalog().map(f => [f.id, f])));

/** Meals and the next training action for this moment. Pure: same input, same answer. */
export function recommend(i: RecommendInput): Recommendation {
  const p = i.profile, nu = i.nutrition;
  const left = { kcal: Math.round(num(p.kcal) - nu.kcal), protein: Math.round(num(p.protein) - nu.protein), carbs: Math.round(num(p.carbs) - nu.carbs), fat: Math.round(num(p.fat) - nu.fat) };
  const memory = (i.memory ?? []).filter(m => m.kind === 'diet' || m.kind === 'health' || m.kind === 'preference').map(m => m.text);
  const diet = dietOf(memory);
  const avoid = new Set(avoidedTags(memory));
  const nowMin = i.now.getHours() * 60 + i.now.getMinutes();
  // A proper meal in the last two hours: the next thing to eat is the one after it, not the same meal again.
  const justAte = [...i.meals].reverse().find(m => {
    const at = clockMinutes(m.time);
    return m.kcal >= 250 && at !== null && nowMin - at >= 0 && nowMin - at <= 120;
  });
  const clock = slotAt(i.now);
  const slot: Slot = justAte && (clock === 'breakfast' || clock === 'lunch') ? 'snack' : justAte && clock === 'dinner' ? 'late' : clock;
  const training = nextTraining(i);
  const base = { slot, diet, left, training };

  const kcalT = num(p.kcal);
  if (!kcalT) return { ...base, budget: 0, meals: [], foodNote: 'No calorie target is set, so there is nothing to fit a meal to.' };
  const pLeft = Math.max(0, left.protein);
  if (left.kcal < 100) {
    return { ...base, budget: 0, meals: [], foodNote: left.kcal < 0 ? `They are ${-left.kcal} kcal over today's target: nothing more to eat. Water, black coffee or green tea only.` : `Only ${left.kcal} kcal left: nothing that counts as a meal fits. Water, black coffee or green tea.` };
  }
  // A session coming up within two hours: the snack is fuel for it.
  const at = clockMinutes(p.sessionTime) ?? clockMinutes(SESSION_TIME)!;
  const preWorkout = !!i.plan && !i.sessionDone && at - nowMin > 20 && at - nowMin <= 120 && (slot === 'snack' || slot === 'late');

  const byId = i.foods ? new Map(i.foods.map(f => [f.id, f])) : catalogById();
  const eatenIds = foodIds(i.meals), eatenWords = words(i.meals), recentIds = foodIds(i.recent ?? []);
  const doy = Math.floor((Date.UTC(i.now.getFullYear(), i.now.getMonth(), i.now.getDate()) - Date.UTC(i.now.getFullYear(), 0, 0)) / 86400000);

  /** The best `n` meals from `pool` for a meal of about `budget` kcal out of `room`, each built around a different dish. */
  const pick = (pool: Template[], budget: number, room: number, pTarget: number, n: number, fuel: boolean, skip: Set<string>) => {
    const scored: { opt: MealOption; main: string; score: number }[] = [];
    pool.forEach((t, idx) => {
      if (RANK[t.diet] > RANK[diet] || t.tags.some(tag => avoid.has(tag))) return;
      const main = mainOf(t);
      if (skip.has(main)) return;
      let best: MealOption | null = null;
      for (const k of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
        const opt = build(t, k, byId);
        if (!opt || opt.kcal > room || opt.kcal > budget * 1.15) continue;
        if (!best || Math.abs(opt.kcal - budget) < Math.abs(best.kcal - budget)) best = opt;
      }
      if (!best) return;
      const food = byId.get(main);
      const repeat = eatenIds.has(main) || (food ? food.name.toLowerCase().split(/[^a-z]+/).some(w => w.length >= 4 && eatenWords.has(w)) : false);
      const score =
        -Math.abs(best.kcal - budget) / Math.max(budget, 1) // close to the calories this meal should take
        - (fuel ? 0 : 1.5 * Math.max(0, pTarget - best.p) / Math.max(pTarget, 1)) // and to the protein it should carry
        - (repeat ? 0.6 : 0) // not what they already ate today
        - (recentIds.has(main) ? 0.2 : 0) // or last night
        + (RANK[t.diet] === RANK[diet] ? 0.05 : 0) // their own way of eating first
        + 0.03 * ((idx + doy) % 3); // a different order each day
      scored.push({ opt: best, main, score });
    });
    scored.sort((x, y) => y.score - x.score);
    const out: MealOption[] = [], mains: string[] = [];
    for (const sc of scored) {
      if (mains.includes(sc.main)) continue;
      mains.push(sc.main);
      out.push(sc.opt);
      if (out.length === n) break;
    }
    return { meals: out, mains };
  };

  const budget = Math.round(Math.min(left.kcal, Math.max(150, Math.min(left.kcal * SHARE[slot], kcalT * 0.45))));
  // Little left but protein still short: light, protein-first options whatever the hour.
  const lean = left.kcal < 300 || slot === 'late';
  const pool = preWorkout ? PRE_WORKOUT : TEMPLATES.filter(t => (lean ? t.slots.some(sl => LIGHT.includes(sl)) : t.slots.includes(slot)));
  const now = pick(pool, budget, left.kcal, Math.min(60, pLeft * SHARE[slot]), 3, preWorkout, new Set());

  // Before the evening, dinner as well: "what's for dinner?" at 2 pm has an answer that leaves room for it.
  let later: Recommendation['later'];
  const afterNow = left.kcal - budget;
  if ((slot === 'breakfast' || slot === 'lunch' || slot === 'snack') && afterNow >= 250) {
    const dinner = Math.round(Math.min(afterNow * SHARE.dinner, kcalT * 0.45));
    const d = pick(TEMPLATES.filter(t => t.slots.includes('dinner')), dinner, afterNow, Math.min(60, Math.max(0, pLeft - (now.meals[0]?.p ?? 0)) * SHARE.dinner), 2, false, new Set(now.mains));
    if (d.meals.length) later = { slot: 'dinner', budget: dinner, meals: d.meals };
  }
  const notes: string[] = [];
  if (justAte && slot !== clock) notes.push(`They ate ${justAte.name} at ${justAte.time}, so the next thing is ${slot === 'late' ? 'something light, if anything' : 'a snack'}.`);
  if (preWorkout) notes.push('Training is within two hours: these are light, carb-first options to fuel it.');
  if (!preWorkout && lean && slot !== 'snack') notes.push(left.kcal < 300 ? 'Little room left: light, protein-first options only.' : 'It is late: keep it light.');
  if (!now.meals.length) notes.push('Nothing on the standard list fits what is left and how they eat: build something lean around protein.');
  return { ...base, budget, meals: now.meals, foodNote: notes.join(' '), ...(later ? { later } : {}) };
}

const optionLines = (meals: MealOption[]) => meals.map((m, k) => `${k + 1}. ${m.label}: ${m.kcal} kcal, ${Math.round(m.p)} g protein, ${Math.round(m.c)} g carbs, ${Math.round(m.f)} g fat`).join('\n');

/** The block REI reads. */
export function suggestionsBlock(r: Recommendation): string {
  const left = r.left.kcal >= 0 ? `${r.left.kcal} kcal and ${Math.max(0, r.left.protein)} g protein left today` : `${-r.left.kcal} kcal over today`;
  const dietWord: Record<Diet, string> = { vegan: 'vegan', veg: 'vegetarian, no eggs', egg: 'vegetarian plus eggs', nonveg: 'eats everything' };
  const food = r.meals.length ? optionLines(r.meals) : '(no meal options)';
  const later = r.later ? `\nDINNER LATER (about ${r.later.budget} kcal, if the meal before it is about ${r.budget}):\n${optionLines(r.later.meals)}` : '';
  return `SUGGESTIONS (worked out by the app from their numbers, the time and the food database. When they ask what to eat, or what to do next, choose from these and say it your way, keeping the portions and numbers as written. They can swap in something they have at home; then say you'd need to log it to know its numbers. Never invent macros.)
FOOD NOW (${r.slot}; ${left}; ${dietWord[r.diet]}; this meal about ${r.budget} kcal):
${food}${r.foodNote ? `\n${r.foodNote}` : ''}${later}
TRAINING NEXT: ${r.training}`;
}
