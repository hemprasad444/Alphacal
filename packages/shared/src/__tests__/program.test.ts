import { DEFAULT_PROFILE } from '../data';
import { todaysPlan, week } from '../derive';
import { lastLifts, normalizeProgram, programPrompt } from '../program';
import { isoWeek } from '../time';

const day = (key: string, exercises = [{ name: 'Bench press', sets: 4, reps: 6, load: '85 kg' }]) => ({ rest: false, key, title: key, sub: 'x', minutes: 50, why: 'Because.', exercises });
const rest = { rest: true, key: 'PUSH', title: '', sub: '', minutes: 0, why: '', exercises: [] };
const raw = { note: 'Heavy week.', days: [day('PUSH'), rest, day('PULL'), rest, day('LEGS'), day('RUN', [{ name: 'Intervals', sets: 5, reps: 1, load: '4:40 / km' }]), rest] };

describe('isoWeek', () => {
  it('numbers weeks per ISO 8601', () => {
    expect(isoWeek(new Date(2026, 9, 2))).toBe('2026-W40');
    expect(isoWeek(new Date(2027, 0, 1))).toBe('2026-W53');
    expect(isoWeek(new Date(2026, 0, 1))).toBe('2026-W01');
  });
});

describe('normalizeProgram', () => {
  it('builds seven days with rest days as null', () => {
    const p = normalizeProgram(raw, '2026-W40', [], 1)!;
    expect(p.days.map(d => d?.key ?? 'REST')).toEqual(['PUSH', 'REST', 'PULL', 'REST', 'LEGS', 'RUN', 'REST']);
    expect(p.days[0]!.exercises[0]).toEqual({ name: 'Bench press', target: '4 × 6 · 85 kg', last: '', reps: [6, 6, 6, 6] });
    expect(p.note).toBe('Heavy week.');
  });

  it('rejects anything but seven days', () => {
    expect(normalizeProgram({ note: '', days: raw.days.slice(0, 6) }, 'w')).toBeNull();
    expect(normalizeProgram(null, 'w')).toBeNull();
  });

  it('clamps silly numbers and drops bad exercises', () => {
    const p = normalizeProgram({ note: '', days: [day('PUSH', [{ name: 'Bench', sets: 99, reps: 6, load: '' }, { name: '', sets: 3, reps: 5, load: '' }]), rest, rest, rest, rest, rest, rest] }, 'w')!;
    expect(p.days[0]!.exercises).toHaveLength(1);
    expect(p.days[0]!.exercises[0].reps).toHaveLength(10);
  });

  it('fills the LAST line from logged sets', () => {
    const logs = [{ date: '2026-09-28', plan: 'PUSH', done: 4, total: 4, seconds: 3000, sets: [{ exercise: 'Bench press', done: [true, true, true, false], reps: [6, 6, 5, 6], kg: [82.5, 82.5, 82.5, 82.5] }] }];
    expect(lastLifts(logs)).toEqual({ 'bench press': 'LAST · 82.5 × 6 6 5' });
    expect(normalizeProgram(raw, 'w', logs)!.days[0]!.exercises[0].last).toBe('LAST · 82.5 × 6 6 5');
  });
});

describe('program-aware plans', () => {
  const p = normalizeProgram(raw, '2026-W40')!;
  it('uses the program for today and the week grid', () => {
    const fri = new Date(2026, 9, 2, 12);
    expect(todaysPlan(fri, p)?.key).toBe('LEGS');
    expect(todaysPlan(new Date(2026, 9, 1), p)).toBeNull();
    expect(week({ kind: 'demo', scenario: 'Strong week' }, false, fri, p).days.map(d => d.type)).toEqual(['PUSH', 'REST', 'PULL', 'REST', 'LEGS', 'RUN', 'REST']);
  });
});

describe('programPrompt', () => {
  it('mentions low adherence and the request', () => {
    const { user } = programPrompt({ profile: DEFAULT_PROFILE, disciplines: ['Strength'], logs: [], adherence: { kept: 2, planned: 5 }, week: '2026-W41', focus: 'more legs' });
    expect(user).toContain('Adherence is low');
    expect(user).toContain('"more legs"');
    expect(user).toContain('Train 5 days');
  });
});

describe('reiContext with a program', () => {
  it('tells REI about the programmed session', () => {
    const { reiContext } = jest.requireActual('../context') as typeof import('../context');
    const p = normalizeProgram(raw, '2026-W40')!;
    const x = reiContext({
      profile: DEFAULT_PROFILE, disc: {}, meals: [], sessionDone: false, history: { kind: 'real', startedOn: '2026-09-28', sessions: {} },
      activity: { steps: null, sleep: null, sleepL: '—' }, tough: true, nudge: true, now: new Date(2026, 9, 2, 17), program: p,
    });
    expect(x.todayLine).toBe('LEGS session at 18:30');
  });
});
