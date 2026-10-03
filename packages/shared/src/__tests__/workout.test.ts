import { isClock, vowChange } from '../agent';
import { nudgeDue, quietHours, type CoachState } from '../coach';
import { DEFAULT_PROFILE, SESSIONS } from '../data';
import { week } from '../derive';
import { systemRules } from '../rei';
import { parseWorkout, workoutLog, workoutNote } from '../workout';

const at = { date: '2026-10-03', plan: SESSIONS.LEGS, kg: 80, now: 1 };

describe('workouts REI logs', () => {
  it('checks what the model sent', () => {
    expect(parseWorkout({ kind: 'run', name: '5k', minutes: 28, km: 5 })).toEqual({ kind: 'run', name: '5k', minutes: 28, km: 5 });
    expect(parseWorkout({ kind: 'run', name: 'x', minutes: 0, km: 5 })).toBeNull();
    expect(parseWorkout({ kind: 'nap', name: 'x', minutes: 20, km: 0 })).toBeNull();
    expect(parseWorkout({ kind: 'activity', name: 'x', minutes: 20, km: -3 })?.km).toBe(0);
  });

  it('records a run with distance like the app does, with a burn', () => {
    const log = workoutLog({ kind: 'run', name: '5k', minutes: 28, km: 5 }, at);
    expect(log).toMatchObject({ plan: 'RUN', title: 'Run', seconds: 1680, cardio: { km: 5, kind: 'run' } });
    expect(log.cardio?.kcal).toBeGreaterThan(0);
    expect(workoutNote(log)).toMatch(/^WORKOUT LOGGED · RUN · 5 KM · 28 MIN · ~\d+ KCAL$/);
  });

  it('matches a sport to the activity list', () => {
    const log = workoutLog({ kind: 'activity', name: 'football', minutes: 60, km: 0 }, at);
    expect(log.plan).toBe('ACTIVITY');
    expect(log.activity?.kcal).toBeGreaterThan(0);
  });

  it('records a gym session under today’s plan', () => {
    expect(workoutLog({ kind: 'session', name: 'leg day', minutes: 45, km: 0 }, at)).toMatchObject({ plan: 'LEGS', title: 'Leg day', seconds: 2700, done: 1, total: 1 });
    expect(workoutLog({ kind: 'session', name: '', minutes: 45, km: 0 }, at).title).toBe(SESSIONS.LEGS.title);
  });

  it('tells the chat model to log workouts', () => {
    expect(systemRules({ tough: true, nudge: true, tools: true })).toContain('call log_workout');
  });
});

describe('your own training time and bedtime', () => {
  const base = (over: Partial<CoachState> = {}): CoachState => ({
    plan: SESSIONS.PUSH,
    sessionDone: false,
    nutrition: { kcal: 1500, protein: 150, carbs: 150, fat: 50, steps: null, sleep: null, sleepL: '—' },
    profile: DEFAULT_PROFILE,
    week: week({ kind: 'demo', scenario: 'Strong week' }, false, new Date(2026, 9, 2)),
    sent: [],
    ...over,
  });
  const t = (h: number, m = 0) => new Date(2026, 9, 2, h, m);

  it('only accepts real clock times', () => {
    expect(isClock('07:00') && isClock('7:30') && isClock('23:59')).toBe(true);
    expect(isClock('24:00') || isClock('7pm') || isClock('07:60')).toBe(false);
    expect(vowChange('sessionTime', '06:30')).toEqual(['sessionTime', '06:30']);
    expect(vowChange('bedtime', 'late')).toBeNull();
  });

  it('calls a morning session late in the morning, not at 18:30', () => {
    const early = base({ profile: { ...DEFAULT_PROFILE, sessionTime: '07:00' } });
    expect(nudgeDue(early, t(7, 15))).toBeNull();
    expect(nudgeDue(early, t(7, 30))?.fact).toContain('due at 07:00');
    expect(nudgeDue(base(), t(7, 30))).toBeNull();
  });

  it('nudges at their bedtime and goes quiet after, even past midnight', () => {
    const owl = base({ sessionDone: true, profile: { ...DEFAULT_PROFILE, bedtime: '00:30', sleep: '8' } });
    expect(quietHours(owl.profile)).toEqual({ from: 60, to: 510 });
    expect(nudgeDue(owl, t(0, 40))?.fact).toContain('00:30');
    expect(nudgeDue({ ...owl, nutrition: { ...owl.nutrition, kcal: 9000 } }, t(3))).toBeNull();
    expect(nudgeDue({ ...owl, nutrition: { ...owl.nutrition, kcal: 9000 } }, t(23, 45))?.id).toBe('over-kcal');
  });

  it('falls back to 18:30 and 23:00 when a saved time is broken', () => {
    const broken = base({ profile: { ...DEFAULT_PROFILE, sessionTime: 'soon', bedtime: '' } });
    expect(nudgeDue(broken, t(19))?.fact).toContain('due at 18:30');
    expect(quietHours(broken.profile).from).toBe(23 * 60 + 30);
  });
});
