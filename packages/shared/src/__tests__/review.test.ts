// Six regressions an independent review found in the first version of the brain work, each reproduced here.
import { DEFAULT_PROFILE } from '../data';
import { timeFacts, type FactsInput } from '../facts';
import { catalog, matchMealText, resolveAiItems } from '../food';
import { shouldLogMeal } from '../mealGuard';
import { isoDate, reportMoment, zonedNow } from '../time';
import type { Meal } from '../types';
import { vowFromText } from '../vowText';

const cat = catalog();
const read = (text: string) => matchMealText(text, cat).items.map(i => `${+i.qty.toFixed(2)} ${i.unit} ${i.food} ${i.kcal}`);

describe('1. raw oats and porridge are different foods', () => {
  it('weighed oats are dry oats; milk is counted once', () => {
    // 50 g dry oats (389 kcal per 100 g) + 250 ml toned milk (145): it was 201 when "oats" meant the porridge.
    expect(read('50g oats with 250 ml milk')).toEqual(['50 g u:10e7va0 195', '250 g d:milk 145']);
    expect(read('100 g oats')).toEqual(['100 g u:10e7va0 389']);
    expect(read('2 tbsp oats')[0]).toMatch(/^2 tbsp u:10e7va0 /);
  });
  it('a bowl of oats, or just "oats", is the porridge, not 150 g of dry oats', () => {
    expect(read('bowl of oats')).toEqual(['1 bowl d:oats 270']);
    expect(read('oats')).toEqual(['1 bowl d:oats 270']);
    expect(read('oats with milk and banana')[0]).toBe('1 bowl d:oats 270');
  });
  it('the same for oats REI names itself', () => {
    const item = (qty: number, unit: string, kcal: number) => ({ food_id: 'none', name: 'Oats', qty, unit, kcal, p: 8, c: 33, f: 3 });
    expect(resolveAiItems([item(50, 'g', 190)], cat).map(i => [i.food, i.kcal])).toEqual([['u:10e7va0', 195]]);
    expect(resolveAiItems([item(1, 'bowl', 300)], cat).map(i => [i.food, i.kcal])).toEqual([['d:oats', 270]]);
  });
});

describe('2. the Sunday report includes Sunday wherever it is still Sunday', () => {
  // Sunday 15 November 2026, 20:30 in India: 07:00 Sunday in Los Angeles, 00:00 Monday in Tokyo.
  const fire = new Date(Date.UTC(2026, 10, 15, 15, 0));
  const day = (zone: string) => isoDate(reportMoment(zonedNow(zone, fire)));
  it('reports up to Sunday 15 November in every zone', () => {
    expect(['Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Honolulu', 'Asia/Tokyo', 'Pacific/Auckland'].map(day)).toEqual(Array(5).fill('2026-11-15'));
  });
  it('only steps back when it is already Monday', () => {
    const la = zonedNow('America/Los_Angeles', fire);
    expect(reportMoment(la)).toBe(la);
    const tokyo = reportMoment(zonedNow('Asia/Tokyo', fire));
    expect([tokyo.getDay(), tokyo.getHours()]).toEqual([0, 23]);
  });
});

describe('3 and 4. a target read from their words', () => {
  const now = new Date(2026, 10, 15, 14, 5);
  it('keeps decimals', () => {
    expect(vowFromText('set my target weight to 72.5 kg', now)).toEqual({ targetWeight: '72.5' });
    expect(vowFromText('set my sleep to 7.5 hours', now)).toEqual({ sleep: '7.5' });
    expect(vowFromText('change my protein target to 160. thanks', now)).toEqual({ protein: '160' });
  });
  it('gives each field only its own value', () => {
    expect(vowFromText('set protein to 150 and carbs to 200', now)).toEqual({ protein: '150', carbs: '200' });
    expect(vowFromText('change my protein target and set carbs to 200', now)).toEqual({ carbs: '200' });
    expect(vowFromText('change my protein target from 150 to 160', now)).toEqual({ protein: '160' });
  });
  it('leaves anything relative to the model, whole', () => {
    for (const text of ['reduce my protein by 20 and set carbs to 200', 'increase my calories by 10%', 'double my step goal to get to 16000', 'set my protein to 20 more than now', 'cut carbs by 50']) expect(vowFromText(text, now)).toBeNull();
  });
  it('converts pounds, and leaves units it does not know', () => {
    expect(vowFromText('set my target weight to 150 lbs', now)).toEqual({ targetWeight: '68' });
    expect(vowFromText('change my goal weight to 165.5 pounds', now)).toEqual({ targetWeight: '75.1' });
    expect(vowFromText('set my target weight to 11 stone', now)).toBeNull();
    expect(vowFromText('set my sleep to 450 minutes', now)).toBeNull();
    expect(vowFromText('set my calories to 8000 kj', now)).toBeNull();
    expect(vowFromText('set my protein to 6 oz', now)).toBeNull();
    expect(vowFromText('set my calories to 2k', now)).toEqual({ kcal: '2000' });
    expect(vowFromText('bump protein to 170g please', now)).toEqual({ protein: '170' });
  });
});

describe('5. a request to log a meal is not a question about food', () => {
  const eggs: Meal = { time: '09:00', name: '2 boiled eggs', kcal: 156, p: 13, c: 1, f: 11 };
  it.each(['Can you log the 2 eggs I ate?', 'could you add the 2 eggs I had this morning?', 'can you log 2 eggs for breakfast?', 'would you track the eggs I ate', '2 anda khaya, log kar do?', 'क्या आप मेरे 2 अंडे लॉग कर सकते हैं जो मैंने खाए?', 'ఏం లేదు, నేను తిన్న 2 గుడ్లు లాగ్ చేయగలవా?'])('%s', text => {
    expect(shouldLogMeal(text, eggs, [], '09:05')).toEqual({ ok: true });
  });
  it('a question about food still is one', () => {
    for (const text of ['should I log eggs or skip them?', 'what did I eat yesterday?', 'can I add rice to dinner?', 'how do I track protein?', 'should I eat 2 eggs?']) expect(shouldLogMeal(text, eggs, [], '09:05').ok).toBe(false);
  });
});

describe('6. time since a meal across a clock change', () => {
  const NY = 'America/New_York';
  const profile = { ...DEFAULT_PROFILE, sessionTime: '18:30', bedtime: '23:00' };
  const facts = (nowMs: number, meals: Meal[], o: Partial<FactsInput> = {}) => timeFacts({ now: zonedNow(NY, new Date(nowMs)), nowMs, timeZone: NY, profile, meals, sessionDone: false, ...o });
  const meal = (time: string, at?: number): Meal => ({ time, name: 'Toast', kcal: 200, p: 6, c: 30, f: 6, ...(at ? { at } : {}) });
  // Spring forward, 8 March 2026: 02:00 EST becomes 03:00 EDT. 01:30 EST is 06:30 UTC; 03:30 EDT is 07:30 UTC.
  const eaten = Date.UTC(2026, 2, 8, 6, 30), later = Date.UTC(2026, 2, 8, 7, 30);
  it('is one hour, not two, from 01:30 to 03:30 on the night the clocks go forward', () => {
    const f = facts(later, [meal('01:30', eaten)]);
    expect(f.sinceMeal).toBe(60);
    expect(f.lines.join('\n')).toContain('LAST MEAL: Toast at 01:30 today, 1 h ago.');
  });
  it('is not asserted for a meal with only a clock time on such a day', () => {
    const f = facts(later, [meal('01:30')]);
    expect(f.sinceMeal).toBeNull();
    expect(f.lines.join('\n')).toContain("LAST MEAL: Toast at 01:30 today. The clocks changed today, so how long ago that was isn't known exactly");
    expect(f.lines.join('\n')).not.toMatch(/2 h ago/);
  });
  // Fall back, 1 November 2026: 02:00 EDT becomes 01:00 EST. The first 01:45 (EDT) is 05:45 UTC; the second 01:15 (EST) is 06:15 UTC.
  it('counts a meal from the first 01:45 when it is 01:15 again', () => {
    const f = facts(Date.UTC(2026, 10, 1, 6, 15), [meal('01:45', Date.UTC(2026, 10, 1, 5, 45))]);
    expect(f.sinceMeal).toBe(30);
    expect(f.lines.join('\n')).toContain('LAST MEAL: Toast at 01:45 today, 30 min ago.');
    // Without a timestamp it is still the last meal, with no elapsed time claimed.
    const old = facts(Date.UTC(2026, 10, 1, 6, 15), [meal('01:45')]);
    expect(old.sinceMeal).toBeNull();
    expect(old.lines.join('\n')).toContain('LAST MEAL: Toast at 01:45 today. The clocks changed today');
  });
  it('is the plain difference on an ordinary day, with or without a timestamp', () => {
    const noon = Date.UTC(2026, 5, 10, 16, 0), ate = Date.UTC(2026, 5, 10, 14, 30); // 12:00 and 10:30 EDT
    expect(facts(noon, [meal('10:30', ate)]).sinceMeal).toBe(90);
    expect(facts(noon, [meal('10:30')]).sinceMeal).toBe(90);
    // A meal whose time was edited afterwards: the clock time is what they mean, not the old timestamp.
    expect(facts(noon, [meal('09:00', ate)]).sinceMeal).toBe(180);
  });
  it('does not state exact hours for last night\'s meal across the change', () => {
    const days = { '2026-03-07': { meals: [meal('21:00')] } };
    const t = facts(Date.UTC(2026, 2, 8, 12, 0), [], { days }).lines.join('\n'); // 08:00 EDT
    expect(t).toContain("The last logged meal was Toast at 21:00 yesterday (the clocks have changed since, so don't state the exact hours).");
    const stamped = { '2026-03-07': { meals: [meal('21:00', Date.UTC(2026, 2, 8, 2, 0))] } };
    expect(facts(Date.UTC(2026, 2, 8, 12, 0), [], { days: stamped }).lines.join('\n')).toContain('at 21:00 yesterday, about 10 h ago.');
  });
});
