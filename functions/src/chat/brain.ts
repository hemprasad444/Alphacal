// The thinking part of one chat turn, with no Firebase or network in it: what REI is told before the
// model answers (prepare), and what the model's answer is allowed to do afterwards (interpret). The
// HTTP handler (index.ts) wraps these with loading, streaming, retries and saving; the eval
// (e2e/eval-brain.mts) runs the same two functions against real models.
import {
  catalog, continuityNote, type ContextInput, type Food, foodCandidates, foodListPrompt, groundWorkout, hhmm, matchMealText, type Meal, type MealItem, mealFromItems, mentionsEating, type Message,
  nutrition, parseWorkout, reiContext, resolveAiItems, route, saysNumber, type SessionLog, shouldLogMeal, shouldLogWorkout, systemContext, systemRules, thread, type Tier, todaysPlan, toTurns,
  vowChange, vowFromText, weighInFrom, workoutLog,
} from '@rei/shared';
import type { LlmResult, LlmTool, Msg } from '../llm';
import { forgetTool, logMealTool, logMealWithVerdictTool, logWorkoutTool, parseForget, parseMealItems, parseRemember, parseVow, rebuildProgramTool, rememberTool, updateVowTool } from './tools';

export type Mode = 'chat' | 'meal';

export interface Ask {
  text: string;
  mode: Mode;
  /** The user's message, already written by the app; excluded from history and sent as the last turn. */
  userMessageId?: string;
  /** Spoken aloud: REI writes for the ear and may add audio tags. */
  voice: boolean;
}

/** What one turn needs from the user's data (a subset of load.ts's Loaded). */
export interface Known {
  input: ContextInput;
  messages: Message[];
  foods: Food[];
  timeZone: string;
  today: string;
  todaySessions: SessionLog[];
}

export interface Prepared {
  system: string;
  turns: Msg[];
  tier: Tier;
  canRebuild: boolean;
  tools: LlmTool[];
  /** Force this tool (the Fuel screen's one-call log). */
  forceTool?: string;
  maxTokens: number;
  /** The user's foods and the built-in list. */
  foods: Food[];
  candidates: Food[];
  history: Message[];
  /** What the food list alone makes of their message, when it matched all of it. */
  matched: MealItem[] | null;
  /** Their message names at least one food on the list (not just "lunch" or "a snack"). */
  namesFood: boolean;
}

const line = (i: MealItem) => `- ${i.food} | ${+i.qty.toFixed(2)} ${i.unit} | ${i.name} | ${i.kcal} kcal, P${i.p} C${i.c} F${i.f}`;

/**
 * The meal in their message, added up from the food list before the model sees it: the items, the
 * total, and what's left after it. REI repeats these numbers instead of estimating and subtracting.
 * Empty when the message doesn't read as food.
 */
export function mealMath(text: string, foods: Food[], input: Pick<ContextInput, 'profile' | 'meals' | 'activity'>, mode: Mode): { block: string; items: MealItem[] | null } {
  const m = matchMealText(text, foods);
  const whole = m.items.length > 0 && m.unmatched.length === 0;
  // In chat, only when they're talking about eating or everything they wrote is a food ("2 roti dal").
  if (!m.items.length || (mode === 'chat' && !whole && !mentionsEating(text))) return { block: '', items: null };
  const nu = nutrition(input.meals, input.activity);
  const sum = (k: 'kcal' | 'p' | 'c' | 'f') => Math.round(m.items.reduce((a, i) => a + i[k], 0));
  const kcalLeft = Math.round((parseFloat(input.profile.kcal) || 0) - nu.kcal - sum('kcal'));
  const proteinLeft = Math.round((parseFloat(input.profile.protein) || 0) - nu.protein - sum('p'));
  const after = `${kcalLeft >= 0 ? `${kcalLeft} kcal left` : `${-kcalLeft} kcal OVER the target`} and ${proteinLeft > 0 ? `${proteinLeft} g protein to go` : 'protein target hit'}`;
  const block = [
    'MEAL MATH (the app matched their message to the food database. If they are telling you they ate this, these are the items and numbers for log_meal and for your reply; do not re-estimate or recalculate them):',
    ...m.items.map(line),
    `Matched total: ${sum('kcal')} kcal, ${sum('p')} g protein, ${sum('c')} g carbs, ${sum('f')} g fat.`,
    whole ? `After this meal: ${after} today.` : `Not in the database: ${m.unmatched.map(u => `"${u}"`).join(', ')}. Estimate only that part (food_id "none") and add it. After the matched part alone: ${after}.`,
  ].join('\n');
  return { block, items: whole ? m.items : null };
}

/** Words for the meal itself, which are not a food ("dinner" would otherwise match "TV dinner"). */
const MEAL_WORDS = /\b(breakfast|brunch|lunch|dinner|supper|snacks?|meals?|food|tiffin|khana|nashta)\b/gi;

/** Everything the model is given for one turn. */
export function prepare(known: Known, ask: Ask, nowMs: number = Date.now()): Prepared {
  const ctx = reiContext(known.input);
  // The foods this message might mean, so REI logs the list's numbers instead of guessing.
  const foods = [...known.foods, ...catalog()];
  const candidates = foodCandidates(ask.text, foods);
  const history = known.messages.filter(m => m.id !== ask.userMessageId);
  // Where the conversation stands, so REI picks the thread up instead of greeting every time.
  const flow = ask.mode === 'chat' ? [continuityNote(thread(history, nowMs, known.timeZone))] : [];
  const math = mealMath(ask.text, foods, known.input, ask.mode);
  const system = [systemRules({ tough: ctx.tough, bro: ctx.bro, nudge: ctx.nudge, tools: true, voice: ask.voice }), systemContext(ctx), ...flow, ...(candidates.length ? [foodListPrompt(candidates)] : []), ...(math.block ? [math.block] : [])].join('\n\n');
  const userText = ask.mode === 'meal' ? `Just ate: ${ask.text}` : ask.text;
  const turns = toTurns([...history, { role: 'user', text: userText, time: '' }]);
  // Voice can't wait on the slow model: always the quick one, which can still queue a rebuild.
  const tier: Tier = ask.mode === 'meal' || ask.voice ? 'fast' : route(ask.text);
  const canRebuild = tier === 'deep' || ask.voice;
  const chatTools = [logMealTool, logWorkoutTool, updateVowTool, rememberTool, forgetTool, ...(canRebuild ? [rebuildProgramTool] : [])];
  return {
    system, turns, tier, canRebuild, foods, candidates, history, matched: math.items,
    namesFood: foodCandidates(ask.text.replace(MEAL_WORDS, ' '), foods).length > 0,
    tools: ask.mode === 'meal' ? [logMealWithVerdictTool] : chatTools,
    ...(ask.mode === 'meal' ? { forceTool: 'log_meal' } : {}),
    maxTokens: ask.mode === 'meal' ? 1024 : tier === 'deep' ? 16000 : 2048,
  };
}

export interface Outcome {
  /** REI's words as the model wrote them (or the Fuel verdict), before clean-up. */
  text: string;
  meal: Meal | null;
  vow: ReturnType<typeof parseVow>;
  /** A program rebuild was asked for, with this focus. */
  rebuild: string | null;
  workouts: SessionLog[];
  memory: { remember: ReturnType<typeof parseRemember>; forget: string[] };
  /** A meal the model wanted to log was refused (not about this message, or already logged). */
  mealBlocked: boolean;
  /** A workout wasn't logged because they never said how long it was: REI has to ask. */
  askDuration: string | null;
  /** A meal wasn't logged because they never said what they ate: REI has to ask. */
  askFood: boolean;
  /** Changes read from their own words that the model didn't make itself ("protein → 160"): REI confirms them. */
  vowByRule: string[];
  /** Why things were not done, for the logs. */
  notes: string[];
}

/**
 * The meal a log_meal call stands for. When the food list matched their whole message, its items are
 * the meal (the same result as logging it from the Fuel screen), unless the model's own reading is far
 * off, which means one of the two misread the amounts; then the model's checked items stand.
 */
export function mealFrom(inputs: unknown[], prep: Pick<Prepared, 'foods' | 'matched'>, time: string): { meal: Meal; verdict?: string } | null {
  // One call per food instead of one call with every food: still one meal.
  const parsed = inputs.map(parseMealItems).filter((x): x is NonNullable<ReturnType<typeof parseMealItems>> => !!x);
  if (!parsed.length) return null;
  const m = { name: parsed[0].name, items: parsed.flatMap(x => x.items).slice(0, 20), verdict: parsed.find(x => x.verdict)?.verdict };
  const theirs = mealFromItems(resolveAiItems(m.items, prep.foods), time, 'ai', m.name);
  if (prep.matched) {
    const ours = mealFromItems(prep.matched, time, 'ai', m.name);
    if (ours.kcal >= theirs.kcal * 0.5 && ours.kcal <= theirs.kcal * 2) return { meal: ours, verdict: m.verdict };
  }
  return { meal: theirs, verdict: m.verdict };
}

/**
 * Tool calls a model wrote into its reply as text instead of making them (GPT-6 Luna does now and then:
 * `<tool_call recipient="functions.update_vow"> {…} </tool_call>`): taken out of what's said, and returned as calls.
 */
export function spelledCalls(text: string): { text: string; calls: { type: 'tool_use'; name: string; input: unknown }[] } {
  const calls: { type: 'tool_use'; name: string; input: unknown }[] = [];
  const clean = text.replace(/<tool_call\b[^>]*?(?:recipient|name)="(?:functions\.)?([a-z_]+)"[^>]*>\s*([\s\S]*?)\s*<\/tool_call>/gi, (_, name: string, body: string) => {
    try {
      calls.push({ type: 'tool_use', name, input: JSON.parse(body) });
    } catch {
      // Not JSON: nothing to act on, and it still shouldn't be shown.
    }
    return '';
  });
  return { text: clean.replace(/[ \t]+\n/g, '\n').trim(), calls };
}

/** What the model's answer does: each tool call checked against what they actually said and what's already logged. */
export function interpret(final: LlmResult, prep: Prepared, known: Known, ask: Ask, nowMs: number = Date.now()): Outcome {
  const out: Outcome = { text: '', meal: null, vow: null, rebuild: null, workouts: [], memory: { remember: [], forget: [] }, mealBlocked: false, askDuration: null, askFood: false, vowByRule: [], notes: [] };
  if (final.stop_reason === 'refusal') return out;
  const { input } = known;
  const time = hhmm(input.now);
  // A tool input cut off at max_tokens can still parse; never act on it.
  const toolsUsable = final.stop_reason !== 'max_tokens';
  const written = spelledCalls(final.content.map(b => (b.type === 'text' ? b.text : '')).join(''));
  out.text = written.text;
  // Calls the model wrote out as text count like any other.
  final = { ...final, content: [...final.content, ...written.calls] };
  const mealCalls = toolsUsable ? final.content.flatMap(b => (b.type === 'tool_use' && b.name === 'log_meal' ? [b.input] : [])) : [];
  const m = mealFrom(mealCalls, prep, time);
  if (m) {
    // From Fuel, logging is the point. From chat, only food this message is about, and not twice.
    const check: { ok: boolean; why?: string } = ask.mode === 'meal' ? { ok: true } : shouldLogMeal(ask.text, m.meal, input.meals, time, prep.namesFood);
    if (check.ok) {
      out.meal = m.meal;
      if (m.verdict) out.text = m.verdict;
    } else {
      out.mealBlocked = true;
      out.askFood = check.why === 'no food named';
      out.notes.push(`meal not logged (${check.why}): ${m.meal.name}`);
    }
  }
  for (const b of final.content) {
    if (b.type !== 'tool_use' || !toolsUsable) continue;
    if (b.name === 'log_workout') {
      const asked = parseWorkout(b.input);
      if (!asked) continue;
      // The minutes are theirs or it isn't logged: REI asks instead of guessing.
      const grounded = groundWorkout(asked, ask.text);
      if ('ask' in grounded) {
        out.askDuration = grounded.ask;
        out.notes.push(`workout not logged (no duration given): ${asked.name || asked.kind}`);
        continue;
      }
      const log = workoutLog(grounded.workout, { date: known.today, plan: todaysPlan(input.now, input.program), kg: parseFloat(input.profile.weight) || 0, now: nowMs });
      // Already saved in the app ("just smashed push day" after logging the sets): not twice.
      const check = shouldLogWorkout(ask.text, log, [...known.todaySessions, ...out.workouts]);
      if (check.ok) out.workouts.push(log);
      else out.notes.push(`workout not logged (${check.why}): ${log.title}`);
    } else if (b.name === 'update_vow') {
      out.vow = { ...out.vow, ...parseVow(b.input) };
      if (!Object.keys(out.vow).length) out.vow = null;
    } else if (b.name === 'remember') {
      out.memory.remember.push(...parseRemember(b.input));
    } else if (b.name === 'forget') {
      out.memory.forget.push(...parseForget(b.input));
    } else if (b.name === 'rebuild_program' && prep.canRebuild) {
      const f = (b.input as { focus?: unknown } | null)?.focus;
      out.rebuild = typeof f === 'string' ? f.slice(0, 200) : '';
    }
  }
  // A weight is a weigh-in, so only one they gave in this message.
  if (out.vow?.weight && !saysNumber(ask.text, parseFloat(out.vow.weight))) {
    out.notes.push(`weight not recorded (not in their message): ${out.vow.weight}`);
    const { weight: _, ...rest } = out.vow;
    out.vow = Object.keys(rest).length ? rest : null;
  }
  // "Change my protein target to 160" answered in words, or with another number: what they asked for is what's set.
  const ordered = ask.mode === 'meal' ? null : vowFromText(ask.text, input.now);
  for (const [field, value] of Object.entries(ordered ?? {})) {
    const change = vowChange(field, value);
    if (!change || out.vow?.[change[0]] === change[1]) continue;
    out.vow = { ...out.vow, [change[0]]: change[1] };
    out.vowByRule.push(`${change[0]} → ${change[1]}`);
  }
  // "Weighed 83.5 this morning" answered without update_vow: still their weigh-in.
  if (ask.mode !== 'meal' && !out.vow?.weight) {
    const kg = weighInFrom(ask.text, parseFloat(input.profile.weight) || 0);
    if (kg) out.vow = { ...out.vow, weight: String(kg) };
  }
  return out;
}

/**
 * REI said it noted something ("Peanut allergy noted") but made no remember call: about one reply in
 * eight on the fast model. The handler then asks once more for just the fact, with the tool forced.
 */
export const saidNoted = (text: string) => /\b(noted|i['’]?ll (?:remember|keep (?:that|it) in mind)|i will remember|remembered|won['’]?t forget|keeping that in mind)\b/i.test(text);

/** The instruction for that second, forced remember call. An empty list is a fine answer. */
export const REMEMBER_PASS = `From their latest message only, save each lasting fact about them (diet, allergy, injury or health condition, schedule, equipment, likes and dislikes, a life constraint) as a short third-person note in English. Not moods, today's numbers, meals or one-off plans. If their message holds no such fact, call remember with an empty list.`;

/** The facts from that forced call. */
export function rememberedIn(final: LlmResult | null): ReturnType<typeof parseRemember> {
  if (!final || final.stop_reason === 'max_tokens') return [];
  return final.content.flatMap(b => (b.type === 'tool_use' && b.name === 'remember' ? parseRemember(b.input) : []));
}
