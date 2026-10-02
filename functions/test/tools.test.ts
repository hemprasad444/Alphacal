import { parseMeal, parseMealItems, parseVow } from '../src/chat/tools';

describe('parseMeal', () => {
  it('accepts a sane estimate and rounds', () => {
    expect(parseMeal({ name: ' salmon bowl ', kcal: 610.4, p: 45, c: 60, f: 18 })).toEqual({ name: 'salmon bowl', kcal: 610, p: 45, c: 60, f: 18 });
  });
  it('keeps a verdict when present', () => {
    expect(parseMeal({ name: 'x', kcal: 1, p: 1, c: 1, f: 1, verdict: ' Good. ' })?.verdict).toBe('Good.');
  });
  it('rejects missing, negative or absurd values', () => {
    expect(parseMeal({ name: 'x', kcal: 500, p: 20, c: 50 })).toBeNull();
    expect(parseMeal({ name: 'x', kcal: -1, p: 20, c: 50, f: 1 })).toBeNull();
    expect(parseMeal({ name: 'x', kcal: 90000, p: 20, c: 50, f: 1 })).toBeNull();
    expect(parseMeal({ name: '', kcal: 500, p: 20, c: 50, f: 1 })).toBeNull();
    expect(parseMeal(null)).toBeNull();
  });
});

describe('parseVow', () => {
  it('keeps valid changes only', () => {
    expect(parseVow({ changes: [
      { field: 'protein', value: '180' },
      { field: 'deadline', value: '2027-04-01' },
      { field: 'kcal', value: 'lots' },
      { field: 'deadline', value: 'next month' },
      { field: 'isAdmin', value: 'true' },
    ] })).toEqual({ protein: '180', deadline: '2027-04-01' });
  });
  it('returns null when nothing usable', () => {
    expect(parseVow({ changes: [] })).toBeNull();
    expect(parseVow({})).toBeNull();
  });
});

describe('parseMealItems', () => {
  const item = { food_id: 'd:roti', name: 'Roti', qty: 2, unit: 'roti', kcal: 220, p: 7, c: 38, f: 5 };
  it('keeps valid items and the verdict', () => {
    expect(parseMealItems({ name: ' Lunch ', items: [item], verdict: ' Solid. ' })).toEqual({ name: 'Lunch', items: [item], verdict: 'Solid.' });
  });
  it('drops broken items, and the meal when none are left', () => {
    const r = parseMealItems({ name: 'x', items: [item, { ...item, qty: 0 }, { ...item, kcal: -5 }, { ...item, name: '' }, null] });
    expect(r?.items).toHaveLength(1);
    expect(parseMealItems({ name: 'x', items: [{ ...item, qty: -1 }] })).toBeNull();
    expect(parseMealItems({ name: 'x', items: [] })).toBeNull();
    expect(parseMealItems({ items: [item] })).toBeNull();
  });
});
