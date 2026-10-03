// When REI messages first. Pure rules, evaluated every 15 minutes on the server in the
// user's own time zone. Each rule fires at most once per day.
import { SESSION_TIME, type SessionPlan } from './data';
import type { Week } from './derive';
import { hhmm } from './time';
import type { Nutrition, Profile } from './types';

export type NudgeId = 'session-late' | 'over-kcal' | 'protein-low' | 'streak' | 'bedtime';

export interface Nudge {
  id: NudgeId;
  /** What happened, for the model to write about. */
  fact: string;
  /** REI's line if the model is unavailable. */
  fallback: string;
}

export interface CoachState {
  plan: SessionPlan | null;
  sessionDone: boolean;
  nutrition: Nutrition;
  profile: Profile;
  week: Week;
  /** Nudges already sent today. */
  sent: string[];
}

const at = (h: number, m = 0) => h * 60 + m;
const num = (s: string) => parseFloat(s) || 0;
const DAY = 24 * 60;

/** "HH:MM" → minutes after midnight, or the fallback when it isn't a valid time. */
export function minutesOf(time: string | undefined, fallback: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim()) ?? /^(\d{1,2}):(\d{2})$/.exec(fallback)!;
  const h = +m[1], min = +m[2];
  return h < 24 && min < 60 ? at(h, min) : minutesOf(fallback, fallback);
}

/** Whether minute-of-day `m` falls in [from, to), wrapping past midnight. */
const inWindow = (m: number, from: number, to: number) => (from <= to ? m >= from && m < to : m >= from || m < to);

/** Quiet from 30 minutes after their bedtime until they wake (bedtime plus their sleep target). */
export function quietHours(profile: Pick<Profile, 'bedtime' | 'sleep'>): { from: number; to: number } {
  const bed = minutesOf(profile.bedtime, '23:00');
  const sleepMin = Math.round((num(profile.sleep) || 8) * 60);
  return { from: (bed + 30) % DAY, to: (bed + sleepMin) % DAY };
}

/**
 * The single most important nudge due now, or null. One per run keeps REI pointed,
 * not noisy; anything else due gets its turn on the next run.
 */
export function nudgeDue(s: CoachState, now: Date): Nudge | null {
  const m = now.getHours() * 60 + now.getMinutes();
  const quiet = quietHours(s.profile);
  if (inWindow(m, quiet.from, quiet.to)) return null;
  const sessionTime = /^\d{1,2}:\d{2}$/.test(s.profile.sessionTime ?? '') ? s.profile.sessionTime : SESSION_TIME;
  const sessionAt = minutesOf(sessionTime, SESSION_TIME);
  const bed = minutesOf(s.profile.bedtime, '23:00');
  const kcalT = num(s.profile.kcal), protT = num(s.profile.protein);
  const kcalOver = s.nutrition.kcal - kcalT;
  const protLeft = Math.max(0, protT - s.nutrition.protein);

  const due: Nudge[] = [];
  // From 30 minutes after their session time, until 90 minutes before bed.
  if (s.plan && !s.sessionDone && inWindow(m, (sessionAt + 30) % DAY, (bed - 90 + DAY) % DAY) && m >= sessionAt + 30) {
    due.push({
      id: 'session-late',
      fact: `Their ${s.plan.title} session was due at ${sessionTime}; it is ${hhmm(now)} and it hasn't started.`,
      fallback: `${s.plan.title} was due at ${sessionTime}. It’s ${hhmm(now)}. Shoes on, or tell me why not.`,
    });
  }
  if (kcalT && kcalOver > 0) {
    due.push({
      id: 'over-kcal',
      fact: `They are ${kcalOver} kcal over today's ${kcalT} kcal target.`,
      fallback: `Over by ${kcalOver} kcal. Kitchen’s closed. Water, a walk, bed.`,
    });
  }
  if (protT && m >= at(20) && s.nutrition.protein < protT * 0.6) {
    due.push({
      id: 'protein-low',
      fact: `It is ${hhmm(now)} and protein is ${s.nutrition.protein} of ${protT} g (${protLeft} g left).`,
      fallback: `${protLeft} g protein left and the day is closing. One real meal, protein first.`,
    });
  }
  if (s.week.missed >= 2 && m >= at(8) && m < at(12)) {
    due.push({
      id: 'streak',
      fact: `They have missed ${s.week.missed} planned sessions this week.`,
      fallback: `${s.week.missed} sessions missed this week. Today is not optional.`,
    });
  }
  if (inWindow(m, bed, (bed + 30) % DAY)) {
    const b = `${String(Math.floor(bed / 60)).padStart(2, '0')}:${String(bed % 60).padStart(2, '0')}`;
    due.push({ id: 'bedtime', fact: `It is ${hhmm(now)}; their bedtime target is ${b}.`, fallback: `${b}. Screens off. Recovery happens now.` });
  }
  return due.find(n => !s.sent.includes(n.id)) ?? null;
}
