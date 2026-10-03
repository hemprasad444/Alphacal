// A workout the user tells REI about ("leg day, 45 minutes", "5k in 28 minutes", "football
// for an hour"), turned into the same session record the app writes when you log one by hand.
import { distanceKcal, movementKcal, searchMovements } from './activities';
import type { SessionPlan } from './data';
import type { SessionLog } from './types';

export const WORKOUT_KINDS = ['session', 'run', 'walk', 'cycle', 'activity'] as const;
export type WorkoutKind = (typeof WORKOUT_KINDS)[number];

export interface Workout {
  kind: WorkoutKind;
  /** What they did, in their words: "leg day", "football", "5k". */
  name: string;
  minutes: number;
  /** Distance for runs, walks and rides; 0 when not given. */
  km: number;
}

const between = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** A log_workout call's input, checked; null when it isn't usable. */
export function parseWorkout(input: unknown): Workout | null {
  const o = (input ?? {}) as Record<string, unknown>;
  const kind = WORKOUT_KINDS.includes(o.kind as WorkoutKind) ? (o.kind as WorkoutKind) : null;
  if (!kind || !between(o.minutes, 1, 600)) return null;
  const km = between(o.km, 0, 300) ? (o.km as number) : 0;
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 60) : '';
  return { kind, name, minutes: Math.round(o.minutes as number), km: +km.toFixed(2) };
}

const CARDIO: Record<'run' | 'walk' | 'cycle', string> = { run: 'Run', walk: 'Walk', cycle: 'Ride' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The session record for a workout on `date`, with an estimated burn where we can make one. */
export function workoutLog(w: Workout, o: { date: string; plan: SessionPlan | null; kg: number; now: number }): SessionLog {
  const seconds = w.minutes * 60;
  const base = { date: o.date, done: 1, total: 1, seconds, createdAt: o.now };
  if ((w.kind === 'run' || w.kind === 'walk' || w.kind === 'cycle') && w.km > 0) {
    const kcal = distanceKcal(w.kind, w.km, seconds, o.kg);
    return { ...base, plan: 'RUN', title: CARDIO[w.kind], cardio: { km: w.km, seconds, kind: w.kind, ...(kcal ? { kcal } : {}) } };
  }
  if (w.kind !== 'session') {
    const m = searchMovements(w.name || CARDIO[w.kind as 'run'] || '', 1)[0];
    const name = m?.name ?? (w.name ? cap(w.name) : CARDIO[w.kind as 'run'] ?? 'Activity');
    return { ...base, plan: 'ACTIVITY', title: name, activity: { id: m?.id ?? 'other', name, minutes: w.minutes, kcal: m ? movementKcal(m.met, o.kg, w.minutes) : 0 } };
  }
  return { ...base, plan: o.plan?.key ?? 'PUSH', title: w.name ? cap(w.name) : (o.plan?.title ?? 'Session') };
}

/** The line shown in chat when REI logs it. */
export function workoutNote(log: SessionLog): string {
  const min = Math.round(log.seconds / 60);
  const km = log.cardio ? ` · ${log.cardio.km} KM` : '';
  const kcal = log.cardio?.kcal ?? log.activity?.kcal;
  return `WORKOUT LOGGED · ${(log.title ?? 'SESSION').toUpperCase()}${km} · ${min} MIN${kcal ? ` · ~${kcal} KCAL` : ''}`;
}
