import { DEFAULT_PROFILE } from '../data';
import { addDays, badges, daySummary, fallbackReport, measureChanges, mondayOf, normalizeReport, statsLines, streaks, weekStats, type DaySummary } from '../progress';
import type { SessionLog } from '../types';

const profile = { ...DEFAULT_PROFILE, protein: '170', kcal: '2300', sessions: '4' };
const day = (date: string, o: Partial<DaySummary> = {}): DaySummary => ({ date, meals: 3, kcal: 2100, protein: 160, session: false, ...o });
const range = (from: string, n: number, f: (d: string, i: number) => Partial<DaySummary> = () => ({})) => Array.from({ length: n }, (_, i) => day(addDays(from, i), f(addDays(from, i), i)));

it('works with dates', () => {
  expect(addDays('2026-09-30', 2)).toBe('2026-10-02');
  expect(mondayOf('2026-10-04')).toBe('2026-09-28');
  expect(daySummary('2026-10-02', { meals: [{ time: '', name: 'x', kcal: 500, p: 40, c: 1, f: 1 }], sessionDone: true })).toEqual({ date: '2026-10-02', meals: 1, kcal: 500, protein: 40, session: true });
});

describe('streaks', () => {
  it('counts days logged and protein hit, without today breaking the run yet', () => {
    const days = [...range('2026-09-20', 5, () => ({ protein: 100 })), ...range('2026-09-26', 6)];
    const s = streaks(days, profile, '2026-10-02'); // today (2 Oct) not logged yet
    expect(s.logging).toEqual({ current: 6, best: 6 });
    expect(s.protein).toEqual({ current: 6, best: 6 });
  });

  it('counts weeks on the session target', () => {
    // Two full weeks with 4 sessions, then this week with 2 so far.
    const days = range('2026-09-14', 19, (_, i) => ({ session: i < 14 ? i % 7 < 4 : i % 7 < 2 }));
    expect(streaks(days, profile, '2026-10-02').weeks).toEqual({ current: 2, best: 2 });
  });
});

describe('badges', () => {
  const s = (date: string, kg: number, extra: Partial<SessionLog> = {}): SessionLog => ({ date, plan: 'PUSH', done: 3, total: 3, seconds: 3000, sets: [{ exercise: 'Bench press', reps: [5], kg: [kg], done: [true] }], ...extra });

  it('awards what was reached, with the date, and progress for the rest', () => {
    const b = badges({
      days: range('2026-09-21', 8, (_, i) => ({ session: i < 4 })),
      sessions: [s('2026-09-20', 80), s('2026-09-22', 82.5), s('2026-09-24', 85), { ...s('2026-09-26', 0), sets: [], plan: 'RUN', cardio: { km: 5.2, seconds: 1700, kind: 'run' } }],
      weighIns: [{ date: '2026-09-01', kg: 84 }, { date: '2026-09-28', kg: 82.8 }],
      profile,
    });
    const get = (id: string) => b.find(x => x.id === id)!;
    expect(get('sessions-1').earned).toBe('2026-09-20');
    expect(get('sessions-10')).toMatchObject({ earned: null, progress: 0.4 });
    expect(get('pr-1').earned).toBe('2026-09-22');
    expect(get('log-7').earned).toBe('2026-09-27');
    expect(get('perfect-week').earned).toBe('2026-09-24');
    expect(get('run-5k').earned).toBe('2026-09-26');
    expect(get('run-10k').progress).toBeCloseTo(0.52);
    expect(get('down-1').earned).toBe('2026-09-28');
    expect(get('down-5').earned).toBeNull();
  });
});

it('tracks measurement changes', () => {
  expect(measureChanges([{ date: '2026-09-01', waist: 90, arms: 36 }, { date: '2026-10-01', waist: 87.5 }])).toEqual([
    { measure: 'waist', first: 90, latest: 87.5, change: -2.5, points: [{ date: '2026-09-01', v: 90 }, { date: '2026-10-01', v: 87.5 }] },
    { measure: 'arms', first: 36, latest: 36, change: 0, points: [{ date: '2026-09-01', v: 36 }] },
  ]);
});

describe('weekly report', () => {
  const meal = (kcal: number, p: number) => ({ time: '', name: 'x', kcal, p, c: 0, f: 0 });
  const stats = weekStats({
    week: '2026-W40', monday: '2026-09-28', upTo: '2026-10-04',
    days: {
      '2026-09-28': { meals: [meal(2200, 165)], sessionDone: true, steps: 9000 },
      '2026-09-29': { meals: [meal(2600, 120)], sessionDone: false, steps: 7000 },
      '2026-09-30': { meals: [meal(2100, 170)], sessionDone: true },
      '2026-10-02': { meals: [meal(2000, 160)], sessionDone: true, sleepMin: 420 },
    },
    sessions: [
      { date: '2026-09-21', plan: 'PUSH', done: 1, total: 1, seconds: 1, sets: [{ exercise: 'Bench press', reps: [5], kg: [80], done: [true] }] },
      { date: '2026-09-28', plan: 'PUSH', done: 1, total: 1, seconds: 1, sets: [{ exercise: 'Bench press', reps: [5], kg: [85], done: [true] }] },
      { date: '2026-09-30', plan: 'RUN', done: 1, total: 1, seconds: 1650, cardio: { km: 5, seconds: 1650, kind: 'run' } },
    ],
    weighIns: [{ date: '2026-09-25', kg: 82.4 }, { date: '2026-10-03', kg: 81.9 }],
    profile, program: null,
  });

  it('adds up the week', () => {
    expect(stats).toMatchObject({
      from: '2026-09-28', to: '2026-10-04',
      sessions: { done: 3, planned: 6, target: 4 },
      food: { daysLogged: 4, avgKcal: 2225, avgProtein: 154, proteinDays: 3, overDays: 1 },
      steps: 8000, sleepH: 7,
      weight: { start: 82.4, end: 81.9, change: -0.5 },
      runs: { count: 1, km: 5, best: '5 km at 5:30 / km' },
    });
    expect(stats.prs).toEqual(['Bench press 85 × 5, est. max 99.2 kg, up 5.9']);
    expect(statsLines(stats)).toContain('Sessions: 3 done of 6 planned so far');
  });

  it('writes a plain report without REI', () => {
    const r = fallbackReport(stats);
    expect(r.headline).toBe('3 of 6 sessions, 1 PR');
    expect(r.fix).toBe('3 planned sessions missed.');
    expect(r.wins).toContain('Down 0.5 kg.');
  });

  it('cleans REI’s report and rejects empty ones', () => {
    expect(normalizeReport({ headline: 'Solid — mostly', summary: 'Good.', wins: ['a', 2, ''], fix: 'x', focus: 'y' })).toEqual({ headline: 'Solid. mostly', summary: 'Good.', wins: ['a'], fix: 'x', focus: 'y' });
    expect(normalizeReport({ headline: '', summary: 'x' })).toBeNull();
  });
});
