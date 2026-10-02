// What REI knows on a given request, built the same way on the phone and the server.
import { SESSION_TIME } from './data';
import { nutrition, todaysPlan, week, weekLine } from './derive';
import type { ReiContext } from './rei';
import { hhmm, longDate } from './time';
import type { WeekProgram } from './data';
import type { Activity, History, Meal, Profile } from './types';

export interface ContextInput {
  profile: Profile;
  disc: Record<string, boolean>;
  meals: Meal[];
  sessionDone: boolean;
  history: History;
  activity: Activity;
  tough: boolean;
  nudge: boolean;
  /** Wall-clock time in the user's zone. */
  now: Date;
  program?: WeekProgram | null;
}

export function reiContext(i: ContextInput): ReiContext {
  const plan = todaysPlan(i.now, i.program);
  return {
    profile: i.profile,
    nutrition: nutrition(i.meals, i.activity),
    meals: i.meals,
    tough: i.tough,
    nudge: i.nudge,
    sessionDone: i.sessionDone,
    todayLine: plan ? `${plan.title} session at ${SESSION_TIME}` : 'Rest day',
    weekLine: weekLine(week(i.history, i.sessionDone, i.now, i.program)),
    disciplines: Object.keys(i.disc).filter(k => i.disc[k]),
    now: hhmm(i.now),
    today: longDate(i.now),
  };
}
