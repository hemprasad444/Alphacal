// The clock and the calendar, worked out for REI. A model asked "when's my workout?" or "how long
// since I ate?" will happily do the sum wrong or guess the weekday, so every time-dependent fact is
// computed here from the user's own wall clock and handed over as text. REI reads it; it never counts.
import { SESSION_TIME, type WeekProgram } from './data';
import { nextPlan, todaysPlan } from './derive';
import { clockMinutes, daysBetween, hhmm, isoDate, parseIsoDate, programWeek, zonedNow } from './time';
import type { Meal, Profile, SessionLog } from './types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type PartOfDay = 'early morning' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late night';

/** What people call this hour: REI says "tonight" at 21:00 and never "good morning" at 15:00. */
export function partOfDay(now: Date): PartOfDay {
  const h = now.getHours();
  if (h < 5) return 'late night';
  if (h < 8) return 'early morning';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

/** "Sunday 15 November 2026". */
export const fullDate = (d: Date) => `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
/** "Sat 14 Nov". */
const shortDate = (d: Date) => `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

/** A length of time in plain words: "25 min", "4 h 25 min", "2 h", "3 days". */
export function span(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  if (m >= 48 * 60) return `${Math.round(m / 1440)} days`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export interface DayRecord {
  meals?: Meal[];
  sessionDone?: boolean;
}

export interface FactsInput {
  /** Wall-clock time in the user's zone (see zonedNow). */
  now: Date;
  /** Their IANA zone, when known: named in the text, and used to place logged sessions on their clock. */
  timeZone?: string;
  /** The real moment `now` stands for, epoch ms. On the phone `now` is already real; the server passes this with a zoned `now`. */
  nowMs?: number;
  profile: Profile;
  /** Today's meals. */
  meals: Meal[];
  sessionDone: boolean;
  program?: WeekProgram | null;
  /** yyyy-mm-dd they started, when known. */
  startedOn?: string;
  /** Sessions logged recently (today included), any order. */
  sessions?: SessionLog[];
  /** Earlier days by date (yyyy-mm-dd): what was eaten and whether the session was done. */
  days?: Record<string, DayRecord>;
}

export interface TimeFacts {
  /** Minutes until today's planned session (negative once its time has passed); null on a rest day. */
  sessionIn: number | null;
  /** Minutes since the last meal logged today; null when none was, or when a clock change today makes it unknowable. */
  sinceMeal: number | null;
  /** Whole days from today to the deadline (negative once passed); null without a valid deadline. */
  daysToDeadline: number | null;
  /** Day number since they started (1 on the first day); null when unknown. */
  dayOfVow: number | null;
  /** The lines REI is given. */
  lines: string[];
}

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
const num = (s: string) => parseFloat(s) || 0;

/** Minutes east of UTC at a real moment, in a zone (or on this device's own clock without one); null if the zone is unknown. */
function utcOffset(epoch: number, timeZone?: string): number | null {
  if (!timeZone) return -new Date(epoch).getTimezoneOffset();
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(epoch).map(x => [x.type, x.value]));
    return Math.round((Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - Math.floor(epoch / 60000) * 60000) / 60000);
  } catch {
    return null;
  }
}

/**
 * Whether the clocks changed between `minutesBack` minutes ago and now (daylight saving starting or
 * ending). Wall-clock subtraction is an hour out across one; false when the real moment isn't known.
 */
function clocksChanged(nowMs: number | undefined, minutesBack: number, timeZone?: string): boolean {
  if (nowMs === undefined) return false;
  return utcOffset(nowMs, timeZone) !== utcOffset(nowMs - (minutesBack + 90) * 60000, timeZone);
}

/** A logged session in a few words: "Legs, 50 min", "Run 5 km, 28 min". */
function sessionLabel(s: SessionLog): string {
  const min = Math.round((s.seconds || 0) / 60);
  const what = s.cardio ? `${s.title ?? 'Run'} ${s.cardio.km} km` : (s.activity?.name ?? s.title ?? 'Session');
  return min > 0 ? `${what}, ${min} min` : what;
}

/** The time of day a session was logged, on the user's clock. */
function loggedAt(s: SessionLog, timeZone?: string): string {
  if (!s.createdAt) return '';
  return hhmm(timeZone ? zonedNow(timeZone, new Date(s.createdAt)) : new Date(s.createdAt));
}

const kcalOf = (meals: Meal[]) => meals.reduce((a, m) => a + (+m.kcal || 0), 0);
const proteinOf = (meals: Meal[]) => meals.reduce((a, m) => a + (+m.p || 0), 0);

/** Every time-dependent fact for one moment, as numbers and as the lines REI reads. */
export function timeFacts(i: FactsInput): TimeFacts {
  const { now, profile: p } = i;
  const today = isoDate(now);
  const nowMin = minutesOfDay(now);
  const lines: string[] = [];

  // --- The clock ---
  const zone = i.timeZone ? `, their local time (${i.timeZone})` : ', their local time';
  lines.push(`NOW: ${fullDate(now)}, ${hhmm(now)} (${partOfDay(now)})${zone}. Yesterday was ${shortDate(addDays(now, -1))}; tomorrow is ${shortDate(addDays(now, 1))}.`);
  lines.push(`COMING DAYS: ${[1, 2, 3, 4, 5, 6, 7].map(n => addDays(now, n)).map(d => `${WEEKDAYS[d.getDay()].slice(0, 3)} ${isoDate(d)}`).join(', ')}.`);

  // --- The vow ---
  const started = i.startedOn ? parseIsoDate(i.startedOn) : null;
  const dayOfVow = started && daysBetween(started, now) >= 0 ? daysBetween(started, now) + 1 : null;
  const deadline = parseIsoDate(p.deadline);
  const daysToDeadline = deadline ? daysBetween(now, deadline) : null;
  const vow: string[] = [];
  if (dayOfVow !== null) vow.push(`day ${dayOfVow} since they started (${i.startedOn}), week ${programWeek(i.startedOn!, now)}`);
  if (daysToDeadline !== null) {
    const weeks = Math.floor(Math.abs(daysToDeadline) / 7), rest = Math.abs(daysToDeadline) % 7;
    const inWeeks = weeks ? ` (${weeks} week${weeks === 1 ? '' : 's'}${rest ? ` ${rest} day${rest === 1 ? '' : 's'}` : ''})` : '';
    vow.push(daysToDeadline > 0 ? `the deadline ${p.deadline} is ${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'} away${inWeeks}` : daysToDeadline === 0 ? `the deadline ${p.deadline} is today` : `the deadline ${p.deadline} passed ${-daysToDeadline} day${daysToDeadline === -1 ? '' : 's'} ago`);
  }
  if (vow.length) lines.push(`VOW: ${vow.join('; ')}.`);

  // --- Training ---
  const plan = todaysPlan(now, i.program);
  const at = clockMinutes(p.sessionTime) === null ? SESSION_TIME : p.sessionTime.trim();
  const sessionIn = plan ? clockMinutes(at)! - nowMin : null;
  const sessions = [...(i.sessions ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt ?? 0) - (b.createdAt ?? 0)));
  const todays = sessions.filter(s => s.date === today);
  const logged = todays.map(s => `${sessionLabel(s)}${loggedAt(s, i.timeZone) ? ` at ${loggedAt(s, i.timeZone)}` : ''}`).join('; ');
  if (plan && i.sessionDone) {
    lines.push(`TRAINING TODAY: ${plan.title} was planned for ${at} and today's training is DONE${logged ? ` (logged: ${logged})` : ''}.`);
  } else if (plan) {
    const when = sessionIn! > 0 ? `starts in ${span(sessionIn!)}` : sessionIn! > -15 ? 'starts now' : `was due ${span(-sessionIn!)} ago`;
    lines.push(`TRAINING TODAY: ${plan.title}, about ${plan.minutes} min, planned for ${at}: ${when}. NOT done yet.`);
  } else {
    lines.push(`TRAINING TODAY: rest day, nothing planned${logged ? `; they still logged: ${logged}` : ''}.`);
  }
  const next = nextPlan(now, i.program);
  if (next) {
    const ahead = (WEEKDAYS.indexOf(next.day) - now.getDay() + 7) % 7 || 7;
    lines.push(`NEXT SESSION AFTER TODAY: ${next.day}${ahead === 1 ? ' (tomorrow)' : ` (in ${ahead} days)`}, ${next.plan.title}, at ${at}.`);
  }
  const last = sessions[sessions.length - 1];
  if (last) {
    const ago = daysBetween(parseIsoDate(last.date) ?? now, now);
    const when = ago <= 0 ? `today${loggedAt(last, i.timeZone) ? ` at ${loggedAt(last, i.timeZone)}` : ''}` : ago === 1 ? `yesterday (${shortDate(addDays(now, -1))})` : `${ago} days ago (${shortDate(addDays(now, -ago))})`;
    lines.push(`LAST WORKOUT LOGGED: ${when}: ${sessionLabel(last)}.`);
  } else if (i.sessions) {
    lines.push('LAST WORKOUT LOGGED: none in the last week.');
  }

  // --- Food ---
  // The real moment: given by the server; on the phone `now` already is one.
  const nowMs = i.nowMs ?? (i.timeZone ? undefined : now.getTime());
  /** A meal's own timestamp, when it has one that still agrees with its clock time (an edited time doesn't). */
  const stamp = (m: Meal): number | null => {
    if (typeof m.at !== 'number' || nowMs === undefined || m.at > nowMs + 60000) return null;
    return hhmm(i.timeZone ? zonedNow(i.timeZone, new Date(m.at)) : new Date(m.at)) === m.time ? m.at : null;
  };
  // The clocks changed today: a wall-clock difference is an hour out, and 01:45 can be after 01:30.
  const shifted = clocksChanged(nowMs, nowMin, i.timeZone);
  const timed = i.meals
    .map(m => ({ m, at: clockMinutes(m.time), real: stamp(m) }))
    .filter((x): x is { m: Meal; at: number; real: number | null } => x.at !== null && (x.real !== null || x.at <= nowMin + (shifted ? 60 : 0)));
  // In the order eaten: by timestamp where both have one, by the clock otherwise.
  const lastMeal = timed.sort((x, y) => (x.real !== null && y.real !== null ? x.real - y.real : x.at - y.at))[timed.length - 1];
  // Exact from the timestamp. From clock times alone it is exact too, unless the clocks changed in between.
  const sinceMeal = !lastMeal ? null : lastMeal.real !== null ? Math.max(0, Math.round((nowMs! - lastMeal.real) / 60000)) : shifted ? null : nowMin - lastMeal.at;
  const earlier = Object.keys(i.days ?? {}).filter(d => d < today).sort();
  const yKey = isoDate(addDays(now, -1));
  const count = `${i.meals.length} meal${i.meals.length === 1 ? '' : 's'} logged today.`;
  if (lastMeal && sinceMeal !== null) {
    lines.push(`LAST MEAL: ${lastMeal.m.name} at ${lastMeal.m.time} today, ${span(sinceMeal)} ago. ${count}`);
  } else if (lastMeal) {
    lines.push(`LAST MEAL: ${lastMeal.m.name} at ${lastMeal.m.time} today. The clocks changed today, so how long ago that was isn't known exactly: don't state a number of hours or minutes. ${count}`);
  } else {
    // Nothing today: the most recent meal on an earlier day, with how long ago that was.
    const prevDay = [...earlier].reverse().find(d => (i.days![d].meals ?? []).some(m => clockMinutes(m.time) !== null));
    const prev = prevDay ? [...i.days![prevDay].meals!].filter(m => clockMinutes(m.time) !== null).sort((x, y) => clockMinutes(x.time)! - clockMinutes(y.time)!).pop() : undefined;
    if (prev && prevDay) {
      const daysAgo = daysBetween(parseIsoDate(prevDay) ?? now, now);
      const when = `${prev.name} at ${prev.time} ${daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`}`;
      const byClock = daysAgo * 1440 + nowMin - clockMinutes(prev.time)!;
      const real = stamp(prev);
      if (real !== null) lines.push(`LAST MEAL: nothing logged today. The last logged meal was ${when}, about ${span((nowMs! - real) / 60000)} ago.`);
      else if (clocksChanged(nowMs, byClock, i.timeZone)) lines.push(`LAST MEAL: nothing logged today. The last logged meal was ${when} (the clocks have changed since, so don't state the exact hours).`);
      else lines.push(`LAST MEAL: nothing logged today. The last logged meal was ${when}, about ${span(byClock)} ago.`);
    } else {
      lines.push('LAST MEAL: nothing logged today.');
    }
  }
  const eaten = { kcal: kcalOf(i.meals), p: proteinOf(i.meals), c: i.meals.reduce((a, m) => a + (+m.c || 0), 0), f: i.meals.reduce((a, m) => a + (+m.f || 0), 0) };
  const left = { kcal: Math.round(num(p.kcal) - eaten.kcal), p: Math.round(num(p.protein) - eaten.p), c: Math.round(num(p.carbs) - eaten.c), f: Math.round(num(p.fat) - eaten.f) };
  const part = (v: number, unit: string, name: string) => (v >= 0 ? `${v}${unit} ${name}` : `${name} over by ${-v}${unit}`);
  lines.push(`LEFT TODAY (targets minus what is logged): ${left.kcal >= 0 ? `${left.kcal} kcal` : `calories OVER by ${-left.kcal} kcal`}, ${part(left.p, ' g', 'protein')}, ${part(left.c, ' g', 'carbs')}, ${part(left.f, ' g', 'fat')}.`);

  const y = i.days?.[yKey];
  if (y) {
    const ym = y.meals ?? [];
    lines.push(`YESTERDAY (${shortDate(addDays(now, -1))}): ${ym.length ? `${Math.round(kcalOf(ym))} kcal, ${Math.round(proteinOf(ym))} g protein from ${ym.map(m => `${m.time} ${m.name}`).join('; ')}` : 'no meals logged'}; training ${y.sessionDone ? 'done' : 'not logged'}.`);
  } else if (i.days) {
    lines.push(`YESTERDAY (${shortDate(addDays(now, -1))}): nothing logged.`);
  }

  // --- Bed ---
  const bed = clockMinutes(p.bedtime);
  if (bed !== null) {
    // A bedtime after midnight ("00:30") seen in the evening is still ahead, not 20 hours ago.
    const until = ((bed - nowMin + 1440 + 360) % 1440) - 360;
    lines.push(`BEDTIME: ${p.bedtime.trim()}, ${until >= 0 ? `in ${span(until)}` : `${span(-until)} ago`}.`);
  }
  return { sessionIn, sinceMeal, daysToDeadline, dayOfVow, lines };
}

/** The block REI reads. Everything in it is computed; REI quotes it and never recalculates. */
export function factsBlock(i: FactsInput): string {
  return `FACTS (computed by the app for this exact moment; when a date, a time, "how long", what was eaten or what is left comes up, read it here and never work it out or guess):\n${timeFacts(i).lines.join('\n')}`;
}
