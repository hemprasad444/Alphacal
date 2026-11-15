import { activityFor, DEFAULT_PROFILE, SESSIONS } from '../data';
import type { History } from '../types';
import { CLEARED, ENERGY_WON_AT, energyState, hero, integrity, nutrition, protocol, sessionCountdown, shout, todaysPlan, trajectory, week, weekNote, xpToPass } from '../derive';

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
    expect(h.parts.map(p => p.t).join('')).toBe('You said this mattered. Two sessions missed this week. Stop negotiating with yourself. Push day, 18:30.');
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

describe('energy against the calorie target', () => {
  const none = { steps: null, sleep: null, sleepL: '—' };
  const row = (kcal: number, target: string) =>
    protocol(SESSIONS.PUSH, nutrition(kcal ? [{ time: '12:00', name: 'x', kcal, p: 0, c: 0, f: 0 }] : [], none), { ...DEFAULT_PROFILE, kcal: target }, false, 0, false)[2];

  it('names one state for every amount eaten', () => {
    expect(energyState(0, 2000)).toBe('empty');
    expect(energyState(300, 2000)).toBe('open');
    expect(energyState(1700, 2000)).toBe('watch');
    expect(energyState(2000 * ENERGY_WON_AT, 2000)).toBe('won');
    expect(energyState(1999, 2000)).toBe('won');
    expect(energyState(2000, 2000)).toBe('won');
    // Compared as shown: 2,000.4 reads "2,000 / 2,000", so it isn't over.
    expect(energyState(2000.4, 2000)).toBe('won');
    expect(energyState(2001, 2000)).toBe('over');
    expect(energyState(500, 0)).toBe('unset');
    expect(energyState(500, NaN)).toBe('unset');
  });

  it('calls 96 to 100% of the target a round won, in your colour, and counts it as done', () => {
    for (const kcal of [1920, 1990, 2000]) {
      const r = row(kcal, '2000');
      expect([r.status, r.tone]).toEqual(['ROUND WON', 'acc']);
      expect(CLEARED).toContain(r.status);
    }
  });

  it('keeps going over the target a warning that is not counted as done', () => {
    const r = row(2150, '2000');
    expect([r.status, r.tone]).toEqual(['OVER', 'alert']);
    expect(CLEARED).not.toContain(r.status);
    expect(CLEARED).not.toContain(row(1700, '2000').status);
    expect(CLEARED).not.toContain(row(0, '2000').status);
  });

  it('shows the amount alone, with nothing filled, when there is no calorie target', () => {
    for (const target of ['', '0']) {
      const r = row(640, target);
      expect(r).toMatchObject({ value: '640', status: 'NO TARGET', tone: 'warn', pct: 0 });
      expect(CLEARED).not.toContain(r.status);
    }
  });
});

describe('xpToPass', () => {
  it('is one more than their lead, and nothing once you are past them', () => {
    expect(xpToPass(1240, 1105)).toBe(136);
    expect(xpToPass(500, 500)).toBe(1);
    expect(xpToPass(500, 620)).toBeLessThanOrEqual(0);
  });
});

describe('shout', () => {
  it('capitalises Latin-script lines, accents and punctuation included', () => {
    expect(shout('Two missed. Not today.')).toBe('TWO MISSED. NOT TODAY.');
    expect(shout('Ça suffit — “now”, José!')).toBe('ÇA SUFFIT — “NOW”, JOSÉ!');
  });
  it('leaves every other script exactly as written', () => {
    for (const line of ['आज का सेशन मत छोड़ना।', 'Сегодня без отговорок.', '今日は休まない。', 'Σήμερα δουλεύουμε.', 'Aaj gym जाना है, Hem.']) expect(shout(line)).toBe(line);
  });
});
