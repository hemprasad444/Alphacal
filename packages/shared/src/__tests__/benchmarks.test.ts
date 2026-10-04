import { benchmarks, DEFAULT_BESTS } from '../benchmarks';
import type { SessionLog } from '../types';

const lift = (date: string, exercise: string, kg: number, reps: number[], done = reps.map(() => true)): SessionLog => ({
  date, plan: 'GYM', done: done.filter(Boolean).length, total: reps.length, seconds: 3000,
  sets: [{ exercise, reps, kg: reps.map(() => kg), done }],
});

const by = (rows: ReturnType<typeof benchmarks>, id: string) => rows.find(r => r.id === id)!;

describe('benchmarks', () => {
  it('starts from your starting bests with goals above them', () => {
    const rows = benchmarks([], DEFAULT_BESTS);
    expect(rows.map(r => r.id)).toEqual(['bench', 'squat', 'dead', 'pullups', 'run5k']);
    const bench = by(rows, 'bench');
    expect(bench.now).toBe('82.5 kg');
    expect(bench.goal).toBe('102.5 kg');
    expect(bench.logged).toBe(false);
    expect(by(rows, 'run5k').now).toBe('27:40');
  });

  it('moves bench from a logged chest press, using the estimated max of done sets only', () => {
    const rows = benchmarks([lift('2026-10-03', 'Machine chest press', 80, [8, 8, 6]), lift('2026-10-01', 'Bench press', 200, [5], [false])], DEFAULT_BESTS);
    const bench = by(rows, 'bench');
    expect(bench.logged).toBe(true);
    expect(bench.now).toBe('101.5 kg');
    expect(bench.from).toMatch(/Machine chest press/);
  });

  it('ignores squat variations that are not a back squat, and counts pull-up reps and 5K pace', () => {
    const rows = benchmarks([
      lift('2026-10-02', 'Bulgarian split squat', 60, [10]),
      lift('2026-10-02', 'Pull-ups', 0, [12]),
      { date: '2026-10-03', plan: 'RUN', done: 1, total: 1, seconds: 3000, cardio: { km: 10, seconds: 3000, kind: 'run' } },
    ], DEFAULT_BESTS);
    expect(by(rows, 'squat').logged).toBe(false);
    expect(by(rows, 'pullups').now).toBe('12 reps');
    expect(by(rows, 'run5k').now).toBe('25:00');
    expect(by(rows, 'run5k').logged).toBe(true);
  });
});

describe('next plan', () => {
  it('finds the next training day after a rest day, wrapping the week', () => {
    const { nextPlan, dayName } = jest.requireActual('../derive') as typeof import('../derive');
    const { SESSIONS } = jest.requireActual('../data') as typeof import('../data');
    const program = { week: '2026-W40', note: '', generatedAt: 0, days: [SESSIONS.PUSH, SESSIONS.LEGS, null, SESSIONS.PULL, SESSIONS.RUN, null, null] };
    const sunday = new Date(2026, 9, 4);
    expect(dayName(sunday)).toBe('Sunday');
    expect(nextPlan(sunday, program)).toEqual({ day: 'Monday', plan: SESSIONS.PUSH });
    expect(nextPlan(new Date(2026, 9, 1), program)?.day).toBe('Friday');
  });
});
