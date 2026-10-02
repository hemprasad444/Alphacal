import Anthropic from '@anthropic-ai/sdk';
import { hhmm, MODELS, reiContext, systemContext, systemRules, type Meal } from '@rei/shared';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './admin';
import { save } from './chat';
import { loadUser } from './chat/load';
import { parseMeal } from './chat/tools';
import { ANTHROPIC_API_KEY, claude } from './claude';

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
 * A meal photo from the Fuel screen: Opus reads the plate, estimates macros, and REI
 * reacts. Confident estimates are logged like a typed meal; unsure ones only ask.
 */
export const mealFromPhoto = onCall({ secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120, memory: '512MiB' }, async req => {
  if (!req.auth || req.auth.token.tester !== true) throw new HttpsError('permission-denied', 'Not on the tester list.');
  const image = req.data?.image;
  const note = typeof req.data?.note === 'string' ? req.data.note.trim().slice(0, 200) : '';
  if (typeof image !== 'string' || image.length < 100 || image.length > MAX_BASE64) throw new HttpsError('invalid-argument', 'Send one JPEG under 1.5 MB.');
  const uid = req.auth.uid;
  const t0 = Date.now();
  const data = await loadUser(uid);
  const ctx = reiContext(data.input);

  let res: Anthropic.Beta.Messages.BetaMessage;
  try {
    res = await claude().beta.messages.create({
      model: MODELS.deep,
      max_tokens: 4000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: PHOTO_SCHEMA as unknown as Record<string, unknown> } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        { type: 'text', text: systemRules({ tough: ctx.tough, nudge: ctx.nudge, tools: false }), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `${systemContext(ctx)}\nThe user sent a photo of what they are eating. Estimate it like a nutrition coach: identify each item, judge portion sizes from plate and cutlery scale, and count oil and sauces.` },
      ],
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: note ? `What I'm eating: ${note}` : 'What I’m eating.' },
        ],
      }],
    });
  } catch (e) {
    logger.error('photo failed', { uid, status: e instanceof Anthropic.APIError ? e.status : undefined, error: e instanceof Error ? e.message : String(e) });
    throw new HttpsError('unavailable', 'REI could not read the photo. Try again.');
  }
  if (res.stop_reason === 'refusal') throw new HttpsError('failed-precondition', 'REI can only read food photos.');
  let out: unknown;
  try {
    out = JSON.parse(res.content.map(b => (b.type === 'text' ? b.text : '')).join(''));
  } catch {
    throw new HttpsError('internal', 'REI could not read the photo. Try again.');
  }
  const est = parseMeal(out);
  const confidence = Number((out as { confidence?: unknown }).confidence ?? 0);
  const verdict = est?.verdict || 'Couldn’t read that plate. Tell me what it is and roughly how much.';
  const logged = !!est && confidence >= 0.5;
  const meal: Meal | null = logged && est ? { time: hhmm(data.input.now), name: est.name.charAt(0).toUpperCase() + est.name.slice(1), kcal: est.kcal, p: est.p, c: est.c, f: est.f } : null;

  const replyId = `ph${Date.now().toString(36)}`;
  await db.doc(`users/${uid}/messages/${replyId}u`).set({ role: 'user', text: note ? `Photo: ${note}` : 'Photo of my meal', time: hhmm(data.input.now), createdAt: Date.now() - 1 });
  const notes = await save(uid, data, replyId, verdict, meal, null, null);
  logger.info('photo', { uid, ms: Date.now() - t0, confidence, logged, model: res.model, inTokens: res.usage.input_tokens });
  return { text: verdict, logged, notes };
});
