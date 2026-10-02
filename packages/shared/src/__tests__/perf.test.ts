// Speed budgets. Phones run these roughly 3–4× slower than CI machines, so each budget is
// set so the phone stays well inside a frame (16 ms) or a quick screen open (100 ms).
import { addDays, badges, catalog, DEFAULT_PROFILE, downsample, type Food, matchMealText, prTimeline, searchExercises, searchFoods, streaks, warmExerciseSearch, warmFoodSearch } from '..';
import type { SessionLog } from '../types';

// The shared package has no DOM or Node types; jest runs on Node, which has it.
declare const performance: { now(): number };

/** Median of `n` runs, in ms. */
function time(f: () => unknown, n = 15): number {
  f();
  const runs = Array.from({ length: n }, () => {
    const a = performance.now();
    f();
    return performance.now() - a;
  }).sort((a, b) => a - b);
  return runs[Math.floor(n / 2)];
}

// Shared CI runners are 4–5× slower than a laptop and noisy; give them 2× room. A real
// slowdown (the 10×+ kind a careless change causes) still fails.
declare const process: { env: Record<string, string | undefined> };
const ROOM = process.env.CI ? 2 : 1;

const BUDGET = {
  keystroke: 4 * ROOM, // per search, so ≤ ~16 ms on a phone
  submit: 10 * ROOM, // matching a whole typed meal, once, when "+" is pressed
  history: 10 * ROOM, // records, streaks, badges over a year or more
};

describe('speed budgets', () => {
  beforeAll(() => {
    warmFoodSearch();
    warmExerciseSearch();
  });

  it('searches food per keystroke within budget', () => {
    const cat = catalog();
    const mine: Food[] = Array.from({ length: 300 }, (_, i) => ({ id: `m:x${i}`, name: `My meal ${i} paneer rice`, per: 1, kcal: 400, p: 20, c: 40, f: 10, units: [{ n: 'serving', g: 1 }], src: 'mine', serving: true }));
    const foods = [...mine, ...cat];
    for (const q of ['p', 'pa', 'pan', 'paneer', 'chicken breast', 'dal', 'rice cooked'])
      expect({ q, ms: time(() => searchFoods(q, foods)) < BUDGET.keystroke }).toEqual({ q, ms: true });
    expect(time(() => matchMealText('2 rotis and a katori of dal, 200g chicken, curd', foods))).toBeLessThan(BUDGET.submit);
  });

  it('searches exercises per keystroke within budget', () => {
    for (const q of ['p', 'press', 'dumbbell shoulder']) expect(time(() => searchExercises(q))).toBeLessThan(BUDGET.keystroke);
  });

  const sessions: SessionLog[] = Array.from({ length: 500 }, (_, i) => ({
    date: addDays('2025-01-01', i), plan: i % 7 === 3 ? 'RUN' : 'PUSH', done: 20, total: 20, seconds: 3000, createdAt: i,
    sets: ['Bench press', 'Overhead press', 'Row', 'Squat', 'Curl', 'Dips'].map((e, k) => ({ exercise: e, reps: [6, 6, 6, 6], kg: [60 + k * 5 + i / 20, 60, 60, 60], done: [true, true, true, true] })),
  }));
  const days = Array.from({ length: 730 }, (_, i) => ({ date: addDays('2025-01-01', i), meals: 3, kcal: 2100, protein: 160, session: i % 2 === 0 }));

  it('works out records and badges over long histories within budget', () => {
    expect(time(() => prTimeline(sessions), 7)).toBeLessThan(BUDGET.history);
    expect(time(() => streaks(days, DEFAULT_PROFILE, '2026-12-31'), 7)).toBeLessThan(BUDGET.history);
    expect(time(() => badges({ days, sessions, weighIns: [], profile: DEFAULT_PROFILE }), 7)).toBeLessThan(BUDGET.history * 2);
  });

  it('thins chart series cheaply', () => {
    const v = Array.from({ length: 5000 }, (_, i) => Math.sin(i));
    expect(time(() => downsample(v))).toBeLessThan(1 * ROOM);
  });
});
