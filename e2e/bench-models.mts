// REI's chat on candidate models: same system prompt, same tools, same tasks, 3 runs each.
import * as SH from '../packages/shared/src/index.ts';
import * as TOOLS from '../functions/src/chat/tools.ts';
const S = ((SH as any).default ?? SH) as typeof SH;
const TL = ((TOOLS as any).default ?? TOOLS) as typeof TOOLS;
const KEY = process.env.OPENROUTER_API_KEY!;
const MODELS = process.argv.slice(2).length ? process.argv.slice(2) : ['openai/gpt-6-luna', 'deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4.1-flash'];
const RUNS = 3;
const NOW = new Date(2026, 9, 6, 21, 0);
const min = (m: number) => NOW.getTime() - m * 60000;

const ctx = S.reiContext({ profile: { ...S.DEFAULT_PROFILE, name: 'Hem', weight: '84', targetWeight: '76.5', kcal: '2100', protein: '185', carbs: '195', fat: '65' }, disc: S.DEFAULT_DISCIPLINES,
  meals: [{ time: '13:40', name: 'Chicken biryani and Coke', kcal: 890, p: 35, c: 125, f: 28 }], sessionDone: false, history: { kind: 'demo', scenario: 'Strong week' },
  activity: { steps: null, sleep: null, sleepL: '' }, nudge: true, now: NOW, tough: true, bro: true } as any);

type Task = { name: string; history: SH.Message[]; text: string; foods?: boolean; judge: (r: { text: string; tools: { name: string; input: any }[] }) => string | null };
const TASKS: Task[] = [
  { name: 'log a meal', history: [], text: 'had 2 roti, dal and paneer sabzi for dinner', foods: true,
    judge: r => { const m = r.tools.find(t => t.name === 'log_meal'); if (!m) return 'no log_meal'; const k = (m.input.items ?? []).reduce((a: number, i: any) => a + (+i.kcal || 0), 0); return k >= 350 && k <= 900 ? null : `kcal ${k}`; } },
  { name: 'no re-log of lunch', history: [{ role: 'user', text: 'Just ate: chicken biryani and a coke', time: '13:40', createdAt: min(440) }, { role: 'rei', text: 'Logged. 890 kcal.', time: '13:40', createdAt: min(439) }], text: 'Rest day so no gym bro, going to a movie with my friends at 7. talk later',
    judge: r => (r.tools.some(t => t.name === 'log_meal') ? 'logged the lunch again' : /movie|enjoy|fun|have a good/i.test(r.text) ? null : 'ignored the movie') },
  { name: 'plan follow-up', history: [{ role: 'user', text: 'going to watch Dune 3 with the boys at 7', time: '18:10', createdAt: min(170) }, { role: 'user', text: 'ok bye', time: '18:12', createdAt: min(168) }], text: 'yo im back',
    judge: r => (/movie|dune|film/i.test(r.text) ? null : 'no follow-up') },
  { name: 'log a workout', history: [], text: 'did 30 min of sprint intervals at the park, 8 rounds',
    judge: r => (r.tools.some(t => t.name === 'log_workout') ? null : 'no log_workout') },
  { name: 'change a target', history: [], text: 'change my protein target to 160 please',
    judge: r => { const v = r.tools.find(t => t.name === 'update_vow'); return v && JSON.stringify(v.input).includes('160') ? null : 'no update_vow 160'; } },
];

const prices: Record<string, [number, number]> = {};
const list = await (await fetch('https://openrouter.ai/api/v1/models')).json();
for (const m of list.data) prices[m.id] = [+m.pricing.prompt, +m.pricing.completion];

async function run(model: string, t: Task) {
  const thread = S.thread(t.history, NOW.getTime(), 'Asia/Kolkata');
  const candidates = t.foods ? S.foodCandidates(t.text, S.catalog()) : [];
  const system = [S.systemRules({ tough: ctx.tough, bro: ctx.bro, nudge: ctx.nudge, tools: true }), S.systemContext(ctx), S.continuityNote(thread), ...(candidates.length ? [S.foodListPrompt(candidates)] : [])].join('\n\n');
  const tools = [TL.logMealTool, TL.logWorkoutTool, TL.updateVowTool, TL.rememberTool, TL.forgetTool];
  const body = { model, stream: true, max_tokens: 2048, usage: { include: true }, provider: { require_parameters: true }, reasoning: { effort: 'none', exclude: true },
    messages: [{ role: 'system', content: system }, ...S.toTurns([...t.history, { role: 'user', text: t.text, time: '' }])],
    tools: tools.map(x => ({ type: 'function', function: { name: x.name, description: x.description, parameters: x.input_schema } })) };
  const t0 = Date.now();
  let res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.status === 400) { (body.reasoning as any).effort = 'minimal'; res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  if (!res.ok) return { ok: false, why: `HTTP ${res.status} ${(await res.text()).slice(0, 120)}`, ttft: 0, total: 0, cost: 0, text: '' };
  let text = '', ttft = 0, usage: any = null, provider = '';
  const calls: { name: string; args: string }[] = [];
  for (const line of (await res.text()).split('\n')) {
    if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
    const c = JSON.parse(line.slice(5));
    if (c.provider) provider = c.provider;
    if (c.usage) usage = c.usage;
    const d = c.choices?.[0]?.delta;
    if (d?.content) { if (!ttft) ttft = Date.now() - t0; text += d.content; }
    for (const [i, tc] of (d?.tool_calls ?? []).entries()) { const k = tc.index ?? i; calls[k] ??= { name: '', args: '' }; if (tc.function?.name) calls[k].name += tc.function.name; if (tc.function?.arguments) calls[k].args += tc.function.arguments; if (!ttft) ttft = Date.now() - t0; }
  }
  const total = Date.now() - t0;
  const tools2 = calls.filter(Boolean).map(c => { try { return { name: c.name, input: JSON.parse(c.args || '{}') }; } catch { return { name: c.name, input: {} }; } });
  const why = t.judge({ text, tools: tools2 });
  const [pi, po] = prices[model] ?? [0, 0];
  const cost = usage ? usage.prompt_tokens * pi + usage.completion_tokens * po : 0;
  return { ok: !why, why, ttft, total, cost, text: text.replace(/\s+/g, ' ').slice(0, 90), provider };
}

const summary: string[] = [];
for (const model of MODELS) {
  let pass = 0, n = 0, ttfts: number[] = [], totals: number[] = [], cost = 0;
  for (const t of TASKS) for (let r = 0; r < RUNS; r++) {
    const x = await run(model, t);
    n++; pass += x.ok ? 1 : 0; if (x.ttft) ttfts.push(x.ttft); totals.push(x.total); cost += x.cost;
    console.log(`${model.padEnd(30)} ${t.name.padEnd(20)} ${x.ok ? 'PASS' : 'FAIL ' + x.why} | first ${x.ttft} ms, total ${x.total} ms | ${x.provider ?? ''} | ${x.text}`);
  }
  const med = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
  summary.push(`${model.padEnd(30)} correct ${pass}/${n} | median first word ${med(ttfts)} ms | median total ${med(totals)} ms | avg cost per reply $${(cost / n).toFixed(5)}`);
}
console.log('\nSUMMARY\n' + summary.join('\n'));
