// REI's voice: system prompt, reply clean-up, and offline answers.
// Ported from design/REI.dc.html.
import { SESSION_TIME } from './data';
import type { Meal, Message, Nutrition, Profile, ProfileKey } from './types';

export interface ReiContext {
  profile: Profile;
  nutrition: Nutrition;
  meals: Meal[];
  tough: boolean;
  nudge: boolean;
  sessionDone: boolean;
  /** e.g. "Push session at 18:30" or "Rest day". */
  todayLine: string;
  weekLine: string;
  disciplines: string[];
  now: string;
  today: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface MealEstimate {
  name?: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export interface ParsedReply {
  text: string;
  upd: Partial<Record<ProfileKey, string | number>> | null;
  meal: MealEstimate | null;
}

const num = (s: string) => parseFloat(s) || 0;

export function systemPrompt(x: ReiContext): string {
  const p = x.profile, nu = x.nutrition;
  return `You are REI (零, "zero", as in zero excuses), a personal AI fitness companion living inside one person's iPhone. You are their tough-love best friend and elite coach in one. Intensity: ${x.tough ? '10/10: blunt, direct, refuses excuses' : '6/10: firm but warmer'}.
Rules: Be short and specific, 1 to 3 sentences, under 60 words. Use their real numbers. Call out excuses, broken commitments and negotiating plainly. Praise real effort briefly, then demand repetition. Never insult, demean, or comment negatively on their body. No em dashes, no emojis, no exclamation spam, no lists, no therapy-speak, no "as an AI". Speak like a person with character. End with a concrete next action when relevant. Latency-sensitive; begin your visible answer immediately.
${x.nudge ? '' : 'The user turned off proactive check-ins: do not nag unprompted, but stay honest when asked. '}Context: now ${x.today}, ${x.now}. Goal (their words): "${p.goal}". Deadline ${p.deadline}. Weight ${p.weight} kg → ${p.targetWeight} kg. Body fat ${p.bf}% → ${p.targetBf}%. Height ${p.height} cm, age ${p.age}. Daily targets: ${p.kcal} kcal, ${p.protein} g protein, ${p.carbs} g carbs, ${p.fat} g fat, ${p.steps} steps, ${p.sleep} h sleep, ${p.sessions} sessions/week. Trains: ${x.disciplines.join(', ').toLowerCase() || 'general fitness'}.
This week: ${x.weekLine}. Today: ${x.todayLine}${x.todayLine === 'Rest day' ? '' : x.sessionDone ? ' (DONE)' : ' (not done yet)'}. Calories ${nu.kcal}/${p.kcal}, protein ${nu.protein}/${p.protein} g, carbs ${nu.carbs}/${p.carbs} g, fat ${nu.fat}/${p.fat} g, steps ${nu.steps ?? 'unknown'}, sleep last night ${nu.sleep == null ? 'unknown' : nu.sleepL}. Meals today: ${x.meals.map(m => `${m.time} ${m.name} (${m.kcal} kcal, P${m.p} C${m.c} F${m.f})`).join('; ') || 'none yet'}.
If the user reports eating something, estimate its macros realistically, react to how it fits the remaining budget (numbers after this meal), and append a final line exactly: MEAL {"name":"short name","kcal":n,"p":n,"c":n,"f":n}.
If the user explicitly asks to change their goal, deadline, or a stat/target, reply briefly (if they're lowering the bar to dodge effort, say so once, but respect it) and append a final line exactly: UPDATE {json} using only these keys: goal (string), deadline (YYYY-MM-DD), weight, targetWeight, bf, targetBf, kcal, protein, carbs, fat, steps, sleep, sessions (numbers).`;
}

/** Collapse the chat log into alternating user/assistant turns for the API. */
export function toTurns(history: Message[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const m of history) {
    if (m.role === 'sys') continue;
    const role = m.role === 'rei' ? 'assistant' : 'user';
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += '\n' + m.text;
    else out.push({ role, content: m.text });
  }
  if (out[0]?.role === 'assistant') out.unshift({ role: 'user', content: '(opened the app)' });
  return out;
}

/** Strip markdown and dashes, and pull out the MEAL / UPDATE control lines. */
export function parseReply(raw: string): ParsedReply {
  let text = raw
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*(REI|Assistant)\s*:\s*/i, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\s*[—–]\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/([.!?])\s+([a-z])/g, (_, p: string, c: string) => p + ' ' + c.toUpperCase());
  let upd: ParsedReply['upd'] = null;
  let meal: MealEstimate | null = null;
  text = text
    .replace(/(UPDATE|MEAL)\s*:?\s*(\{[^{}]*\})/g, (_, k: string, j: string) => {
      try {
        const o = JSON.parse(j);
        if (k === 'UPDATE') upd = o;
        else meal = o;
      } catch {
        // Malformed control line: drop it from the visible text either way.
      }
      return '';
    })
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return { text, upd, meal };
}

export const PROFILE_KEYS: ProfileKey[] = ['goal', 'deadline', 'weight', 'targetWeight', 'bf', 'targetBf', 'kcal', 'protein', 'carbs', 'fat', 'steps', 'sleep', 'sessions'];

const PROFILE_LABELS: Record<ProfileKey, string> = {
  goal: 'GOAL', deadline: 'DEADLINE', weight: 'WEIGHT', targetWeight: 'TARGET', bf: 'BODY FAT', targetBf: 'TARGET BF',
  height: 'HEIGHT', age: 'AGE', kcal: 'CALORIES', protein: 'PROTEIN', carbs: 'CARBS', fat: 'FAT', steps: 'STEPS', sleep: 'SLEEP', sessions: 'SESSIONS',
};

/** Apply an UPDATE payload to the profile. Returns null when nothing allowed changed. */
export function applyUpdate(profile: Profile, upd: ParsedReply['upd']): { profile: Profile; note: string } | null {
  if (!upd) return null;
  const next = { ...profile };
  const keys: ProfileKey[] = [];
  for (const k of PROFILE_KEYS) {
    const v = upd[k];
    if (v !== undefined && v !== null) {
      next[k] = String(v);
      keys.push(k);
    }
  }
  if (!keys.length) return null;
  return { profile: next, note: 'VOW UPDATED · ' + keys.map(k => PROFILE_LABELS[k]).join(' · ') };
}

/** Rough macro guess for when REI is offline. */
export function estimateMeal(text: string): MealEstimate {
  const s = text.toLowerCase();
  const table: [RegExp, number, number, number, number][] = [
    [/burger|fries/, 1050, 40, 100, 52],
    [/pizza/, 850, 34, 96, 36],
    [/shake|whey/, 160, 30, 6, 2],
    [/chicken|turkey|fish|salmon/, 480, 50, 38, 12],
    [/egg/, 320, 20, 25, 15],
    [/salad/, 380, 22, 20, 22],
    [/steak|beef/, 620, 52, 20, 36],
  ];
  for (const [re, kcal, p, c, f] of table) if (re.test(s)) return { kcal, p, c, f };
  return { kcal: 500, p: 28, c: 50, f: 18 };
}

export function toMeal(est: MealEstimate | null, fallbackName: string, time: string): Meal {
  const e = est && +est.kcal ? est : estimateMeal(fallbackName);
  let name = String(e.name || fallbackName || 'Meal').trim().slice(0, 44);
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return { time, name, kcal: Math.round(+e.kcal) || 0, p: Math.round(+e.p) || 0, c: Math.round(+e.c) || 0, f: Math.round(+e.f) || 0 };
}

export function mealNote(m: Meal): string {
  return `MEAL LOGGED · ${m.kcal} KCAL · P ${m.p} · C ${m.c} · F ${m.f}`;
}

/** REI's one-line read on the remaining food budget. */
export function fuelLine(profile: Profile, nu: Nutrition): string {
  const kL = num(profile.kcal) - nu.kcal, pL = num(profile.protein) - nu.protein;
  if (kL < 0) return `Over by ${-kL} kcal. Kitchen's closed. Water, a walk, bed. And we don't repeat this tomorrow.`;
  if (pL <= 0) return kL < 250 ? 'Protein hit, calories closed. That’s a clean day. Kitchen’s shut.' : `Protein hit. ${kL} kcal of room. You don't have to use it.`;
  if (pL * 4 > kL * 0.6) return `${kL} kcal and ${pL} g protein left. Only lean protein fits now: chicken breast, white fish, egg whites, whey. No carbs tonight.`;
  return `${kL} kcal and ${pL} g protein left. Room for a real meal. Build it around protein first, then fill.`;
}

/** Canned replies used when no API is configured or the request fails. */
export function offlineReply(text: string, x: Pick<ReiContext, 'profile' | 'nutrition' | 'tough' | 'todayLine'>): string {
  const s = text.toLowerCase(), tough = x.tough;
  if (/tired|skip|wiped|exhausted|tomorrow|move|reschedule|double/.test(s)) {
    const slept = x.nutrition.sleep == null ? null : Math.floor(x.nutrition.sleep);
    return tough
      ? `Tired is information, not a verdict. ${slept == null ? 'Bad sleep' : `You slept ${slept} hours`}, so we cut volume, not the session. 35 minutes, compounds only. Shoes on.`
      : `Fair. ${slept == null ? 'A rough night' : `${slept} hours of sleep`} is hard. Do a 35-minute version: bench, OHP, dips. Showing up matters more than volume tonight.`;
  }
  if (/ate|eat|meal|dinner|lunch|pizza|snack|food/.test(s)) return fuelLine(x.profile, x.nutrition);
  if (/goal|change|target|vow/.test(s)) return "Tell me the new target in one line (weight, date, or lift) and I'll rewrite the vow. Just make sure it's a raise, not a retreat.";
  if (/left|what.*today|status/.test(s)) {
    const pL = Math.max(0, num(x.profile.protein) - x.nutrition.protein);
    const stepsL = Math.max(0, num(x.profile.steps) - (x.nutrition.steps ?? 0));
    return `${x.todayLine}. ${pL} g protein. ${stepsL.toLocaleString('en-US')} steps. Bed by 23:30. Four things. None of them optional.`;
  }
  return tough
    ? 'Noted. Now stop talking to me and go do the thing you already know you need to do.'
    : `Got it. Keep it simple: the next action is ${x.todayLine === 'Rest day' ? 'a long walk and an early night' : `the session at ${SESSION_TIME}`}.`;
}

/** Split a reply into a bold lead sentence and the rest, for the voice screen. */
export function splitLead(text: string): { lead: string; rest: string } {
  const m = /^([\s\S]+?[.!?])(\s+)([\s\S]+)$/.exec(text);
  return m ? { lead: m[1], rest: m[3].trim() } : { lead: text, rest: '' };
}
