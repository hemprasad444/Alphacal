import { catalog, hhmm, MAX_MEALS, nutrition, reiContext, systemContext, systemRules } from '@rei/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './admin';
import { save } from './chat';
import { loadUser, usageToday } from './chat/load';
import { complete, jsonText, LlmError, OPENROUTER_API_KEY } from './llm';
import { PHOTO_PROMPT, PHOTO_SCHEMA, photoInput, photoMeal, photoNumbers } from './photoMeal';

/** Photos a user may send per day: each one is a vision call. */
const PHOTOS_PER_DAY = 40;

/**
 * A meal photo from the Fuel screen: the model reads the plate item by item, the food list supplies
 * the numbers for what it has, and REI reacts. Confident reads are logged like a typed meal; unsure ones only ask.
 */
export const mealFromPhoto = onCall({ secrets: [OPENROUTER_API_KEY], timeoutSeconds: 120, memory: '512MiB' }, async req => {
  if (!req.auth || req.auth.token.tester !== true) throw new HttpsError('permission-denied', 'Not on the tester list.');
  const image = photoInput(req.data?.image);
  const note = typeof req.data?.note === 'string' ? req.data.note.trim().slice(0, 200) : '';
  if (!image) throw new HttpsError('invalid-argument', 'Send one JPEG under 1.5 MB.');
  const uid = req.auth.uid;
  const t0 = Date.now();
  const { ref: usage, data: counts } = await usageToday(uid);
  if (Number(counts.photos ?? 0) >= PHOTOS_PER_DAY) throw new HttpsError('resource-exhausted', 'That’s enough photos for today. Type the meal instead.');
  usage.set({ photos: FieldValue.increment(1) }, { merge: true }).catch(e => logger.warn('usage write failed', e));
  const data = await loadUser(uid);
  const ctx = reiContext(data.input);

  let res;
  try {
    res = await complete({
      task: 'photo',
      system: `${systemRules({ tough: ctx.tough, bro: ctx.bro, nudge: ctx.nudge, tools: false })}\n\n${systemContext(ctx)}\n${PHOTO_PROMPT}`,
      messages: [{ role: 'user', content: note ? `What I'm eating: ${note}` : 'What I’m eating.' }],
      image,
      maxTokens: 4000,
      json: PHOTO_SCHEMA,
    });
  } catch (e) {
    logger.error('photo failed', { uid, status: e instanceof LlmError ? e.status : undefined, error: e instanceof Error ? e.message : String(e) });
    throw new HttpsError('unavailable', 'REI could not read the photo. Try again.');
  }
  if (res.stop_reason === 'refusal') throw new HttpsError('failed-precondition', 'REI can only read food photos.');
  let out: unknown;
  try {
    out = JSON.parse(jsonText(res));
  } catch {
    throw new HttpsError('internal', 'REI could not read the photo. Try again.');
  }
  const time = hhmm(data.input.now);
  const read = photoMeal(out, [...data.foods, ...catalog()], time);
  // A full day's log takes no more: say so instead of numbers for a meal that isn't stored.
  const full = data.input.meals.length >= MAX_MEALS;
  const meal = full ? null : read.meal;
  // REI's words, then the numbers as logged: the model never states a total the app didn't compute.
  const text = meal
    ? `${read.verdict.trimEnd()} ${photoNumbers(meal, data.input.profile, nutrition(data.input.meals, data.input.activity))}`
    : read.meal ? `${read.verdict.trimEnd()} Not logged: today already holds ${MAX_MEALS} meals. Edit one of them instead.` : read.verdict;

  const replyId = `ph${Date.now().toString(36)}`;
  await db.doc(`users/${uid}/messages/${replyId}u`).set({ role: 'user', text: note ? `Photo: ${note}` : 'Photo of my meal', time, createdAt: Date.now() - 1 });
  const notes = await save(uid, data, replyId, text, meal, null, null);
  logger.info('photo', { uid, ms: Date.now() - t0, confidence: read.confidence, logged: !!meal, listed: read.listed, estimated: read.estimated, model: res.model, inTokens: res.usage.input_tokens });
  return { text, logged: !!meal, notes };
});
