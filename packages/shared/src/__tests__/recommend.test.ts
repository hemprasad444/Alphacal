// Suggestions from rules: real meals from the food list that fit what's left, and the next training action.
import { DEFAULT_PROFILE, SESSIONS } from '../data';
import { nutrition } from '../derive';
import { catalog } from '../food';
import { avoidedTags, dietOf, recommend, type RecommendInput, slotAt, suggestionFoodIds, suggestionsBlock } from '../recommend';
import type { Meal } from '../types';

const profile = { ...DEFAULT_PROFILE, kcal: '2100', protein: '150', carbs: '220', fat: '65', steps: '9000', sessionTime: '18:30', bedtime: '23:00' };
const at = (h: number, m = 0) => new Date(2026, 10, 15, h, m);
const mem = (...texts: string[]) => texts.map(text => ({ text, kind: 'diet' as const }));
const input = (o: Partial<RecommendInput> & { meals?: Meal[] } = {}): RecommendInput => {
  const meals = o.meals ?? [];
  return { now: at(19, 30), profile, meals, nutrition: nutrition(meals, { steps: 3200, sleep: 7, sleepL: '7h' }), memory: mem('Non-veg; 4 meals a day'), plan: SESSIONS.PUSH, sessionDone: false, ...o };
};
const labels = (o: Partial<RecommendInput> = {}) => recommend(input(o)).meals.map(m => m.label).join(' | ');

describe('how they eat', () => {
  it('reads the onboarding choices', () => {
    expect(dietOf(['Non-veg; 4 meals a day; cooks: sometimes'])).toBe('nonveg');
    expect(dietOf(['Vegetarian; 3 meals a day'])).toBe('veg');
    expect(dietOf(['Eggetarian; 3 meals a day'])).toBe('egg');
    expect(dietOf(['Vegan; 3 meals a day'])).toBe('vegan');
    expect(dietOf(['Jain; 3 meals a day'])).toBe('veg');
    expect(dietOf(['Pescatarian; 3 meals a day'])).toBe('nonveg');
    expect(dietOf([])).toBe('nonveg');
  });
  it('reads what REI remembered', () => {
    expect(dietOf(['Vegetarian; eats eggs and dairy'])).toBe('egg');
    expect(dietOf(['Vegetarian; no eggs'])).toBe('veg');
    expect(dietOf(['Pure veg, doesn’t eat eggs'])).toBe('veg');
    expect(dietOf(['Eats non veg on weekends'])).toBe('nonveg');
  });
  it('knows what to keep off the plate', () => {
    expect(avoidedTags(['Allergic to peanuts'])).toEqual(expect.arrayContaining(['peanut']));
    expect(avoidedTags(['Lactose intolerant'])).toEqual(expect.arrayContaining(['dairy', 'whey', 'paneer']));
    expect(avoidedTags(['Vegetarian; eats eggs; no fish'])).toEqual(['fish']);
    expect(avoidedTags(['Doesn’t like paneer', 'hates soya chunks'])).toEqual(expect.arrayContaining(['paneer', 'soy']));
    expect(avoidedTags(['Pescatarian; 3 meals a day'])).toEqual(expect.arrayContaining(['chicken', 'mutton']));
    expect(avoidedTags(['Loves chicken and rice', 'Non-veg; 4 meals a day'])).toEqual([]);
  });
});

describe('meal options', () => {
  it('are built only from foods the list has', () => {
    const ids = new Set(catalog().map(f => f.id));
    expect(suggestionFoodIds().filter(id => !ids.has(id))).toEqual([]);
  });
  it('fit what is left, with the list\'s own numbers', () => {
    const eaten: Meal[] = [{ time: '08:10', name: 'Eggs and toast', kcal: 290, p: 17, c: 25, f: 12 }, { time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 }];
    const r = recommend(input({ meals: eaten }));
    expect(r.slot).toBe('dinner');
    expect(r.left).toEqual({ kcal: 1360, protein: 118, carbs: 120, fat: 44 });
    expect(r.meals).toHaveLength(3);
    for (const m of r.meals) {
      expect(m.kcal).toBeLessThanOrEqual(r.left.kcal);
      expect(m.kcal).toBeLessThanOrEqual(r.budget * 1.15);
      // Totals are the sum of the items, and each item is the food list's row scaled to its amount.
      expect(m.kcal).toBe(Math.round(m.items.reduce((a, i) => a + i.kcal, 0)));
      expect(m.items.every(i => i.food && i.qty > 0)).toBe(true);
    }
    // 118 g protein to go: dinner carries a real share of it.
    expect(r.meals[0].p).toBeGreaterThanOrEqual(40);
  });
  it('are the same every time for the same moment', () => {
    expect(recommend(input())).toEqual(recommend(input()));
  });
  it('never offer meat or eggs to a vegetarian, or dairy to a vegan', () => {
    for (const hour of [8, 13, 17, 20, 23]) {
      const veg = labels({ now: at(hour), memory: mem('Vegetarian; no eggs') });
      expect(veg).not.toMatch(/chicken|fish|egg|omelette|mutton/i);
      expect(veg.length).toBeGreaterThan(0);
      const vegan = labels({ now: at(hour), memory: mem('Vegan') });
      expect(vegan).not.toMatch(/chicken|fish|egg|omelette|paneer|curd|yogurt|whey|milk|buttermilk/i);
      const eggs = labels({ now: at(hour), memory: mem('Eggetarian') });
      expect(eggs).not.toMatch(/chicken|fish|mutton/i);
    }
  });
  it('respect an allergy and a dislike', () => {
    for (const hour of [8, 17]) {
      expect(labels({ now: at(hour), memory: mem('Non-veg', 'Allergic to peanuts') })).not.toMatch(/peanut/i);
      expect(labels({ now: at(hour), memory: mem('Vegetarian', 'Lactose intolerant') })).not.toMatch(/paneer|curd|yogurt|whey|milk/i);
    }
    expect(labels({ memory: mem('Non-veg', 'No fish') })).not.toMatch(/fish/i);
  });
  it('do not repeat what they already ate today', () => {
    const rajma: Meal = { time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 };
    expect(labels({ meals: [rajma], memory: mem('Vegetarian; no eggs') }).split(' | ')[0]).not.toMatch(/rajma/i);
  });
  it('say so when nothing fits', () => {
    const feast: Meal = { time: '13:00', name: 'Feast', kcal: 2300, p: 100, c: 250, f: 90 };
    const over = recommend(input({ meals: [feast] }));
    expect(over.meals).toEqual([]);
    expect(over.foodNote).toMatch(/200 kcal over today's target: nothing more to eat/);
    const tight = recommend(input({ meals: [{ ...feast, kcal: 2050 }] }));
    expect(tight.meals).toEqual([]);
    expect(tight.foodNote).toMatch(/Only 50 kcal left/);
    // 220 kcal left with protein still short: light, protein-first options only.
    const lean = recommend(input({ meals: [{ ...feast, kcal: 1880, p: 60 }] }));
    expect(lean.meals.length).toBeGreaterThan(0);
    expect(lean.meals.every(m => m.kcal <= 220)).toBe(true);
    expect(lean.foodNote).toMatch(/Little room left/);
  });
  it('fuel a session that is under two hours away', () => {
    const r = recommend(input({ now: at(17, 15) }));
    expect(r.slot).toBe('snack');
    expect(r.foodNote).toMatch(/Training is within two hours/);
    expect(r.meals.map(m => m.label).join(' ')).toMatch(/banana/);
    expect(r.meals.every(m => m.f <= 12)).toBe(true);
    // Session already done: an ordinary snack, protein first.
    expect(recommend(input({ now: at(17, 15), sessionDone: true })).foodNote).not.toMatch(/Training is within/);
  });
  it('move on to the next meal when they have just eaten, and offer dinner for later', () => {
    const lunch: Meal = { time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 };
    const r = recommend(input({ now: at(14, 5), meals: [lunch] }));
    expect(r.slot).toBe('snack');
    expect(r.foodNote).toContain('They ate Rajma chawal at 13:20, so the next thing is a snack.');
    expect(r.later?.meals.length).toBe(2);
    expect(r.later!.meals.every(m => m.kcal <= r.left.kcal - r.budget)).toBe(true);
    // Lunch three hours ago: lunch time has passed anyway; at 12:30 with only breakfast logged, it's lunch.
    expect(recommend(input({ now: at(12, 30), meals: [{ ...lunch, time: '08:00' }] })).slot).toBe('lunch');
  });
  it('know the time of day', () => {
    expect([5, 10, 11, 15, 16, 18, 19, 22, 23, 2].map(h => slotAt(at(h)))).toEqual(['breakfast', 'breakfast', 'lunch', 'lunch', 'snack', 'snack', 'dinner', 'dinner', 'late', 'late']);
  });
});

describe('the next training action', () => {
  const training = (o: Partial<RecommendInput> = {}) => recommend(input(o)).training;
  it('counts down to the session', () => {
    expect(training({ now: at(14, 5) })).toBe('Push (52 min) at 18:30, in 4 h 25 min. 5800 steps to go, about 60 min of brisk walking.');
    expect(training({ now: at(17, 30) })).toContain('in 1 h. Eat something light with carbs about an hour before.');
  });
  it('says start now when it is late but there is still time', () => {
    expect(training({ now: at(19, 30) })).toContain("Push was due at 18:30 (1 h ago) and isn't done: start now.");
    expect(training({ now: at(21, 20) })).toContain('start now, the 30-minute version (main lifts only)');
  });
  it('calls it off when bed is too close', () => {
    expect(training({ now: at(22, 10) })).toContain("Push wasn't done and bedtime (23:00) is in 50 min: too late to train well.");
    expect(training({ now: at(23, 40) })).toContain('bedtime (23:00) is past');
  });
  it('turns to recovery once it is done, and to steps on a rest day', () => {
    expect(training({ sessionDone: true })).toContain("Today's training is done. Recovery now: 150 g protein still to eat, bed by 23:00.");
    expect(training({ plan: null })).toMatch(/^Rest day: no session\. 5800 steps to go/);
    const noSteps = recommend({ ...input({ plan: null }), nutrition: nutrition([], { steps: null, sleep: null, sleepL: '' }) }).training;
    expect(noSteps).toContain("Steps aren't synced today; the target is 9000.");
  });
});

describe('what REI reads', () => {
  it('lists the options with portions and macros, then the training line', () => {
    const block = suggestionsBlock(recommend(input({ now: at(14, 5), meals: [{ time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 }] })));
    expect(block).toMatch(/^SUGGESTIONS \(worked out by the app/);
    expect(block).toMatch(/FOOD NOW \(snack; 1650 kcal and 135 g protein left today; eats everything; this meal about \d+ kcal\):/);
    expect(block).toMatch(/\n1\. .+: \d+ kcal, \d+ g protein, \d+ g carbs, \d+ g fat/);
    expect(block).toMatch(/DINNER LATER \(about \d+ kcal/);
    expect(block).toMatch(/TRAINING NEXT: Push \(52 min\) at 18:30/);
  });
  it('writes amounts the way people say them', () => {
    const all = [8, 13, 17, 20].map(h => labels({ now: at(h), sessionDone: true })).join(' | ') + labels({ memory: mem('Vegetarian') });
    expect(all).not.toMatch(/\d (egg|roti|idli|banana) (egg|roti|idli|banana)/i);
    expect(all).not.toMatch(/, (tadka|cooked|grilled|boiled)/);
  });
});
