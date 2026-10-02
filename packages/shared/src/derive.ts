// Numbers and copy the screens show, computed from app state.
// Ported from renderVals() in design/REI.dc.html.
import { demoWeighIns, SESSION_TIME, SESSIONS, WEEK_PLAN, type SessionKey, type SessionPlan } from './data';
import { daysBetween, isoDate, minutesUntil, monthDay, parseIsoDate, weekdayIndex } from './time';
import type { Activity, History, Meal, Nutrition, Profile, WeighIn } from './types';

const num = (s: string) => parseFloat(s) || 0;

/** `none`: before the user started, so neither kept nor missed. */
export type DayStatus = 'done' | 'missed' | 'rest' | 'today' | 'future' | 'none';

export interface WeekDay {
  day: string;
  type: SessionKey;
  status: DayStatus;
}

export interface Week {
  days: WeekDay[];
  done: number;
  missed: number;
  /** Planned sessions that were due so far (past days, plus today once it's done). */
  due: number;
  /** Sessions still to do this week, including today's if it isn't done. */
  left: number;
  yesterdayDone: boolean;
}

export function nutrition(meals: Meal[], activity: Activity): Nutrition {
  const sum = (k: 'kcal' | 'p' | 'c' | 'f') => meals.reduce((a, m) => a + (+m[k] || 0), 0);
  return { ...activity, kcal: sum('kcal'), protein: sum('p'), carbs: sum('c'), fat: sum('f') };
}

export function todaysPlan(now: Date = new Date()): SessionPlan | null {
  const key = WEEK_PLAN[weekdayIndex(now)];
  return key === 'REST' ? null : SESSIONS[key];
}

/**
 * The current week. With real history, a past training day is done if its session was
 * logged and missed otherwise. The demo story keeps every session in a strong week and
 * misses Tuesday and Wednesday in a slipping one.
 */
export function week(history: History, sessionDone: boolean, now: Date = new Date()): Week {
  const t = weekdayIndex(now);
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const pastStatus = (i: number): DayStatus => {
    if (history.kind === 'demo') return history.scenario === 'Slipping week' && (i === 1 || i === 2) ? 'missed' : 'done';
    const d = new Date(now);
    d.setDate(now.getDate() - (t - i));
    const iso = isoDate(d);
    if (iso < history.startedOn) return 'none';
    return history.sessions[iso] ? 'done' : 'missed';
  };
  const days = WEEK_PLAN.map((type, i): WeekDay => {
    let status: DayStatus;
    if (type === 'REST') status = 'rest';
    else if (i < t) status = pastStatus(i);
    else if (i === t) status = sessionDone ? 'done' : 'today';
    else status = 'future';
    return { day: labels[i], type, status };
  });
  const done = days.filter(d => d.status === 'done').length;
  const missed = days.filter(d => d.status === 'missed').length;
  const left = days.filter(d => d.status === 'today' || d.status === 'future').length;
  const y = t > 0 ? days[t - 1] : null;
  return { days, done, missed, due: done + missed, left, yesterdayDone: y?.status === 'done' };
}

export function weekLine(w: Week): string {
  const names: Record<SessionKey, string> = { PUSH: 'push', RUN: 'run', PULL: 'pull', REST: 'rest', LEGS: 'legs', CALI: 'calisthenics' };
  const dn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return w.days
    .map((d, i) => `${dn[i]} ${names[d.type]} ${d.status === 'missed' ? 'MISSED' : d.status === 'today' ? 'today' : d.status}`)
    .join(', ');
}

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
export const word = (n: number) => WORDS[n] ?? String(n);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function integrity(w: Week): number {
  return w.due ? Math.round(40 + (60 * w.done) / w.due) : 100;
}

export interface Hero {
  tag: string;
  tone: 'alert' | 'acc';
  parts: { t: string; hl?: boolean }[];
}

export function hero(w: Week, plan: SessionPlan | null, sessionDone: boolean, tough: boolean, proteinLeft: number, stepsTarget: number): Hero {
  if (!plan) {
    return {
      tag: 'RECOVERY', tone: 'acc',
      parts: [{ t: 'Rest day. ' }, { t: 'Recovery is training too.', hl: true }, { t: ` ${stepsTarget.toLocaleString('en-US')} steps, protein, bed by 23:30.` }],
    };
  }
  const n = w.missed;
  if (n > 0 && !sessionDone) {
    return {
      tag: 'CALL-OUT', tone: 'alert',
      parts: tough
        ? [{ t: 'You said this mattered. ' }, { t: `${word(n)} ${plural(n, 'session', 'sessions')} missed`, hl: true }, { t: ` this week. Stop negotiating with yourself. ${plan.title} day. Tonight, ${SESSION_TIME}.` }]
        : [{ t: `${word(n)} ${plural(n, 'session', 'sessions')} slipped this week. ` }, { t: 'Tonight decides the week.', hl: true }, { t: ` ${plan.title} day at ${SESSION_TIME}. ${plan.minutes} minutes, that’s all I’m asking.` }],
    };
  }
  if (n > 0 && proteinLeft === 0) {
    return {
      tag: 'ACKNOWLEDGED', tone: 'acc',
      parts: tough
        ? [{ t: 'Good. That\u2019s one back and ' }, { t: 'protein is hit.', hl: true }, { t: ` The week is still ${word(n).toLowerCase()} down. Don\u2019t celebrate yet.` }]
        : [{ t: 'Strong session, and ' }, { t: 'protein is hit.', hl: true }, { t: ' Bed by 23:30 and the week is back on track.' }],
    };
  }
  if (n > 0) {
    return {
      tag: 'ACKNOWLEDGED', tone: 'acc',
      parts: tough
        ? [{ t: 'Good. That’s one back. ' }, { t: `${proteinLeft} g of protein`, hl: true }, { t: ` still to hit, and the week is still ${word(n).toLowerCase()} down. Don’t celebrate yet.` }]
        : [{ t: 'Strong session. ' }, { t: `${proteinLeft} g of protein`, hl: true }, { t: ' left. Make dinner count and the week is back on track.' }],
    };
  }
  if (!sessionDone) {
    return {
      tag: 'ON TRACK', tone: 'acc',
      parts: [{ t: w.yesterdayDone ? 'Good work. Yesterday was strong. ' : 'Good work. The week is clean so far. ' }, { t: 'Now repeat it.', hl: true }, { t: ' Consistency is what changes your physique.' }],
    };
  }
  return {
    tag: 'ON TRACK', tone: 'acc',
    parts: [{ t: `${word(w.done)} for ${word(w.done).toLowerCase()}. ` }, { t: 'This is the version of you we agreed on.', hl: true }, { t: ' Protein, then bed by 23:30.' }],
  };
}

export function weekNote(w: Week, sessionDone: boolean): string {
  if (!w.missed) return w.left ? `Every planned session kept. ${word(w.left)} left. Same standard.` : 'Every planned session kept. That’s a full week.';
  const misses = `${word(w.missed)} ${plural(w.missed, 'miss', 'misses')}`;
  if (sessionDone || !w.days.some(d => d.status === 'today')) {
    return w.left
      ? `${misses} with ${word(w.left).toLowerCase()} ${plural(w.left, 'session', 'sessions')} left. Hit ${w.left === 1 ? 'it' : 'all of them'} and the week still counts.`
      : `${misses} this week. Next week starts clean. Earn it.`;
  }
  const rest = w.left - 1;
  return rest
    ? `${misses}. Tonight plus ${word(rest).toLowerCase()} more. Hit all ${word(w.left).toLowerCase()} and the week still counts. Miss tonight and it doesn’t.`
    : `${misses}. Tonight is the last session this week. Miss it and the week doesn’t count.`;
}

export function sessionCountdown(now: Date = new Date()): string {
  const m = minutesUntil(SESSION_TIME, now);
  if (m > 0) return `${SESSION_TIME} · IN ${m >= 120 ? Math.round(m / 60) + ' H' : m + ' MIN'}`;
  if (m > -15) return `${SESSION_TIME} · NOW`;
  return `${SESSION_TIME} · ${-m >= 120 ? Math.round(-m / 60) + ' H' : -m + ' MIN'} LATE`;
}

export interface Trajectory {
  weight: number;
  target: number;
  history: number[];
  reqPace: number;
  curPace: number;
  behind: boolean;
  daysLeft: number;
  eta: string;
  etaAlert: boolean;
  note: string;
}

/**
 * Weight trajectory. `weighIns` are past entries (oldest first); the profile's weight is
 * today's. Current pace compares today with the oldest entry from the last four weeks.
 * Without `weighIns`, the demo history is used.
 */
export function trajectory(profile: Profile, missed: number, now: Date = new Date(), weighIns?: WeighIn[]): Trajectory {
  const w = num(profile.weight), tw = num(profile.targetWeight);
  const today = isoDate(now);
  const past = (weighIns ?? demoWeighIns(now)).filter(x => x.date < today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const history = [...past.slice(-11).map(x => x.kg), w];
  const deadline = parseIsoDate(profile.deadline);
  const daysLeft = deadline ? Math.max(0, daysBetween(now, deadline)) : 0;
  const reqPace = daysLeft ? (w - tw) / (daysLeft / 7) : 0;
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - 28);
  const base = past.find(x => x.date >= isoDate(cutoff)) ?? past[past.length - 1];
  const span = base ? daysBetween(parseIsoDate(base.date) ?? now, now) : 0;
  const curPace = base && span >= 7 ? (base.kg - w) / (span / 7) : 0;
  const behind = curPace < reqPace;
  let eta = 'NO TREND', etaAlert = true, note: string;
  if (w <= tw) {
    eta = 'TARGET HIT';
    etaAlert = false;
    note = 'You’re at the target weight. Now hold it while the lifts climb.';
  } else if (curPace > 0) {
    const etaDate = new Date(now.getTime() + ((w - tw) / curPace) * 7 * 86400000);
    const diffWeeks = deadline ? Math.round(daysBetween(deadline, etaDate) / 7) : 0;
    eta = `ETA ${monthDay(etaDate)} · ${diffWeeks > 0 ? `+${diffWeeks} WK` : diffWeeks < 0 ? 'AHEAD' : 'ON PACE'}`;
    etaAlert = diffWeeks > 0;
    note = behind
      ? `You need ${reqPace.toFixed(2)} kg a week. Last month averaged ${curPace.toFixed(2)}.${missed ? ' Missed sessions are why.' : ''}`
      : `Losing ${curPace.toFixed(2)} kg a week. Hold this and you arrive ${Math.max(1, -Math.round(daysBetween(deadline ?? now, etaDate)))} days early.`;
  } else {
    note = `You need ${reqPace.toFixed(2)} kg a week and the scale hasn’t moved this month. Tighten the food first.`;
  }
  return { weight: w, target: tw, history, reqPace, curPace, behind, daysLeft, eta, etaAlert, note };
}

export interface ProtocolRow {
  label: string;
  jp: string;
  value: string;
  status: string;
  tone: 'acc' | 'warn' | 'alert';
  pct: number;
  fuel?: boolean;
}

export function protocol(plan: SessionPlan | null, nu: Nutrition, profile: Profile, sessionDone: boolean, loggedMin: number, strong: boolean): ProtocolRow[] {
  const protT = num(profile.protein), kcalT = num(profile.kcal), stepsT = num(profile.steps), sleepT = num(profile.sleep);
  const frac = (a: number, b: number) => Math.max(0, Math.min(1, b ? a / b : 0));
  const kp = kcalT ? nu.kcal / kcalT : 0;
  const pp = protT ? nu.protein / protT : 0;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const training: ProtocolRow = !plan
    ? { label: 'Training', jp: '鍛錬', value: 'Rest day', status: 'REST', tone: 'acc', pct: 1 }
    : sessionDone
      ? { label: 'Training', jp: '鍛錬', value: `${plan.title} · ${loggedMin} min`, status: 'DONE', tone: 'acc', pct: 1 }
      : { label: 'Training', jp: '鍛錬', value: `${plan.title} · ${SESSION_TIME}`, status: 'PENDING', tone: strong ? 'warn' : 'alert', pct: 0 };
  return [
    training,
    { label: 'Protein', jp: '蛋白', value: `${nu.protein} / ${protT} g`, status: pp < 0.7 ? 'BEHIND' : 'ON TRACK', tone: pp < 0.7 ? 'alert' : 'acc', pct: frac(nu.protein, protT), fuel: true },
    { label: 'Calories', jp: '熱量', value: `${fmt(nu.kcal)} / ${fmt(kcalT)}`, status: kp > 0.95 ? 'AT LIMIT' : kp > 0.78 ? 'WATCH' : 'OK', tone: kp > 0.95 ? 'alert' : kp > 0.78 ? 'warn' : 'acc', pct: frac(nu.kcal, kcalT), fuel: true },
    nu.steps == null
      ? { label: 'Steps', jp: '歩数', value: `\u2014 / ${fmt(stepsT)}`, status: 'NO DATA', tone: 'warn', pct: 0 }
      : { label: 'Steps', jp: '歩数', value: `${fmt(nu.steps)} / ${fmt(stepsT)}`, status: nu.steps / stepsT < 0.5 ? 'BEHIND' : nu.steps >= stepsT ? 'DONE' : 'ON TRACK', tone: nu.steps / stepsT < 0.5 ? 'alert' : 'acc', pct: frac(nu.steps, stepsT) },
    nu.sleep == null
      ? { label: 'Sleep', jp: '睡眠', value: '\u2014', status: 'NO DATA', tone: 'warn', pct: 0 }
      : { label: 'Sleep', jp: '睡眠', value: nu.sleepL, status: nu.sleep < sleepT - 0.25 ? 'SHORT' : 'DONE', tone: nu.sleep < sleepT - 0.25 ? 'warn' : 'acc', pct: frac(nu.sleep, sleepT) },
  ];
}

export const CLEARED = ['DONE', 'ON TRACK', 'OK', 'REST'];

export function sessionLine(f: number, plan: SessionPlan): string {
  if (f === 0) return plan.key === 'RUN' ? 'Warm up properly. Easy first kilometre, then we go to work.' : `No skipping warm-ups. Two ramp sets on the first lift, then ${plan.exercises[0].target.split('· ')[1] ?? 'working weight'} for real.`;
  if (f < 0.5) return 'Good start. Rest under two minutes. I’m counting.';
  if (f < 1) return 'This is the part where you used to quit. Not today.';
  return 'Every set. That’s the version of you I’m here for. Log it.';
}

export function sessionSummary(done: number, total: number, minutes: number, proteinLeft: number, title: string, missed: number): { text: string; alert: boolean } {
  return done / total >= 0.8
    ? { text: `Logged: ${title}, ${minutes} min, ${done}/${total} sets.${missed ? " That's one back." : ''} Now protein: ${proteinLeft} g left. Don't waste the session at dinner.`, alert: false }
    : { text: `Partial session: ${done}/${total} sets. Better than zero. Not the standard you set. Finish the week properly.`, alert: true };
}
