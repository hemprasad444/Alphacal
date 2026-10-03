import { DEFAULT_VOICE } from './voices';
import type { Activity, Exercise, Meal, Message, Profile, Scenario, Settings, WeighIn } from './types';
import { isoDate } from './time';

export type SessionKey = 'PUSH' | 'RUN' | 'PULL' | 'REST' | 'LEGS' | 'CALI';

export interface SessionPlan {
  key: SessionKey;
  title: string;
  jp: string;
  sub: string;
  minutes: number;
  why: { strong: string; slipping: string };
  exercises: Exercise[];
}

export const SESSIONS: Record<Exclude<SessionKey, 'REST'>, SessionPlan> = {
  PUSH: {
    key: 'PUSH', title: 'Push', jp: '押', sub: 'Chest · Shoulders · Triceps · 52 min, 6 lifts', minutes: 52,
    why: {
      strong: 'Bench moved 2.5 kg last week. Go for 85 × 5 on the top set.',
      slipping: 'Bench is your slowest lift toward 100 kg. Skip push again and it stalls another week.',
    },
    exercises: [
      { name: 'Bench press', target: '4 × 6 · 82.5 kg', last: 'LAST · 80 × 6 6 5 5', reps: [6, 6, 6, 6] },
      { name: 'Overhead press', target: '3 × 8 · 50 kg', last: 'LAST · 47.5 × 8 8 7', reps: [8, 8, 8] },
      { name: 'Incline DB press', target: '3 × 10 · 28 kg', last: 'LAST · 26 × 10 10 9', reps: [10, 10, 10] },
      { name: 'Weighted dips', target: '3 × 8 · +15 kg', last: 'LAST · +12.5 × 8 8 8', reps: [8, 8, 8] },
      { name: 'Lateral raise', target: '3 × 15 · 10 kg', last: 'LAST · 10 × 15 14 12', reps: [15, 15, 15] },
      { name: 'Rope pushdown', target: '3 × 12 · 25 kg', last: 'LAST · 22.5 × 12 12 12', reps: [12, 12, 12] },
    ],
  },
  PULL: {
    key: 'PULL', title: 'Pull', jp: '引', sub: 'Back · Biceps · Rear delts · 50 min, 5 lifts', minutes: 50,
    why: {
      strong: 'Pull-ups went 8 to 9 last month. Add a rep on the first set.',
      slipping: 'Fifteen pull-ups needs volume you keep skipping. This is where it comes from.',
    },
    exercises: [
      { name: 'Weighted pull-ups', target: '4 × 5 · +10 kg', last: 'LAST · +7.5 × 5 5 5 4', reps: [5, 5, 5, 5] },
      { name: 'Barbell row', target: '3 × 8 · 75 kg', last: 'LAST · 72.5 × 8 8 7', reps: [8, 8, 8] },
      { name: 'Lat pulldown', target: '3 × 10 · 60 kg', last: 'LAST · 57.5 × 10 10 9', reps: [10, 10, 10] },
      { name: 'Face pull', target: '3 × 15 · 20 kg', last: 'LAST · 20 × 15 15 13', reps: [15, 15, 15] },
      { name: 'Incline curl', target: '3 × 12 · 12 kg', last: 'LAST · 12 × 12 11 10', reps: [12, 12, 12] },
    ],
  },
  LEGS: {
    key: 'LEGS', title: 'Legs', jp: '脚', sub: 'Quads · Hamstrings · Glutes · 55 min, 5 lifts', minutes: 55,
    why: {
      strong: 'Squat is 20 kg from 140. Two clean top sets today.',
      slipping: 'Legs is the day you used to skip. That habit ends this week.',
    },
    exercises: [
      { name: 'Back squat', target: '4 × 5 · 120 kg', last: 'LAST · 117.5 × 5 5 5 4', reps: [5, 5, 5, 5] },
      { name: 'Romanian deadlift', target: '3 × 8 · 110 kg', last: 'LAST · 105 × 8 8 8', reps: [8, 8, 8] },
      { name: 'Bulgarian split squat', target: '3 × 10 · 20 kg', last: 'LAST · 18 × 10 10 9', reps: [10, 10, 10] },
      { name: 'Leg curl', target: '3 × 12 · 45 kg', last: 'LAST · 42.5 × 12 12 11', reps: [12, 12, 12] },
      { name: 'Standing calf raise', target: '3 × 15 · 80 kg', last: 'LAST · 80 × 15 15 14', reps: [15, 15, 15] },
    ],
  },
  RUN: {
    key: 'RUN', title: 'Run', jp: '走', sub: 'Intervals · 6 km total · 40 min', minutes: 40,
    why: {
      strong: '5K is at 27:40. Intervals at 4:45 per km pull it toward 24:00.',
      slipping: 'Sub-24 does not happen without speed work. This is the session that moves it.',
    },
    exercises: [
      { name: 'Warm-up jog', target: '1 km · easy', last: 'LAST · 6:10 / km', reps: [1] },
      { name: 'Intervals', target: '4 × 1 km · 4:45 / km', last: 'LAST · 4:52 4:50 4:58 5:02', reps: [1, 1, 1, 1] },
      { name: 'Cool-down', target: '1 km · easy', last: 'LAST · 6:20 / km', reps: [1] },
    ],
  },
  CALI: {
    key: 'CALI', title: 'Calisthenics', jp: '体', sub: 'Skills · Core · Bodyweight · 45 min, 5 moves', minutes: 45,
    why: {
      strong: 'Skill work while fresh. Hold quality, not just reps.',
      slipping: 'Bodyweight days are the easiest to skip and the easiest to do. No excuse fits here.',
    },
    exercises: [
      { name: 'Pull-ups', target: '4 × max · strict', last: 'LAST · 9 8 7 6', reps: [9, 8, 7, 6] },
      { name: 'Dips', target: '3 × 12', last: 'LAST · 12 12 10', reps: [12, 12, 12] },
      { name: 'Pistol squat', target: '3 × 6 / leg', last: 'LAST · 5 5 4', reps: [6, 6, 6] },
      { name: 'Hanging leg raise', target: '3 × 12', last: 'LAST · 12 10 9', reps: [12, 12, 12] },
      { name: 'L-sit', target: '3 × 20 s', last: 'LAST · 18 15 14 s', reps: [20, 20, 20] },
    ],
  },
};

/** A week written by REI: one plan per day, Monday first; null is a rest day. */
export interface WeekProgram {
  /** ISO week, e.g. 2026-W40. */
  week: string;
  /** REI's one-line intent for the week. */
  note: string;
  days: (SessionPlan | null)[];
  generatedAt: number;
}

/** Weekly split, Monday first. */
export const WEEK_PLAN: SessionKey[] = ['PUSH', 'RUN', 'PULL', 'REST', 'PUSH', 'LEGS', 'CALI'];
export const SESSION_TIME = '18:30';

/** Weigh-ins before today's, oldest first. */
export const WEIGHT_HISTORY = [86.0, 85.4, 85.1, 84.3, 84.0, 83.6, 83.1, 82.7, 82.2, 81.9, 81.4];

export const DEFAULT_PROFILE: Profile = {
  goal: 'Get lean to 74 kg with visible abs, bench 100 kg, and run a sub-24 5K by March 1st.',
  deadline: '2027-03-01',
  weight: '81.6',
  targetWeight: '74',
  bf: '19',
  targetBf: '12',
  height: '178',
  age: '26',
  kcal: '2300',
  protein: '170',
  carbs: '230',
  fat: '70',
  steps: '10000',
  sleep: '7.5',
  sessions: '5',
};

export const DEFAULT_DISCIPLINES: Record<string, boolean> = {
  Hypertrophy: true,
  Strength: true,
  Calisthenics: true,
  Running: true,
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'zero',
  accent: null,
  font: 'Geist',
  textSize: 1,
  hud: true,
  fx: true,
  speak: true,
  voice: DEFAULT_VOICE,
  nudge: true,
  tone: 'Tough love',
  avatar: 'Character in chat',
  scenario: 'Slipping week',
  bgStrength: 'Medium',
  emblemSize: 'M',
  emblemPos: 'Center',
  bgByTheme: {},
};

export const BENCHMARKS: [string, string, string, number][] = [
  ['Bench press', '82.5', '100 kg', 82.5 / 100],
  ['Back squat', '120', '140 kg', 120 / 140],
  ['Deadlift', '150', '180 kg', 150 / 180],
  ['Pull-ups', '9', '15 reps', 9 / 15],
  ['5K run', '27:40', '24:00', 0.62],
];

/** Demo conversation and meals for each scenario, until real tracking sources exist. */
export function seedFor(scenario: Scenario): { messages: Message[]; meals: Meal[] } {
  if (scenario === 'Strong week') {
    return {
      messages: [
        { role: 'rei', time: '07:04', text: '7h 40m of sleep. Good. Recovery is training too.' },
        { role: 'rei', time: '08:10', text: 'Yesterday: 21 sets, every rep logged. That was strong.' },
        { role: 'user', time: '12:30', text: 'Feeling good today honestly.' },
        { role: 'rei', time: '12:31', text: "Good. Don't let good make you casual. Push at 18:30. Top set 85 × 5." },
        { role: 'rei', time: '17:45', text: 'Protein 148 of 170. One more meal and today is clean.' },
      ],
      meals: [
        { time: '07:30', name: 'Eggs, oats & berries', kcal: 560, p: 38, c: 62, f: 18 },
        { time: '12:30', name: 'Chicken, rice & greens', kcal: 720, p: 62, c: 80, f: 14 },
        { time: '16:00', name: 'Whey + banana', kcal: 290, p: 30, c: 38, f: 3 },
        { time: '17:45', name: 'Greek yogurt & honey', kcal: 390, p: 18, c: 40, f: 12 },
      ],
    };
  }
  return {
    messages: [
      { role: 'rei', time: '07:04', text: '6h 05m of sleep. Not great. Not an excuse either.' },
      { role: 'rei', time: '12:40', alert: true, text: "Tuesday's run: skipped. Wednesday's pull: skipped. That's two this week. I'm not letting it become three." },
      { role: 'user', time: '12:52', text: "Work has been insane. I'll make it up on the weekend." },
      { role: 'rei', time: '12:53', alert: true, text: "You said that last Friday too. The weekend doesn't need two sessions. Tonight needs one. Push at 18:30. I already cut it to 52 minutes." },
      { role: 'rei', time: '17:45', text: 'Calories at 1,840 of 2,300. Protein 92 of 170. Next meal is protein first: chicken or Greek yogurt, not the vending machine.' },
    ],
    meals: [
      { time: '07:40', name: 'Oat latte + croissant', kcal: 510, p: 14, c: 58, f: 24 },
      { time: '12:20', name: 'Chicken wrap + crisps', kcal: 820, p: 46, c: 82, f: 34 },
      { time: '16:05', name: 'Yogurt granola bowl', kcal: 510, p: 32, c: 60, f: 14 },
    ],
  };
}

/** Demo weigh-ins: WEIGHT_HISTORY spread one week apart, ending a week before `now`. */
export function demoWeighIns(now: Date = new Date()): WeighIn[] {
  return WEIGHT_HISTORY.map((kg, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * (WEIGHT_HISTORY.length - i));
    return { date: isoDate(d), kg };
  });
}

/** Today's activity from a stored day. */
export function activityFromDay(steps: number | null | undefined, sleepMin: number | null | undefined): Activity {
  const sleep = sleepMin == null ? null : sleepMin / 60;
  return {
    steps: steps ?? null,
    sleep,
    sleepL: sleepMin == null ? '\u2014' : `${Math.floor(sleepMin / 60)}h ${String(Math.round(sleepMin % 60)).padStart(2, '0')}m`,
  };
}

/** Steps and sleep per demo scenario. */
export function activityFor(scenario: Scenario, sessionDone: boolean): Activity {
  return scenario === 'Strong week'
    ? { steps: sessionDone ? 11240 : 9120, sleep: 7 + 40 / 60, sleepL: '7h 40m' }
    : { steps: sessionDone ? 7840 : 4212, sleep: 6 + 5 / 60, sleepL: '6h 05m' };
}
