import { ALIASES, alternatives, exerciseById, findExercise, library, searchExercises } from '../exercises';
import { clock, e1rm, liftHistory, newPrs, pace, parseClock, records, restSeconds, sessionVolume } from '../strength';
import { SESSIONS } from '../data';
import type { SessionLog } from '../types';

describe('exercise library', () => {
  it('loads every exercise with muscles', () => {
    expect(library().length).toBe(876);
    expect(library().filter(e => !e.primary.length)).toEqual([]);
  });

  it('resolves every alias', () => {
    expect(Object.entries(ALIASES).filter(([, id]) => !exerciseById(id)).map(([k]) => k)).toEqual([]);
  });

  it('finds every exercise in the built-in plans', () => {
    const names = Object.values(SESSIONS).flatMap(s => s.exercises.map(e => e.name));
    const missing = names.filter(n => !findExercise(n) && !['L-sit', 'Cool-down'].includes(n));
    expect(missing).toEqual([]);
    expect(findExercise('Bench press')?.id).toBe('Barbell_Bench_Press_-_Medium_Grip');
    expect(findExercise('Weighted pull-ups')?.id).toBe('Pullups');
    expect(findExercise('Incline DB press')?.id).toBe('Incline_Dumbbell_Press');
  });

  it('searches by words in any order', () => {
    expect(searchExercises('press dumbbell shoulder', 3).map(e => e.id)).toContain('Dumbbell_Shoulder_Press');
    expect(searchExercises('zzzz')).toEqual([]);
  });

  it('suggests swaps for the same main muscle', () => {
    const bench = exerciseById('Barbell_Bench_Press_-_Medium_Grip')!;
    const alts = alternatives(bench);
    expect(alts.length).toBe(12);
    expect(alts.every(a => a.primary[0] === 'chest' && a.category !== 'stretching')).toBe(true);
    expect(alts.map(a => a.id)).not.toContain(bench.id);
  });
});

const log = (date: string, sets: SessionLog['sets'], extra: Partial<SessionLog> = {}): SessionLog => ({ date, plan: 'PUSH', done: 1, total: 1, seconds: 3000, sets, ...extra });
const bench = (kg: number, reps: number[], done = reps.map(() => true)) => ({ exercise: 'Bench press', reps, kg: reps.map(() => kg), done });

describe('e1rm', () => {
  it('uses the Epley formula, and skips bodyweight and very high reps', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(85, 5)).toBe(99.2);
    expect(e1rm(null, 10)).toBeNull();
    expect(e1rm(40, 20)).toBeNull();
  });
});

describe('records and PRs', () => {
  const history = [log('2026-09-21', [bench(80, [6, 6, 5])]), log('2026-09-28', [bench(82.5, [6, 6, 6]), { exercise: 'Dips', reps: [10, 9], kg: [null, null], done: [true, true] }])];

  it('keeps the best set per lift', () => {
    const r = records(history);
    expect(r['bench press']).toMatchObject({ sessions: 2, best: { kg: 82.5, reps: 6, date: '2026-09-28' }, heaviest: { kg: 82.5 } });
    expect(r['dips'].best).toMatchObject({ kg: null, reps: 10, e1rm: null });
  });

  it('ignores sets that were not done', () => {
    expect(records([log('2026-09-21', [bench(120, [5], [false])])])).toEqual({});
  });

  it('spots a new estimated max, heaviest weight and rep records', () => {
    const today = log('2026-10-02', [bench(85, [5, 5]), { exercise: 'Dips', reps: [12], kg: [null], done: [true] }]);
    expect(newPrs(today, history).map(p => p.text)).toEqual(['Bench press 85 × 5, est. max 99.2 kg, up 0.2', 'Dips 12 reps (was 10)']);
  });

  it('does not call a first session a record, or count runs', () => {
    expect(newPrs(log('2026-10-02', [{ exercise: 'Squat', reps: [5], kg: [120], done: [true] }]), history)).toEqual([]);
    expect(newPrs(log('2026-10-02', [bench(100, [5])], { plan: 'RUN' }), history)).toEqual([]);
  });

  it('builds a lift history and volume', () => {
    expect(liftHistory(history, 'bench PRESS').map(p => [p.date, p.e1rm, p.sets])).toEqual([['2026-09-21', 96, '80×6 80×6 80×5'], ['2026-09-28', 99, '82.5×6 82.5×6 82.5×6']]);
    expect(sessionVolume(history[1])).toBe(1485);
  });
});

describe('time and pace', () => {
  it('formats and parses clocks', () => {
    expect(clock(2530)).toBe('42:10');
    expect(clock(3930)).toBe('1:05:30');
    expect(parseClock('42:10')).toBe(2530);
    expect(parseClock('1:05:30')).toBe(3930);
    expect(parseClock('abc')).toBeNull();
  });

  it('gives pace per km', () => {
    expect(pace(5, 27 * 60 + 40)).toBe('5:32 / km');
    expect(pace(0, 100)).toBe('');
  });

  it('rests longer after heavy sets', () => {
    expect(restSeconds(5, 100)).toBe(180);
    expect(restSeconds(12, 20)).toBe(90);
    expect(restSeconds(15, null)).toBe(60);
  });
});
