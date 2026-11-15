// One chat turn without the network: what REI is told (prepare) and what its answer may do (interpret).
import { DEFAULT_DISCIPLINES, DEFAULT_PROFILE, type ContextInput, type Meal, type MemoryItem } from '@rei/shared';
import { interpret, type Known, mealMath, parseBody, prepare, rememberedIn, saidNoted, spelledCalls } from '../src/chat/brain';
import type { LlmResult } from '../src/llm';

/** Sunday 15 November 2026, 14:05. */
const NOW = new Date(2026, 10, 15, 14, 5);
const profile = { ...DEFAULT_PROFILE, kcal: '2100', protein: '150', carbs: '220', fat: '65', sessionTime: '18:30', bedtime: '23:00', deadline: '2026-12-31', weight: '84' };
const eaten: Meal[] = [{ time: '08:10', name: '2 boiled eggs and toast', kcal: 290, p: 17, c: 25, f: 12 }, { time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 }];

function known(o: { meals?: Meal[]; memory?: MemoryItem[] } = {}): Known {
  return {
    input: {
      profile, disc: DEFAULT_DISCIPLINES, meals: o.meals ?? eaten, sessionDone: false, history: { kind: 'real', startedOn: '2026-10-06', sessions: {} },
      activity: { steps: 3200, sleep: 7.2, sleepL: '7h 12m' }, tough: true, bro: false, nudge: true, now: NOW, program: null, memory: o.memory ?? [], timeZone: 'Asia/Kolkata', sessions: [], days: {},
    } as ContextInput,
    messages: [], foods: [], timeZone: 'Asia/Kolkata', today: '2026-11-15', todaySessions: [],
  };
}
const ask = (text: string, mode: 'chat' | 'meal' = 'chat') => ({ text, mode, voice: false });
const reply = (text: string, ...calls: [string, unknown][]): LlmResult => ({
  content: [...(text ? [{ type: 'text' as const, text }] : []), ...calls.map(([name, input]) => ({ type: 'tool_use' as const, name, input }))],
  stop_reason: calls.length ? 'tool_use' : 'end_turn', model: 'test', usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 },
});
const item = (name: string, qty: number, unit: string, kcal: number, food_id = 'none') => ({ food_id, name, qty, unit, kcal, p: Math.round(kcal * 0.04), c: Math.round(kcal * 0.12), f: Math.round(kcal * 0.04), fib: 1, sug: 1, sfa: 1, na: 100 });
const turn = (text: string, final: LlmResult, k: Known = known(), mode: 'chat' | 'meal' = 'chat') => {
  const a = ask(text, mode);
  return interpret(final, prepare(k, a, NOW.getTime()), k, a, NOW.getTime());
};

describe('what REI is told', () => {
  it('gets the computed facts and suggestions with every message', () => {
    const p = prepare(known(), ask("when's my workout?"), NOW.getTime());
    expect(p.system).toContain('NOW: Sunday 15 November 2026, 14:05 (afternoon), their local time (Asia/Kolkata).');
    expect(p.system).toContain('TRAINING TODAY: Calisthenics, about 45 min, planned for 18:30: starts in 4 h 25 min. NOT done yet.');
    expect(p.system).toContain('LAST MEAL: Rajma chawal at 13:20 today, 45 min ago.');
    expect(p.system).toContain('LEFT TODAY (targets minus what is logged): 1360 kcal, 118 g protein');
    expect(p.system).toContain('the deadline 2026-12-31 is 46 days away');
    expect(p.system).toContain('SUGGESTIONS (worked out by the app');
    expect(p.system).not.toContain('MEAL MATH (the app matched');
    expect(p.tier).toBe('fast');
    expect(p.tools.map(t => t.name)).toEqual(['log_meal', 'log_workout', 'update_vow', 'remember', 'forget']);
    expect(p.turns[p.turns.length - 1]).toEqual({ role: 'user', content: "when's my workout?" });
  });
  it('gets the meal added up from the food list, with what is left after it', () => {
    const p = prepare(known(), ask('had 2 roti dal sabzi for lunch'), NOW.getTime());
    expect(p.system).toContain('MEAL MATH (the app matched');
    expect(p.system).toContain('- d:roti | 2 roti | Roti | 220 kcal, P7 C38 F5');
    expect(p.system).toContain('Matched total: 520 kcal, 19 g protein');
    expect(p.system).toContain('After this meal: 840 kcal left and 99 g protein to go today.');
    expect(p.matched?.map(i => i.food)).toEqual(['d:roti', 'd:dal', 'd:mixed-veg']);
  });
  it('marks the part the list does not have, and stays out of messages that are not about food', () => {
    const k = known();
    const part = mealMath('had curd rice and pickle', k.foods.concat(prepare(k, ask('x')).foods), k.input, 'chat');
    expect(part.block).toContain('Not in the database: "pickle". Estimate only that part');
    expect(part.items).toBeNull();
    for (const text of ['going to a movie with my friends', "when's my workout?", 'did legs today', 'how long since I ate?']) expect(prepare(k, ask(text), NOW.getTime()).system).not.toContain('MEAL MATH (the app matched');
    // Over the target after it: said so, not shown as a negative number.
    const big = prepare(known({ meals: [{ time: '12:00', name: 'Feast', kcal: 2000, p: 140, c: 200, f: 70 }] }), ask('had 2 roti and dal'), NOW.getTime());
    expect(big.system).toContain('After this meal: 270 kcal OVER the target and protein target hit today.');
  });
  it('forces the one log_meal call from the Fuel screen and routes planning to the deep model', () => {
    const fuel = prepare(known(), ask('a bowl of curd rice with pickle', 'meal'), NOW.getTime());
    expect([fuel.forceTool, fuel.tools.length, fuel.maxTokens, fuel.tier]).toEqual(['log_meal', 1, 1024, 'fast']);
    expect(fuel.turns[fuel.turns.length - 1].content).toBe('Just ate: a bowl of curd rice with pickle');
    const deep = prepare(known(), ask('rebuild my plan around my knee'), NOW.getTime());
    expect([deep.tier, deep.canRebuild, deep.tools.some(t => t.name === 'rebuild_program')]).toEqual(['deep', true, true]);
  });
});

describe('meals', () => {
  it('are logged with the food list\'s numbers when the list matched the whole message, whatever the model estimated', () => {
    const o = turn('had 2 roti, dal and paneer sabzi for lunch', reply('Solid lunch.', ['log_meal', { name: 'Roti dal paneer', items: [item('Roti', 2, 'piece', 240), item('Dal', 1, 'bowl', 200), item('Paneer sabzi', 1, 'bowl', 380)] }]));
    expect(o.meal?.kcal).toBe(670);
    expect(o.meal?.items?.map(i => i.food)).toEqual(['d:roti', 'd:dal', 'd:kadai-paneer']);
    expect(o.meal?.name).toBe('Roti dal paneer');
  });
  it('are looked up by the English names the model gives for a Hindi message', () => {
    const o = turn('मैंने अभी दो रोटी और एक कटोरी दाल खाई', reply('बढ़िया।', ['log_meal', { name: 'Roti and dal', items: [item('Roti', 2, 'piece', 200), item('Dal', 1, 'katori', 180)] }]));
    expect([o.meal?.kcal, o.meal?.items?.map(i => i.food)]).toEqual([370, ['d:roti', 'd:dal']]);
  });
  it('keep the model\'s estimate, marked as one, for food the list does not have', () => {
    const o = turn('had my mom’s special pulao', reply('Nice.', ['log_meal', { name: 'Special pulao', items: [item('Mom’s special pulao', 1, 'serving', 520)] }]));
    expect(o.meal?.kcal).toBe(520);
    expect(o.meal?.items?.[0].food).toBe('');
  });
  it('are one meal even when the model makes one call per food', () => {
    const o = turn('had chicken curry and 2 roti', reply('Good.', ['log_meal', { name: 'Chicken curry', items: [item('Chicken curry', 1, 'katori', 240, 'd:chicken-curry')] }], ['log_meal', { name: 'Roti', items: [item('Roti', 2, 'roti', 220, 'd:roti')] }]));
    expect([o.meal?.kcal, o.meal?.items?.length]).toEqual([460, 2]);
  });
  it('are not invented when they never said what they ate, and REI is made to ask', () => {
    const o = turn('log my snack please', reply('Logged your snack.', ['log_meal', { name: 'Chicken tikka snack', items: [item('Chicken tikka', 6, 'piece', 270)] }]));
    expect([o.meal, o.mealBlocked, o.askFood]).toEqual([null, true, true]);
  });
  it('are not logged again from earlier, or from a message about something else', () => {
    const again = turn('that rajma chawal was so good', reply('It was.', ['log_meal', { name: 'Rajma chawal', items: [item('Rajma chawal', 1, 'plate', 450, 'd:rajma-chawal')] }]));
    expect([again.meal, again.mealBlocked, again.askFood]).toEqual([null, true, false]);
    const movie = turn('going to a movie with friends at 7', reply('Enjoy.', ['log_meal', { name: 'Rajma chawal', items: [item('Rajma chawal', 1, 'plate', 450)] }]));
    expect(movie.meal).toBeNull();
  });
  it('from the Fuel screen are always logged, with the verdict as the reply', () => {
    const o = turn('a bowl of curd rice with pickle', reply('', ['log_meal', { name: 'Curd rice and pickle', verdict: 'Light. 1080 left.', items: [item('Curd rice', 1, 'katori', 260, 'd:curd-rice'), item('Pickle', 1, 'tbsp', 20)] }]), known(), 'meal');
    expect([o.meal?.kcal, o.text]).toEqual([280, 'Light. 1080 left.']);
  });
  it('are never taken from a call cut off mid-way', () => {
    const cut = { ...reply('So', ['log_meal', { name: 'Roti', items: [item('Roti', 2, 'roti', 220, 'd:roti')] }]), stop_reason: 'max_tokens' as const };
    expect(turn('had 2 roti', cut).meal).toBeNull();
  });
});

describe('workouts', () => {
  it('are not logged with a duration nobody gave', () => {
    const o = turn('went for a long walk this morning', reply('Nice walk.', ['log_workout', { kind: 'walk', name: 'long walk', minutes: 60, km: 0 }]));
    expect(o.workouts).toEqual([]);
    expect(o.askDuration).toMatch(/Don't guess a duration: ask how long it took/);
  });
  it('are logged with the minutes they said, not the model\'s', () => {
    const o = turn('walked for 40 minutes this morning', reply('Good.', ['log_workout', { kind: 'walk', name: 'walk', minutes: 45, km: 0 }]));
    expect(o.workouts.map(w => w.seconds)).toEqual([2400]);
    expect(o.askDuration).toBeNull();
    expect(o.workouts[0].date).toBe('2026-11-15');
  });
  it('are not logged twice in one reply', () => {
    const o = turn('did legs for 50 minutes', reply('Good.', ['log_workout', { kind: 'session', name: 'legs', minutes: 50, km: 0 }], ['log_workout', { kind: 'session', name: 'leg day', minutes: 50, km: 0 }]));
    expect(o.workouts).toHaveLength(1);
  });
});

describe('the vow', () => {
  it('changes when the model says so', () => {
    const o = turn('I want more protein, make it 160', reply('Done.', ['update_vow', { changes: [{ field: 'protein', value: '160' }] }]));
    expect(o.vow).toEqual({ protein: '160' });
    expect(o.vowByRule).toEqual([]);
  });
  it('changes from their own words when the model only talks', () => {
    const o = turn('change my protein target to 160 please', reply('Protein target set to 160 g.'));
    expect(o.vow).toEqual({ protein: '160' });
    expect(o.vowByRule).toEqual(['protein → 160']);
    const d = turn('move my deadline to this coming Friday', reply('Which Friday do you mean?'));
    expect(d.vow).toEqual({ deadline: '2026-11-20' });
  });
  it('takes their number over the model\'s for the same field', () => {
    const o = turn('set my calories to 1800', reply('Done.', ['update_vow', { changes: [{ field: 'kcal', value: '1900' }] }]));
    expect(o.vow).toEqual({ kcal: '1800' });
  });
  it('records a weight only when they gave it', () => {
    expect(turn('night shift killed me yesterday', reply('Rest.', ['update_vow', { changes: [{ field: 'weight', value: '82' }] }])).vow).toBeNull();
    expect(turn('weighed 83.4 this morning', reply('Down.')).vow).toEqual({ weight: '83.4' });
    expect(turn('weighed 83.4 this morning', reply('Down.', ['update_vow', { changes: [{ field: 'weight', value: '83.4' }] }])).vow).toEqual({ weight: '83.4' });
  });
});

describe('answers that need care', () => {
  it('a refusal does nothing', () => {
    const o = turn('whatever', { ...reply('no'), stop_reason: 'refusal' });
    expect([o.text, o.meal, o.vow]).toEqual(['', null, null]);
  });
  it('a tool call the model wrote out as text is taken as a call and not shown', () => {
    const leaked = 'Protein target set to 160 g. <tool_call recipient="functions.update_vow"> {"changes":[{"field":"sleep","value":"8"}]} </tool_call>';
    expect(spelledCalls(leaked)).toEqual({ text: 'Protein target set to 160 g.', calls: [{ type: 'tool_use', name: 'update_vow', input: { changes: [{ field: 'sleep', value: '8' }] } }] });
    const o = turn('I should sleep 8 hours', reply(leaked));
    expect(o.vow).toEqual({ sleep: '8' });
    expect(o.text).toBe('Protein target set to 160 g.');
    expect(spelledCalls('Fine. <tool_call recipient="functions.remember"> not json </tool_call>')).toEqual({ text: 'Fine.', calls: [] });
  });
  it('"noted" without a remember call is spotted, and the forced call\'s facts are read', () => {
    expect(saidNoted('Peanut allergy noted; I’ll keep peanuts out.')).toBe(true);
    expect(saidNoted("I'll remember that.")).toBe(true);
    expect(saidNoted('Good session. Eat.')).toBe(false);
    expect(rememberedIn(reply('', ['remember', { facts: [{ text: 'Allergic to peanuts', kind: 'health' }] }]))).toEqual([{ text: 'Allergic to peanuts', kind: 'health' }]);
    expect(rememberedIn(reply('', ['remember', { facts: [] }]))).toEqual([]);
    expect(rememberedIn(null)).toEqual([]);
  });
  it('remember and forget pass through checked', () => {
    const o = turn("btw I'm allergic to peanuts", reply('Got it.', ['remember', { facts: [{ text: 'Allergic to peanuts', kind: 'health' }] }], ['forget', { ids: ['m1'] }]));
    expect(o.memory).toEqual({ remember: [{ text: 'Allergic to peanuts', kind: 'health' }], forget: ['m1'] });
  });
});

describe('the chat request', () => {
  const ok = { text: '  had 2 roti  ', replyId: 'abc123xyz', mode: 'chat', userMessageId: 'msg000001', voice: true };
  it('is read with its text trimmed', () => {
    expect(parseBody(ok)).toEqual({ text: 'had 2 roti', replyId: 'abc123xyz', mode: 'chat', userMessageId: 'msg000001', voice: true });
    // An older build sends neither mode nor voice.
    expect(parseBody({ text: 'hi', replyId: 'abc123xyz' })).toEqual({ text: 'hi', replyId: 'abc123xyz', mode: 'chat', userMessageId: undefined, voice: false });
    // Voice never applies to a Fuel log; a malformed message id is dropped, not fatal.
    expect(parseBody({ ...ok, mode: 'meal', userMessageId: '../etc' })).toMatchObject({ mode: 'meal', voice: false, userMessageId: undefined });
  });
  it('is refused when it is not a request', () => {
    for (const bad of [null, undefined, 'text', 42, [], [ok], {}, { ...ok, text: '   ' }, { ...ok, text: 'x'.repeat(2001) }, { ...ok, text: 5 }, { ...ok, replyId: 'short' }, { ...ok, replyId: 'has/slash1' }, { ...ok, replyId: 'UPPERCASE1' }, { ...ok, replyId: undefined }]) {
      expect(parseBody(bad)).toBeNull();
    }
  });
});
