// When REI's first answer can't stand as written: it has to ask, its numbers differ from what was
// logged, or it claimed something it never did. These decide the endpoint's second pass.
import { DEFAULT_DISCIPLINES, DEFAULT_PROFILE, type ContextInput, type Meal } from '@rei/shared';
import { interpret, type Known, lateMeal, owesMeal, prepare, redoFor } from '../src/chat/brain';
import type { LlmResult } from '../src/llm';

const NOW = new Date(2026, 10, 15, 14, 5);
const eaten: Meal[] = [{ time: '08:10', name: '2 boiled eggs and toast', kcal: 290, p: 17, c: 25, f: 12 }, { time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 }];
const known: Known = {
  input: { profile: { ...DEFAULT_PROFILE, kcal: '2100', protein: '150', weight: '84' }, disc: DEFAULT_DISCIPLINES, meals: eaten, sessionDone: false, history: { kind: 'real', startedOn: '2026-10-06', sessions: {} }, activity: { steps: null, sleep: null, sleepL: '' }, tough: true, bro: false, nudge: true, now: NOW, program: null, memory: [] } as ContextInput,
  messages: [], foods: [], timeZone: 'Asia/Kolkata', today: '2026-11-15', todaySessions: [],
};
const reply = (text: string, ...calls: [string, unknown][]): LlmResult => ({
  content: [...(text ? [{ type: 'text' as const, text }] : []), ...calls.map(([name, input]) => ({ type: 'tool_use' as const, name, input }))],
  stop_reason: calls.length ? 'tool_use' : 'end_turn', model: 'test', usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 },
});
const item = (name: string, qty: number, unit: string, kcal: number) => ({ food_id: 'none', name, qty, unit, kcal, p: Math.round(kcal * 0.04), c: Math.round(kcal * 0.12), f: Math.round(kcal * 0.04), fib: 1, sug: 1, sfa: 1, na: 100 });
const turn = (text: string, final: LlmResult) => {
  const ask = { text, mode: 'chat' as const, voice: false };
  const prep = prepare(known, ask, NOW.getTime());
  return { ask, prep, o: interpret(final, prep, known, ask, NOW.getTime()) };
};
const HINDI = 'मैंने अभी दो रोटी और एक कटोरी दाल खाई';

describe('the numbers REI says about a meal', () => {
  it('are redone when the food list logged something different from what REI estimated', () => {
    // REI answered around its own 320 kcal; the list logs 370.
    const { o } = turn(HINDI, reply('ठीक है, 320 kcal. अब 1040 kcal बचे हैं।', ['log_meal', { name: 'Roti and dal', items: [item('Roti', 2, 'piece', 170), item('Dal', 1, 'katori', 150)] }]));
    expect([o.meal?.kcal, o.mealClaimed]).toEqual([370, 320]);
    const redo = redoFor(o, 'ठीक है, 320 kcal. अब 1040 kcal बचे हैं।', o.meal, known);
    expect(redo).toContain('The app has logged this meal from its food database: 370 kcal, 15 g protein');
    expect(redo).toContain('After it: 990 kcal left and 103 g protein to go today.');
    expect(redo).toContain('Do not call any tool');
  });
  it('stand when they already match, or when REI gave no numbers', () => {
    const { o } = turn('had 2 roti and dal', reply('Good. 370 kcal, 990 left.', ['log_meal', { name: 'Roti and dal', items: [item('Roti', 2, 'piece', 220), item('Dal', 1, 'katori', 150)] }]));
    expect(redoFor(o, 'Good. 370 kcal, 990 left.', o.meal, known)).toBeNull();
    const far = turn(HINDI, reply('बढ़िया।', ['log_meal', { name: 'Roti and dal', items: [item('Roti', 2, 'piece', 170), item('Dal', 1, 'katori', 150)] }]));
    expect(redoFor(far.o, 'बढ़िया।', far.o.meal, known)).toBeNull();
  });
});

describe('asking instead of confirming', () => {
  it('for a workout with no duration, a meal with no food, and a change made by rule', () => {
    const walk = turn('went for a long walk this morning', reply('Logged your walk.', ['log_workout', { kind: 'walk', name: 'long walk', minutes: 60, km: 0 }]));
    expect(redoFor(walk.o, 'Logged your walk.', null, known)).toMatch(/it is NOT logged yet.*ask how long it took/);
    const snack = turn('log my snack please', reply('Logged.', ['log_meal', { name: 'Chicken tikka snack', items: [item('Chicken tikka', 6, 'piece', 270)] }]));
    expect(redoFor(snack.o, 'Logged.', null, known)).toMatch(/NOTHING is logged\. Ask what it was/);
    const vow = turn('change my protein target to 160 please', reply('Which target exactly?'));
    expect(redoFor(vow.o, 'Which target exactly?', null, known)).toContain('The app has just made this change they asked for: protein → 160.');
  });
  it('for nothing usable said, and not otherwise', () => {
    const relog = turn('that rajma chawal was so good', reply('Yes.', ['log_meal', { name: 'Rajma chawal', items: [item('Rajma chawal', 1, 'plate', 450)] }]));
    expect(redoFor(relog.o, 'Yes.', null, known)).toMatch(/Answer their latest message in your own words/);
    const fine = turn("when's my workout?", reply('18:30. Be there.'));
    expect(redoFor(fine.o, '18:30. Be there.', null, known)).toBeNull();
    const silent = turn('ok', reply(''));
    expect(redoFor(silent.o, '', null, known)).toMatch(/Answer their latest message/);
  });
});

describe('a meal REI said it logged without logging it', () => {
  it('is spotted in English and Hindi, on a message about eating', () => {
    const hi = turn(HINDI, reply('यह खाना जोड़ दिया है, प्रोटीन अभी पीछे है।'));
    expect(owesMeal(hi.o, 'यह खाना जोड़ दिया है, प्रोटीन अभी पीछे है।', hi.ask)).toBe(true);
    const en = turn('had 2 roti and dal', reply('Logged. Keep going.'));
    expect(owesMeal(en.o, 'Logged. Keep going.', en.ask)).toBe(true);
  });
  it('is not assumed when it was logged, when REI said "already", or when the message is not about eating', () => {
    const done = turn('had 2 roti and dal', reply('Logged.', ['log_meal', { name: 'Roti and dal', items: [item('Roti', 2, 'piece', 220), item('Dal', 1, 'katori', 150)] }]));
    expect(owesMeal(done.o, 'Logged.', done.ask)).toBe(false);
    const already = turn('what did I eat today?', reply('Rajma chawal is already logged.'));
    expect(owesMeal(already.o, 'Rajma chawal is already logged.', already.ask)).toBe(false);
    const other = turn('walked for 40 minutes', reply('Logged the walk.'));
    expect(owesMeal(other.o, 'Logged the walk.', other.ask)).toBe(false);
  });
  it('is logged from the forced call, through the same checks as any meal', () => {
    const { ask, prep } = turn(HINDI, reply('जोड़ दिया।'));
    const forced = reply('', ['log_meal', { name: 'Roti and dal', items: [item('Roti', 2, 'piece', 200), item('Dal', 1, 'katori', 160)] }]);
    expect(lateMeal(forced, prep, known, ask)).toMatchObject({ meal: { kcal: 370 }, claimed: 360 });
    expect(lateMeal(null, prep, known, ask)).toBeNull();
    expect(lateMeal({ ...forced, stop_reason: 'max_tokens' }, prep, known, ask)).toBeNull();
    // A forced call that comes back with a meal already in today's log is still refused.
    const again = turn('what did I eat today?', reply('Logged.'));
    const lunch = reply('', ['log_meal', { name: 'Rajma chawal', items: [item('Rajma chawal', 1, 'plate', 450)] }]);
    expect(lateMeal(lunch, again.prep, known, again.ask)).toBeNull();
  });
});
