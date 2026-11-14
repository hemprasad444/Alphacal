// The clock and calendar REI is given: every number here is one REI would otherwise have to work out.
import { DEFAULT_PROFILE } from '../data';
import { factsBlock, fullDate, partOfDay, span, timeFacts, type FactsInput } from '../facts';
import { reiContext } from '../context';
import { systemContext } from '../rei';
import { hhmm, isoDate, zonedNow } from '../time';
import type { Meal } from '../types';

const profile = { ...DEFAULT_PROFILE, kcal: '2100', protein: '150', carbs: '220', fat: '65', sessionTime: '18:30', bedtime: '23:00', deadline: '2026-12-31' };
const meals: Meal[] = [
  { time: '08:10', name: '2 boiled eggs and toast', kcal: 290, p: 17, c: 25, f: 12 },
  { time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 },
];
/** Sunday 15 November 2026, 14:05. Sunday is a training day in the default split; Thursday is rest. */
const at = (h: number, m: number, day = 15) => new Date(2026, 10, day, h, m);
const input = (o: Partial<FactsInput> = {}): FactsInput => ({ now: at(14, 5), timeZone: 'Asia/Kolkata', profile, meals, sessionDone: false, startedOn: '2026-10-06', ...o });
const text = (o: Partial<FactsInput> = {}) => timeFacts(input(o)).lines.join('\n');

describe('the clock', () => {
  it('names the date, weekday, time and part of day', () => {
    expect(text()).toContain('NOW: Sunday 15 November 2026, 14:05 (afternoon), their local time (Asia/Kolkata). Yesterday was Sat 14 Nov; tomorrow is Mon 16 Nov.');
    expect(fullDate(at(0, 0, 30))).toBe('Monday 30 November 2026');
  });
  it('gives the coming week as dates, for "next Friday"', () => {
    expect(text()).toContain('COMING DAYS: Mon 2026-11-16, Tue 2026-11-17, Wed 2026-11-18, Thu 2026-11-19, Fri 2026-11-20, Sat 2026-11-21, Sun 2026-11-22.');
    // Across a month and a year end.
    expect(timeFacts(input({ now: new Date(2026, 11, 29, 9, 0) })).lines[1]).toContain('Thu 2026-12-31, Fri 2027-01-01');
  });
  it.each([[0, 'late night'], [4, 'late night'], [5, 'early morning'], [8, 'morning'], [11, 'morning'], [12, 'afternoon'], [16, 'afternoon'], [17, 'evening'], [20, 'evening'], [21, 'night'], [23, 'night']] as const)('%i:00 is %s', (h, part) => {
    expect(partOfDay(at(h, 0))).toBe(part);
  });
  it('says a length of time plainly', () => {
    expect([span(0), span(25), span(60), span(265), span(1470), span(3 * 1440)]).toEqual(['0 min', '25 min', '1 h', '4 h 25 min', '24 h 30 min', '3 days']);
  });
  it('is the user\'s day, not the server\'s: 20:00 UTC on Saturday is already Sunday in India and still Saturday in California', () => {
    const utc = new Date(Date.UTC(2026, 10, 14, 20, 0, 0));
    const india = zonedNow('Asia/Kolkata', utc), la = zonedNow('America/Los_Angeles', utc);
    expect([isoDate(india), hhmm(india), fullDate(india)]).toEqual(['2026-11-15', '01:30', 'Sunday 15 November 2026']);
    expect([isoDate(la), hhmm(la), fullDate(la)]).toEqual(['2026-11-14', '12:00', 'Saturday 14 November 2026']);
    expect(partOfDay(india)).toBe('late night');
    // A zone that isn't one falls back to the clock it was given rather than throwing.
    expect(zonedNow('Not/AZone', utc).getTime()).toBe(utc.getTime());
  });
});

describe('the vow', () => {
  it('counts the days in and the days to the deadline', () => {
    const f = timeFacts(input());
    expect(f.dayOfVow).toBe(41);
    expect(f.daysToDeadline).toBe(46);
    expect(f.lines.join('\n')).toContain('VOW: day 41 since they started (2026-10-06), week 6; the deadline 2026-12-31 is 46 days away (6 weeks 4 days).');
  });
  it('handles today, a passed deadline and a missing one', () => {
    expect(text({ profile: { ...profile, deadline: '2026-11-15' } })).toContain('the deadline 2026-11-15 is today');
    expect(text({ profile: { ...profile, deadline: '2026-11-12' } })).toContain('passed 3 days ago');
    expect(text({ profile: { ...profile, deadline: '2026-11-16' } })).toContain('is 1 day away.');
    const none = timeFacts(input({ profile: { ...profile, deadline: 'soon' }, startedOn: undefined }));
    expect(none.daysToDeadline).toBeNull();
    expect(none.lines.some(l => l.startsWith('VOW'))).toBe(false);
  });
  it('is day 1 on the day they start', () => {
    expect(timeFacts(input({ startedOn: '2026-11-15' })).dayOfVow).toBe(1);
  });
});

describe('training', () => {
  it('says how long until today\'s session', () => {
    const f = timeFacts(input());
    expect(f.sessionIn).toBe(265);
    expect(f.lines.join('\n')).toContain('TRAINING TODAY: Calisthenics, about 45 min, planned for 18:30: starts in 4 h 25 min. NOT done yet.');
  });
  it('says when it is now, late or done', () => {
    expect(text({ now: at(18, 35) })).toContain('planned for 18:30: starts now. NOT done yet.');
    expect(text({ now: at(21, 40) })).toContain('planned for 18:30: was due 3 h 10 min ago. NOT done yet.');
    const done = text({ now: at(20, 0), sessionDone: true, sessions: [{ date: '2026-11-15', plan: 'CALI', title: 'Calisthenics', done: 12, total: 12, seconds: 52 * 60, createdAt: Date.UTC(2026, 10, 15, 13, 10) }] });
    // 13:10 UTC is 18:40 in India.
    expect(done).toContain("TRAINING TODAY: Calisthenics was planned for 18:30 and today's training is DONE (logged: Calisthenics, 52 min at 18:40).");
    expect(done).toContain('LAST WORKOUT LOGGED: today at 18:40: Calisthenics, 52 min.');
  });
  it('knows a rest day and the next session after it', () => {
    const thursday = text({ now: at(10, 0, 19) });
    expect(thursday).toContain('TRAINING TODAY: rest day, nothing planned.');
    expect(thursday).toContain('NEXT SESSION AFTER TODAY: Friday (tomorrow), Push, at 18:30.');
    expect(timeFacts(input({ now: at(10, 0, 19) })).sessionIn).toBeNull();
    expect(text()).toContain('NEXT SESSION AFTER TODAY: Monday (tomorrow), Push, at 18:30.');
  });
  it('falls back to the default time when theirs is half-typed', () => {
    expect(text({ profile: { ...profile, sessionTime: '18:' } })).toContain('planned for 18:30');
  });
  it('says when they last trained', () => {
    const legs = { date: '2026-11-14', plan: 'LEGS', title: 'Legs', done: 18, total: 18, seconds: 3000 };
    expect(text({ sessions: [legs] })).toContain('LAST WORKOUT LOGGED: yesterday (Sat 14 Nov): Legs, 50 min.');
    expect(text({ sessions: [{ ...legs, date: '2026-11-11' }] })).toContain('LAST WORKOUT LOGGED: 4 days ago (Wed 11 Nov): Legs, 50 min.');
    expect(text({ sessions: [{ date: '2026-11-13', plan: 'RUN', title: 'Run', done: 1, total: 1, seconds: 1680, cardio: { km: 5, seconds: 1680, kind: 'run' } }] })).toContain('2 days ago (Fri 13 Nov): Run 5 km, 28 min.');
    expect(text({ sessions: [] })).toContain('LAST WORKOUT LOGGED: none in the last week.');
  });
});

describe('food', () => {
  it('says how long since the last meal and what is left', () => {
    const f = timeFacts(input());
    expect(f.sinceMeal).toBe(45);
    const t = f.lines.join('\n');
    expect(t).toContain('LAST MEAL: Rajma chawal at 13:20 today, 45 min ago. 2 meals logged today.');
    expect(t).toContain('LEFT TODAY (targets minus what is logged): 1360 kcal, 118 g protein, 120 g carbs, 44 g fat.');
  });
  it('goes back to yesterday when nothing is logged today', () => {
    const days = { '2026-11-14': { sessionDone: true, meals: [{ time: '09:00', name: 'Masala dosa', kcal: 350, p: 7, c: 48, f: 14 }, { time: '21:10', name: 'Paneer bhurji and 2 roti', kcal: 470, p: 22, c: 43, f: 24 }] } };
    const t = text({ now: at(7, 30), meals: [], days });
    expect(t).toContain('LAST MEAL: nothing logged today. The last logged meal was Paneer bhurji and 2 roti at 21:10 yesterday, about 10 h 20 min ago.');
    expect(t).toContain('YESTERDAY (Sat 14 Nov): 820 kcal, 29 g protein from 09:00 Masala dosa; 21:10 Paneer bhurji and 2 roti; training done.');
    expect(timeFacts(input({ now: at(7, 30), meals: [], days })).sinceMeal).toBeNull();
    expect(text({ meals: [], days: {} })).toContain('YESTERDAY (Sat 14 Nov): nothing logged.');
    expect(text({ meals: [] })).toContain('LAST MEAL: nothing logged today.');
  });
  it('says over, not a negative number', () => {
    const big: Meal = { time: '13:00', name: 'Feast', kcal: 2400, p: 160, c: 200, f: 100 };
    expect(text({ meals: [big] })).toContain('LEFT TODAY (targets minus what is logged): calories OVER by 300 kcal, protein over by 10 g, 20 g carbs, fat over by 35 g.');
  });
  it('ignores a meal stamped later than now (a clock or zone change)', () => {
    const f = timeFacts(input({ now: at(9, 0) }));
    expect(f.sinceMeal).toBe(50);
  });
});

describe('bedtime', () => {
  it('counts down, and past', () => {
    expect(text()).toContain('BEDTIME: 23:00, in 8 h 55 min.');
    expect(text({ now: at(23, 30) })).toContain('BEDTIME: 23:00, 30 min ago.');
    expect(text({ now: at(2, 0) })).toContain('BEDTIME: 23:00, 3 h ago.');
    // After midnight, seen in the evening: still ahead.
    expect(text({ now: at(22, 0), profile: { ...profile, bedtime: '00:30' } })).toContain('BEDTIME: 00:30, in 2 h 30 min.');
  });
});

describe('what REI is given', () => {
  it('puts the facts and the suggestions in the context, on the phone and the server alike', () => {
    const ctx = reiContext({ profile, disc: {}, meals, sessionDone: false, history: { kind: 'real', startedOn: '2026-10-06', sessions: {} }, activity: { steps: null, sleep: null, sleepL: '' }, tough: true, nudge: true, now: at(14, 5), timeZone: 'Asia/Kolkata' });
    const s = systemContext(ctx);
    expect(s).toContain('FACTS (computed by the app');
    expect(s).toContain('NOW: Sunday 15 November 2026, 14:05 (afternoon)');
    expect(s).toContain('starts in 4 h 25 min');
    expect(s).toContain('SUGGESTIONS (worked out by the app');
    expect(s).toContain('TRAINING NEXT: Calisthenics (45 min) at 18:30, in 4 h 25 min.');
    // The demo story has no start date: no vow day is claimed.
    const demo = reiContext({ profile, disc: {}, meals, sessionDone: false, history: { kind: 'demo', scenario: 'Strong week' }, activity: { steps: null, sleep: null, sleepL: '' }, tough: true, nudge: true, now: at(14, 5) });
    expect(demo.facts).not.toContain('since they started');
    expect(demo.facts).toContain('their local time.');
  });
  it('is one block that starts by saying it is computed', () => {
    expect(factsBlock(input()).split('\n')[0]).toMatch(/^FACTS \(computed by the app for this exact moment/);
  });
});
