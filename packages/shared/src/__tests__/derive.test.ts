import { activityFor, DEFAULT_PROFILE, SESSIONS } from '../data';
import type { History } from '../types';
import { hero, integrity, nutrition, protocol, sessionCountdown, todaysPlan, trajectory, week, weekNote } from '../derive';

// 2026-10-02 is a Friday (PUSH in the weekly plan).
const FRI = new Date(2026, 9, 2, 17, 52);
const THU = new Date(2026, 9, 1, 12, 0);
const MON = new Date(2026, 8, 28, 9, 0);
const SLIP: History = { kind: 'demo', scenario: 'Slipping week' };
const STRONG: History = { kind: 'demo', scenario: 'Strong week' };

describe('week', () => {
  it('slipping week on Friday: Tue and Wed missed, today pending', () => {
    const w = week(SLIP, false, FRI);
    expect(w.days.map(d => d.status)).toEqual(['done', 'missed', 'missed', 'rest', 'today', 'future', 'future']);
    expect(w).toMatchObject({ done: 1, missed: 2, due: 3, left: 3 });
    expect(integrity(w)).toBe(60);
  });

  it('finishing today counts it as kept', () => {
    const w = week(SLIP, true, FRI);
    expect(w).toMatchObject({ done: 2, missed: 2, due: 4, left: 2 });
    expect(integrity(w)).toBe(70);
  });

  it('nothing is missed yet on a Monday', () => {
    const w = week(SLIP, false, MON);
    expect(w.missed).toBe(0);
    expect(integrity(w)).toBe(100);
  });

  it('strong week keeps every session', () => {
    expect(week(STRONG, false, FRI)).toMatchObject({ done: 3, missed: 0, yesterdayDone: false });
  });
});

describe('week from real history', () => {
  const real = (sessions: Record<string, boolean>, startedOn = '2026-01-01'): History => ({ kind: 'real', startedOn, sessions });

  it('marks past training days done or missed from the log', () => {
    // Mon 28 Sep done, Tue 29 missed, Wed 30 done, Thu rest.
    const w = week(real({ '2026-09-28': true, '2026-09-30': true }), false, FRI);
    expect(w.days.map(d => d.status)).toEqual(['done', 'missed', 'done', 'rest', 'today', 'future', 'future']);
    expect(w).toMatchObject({ done: 2, missed: 1, due: 3 });
  });

  it('does not count days before the user started', () => {
    const w = week(real({ '2026-09-30': true }, '2026-09-30'), false, FRI);
    expect(w.days.slice(0, 3).map(d => d.status)).toEqual(['none', 'none', 'done']);
    expect(w).toMatchObject({ done: 1, missed: 0, due: 1 });
    expect(integrity(w)).toBe(100);
  });
});

describe('plans', () => {
  it('maps weekdays to sessions', () => {
    expect(todaysPlan(FRI)?.key).toBe('PUSH');
    expect(todaysPlan(THU)).toBeNull();
  });
});

describe('hero copy', () => {
  it('calls out the missed sessions on a slipping day', () => {
    const h = hero(week(SLIP, false, FRI), SESSIONS.PUSH, false, true, 78, 10000);
    expect(h.tag).toBe('CALL-OUT');
    expect(h.parts.map(p => p.t).join('')).toBe('You said this mattered. Two sessions missed this week. Stop negotiating with yourself. Push day. Tonight, 18:30.');
  });

  it('rest day copy', () => {
    expect(hero(week(SLIP, false, THU), null, false, true, 78, 10000).tag).toBe('RECOVERY');
  });

  it('week note counts what is left', () => {
    expect(weekNote(week(SLIP, false, FRI), false)).toBe('Two misses. Tonight plus two more. Hit all three and the week still counts. Miss tonight and it doesn’t.');
  });
});

describe('protocol', () => {
  it('flags protein and training on the slipping demo day', () => {
    const nu = nutrition([{ time: '12:00', name: 'x', kcal: 1840, p: 92, c: 200, f: 72 }], activityFor('Slipping week', false));
    const rows = protocol(SESSIONS.PUSH, nu, DEFAULT_PROFILE, false, 0, false);
    expect(rows.map(r => r.status)).toEqual(['PENDING', 'BEHIND', 'WATCH', 'BEHIND', 'SHORT']);
  });
});

describe('protocol without activity data', () => {
  it('shows NO DATA for steps and sleep', () => {
    const nu = nutrition([], { steps: null, sleep: null, sleepL: '\u2014' });
    const rows = protocol(SESSIONS.PUSH, nu, DEFAULT_PROFILE, false, 0, false);
    expect(rows.slice(3).map(r => [r.value, r.status])).toEqual([['\u2014 / 10,000', 'NO DATA'], ['\u2014', 'NO DATA']]);
  });
});

describe('trajectory', () => {
  it('computes required and current pace from the weigh-ins', () => {
    const t = trajectory(DEFAULT_PROFILE, 2, FRI);
    expect(t.daysLeft).toBe(150);
    expect(t.reqPace).toBeCloseTo(0.355, 3);
    expect(t.curPace).toBeCloseTo(0.275, 3);
    expect(t.behind).toBe(true);
    expect(t.eta).toBe('ETA APR 14 · +6 WK');
    expect(t.note).toBe('You need 0.35 kg a week. Last month averaged 0.28. Missed sessions are why.');
  });

  it('uses real weigh-ins when given', () => {
    const t = trajectory(DEFAULT_PROFILE, 0, FRI, [
      { date: '2026-09-04', kg: 83.6 },
      { date: '2026-09-18', kg: 82.6 },
    ]);
    // 83.6 → 81.6 over exactly four weeks.
    expect(t.curPace).toBeCloseTo(0.5, 3);
    expect(t.history).toEqual([83.6, 82.6, 81.6]);
    expect(t.behind).toBe(false);
  });

  it('has no trend without past weigh-ins', () => {
    expect(trajectory(DEFAULT_PROFILE, 0, FRI, []).eta).toBe('NO TREND');
  });

  it('reports a hit target', () => {
    expect(trajectory({ ...DEFAULT_PROFILE, weight: '74' }, 0, FRI).eta).toBe('TARGET HIT');
  });
});

describe('sessionCountdown', () => {
  it('counts down to 18:30', () => {
    expect(sessionCountdown(FRI)).toBe('18:30 · IN 38 MIN');
    expect(sessionCountdown(new Date(2026, 9, 2, 18, 35))).toBe('18:30 · NOW');
    expect(sessionCountdown(new Date(2026, 9, 2, 19, 0))).toBe('18:30 · 30 MIN LATE');
  });
});

describe('hero after the session', () => {
  it('does not ask for 0 g of protein', () => {
    const h = hero(week(SLIP, true, FRI), SESSIONS.PUSH, true, true, 0, 10000);
    expect(h.parts.map(p => p.t).join('')).toBe('Good. That’s one back and protein is hit. The week is still two down. Don’t celebrate yet.');
  });
});
