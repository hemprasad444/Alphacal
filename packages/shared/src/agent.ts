// The live voice agent (our LiveKit + Fish agent, voice-agent/): REI's prompt for a session, and the actions it can take.
// The phone carries out each action (app/src/components/LiveVoice.tsx, whose tools map is typed to match).
import { nutrition } from './derive';
import { catalog, type Food, itemFor, matchMealText, mealFromItems, resolveAiItems } from './food';
import { MEMORY_KINDS, type MemoryKind } from './memory';
import { GROUNDING, PROFILE_KEYS, systemContext, systemRules, type ReiContext } from './rei';
import type { Meal, Message, Profile, ProfileKey } from './types';
import { WORKOUT_KINDS } from './workout';

/** The foods the live model is anchored on: [food id, amount, portion, how it's said]. */
const ANCHOR_FOODS: [string, number, string, string][] = [
  ['d:masala-dosa', 1, 'dosa', 'masala dosa'], ['d:dosa', 1, 'dosa', 'plain dosa'], ['d:idli', 1, 'idli', 'idli'], ['d:sambar', 1, 'katori', 'katori of sambar'],
  ['d:roti', 1, 'roti', 'roti or chapati'], ['d:paratha', 1, 'paratha', 'plain paratha'], ['d:aloo-paratha', 1, 'paratha', 'aloo paratha'], ['d:rice', 1, 'katori', 'katori of cooked rice'],
  ['d:dal', 1, 'katori', 'katori of dal'], ['d:paneer-butter-masala', 1, 'katori', 'katori of paneer butter masala'], ['d:chicken-curry', 1, 'katori', 'katori of chicken curry'],
  ['d:chicken-biryani', 1, 'plate', 'home plate of chicken biryani (300 g)'], ['d:chicken-fried-rice', 1, 'plate', 'plate of chicken fried rice'], ['d:maggi', 1, 'pack', 'pack of instant noodles'],
  ['d:boiled-egg', 1, 'egg', 'egg'], ['d:poha', 1, 'plate', 'plate of poha'], ['d:samosa', 1, 'samosa', 'samosa'], ['d:coffee', 1, 'cup', 'coffee with milk'], ['d:chai', 1, 'cup', 'chai with sugar'], ['d:coke', 1, 'can', '330 ml cola'],
];

let anchorText: string | null = null;
/**
 * Calorie anchors for the live model. Fast models guess Indian meals 30-50% low without them
 * (3 rotis with paneer butter masala at 350 kcal). The numbers are read from the food list, so what
 * REI is told on a call and what the app logs can never disagree.
 */
export function calorieAnchors(): string {
  if (anchorText === null) {
    const byId = new Map(catalog().map(f => [f.id, f]));
    const parts = ANCHOR_FOODS.flatMap(([id, qty, unit, label]) => {
      const food = byId.get(id);
      return food ? [`${label} ${itemFor(food, qty, unit).kcal}`] : [];
    });
    anchorText = `Calorie anchors, in kcal, from the app's food database (a katori is a 150 g home bowl; scale for the amount; restaurant portions are bigger, a restaurant biryani plate is about 500 g): ${parts.join(', ')}. Never round a full meal down; when unsure, estimate higher. Protein×4 + carbs×4 + fat×9 must come out close to the calories. Say numbers as plain digits (1250, not 1 250 or one-two-fifty) and never mix digits with number words.`;
  }
  return anchorText;
}

const FORGET = ' If something you remember stops being true, call forget with its id (the one in square brackets).';

/** What REI does on a call; `forget` only when this app build handles it (see liveTools). */
const actions = (forget: boolean) => `If they tell you they ate something, react to how it fits what's left today, then call log_meal: one entry in items per food, named in English, in the amount they said (one usual serving when they gave none), plus your realistic estimate for the whole meal (Indian home portions unless they say otherwise). The app looks each item up in its food database and uses those numbers, so name foods plainly ("roti", "dal", "chicken biryani"). ${calorieAnchors()} Only log a meal they clearly say they ate or are eating; if they don't say what they ate, ask; if the food you heard sounds odd (speech recognition mishears food names) or might be one already logged today, ask before logging. If they say a logged meal is wrong or ask to remove it, call remove_meal with its name, then log the right one if they gave it. If they tell you they trained, played a sport, ran, walked or cycled today, react, then call log_workout once per activity with the minutes they said (and distance if they gave one). If they didn't say how long it was, do not call log_workout and never guess a duration: ask how long it took, and log it once they answer. ${GROUNDING} After a tool result gives you newer totals, use those. If they explicitly ask to change their goal, deadline, a body stat, a daily target, their usual training time or their bedtime, call update_vow once per value. When they tell you what they weighed today, call update_vow with field weight: it's their weigh-in. When they tell you a lasting fact about themselves (diet, allergy, injury, schedule, equipment, likes, life constraints), call remember with a short third-person note.${forget ? FORGET : ''} If they ask for a new or changed training plan, call rebuild_program and tell them the new week is on its way. Keep the conversation flowing around these actions and never mention tools. Whatever language you speak, write meal and workout names in your actions in English ("rajma chawal", "2 idli with sambar").`;

/**
 * Where a live call stays. On a call the fast model read Python code aloud for 30 seconds when asked,
 * and invented its own setup ("GPT-4", "running inside your iPhone").
 */
const SCOPE = `This is a live voice call: everything you write is spoken aloud. Never write code, markdown, lists, links, emoji or symbols; only short spoken sentences. You're their fitness and life coach: if they ask for something outside that (writing code, homework, essays, long stories, news, anything that needs a screen), say in one line that's not your thing and steer back to them. You are REI. Never say which AI model, company, server or technology you run on, or who built or manages you; laugh it off in character ("I'm REI, that's all you need to know") and move on. Don't make up facts about yourself or the app.`;

/**
 * The language of the call. Without a rule this firm, the fast model heard Hindi and Telugu perfectly and still
 * answered in English.
 */
const LANGUAGE = `Language: reply in the language of their latest message. Hindi gets a reply fully in Hindi (Devanagari script), Telugu fully in Telugu script, Tamil in Tamil, any other language in that language; Hinglish or another mix gets the same mix; English gets English. Never answer Hindi, Telugu or any other language in English unless they ask you to. If they ask you to switch language, switch and stay in it. Audio tags always stay in English, whatever the language: [excited], never [उत्साहित].`;

/**
 * The whole system prompt for one live session: personality, voice rules, actions and today's numbers.
 * `tools` are the ones this call offers, so REI isn't told about one the phone can't carry out.
 */
export function agentPrompt(x: ReiContext, tools: readonly string[] = LIVE_TOOL_NAMES): string {
  return `${systemRules({ tough: x.tough, bro: x.bro, nudge: x.nudge, tools: false, voice: true, actions: actions(tools.includes('forget')) })}\n\n${SCOPE}\n\n${LANGUAGE}\n\n${systemContext(x)}`;
}

export function agentGreeting(x: Pick<ReiContext, 'bro' | 'tough'>): string {
  return x.bro ? 'Yo, what’s good?' : x.tough ? 'REI here. Talk to me.' : 'Hey, it’s REI. What’s going on?';
}

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });
const num = (description: string) => ({ type: 'number', description });
const tool = <N extends string>(name: N, description: string, properties: Record<string, unknown>) => ({
  name,
  description,
  parameters: { type: 'object', required: Object.keys(properties), properties },
});

/** What REI can do on a live call, as function schemas for the agent (voice-agent/agent.py); the phone carries them out. */
export const LIVE_TOOLS = [
  tool('log_meal', 'Log a meal the user says they ate: each food with its amount, and one estimate for the whole meal.', {
    name: str('Short name for the meal, in English, e.g. "Dal rice and curd"'),
    // App builds from before 16 November 2026 ignore `items` and log the totals below.
    items: {
      type: 'array',
      description: 'Each food in the meal, in the amount they said (1 usual serving when they gave none)',
      items: {
        type: 'object',
        required: ['name', 'qty', 'unit', 'kcal'],
        properties: {
          name: str('The food in plain English, e.g. "roti", "dal", "chicken biryani", "boiled egg"'),
          qty: num('How many of unit, e.g. 2'),
          unit: str('piece, katori, plate, cup, glass, tbsp, scoop, slice or g'),
          kcal: num('Your calorie estimate for this amount'),
        },
      },
    },
    kcal: num('Total calories'),
    protein: num('Protein, grams'),
    carbs: num('Carbohydrates, grams'),
    fat: num('Fat, grams'),
    fiber: num('Fibre, grams'),
  }),
  tool('remove_meal', 'Remove a meal logged today, when the user says it is wrong or asks to delete it.', {
    name: str('Name of the logged meal to remove, as it appears in today’s meals'),
  }),
  tool('log_workout', 'Log a workout, sport or activity the user says they did today.', {
    kind: str('session for gym or home training, run/walk/cycle for distance cardio, activity for a sport or anything else', { enum: [...WORKOUT_KINDS] }),
    name: str('What they did, in a few words, e.g. "leg day", "football", "yoga"'),
    minutes: num('How long, in minutes, as they said it. Never a guess: if they did not say, ask them instead of calling this'),
    km: num('Distance in km for a run, walk or ride; 0 if not given'),
  }),
  tool('update_vow', 'Change one of the user’s goal, deadline, body stats or daily targets when they explicitly ask, or record the weight they weighed today.', {
    field: str('Which value to change', { enum: [...PROFILE_KEYS] }),
    value: str('New value. Numbers as plain digits; deadline as YYYY-MM-DD; sessionTime and bedtime as HH:MM (24-hour).'),
  }),
  tool('remember', 'Keep a lasting fact about the user for all future conversations.', {
    fact: str('Short third-person note, e.g. "Vegetarian; eats eggs"'),
    kind: str('What kind of fact', { enum: [...MEMORY_KINDS] }),
  }),
  tool('forget', 'Drop a remembered fact that is no longer true.', {
    id: str('The id of the remembered fact, the one shown in square brackets'),
  }),
  tool('rebuild_program', 'Rewrite this week’s training plan when the user asks for a new or changed plan.', {
    focus: str('What they want changed, in a few words'),
  }),
];

/** Recent chat, oldest first, so a live call picks up where the conversation left off. */
export function recentTurns(messages: Message[], n = 12): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter(m => m.role !== 'sys' && !m.alert && m.text.trim())
    .slice(-n)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text.trim().slice(0, 400) }));
}

/** The same recent chat as a prompt block, for writing the call's opener. */
export function historyBlock(turns: { role: 'user' | 'assistant'; content: string }[]): string {
  if (!turns.length) return '';
  const lines = turns.map(t => `${t.role === 'user' ? 'THEM' : 'YOU'}: ${t.content.replace(/\s+/g, ' ')}`);
  return `\n\nRECENT CONVERSATION (text and voice, oldest first; continue from it, don't repeat it; anything asked in it was already handled, so act only on what they ask now):\n${lines.join('\n')}`;
}

export type LiveTool = (typeof LIVE_TOOLS)[number]['name'];
export const LIVE_TOOL_NAMES: readonly LiveTool[] = LIVE_TOOLS.map(t => t.name);

/** Tools every app build handles. Builds from before 16 October 2026 don't say which they handle, and have only these. */
const FIRST_TOOLS: readonly string[] = ['log_meal', 'remove_meal', 'log_workout', 'update_vow', 'remember', 'rebuild_program'];

/**
 * The live tools for one call: the ones the app says it handles when it asks for a session, so an
 * older build is never sent a tool it would answer with an error.
 */
export function liveTools(handled: unknown): typeof LIVE_TOOLS {
  const names = Array.isArray(handled) ? handled.filter((n): n is string => typeof n === 'string') : FIRST_TOOLS;
  return LIVE_TOOLS.filter(t => names.includes(t.name));
}

export function memoryKind(kind: unknown): MemoryKind {
  return MEMORY_KINDS.includes(kind as MemoryKind) ? (kind as MemoryKind) : 'life';
}

/** The latest of today's meals matching a spoken name ("the chicken bread"), or -1. */
export function mealIndex(meals: Meal[], name: string): number {
  const want = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(the|a|an|that|my)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!want) return -1;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = meals.length - 1; i >= 0; i--) if (norm(meals[i].name) === want) return i;
  for (let i = meals.length - 1; i >= 0; i--) {
    const have = norm(meals[i].name);
    if (have.includes(want) || want.includes(have)) return i;
  }
  return -1;
}

/** Today's totals against targets, told to the live agent after it logs something so it never works from stale numbers. */
export function todayLine(profile: Profile, meals: Meal[]): string {
  const nu = nutrition(meals, { steps: null, sleep: null, sleepL: '' });
  const kL = (parseFloat(profile.kcal) || 0) - nu.kcal, pL = Math.max(0, (parseFloat(profile.protein) || 0) - nu.protein);
  const left = kL >= 0 ? `${kL} kcal and ${pL} g protein left` : `${-kL} kcal over, ${pL} g protein still to go`;
  return `Today now: ${nu.kcal} of ${profile.kcal} kcal, protein ${nu.protein} of ${profile.protein} g, carbs ${nu.carbs} of ${profile.carbs} g, fat ${nu.fat} of ${profile.fat} g (${left}).`;
}

/** Words around the food in what they said ("I just had 2 eggs and a banana for breakfast"). */
const FILLER = /\b(i|i've|ive|i'm|im|just|had|have|having|ate|eaten|eating|drank|drink|finished|got|for|my|as|at|in|the morning|this morning|tonight|today|breakfast|brunch|lunch|dinner|supper|snack|pre workout|post workout|bro|yo|so|then|also|like|some|um|uh|okay|ok)\b/gi;

export interface LiveMealEstimate {
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

/** One food of a meal as the live agent names it: an amount and its own calorie guess. */
export interface LiveMealItem {
  name: string;
  qty: number;
  unit: string;
  kcal: number;
}

/** The `items` of a live log_meal call, checked: up to 12 named foods with a sane amount. */
export function liveMealItems(raw: unknown): LiveMealItem[] {
  if (!Array.isArray(raw)) return [];
  const out: LiveMealItem[] = [];
  for (const r of raw.slice(0, 12)) {
    const o = (r ?? {}) as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 60) : '';
    const qty = Number(o.qty), kcal = Number(o.kcal);
    if (!name) continue;
    out.push({ name, qty: Number.isFinite(qty) && qty > 0 && qty <= 5000 ? qty : 1, unit: typeof o.unit === 'string' ? o.unit.trim().toLowerCase().slice(0, 24) : '', kcal: Number.isFinite(kcal) && kcal > 0 && kcal <= 6000 ? Math.round(kcal) : 0 });
  }
  return out;
}

/**
 * A meal REI estimated on a call, checked before it's stored. The food list's numbers win wherever
 * it has the food, so a call logs the same meal the way chat does:
 *  1. every item REI named is on the list (and agrees with REI's guess for it): the list's numbers;
 *  2. everything they said is on the list and REI's total is in the same range: the list's numbers;
 *  3. some items are on the list: those from the list, the rest REI's estimate for them;
 *  4. nothing is: REI's estimate, kept only if its macros add up to its calories (one call logged
 *     2 eggs and a banana as 7 g protein, 0 g fat). If not, REI is asked to redo it.
 * `items` is the log_meal call's own list of foods; older agents send none.
 */
export function checkLiveMeal(est: LiveMealEstimate, said: string, foods: Food[], time: string, retried = false, items?: unknown): { meal: Meal } | { redo: string } {
  const fromMacros = est.p * 4 + est.c * 4 + est.f * 9;
  // An item the list doesn't have keeps REI's calories, with the whole meal's macro split.
  const named = liveMealItems(items).map(i => {
    const k = fromMacros > 0 ? i.kcal / fromMacros : 0;
    return { food_id: 'none', name: i.name, qty: i.qty, unit: i.unit, kcal: i.kcal, p: Math.round(est.p * k), c: Math.round(est.c * k), f: Math.round(est.f * k) };
  });
  const resolved = named.length ? resolveAiItems(named, foods) : [];
  const listedAll = resolved.length > 0 && resolved.every(i => i.food);
  if (listedAll) return { meal: mealFromItems(resolved, time, 'ai', est.name) };
  const spoken = said.replace(FILLER, ' ').replace(/[.!?]/g, ' ').replace(/\s+/g, ' ').trim();
  if (spoken) {
    const m = matchMealText(spoken, foods);
    if (m.items.length && !m.unmatched.length) {
      const listed = mealFromItems(m.items, time, 'ai', est.name);
      if (listed.kcal >= est.kcal * 0.6 && listed.kcal <= est.kcal * 1.6) return { meal: listed };
    }
  }
  // Part of it is on the list: those items from the list, the rest as REI estimated them.
  if (resolved.some(i => i.food) && resolved.every(i => i.food || i.kcal > 0)) return { meal: mealFromItems(resolved, time, 'ai', est.name) };
  const off = Math.abs(fromMacros - est.kcal) > Math.max(60, est.kcal * 0.3);
  const meal: Meal = { time, name: est.name, kcal: est.kcal, p: est.p, c: est.c, f: est.f, src: 'ai' };
  if (!off) return { meal };
  // Asked once already: scale the macros to the calories rather than ask again mid-conversation.
  if (retried && fromMacros > 0) {
    const k = est.kcal / fromMacros;
    return { meal: { ...meal, p: Math.round(est.p * k), c: Math.round(est.c * k), f: Math.round(est.f * k) } };
  }
  return { redo: `Not logged: protein ${est.p} g, carbs ${est.c} g and fat ${est.f} g add up to ${Math.round(fromMacros)} kcal, not ${est.kcal}. Re-estimate the whole meal so protein×4 + carbs×4 + fat×9 is close to the calories, then call log_meal again without mentioning it.` };
}
