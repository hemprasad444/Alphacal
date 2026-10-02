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

/** No messages between 23:30 and 07:00. */
export const QUIET = { from: at(23, 30), to: at(7) };

/**
 * The single most important nudge due now, or null. One per run keeps REI pointed,
 * not noisy; anything else due gets its turn on the next run.
 */
export function nudgeDue(s: CoachState, now: Date): Nudge | null {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m >= QUIET.from || m < QUIET.to) return null;
  const [sh, sm] = SESSION_TIME.split(':').map(Number);
  const kcalT = num(s.profile.kcal), protT = num(s.profile.protein);
  const kcalOver = s.nutrition.kcal - kcalT;
  const protLeft = Math.max(0, protT - s.nutrition.protein);

  const due: Nudge[] = [];
  if (s.plan && !s.sessionDone && m >= at(sh, sm) + 30 && m < at(22)) {
    due.push({
      id: 'session-late',
      fact: `Their ${s.plan.title} session was due at ${SESSION_TIME}; it is ${hhmm(now)} and it hasn't started.`,
      fallback: `${s.plan.title} was due at ${SESSION_TIME}. It’s ${hhmm(now)}. Shoes on, or tell me why not.`,
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
  if (m >= at(23) && m < QUIET.from) {
    due.push({ id: 'bedtime', fact: 'It is 23:00, their bedtime target.', fallback: '23:00. Screens off. Recovery happens now.' });
  }
  return due.find(n => !s.sent.includes(n.id)) ?? null;
}
