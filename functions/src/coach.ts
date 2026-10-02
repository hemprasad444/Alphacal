import { MODELS, nudgeDue, nutrition, parseReply, reiContext, systemContext, systemRules, todaysPlan, week, type Nudge } from '@rei/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './admin';
import { loadUser } from './chat/load';
import { ANTHROPIC_API_KEY, claude } from './claude';

/** REI's proactive message for one nudge, in its own voice; the canned line if the model fails. */
async function write(data: Awaited<ReturnType<typeof loadUser>>, nudge: Nudge): Promise<string> {
  const ctx = reiContext(data.input);
  try {
    const res = await claude().messages.create({
      model: MODELS.fast,
      max_tokens: 300,
      system: [
        { type: 'text', text: systemRules({ tough: ctx.tough, nudge: ctx.nudge, tools: false }), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: systemContext(ctx) },
      ],
      messages: [{ role: 'user', content: `(You are messaging first; they have not said anything.) ${nudge.fact} Write one check-in message, under 30 words, that names the number and the next action.` }],
    });
    const text = parseReply(res.content.map(b => (b.type === 'text' ? b.text : '')).join('')).text;
    return text || nudge.fallback;
  } catch (e) {
    logger.warn('nudge text failed; using fallback', { error: e instanceof Error ? e.message : String(e) });
    return nudge.fallback;
  }
}

/** Check one user and send at most one nudge. Returns the nudge id sent, if any. */
export async function coachUser(uid: string, at?: Date): Promise<string | null> {
  const data = await loadUser(uid);
  const now = at ?? data.input.now;
  const { input } = data;
  const nudge = nudgeDue(
    {
      plan: todaysPlan(now, input.program),
      sessionDone: input.sessionDone,
      nutrition: nutrition(input.meals, input.activity),
      profile: input.profile,
      week: week(input.history, input.sessionDone, now, input.program),
      sent: data.nudgesSent,
    },
    now,
  );
  if (!nudge) return null;
  const text = await write(data, nudge);
  const user = db.doc(`users/${uid}`);
  const batch = db.batch();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  batch.set(user.collection('messages').doc(), { role: 'rei', text, time, createdAt: Date.now(), alert: true, nudge: nudge.id });
  batch.set(user.collection('days').doc(data.today), { nudges: FieldValue.arrayUnion(nudge.id) }, { merge: true });
  await batch.commit();
  // Phase 6: also send a push notification to the user's device here.
  logger.info('nudge', { uid, id: nudge.id });
  return nudge.id;
}

/** Every 15 minutes: REI checks in with anyone who has proactive check-ins on. */
export const coach = onSchedule(
  { schedule: 'every 15 minutes', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' },
  async () => {
    const users = await db.collection('users').where('settings.nudge', '==', true).select().get();
    const results = await Promise.allSettled(users.docs.map(u => coachUser(u.id)));
    results.forEach((r, i) => r.status === 'rejected' && logger.error('coach failed', { uid: users.docs[i].id, error: String(r.reason) }));
  },
);
