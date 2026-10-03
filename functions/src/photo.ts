import { hhmm, reiContext, systemContext, systemRules, type Meal } from '@rei/shared';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './admin';
import { save } from './chat';
import { loadUser } from './chat/load';
import { parseMeal } from './chat/tools';
import { complete, jsonText, LlmError, OPENROUTER_API_KEY } from './llm';

/** About 1.5 MB of JPEG; the app sends ~150 KB (1024 px, quality 0.7). */
const MAX_BASE64 = 2_000_000;

const PHOTO_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Short name for the meal' },
    kcal: { type: 'integer' },
    p: { type: 'integer', description: 'Protein, grams' },
    c: { type: 'integer', description: 'Carbohydrates, grams' },
    f: { type: 'integer', description: 'Fat, grams' },
    confidence: { type: 'number', description: '0 to 1: how sure you are of the portion and contents' },
    verdict: { type: 'string', description: 'REI’s reaction in one or two sentences, using the numbers left after this meal. If unsure, one short question about what is in it or how much.' },
  },
  required: ['name', 'kcal', 'p', 'c', 'f', 'confidence', 'verdict'],
  additionalProperties: false,
} as const;

/**
 * A meal photo from the Fuel screen: the model reads the plate, estimates macros, and REI
 * reacts. Confident estimates are logged like a typed meal; unsure ones only ask.
 */
export const mealFromPhoto = onCall({ secrets: [OPENROUTER_API_KEY], timeoutSeconds: 120, memory: '512MiB' }, async req => {
  if (!req.auth || req.auth.token.tester !== true) throw new HttpsError('permission-denied', 'Not on the tester list.');
  const image = req.data?.image;
  const note = typeof req.data?.note === 'string' ? req.data.note.trim().slice(0, 200) : '';
  if (typeof image !== 'string' || image.length < 100 || image.length > MAX_BASE64) throw new HttpsError('invalid-argument', 'Send one JPEG under 1.5 MB.');
  const uid = req.auth.uid;
  const t0 = Date.now();
  const data = await loadUser(uid);
  const ctx = reiContext(data.input);

  let res;
  try {
    res = await complete({
      task: 'photo',
      system: `${systemRules({ tough: ctx.tough, nudge: ctx.nudge, tools: false })}\n\n${systemContext(ctx)}\nThe user sent a photo of what they are eating. Estimate it like a nutrition coach: identify each item, judge portion sizes from plate and cutlery scale, and count oil and sauces.`,
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
  const est = parseMeal(out);
  const confidence = Number((out as { confidence?: unknown }).confidence ?? 0);
  const verdict = est?.verdict || 'Couldn’t read that plate. Tell me what it is and roughly how much.';
  const logged = !!est && confidence >= 0.5;
  const meal: Meal | null = logged && est ? { time: hhmm(data.input.now), name: est.name.charAt(0).toUpperCase() + est.name.slice(1), kcal: est.kcal, p: est.p, c: est.c, f: est.f, src: 'photo' } : null;

  const replyId = `ph${Date.now().toString(36)}`;
  await db.doc(`users/${uid}/messages/${replyId}u`).set({ role: 'user', text: note ? `Photo: ${note}` : 'Photo of my meal', time: hhmm(data.input.now), createdAt: Date.now() - 1 });
  const notes = await save(uid, data, replyId, verdict, meal, null, null);
  logger.info('photo', { uid, ms: Date.now() - t0, confidence, logged, model: res.model, inTokens: res.usage.input_tokens });
  return { text: verdict, logged, notes };
});
