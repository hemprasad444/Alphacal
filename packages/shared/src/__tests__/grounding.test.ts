// REI acts only on what was actually said: durations, foods, targets and dates come from the user's
// words (or the food list), never from a model's guess.
import { agentPrompt, calorieAnchors, checkLiveMeal, LIVE_TOOLS, liveMealItems } from '../agent';
import { reiContext } from '../context';
import { DEFAULT_DISCIPLINES, DEFAULT_PROFILE } from '../data';
import { catalog, itemFor } from '../food';
import { mentionsEating, shouldLogMeal } from '../mealGuard';
import { reportDates, reportPrompt, type WeekStats } from '../progress';
import { GROUNDING, systemRules } from '../rei';
import { clockFromWords, dateFromWords, vowFromText } from '../vowText';
import { durationSaid, groundWorkout, type Workout } from '../workout';
import type { Meal } from '../types';

const foods = catalog();

describe('how long a workout was', () => {
  it.each([
    ['walked for 40 minutes this morning', [40]],
    ['did legs, 45 min', [45]],
    ['ran 5k in 28:30', [28.5]],
    ['football for an hour', [60]],
    ['yoga for half an hour', [30]],
    ['cycled for an hour and a half', [90]],
    ['gym for 1.5 hrs', [90]],
    ['1 hour 20 minutes of badminton', [80]],
    ['1h 20m ride', [80]],
    ['swam for two and a half hours', [150]],
    ['Forty five minutes.', [45]],
    ['about twenty minutes', [20]],
    ['ek ghanta cricket khela', [60]],
    ['45 minat walk kiya', [45]],
    ['ran 30 min and lifted for 45 minutes', [30, 45]],
  ] as const)('%s', (text, minutes) => {
    expect(durationSaid(text)).toEqual({ said: true, minutes });
  });

  it.each(['went for a long walk this morning', 'ran 5k', 'did 400 m repeats', 'played football at 6:30', 'just smashed push day', 'walked 8000 steps', 'one more set'])('"%s" gives no duration', text => {
    expect(durationSaid(text)).toEqual({ said: false, minutes: [] });
  });

  it('counts a duration said in Hindi or Telugu script, even though it can\'t be read as a number', () => {
    expect(durationSaid('मैंने 40 मिनट वॉक किया').said).toBe(true);
    expect(durationSaid('నేను ఒక గంట నడిచాను').said).toBe(true);
    expect(durationSaid('आज वॉक किया').said).toBe(false);
  });

  const walk: Workout = { kind: 'walk', name: 'long walk', minutes: 60, km: 0 };
  it('is never invented: without one, the workout is not logged and REI is told to ask', () => {
    const r = groundWorkout(walk, 'went for a long walk this morning');
    expect('ask' in r && r.ask).toMatch(/didn't say how long the long walk was\. Don't guess a duration: ask how long it took \(and how far, if they know\)/);
    expect('ask' in groundWorkout({ ...walk, kind: 'session', name: 'push day' }, 'just smashed push day')).toBe(true);
  });
  it('is the one they said, whatever the model wrote', () => {
    expect(groundWorkout(walk, 'walked for 40 minutes this morning')).toEqual({ workout: { ...walk, minutes: 40 } });
    // Two durations in one message: the model's choice between them stands.
    expect(groundWorkout({ ...walk, minutes: 45 }, 'ran 30 min and lifted for 45 minutes')).toEqual({ workout: { ...walk, minutes: 45 } });
    // An absurd reading ("in 900 minutes") doesn't replace the model's.
    expect(groundWorkout(walk, 'walked 900 minutes lol')).toEqual({ workout: walk });
  });
});

describe('what was eaten', () => {
  const dal: Meal = { time: '13:00', name: 'Roti and dal', kcal: 370, p: 15, c: 58, f: 9, items: [{ food: 'd:roti', name: 'Roti', qty: 2, unit: 'roti', g: 80, kcal: 220, p: 7, c: 38, f: 5 }, { food: 'd:dal', name: 'Dal, tadka', qty: 1, unit: 'katori', g: 150, kcal: 150, p: 8, c: 20, f: 4.5 }] };
  it('is recognised as eating in Hindi, Telugu and Tamil, typed either way', () => {
    for (const text of ['मैंने अभी दो रोटी और दाल खाई', 'నేను మూడు ఇడ్లీలు తిన్నాను', 'நான் தோசை சாப்பிட்டேன்', 'maine 2 roti khayi', 'idli tinnanu', 'chai pi liya']) expect(mentionsEating(text)).toBe(true);
    for (const text of ['going to a movie', 'आज मेरा वर्कआउट कब है?', 'kal milte hain']) expect(mentionsEating(text)).toBe(false);
  });
  it('is logged from a Hindi message (it never was: only English words counted as eating)', () => {
    expect(shouldLogMeal('मैंने अभी दो रोटी और एक कटोरी दाल खाई', dal, [], '13:05')).toEqual({ ok: true });
    expect(shouldLogMeal('నేను ఇప్పుడే రోటీ, పప్పు తిన్నాను', dal, [], '13:05')).toEqual({ ok: true });
    expect(shouldLogMeal('आज मेरा वर्कआउट कब है?', dal, [], '13:05').ok).toBe(false);
  });
  it('is not made up when they never said what it was', () => {
    const tikka: Meal = { time: '14:05', name: 'Chicken tikka snack', kcal: 270, p: 45, c: 6, f: 9 };
    expect(shouldLogMeal('log my snack please', tikka, [], '14:05', false)).toEqual({ ok: false, why: 'no food named' });
    expect(shouldLogMeal('just had dinner', tikka, [], '21:00', false)).toEqual({ ok: false, why: 'no food named' });
    // They named it, gave a number, or pointed at a meal REI knows: logged.
    expect(shouldLogMeal('had chicken tikka as a snack', tikka, [], '14:05', true).ok).toBe(true);
    expect(shouldLogMeal('ate out, about 800 calories', { ...tikka, name: 'Meal out', kcal: 800 }, [], '14:05', false).ok).toBe(true);
    expect(shouldLogMeal('had my usual breakfast', { ...tikka, name: 'Usual breakfast' }, [], '08:05', false).ok).toBe(true);
    expect(shouldLogMeal('anda khaya', { ...tikka, name: 'Boiled egg' }, [], '08:05', true).ok).toBe(true);
    // "Same as yesterday" points at a meal; "yesterday" in a question does not.
    expect(shouldLogMeal('had the same as yesterday', { ...tikka, name: 'Masala dosa' }, [], '08:05', false).ok).toBe(true);
  });
  it('is not logged from a question about food', () => {
    const day: Meal = { time: '14:05', name: "Yesterday's meals", kcal: 820, p: 29, c: 91, f: 38 };
    for (const text of ['what did I eat yesterday?', 'what did i eat yesterday', 'should I eat rice tonight?', 'can I have pizza', 'did I eat enough today?', 'kya khau ab', 'क्या खाऊँ?', 'how many calories did my lunch have?']) {
      expect(shouldLogMeal(text, day, [], '14:05').ok).toBe(false);
    }
    expect(shouldLogMeal('what did I eat yesterday?', day, [], '14:05')).toEqual({ ok: false, why: 'a question' });
    // A statement that they ate, with or without a question after it, still logs.
    const eggs: Meal = { time: '14:05', name: '2 boiled eggs', kcal: 156, p: 13, c: 1, f: 11 };
    expect(shouldLogMeal('had 2 boiled eggs, is that ok?', eggs, [], '14:05').ok).toBe(true);
    expect(shouldLogMeal('what a day, had 2 boiled eggs', eggs, [], '14:05').ok).toBe(true);
    expect(shouldLogMeal('is that fine? I ate 2 boiled eggs', eggs, [], '14:05').ok).toBe(true);
  });
  it('keeps the old behaviour for a caller that does not say whether a food was named', () => {
    const tikka: Meal = { time: '14:05', name: 'Chicken tikka snack', kcal: 270, p: 45, c: 6, f: 9 };
    // A caller that doesn't know (a live call) keeps the old behaviour.
    expect(shouldLogMeal('log my snack please', tikka, [], '14:05').ok).toBe(true);
  });
});

describe('meals on a live call', () => {
  const est = { name: 'Roti dal sabzi', kcal: 500, p: 18, c: 70, f: 14 };
  it('use the food list for each item REI names, whatever language was spoken', () => {
    const items = [{ name: 'roti', qty: 2, unit: 'piece', kcal: 200 }, { name: 'dal', qty: 1, unit: 'katori', kcal: 170 }, { name: 'sabzi', qty: 1, unit: 'katori', kcal: 130 }];
    const r = checkLiveMeal(est, 'मैंने दो रोटी दाल और सब्ज़ी खाई', foods, '13:05', false, items);
    expect('meal' in r && [r.meal.kcal, r.meal.items?.map(i => i.food)]).toEqual([520, ['d:roti', 'd:dal', 'd:mixed-veg']]);
  });
  it('keep REI\'s estimate for the part the list doesn\'t have, with macros that add up', () => {
    const items = [{ name: 'roti', qty: 2, unit: 'piece', kcal: 220 }, { name: 'aunty’s special gravy', qty: 1, unit: 'katori', kcal: 280 }];
    const r = checkLiveMeal(est, 'two rotis with aunty’s special gravy', foods, '13:05', false, items);
    if (!('meal' in r)) throw new Error('expected a meal');
    const [roti, gravy] = r.meal.items!;
    expect([roti.food, roti.kcal]).toEqual(['d:roti', 220]);
    expect([gravy.food, gravy.kcal]).toEqual(['', 280]);
    expect(Math.abs(gravy.p * 4 + gravy.c * 4 + gravy.f * 9 - 280)).toBeLessThan(25);
    expect(r.meal.kcal).toBe(500);
  });
  it('work as before for an older agent that sends no items', () => {
    const r = checkLiveMeal({ name: 'Two eggs', kcal: 150, p: 5, c: 2, f: 3 }, 'I just had 2 eggs for breakfast', foods, '08:10');
    expect('meal' in r && r.meal.kcal).toBe(156);
    expect('redo' in checkLiveMeal({ name: 'Thing', kcal: 400, p: 7, c: 20, f: 0 }, 'ate a thing', foods, '13:00', false, [])).toBe(true);
  });
  it('check the items the model sends', () => {
    expect(liveMealItems([{ name: ' roti ', qty: 2, unit: 'Piece', kcal: 220.4 }, { name: '', qty: 1 }, null, { name: 'dal', qty: -1, unit: 5, kcal: 'x' }])).toEqual([{ name: 'roti', qty: 2, unit: 'piece', kcal: 220 }, { name: 'dal', qty: 1, unit: '', kcal: 0 }]);
    expect(liveMealItems('roti')).toEqual([]);
    expect(liveMealItems(Array.from({ length: 30 }, () => ({ name: 'roti', qty: 1, unit: 'piece', kcal: 110 })))).toHaveLength(12);
  });
  it('offers items on log_meal, and says minutes are never a guess', () => {
    const meal = LIVE_TOOLS.find(t => t.name === 'log_meal')!.parameters;
    expect(meal.required).toEqual(['name', 'items', 'kcal', 'protein', 'carbs', 'fat', 'fiber']);
    expect((meal.properties as Record<string, { type: string }>).items.type).toBe('array');
    const workout = LIVE_TOOLS.find(t => t.name === 'log_workout')!.parameters.properties as Record<string, { description: string }>;
    expect(workout.minutes.description).toMatch(/Never a guess/);
  });
});

describe('calorie anchors', () => {
  it('are the food list\'s own numbers', () => {
    const byId = new Map(foods.map(f => [f.id, f]));
    const a = calorieAnchors();
    const kcal = (id: string, unit: string) => itemFor(byId.get(id)!, 1, unit).kcal;
    expect(a).toContain(`roti or chapati ${kcal('d:roti', 'roti')}`);
    expect(a).toContain(`masala dosa ${kcal('d:masala-dosa', 'dosa')}`);
    expect(a).toContain(`katori of dal ${kcal('d:dal', 'katori')}`);
    expect(a).toContain(`katori of paneer butter masala ${kcal('d:paneer-butter-masala', 'katori')}`);
    expect(a).toContain(`home plate of chicken biryani (300 g) ${kcal('d:chicken-biryani', 'plate')}`);
    expect(a).toContain(`egg ${kcal('d:boiled-egg', 'egg')}`);
    // Twenty anchors, none dropped because a food went missing from the list.
    expect(a.split(': ')[1].split(', ').length).toBeGreaterThanOrEqual(20);
  });
});

describe('a plain request to change a target', () => {
  const now = new Date(2026, 10, 15, 14, 5); // Sunday
  it.each([
    ['change my protein target to 160 please', { protein: '160' }],
    ['set my calories to 1,800', { kcal: '1800' }],
    ['bump protein to 170g and drop carbs to 180', { protein: '170', carbs: '180' }],
    ['can you change my calorie target to 2k?', { kcal: '2000' }],
    ['change my protein target from 150 to 160', { protein: '160' }],
    ['lower my step goal to 8000', { steps: '8000' }],
    ['move my deadline to this coming Friday', { deadline: '2026-11-20' }],
    ['push my deadline to 20th December', { deadline: '2026-12-20' }],
    ['set my deadline to 2027-01-15', { deadline: '2027-01-15' }],
    ['change my bedtime to 10:30 pm', { bedtime: '22:30' }],
    ['move my training time to 7 am', { sessionTime: '07:00' }],
    ['change my workout time to 19:00', { sessionTime: '19:00' }],
    ['set sessions per week to 4', { sessions: '4' }],
  ] as const)('%s', (text, want) => {
    expect(vowFromText(text, now)).toEqual(want);
  });
  it.each([
    'should I change my protein to 160?', 'thinking of changing my calories to 1800', "don't change my protein to 160", 'what if I set calories to 1500', 'protein 160 today', 'change my protein target',
    'set protein to 2', 'move my deadline to last Friday maybe', 'change my bedtime to 10:30', 'lower my body fat target to 12', 'I walked to 8000 steps', 'had 2 roti',
  ])('"%s" is left to REI', text => {
    expect(vowFromText(text, now)).toBeNull();
  });
  it('reads dates in words from today', () => {
    expect(dateFromWords('tomorrow', now)).toBe('2026-11-16');
    expect(dateFromWords('friday', now)).toBe('2026-11-20');
    // On a Sunday the coming Friday is already next week's; on a Monday, "next Friday" is the one after.
    expect(dateFromWords('next friday', now)).toBe('2026-11-20');
    expect(dateFromWords('next friday', new Date(2026, 10, 16))).toBe('2026-11-27');
    expect(dateFromWords('this friday', new Date(2026, 10, 16))).toBe('2026-11-20');
    expect(dateFromWords('sunday', now)).toBe('2026-11-22');
    expect(dateFromWords('december 20', now)).toBe('2026-12-20');
    expect(dateFromWords('3rd of jan', now)).toBe('2027-01-03');
    expect(dateFromWords('in 3 weeks', now)).toBe('2026-12-06');
    expect(dateFromWords('end of the month', now)).toBe('2026-11-30');
    expect(dateFromWords('end of the year', now)).toBe('2026-12-31');
    expect(dateFromWords('31st february', now)).toBeNull();
    expect(dateFromWords('2026-02-30', now)).toBeNull();
    expect(dateFromWords('soon', now)).toBeNull();
  });
  it('reads a clock time only when it can be read one way', () => {
    expect([clockFromWords('10:30 pm'), clockFromWords('11pm'), clockFromWords('12 am'), clockFromWords('22:30'), clockFromWords('06:30')]).toEqual(['22:30', '23:00', '00:00', '22:30', '06:30']);
    expect([clockFromWords('7'), clockFromWords('7:30'), clockFromWords('25:00'), clockFromWords('soon')]).toEqual([null, null, null, null]);
  });
});

describe('the weekly report', () => {
  const stats = (to: string, end: number | null) => ({ week: '2026-W46', from: '2026-11-09', to, weight: { start: 84, end, change: null } }) as unknown as WeekStats;
  it('is given the days to the deadline and the weight to go, worked out', () => {
    expect(reportDates(stats('2026-11-15', 83.2), { ...DEFAULT_PROFILE, deadline: '2026-12-31', targetWeight: '76.5' })).toBe("\nFrom 2026-11-15 the deadline is 46 days away (6 full weeks). 6.7 kg above the target weight. (Computed: use these, don't recalculate.)");
    expect(reportDates(stats('2026-11-15', null), { ...DEFAULT_PROFILE, deadline: '2026-11-10', targetWeight: '76.5' })).toContain('The deadline passed 5 days before 2026-11-15.');
    expect(reportDates(stats('2026-11-15', 76.5), { ...DEFAULT_PROFILE, deadline: 'someday', targetWeight: '76.5' })).toContain('They are at the target weight.');
    expect(reportDates(stats('2026-11-15', null), { ...DEFAULT_PROFILE, deadline: 'someday' })).toBe('');
    const { user } = reportPrompt({ ...stats('2026-11-15', 83.2), sessions: { done: 3, planned: 4, target: 5 }, prs: [], food: { daysLogged: 5, avgKcal: 2000, avgProtein: 140, proteinDays: 3, overDays: 1, kcalTarget: 2100, proteinTarget: 150 }, steps: null, sleepH: null, runs: { count: 0, km: 0, best: null }, activities: { count: 0, minutes: 0, kcal: 0 } } as WeekStats, { ...DEFAULT_PROFILE, deadline: '2026-12-31' }, true);
    expect(user).toContain('the deadline is 46 days away');
  });
});

describe('what REI is told', () => {
  const ctx = reiContext({ profile: DEFAULT_PROFILE, disc: DEFAULT_DISCIPLINES, meals: [], sessionDone: false, history: { kind: 'demo', scenario: 'Slipping week' }, activity: { steps: null, sleep: null, sleepL: '' }, nudge: true, now: new Date(2026, 9, 3, 18, 0), tough: true, bro: false });
  it('in chat: read the facts, never guess a duration or a meal, answer in their language', () => {
    const rules = systemRules({ tough: true, nudge: true, tools: true });
    expect(rules).toContain(GROUNDING);
    expect(rules).toContain("never guess a duration: ask how long it took");
    expect(rules).toContain('never make up a meal');
    expect(rules).toContain('Reply in the language and script of their latest message');
    expect(rules).toContain('words alone change nothing');
  });
  it('on a call: items for the food list, the same grounding, no invented durations', () => {
    const p = agentPrompt(ctx);
    expect(p).toContain('one entry in items per food');
    expect(p).toContain(GROUNDING);
    expect(p).toContain('never guess a duration');
    expect(p).toContain('FACTS (computed by the app');
    expect(p).toContain('SUGGESTIONS (worked out by the app');
    expect(p).toContain(calorieAnchors());
  });
});
