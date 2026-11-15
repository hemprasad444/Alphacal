// A photo estimate → the meal that is logged: the food list's numbers where it has the food.
import { catalog, DEFAULT_PROFILE } from '@rei/shared';
import { PHOTO_SCHEMA, photoInput, photoMeal, photoNumbers } from '../src/photoMeal';

const foods = catalog();
const item = (name: string, qty: number, unit: string, kcal: number) => ({ name, qty, unit, kcal, p: Math.round(kcal * 0.04), c: Math.round(kcal * 0.12), f: Math.round(kcal * 0.04) });
const base = { name: 'dal rice and roti', kcal: 560, p: 19, c: 95, f: 11, fib: 9, sug: 4, sfa: 3, na: 700, confidence: 0.8, verdict: 'Clean plate.' };

describe('a meal read from a photo', () => {
  it('takes the food list\'s numbers for each item it has', () => {
    const r = photoMeal({ ...base, items: [item('roti', 2, 'piece', 200), item('dal', 1, 'katori', 180), item('cooked rice', 1, 'katori', 200)] }, foods, '13:05');
    expect(r.meal?.items?.map(i => [i.food, i.kcal])).toEqual([['d:roti', 220], ['d:dal', 150], ['d:rice', 195]]);
    expect([r.meal?.kcal, r.meal?.src, r.meal?.name, r.meal?.time]).toEqual([565, 'photo', 'Dal rice and roti', '13:05']);
    expect([r.listed, r.estimated]).toEqual([3, 0]);
    // Fibre and the rest come from the list too when every item is on it.
    expect(r.meal?.n?.fib).toBeGreaterThan(5);
  });
  it('keeps the model\'s estimate for an item the list lacks, and its whole-plate fibre and sodium', () => {
    const r = photoMeal({ ...base, items: [item('roti', 2, 'piece', 200), item('house special gravy', 1, 'katori', 310)] }, foods, '13:05');
    expect(r.meal?.items?.map(i => [i.food, i.kcal])).toEqual([['d:roti', 220], ['', 310]]);
    expect([r.meal?.kcal, r.listed, r.estimated]).toEqual([530, 1, 1]);
    expect(r.meal?.n).toEqual({ fib: 9, sug: 4, sfa: 3, na: 700 });
  });
  it('falls back to the whole-meal estimate when there are no usable items', () => {
    const r = photoMeal({ ...base, items: [{ name: '', qty: 1 }] }, foods, '13:05');
    expect(r.meal).toEqual({ time: '13:05', name: 'Dal rice and roti', kcal: 560, p: 19, c: 95, f: 11, src: 'photo', n: { fib: 9, sug: 4, sfa: 3, na: 700 } });
    expect(photoMeal(base, foods, '13:05').meal?.kcal).toBe(560);
  });
  it('logs nothing when the model is unsure or the output is unusable', () => {
    const unsure = photoMeal({ ...base, confidence: 0.3, verdict: 'Is that paneer or tofu?', items: [item('roti', 2, 'piece', 200)] }, foods, '13:05');
    expect([unsure.meal, unsure.verdict]).toEqual([null, 'Is that paneer or tofu?']);
    expect(photoMeal({ nonsense: true }, foods, '13:05')).toEqual({ meal: null, confidence: 0, verdict: 'Couldn’t read that plate. Tell me what it is and roughly how much.', listed: 0, estimated: 0 });
    expect(photoMeal(null, foods, '13:05').meal).toBeNull();
    expect(photoMeal({ ...base, kcal: -5 }, foods, '13:05').meal).toBeNull();
  });
  it('asks the model for items, and a verdict without numbers', () => {
    expect(PHOTO_SCHEMA.required).toContain('items');
    expect(PHOTO_SCHEMA.properties.verdict.description).toMatch(/without any numbers/);
  });
});

describe('the numbers said after a photo', () => {
  const profile = { ...DEFAULT_PROFILE, kcal: '2100', protein: '150' };
  const meal = { time: '13:05', name: 'x', kcal: 565, p: 19, c: 90, f: 10 };
  it('are what was logged and what that leaves, worked out here', () => {
    expect(photoNumbers(meal, profile, { kcal: 740, protein: 32 })).toBe('565 kcal, 19 g protein. 795 kcal left today, 99 g protein to go.');
    expect(photoNumbers(meal, profile, { kcal: 1800, protein: 140 })).toBe('565 kcal, 19 g protein. 265 kcal over today, protein hit.');
  });
});

describe('the photo sent', () => {
  const jpeg = 'A'.repeat(400);
  it('must be base64 of a sensible size', () => {
    expect(photoInput(jpeg)).toBe(jpeg);
    expect(photoInput(`data:image/jpeg;base64,${jpeg}`)).toBe(jpeg);
    expect(photoInput(`${jpeg.slice(0, 200)}\n${jpeg.slice(200)}==`)).toBe(`${jpeg}==`);
    for (const bad of [undefined, null, 42, '', 'short', `${jpeg}<script>`, 'A'.repeat(2_000_001), { image: jpeg }]) expect(photoInput(bad)).toBeNull();
  });
});
