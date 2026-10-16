// Edge cases across the small helpers: bad input should never turn into NaN on screen or a
// broken profile.
import { sessionCountdown } from '../derive';
import { dayIntake } from '../intake';
import { addMemory, readMemory } from '../memory';
import { addNutrients, cleanNutrients, dailyTargets, formatNutrient, nutrientsFromRow, scaleNutrients } from '../nutrients';
import { defaultSets, isBodyweight, PICK_GROUPS } from '../picks';
import { DEFAULT_PROFILE } from '../data';
import { applyUpdate } from '../rei';
import { clockMinutes, daysBetween, isoWeek, minutesUntil, parseIsoDate, programWeek } from '../time';
import type { Meal } from '../types';

const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m);

describe('time', () => {
  it('reads clock times and rejects half-typed ones', () => {
    expect(clockMinutes('18:30')).toBe(1110);
    expect(clockMinutes('6:05')).toBe(365);
    expect(clockMinutes(' 23:59 ')).toBe(1439);
    for (const bad of ['', '18:', '24:00', '18:60', '6pm', '1830', undefined, null]) expect(clockMinutes(bad)).toBeNull();
    expect(minutesUntil('19:00', at(18, 30))).toBe(30);
    expect(minutesUntil('18:', at(18, 30))).toBeNaN();
  });

  it('never shows NaN in the session countdown', () => {
    expect(sessionCountdown(at(17, 0), '18:30')).toBe('18:30 · IN 90 MIN');
    expect(sessionCountdown(at(18, 35), '18:30')).toBe('18:30 · NOW');
    expect(sessionCountdown(at(21, 0), '18:30')).toBe('18:30 · 3 H LATE');
    for (const bad of ['', '18:', 'soon']) expect(sessionCountdown(at(17, 0), bad)).not.toMatch(/NaN/);
  });

  it('parses dates strictly and counts days and weeks across month and year ends', () => {
    expect(parseIsoDate('2026-02-30')?.getMonth()).toBe(2); // JS rolls over; still a date, not a crash
    expect(parseIsoDate('2026-1-5')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(daysBetween(new Date(2026, 11, 31, 23), new Date(2027, 0, 1, 1))).toBe(1);
    expect(isoWeek(new Date(2027, 0, 1))).toBe('2026-W53');
    expect(isoWeek(new Date(2026, 9, 5))).toBe('2026-W41');
    expect(programWeek('not-a-date', at(12))).toBe(1);
    expect(programWeek('2026-09-28', at(12))).toBe(2);
  });
});

describe('profile updates from REI', () => {
  it('drops junk values instead of saving them', () => {
    const r = applyUpdate(DEFAULT_PROFILE, { weight: 'abc', kcal: -200, sessionTime: '18:', bedtime: '25:00', deadline: '2027-13-45', protein: 180 } as never);
    expect(r?.profile.protein).toBe('180');
    expect(r?.profile.weight).toBe(DEFAULT_PROFILE.weight);
    expect(r?.profile.kcal).toBe(DEFAULT_PROFILE.kcal);
    expect(r?.profile.sessionTime).toBe(DEFAULT_PROFILE.sessionTime);
    expect(r?.profile.deadline).toBe(DEFAULT_PROFILE.deadline);
    expect(r?.note).toBe('VOW UPDATED · PROTEIN');
  });

  it('returns null when every value was junk', () => {
    expect(applyUpdate(DEFAULT_PROFILE, { weight: '', sessionTime: 'later' } as never)).toBeNull();
  });

  it('keeps good times and dates', () => {
    const r = applyUpdate(DEFAULT_PROFILE, { sessionTime: '7:15', deadline: '2027-03-06' } as never);
    expect(r?.profile).toMatchObject({ sessionTime: '7:15', deadline: '2027-03-06' });
  });
});

describe('memory', () => {
  let n = 0;
  const id = () => `m${++n}`;
  it('skips duplicates that differ only in case and punctuation, and blank facts', () => {
    const a = addMemory([], [{ text: 'Vegetarian, no eggs', kind: 'diet' }], 'you', 1, id).list;
    const b = addMemory(a, [{ text: '  vegetarian no EGGS!  ', kind: 'diet' }, { text: '   ', kind: 'life' }], 'rei', 2, id);
    expect(b.list).toHaveLength(1);
    expect(b.added).toHaveLength(0);
  });

  it('makes room by dropping REI’s oldest note, never the user’s', () => {
    const mine = addMemory([], Array.from({ length: 29 }, (_, i) => ({ text: `mine ${i}`, kind: 'life' as const })), 'you', 1, id).list;
    const withRei = addMemory(mine, [{ text: 'rei note', kind: 'life' }], 'rei', 2, id).list;
    const full = addMemory(withRei, [{ text: 'one more of mine', kind: 'life' }], 'you', 3, id).list;
    expect(full).toHaveLength(30);
    expect(full.some(m => m.text === 'rei note')).toBe(false);
    expect(full.some(m => m.text === 'one more of mine')).toBe(true);
  });

  it('reads stored memory defensively', () => {
    const r = readMemory([{ id: 'a', text: 'ok', kind: 'nonsense', source: 'x', createdAt: 'bad' }, null, { id: 1, text: 'x' }, 'str']);
    expect(r).toEqual([{ id: 'a', text: 'ok', kind: 'life', source: 'rei', createdAt: 0 }]);
    expect(readMemory('nope')).toEqual([]);
  });
});

describe('exercise picks', () => {
  it('has no duplicate lifts inside a group', () => {
    for (const g of PICK_GROUPS) expect(new Set(g.lifts).size).toBe(g.lifts.length);
  });
  it('knows bodyweight moves and sensible defaults', () => {
    expect(isBodyweight('Pull ups')).toBe(true);
    expect(isBodyweight('Push-ups'.replace('-', ' '))).toBe(true);
    expect(isBodyweight('Bench press')).toBe(false);
    expect(defaultSets('Back squat')).toEqual([6, 6, 6]);
    expect(defaultSets('Plank')).toEqual([30, 30, 30]);
    expect(defaultSets('Lateral raise')).toEqual([10, 10, 10]);
  });
});

describe('nutrients', () => {
  it('falls back to 2000 kcal targets for missing or silly calories', () => {
    const base = dailyTargets({ kcal: 2000 });
    expect(dailyTargets({ kcal: NaN })).toEqual(base);
    expect(dailyTargets({ kcal: 0 })).toEqual(base);
    expect(dailyTargets({ kcal: -500 })).toEqual(base);
    expect(base.fib).toBe(28);
  });

  it('cleans untrusted maps: unknown keys, negatives, NaN, strings and huge numbers go', () => {
    expect(cleanNutrients({ fib: 3.456, na: -1, fe: NaN, ca: '200', zz: 5, k: 1e9 })).toEqual({ fib: 3.46 });
    expect(cleanNutrients(null)).toBeUndefined();
    expect(cleanNutrients({})).toBeUndefined();
  });

  it('adds, scales and reads rows', () => {
    expect(addNutrients({ fib: 2 }, undefined, { fib: 1.5, na: 100 })).toEqual({ fib: 3.5, na: 100 });
    expect(scaleNutrients({ fib: 10 }, 0.5)).toEqual({ fib: 5 });
    expect(scaleNutrients(undefined, 2)).toBeUndefined();
    expect(nutrientsFromRow([1, null, 2])).toEqual({ fib: 1, sfa: 2 });
    expect(nutrientsFromRow([null, null])).toBeUndefined();
    expect(formatNutrient('fe', 6.44)).toBe('6.4 mg');
    expect(formatNutrient('na', 1814.2)).toBe('1814 mg');
  });
});

describe('day intake edges', () => {
  const meal = (kcal: number, n?: Meal['n']): Meal => ({ time: '12:00', name: 'x', kcal, p: 10, c: 10, f: 5, ...(n ? { n } : {}) });
  it('is all zeros and -1 with no meals', () => {
    const d = dayIntake([]);
    expect(d.totals.kcal).toBe(0);
    expect(d.top.p).toBe(-1);
    expect(d.coverage.fib).toBe(0);
  });
  it('does not credit a top meal for zero values', () => {
    const d = dayIntake([meal(100, { fib: 0 }), meal(200, { fib: 0 })]);
    expect(d.top.fib).toBe(-1);
    expect(d.coverage.fib).toBe(1);
  });
  it('treats zero-calorie days without dividing by zero', () => {
    expect(dayIntake([meal(0, { na: 5 })]).coverage.na).toBe(0);
  });
});

describe('weight goal both ways', () => {
  const { trajectory, hero } = jest.requireActual('../derive') as typeof import('../derive');
  const now = new Date(2026, 9, 12, 9, 0);
  const prof = (weight: string, targetWeight: string) => ({ ...DEFAULT_PROFILE, weight, targetWeight, deadline: '2027-03-07' });
  const w = (date: string, kg: number) => ({ date, kg });

  it('a bulker below target is not "at the target"', () => {
    const t = trajectory(prof('58.4', '64'), 0, now, [w('2026-10-04', 58)]);
    expect(t.eta).not.toBe('TARGET HIT');
    expect(t.reqPace).toBeGreaterThan(0);
  });

  it('counts gaining as progress for a bulker and losing for a cutter', () => {
    const bulk = trajectory(prof('59', '64'), 0, now, [w('2026-10-01', 58), w('2026-10-04', 58.2)]);
    expect(bulk.curPace).toBeGreaterThan(0);
    expect(bulk.note).not.toMatch(/Losing/);
    const cut = trajectory(prof('83', '76.5'), 0, now, [w('2026-10-01', 84), w('2026-10-04', 83.6)]);
    expect(cut.curPace).toBeGreaterThan(0);
  });

  it('says target hit only once it is actually reached, in the right direction', () => {
    expect(trajectory(prof('64.2', '64'), 0, now, [w('2026-09-01', 58)]).eta).toBe('TARGET HIT');
    expect(trajectory(prof('76.4', '76.5'), 0, now, [w('2026-09-01', 84)]).eta).toBe('TARGET HIT');
  });

  it('does not claim the scale has not moved with under a week of weigh-ins', () => {
    const t = trajectory(prof('84', '76.5'), 0, now, [w('2026-10-10', 84)]);
    expect(t.note).not.toMatch(/hasn’t moved/);
    expect(t.note).toMatch(/Weigh in/);
  });

  it('quotes their own training time and bedtime', () => {
    const week = { days: [], done: 0, missed: 1, left: 2, yesterdayDone: false } as never;
    const plan = { key: 'PUSH', title: 'Push', sub: '', minutes: 50, exercises: [] } as never;
    const h = hero(week, plan, false, true, 50, 10000, { session: '06:30', bed: '22:30' });
    expect(h.parts.map(p => p.t).join('')).toContain('06:30');
    const rest = hero(week, null, false, true, 50, 10000, { session: '06:30', bed: '22:30' });
    expect(rest.parts.map(p => p.t).join('')).toContain('bed by 22:30');
  });
});

describe('a session hours late', () => {
  const { hero } = jest.requireActual('../derive') as typeof import('../derive');
  const week = { days: [], done: 2, missed: 0, left: 2, yesterdayDone: false } as never;
  const plan = { key: 'PULL', title: 'Pull', sub: '', minutes: 40, exercises: [] } as never;
  it('is called out instead of "clean so far"', () => {
    const h = hero(week, plan, false, false, 50, 10000, { session: '06:30', bed: '23:15', lateMin: 17 * 60 });
    expect(h.tag).toBe('CALL-OUT');
    expect(h.parts.map(p => p.t).join('')).toContain('Pull was due at 06:30');
  });
  it('stays on track while the session is still ahead or just started', () => {
    expect(hero(week, plan, false, false, 50, 10000, { session: '18:30', lateMin: -120 }).tag).toBe('ON TRACK');
    expect(hero(week, plan, false, false, 50, 10000, { session: '18:30', lateMin: 30 }).tag).toBe('ON TRACK');
  });
});

describe('nothing done yet', () => {
  const { hero, protocol, nutrition } = jest.requireActual('../derive') as typeof import('../derive');
  const plan = { key: 'PUSH', title: 'Push', sub: '', minutes: 50, exercises: [] } as never;
  it('does not praise a clean week on day one', () => {
    const fresh = { days: [], done: 0, missed: 0, left: 4, yesterdayDone: false } as never;
    const text = hero(fresh, plan, false, true, 50, 10000, { session: '18:30' }).parts.map(p => p.t).join('');
    expect(text).not.toMatch(/Good work|clean so far/);
    expect(text).toContain('Push at 18:30');
    const going = { days: [], done: 2, missed: 0, left: 2, yesterdayDone: false } as never;
    expect(hero(going, plan, false, true, 50, 10000).parts.map(p => p.t).join('')).toContain('clean so far');
  });
  it('does not count an empty food log as calories done', () => {
    const empty = protocol(plan, nutrition([], { steps: null, sleep: null, sleepL: '—' }), { protein: '150', kcal: '2000', steps: '10000', sleep: '8' } as never, false, 0, false);
    expect(empty[2].status).toBe('NOT LOGGED');
    const ate = protocol(plan, nutrition([{ time: '09:00', name: 'eggs', kcal: 300, p: 20, c: 2, f: 20 }], { steps: null, sleep: null, sleepL: '—' }), { protein: '150', kcal: '2000', steps: '10000', sleep: '8' } as never, false, 0, false);
    expect(ate[2].status).toBe('OK');
  });
});
