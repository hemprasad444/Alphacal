import { allBadges, game, newBadges, RANKS, rankFor, scoreDays, sessionXp, stats, type GameInput } from '../game';
import type { SessionLog } from '../types';

const base = (over: Partial<GameInput> = {}): GameInput => ({
  today: '2026-10-04',
  profile: { kcal: '2400', protein: '160', sessions: '4' },
  meals: [],
  sessionDone: false,
  pastDays: [],
  sessions: [],
  weighIns: [],
  photos: 0,
  memory: 0,
  ...over,
});

const day = (date: string, meals: number, kcal: number, protein: number, session = false) => ({ date, meals, kcal, protein, session });
const gym = (date: string, done = 18, total = 18, createdAt?: number): SessionLog => ({ date, plan: 'PUSH', done, total, seconds: 3000, createdAt });

describe('game', () => {
  it('starts at zero with nothing logged', () => {
    const g = game(base());
    expect(g.xp).toBe(0);
    expect(g.rank.id).toBe('rookie');
    expect(g.earned).toEqual([]);
    expect(g.locked).toHaveLength(allBadges(base()).length);
    expect(new Set(allBadges(base()).map(b => b.id)).size).toBe(allBadges(base()).length);
  });

  it('scores sessions by size', () => {
    expect(sessionXp(gym('2026-10-01'))).toBe(60);
    expect(sessionXp(gym('2026-10-01', 9, 18))).toBe(30);
    expect(sessionXp({ ...gym('2026-10-01'), cardio: { km: 5, seconds: 1800, kind: 'run' } })).toBe(60);
    expect(sessionXp({ ...gym('2026-10-01'), activity: { id: 'football', name: 'Football', minutes: 60, kcal: 500 } })).toBe(50);
    // Per exercise: 12 + 3 per done set; a set not done earns nothing.
    const sets = [{ exercise: 'Bench press', reps: [8, 8, 8], kg: [60, 60, 60], done: [true, true, false] }, { exercise: 'Dips', reps: [10, 10], kg: [null, null], done: [true, true] }];
    expect(sessionXp({ ...gym('2026-10-01'), sets })).toBe(18 + 18);
  });

  it('builds streaks and does not break them for a today not yet logged', () => {
    const pastDays = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map(d => day(d, 3, 2300, 165));
    const s = stats(base({ pastDays }));
    expect(s.streak).toBe(4);
    expect(s.bestStreak).toBe(4);
    expect(s.bestProteinStreak).toBe(4);
    expect(s.perfectDays).toBe(4);
  });

  it('breaks a streak on a missed day', () => {
    const pastDays = [day('2026-09-29', 2, 2000, 100), day('2026-09-30', 2, 2000, 100), day('2026-10-02', 2, 2000, 100), day('2026-10-03', 2, 2000, 100)];
    expect(stats(base({ pastDays })).streak).toBe(2);
    expect(stats(base({ pastDays })).bestStreak).toBe(2);
  });

  it('earns badges from the record, and keeps seen ones', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => gym(`2026-09-${String(20 + i).padStart(2, '0')}`, 18, 18, new Date(2026, 8, 20 + i, 7).getTime()));
    const g = game(base({ sessions, meals: [{ time: '08:00', name: 'Eggs', kcal: 300, p: 20, c: 2, f: 20 }] }));
    const ids = g.earned.map(b => b.id);
    expect(ids).toEqual(expect.arrayContaining(['sessions-1', 'sessions-10', 'five-in-seven', 'dawn-patrol', 'first-bowl']));
    expect(ids).not.toContain('sessions-50');
    expect(game(base(), ['sessions-50']).earned.map(b => b.id)).toEqual(['sessions-50']);
    expect(newBadges(g, ['sessions-1']).map(b => b.id)).not.toContain('sessions-1');
    expect(g.earned.every(b => b.icon && b.tier)).toBe(true);
  });

  it('climbs the ranks in order', () => {
    expect(RANKS.map(r => r.min)).toEqual([...RANKS.map(r => r.min)].sort((a, b) => a - b));
    expect(rankFor(0).rank.id).toBe('rookie');
    expect(rankFor(400).rank.id).toBe('trainee');
    expect(rankFor(600).progress).toBeCloseTo(0.25);
    expect(rankFor(99999).next).toBeNull();
  });

  it('counts this week only for the weekly score', () => {
    const pastDays = [day('2026-09-25', 3, 2400, 170), day('2026-09-29', 3, 2400, 170)];
    const g = game(base({ pastDays }));
    const week = scoreDays(base({ pastDays })).filter(d => d.date >= '2026-09-28').reduce((a, d) => a + d.xp, 0);
    expect(g.weekXp).toBe(week);
    expect(g.xp).toBeGreaterThan(g.weekXp);
  });
});

describe('badge dates', () => {
  const { game: g } = jest.requireActual('../game') as typeof import('../game');
  const meal = { time: '12:00', name: 'x', kcal: 500, p: 30, c: 50, f: 10 };
  const day = (date: string, meals = 1) => ({ date, meals, kcal: 500 * meals, protein: 30 * meals, session: false });
  it('dates a badge by the day it was reached, not today', () => {
    const x = { today: '2026-10-15', profile: { kcal: '2100', protein: '185', sessions: '4' }, meals: [meal], sessionDone: false,
      pastDays: [day('2026-10-04'), day('2026-10-05'), day('2026-10-06')], sessions: [], weighIns: [{ date: '2026-10-04', kg: 84 }, { date: '2026-10-05', kg: 83.6 }, { date: '2026-10-10', kg: 83.2 }, { date: '2026-10-12', kg: 82.9 }],
      photos: 0, memory: 10, memoryDates: ['2026-10-04', '2026-10-04', '2026-10-04', '2026-10-04', '2026-10-04', '2026-10-04', '2026-10-04', '2026-10-04', '2026-10-04', '2026-10-07'] };
    const by = (id: string) => g(x as never).earned.find(b => b.id === id)?.earned;
    expect(by('first-bowl')).toBe('2026-10-04');
    expect(by('mirror-check')).toBe('2026-10-12');
    expect(by('open-book')).toBe('2026-10-07');
  });
});
