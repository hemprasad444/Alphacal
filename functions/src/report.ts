// REI's weekly report: the week's numbers, written up by Opus, stored at
// users/{uid}/reports/{week} and posted in the chat. Sunday 20:30, before next week's
// program is written, or on demand from the Progress screen.
import {
  addDays, DEFAULT_PROFILE, DEFAULT_SETTINGS, fallbackReport, isoDate, isoWeek, MODELS, mondayOf, normalizeReport, type Profile, REPORT_SCHEMA, reportPrompt,
  type SessionLog, type Settings, type WeeklyReport, weekStats, type WeekProgram, type WeighIn, zonedNow,
} from '@rei/shared';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './admin';
import { ANTHROPIC_API_KEY, claude } from './claude';
import { usageDay } from './chat/load';

/** On-demand reports per user per day. */
const REPORTS_PER_DAY = 5;

export async function buildReport(uid: string, opts: { at?: Date } = {}): Promise<WeeklyReport> {
  const user = db.doc(`users/${uid}`);
  const u = (await user.get()).data() ?? {};
  const timeZone = typeof u.timezone === 'string' ? u.timezone : 'Asia/Kolkata';
  const now = opts.at ?? zonedNow(timeZone);
  const today = isoDate(now), monday = mondayOf(today), week = isoWeek(now);
  const profile: Profile = { ...DEFAULT_PROFILE, ...(u.profile as Partial<Profile> | undefined) };
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(u.settings as Partial<Settings> | undefined) };

  const [daySnaps, sessionSnaps, weighSnaps, programSnap] = await Promise.all([
    user.collection('days').where(FieldPath.documentId(), '>=', monday).where(FieldPath.documentId(), '<=', addDays(monday, 6)).get(),
    user.collection('sessions').where('date', '>=', addDays(monday, -183)).get(),
    user.collection('weighIns').where(FieldPath.documentId(), '>=', addDays(monday, -60)).get(),
    user.collection('programs').doc(week).get(),
  ]);
  const stats = weekStats({
    week, monday, upTo: today,
    days: Object.fromEntries(daySnaps.docs.map(d => [d.id, d.data()])),
    sessions: sessionSnaps.docs.map(d => d.data() as SessionLog),
    weighIns: weighSnaps.docs.map(d => ({ date: d.id, kg: Number(d.data().kg) }) as WeighIn).filter(w => w.kg > 0),
    profile,
    program: programSnap.exists ? (programSnap.data() as WeekProgram) : null,
  });

  let text = fallbackReport(stats), ai = false, model = '';
  const t0 = Date.now();
  try {
    const memory = Array.isArray(u.memory) ? (u.memory as { text?: string }[]).map(m => m.text).filter(Boolean).join('; ') : '';
    const { system, user: prompt } = reportPrompt(stats, profile, settings.tone === 'Tough love', memory);
    const res = await claude().beta.messages.create({
      model: MODELS.deep,
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: REPORT_SCHEMA as unknown as Record<string, unknown> } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    const out = res.stop_reason === 'end_turn' ? normalizeReport(JSON.parse(res.content.map(b => (b.type === 'text' ? b.text : '')).join(''))) : null;
    if (out) (text = out), (ai = true), (model = res.model);
  } catch (e) {
    logger.warn('report text failed; using the plain report', { uid, error: e instanceof Error ? e.message : String(e) });
  }

  const report: WeeklyReport = { ...text, week, stats, generatedAt: Date.now(), ai };
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(Date.now());
  const at = Date.now();
  const batch = db.batch();
  batch.set(user.collection('reports').doc(week), report);
  batch.set(user.collection('messages').doc(), { role: 'rei', text: `${report.headline}. ${report.summary} Next week: ${report.focus}`, time, createdAt: at });
  batch.set(user.collection('messages').doc(), { role: 'sys', text: 'WEEKLY REPORT READY · PROGRESS', time, createdAt: at + 1 });
  await batch.commit();
  logger.info('report', { uid, week, ai, model, ms: Date.now() - t0 });
  return report;
}

/** Sunday evening, before next week's program: every user's report. */
export const weeklyReports = onSchedule(
  { schedule: 'every sunday 20:30', timeZone: 'Asia/Kolkata', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const users = await db.collection('users').select().get();
    for (const u of users.docs) {
      try {
        await buildReport(u.id);
      } catch (e) {
        logger.error('weekly report failed', { uid: u.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
  },
);

/** "Write this week's report" on the Progress screen: the week so far. */
export const weeklyReport = onCall({ secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120, memory: '512MiB' }, async req => {
  if (!req.auth || req.auth.token.tester !== true) throw new HttpsError('permission-denied', 'Not on the tester list.');
  const usage = db.doc(`users/${req.auth.uid}/usage/${usageDay()}`);
  const used = Number((await usage.get()).data()?.reports ?? 0);
  if (used >= REPORTS_PER_DAY) throw new HttpsError('resource-exhausted', 'That’s enough reports for today.');
  await usage.set({ reports: FieldValue.increment(1) }, { merge: true });
  try {
    return await buildReport(req.auth.uid);
  } catch (e) {
    logger.error('report failed', { uid: req.auth.uid, error: e instanceof Error ? e.message : String(e) });
    throw new HttpsError('unavailable', 'REI could not write the report. Try again.');
  }
});
