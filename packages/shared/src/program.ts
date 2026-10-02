// REI writing the week: the output schema, the prompt, and validation of what comes back.
import { BENCHMARKS, type SessionKey, type SessionPlan, type WeekProgram } from './data';
import type { Profile, SessionLog } from './types';

const TRAINING: Exclude<SessionKey, 'REST'>[] = ['PUSH', 'PULL', 'LEGS', 'RUN', 'CALI'];
const JP: Record<Exclude<SessionKey, 'REST'>, string> = { PUSH: '押', PULL: '引', LEGS: '脚', RUN: '走', CALI: '体' };

/** Structured-output schema: seven days, Monday first. */
export const PROGRAM_SCHEMA = {
  type: 'object',
  properties: {
    note: { type: 'string', description: 'One sentence in REI’s voice on what this week is for.' },
    days: {
      type: 'array',
      description: 'Exactly 7 entries, Monday first.',
      items: {
        type: 'object',
        properties: {
          rest: { type: 'boolean' },
          key: { type: 'string', enum: TRAINING },
          title: { type: 'string', description: 'Short session name, e.g. "Push" or "Tempo run"' },
          sub: { type: 'string', description: 'Focus and length, e.g. "Chest · Shoulders · Triceps · 52 min, 6 lifts"' },
          minutes: { type: 'integer' },
          why: { type: 'string', description: 'One sentence: why this session matters this week, using their numbers.' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                sets: { type: 'integer' },
                reps: { type: 'integer', description: 'Reps per set; kilometres for intervals; seconds for holds.' },
                load: { type: 'string', description: 'Working load, e.g. "82.5 kg", "+15 kg", "bodyweight", "4:45 / km"' },
              },
              required: ['name', 'sets', 'reps', 'load'],
              additionalProperties: false,
            },
          },
        },
        required: ['rest', 'key', 'title', 'sub', 'minutes', 'why', 'exercises'],
        additionalProperties: false,
      },
    },
  },
  required: ['note', 'days'],
  additionalProperties: false,
} as const;

const clampInt = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Last logged performance per exercise name, for the "LAST ·" line. */
export function lastLifts(logs: SessionLog[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of [...logs].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const x of s.sets ?? []) {
      const reps = x.reps.filter((_, i) => x.done[i]);
      if (!reps.length) continue;
      const kg = x.kg.find(k => k != null);
      out[x.exercise.toLowerCase()] = `LAST · ${kg != null ? `${kg} × ` : ''}${reps.join(' ')}`;
    }
  }
  return out;
}

/**
 * Turn the model's output into a WeekProgram, or null if it isn't usable.
 * Bad exercises are dropped; a training day left with none becomes a rest day.
 */
export function normalizeProgram(raw: unknown, week: string, logs: SessionLog[] = [], now = Date.now()): WeekProgram | null {
  const o = raw as { note?: unknown; days?: unknown } | null;
  if (!o || !Array.isArray(o.days) || o.days.length !== 7) return null;
  const last = lastLifts(logs);
  const days = o.days.map((d): SessionPlan | null => {
    const x = d as Record<string, unknown>;
    if (!x || x.rest === true || !TRAINING.includes(x.key as never)) return null;
    const key = x.key as Exclude<SessionKey, 'REST'>;
    const exercises = (Array.isArray(x.exercises) ? x.exercises : [])
      .slice(0, 10)
      .map(e => {
        const ex = e as Record<string, unknown>;
        const name = str(ex.name, 40), sets = clampInt(ex.sets, 1, 10), reps = clampInt(ex.reps, 1, 100), load = str(ex.load, 24);
        if (!name || !sets || !reps) return null;
        return { name, target: `${sets} × ${reps}${load ? ` · ${load}` : ''}`, last: last[name.toLowerCase()] ?? '', reps: Array(sets).fill(reps) as number[] };
      })
      .filter((e): e is NonNullable<typeof e> => !!e);
    if (!exercises.length) return null;
    const why = str(x.why, 240) ?? '';
    return {
      key,
      title: str(x.title, 30) ?? key.charAt(0) + key.slice(1).toLowerCase(),
      jp: JP[key],
      sub: str(x.sub, 80) ?? '',
      minutes: clampInt(x.minutes, 10, 150) ?? 45,
      why: { strong: why, slipping: why },
      exercises,
    };
  });
  if (!days.some(Boolean)) return null;
  return { week, note: str(o.note, 240) ?? '', days, generatedAt: now };
}

function summarize(logs: SessionLog[]): string {
  if (!logs.length) return 'No sessions logged yet.';
  return logs
    .map(s => {
      const lifts = (s.sets ?? [])
        .map(x => {
          const reps = x.reps.filter((_, i) => x.done[i]);
          const kg = x.kg.find(k => k != null);
          return reps.length ? `${x.exercise} ${reps.join(',')}${kg != null ? ` @ ${kg} kg` : ''}` : '';
        })
        .filter(Boolean)
        .join('; ');
      return `${s.date} ${s.plan}: ${s.done}/${s.total} sets${lifts ? ` (${lifts})` : ''}`;
    })
    .join('\n');
}

export interface ProgramInput {
  profile: Profile;
  disciplines: string[];
  logs: SessionLog[];
  /** Training days kept out of the last four weeks' plans. */
  adherence: { kept: number; planned: number };
  week: string;
  focus?: string;
}

export function programPrompt(i: ProgramInput): { system: string; user: string } {
  const p = i.profile;
  return {
    system: `You are REI, an elite strength and conditioning coach writing one person's training week. Program like a coach who knows them: progressive overload from what they actually lifted, realistic volume, recovery placed sensibly, and one hard goal per session. Use metric units. Keep titles short and the "why" to one blunt sentence that uses their numbers. No em dashes, no emojis.`,
    user: `Write the plan for ${i.week} (Monday first, exactly 7 days).
Goal (their words): "${p.goal}". Deadline ${p.deadline}. Weight ${p.weight} kg → ${p.targetWeight} kg, body fat ${p.bf}% → ${p.targetBf}%.
Train ${p.sessions} days; the rest are rest days. Disciplines: ${i.disciplines.join(', ') || 'general fitness'}.
Benchmarks now → goal: ${BENCHMARKS.map(([n, now, goal]) => `${n} ${now} → ${goal}`).join('; ')}.
Last four weeks: kept ${i.adherence.kept} of ${i.adherence.planned} planned sessions.${i.adherence.planned && i.adherence.kept / i.adherence.planned < 0.7 ? ' Adherence is low: make sessions shorter and harder to skip, not easier.' : ''}
Logged sessions:
${summarize(i.logs)}
${i.focus ? `They asked for: "${i.focus}".\n` : ''}Progress loads by about 2.5 kg on lifts where every set was completed last time; hold or drop where reps were missed.`,
  };
}
