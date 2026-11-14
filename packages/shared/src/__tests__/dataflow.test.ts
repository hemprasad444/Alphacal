// What gets stored: profile values from the Vow screen and REI, meal order, and corrected meal totals.
import { DEFAULT_PROFILE } from '../data';
import { withTotals } from '../food';
import { byTime, changeMeals, dayMeals, findMeal, sameValue } from '../mealGuard';
import { applyUpdate, profileValue, vowChange } from '../rei';
import { isIsoDate } from '../time';
import type { Meal } from '../types';

describe('isIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2026-12-31')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-00-10')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
  });
});

describe('profileValue', () => {
  it('refuses half-typed and empty values', () => {
    expect(profileValue('kcal', '')).toBeNull();
    expect(profileValue('kcal', '0')).toBeNull();
    expect(profileValue('sessionTime', '18:')).toBeNull();
    expect(profileValue('bedtime', '2')).toBeNull();
    expect(profileValue('deadline', '2026-13-01')).toBeNull();
    expect(profileValue('deadline', '2027-02-30')).toBeNull();
    expect(profileValue('height', '')).toBeNull();
    expect(profileValue('age', 'abc')).toBeNull();
    expect(profileValue('goal', '   ')).toBeNull();
  });
  it('keeps finished values, trimmed', () => {
    expect(profileValue('kcal', '2200')).toBe('2200');
    expect(profileValue('weight', ' 80.5 ')).toBe('80.5');
    expect(profileValue('sessionTime', '18:30')).toBe('18:30');
    expect(profileValue('deadline', '2027-03-01')).toBe('2027-03-01');
    expect(profileValue('height', '178')).toBe('178');
    expect(profileValue('goal', 'Lean by summer ')).toBe('Lean by summer');
  });
});

describe('vowChange', () => {
  it('refuses impossible deadlines', () => {
    expect(vowChange('deadline', '2026-13-01')).toBeNull();
    expect(vowChange('deadline', '2026-02-30')).toBeNull();
    expect(vowChange('deadline', '2027-01-31')).toEqual(['deadline', '2027-01-31']);
  });
  it('still keeps height and age out of REI’s reach', () => {
    expect(vowChange('height', '180')).toBeNull();
    expect(vowChange('age', '30')).toBeNull();
  });
});

describe('applyUpdate', () => {
  it('reports the fields it accepted, with their checked values', () => {
    const r = applyUpdate(DEFAULT_PROFILE, { kcal: ' 2100 ', bedtime: '23:', deadline: '2026-13-01' } as never);
    expect(r?.keys).toEqual(['kcal']);
    expect(r?.profile.kcal).toBe('2100');
    expect(r?.profile.bedtime).toBe(DEFAULT_PROFILE.bedtime);
    expect(r?.profile.deadline).toBe(DEFAULT_PROFILE.deadline);
  });
});

const meal = (time: string, name: string, extra: Partial<Meal> = {}): Meal => ({ time, name, kcal: 400, p: 20, c: 40, f: 10, ...extra });

describe('byTime', () => {
  it('puts an edited meal (stored last) back in its place', () => {
    const out = byTime([meal('08:00', 'Oats'), meal('20:00', 'Dinner'), meal('13:00', 'Lunch')]);
    expect(out.map(m => m.name)).toEqual(['Oats', 'Lunch', 'Dinner']);
  });
  it('keeps the logged order within one minute', () => {
    const out = byTime([meal('13:00', 'Rice'), meal('13:00', 'Dal'), meal('09:00', 'Tea')]);
    expect(out.map(m => m.name)).toEqual(['Tea', 'Rice', 'Dal']);
  });
});

describe('withTotals', () => {
  const photo = meal('13:00', 'Biryani', { kcal: 800, src: 'photo', n: { fib: 4, na: 1200 } });
  it('scales micronutrients with corrected calories', () => {
    const out = withTotals(photo, { kcal: 400, p: 15, c: 50, f: 12 });
    expect(out).toMatchObject({ kcal: 400, p: 15, c: 50, f: 12, src: 'photo', n: { fib: 2, na: 600 } });
  });
  it('keeps them when only the macros changed', () => {
    expect(withTotals(photo, { kcal: 800, p: 30.4, c: 90, f: 30 }).n).toEqual({ fib: 4, na: 1200 });
  });
  it('drops them when there is no portion to scale from or to', () => {
    expect(withTotals(photo, { kcal: 0, p: 0, c: 0, f: 0 }).n).toBeUndefined();
    expect('n' in withTotals({ ...photo, kcal: 0 }, { kcal: 300, p: 10, c: 10, f: 10 })).toBe(false);
  });
  it('keeps the meal’s id and rounds', () => {
    expect(withTotals({ ...photo, id: 'abc' }, { kcal: 399.6, p: 15.2, c: 50, f: 12 })).toMatchObject({ id: 'abc', kcal: 400, p: 15 });
  });
});

describe('meal identity', () => {
  let n = 0;
  const id = () => `new${++n}`;
  // Two identical meals from an older build (no ids): the same food twice in one minute.
  const egg = meal('08:00', 'Boiled egg', { kcal: 70 });

  it('sameValue ignores key order and undefined fields', () => {
    expect(sameValue({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1, d: undefined })).toBe(true);
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
  });

  it('deletes one of two identical older meals, not both', () => {
    const out = changeMeals([egg, { ...egg }, meal('13:00', 'Lunch')], { ...egg }, null, id);
    expect(out?.map(m => m.name)).toEqual(['Boiled egg', 'Lunch']);
    expect(out?.every(m => m.id)).toBe(true);
  });

  it('edits one of two identical older meals, in place, and gives it an id', () => {
    const out = changeMeals([egg, { ...egg }], egg, { ...egg, kcal: 80 }, id)!;
    expect(out.map(m => m.kcal)).toEqual([80, 70]);
    expect(new Set(out.map(m => m.id)).size).toBe(2);
  });

  it('finds a meal by id even when its contents changed elsewhere', () => {
    const a = meal('13:00', 'Rice', { id: 'a' }), b = meal('13:00', 'Dal', { id: 'b' });
    const out = changeMeals([b, { ...a, kcal: 999 }], a, { ...a, kcal: 300 }, id)!;
    expect(out.map(m => [m.id, m.kcal])).toEqual([['b', 400], ['a', 300]]);
  });

  it('changes nothing when the meal is gone', () => {
    expect(changeMeals([meal('13:00', 'Dal', { id: 'b' })], meal('13:00', 'Rice', { id: 'a' }), null, id)).toBeNull();
    // An older meal edited elsewhere no longer matches: no second copy.
    expect(changeMeals([{ ...egg, kcal: 90 }], egg, { ...egg, kcal: 80 }, id)).toBeNull();
  });

  it('finds an older meal that has since been given an id', () => {
    expect(findMeal([{ ...egg, id: 'x' }], egg)).toBe(0);
    expect(findMeal([{ ...egg, id: 'x' }, { ...egg }], egg)).toBe(1);
  });

  it('keeps one copy per id: the later one (an edit that raced another)', () => {
    const a = meal('13:00', 'Rice', { id: 'a' }), b = meal('09:00', 'Tea', { id: 'b' });
    expect(dayMeals([a, b, { ...a, kcal: 300 }]).map(m => [m.id, m.kcal])).toEqual([['b', 400], ['a', 300]]);
    expect(changeMeals([a, { ...a, kcal: 300 }], a, null, id)).toEqual([]);
  });
});
