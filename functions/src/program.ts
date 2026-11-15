import {
  DEFAULT_DISCIPLINES, DEFAULT_PROFILE, isoDate, memorySummary, readMemory, isoWeek, normalizeProgram, parseIsoDate, PROGRAM_SCHEMA, programMonday, programPrompt, type Profile, type SessionLog,
  type WeeklyReport, type WeekProgram, zonedNow, bestsOf, type Intake,
  weekdayIndex,
} from '@rei/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './admin';
import { usageToday } from './chat/load';
import { complete, jsonText, LlmError, OPENROUTER_API_KEY } from './llm';
import { pool } from './pool';

/** Program rewrites a user may ask for per day (the Rebuild button, and REI's rebuild_program in chat): each is a long call to the strongest model. */
export const REBUILDS_PER_DAY = 8;

/** Counts one rebuild against today's allowance. False when it is used up. */
async function allowRebuild(uid: string): Promise<boolean> {
  const { ref, data } = await usageToday(uid);
  if (Number(data.rebuilds ?? 0) >= REBUILDS_PER_DAY) return false;
  await ref.set({ rebuilds: FieldValue.increment(1) }, { merge: true });
  return true;
}

/**
 * Ask the model for a week of training built from the user's goal, disciplines and the
 * last four weeks of logged sessions, and store it at users/{uid}/programs/{week}.
 */
export async function generateProgram(uid: string, opts: { next?: boolean; focus?: string } = {}): Promise<{ program: WeekProgram; timeZone: string }> {
  const made = await writeProgram(uid, opts);
  if (!made) throw new Error('No program was written.');
  return made;
}

/**
 * `onlyIfMissing`: the scheduled run. Returns null, without calling the model, for someone who hasn't
 * finished onboarding (there is nothing to plan from) or who already has that week's program.
 */
export async function writeProgram(uid: string, opts: { next?: boolean; focus?: string; onlyIfMissing?: boolean } = {}): Promise<{ program: WeekProgram; timeZone: string } | null> {
  const user = db.doc(`users/${uid}`);
  const userSnap = await user.get();
  const u = userSnap.data() ?? {};
  if (opts.onlyIfMissing && (!userSnap.exists || u.onboarded === false)) return null;
  const timeZone = typeof u.timezone === 'string' ? u.timezone : 'Asia/Kolkata';
  const now = zonedNow(timeZone);
  const start = programMonday(now, opts.next);
  const week = isoWeek(start);
  if (opts.onlyIfMissing && (await user.collection('programs').doc(week).get()).exists) return null;
  const since = new Date(now);
  since.setDate(now.getDate() - 28);
  const prevWeek = new Date(start);
  prevWeek.setDate(start.getDate() - 7);
  // The report for the week before this program, when there is one (Sunday's comes first).
  const [logsSnap, reportSnap] = await Promise.all([
    user.collection('sessions').where('date', '>=', isoDate(since)).get(),
    user.collection('reports').doc(isoWeek(prevWeek)).get(),
  ]);
  const logs = logsSnap.docs.map(d => d.data() as SessionLog);
  const report = reportSnap.data() as WeeklyReport | undefined;

  const profile: Profile = { ...DEFAULT_PROFILE, ...(u.profile as Partial<Profile> | undefined) };
  const disc = (u.disc as Record<string, boolean> | undefined) ?? DEFAULT_DISCIPLINES;
  const startedOn = typeof u.startedOn === 'string' ? u.startedOn : isoDate(now);
  // Both on the user's own calendar: `now` is their wall clock, so their start date is read the same way (not as UTC).
  const sinceStart = now.getTime() - (parseIsoDate(startedOn) ?? now).getTime();
  const weeksActive = Math.min(4, Math.max(1, Math.ceil(sinceStart / (7 * 86400000))));
  const { system, user: prompt } = programPrompt({
    profile,
    disciplines: Object.keys(disc).filter(k => disc[k]),
    logs,
    // Under a week in, nothing was planned before them: no adherence to judge yet.
    adherence: { kept: new Set(logs.map(l => l.date)).size, planned: sinceStart < 7 * 86400000 ? 0 : weeksActive * (parseInt(profile.sessions, 10) || 4) },
    week,
    focus: opts.focus,
    memory: memorySummary(readMemory(u.memory)) || undefined,
    // Their own starting point (never the demo numbers): who they are and the bests they gave.
    athlete: { sex: (u.intake as Intake | undefined)?.sex, age: profile.age, height: profile.height, exp: (u.intake as Intake | undefined)?.exp },
    bests: u.intake ? bestsOf(u.intake as Intake) : undefined,
    report: report ? `${report.headline}. Held back by: ${report.fix} Focus: ${report.focus}` : undefined,
  });

  const t0 = Date.now();
  const res = await complete({ task: 'program', system, messages: [{ role: 'user', content: prompt }], maxTokens: 16000, json: PROGRAM_SCHEMA });
  if (res.stop_reason === 'refusal') throw new Error('Program request was declined.');
  if (res.stop_reason === 'max_tokens') throw new Error('Program output was cut off.');
  const text = jsonText(res);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Program output was not valid JSON.');
  }
  const program = normalizeProgram(parsed, week, logs);
  if (!program) throw new Error('Program output did not have seven usable days.');
  await user.collection('programs').doc(week).set(program);
  logger.info('program', { uid, week, ms: Date.now() - t0, model: res.model, inTokens: res.usage.input_tokens, outTokens: res.usage.output_tokens });
  return { program, timeZone };
}

async function announce(uid: string, { program, timeZone }: { program: WeekProgram; timeZone: string }, prefix: string) {
  const now = Date.now();
  const kept = program.days.filter(Boolean).length;
  await db.collection(`users/${uid}/messages`).add({
    role: 'rei',
    text: `${prefix} ${kept} sessions. ${program.note}`.trim(),
    time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(now),
    createdAt: now,
  });
}

/** Sunday evening: next week's program for every user who doesn't have one yet. */
export const weeklyPrograms = onSchedule(
  { schedule: 'every sunday 21:00', timeZone: 'Asia/Kolkata', secrets: [OPENROUTER_API_KEY], timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const users = await db.collection('users').select().get();
    // Four at a time, and no new one after 8 minutes: the function is cut off at 9.
    const r = await pool(users.docs, 4, async u => {
      const made = await writeProgram(u.id, { next: true, onlyIfMissing: true });
      if (made) await announce(u.id, made, 'Next week is written.');
    }, { budgetMs: 480_000, onError: (u, e) => logger.error('weekly program failed', { uid: u.id, error: e instanceof Error ? e.message : String(e) }) });
    logger[r.skipped || r.failed ? 'error' : 'info']('weekly programs', { users: users.size, ...r });
  },
);

/** "Rebuild my week": rewrites the current week now. Takes 10–40 s. */
export const rebuildProgram = onCall({ secrets: [OPENROUTER_API_KEY], timeoutSeconds: 300, memory: '512MiB' }, async req => {
  if (!req.auth || req.auth.token.tester !== true) throw new HttpsError('permission-denied', 'Not on the tester list.');
  const focus = typeof req.data?.focus === 'string' ? req.data.focus.trim().slice(0, 200) || undefined : undefined;
  if (!(await allowRebuild(req.auth.uid))) throw new HttpsError('resource-exhausted', 'That’s enough rebuilds for today. This week’s plan stands.');
  try {
    const first = req.data?.first === true;
    const result = await generateProgram(req.auth.uid, { focus });
    await announce(req.auth.uid, result, first ? 'Your first week is ready:' : 'Week rebuilt.');
    // Joined on a Sunday: this week is over by tomorrow, and Sunday night's job may already have run.
    if (first && weekdayIndex(zonedNow(result.timeZone)) === 6) {
      await generateProgram(req.auth.uid, { next: true }).catch(e => logger.warn('first next week failed', { uid: req.auth?.uid, error: e instanceof Error ? e.message : String(e) }));
    }
    return { week: result.program.week, note: result.program.note };
  } catch (e) {
    logger.error('rebuild failed', { uid: req.auth.uid, error: e instanceof Error ? e.message : String(e), status: e instanceof LlmError ? e.status : undefined });
    throw new HttpsError('unavailable', 'REI could not rebuild the week. Try again.');
  }
});

/** Jobs queued by other functions (the chat's rebuild_program tool) run here, off the request path. */
export const runJob = onDocumentCreated({ document: 'users/{uid}/jobs/{jobId}', secrets: [OPENROUTER_API_KEY], timeoutSeconds: 300, memory: '512MiB' }, async event => {
  const job = event.data?.data();
  if (!job || job.type !== 'program') return;
  const uid = event.params.uid;
  try {
    // The same daily allowance as the Rebuild button: chat can queue one of these per message.
    if (!(await allowRebuild(uid))) {
      logger.warn('program job over the daily limit', { uid });
      await event.data?.ref.set({ status: 'limit' }, { merge: true });
      return;
    }
    const result = await generateProgram(uid, { focus: typeof job.focus === 'string' ? job.focus.trim().slice(0, 200) || undefined : undefined });
    await announce(uid, result, 'Week rebuilt.');
    await event.data?.ref.set({ status: 'done', week: result.program.week }, { merge: true });
  } catch (e) {
    logger.error('program job failed', { uid, error: e instanceof Error ? e.message : String(e) });
    await event.data?.ref.set({ status: 'failed' }, { merge: true });
  }
});
