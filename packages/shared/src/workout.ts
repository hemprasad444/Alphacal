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

// ---- How long it took: only ever what they said ---------------------------------

const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const HOUR = String.raw`(?:h|hr|hrs|hours?|ghant[ae]|ganta\w*)`;
const MINUTE = String.raw`(?:min|mins|minutes?|minat|nimish\w*)`;
const WORD_HOURS: Record<string, number> = { a: 1, an: 1, one: 1, ek: 1, two: 2, three: 3, teen: 3, couple: 2, half: 0.5, aadha: 0.5, adha: 0.5, dedh: 1.5, dhai: 2.5 };
/** Hindi, Telugu, Tamil and Kannada words for minutes and hours, in their own scripts. */
const OTHER_SCRIPT = /मिनट|घंट|నిమిష|గంట|நிமிட|மணி|ನಿಮಿಷ|ಗಂಟೆ/;

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SPELLED = new RegExp(String.raw`\b(?:(${TENS.join('|')})(?:[- ](${UNITS.slice(1, 10).join('|')}))?|(${UNITS.slice(2).join('|')}))\b`, 'g');

/** "forty five minutes" → "45 minutes": speech-to-text doesn't always write digits. "one" stays a word ("one more"). */
function spelledNumbers(s: string): string {
  return s.replace(SPELLED, (_, tens: string | undefined, unit: string | undefined, small: string | undefined) =>
    String(tens ? (TENS.indexOf(tens) + 2) * 10 + (unit ? UNITS.indexOf(unit) : 0) : UNITS.indexOf(small!)));
}

/**
 * The durations someone gave, in minutes: "40 min", "1.5 hrs", "an hour", "half an hour", "an hour and
 * a half", "1h 20m", "28:30" (a run's time), "ek ghanta". `said` is also true for a duration we can't
 * turn into a number (one written in another script). A distance ("5k") is not a duration.
 */
export function durationSaid(message: string): { said: boolean; minutes: number[] } {
  let rest = spelledNumbers(message.toLowerCase().replace(/[’']/g, ''));
  const minutes: number[] = [];
  const take = (re: RegExp, toMin: (m: string[]) => number) => {
    rest = rest.replace(new RegExp(re.source, 'g'), (...args) => {
      const v = toMin(args.slice(0, -2) as string[]);
      if (v > 0) minutes.push(v);
      return ' ';
    });
  };
  // Longest forms first, so "1 hour 20 minutes" is one duration, not two.
  take(new RegExp(String.raw`\b${NUMBER}\s*${HOUR}\s*(?:and\s*)?${NUMBER}\s*(?:m|${MINUTE})\b`), m => +m[1] * 60 + +m[2]);
  take(/\b(?:(?:an?|one) )?hour and a half\b/, () => 90);
  take(/\b(\d+) and a half hours?\b/, m => +m[1] * 60 + 30);
  take(/\bhalf(?: an| a)?[- ]hour\b/, () => 30);
  take(/\bquarter of an hour\b/, () => 15);
  take(new RegExp(String.raw`\b${NUMBER}\s*-?\s*${HOUR}\b`), m => +m[1] * 60);
  take(new RegExp(String.raw`\b${NUMBER}\s*-?\s*${MINUTE}\b`), m => +m[1]);
  take(new RegExp(String.raw`\b(${Object.keys(WORD_HOURS).join('|')})\s+(?:of\s+)?${HOUR}\b`), m => WORD_HOURS[m[1]] * 60);
  // "5k in 28:30": minutes and seconds. Only after "in": "at 6:30" is a time of day.
  take(/\bin (\d{1,3}):([0-5]\d)\b/, m => +m[1] + +m[2] / 60);
  return { said: minutes.length > 0 || OTHER_SCRIPT.test(message), minutes };
}

/**
 * A workout REI wants to log, held to what they actually said. No duration in their message: it isn't
 * logged and REI asks (a call once logged "a long walk" as 60 minutes it made up). Exactly one
 * duration: that is the one stored, whatever the model wrote.
 */
export function groundWorkout(w: Workout, message: string): { workout: Workout } | { ask: string } {
  const d = durationSaid(message);
  const cardio = w.kind === 'run' || w.kind === 'walk' || w.kind === 'cycle';
  if (!d.said) return { ask: `Not logged: they didn't say how long the ${w.name || w.kind} was. Don't guess a duration: ask how long it took${cardio ? ' (and how far, if they know)' : ''}, then log it with their answer.` };
  const only = d.minutes.length === 1 ? Math.round(d.minutes[0]) : 0;
  return { workout: only >= 1 && only <= 600 ? { ...w, minutes: only } : w };
}
