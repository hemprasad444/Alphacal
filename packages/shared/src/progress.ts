// Progress over weeks: streaks, badges, body measurements, and the numbers behind REI's
// weekly report. Pure functions, shared by the app and the report function.
import { WEEK_PLAN, type WeekProgram } from './data';
import { newPrs, pace } from './strength';
import { isoDate, parseIsoDate, weekdayIndex } from './time';
import type { DayDoc, Profile, SessionLog, WeighIn } from './types';

export const MEASURES = ['waist', 'chest', 'hips', 'arms', 'thighs', 'neck'] as const;
export type Measure = (typeof MEASURES)[number];

/** Body measurements in cm, stored at users/{uid}/measurements/{date}. */
export type Measurement = { date: string } & Partial<Record<Measure, number>>;

/** A private progress photo, stored at users/{uid}/photos/{id}; the image is in Storage. */
export interface ProgressPhoto {
  id: string;
  date: string;
  pose: 'front' | 'side' | 'back';
  /** Storage path when synced; a local file URI in demo mode. */
  path: string;
  kg?: number;
  createdAt: number;
}

/** What streaks and badges need from one day. */
export interface DaySummary {
  date: string;
  meals: number;
  kcal: number;
  protein: number;
  session: boolean;
}

const num = (s: string) => parseFloat(s) || 0;

export function daySummary(date: string, d: Partial<DayDoc> | undefined): DaySummary {
  const meals = d?.meals ?? [];
  return { date, meals: meals.length, kcal: Math.round(meals.reduce((a, m) => a + m.kcal, 0)), protein: Math.round(meals.reduce((a, m) => a + m.p, 0)), session: !!d?.sessionDone };
}

export function addDays(iso: string, n: number): string {
  const d = parseIsoDate(iso) ?? new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function mondayOf(iso: string): string {
  const d = parseIsoDate(iso) ?? new Date();
  return addDays(iso, -weekdayIndex(d));
}

export interface Streak {
  current: number;
  best: number;
}

export interface Streaks {
  /** Days in a row with food logged. */
  logging: Streak;
  /** Days in a row hitting at least 90% of the protein target. */
  protein: Streak;
  /** Weeks in a row hitting the weekly session target. */
  weeks: Streak;
}

/** A run of days meeting `ok`; today only counts once it's met, and doesn't break the run before then. */
function dayStreak(byDate: Map<string, DaySummary>, today: string, ok: (d: DaySummary) => boolean, first: string): Streak {
  let best = 0, run = 0;
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const x = byDate.get(d);
    if (x && ok(x)) best = Math.max(best, ++run);
    else if (d !== today) run = 0;
  }
  let current = 0;
  let d = byDate.get(today) && ok(byDate.get(today)!) ? today : addDays(today, -1);
  while (d >= first && byDate.get(d) && ok(byDate.get(d)!)) {
    current++;
    d = addDays(d, -1);
  }
  return { current, best };
}

export function streaks(days: DaySummary[], profile: Profile, today: string): Streaks {
  const byDate = new Map(days.map(d => [d.date, d]));
  const first = days.reduce((a, d) => (d.date < a ? d.date : a), today);
  const proteinT = num(profile.protein), target = Math.max(1, parseInt(profile.sessions, 10) || 4);
  const logging = dayStreak(byDate, today, d => d.meals > 0, first);
  const protein = dayStreak(byDate, today, d => proteinT > 0 && d.protein >= proteinT * 0.9, first);
  // Weeks: count sessions per ISO week; this week counts once it's met.
  const thisMonday = mondayOf(today);
  const met = (monday: string) => {
    let n = 0;
    for (let i = 0; i < 7; i++) if (byDate.get(addDays(monday, i))?.session) n++;
    return n >= target;
  };
  let best = 0, run = 0;
  for (let m = mondayOf(first); m <= thisMonday; m = addDays(m, 7)) {
    if (met(m)) best = Math.max(best, ++run);
    else if (m !== thisMonday) run = 0;
  }
  let current = 0;
  for (let m = met(thisMonday) ? thisMonday : addDays(thisMonday, -7); m >= mondayOf(first) && met(m); m = addDays(m, -7)) current++;
  return { logging, protein, weeks: { current, best } };
}

export interface Badge {
  id: string;
  title: string;
  desc: string;
  /** Date earned, or null. */
  earned: string | null;
  /** 0..1 toward earning it. */
  progress: number;
}

interface Goal {
  id: string;
  title: string;
  desc: string;
  need: number;
}

/** First date a running count reaches each goal. */
function reach(events: { date: string; n: number }[], goals: Goal[]): Badge[] {
  return goals.map(g => {
    const hit = events.find(e => e.n >= g.need);
    const top = events.reduce((a, e) => Math.max(a, e.n), 0);
    return { id: g.id, title: g.title, desc: g.desc, earned: hit?.date ?? null, progress: Math.min(1, top / g.need) };
  });
}

/** Running streak lengths per date, for "first reached N in a row". */
function streakEvents(days: DaySummary[], ok: (d: DaySummary) => boolean): { date: string; n: number }[] {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const out: { date: string; n: number }[] = [];
  let run = 0, prev = '';
  for (const d of sorted) {
    run = ok(d) ? (prev && addDays(prev, 1) === d.date ? run + 1 : 1) : 0;
    if (ok(d)) prev = d.date;
    out.push({ date: d.date, n: run });
  }
  return out;
}

export function badges(i: { days: DaySummary[]; sessions: SessionLog[]; weighIns: WeighIn[]; profile: Profile }): Badge[] {
  const sessions = [...i.sessions].sort((a, b) => (a.date === b.date ? (a.createdAt ?? 0) - (b.createdAt ?? 0) : a.date < b.date ? -1 : 1));
  const count = sessions.map((s, k) => ({ date: s.date, n: k + 1 }));
  let prs = 0;
  const prEvents = sessions.map((s, k) => ({ date: s.date, n: (prs += newPrs(s, sessions.slice(0, k)).length) }));
  const runs = sessions.filter(s => s.cardio && s.cardio.kind !== 'cycle' && s.cardio.kind !== 'walk').map(s => ({ date: s.date, n: s.cardio!.km }));
  const proteinT = num(i.profile.protein), target = Math.max(1, parseInt(i.profile.sessions, 10) || 4);
  const weighIns = [...i.weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const startKg = weighIns[0]?.kg;
  const lost = weighIns.map(w => ({ date: w.date, n: startKg ? +(startKg - w.kg).toFixed(1) : 0 }));
  // Perfect weeks: sessions on target within one ISO week.
  const perWeek = new Map<string, { n: number; last: string }>();
  for (const d of i.days) if (d.session) {
    const m = mondayOf(d.date), cur = perWeek.get(m) ?? { n: 0, last: d.date };
    perWeek.set(m, { n: cur.n + 1, last: d.date > cur.last ? d.date : cur.last });
  }
  const weeks = [...perWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, w]) => ({ date: w.last, n: w.n / target }));

  return [
    ...reach(count, [
      { id: 'sessions-1', title: 'Day one', desc: 'Log your first session', need: 1 },
      { id: 'sessions-10', title: 'Ten deep', desc: 'Log 10 sessions', need: 10 },
      { id: 'sessions-50', title: 'Fifty', desc: 'Log 50 sessions', need: 50 },
      { id: 'sessions-100', title: 'Century', desc: 'Log 100 sessions', need: 100 },
    ]),
    ...reach(prEvents, [
      { id: 'pr-1', title: 'First PR', desc: 'Beat a personal record', need: 1 },
      { id: 'pr-10', title: 'Record breaker', desc: 'Set 10 personal records', need: 10 },
    ]),
    ...reach(weeks, [{ id: 'perfect-week', title: 'Perfect week', desc: `Hit ${target} sessions in one week`, need: 1 }]),
    ...reach(streakEvents(i.days, d => d.meals > 0), [
      { id: 'log-7', title: 'Seven days logged', desc: 'Log food 7 days in a row', need: 7 },
      { id: 'log-30', title: 'Thirty days logged', desc: 'Log food 30 days in a row', need: 30 },
    ]),
    ...reach(streakEvents(i.days, d => proteinT > 0 && d.protein >= proteinT * 0.9), [{ id: 'protein-7', title: 'Protein week', desc: 'Hit protein 7 days in a row', need: 7 }]),
    ...reach(runs, [
      { id: 'run-5k', title: '5K', desc: 'Run 5 km in one go', need: 5 },
      { id: 'run-10k', title: '10K', desc: 'Run 10 km in one go', need: 10 },
    ]),
    ...reach(lost, [
      { id: 'down-1', title: 'First kilo', desc: 'Down 1 kg from your first weigh-in', need: 1 },
      { id: 'down-5', title: 'Five down', desc: 'Down 5 kg from your first weigh-in', need: 5 },
    ]),
  ];
}

/** First and latest value of each measure, for "waist 88 → 85 cm". */
export function measureChanges(ms: Measurement[]): { measure: Measure; first: number; latest: number; change: number; points: { date: string; v: number }[] }[] {
  const sorted = [...ms].sort((a, b) => (a.date < b.date ? -1 : 1));
  return MEASURES.flatMap(k => {
    const points = sorted.filter(m => typeof m[k] === 'number' && m[k]! > 0).map(m => ({ date: m.date, v: m[k]! }));
    if (!points.length) return [];
    const first = points[0].v, latest = points[points.length - 1].v;
    return [{ measure: k, first, latest, change: +(latest - first).toFixed(1), points }];
  });
}

// ---- Weekly report -------------------------------------------------------------

export interface WeekStats {
  week: string;
  from: string;
  to: string;
  sessions: { done: number; planned: number; target: number };
  prs: string[];
  food: { daysLogged: number; avgKcal: number | null; avgProtein: number | null; proteinDays: number; overDays: number; kcalTarget: number; proteinTarget: number };
  steps: number | null;
  sleepH: number | null;
  weight: { start: number | null; end: number | null; change: number | null };
  runs: { count: number; km: number; best: string | null };
}

export interface WeekStatsInput {
  week: string;
  /** Monday of the week. */
  monday: string;
  /** Count days up to here (today for a week in progress). */
  upTo: string;
  days: Record<string, Partial<DayDoc>>;
  /** All recent sessions; those before the week are the baseline for PRs. */
  sessions: SessionLog[];
  weighIns: WeighIn[];
  profile: Profile;
  program: WeekProgram | null;
}

export function weekStats(i: WeekStatsInput): WeekStats {
  const sunday = addDays(i.monday, 6), last = i.upTo < sunday ? i.upTo : sunday;
  const dates: string[] = [];
  for (let d = i.monday; d <= last; d = addDays(d, 1)) dates.push(d);
  const kcalT = num(i.profile.kcal), proteinT = num(i.profile.protein);
  const logged = dates.map(d => daySummary(d, i.days[d])).filter(d => d.meals > 0);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const planned = dates.filter((_, k) => (i.program ? !!i.program.days[k] : WEEK_PLAN[k] !== 'REST')).length;
  const sorted = [...i.sessions].sort((a, b) => (a.date === b.date ? (a.createdAt ?? 0) - (b.createdAt ?? 0) : a.date < b.date ? -1 : 1));
  const inWeek = sorted.filter(s => s.date >= i.monday && s.date <= last);
  const prs = inWeek.flatMap(s => newPrs(s, sorted.filter(x => x !== s && (x.date < s.date || (x.date === s.date && (x.createdAt ?? 0) < (s.createdAt ?? 0))))).map(p => p.text));
  const runs = inWeek.filter(s => s.cardio);
  const longest = runs.reduce<SessionLog | null>((a, s) => (!a || s.cardio!.km > a.cardio!.km ? s : a), null);
  const steps = dates.map(d => i.days[d]?.steps).filter((v): v is number => typeof v === 'number' && v > 0);
  const sleep = dates.map(d => i.days[d]?.sleepMin).filter((v): v is number => typeof v === 'number' && v > 0);
  const w = [...i.weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const start = [...w].reverse().find(x => x.date < i.monday) ?? w.find(x => x.date >= i.monday && x.date <= last);
  const end = [...w].reverse().find(x => x.date >= i.monday && x.date <= last);
  return {
    week: i.week,
    from: i.monday,
    to: last,
    sessions: { done: dates.filter(d => i.days[d]?.sessionDone).length, planned, target: parseInt(i.profile.sessions, 10) || 4 },
    prs,
    food: {
      daysLogged: logged.length,
      avgKcal: avg(logged.map(d => d.kcal)),
      avgProtein: avg(logged.map(d => d.protein)),
      proteinDays: logged.filter(d => proteinT > 0 && d.protein >= proteinT * 0.9).length,
      overDays: logged.filter(d => kcalT > 0 && d.kcal > kcalT * 1.05).length,
      kcalTarget: kcalT,
      proteinTarget: proteinT,
    },
    steps: avg(steps),
    sleepH: sleep.length ? +(sleep.reduce((a, b) => a + b, 0) / sleep.length / 60).toFixed(1) : null,
    weight: { start: start?.kg ?? null, end: end?.kg ?? null, change: start && end && start !== end ? +(end.kg - start.kg).toFixed(1) : null },
    runs: { count: runs.length, km: +runs.reduce((a, s) => a + s.cardio!.km, 0).toFixed(1), best: longest ? `${longest.cardio!.km} km${longest.cardio!.kind === 'cycle' ? '' : ` at ${pace(longest.cardio!.km, longest.cardio!.seconds)}`}` : null },
  };
}

export interface ReportText {
  headline: string;
  summary: string;
  wins: string[];
  fix: string;
  focus: string;
}

export interface WeeklyReport extends ReportText {
  week: string;
  stats: WeekStats;
  generatedAt: number;
  /** False when written on the device or by the fallback, without REI. */
  ai: boolean;
}

export const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'The week in at most 8 words, e.g. "Four sessions, protein still short"' },
    summary: { type: 'string', description: 'Two or three sentences in REI’s voice using the numbers.' },
    wins: { type: 'array', items: { type: 'string' }, description: 'Up to three specific wins, one short sentence each' },
    fix: { type: 'string', description: 'The single biggest thing that held the week back, one sentence' },
    focus: { type: 'string', description: 'One concrete focus for next week, one sentence' },
  },
  required: ['headline', 'summary', 'wins', 'fix', 'focus'],
  additionalProperties: false,
} as const;

/** The numbers as plain lines for REI's prompt. */
export function statsLines(s: WeekStats): string {
  const f = s.food;
  return [
    `Week ${s.week} (${s.from} to ${s.to}).`,
    `Sessions: ${s.sessions.done} done of ${s.sessions.planned} planned so far (weekly target ${s.sessions.target}).`,
    s.prs.length ? `Personal records: ${s.prs.join('; ')}.` : 'No personal records.',
    `Food logged ${f.daysLogged} days. Average ${f.avgKcal ?? '?'} kcal (target ${f.kcalTarget}) and ${f.avgProtein ?? '?'} g protein (target ${f.proteinTarget}). Protein hit on ${f.proteinDays} days; over calories on ${f.overDays}.`,
    s.weight.change != null ? `Weight ${s.weight.start} → ${s.weight.end} kg (${s.weight.change > 0 ? '+' : ''}${s.weight.change}).` : s.weight.end != null ? `Weight ${s.weight.end} kg, no change measured.` : 'No weigh-ins.',
    s.runs.count ? `Cardio: ${s.runs.count} sessions, ${s.runs.km} km; longest ${s.runs.best}.` : '',
    s.steps != null ? `Average steps ${s.steps}.` : '',
    s.sleepH != null ? `Average sleep ${s.sleepH} h.` : '',
  ].filter(Boolean).join('\n');
}

export function reportPrompt(stats: WeekStats, profile: Profile, tough: boolean, memory = ''): { system: string; user: string } {
  return {
    system: `You are REI, a personal fitness coach writing one person's weekly report. Intensity ${tough ? '10/10, blunt' : '6/10, firm but warm'}. Use only the numbers given; never invent any. Praise real wins briefly, name the main problem plainly, and give one focus that would move their goal most. No em dashes, no emojis, no exclamation marks, never comment negatively on their body.`,
    user: `Goal (their words): "${profile.goal}". Deadline ${profile.deadline}. Weight target ${profile.targetWeight} kg.${memory ? `\nWhat you know about them: ${memory}` : ''}\n${statsLines(stats)}`,
  };
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s*[—–]\s*/g, '. ').slice(0, max) : '');

export function normalizeReport(raw: unknown): ReportText | null {
  const o = raw as Record<string, unknown> | null;
  if (!o) return null;
  const r = { headline: text(o.headline, 80), summary: text(o.summary, 600), wins: (Array.isArray(o.wins) ? o.wins : []).map(w => text(w, 160)).filter(Boolean).slice(0, 3), fix: text(o.fix, 240), focus: text(o.focus, 240) };
  return r.headline && r.summary ? r : null;
}

/** A plain report from the numbers alone: offline, in demo mode, or if REI can't be reached. */
export function fallbackReport(s: WeekStats): ReportText {
  const f = s.food, wins: string[] = [];
  if (s.sessions.planned && s.sessions.done >= s.sessions.planned) wins.push(`Every planned session done: ${s.sessions.done} of ${s.sessions.planned}.`);
  if (s.prs.length) wins.push(`${s.prs.length} personal record${s.prs.length > 1 ? 's' : ''}: ${s.prs[0]}.`);
  if (f.proteinDays >= 5) wins.push(`Protein hit on ${f.proteinDays} days.`);
  if (s.weight.change != null && s.weight.change < 0) wins.push(`Down ${-s.weight.change} kg.`);
  const missed = Math.max(0, s.sessions.planned - s.sessions.done);
  const fix = missed ? `${missed} planned session${missed > 1 ? 's' : ''} missed.` : f.daysLogged < 5 ? `Food logged on only ${f.daysLogged} days.` : f.avgProtein != null && f.avgProtein < f.proteinTarget * 0.9 ? `Protein averaged ${f.avgProtein} g against ${f.proteinTarget}.` : f.overDays ? `Over calories on ${f.overDays} days.` : 'Nothing major. Keep the standard.';
  return {
    headline: `${s.sessions.done} of ${s.sessions.planned} sessions${s.prs.length ? `, ${s.prs.length} PR` : ''}`,
    summary: `${s.sessions.done} of ${s.sessions.planned} planned sessions done. Food logged ${f.daysLogged} days, averaging ${f.avgKcal ?? 0} kcal and ${f.avgProtein ?? 0} g protein.${s.weight.change != null ? ` Weight ${s.weight.change > 0 ? 'up' : 'down'} ${Math.abs(s.weight.change)} kg.` : ''}`,
    wins,
    fix,
    focus: missed ? 'Every planned session next week, even the short version.' : f.avgProtein != null && f.avgProtein < f.proteinTarget * 0.9 ? `Hit ${f.proteinTarget} g protein every day.` : 'Add weight or reps to every main lift.',
  };
}
