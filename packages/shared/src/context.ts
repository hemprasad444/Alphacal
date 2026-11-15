// What REI knows on a given request, built the same way on the phone and the server.
import { SESSION_TIME } from './data';
import { nutrition, todaysPlan, week, weekLine } from './derive';
import type { ReiContext } from './rei';
import { hhmm, longDate } from './time';
import type { WeekProgram } from './data';
import { memoryLines, type MemoryItem } from './memory';
import type { Activity, History, Meal, Profile, SessionLog } from './types';
import { type DayRecord, factsBlock } from './facts';
import { recommend, suggestionsBlock } from './recommend';
import { isoDate } from './time';

export interface ContextInput {
  profile: Profile;
  disc: Record<string, boolean>;
  meals: Meal[];
  sessionDone: boolean;
  history: History;
  activity: Activity;
  tough: boolean;
  /** Casual best-friend voice that matches their energy and language. */
  bro?: boolean;
  nudge: boolean;
  /** Wall-clock time in the user's zone. */
  now: Date;
  program?: WeekProgram | null;
  /** Lasting facts REI has learned about them. */
  memory?: MemoryItem[];
  /** The real moment `now` stands for, epoch ms (the server's `now` is a wall clock, not a moment). */
  nowMs?: number;
  /** Their IANA time zone, when known (the server knows it; the phone's own clock is already theirs). */
  timeZone?: string;
  /** Sessions logged in the last week, today included. */
  sessions?: SessionLog[];
  /** Earlier days by date (yyyy-mm-dd): meals and whether the session was done. */
  days?: Record<string, DayRecord>;
}

export function reiContext(i: ContextInput): ReiContext {
  const plan = todaysPlan(i.now, i.program);
  const nu = nutrition(i.meals, i.activity);
  const yesterday = new Date(i.now.getFullYear(), i.now.getMonth(), i.now.getDate() - 1);
  return {
    profile: i.profile,
    nutrition: nu,
    meals: i.meals,
    tough: i.tough,
    bro: !!i.bro,
    nudge: i.nudge,
    sessionDone: i.sessionDone,
    todayLine: plan ? `${plan.title} session at ${i.profile.sessionTime || SESSION_TIME}` : 'Rest day',
    weekLine: weekLine(week(i.history, i.sessionDone, i.now, i.program)),
    disciplines: Object.keys(i.disc).filter(k => i.disc[k]),
    now: hhmm(i.now),
    today: longDate(i.now),
    memory: memoryLines(i.memory ?? []),
    // Everything REI would otherwise have to count or guess, worked out here instead.
    facts: factsBlock({ now: i.now, nowMs: i.nowMs, timeZone: i.timeZone, profile: i.profile, meals: i.meals, sessionDone: i.sessionDone, program: i.program, startedOn: i.history.kind === 'real' ? i.history.startedOn : undefined, sessions: i.sessions, days: i.days }),
    suggestions: suggestionsBlock(recommend({ now: i.now, profile: i.profile, nutrition: nu, meals: i.meals, recent: i.days?.[isoDate(yesterday)]?.meals, memory: i.memory, plan, sessionDone: i.sessionDone, program: i.program })),
  };
}
