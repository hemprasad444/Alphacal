import { addMemory, applyUpdate, dropRepeats, forgetMemory, fuelLine, hhmm, MAX_MEALS, type Meal, type Message, nutrition, parseReply, type SessionLog, stripTags, SWEARING, swearOnlyBack, warmFoodSearch, workoutNote } from '@rei/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineInt } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { db } from '../admin';
import { complete, LlmError, modelsFor, OPENROUTER_API_KEY } from '../llm';
import { verify } from '../http';
import { type Ask, interpret, mealFrom, prepare, REMEMBER_PASS, rememberedIn, saidNoted } from './brain';
import { DAILY_LIMIT, loadUser } from './load';
import { type parseRemember, type parseVow, rememberTool } from './tools';

// Index the food list when the instance starts, not on the first message.
warmFoodSearch();

/** Warm instances kept running so the first reply never waits on a cold start. */
const MIN_INSTANCES = defineInt('CHAT_MIN_INSTANCES', { default: 1 });

interface Body extends Ask {
  /** Client-generated id for REI's reply, so the app can match its streamed bubble to the stored message. */
  replyId: string;
}

const ID = /^[a-z0-9]{6,40}$/;

export function parseBody(raw: unknown): Body | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text || text.length > 2000) return null;
  if (typeof b.replyId !== 'string' || !ID.test(b.replyId)) return null;
  const mode = b.mode === 'meal' ? 'meal' : 'chat';
  const userMessageId = typeof b.userMessageId === 'string' && ID.test(b.userMessageId) ? b.userMessageId : undefined;
  return { text, mode, replyId: b.replyId, userMessageId, voice: b.voice === true && mode === 'chat' };
}

const textOf = (res: { content: { type: string; text?: string }[] } | null) => (res ? res.content.map(b => (b.type === 'text' ? (b.text ?? '') : '')).join('') : '');

/**
 * POST /chat → Server-Sent Events.
 *   data: {"type":"delta","text":"..."}   text as it streams
 *   data: {"type":"done", ...}            final cleaned reply, notes, model, timings
 *   data: {"type":"error","message":"..."}
 * The reply, any meal and any vow change are written to Firestore before "done".
 */
export const chat = onRequest(
  { secrets: [OPENROUTER_API_KEY], minInstances: MIN_INSTANCES, timeoutSeconds: 120, memory: '512MiB', concurrency: 40, cors: true },
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
    let data: Awaited<ReturnType<typeof loadUser>>;
    try {
      data = await loadUser(uid);
    } catch (e) {
      // A database hiccup: a clean error the app can show, not a hung request.
      logger.error('chat load failed', { uid, error: e instanceof Error ? e.message : String(e) });
      res.status(503).json({ error: 'REI could not load your day. Try again in a moment.' });
      return;
    }
    const loadMs = Date.now() - t0;
    if (data.usedToday >= DAILY_LIMIT) {
      res.status(429).json({ error: 'Daily message limit reached.' });
      return;
    }
    db.doc(`users/${uid}/usage/${data.today}`).set({ chat: FieldValue.increment(1) }, { merge: true }).catch(e => logger.warn('usage write failed', e));

    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const send = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    let ttft = 0;
    let tier = 'fast';
    try {
      // What REI is told for this turn: persona, computed facts and suggestions, the conversation so far, the foods this message might mean.
      const prep = prepare(data, body);
      const { system, turns } = prep;
      tier = prep.tier;
      // REI swears only once they have (in this message or the chat so far).
      const swore = SWEARING.test(body.text) || prep.history.some(m => m.role === 'user' && SWEARING.test(m.text));
      // Streamed text holds back its last, maybe unfinished, word so a swear isn't split across two deltas.
      let pending = '';
      const stream = (d: string, flush = false) => {
        pending += d;
        const cut = flush ? pending.length : pending.search(/\S*$/);
        if (cut <= 0) return;
        send({ type: 'delta', text: swearOnlyBack(pending.slice(0, cut), swore) });
        pending = pending.slice(cut);
      };
      // Fuel: one forced tool call returns the items and REI's verdict together. Chat: a streamed reply that may end with tool calls.
      const onText = (d: string) => {
        if (!ttft) ttft = Date.now() - t0;
        stream(d);
      };
      const final = await complete({ task: prep.tier, system, messages: turns, maxTokens: prep.maxTokens, tools: prep.tools, forceTool: prep.forceTool, ...(body.mode === 'meal' ? {} : { onText }) });
      stream('', true);
      if (!ttft) ttft = Date.now() - t0;

      const o = interpret(final, prep, data, body);
      o.notes.forEach(n => logger.info(n, { uid }));
      let text = final.stop_reason === 'refusal' ? 'Let’s keep this about your training, food and sleep. What do you need?' : o.text;
      let meal = o.meal;
      // Fuel: logging is the point. A model that answers in words instead of calling log_meal (DeepSeek did,
      // every time, for "soya chunks curry with rice") gets one more try on the backup model; then the
      // reply says it wasn't logged rather than a verdict with no meal.
      if (body.mode === 'meal' && !meal && final.stop_reason !== 'refusal') {
        const backup = modelsFor('fast').find(m => m !== final.model) ?? modelsFor('fast')[0];
        const again = await complete({ task: 'fast', system, messages: turns, maxTokens: prep.maxTokens, tools: prep.tools, forceTool: prep.forceTool, model: backup }).catch(() => null);
        const calls = again && again.stop_reason !== 'max_tokens' ? again.content.flatMap(b => (b.type === 'tool_use' && b.name === 'log_meal' ? [b.input] : [])) : [];
        const m = mealFrom(calls, prep, hhmm(data.input.now));
        logger.info('meal call came back without log_meal', { uid, model: final.model, backup, retried: !!m });
        if (m) {
          meal = m.meal;
          text = m.verdict || text;
        } else {
          text = 'I couldn’t log that one. Try again, or pick it from the food list.';
        }
      }
      text = dropRepeats(stripTags(parseReply(text).text));
      // A second, tool-less answer when the first can't stand: a workout with no duration (REI must ask, not
      // claim it's logged), only a refused re-log, or a tool call that did nothing (never just "Noted.").
      const redo = o.askDuration
        ? 'They told you about a workout but not how long it was, so it is NOT logged yet. React to it in one sentence, then ask how long it took (and how far, if it was a run, walk or ride). Do not say it is logged and do not guess a duration.'
        : o.askFood
          ? 'They said they ate but not what, so NOTHING is logged. Ask what it was and roughly how much. Do not say anything is logged and do not suggest a meal as if they had eaten it.'
          : o.vowByRule.length
            ? `The app has just made this change they asked for: ${o.vowByRule.join(', ')}. Confirm it in one or two sentences in your voice, with the new value. It is done: do not ask them to confirm or repeat it.`
            : (o.mealBlocked && text.trim().length < 40) || (!text.trim() && !meal)
          ? 'Answer their latest message in your own words. Meals mentioned earlier are already logged.'
          : null;
      if (redo) {
        const again = await complete({ task: 'fast', system: `${system}\n\n${redo}`, messages: turns, maxTokens: 512 }).catch(() => null);
        const retry = stripTags(parseReply(textOf(again)).text);
        if (retry) text = dropRepeats(retry);
        else if (o.askDuration) text = 'How long was it? Tell me the minutes and I’ll log it.';
        else if (o.askFood) text = 'What did you eat, and roughly how much? Tell me and I’ll log it.';
        else if (o.vowByRule.length) text = `Done: ${o.vowByRule.join(', ')}.`;
      }
      // "Peanut allergy noted" with no remember call: ask once more for just the fact, so what REI says it noted is kept.
      if (body.mode === 'chat' && !o.memory.remember.length && saidNoted(text)) {
        const facts = await complete({ task: 'fast', system: `${system}\n\n${REMEMBER_PASS}`, messages: turns, maxTokens: 300, tools: [rememberTool], forceTool: 'remember' }).catch(() => null);
        o.memory.remember.push(...rememberedIn(facts));
        logger.info('remember pass', { uid, kept: o.memory.remember.length });
      }
      if (!text && meal) text = fuelLine(data.input.profile, nutrition([...data.input.meals, meal], data.input.activity));
      if (!text) text = 'Noted.';
      text = swearOnlyBack(text, swore);

      const notes = await save(uid, data, body.replyId, text, meal, o.vow, o.rebuild, o.memory, o.workouts);
      const total = Date.now() - t0;
      send({ type: 'done', id: body.replyId, text, notes, model: final.model, tier, ttftMs: ttft, totalMs: total });
      logger.info('chat', {
        uid, tier, voice: body.voice, loadMs, model: final.model, mode: body.mode, ttftMs: ttft, totalMs: total, stop: final.stop_reason,
        inTokens: final.usage.input_tokens, outTokens: final.usage.output_tokens, cacheRead: final.usage.cache_read_input_tokens ?? 0,
        meal: !!meal, vow: !!o.vow, workouts: o.workouts.length, askedDuration: !!o.askDuration, askedFood: o.askFood, vowByRule: o.vowByRule.length, remembered: o.memory.remember.length, forgot: o.memory.forget.length,
        foods: prep.candidates.length, matched: meal?.items?.filter(i => i.food).length ?? 0, estimated: meal?.items?.filter(i => !i.food).length ?? 0,
      });
    } catch (e) {
      const status = e instanceof LlmError ? e.status : undefined;
      logger.error('chat failed', { uid, tier, status, error: e instanceof Error ? e.message : String(e) });
      send({ type: 'error', message: status === 429 || status === 529 || status === 503 ? 'REI is overloaded. Try again in a moment.' : 'REI could not answer.' });
    }
    res.end();
  },
);

interface Memory {
  remember: ReturnType<typeof parseRemember>;
  forget: string[];
}

/** Store REI's reply and any meal, vow or memory change in one batch. Returns the system notes shown in chat. */
export async function save(uid: string, data: Awaited<ReturnType<typeof loadUser>>, replyId: string, text: string, meal: Meal | null, vow: ReturnType<typeof parseVow>, rebuild: string | null, memory: Memory = { remember: [], forget: [] }, workouts: SessionLog[] = []) {
  const user = db.doc(`users/${uid}`);
  const batch = db.batch();
  const now = Date.now();
  const time = hhmm(data.input.now);
  const notes: string[] = [];
  const alert = /miss|excuse|negotiat|skip|again|stop/i.test(text);
  const reply: Message = { role: 'rei', text, time, createdAt: now, alert };
  batch.set(user.collection('messages').doc(replyId), reply);

  if (meal && data.input.meals.length >= MAX_MEALS) {
    notes.push(`NOT LOGGED · ${MAX_MEALS} MEALS IS THE DAY'S LIMIT`);
  } else if (meal) {
    // Its own id: the phone removes and edits meals one by one, and two identical meals stay two.
    batch.set(user.collection('days').doc(data.today), { meals: FieldValue.arrayUnion({ ...meal, id: db.collection('_').doc().id.slice(0, 12) }) }, { merge: true });
    notes.push(`MEAL LOGGED · ${meal.kcal} KCAL · P ${meal.p} · C ${meal.c} · F ${meal.f}`);
  }
  const upd = applyUpdate(data.input.profile, vow);
  if (upd) {
    // Only the fields that passed the checks, as checked (trimmed), never the raw tool input.
    batch.set(user, { profile: Object.fromEntries(upd.keys.map(k => [k, upd.profile[k]])) }, { mergeFields: upd.keys.map(k => `profile.${k}`) });
    if (upd.keys.includes('weight')) batch.set(user.collection('weighIns').doc(data.today), { kg: parseFloat(upd.profile.weight) });
    notes.push(upd.note);
  }
  if (memory.remember.length || memory.forget.length) {
    const gone = forgetMemory(data.memory, memory.forget);
    const kept = addMemory(gone.list, memory.remember, 'rei', now, () => db.collection('_').doc().id.slice(0, 10));
    if (kept.added.length || gone.removed.length) {
      batch.set(user, { memory: kept.list }, { merge: true });
      if (kept.added.length) notes.push(`REMEMBERED · ${kept.added.map(m => m.text.toUpperCase()).join(' · ')}`.slice(0, 200));
      if (gone.removed.length) notes.push(`FORGOT · ${gone.removed.map(m => m.text.toUpperCase()).join(' · ')}`.slice(0, 200));
    }
  }
  if (workouts.length) {
    // Same records as logging it in the app: the day counts as trained, and each one is a session.
    const minutes = workouts.reduce((n, w) => n + Math.round(w.seconds / 60), 0);
    batch.set(user.collection('days').doc(data.today), { sessionDone: true, loggedMin: FieldValue.increment(minutes) }, { merge: true });
    for (const w of workouts) {
      batch.set(user.collection('sessions').doc(), w);
      notes.push(workoutNote(w));
    }
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
