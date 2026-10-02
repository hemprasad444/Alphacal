import Anthropic from '@anthropic-ai/sdk';
import {
  DEFAULT_DISCIPLINES, DEFAULT_PROFILE, isoDate, isoWeek, MODELS, normalizeProgram, PROGRAM_SCHEMA, programPrompt, type Profile, type SessionLog,
  type WeeklyReport, type WeekProgram, zonedNow,
} from '@rei/shared';
import { logger } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './admin';
import { ANTHROPIC_API_KEY, claude } from './claude';

type Effort = 'medium' | 'high';

function monday(d: Date): Date {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return m;
}

/**
 * Ask Opus for a week of training built from the user's goal, disciplines and the
 * last four weeks of logged sessions, and store it at users/{uid}/programs/{week}.
 */
export async function generateProgram(uid: string, opts: { next?: boolean; focus?: string; effort?: Effort } = {}): Promise<{ program: WeekProgram; timeZone: string }> {
  const user = db.doc(`users/${uid}`);
  const userSnap = await user.get();
  const u = userSnap.data() ?? {};
  const timeZone = typeof u.timezone === 'string' ? u.timezone : 'Asia/Kolkata';
  const now = zonedNow(timeZone);
  const start = monday(now);
  if (opts.next) start.setDate(start.getDate() + 7);
  const week = isoWeek(start);
  const since = new Date(now);
  since.setDate(now.getDate() - 28);
  const prevWeek = new Date(start);
  prevWeek.setDate(start.getDate() - 7);
  // The report for the week before this program, when there is one (Sunday's comes first).
  const [logsSnap, reportSnap] = await Promise.all([
    user.collection('sessions').where('date', '>=', isoDate(since)).get(),
    user.collection('reports').doc(isoWeek(opts.next ? now : prevWeek)).get(),
  ]);
  const logs = logsSnap.docs.map(d => d.data() as SessionLog);
  const report = reportSnap.data() as WeeklyReport | undefined;

  const profile: Profile = { ...DEFAULT_PROFILE, ...(u.profile as Partial<Profile> | undefined) };
  const disc = (u.disc as Record<string, boolean> | undefined) ?? DEFAULT_DISCIPLINES;
  const startedOn = typeof u.startedOn === 'string' ? u.startedOn : isoDate(now);
  const weeksActive = Math.min(4, Math.max(1, Math.ceil((now.getTime() - new Date(startedOn).getTime()) / (7 * 86400000))));
  const { system, user: prompt } = programPrompt({
    profile,
    disciplines: Object.keys(disc).filter(k => disc[k]),
    logs,
    adherence: { kept: new Set(logs.map(l => l.date)).size, planned: weeksActive * (parseInt(profile.sessions, 10) || 4) },
    week,
    focus: opts.focus,
    report: report ? `${report.headline}. Held back by: ${report.fix} Focus: ${report.focus}` : undefined,
  });

  const t0 = Date.now();
  const res = await claude().beta.messages.create({
    model: MODELS.deep,
    max_tokens: 16000,
    output_config: { effort: opts.effort ?? 'high', format: { type: 'json_schema', schema: PROGRAM_SCHEMA as unknown as Record<string, unknown> } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  if (res.stop_reason === 'refusal') throw new Error('Program request was declined.');
  if (res.stop_reason === 'max_tokens') throw new Error('Program output was cut off.');
  const text = res.content.map(b => (b.type === 'text' ? b.text : '')).join('');
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
  { schedule: 'every sunday 21:00', timeZone: 'Asia/Kolkata', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const users = await db.collection('users').select().get();
    for (const u of users.docs) {
      try {
        await announce(u.id, await generateProgram(u.id, { next: true }), 'Next week is written.');
      } catch (e) {
        logger.error('weekly program failed', { uid: u.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
  },
);

/** "Rebuild my week": rewrites the current week now. Takes 10–40 s. */
export const rebuildProgram = onCall({ secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' }, async req => {
  if (!req.auth || req.auth.token.tester !== true) throw new HttpsError('permission-denied', 'Not on the tester list.');
  const focus = typeof req.data?.focus === 'string' ? req.data.focus.slice(0, 200) : undefined;
  try {
    const result = await generateProgram(req.auth.uid, { focus, effort: 'medium' });
    await announce(req.auth.uid, result, 'Week rebuilt.');
    return { week: result.program.week, note: result.program.note };
  } catch (e) {
    logger.error('rebuild failed', { uid: req.auth.uid, error: e instanceof Error ? e.message : String(e), status: e instanceof Anthropic.APIError ? e.status : undefined });
    throw new HttpsError('unavailable', 'REI could not rebuild the week. Try again.');
  }
});

/** Jobs queued by other functions (the chat's rebuild_program tool) run here, off the request path. */
export const runJob = onDocumentCreated({ document: 'users/{uid}/jobs/{jobId}', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' }, async event => {
  const job = event.data?.data();
  if (!job || job.type !== 'program') return;
  const uid = event.params.uid;
  try {
    const result = await generateProgram(uid, { focus: typeof job.focus === 'string' ? job.focus : undefined, effort: 'medium' });
    await announce(uid, result, 'Week rebuilt.');
    await event.data?.ref.set({ status: 'done', week: result.program.week }, { merge: true });
  } catch (e) {
    logger.error('program job failed', { uid, error: e instanceof Error ? e.message : String(e) });
    await event.data?.ref.set({ status: 'failed' }, { merge: true });
  }
});
