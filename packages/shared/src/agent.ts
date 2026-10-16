// The live voice agent (our LiveKit + Fish agent, voice-agent/): REI's prompt for a session, and the actions it can take.
// The phone carries out each action (app/src/components/LiveVoice.tsx, whose tools map is typed to match).
import { nutrition } from './derive';
import { type Food, matchMealText, mealFromItems } from './food';
import { MEMORY_KINDS, type MemoryKind } from './memory';
import { PROFILE_KEYS, systemContext, systemRules, type ReiContext } from './rei';
import type { Meal, Message, Profile, ProfileKey } from './types';
import { WORKOUT_KINDS } from './workout';

/**
 * Calorie anchors for the live model. Fast models guess Indian meals 30-50% low without them
 * (3 rotis with paneer butter masala at 350 kcal); with them they match the big models.
 */
const ANCHORS = `Calorie anchors (scale for amounts; restaurant food runs about 30% higher): masala dosa 380 kcal each, plain dosa 170, idli 60 each, sambar bowl 130, coconut chutney 2 tbsp 90, roti or chapati 110, plain paratha 260, aloo paratha 330, cup of cooked rice 210, dal bowl 180, paneer butter masala bowl 480, chicken curry bowl 350, restaurant chicken biryani plate 850, chicken fried rice plate 750, Maggi pack 360, egg 75, poha plate 300, samosa 260, filter coffee with sugar 110, chai with sugar 90, cola 330 ml 140. Never round a full meal down; when unsure, estimate higher. Protein×4 + carbs×4 + fat×9 must come out close to the calories. Say numbers as plain digits (1250, not 1 250 or one-two-fifty) and never mix digits with number words.`;

const FORGET = ' If something you remember stops being true, call forget with its id (the one in square brackets).';

/** What REI does on a call; `forget` only when this app build handles it (see liveTools). */
const actions = (forget: boolean) => `If they tell you they ate something, react to how it fits what's left today, then call log_meal with your realistic estimate for the whole meal (Indian home portions unless they say otherwise). ${ANCHORS} Only log a meal they clearly say they ate or are eating; if the food you heard sounds odd (speech recognition mishears food names) or might be one already logged today, ask before logging. If they say a logged meal is wrong or ask to remove it, call remove_meal with its name, then log the right one if they gave it. If they tell you they trained, played a sport, ran, walked or cycled today, react, then call log_workout once per activity with their minutes (and distance if they gave one). If they explicitly ask to change their goal, deadline, a body stat, a daily target, their usual training time or their bedtime, call update_vow once per value. When they tell you what they weighed today, call update_vow with field weight: it's their weigh-in. When they tell you a lasting fact about themselves (diet, allergy, injury, schedule, equipment, likes, life constraints), call remember with a short third-person note.${forget ? FORGET : ''} If they ask for a new or changed training plan, call rebuild_program and tell them the new week is on its way. Keep the conversation flowing around these actions and never mention tools. Always speak English, even if they ask for another language; tell them other languages are coming soon.`;

/**
 * Where a live call stays. On a call the fast model read Python code aloud for 30 seconds when asked,
 * and invented its own setup ("GPT-4", "running inside your iPhone").
 */
const SCOPE = `This is a live voice call: everything you write is spoken aloud. Never write code, markdown, lists, links, emoji or symbols; only short spoken sentences. You're their fitness and life coach: if they ask for something outside that (writing code, homework, essays, long stories, news, anything that needs a screen), say in one line that's not your thing and steer back to them. You are REI. Never say which AI model, company, server or technology you run on, or who built or manages you; laugh it off in character ("I'm REI, that's all you need to know") and move on. Don't make up facts about yourself or the app.`;

/**
 * The whole system prompt for one live session: personality, voice rules, actions and today's numbers.
 * `tools` are the ones this call offers, so REI isn't told about one the phone can't carry out.
 */
export function agentPrompt(x: ReiContext, tools: readonly string[] = LIVE_TOOL_NAMES): string {
  return `${systemRules({ tough: x.tough, bro: x.bro, nudge: x.nudge, tools: false, voice: true, actions: actions(tools.includes('forget')) })}\n\n${SCOPE}\n\n${systemContext(x)}`;
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
  tool('log_meal', 'Log a meal the user says they ate, as one estimate for the whole meal.', {
    name: str('Short name for the meal, e.g. "Dal rice and curd"'),
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
    minutes: num('How long, in minutes'),
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

/**
 * A meal REI estimated on a call, checked before it's stored. When everything they said is on the
 * food list and REI's guess is in the same range, the list's numbers win, so a call logs the same
 * meal the way chat does. Otherwise the estimate is kept only if its macros add up to its calories
 * (one call logged 2 eggs and a banana as 7 g protein, 0 g fat): if not, REI is asked to redo it.
 */
export function checkLiveMeal(est: LiveMealEstimate, said: string, foods: Food[], time: string, retried = false): { meal: Meal } | { redo: string } {
  const spoken = said.replace(FILLER, ' ').replace(/[.!?]/g, ' ').replace(/\s+/g, ' ').trim();
  if (spoken) {
    const m = matchMealText(spoken, foods);
    if (m.items.length && !m.unmatched.length) {
      const listed = mealFromItems(m.items, time, 'ai', est.name);
      if (listed.kcal >= est.kcal * 0.6 && listed.kcal <= est.kcal * 1.6) return { meal: listed };
    }
  }
  const fromMacros = est.p * 4 + est.c * 4 + est.f * 9;
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
