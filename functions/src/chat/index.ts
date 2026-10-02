import Anthropic from '@anthropic-ai/sdk';
import { applyUpdate, fuelLine, hhmm, MODELS, nutrition, parseReply, reiContext, route, systemContext, systemRules, type Meal, type Message, type Tier, toTurns } from '@rei/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineInt } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { db } from '../admin';
import { ANTHROPIC_API_KEY, claude } from '../claude';
import { verify } from '../http';
import { DAILY_LIMIT, loadUser, usageDay } from './load';
import { logMealTool, logMealWithVerdictTool, parseMeal, parseVow, rebuildProgramTool, updateVowTool } from './tools';

/** Warm instances kept running so the first reply never waits on a cold start. */
const MIN_INSTANCES = defineInt('CHAT_MIN_INSTANCES', { default: 1 });

type Mode = 'chat' | 'meal';

interface Body {
  text: string;
  mode: Mode;
  /** Client-generated id for REI's reply, so the app can match its streamed bubble to the stored message. */
  replyId: string;
  /** The user's message, already written by the app; excluded from history and sent as the last turn. */
  userMessageId?: string;
}

const ID = /^[a-z0-9]{6,40}$/;

function parseBody(raw: unknown): Body | null {
  const b = (raw ?? {}) as Record<string, unknown>;
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text || text.length > 2000) return null;
  if (typeof b.replyId !== 'string' || !ID.test(b.replyId)) return null;
  const mode: Mode = b.mode === 'meal' ? 'meal' : 'chat';
  const userMessageId = typeof b.userMessageId === 'string' && ID.test(b.userMessageId) ? b.userMessageId : undefined;
  return { text, mode, replyId: b.replyId, userMessageId };
}

/**
 * POST /chat → Server-Sent Events.
 *   data: {"type":"delta","text":"..."}   text as it streams
 *   data: {"type":"done", ...}            final cleaned reply, notes, model, timings
 *   data: {"type":"error","message":"..."}
 * The reply, any meal and any vow change are written to Firestore before "done".
 */
export const chat = onRequest(
  { secrets: [ANTHROPIC_API_KEY], minInstances: MIN_INSTANCES, timeoutSeconds: 120, memory: '512MiB', concurrency: 40, cors: true },
  async (req, res) => {
    const t0 = Date.now();
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }
    const body = parseBody(req.body);
    if (!body) {
      res.status(400).json({ error: 'Bad request' });
      return;
    }
    const who = await verify(req);
    if ('error' in who) {
      res.status(who.error).json({ error: who.message });
      return;
    }
    const { uid } = who;
    const data = await loadUser(uid);
    if (data.usedToday >= DAILY_LIMIT) {
      res.status(429).json({ error: 'Daily message limit reached.' });
      return;
    }
    db.doc(`users/${uid}/usage/${usageDay()}`).set({ chat: FieldValue.increment(1) }, { merge: true }).catch(e => logger.warn('usage write failed', e));

    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const send = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    const ctx = reiContext(data.input);
    const system: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
      { type: 'text', text: systemRules({ tough: ctx.tough, nudge: ctx.nudge, tools: true }), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: systemContext(ctx) },
    ];
    const userText = body.mode === 'meal' ? `Just ate: ${body.text}` : body.text;
    const history = data.messages.filter(m => m.id !== body.userMessageId);
    const turns = toTurns([...history, { role: 'user', text: userText, time: '' }]);
    const tier: Tier = body.mode === 'meal' ? 'fast' : route(body.text);
    const model = MODELS[tier];

    let ttft = 0;
    let text = '';
    let meal: Meal | null = null;
    let vow: ReturnType<typeof parseVow> = null;
    let rebuild: string | null = null;
    try {
      const final = await (body.mode === 'meal' ? mealCall(system, turns) : chatCall(tier, system, turns, d => {
        if (!ttft) ttft = Date.now() - t0;
        send({ type: 'delta', text: d });
      }));
      if (!ttft) ttft = Date.now() - t0;

      if (final.stop_reason === 'refusal') {
        text = 'Let’s keep this about your training, food and sleep. What do you need?';
      } else {
        text = final.content.map(b => (b.type === 'text' ? b.text : '')).join('');
        // A tool input cut off at max_tokens can still parse; never act on it.
        const toolsUsable = final.stop_reason !== 'max_tokens';
        for (const b of final.content) {
          if (b.type !== 'tool_use' || !toolsUsable) continue;
          if (b.name === 'log_meal') {
            const m = parseMeal(b.input);
            if (m) {
              meal = { time: hhmm(data.input.now), name: m.name.charAt(0).toUpperCase() + m.name.slice(1), kcal: m.kcal, p: m.p, c: m.c, f: m.f };
              if (m.verdict) text = m.verdict;
            }
          } else if (b.name === 'update_vow') {
            vow = parseVow(b.input);
          } else if (b.name === 'rebuild_program' && tier === 'deep') {
            const f = (b.input as { focus?: unknown } | null)?.focus;
            rebuild = typeof f === 'string' ? f.slice(0, 200) : '';
          }
        }
      }
      text = parseReply(text).text;
      if (!text && meal) text = fuelLine(data.input.profile, nutrition([...data.input.meals, meal], data.input.activity));
      if (!text) text = 'Noted.';

      const notes = await save(uid, data, body.replyId, text, meal, vow, rebuild);
      const total = Date.now() - t0;
      send({ type: 'done', id: body.replyId, text, notes, model: final.model, tier, ttftMs: ttft, totalMs: total });
      logger.info('chat', {
        uid, tier, model: final.model, mode: body.mode, ttftMs: ttft, totalMs: total, stop: final.stop_reason,
        inTokens: final.usage.input_tokens, outTokens: final.usage.output_tokens, cacheRead: final.usage.cache_read_input_tokens ?? 0,
        meal: !!meal, vow: !!vow,
      });
    } catch (e) {
      const status = e instanceof Anthropic.APIError ? e.status : undefined;
      logger.error('chat failed', { uid, tier, status, error: e instanceof Error ? e.message : String(e) });
      send({ type: 'error', message: status === 429 || status === 529 ? 'REI is overloaded. Try again in a moment.' : 'REI could not answer.' });
    }
    res.end();
  },
);

/** Streamed reply that may end with log_meal / update_vow. */
async function chatCall(tier: Tier, system: Anthropic.Beta.Messages.BetaTextBlockParam[], turns: Anthropic.Beta.Messages.BetaMessageParam[], onText: (d: string) => void) {
  const c = claude();
  const stream =
    tier === 'deep'
      ? c.beta.messages.stream({
          model: MODELS.deep,
          max_tokens: 16000,
          output_config: { effort: 'medium' },
          // On a safety decline, the API re-runs the request on its recommended fallback model.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system,
          messages: turns,
          tools: [logMealTool, updateVowTool, rebuildProgramTool],
        })
      : c.beta.messages.stream({
          model: MODELS.fast,
          max_tokens: 2048,
          system,
          messages: turns,
          tools: [logMealTool, updateVowTool],
        });
  stream.on('text', onText);
  try {
    return await stream.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw e;
    // A tool input that isn't parseable JSON at all: keep the text, drop the tool call.
    logger.warn('tool input unparseable; using text only', { error: e instanceof Error ? e.message : String(e) });
    const snapshot = stream.currentMessage;
    if (!snapshot) throw e;
    return { ...snapshot, content: snapshot.content.filter(b => b.type === 'text') };
  }
}

/** Fuel screen: one forced tool call returns the macros and REI's verdict together. */
function mealCall(system: Anthropic.Beta.Messages.BetaTextBlockParam[], turns: Anthropic.Beta.Messages.BetaMessageParam[]) {
  return claude().beta.messages.create({
    model: MODELS.fast,
    max_tokens: 1024,
    system,
    messages: turns,
    tools: [logMealWithVerdictTool],
    tool_choice: { type: 'tool', name: 'log_meal' },
  });
}

/** Store REI's reply and any meal or vow change in one batch. Returns the system notes shown in chat. */
export async function save(uid: string, data: Awaited<ReturnType<typeof loadUser>>, replyId: string, text: string, meal: Meal | null, vow: ReturnType<typeof parseVow>, rebuild: string | null) {
  const user = db.doc(`users/${uid}`);
  const batch = db.batch();
  const now = Date.now();
  const time = hhmm(data.input.now);
  const notes: string[] = [];
  const alert = /miss|excuse|negotiat|skip|again|stop/i.test(text);
  const reply: Message = { role: 'rei', text, time, createdAt: now, alert };
  batch.set(user.collection('messages').doc(replyId), reply);

  if (meal) {
    batch.set(user.collection('days').doc(data.today), { meals: FieldValue.arrayUnion(meal) }, { merge: true });
    notes.push(`MEAL LOGGED · ${meal.kcal} KCAL · P ${meal.p} · C ${meal.c} · F ${meal.f}`);
  }
  const upd = applyUpdate(data.input.profile, vow);
  if (upd && vow) {
    batch.set(user, { profile: Object.fromEntries(Object.entries(vow)) }, { mergeFields: Object.keys(vow).map(k => `profile.${k}`) });
    if (vow.weight) batch.set(user.collection('weighIns').doc(data.today), { kg: parseFloat(vow.weight) });
    notes.push(upd.note);
  }
  if (rebuild !== null) {
    // runJob (program.ts) picks this up and writes the new week.
    batch.set(user.collection('jobs').doc(), { type: 'program', focus: rebuild, createdAt: now });
    notes.push('REBUILDING YOUR WEEK');
  }
  notes.forEach((n, i) => batch.set(user.collection('messages').doc(`${replyId}n${i}`), { role: 'sys', text: n, time, createdAt: now + 1 + i }));
  await batch.commit();
  return notes;
}
