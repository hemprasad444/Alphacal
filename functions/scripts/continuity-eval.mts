// Continuity benchmark: does REI pick the conversation up, or restart it with "hey, what's up?"
// Runs REI's real prompts (shared/) against the real models over scenarios at different gaps and
// personalities: the live-call opener (GPT-OSS on Groq, as voiceSession does) and a reply to a
// bare "hey" in chat (the fast chat model, as the chat function does).
//
//   OPENROUTER_API_KEY=... npx tsx scripts/continuity-eval.mts [runs per scenario, default 2]
import * as sh from '@rei/shared';
import type { Message } from '@rei/shared';

const S = ((sh as unknown as { default?: typeof sh }).default ?? sh) as typeof sh;
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error('Set OPENROUTER_API_KEY');
const RUNS = Number(process.argv.find(a => /^\d+$/.test(a)) ?? 2);
/** `baseline`: REI as it was, with no continuity note (calls opened with the fixed greeting). */
const BASELINE = process.argv.includes('baseline');
const NOW = new Date(2026, 9, 4, 19, 0);
const LIVE = ['openai/gpt-oss-120b', 'openai/gpt-6-luna'];
const CHAT = ['openai/gpt-6-luna', 'google/gemini-3.8-flash'];
const BANNED = /how are you|how[’']?s it going|how[’']?s your|what[’']?s (up|good|going on|the move)|how have you been|how can i help/i;

const at = (min: number) => NOW.getTime() - min * 60000;
const msg = (role: Message['role'], text: string, min: number): Message => ({ role, text, time: '', createdAt: at(min) });

interface Scenario {
  name: string;
  tone: { tough: boolean; bro: boolean };
  messages: Message[];
  /** Words a reply should pick up on (any one counts). */
  hooks: RegExp;
  /** Same-day: a fresh greeting here is the bug. */
  noGreeting: boolean;
}

const SCENARIOS: Scenario[] = [
  { name: 'mid-chat, 8 min, bro', tone: { tough: true, bro: true }, noGreeting: true, hooks: /leg|squat|dinner|tonight|eat/i,
    messages: [msg('user', 'Doing legs tonight, squats first', 10), msg('rei', 'Good. Squats, then eat a real dinner.', 9), msg('user', 'yeah ok', 8)] },
  { name: 'mid-chat, 40 min, coach', tone: { tough: false, bro: false }, noGreeting: true, hooks: /fried rice|order|protein|dinner|chicken/i,
    messages: [msg('user', 'Ordering chicken fried rice from Zomato', 41), msg('rei', 'Fine. Ask for extra chicken.', 40)] },
  { name: 'earlier today, 5 h, tough', tone: { tough: true, bro: false }, noGreeting: true, hooks: /run|morning|5 ?k|protein|session|tonight/i,
    messages: [msg('user', 'Morning run done, 5k in 28', 300), msg('rei', 'Solid. Protein at lunch.', 299)] },
  { name: 'yesterday, bro', tone: { tough: true, bro: true }, noGreeting: false, hooks: /kiran|weekend|football|yesterday|match|game/i,
    messages: [msg('user', 'Playing football with Kiran tomorrow if he shows up', 22 * 60), msg('rei', 'If Kiran ghosts, you still run.', 22 * 60 - 1)] },
  { name: 'away 4 days, tough', tone: { tough: true, bro: false }, noGreeting: false, hooks: /days|back|gone|missed|away|ghost|disappear/i,
    messages: [msg('user', 'Busy week, talk later', 4 * 1440), msg('rei', 'Busy is not an excuse.', 4 * 1440 - 1)] },
  { name: 'first ever, coach', tone: { tough: false, bro: false }, noGreeting: false, hooks: /REI|goal|start|first|meet/i, messages: [] },
];

const ctxFor = (tone: Scenario['tone']) =>
  S.reiContext({ profile: { ...S.DEFAULT_PROFILE, name: 'Hem' }, disc: S.DEFAULT_DISCIPLINES, meals: [], sessionDone: false, history: { kind: 'demo', scenario: 'Slipping week' }, activity: { steps: null, sleep: null, sleepL: '' }, nudge: true, now: NOW, ...tone });

async function ask(models: string[], system: string, user: string, live: boolean): Promise<{ text: string; ms: number }> {
  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'REI continuity eval' },
    body: JSON.stringify({
      model: models[0],
      models,
      max_tokens: live ? 400 : 600,
      temperature: live ? 0.9 : 0.8,
      reasoning: { effort: live ? 'low' : 'minimal', exclude: true },
      ...(live ? { provider: { order: ['groq', 'cerebras'], allow_fallbacks: true } } : {}),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  const out = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message: string } };
  return { text: (out.choices?.[0]?.message?.content ?? `ERROR ${out.error?.message ?? res.status}`).replace(/\s+/g, ' ').trim(), ms: Date.now() - t0 };
}

const OPENER = `They just opened a live voice call with you. Write ONLY your first spoken line: 4 to 16 words, in your personality. Follow the CONVERSATION note first: if it's your first conversation, start by introducing yourself as REI; if they've been away for days, call out the gap first; if it's the same conversation, carry on mid-thread. Then mention one concrete thing: what they said last, or what's open today (protein left, tonight's session, a meal not logged). Never "how are you", "what's up" or "what's good". Plain words, at most one audio tag like [laughs].`;

let pass = 0, total = 0;
const ms: number[] = [];
for (const sc of SCENARIOS) {
  const ctx = ctxFor(sc.tone);
  const flow = S.thread(sc.messages, NOW.getTime());
  const note = BASELINE ? '' : S.continuityNote(flow);
  const live = `${S.agentPrompt(ctx)}\n\n${note}${S.historyBlock(S.recentTurns(sc.messages, 8))}`;
  const chat = [S.systemRules({ tough: ctx.tough, bro: ctx.bro, nudge: ctx.nudge, tools: true, voice: true }), S.systemContext(ctx), note, S.historyBlock(S.recentTurns(sc.messages))].join('\n\n');
  console.log(`\n■ ${sc.name}  [${flow.gap}]`);
  for (let i = 0; i < RUNS; i++) {
    const call = BASELINE ? { text: S.agentGreeting(ctx), ms: 0 } : await ask(LIVE, live, OPENER, true);
    for (const [kind, r] of [['call', call], ['chat', await ask(CHAT, chat, 'hey', false)]] as const) {
      const greeted = BANNED.test(r.text);
      const hooked = sc.hooks.test(r.text);
      const ok = !(sc.noGreeting && greeted) && (hooked || kind === 'chat') && !r.text.startsWith('ERROR');
      total++;
      if (ok) pass++;
      if (kind === 'call') ms.push(r.ms);
      console.log(`  ${ok ? '✓' : '✕'} ${kind} ${String(r.ms).padStart(5)} ms  ${greeted ? '[GENERIC] ' : ''}${hooked ? '' : '[NO HOOK] '}${r.text.slice(0, 150)}`);
    }
  }
}
ms.sort((a, b) => a - b);
console.log(`\n${pass}/${total} passed · call opener median ${ms[Math.floor(ms.length / 2)]} ms, p90 ${ms[Math.floor(ms.length * 0.9)]} ms`);
