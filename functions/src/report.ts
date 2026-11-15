// REI's weekly report: the week's numbers, written up by Opus, stored at
// users/{uid}/reports/{week} and posted in the chat. Sunday 20:30, before next week's
// program is written, or on demand from the Progress screen.
import {
  addDays, DEFAULT_PROFILE, memorySummary, readMemory, DEFAULT_SETTINGS, fallbackReport, isoDate, isoWeek, MODELS, mondayOf, normalizeReport, type Profile, REPORT_SCHEMA, reportMoment, reportPrompt,
  type SessionLog, type Settings, type WeeklyReport, weekStats, type WeekProgram, type WeighIn, zonedNow,
} from '@rei/shared';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './admin';
import { complete, jsonText, OPENROUTER_API_KEY } from './llm';
import { usageToday } from './chat/load';
import { pool } from './pool';

/** On-demand reports per user per day. */
const REPORTS_PER_DAY = 5;

export async function buildReport(uid: string, opts: { at?: Date; scheduled?: boolean } = {}): Promise<WeeklyReport> {
  const user = db.doc(`users/${uid}`);
  const u = (await user.get()).data() ?? {};
  const timeZone = typeof u.timezone === 'string' ? u.timezone : 'Asia/Kolkata';
  // The Sunday-evening run is about the week ending, even where it is already Monday (see reportMoment).
  const now = opts.at ?? (opts.scheduled ? reportMoment(zonedNow(timeZone)) : zonedNow(timeZone));
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
    const memory = memorySummary(readMemory(u.memory));
    const { system, user: prompt } = reportPrompt(stats, profile, settings.tone !== 'Coach', memory);
    const res = await complete({ task: 'report', system, messages: [{ role: 'user', content: prompt }], maxTokens: 4000, json: REPORT_SCHEMA });
    const out = res.stop_reason === 'end_turn' ? normalizeReport(JSON.parse(jsonText(res))) : null;
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
  { schedule: 'every sunday 20:30', timeZone: 'Asia/Kolkata', secrets: [OPENROUTER_API_KEY], timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    // Not for someone who never finished onboarding: there is no week to report on.
    const users = (await db.collection('users').select('onboarded').get()).docs.filter(u => u.get('onboarded') !== false);
    // Four at a time, and no new one after 8 minutes: the function is cut off at 9.
    const r = await pool(users, 4, u => buildReport(u.id, { scheduled: true }), { budgetMs: 480_000, onError: (u, e) => logger.error('weekly report failed', { uid: u.id, error: e instanceof Error ? e.message : String(e) }) });
    logger[r.skipped || r.failed ? 'error' : 'info']('weekly reports', { users: users.length, ...r });
  },
);

/** "Write this week's report" on the Progress screen: the week so far. */
export const weeklyReport = onCall({ secrets: [OPENROUTER_API_KEY], timeoutSeconds: 120, memory: '512MiB' }, async req => {
  if (!req.auth || req.auth.token.tester !== true) throw new HttpsError('permission-denied', 'Not on the tester list.');
  const { ref: usage, data: counts } = await usageToday(req.auth.uid);
  const used = Number(counts.reports ?? 0);
  if (used >= REPORTS_PER_DAY) throw new HttpsError('resource-exhausted', 'That’s enough reports for today.');
  await usage.set({ reports: FieldValue.increment(1) }, { merge: true });
  try {
    return await buildReport(req.auth.uid);
  } catch (e) {
    logger.error('report failed', { uid: req.auth.uid, error: e instanceof Error ? e.message : String(e) });
    throw new HttpsError('unavailable', 'REI could not write the report. Try again.');
  }
});
