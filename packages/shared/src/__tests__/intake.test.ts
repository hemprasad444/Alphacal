import { dayIntake } from '../intake';
import { dailyTargets } from '../nutrients';
import type { Meal } from '../types';

const meal = (name: string, kcal: number, p: number, n?: Meal['n']): Meal => ({ time: '12:00', name, kcal, p, c: 10, f: 5, ...(n ? { n } : {}) });

describe('day intake', () => {
  it('totals macros and nutrients, finds the top meal and how much of the day is covered', () => {
    const d = dayIntake([meal('Dal rice', 500, 18, { fib: 9, fe: 3 }), meal('Chicken wrap', 700, 46, { fib: 4 }), meal('Mystery bar', 300, 10)]);
    expect(d.totals.p).toBe(74);
    expect(d.totals.fib).toBe(13);
    expect(d.top.p).toBe(1);
    expect(d.top.fib).toBe(0);
    expect(d.top.zn).toBe(-1);
    expect(d.coverage.fib).toBeCloseTo(1200 / 1500);
    expect(d.coverage.fe).toBeCloseTo(500 / 1500);
  });

  it('sets targets by calories and sex', () => {
    expect(dailyTargets({ kcal: 2400, sex: 'Male' }).fib).toBe(34);
    expect(dailyTargets({ kcal: 2400, sex: 'Female' }).fe).toBe(29);
    expect(dailyTargets({ kcal: 2000 }).sug).toBe(50);
  });
});
