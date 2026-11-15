// The live call's model, measured the same way as chat (eval-brain.mts): the call prompt and tool
// schemas the agent is given, one spoken line, and the phone's own checks on the tool call it makes.
//
//   cd functions && OPENROUTER_API_KEY=... npx tsx ../e2e/eval-live.mts [--runs 3] [--models openai/gpt-oss-120b]
//
// About $0.01 a run. Results: docs/brain-eval.md.
import * as SH from '../packages/shared/src/index.ts';

const S = ((SH as any).default ?? SH) as typeof SH;
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error('Set OPENROUTER_API_KEY.');
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const MODELS = (arg('models') ?? 'openai/gpt-oss-120b').split(',');
const RUNS = Number(arg('runs') ?? 3);

/** Sunday 15 November 2026, 14:05: the same user and moment as eval-brain.mts. */
const NOW = new Date(2026, 10, 15, 14, 5);
const profile = { ...S.DEFAULT_PROFILE, name: 'Hem', weight: '84', kcal: '2100', protein: '150', carbs: '220', fat: '65', steps: '9000', sessionTime: '18:30', bedtime: '23:00', deadline: '2026-12-31' };
const meals: SH.Meal[] = [{ time: '08:10', name: '2 boiled eggs and toast', kcal: 290, p: 17, c: 25, f: 12 }, { time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 }];
const ctx = S.reiContext({
  profile, disc: S.DEFAULT_DISCIPLINES, meals, sessionDone: false, history: { kind: 'real', startedOn: '2026-10-06', sessions: {} }, activity: { steps: 3200, sleep: 7.2, sleepL: '7h 12m' },
  tough: true, bro: true, nudge: true, now: NOW, program: null, memory: [{ id: 'm1', kind: 'diet', text: 'Non-veg; 4 meals a day', createdAt: 0, source: 'you' }],
  timeZone: 'Asia/Kolkata', sessions: [], days: {},
} as SH.ContextInput);
const foods = S.catalog();

interface Got { text: string; meal: SH.Meal | null; workout: SH.Workout | null; toolSaid: string }
interface Case { id: string; what: string; said: string; judge: (g: Got) => string | null }
const CASES: Case[] = [
  { id: 'meal-en', what: '2 rotis and dal → 370 kcal from the food list', said: 'I just had two rotis and a bowl of dal.', judge: g => (!g.meal ? 'no meal logged' : g.meal.kcal >= 320 && g.meal.kcal <= 420 ? null : `meal ${g.meal.kcal} kcal`) },
  { id: 'meal-hindi', what: 'The same said in Hindi → 370 kcal from the food list (items named in English)', said: 'मैंने अभी दो रोटी और एक कटोरी दाल खाई।', judge: g => (!g.meal ? 'no meal logged' : g.meal.kcal >= 320 && g.meal.kcal <= 420 ? null : `meal ${g.meal.kcal} kcal`) },
  { id: 'meal-biryani', what: 'A plate of chicken biryani and a coke → 640', said: 'I had a plate of chicken biryani and a coke.', judge: g => (!g.meal ? 'no meal logged' : g.meal.kcal >= 560 && g.meal.kcal <= 900 ? null : `meal ${g.meal.kcal} kcal`) },
  { id: 'walk-no-duration', what: 'A long walk, no duration → nothing logged, REI asks', said: 'I went for a long walk this morning.', judge: g => (g.workout ? `logged ${g.workout.minutes} invented minutes` : null) },
  { id: 'walk-40', what: 'A 40 minute walk → logged at 40', said: 'I walked for 40 minutes this morning.', judge: g => (g.workout?.minutes === 40 ? null : `workout ${JSON.stringify(g.workout)}`) },
  { id: 'time-workout', what: "When's my workout → 18:30", said: 'What time is my workout today?', judge: g => (/18[:.]30|6[:.]30|six[- ]thirty|half past six/i.test(g.text) ? null : `no 18:30: "${g.text.slice(0, 100)}"`) },
  { id: 'time-until', what: 'How long until it → 4 h 25 min', said: 'How long until my session starts?', judge: g => (/\b(4|four)\s*(h|hr|hrs|hours?)\b/i.test(g.text) && /\b25\b|twenty[- ]five/i.test(g.text) ? null : `not 4 h 25: "${g.text.slice(0, 100)}"`) },
  { id: 'left-today', what: 'Calories left → 1360', said: 'How many calories do I have left today?', judge: g => (/\b1,?360\b/.test(g.text) ? null : `not 1360: "${g.text.slice(0, 100)}"`) },
];

async function ask(model: string, c: Case) {
  const tools = S.liveTools(S.LIVE_TOOL_NAMES);
  // What voice-agent/agent.py sends: Groq first, low effort.
  const body = {
    model, max_tokens: 700, temperature: 0.6, reasoning: { effort: 'low', exclude: true }, provider: { order: ['groq', 'cerebras'], allow_fallbacks: true },
    messages: [{ role: 'system', content: S.agentPrompt(ctx, tools.map(t => t.name)) }, { role: 'user', content: c.said }],
    tools: tools.map(t => ({ type: 'function', function: t })),
  };
  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'REI live eval' }, body: JSON.stringify(body) });
  if (!res.ok) return { ok: false, why: `HTTP ${res.status}`, ms: 0, cost: 0 };
  const j: any = await res.json();
  const msg = j.choices?.[0]?.message ?? {};
  // As it is spoken: "1 360" and "twenty‑five" (a non-breaking hyphen) are 1360 and twenty-five.
  const got: Got = { text: String(msg.content ?? '').replace(/[\u2010-\u2015]/g, '-').replace(/(\d)[\s\u00a0\u202f\u2009,](?=\d{3}\b)/g, '$1'), meal: null, workout: null, toolSaid: '' };
  for (const tc of msg.tool_calls ?? []) {
    let p: any = {};
    try {
      p = JSON.parse(tc.function.arguments || '{}');
    } catch {
      continue;
    }
    // The phone's side of each tool (app/src/components/LiveVoice.tsx).
    if (tc.function.name === 'log_meal') {
      const n = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
      const checked = (S.checkLiveMeal as any)({ name: String(p.name ?? ''), kcal: n(p.kcal), p: n(p.protein), c: n(p.carbs), f: n(p.fat) }, c.said, foods, '14:05', true, p.items);
      if ('meal' in checked && S.shouldLogMeal(c.said, checked.meal, meals, '14:05').ok) got.meal = checked.meal;
    } else if (tc.function.name === 'log_workout') {
      const w = S.parseWorkout(p);
      const grounded = w && (S as any).groundWorkout ? (S as any).groundWorkout(w, c.said) : w ? { workout: w } : null;
      if (grounded && 'workout' in grounded) got.workout = grounded.workout;
      else if (grounded) got.toolSaid = grounded.ask;
    }
  }
  const why = c.judge(got);
  return { ok: !why, why, ms: Date.now() - t0, cost: Number(j.usage?.cost ?? 0), inTok: j.usage?.prompt_tokens ?? 0 };
}

for (const model of MODELS) {
  console.log(`\n${model}`);
  let pass = 0, n = 0, cost = 0, inTok = 0;
  const times: number[] = [];
  for (const c of CASES) {
    const rs = await Promise.all(Array.from({ length: RUNS }, () => ask(model, c).catch(e => ({ ok: false, why: String(e).slice(0, 80), ms: 0, cost: 0, inTok: 0 }))));
    const ok = rs.filter(r => r.ok).length;
    pass += ok;
    n += rs.length;
    cost += rs.reduce((a, r) => a + r.cost, 0);
    inTok += rs.reduce((a, r) => a + ((r as any).inTok ?? 0), 0);
    times.push(...rs.map(r => r.ms).filter(Boolean));
    console.log(`  ${ok}/${rs.length}  ${c.id.padEnd(18)} ${ok < rs.length ? `FAIL: ${rs.find(r => !r.ok)?.why}` : ''}`);
  }
  times.sort((a, b) => a - b);
  console.log(`  = ${pass}/${n} right | median ${times[Math.floor(times.length / 2)] ?? 0} ms | ${Math.round(inTok / n)} prompt tokens | $${cost.toFixed(4)} this run`);
}
