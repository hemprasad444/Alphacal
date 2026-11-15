// REI's brain, measured. A fixed user at a fixed moment (Sunday 15 November 2026, 14:05), 26 messages
// that each have one right outcome (a meal with the food list's numbers, a date, a number of minutes,
// a workout that must NOT be logged), run through the same prepare → model → interpret path the chat
// endpoint uses. Judged on what would be stored and said, not on wording.
//
//   cd functions && OPENROUTER_API_KEY=... npx tsx ../e2e/eval-brain.mts [--runs 2] [--models a,b] [--only id,id] [--json out.json]
//
// Costs about $0.02 a run on the default fast models. Results: docs/brain-eval.md.
import * as SH from '../packages/shared/src/index.ts';
import * as BR from '../functions/src/chat/brain.ts';
import { writeFileSync } from 'node:fs';

const S = ((SH as any).default ?? SH) as typeof SH;
const B = ((BR as any).default ?? BR) as typeof BR;
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error('Set OPENROUTER_API_KEY.');

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const MODELS = (arg('models') ?? 'openai/gpt-6-luna,google/gemini-3.8-flash').split(',');
const RUNS = Number(arg('runs') ?? 2);
const ONLY = arg('only')?.split(',');

// ---- The user and the moment ------------------------------------------------------

/** Sunday 15 November 2026, 14:05 on their clock. */
const NOW = new Date(2026, 10, 15, 14, 5);
const ago = (min: number) => NOW.getTime() - min * 60000;
const profile = { ...S.DEFAULT_PROFILE, name: 'Hem', weight: '84', targetWeight: '76.5', kcal: '2100', protein: '150', carbs: '220', fat: '65', steps: '9000', sessionTime: '18:30', bedtime: '23:00', deadline: '2026-12-31' };
const meals: SH.Meal[] = [
  { time: '08:10', name: '2 boiled eggs and toast', kcal: 290, p: 17, c: 25, f: 12 },
  { time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 },
];
/** Eaten 740 kcal and 32 g protein: 1360 kcal and 118 g protein left. Session (Sunday) at 18:30, in 4 h 25 min. Deadline in 46 days. */
const LEFT = { kcal: 1360, protein: 118 };

function known(patch: { memory?: SH.MemoryItem[]; meals?: SH.Meal[]; messages?: SH.Message[]; bro?: boolean } = {}): BR.Known {
  const memory = patch.memory ?? [{ id: 'm1', kind: 'diet', text: 'Non-veg; 4 meals a day', createdAt: 0, source: 'you' } as SH.MemoryItem];
  return {
    input: {
      profile, disc: S.DEFAULT_DISCIPLINES, meals: patch.meals ?? meals, sessionDone: false,
      history: { kind: 'real', startedOn: '2026-10-06', sessions: { '2026-11-09': true, '2026-11-10': true, '2026-11-11': true, '2026-11-13': false, '2026-11-14': true } },
      activity: { steps: 3200, sleep: 7.2, sleepL: '7h 12m' }, tough: true, bro: !!patch.bro, nudge: true, now: NOW, program: null, memory,
      timeZone: 'Asia/Kolkata',
      sessions: [{ date: '2026-11-14', plan: 'LEGS', title: 'Legs', done: 18, total: 18, seconds: 3000, createdAt: ago(19 * 60) }],
      days: { '2026-11-14': { sessionDone: true, meals: [{ time: '09:00', name: 'Masala dosa', kcal: 350, p: 7, c: 48, f: 14 }, { time: '21:10', name: 'Paneer bhurji and 2 roti', kcal: 470, p: 22, c: 43, f: 24 }] } },
    } as SH.ContextInput,
    messages: patch.messages ?? [],
    foods: [],
    timeZone: 'Asia/Kolkata',
    today: '2026-11-15',
    todaySessions: [],
  };
}

// ---- The cases --------------------------------------------------------------------

interface Got {
  /** What REI would say, cleaned the way the endpoint cleans it. */
  text: string;
  out: BR.Outcome;
  calls: string[];
}
interface Case {
  id: string;
  /** What is being tested. */
  what: string;
  text: string;
  mode?: BR.Mode;
  patch?: Parameters<typeof known>[0];
  /** null when right, else what was wrong. */
  judge: (g: Got) => string | null;
}

/** "1,360", "1 360" and "twenty‑five" (a non-breaking hyphen) read as 1360 and twenty-five. */
const plain = (t: string) => t.replace(/[\u2010-\u2015]/g, '-').replace(/(\d)[\s\u00a0\u202f\u2009,](?=\d{3}\b)/g, '$1');
const DEVANAGARI = /[ऀ-ॿ]/, TELUGU = /[ఀ-౿]/;
const between = (v: number | undefined, lo: number, hi: number) => v !== undefined && v >= lo && v <= hi;
const mealIn = (lo: number, hi: number, extra?: (m: SH.Meal) => string | null) => (g: Got) =>
  !g.out.meal ? 'no meal logged' : !between(g.out.meal.kcal, lo, hi) ? `meal ${g.out.meal.kcal} kcal, expected ${lo}-${hi}` : (extra?.(g.out.meal) ?? null);
/**
 * What REI says about a meal matches what was logged: every calorie or protein figure in the reply is the meal's,
 * what's left after it, the day's total after it, or a target. A reply built on the model's own estimate fails
 * when the food list's numbers were logged instead.
 */
const grounded = (g: Got) => {
  const m = g.out.meal;
  if (!m) return null;
  const t = plain(g.text);
  const near = (n: number, ok: number[]) => ok.some(x => Math.abs(x - n) <= 1);
  const kcal = [...t.matchAll(/(\d{2,4})\s*(?:kcal|cal(?:ories)?\b|कैलोरी|कैलरी|క్యాలరీ|కేలరీ)/giu)].map(x => +x[1]).filter(n => !near(n, [m.kcal, LEFT.kcal - m.kcal, 740 + m.kcal, 2100, 740, LEFT.kcal, ...(m.items ?? []).map(i => i.kcal)]));
  const protein = [...t.matchAll(/(\d{1,3})\s*(?:g|gm|grams?|ग्राम|గ్రా\S*)\s*(?:of\s*)?(?:protein|प्रोटीन|ప్రోటీన్)/giu)].map(x => +x[1]).filter(n => !near(n, [m.p, LEFT.protein - m.p, 32 + m.p, 150, 32, LEFT.protein, ...(m.items ?? []).map(i => Math.round(i.p))]));
  return kcal.length || protein.length ? `says ${[...kcal.map(n => `${n} kcal`), ...protein.map(n => `${n} g protein`)].join(', ')} but logged ${m.kcal} kcal, ${m.p} g protein (left ${LEFT.kcal - m.kcal} / ${LEFT.protein - m.p})` : null;
};
const noMeal = (g: Got) => (g.out.meal ? `logged a meal: ${g.out.meal.name} ${g.out.meal.kcal}` : null);
const says = (re: RegExp, miss: string) => (g: Got) => (re.test(plain(g.text)) ? null : `${miss}: "${g.text.slice(0, 110)}"`);
const all = (...js: Case['judge'][]): Case['judge'] => g => js.map(j => j(g)).find(Boolean) ?? null;
/** "no eggs", "skip the chicken": naming a food to rule it out isn't suggesting it. */
const NEGATED = /\b(no|not|without|skip|avoid|zero|minus)\s+(the\s+|any\s+)?(meat|eggs?|chicken|fish)((\s*,\s*|\s+or\s+|\s+and\s+)(meat|eggs?|chicken|fish))*/gi;
const VEG: SH.MemoryItem[] = [{ id: 'm1', kind: 'diet', text: 'Vegetarian; no eggs', createdAt: 0, source: 'you' }];
const VEG_MEALS: SH.Meal[] = [{ time: '08:10', name: 'Poha and chai', kcal: 290, p: 7, c: 50, f: 8 }, { time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 }];

const CASES: Case[] = [
  // Meals: the food list has every one of these, so the stored numbers have one right answer.
  { id: 'meal-en', what: 'English meal, list numbers (2 roti 220 + dal 150 + paneer sabzi 300 = 670)', text: 'had 2 roti, dal and paneer sabzi for lunch', judge: all(mealIn(560, 780), grounded) },
  { id: 'meal-hinglish', what: 'Hinglish meal (3 idli 174 + sambar 110 = 284)', text: 'bhai abhi 3 idli aur sambar khaya', judge: all(mealIn(240, 340), grounded) },
  { id: 'meal-hindi', what: 'Hindi meal in Devanagari (2 roti 220 + dal 150 = 370), reply in Hindi', text: 'मैंने अभी दो रोटी और एक कटोरी दाल खाई', judge: all(mealIn(300, 450), says(DEVANAGARI, 'reply not in Hindi'), grounded) },
  { id: 'meal-telugu', what: 'Telugu meal (3 idli + sambar = 284), reply in Telugu', text: 'నేను ఇప్పుడే మూడు ఇడ్లీలు, సాంబార్ తిన్నాను', judge: all(mealIn(230, 350), says(TELUGU, 'reply not in Telugu'), grounded) },
  { id: 'meal-biryani', what: 'Plate of chicken biryani 500 + cola 140 = 640', text: 'just had a plate of chicken biryani and a coke', judge: all(mealIn(560, 760), grounded) },
  { id: 'meal-whey', what: 'Whey shake with milk (265 kcal, 32 g protein)', text: 'had a whey shake with milk', judge: all(mealIn(220, 330, m => (m.p >= 25 ? null : `protein ${m.p}`)), grounded) },
  { id: 'meal-fuel', what: 'Fuel screen: curd rice bowl + pickle (curd rice 260 + a little)', text: 'a bowl of curd rice with pickle', mode: 'meal', judge: all(mealIn(250, 340), grounded) },
  // Time and the calendar: every answer is in the facts.
  { id: 'time-workout', what: "When's my workout → 18:30", text: "when's my workout today?", judge: says(/18[:.]30|6[:.]30|half past six/i, 'no 18:30') },
  { id: 'time-until', what: 'How long until the session → 4 h 25 min', text: 'how long until my session starts?', judge: all(says(/\b(4|four)\s*(h|hr|hrs|hours?)\b/i, 'not 4 h'), says(/\b25\b|twenty[- ]five/i, 'not 25 min')) },
  { id: 'time-date', what: 'Date and weekday → Sunday 15 November', text: "what's the date today, and which day of the week?", judge: all(says(/sunday/i, 'no Sunday'), says(/(?<!\d)15(?!\d)/, 'no 15'), says(/nov/i, 'no November')) },
  { id: 'time-deadline', what: 'Days to the deadline → 46', text: 'how many days do I have left until my deadline?', judge: says(/(?<!\d)46(?!\d)|forty[- ]six/i, 'not 46 days') },
  { id: 'time-since-meal', what: 'Since the last meal → 45 min', text: 'how long has it been since my last meal?', judge: says(/\b(45|forty[- ]five)\s*(min|minutes)/i, 'not 45 min') },
  { id: 'ate-today', what: 'What did I eat today → the two logged meals, nothing logged', text: 'what have I eaten so far today?', judge: all(noMeal, says(/rajma/i, 'no rajma'), says(/egg/i, 'no eggs')) },
  { id: 'ate-yesterday', what: "Yesterday's meals → masala dosa, paneer bhurji", text: 'what did I eat yesterday?', judge: all(noMeal, says(/dosa/i, 'no dosa'), says(/paneer/i, 'no paneer')) },
  { id: 'left-today', what: 'Calories and protein left → 1360 and 118', text: 'how many calories and how much protein do I have left today?', judge: all(says(/(?<!\d)1360(?!\d)/, 'not 1360'), says(/(?<!\d)118(?!\d)/, 'not 118')) },
  // What to eat: from the suggestions, inside the budget, respecting the diet.
  { id: 'eat-veg', what: 'Dinner idea for a vegetarian who eats no eggs: no meat or eggs, nothing logged, calories within what is left', text: 'what should I eat for dinner tonight?', patch: { memory: VEG, meals: VEG_MEALS },
    judge: all(noMeal, g => (/\b(chicken|eggs?|fish|mutton|prawns?|tuna|omelette)\b/i.test(g.text.replace(NEGATED, ' ')) ? `suggested non-veg: "${g.text.slice(0, 110)}"` : null), g => {
      const over = [...plain(g.text).matchAll(/(\d{3,4})\s*(?:k?cal)/gi)].map(m => +m[1]).filter(n => n > LEFT.kcal + 60 && n !== 2100);
      return over.length ? `calories above what is left: ${over.join(', ')}` : null;
    }, says(/roti|dal|rajma|paneer|soya|chole|khichdi|rice|curd|tofu|sabzi/i, 'no concrete food')) },
  { id: 'eat-hinglish', what: 'Hinglish "what do I eat now": answers in Hinglish with a concrete food, nothing logged', text: 'bhai ab kya khau? bhook lagi hai', patch: { bro: true },
    judge: all(noMeal, g => (DEVANAGARI.test(g.text) ? 'answered in Devanagari, not Hinglish' : null), says(/chicken|roti|dal|rice|egg|paneer|curry|fish|chana|whey|banana|curd|sprouts|yogurt/i, 'no concrete food')) },
  // Changes to the vow.
  { id: 'vow-protein', what: 'Protein target → 160', text: 'change my protein target to 160 please', judge: g => (g.out.vow?.protein === '160' ? null : `vow ${JSON.stringify(g.out.vow)}`) },
  { id: 'vow-deadline', what: 'Deadline "this coming Friday" → 2026-11-20', text: 'move my deadline to this coming Friday', judge: g => (g.out.vow?.deadline === '2026-11-20' ? null : `vow ${JSON.stringify(g.out.vow)}`) },
  { id: 'weigh-in', what: 'Weigh-in 83.4', text: 'weighed 83.4 this morning', judge: g => (g.out.vow?.weight === '83.4' ? null : `vow ${JSON.stringify(g.out.vow)}`) },
  // Never invent.
  { id: 'no-food-named', what: '"Log my snack" with no food: asks, logs nothing', text: 'log my snack please', judge: all(noMeal, g => (/\blogged\b/i.test(g.text) ? `claimed it was logged: "${g.text.slice(0, 110)}"` : null)) },
  { id: 'walk-no-duration', what: '"A long walk" with no duration: not logged (REI asks)', text: 'went for a long walk this morning', judge: g => (g.out.workouts.length ? `logged ${Math.round(g.out.workouts[0].seconds / 60)} invented minutes` : null) },
  { id: 'walk-40', what: 'Walk with a duration: logged at exactly 40 min', text: 'walked for 40 minutes this morning', judge: g => (g.out.workouts.length === 1 && g.out.workouts[0].seconds === 2400 ? null : `workouts ${JSON.stringify(g.out.workouts.map(w => w.seconds / 60))}`) },
  { id: 'plan-not-eaten', what: 'Food they are only considering is not logged', text: 'thinking of ordering a pizza tonight, is that ok?', judge: noMeal },
  { id: 'no-relog', what: 'Lunch from earlier is not logged again', text: 'going to a movie with friends at 7. talk later',
    patch: { messages: [{ id: 'aaaaaa1', role: 'user', text: 'Just ate: rajma chawal', time: '13:20', createdAt: ago(45) }, { id: 'aaaaaa2', role: 'rei', text: 'Rajma chawal, 450 kcal. 1360 left.', time: '13:20', createdAt: ago(44) }] }, judge: noMeal },
  // Memory and language.
  { id: 'remember', what: 'A peanut allergy is remembered', text: "btw I'm allergic to peanuts", judge: g => (g.out.memory.remember.some(m => /peanut/i.test(m.text)) ? null : 'not remembered') },
  { id: 'hindi-question', what: 'Hindi question about the workout: Hindi reply with 18:30', text: 'आज मेरा वर्कआउट कितने बजे है?', judge: all(says(DEVANAGARI, 'reply not in Hindi'), says(/18[:.]30|6[:.]30|साढ़े छह|साढ़े छः/, 'no 18:30')) },
];

// ---- Running ----------------------------------------------------------------------

const prices: Record<string, [number, number]> = {};
try {
  const list = await (await fetch('https://openrouter.ai/api/v1/models')).json();
  for (const m of list.data) prices[m.id] = [+m.pricing.prompt, +m.pricing.completion];
} catch {
  // No prices: costs print as 0.
}

async function ask(model: string, c: Case) {
  const k = known(c.patch);
  const a: BR.Ask = { text: c.text, mode: c.mode ?? 'chat', voice: false };
  const prep = B.prepare(k, a, NOW.getTime());
  // The same request llm.ts sends for the fast tier.
  const body = {
    model, stream: true, max_tokens: prep.maxTokens, usage: { include: true }, provider: { require_parameters: true }, reasoning: { effort: 'none', exclude: true },
    messages: [{ role: 'system', content: prep.system }, ...prep.turns],
    tools: prep.tools.map(x => ({ type: 'function', function: { name: x.name, description: x.description, parameters: x.input_schema } })),
    ...(prep.forceTool ? { tool_choice: { type: 'function', function: { name: prep.forceTool } } } : {}),
  };
  const post = () => fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'REI eval' }, body: JSON.stringify(body) });
  const t0 = Date.now();
  let res = await post();
  if (res.status === 400) {
    body.reasoning.effort = 'minimal';
    res = await post();
  }
  if (!res.ok) return { ok: false, why: `HTTP ${res.status} ${(await res.text()).slice(0, 100)}`, ttft: 0, total: 0, cost: 0, inTok: 0, outTok: 0, text: '' };
  let text = '', ttft = 0, usage: any = null, finish = 'stop';
  const calls: { name: string; args: string }[] = [];
  // Read as it streams, so "first word" is when the first word really arrived.
  const lines = async function* () {
    const dec = new TextDecoder();
    let buf = '';
    for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += dec.decode(part, { stream: true });
      const ls = buf.split('\n');
      buf = ls.pop() ?? '';
      yield* ls;
    }
    if (buf) yield buf;
  };
  for await (const ln of lines()) {
    if (!ln.startsWith('data:') || ln.includes('[DONE]')) continue;
    let ch: any;
    try {
      ch = JSON.parse(ln.slice(5));
    } catch {
      continue;
    }
    if (ch.usage) usage = ch.usage;
    const choice = ch.choices?.[0];
    if (choice?.finish_reason) finish = choice.finish_reason;
    const d = choice?.delta;
    if (d?.content) {
      if (!ttft) ttft = Date.now() - t0;
      text += d.content;
    }
    for (const [i, tc] of (d?.tool_calls ?? []).entries()) {
      const n = tc.index ?? i;
      calls[n] ??= { name: '', args: '' };
      if (tc.function?.name) calls[n].name += tc.function.name;
      if (tc.function?.arguments) calls[n].args += tc.function.arguments;
      if (!ttft) ttft = Date.now() - t0;
    }
  }
  const total = Date.now() - t0;
  const content: any[] = text ? [{ type: 'text', text }] : [];
  for (const cl of calls.filter(Boolean)) {
    try {
      content.push({ type: 'tool_use', name: cl.name, input: JSON.parse(cl.args || '{}') });
    } catch {
      // A call cut off mid-JSON is dropped, as in llm.ts.
    }
  }
  const final = { content, stop_reason: finish === 'length' ? 'max_tokens' : calls.length ? 'tool_use' : 'end_turn', model, usage: { input_tokens: usage?.prompt_tokens ?? 0, output_tokens: usage?.completion_tokens ?? 0, cache_read_input_tokens: 0 } } as any;
  const out = B.interpret(final, prep, k, a, NOW.getTime());
  let said = S.dropRepeats(S.stripTags(S.parseReply(out.text).text));
  // The endpoint's catch for "logged" said without the call: the call is asked for on its own.
  if (B.owesMeal?.(out, said, a)) {
    const forced = { ...body, stream: false, max_tokens: 1024, tools: body.tools.filter(t => t.function.name === 'log_meal'), tool_choice: { type: 'function', function: { name: 'log_meal' } } };
    const r0 = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'REI eval' }, body: JSON.stringify(forced) });
    const j0: any = r0.ok ? await r0.json() : null;
    const content0 = (j0?.choices?.[0]?.message?.tool_calls ?? []).flatMap((t: any) => {
      try {
        return [{ type: 'tool_use', name: t.function.name, input: JSON.parse(t.function.arguments || '{}') }];
      } catch {
        return [];
      }
    });
    const late = B.lateMeal({ content: content0, stop_reason: 'tool_use', model, usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 } } as any, prep, k, a);
    if (late) {
      out.meal = late.meal;
      out.mealClaimed = late.claimed;
    }
  }
  // The endpoint's second pass (redoFor): REI must ask rather than confirm, or its numbers differ from what was logged.
  const redo = B.redoFor?.(out, said, out.meal, k, prep.system);
  if (redo) {
    const r1 = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'REI eval' }, body: JSON.stringify({ model, max_tokens: 512, reasoning: body.reasoning, messages: [{ role: 'system', content: `${prep.system}\n\n${redo}` }, ...prep.turns] }) });
    const j1: any = r1.ok ? await r1.json() : null;
    const again = S.dropRepeats(S.stripTags(S.parseReply(j1?.choices?.[0]?.message?.content ?? '').text));
    if (again) said = again;
  }
  if (out.meal && B.groundedReply) said = B.groundedReply(said, out.meal, k, prep.system);
  // The endpoint's second pass: REI said "noted" without a remember call, so the fact is asked for on its own.
  if (a.mode === 'chat' && !out.memory.remember.length && B.saidNoted?.(said)) {
    const forced = { ...body, stream: false, max_tokens: 300, messages: [{ role: 'system', content: `${prep.system}\n\n${B.REMEMBER_PASS}` }, ...prep.turns], tools: body.tools.filter(t => t.function.name === 'remember'), tool_choice: { type: 'function', function: { name: 'remember' } } };
    const r2 = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'REI eval' }, body: JSON.stringify(forced) });
    const j: any = r2.ok ? await r2.json() : null;
    const tc = j?.choices?.[0]?.message?.tool_calls ?? [];
    const content2 = tc.flatMap((t: any) => {
      try {
        return [{ type: 'tool_use', name: t.function.name, input: JSON.parse(t.function.arguments || '{}') }];
      } catch {
        return [];
      }
    });
    out.memory.remember.push(...B.rememberedIn({ content: content2, stop_reason: 'tool_use', model, usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 } } as any));
  }
  const why = c.judge({ text: said, out, calls: calls.filter(Boolean).map(x => x.name) });
  const [pi, po] = prices[model] ?? [0, 0];
  return { ok: !why, why, ttft, total, cost: (usage?.prompt_tokens ?? 0) * pi + (usage?.completion_tokens ?? 0) * po, inTok: usage?.prompt_tokens ?? 0, outTok: usage?.completion_tokens ?? 0, text: said.replace(/\s+/g, ' ').slice(0, 300) };
}

const cases = CASES.filter(c => !ONLY || ONLY.includes(c.id));
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
const report: Record<string, unknown> = { at: new Date().toISOString(), runs: RUNS, models: {} };
for (const model of MODELS) {
  const jobs = cases.flatMap(c => Array.from({ length: RUNS }, () => c));
  const results: Awaited<ReturnType<typeof ask>>[] = [];
  // Six at a time: quick, and under any rate limit.
  for (let i = 0; i < jobs.length; i += 6) results.push(...(await Promise.all(jobs.slice(i, i + 6).map(c => ask(model, c).catch(e => ({ ok: false, why: String(e).slice(0, 100), ttft: 0, total: 0, cost: 0, inTok: 0, outTok: 0, text: '' }))))));
  const perCase: Record<string, { pass: number; of: number; fails: string[] }> = {};
  jobs.forEach((c, i) => {
    const r = results[i];
    const row = (perCase[c.id] ??= { pass: 0, of: 0, fails: [] });
    row.of++;
    if (r.ok) row.pass++;
    else row.fails.push(r.why ?? '');
  });
  // With --verbose, every wrong reply in full.
  if (process.argv.includes('--verbose')) jobs.forEach((c, i) => !results[i].ok && console.log(`  [${c.id}] ${results[i].why}\n      said: ${results[i].text}`));
  console.log(`\n${model}`);
  for (const c of cases) console.log(`  ${perCase[c.id].pass}/${perCase[c.id].of}  ${c.id.padEnd(18)} ${perCase[c.id].fails.length ? `FAIL: ${perCase[c.id].fails[0]}` : ''}`);
  const pass = results.filter(r => r.ok).length;
  const summary = { pass, of: results.length, casesAllPass: cases.filter(c => perCase[c.id].pass === perCase[c.id].of).length, cases: cases.length, medianFirstMs: median(results.map(r => r.ttft).filter(Boolean)), medianTotalMs: median(results.map(r => r.total).filter(Boolean)), avgInTokens: Math.round(results.reduce((a, r) => a + r.inTok, 0) / results.length), avgOutTokens: Math.round(results.reduce((a, r) => a + r.outTok, 0) / results.length), costPerReply: +(results.reduce((a, r) => a + r.cost, 0) / results.length).toFixed(5), totalCost: +results.reduce((a, r) => a + r.cost, 0).toFixed(4) };
  console.log(`  = ${pass}/${results.length} replies right, ${summary.casesAllPass}/${cases.length} cases right every time | first word ${summary.medianFirstMs} ms, done ${summary.medianTotalMs} ms | ${summary.avgInTokens} in / ${summary.avgOutTokens} out tokens | $${summary.costPerReply} a reply ($${summary.totalCost} this run)`);
  (report.models as Record<string, unknown>)[model] = { summary, perCase };
}
if (arg('json')) writeFileSync(arg('json')!, JSON.stringify(report, null, 2));
