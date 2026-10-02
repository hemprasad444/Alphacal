import { catalog, DISHES, foodCandidates, searchFoodsLinear, foodFromMeal, IFCT, itemFor, matchMealText, mealFromItems, offToFood, resolveAiItems, searchFoods, splitMealText, unitFor, validFood, type Food } from '../food';

const cat = catalog();
const byId = (id: string) => cat.find(f => f.id === id)!;
const top = (q: string, foods: Food[] = cat) => searchFoods(q, foods, 1)[0]?.food.name;

describe('the food list', () => {
  it('has the IFCT tables and the dishes, with unique ids', () => {
    expect(IFCT.length).toBe(542);
    expect(cat.length).toBe(IFCT.length + DISHES.length);
    expect(new Set(cat.map(f => f.id)).size).toBe(cat.length);
  });

  it('keeps every dish’s calories consistent with its macros', () => {
    // Beer's calories are mostly alcohol, which isn't a macro here.
    for (const [id, , , units, kcal, p, c, f] of DISHES.filter(d => d[0] !== 'beer')) {
      const est = 4 * p + 4 * c + 9 * f;
      expect({ id, off: Math.abs(kcal - est) / Math.max(kcal, 20) < 0.2 }).toEqual({ id, off: true });
      expect(units[0][1]).toBeGreaterThan(0);
    }
  });

  it('derives IFCT calories from the macros (the source energy column has errors)', () => {
    const ghee = byId('i:T013'), egg = byId('i:M001');
    expect(ghee.kcal).toBe(900);
    expect(egg.kcal).toBeGreaterThan(130);
    expect(egg.kcal).toBeLessThan(140);
  });

  it('passes its own validation', () => {
    expect(cat.filter(f => !validFood(f)).map(f => f.id)).toEqual([]);
  });
});

describe('searchFoods', () => {
  it.each([
    ['roti', 'Roti'], ['chapati', 'Roti'], ['dal', 'Dal, tadka'], ['rice', 'Rice, cooked'], ['eggs', 'Egg, boiled'],
    ['idly', 'Idli'], ['curd', 'Curd'], ['dahi', 'Curd'], ['ghee', 'Ghee'], ['chicken breast', 'Chicken breast, grilled'],
    ['moong phali', 'Peanuts, roasted'], ['singdana', 'Peanuts, roasted'], ['bajra', 'Bajra'], ['toor dal', 'Dal, tadka'],
  ])('%s → %s', (q, name) => expect(top(q)).toBe(name));

  it('puts your own foods first when they match', () => {
    const mine: Food = { id: 'm:x1', name: 'Roti, my mum’s', per: 1, kcal: 140, p: 4, c: 20, f: 5, units: [{ n: 'serving', g: 1 }], src: 'mine', serving: true };
    expect(top('roti', [...cat, mine])).toBe('Roti, my mum’s');
  });

  it('returns nothing for an empty query', () => {
    expect(searchFoods('  the ', cat)).toEqual([]);
  });
});

describe('portions', () => {
  it('uses the food’s own portions, generic ones, or grams', () => {
    const rice = byId('d:rice');
    expect(unitFor(rice, 'plate')).toEqual({ n: 'plate', g: 250 });
    expect(unitFor(rice, 'bowl')).toEqual({ n: 'katori', g: 150 });
    expect(unitFor(rice, 'grams')).toEqual({ n: 'g', g: 1 });
    expect(unitFor(rice, 'tbsp')).toEqual({ n: 'tbsp', g: 15 });
    expect(unitFor(rice)).toEqual({ n: 'katori', g: 150 });
  });

  it('scales macros by weight', () => {
    expect(itemFor(byId('d:roti'), 2)).toEqual({ food: 'd:roti', name: 'Roti', qty: 2, unit: 'roti', g: 80, kcal: 220, p: 7, c: 38, f: 5 });
    expect(itemFor(byId('d:grilled-chicken'), 200, 'g').kcal).toBe(330);
  });

  it('adds items up into a meal', () => {
    const m = mealFromItems([itemFor(byId('d:roti'), 2), itemFor(byId('d:dal'), 1)], '13:10', 'food');
    expect(m).toMatchObject({ time: '13:10', name: '2 Roti + Dal, tadka', kcal: 370, p: 15, c: 58, f: 10, src: 'food' });
  });
});

describe('typed meals', () => {
  it('splits amounts, portions and foods', () => {
    expect(splitMealText('Just ate: 2 rotis and a katori of dal, 200g chicken + half plate rice')).toEqual([
      { text: '2 rotis', qty: 2, unit: undefined, query: 'rotis' },
      { text: 'a katori of dal', qty: 1, unit: 'katori', query: 'dal' },
      { text: '200g chicken', qty: 200, unit: 'g', query: 'chicken' },
      { text: 'half plate rice', qty: 0.5, unit: 'plate', query: 'rice' },
    ]);
  });

  it('matches what it is sure about and leaves the rest for REI', () => {
    const r = matchMealText('2 rotis, dal and chicken', cat);
    expect(r.items.map(i => `${i.qty} ${i.name}`)).toEqual(['2 Roti', '1 Dal, tadka']);
    expect(r.unmatched).toEqual(['chicken']);
  });

  it('separates two foods written without "and"', () => {
    expect(matchMealText('2 idli sambar', cat).items.map(i => `${i.qty} ${i.name}`)).toEqual(['2 Idli', '1 Sambar']);
  });

  it('offers REI the close candidates', () => {
    const ids = foodCandidates('chicken and rice', cat).map(f => f.id);
    expect(ids).toContain('d:chicken-curry');
    expect(ids).toContain('d:rice');
    expect(ids.length).toBeLessThanOrEqual(16);
  });
});

describe('resolveAiItems', () => {
  it('uses the list’s numbers when REI picked a food, and REI’s estimate otherwise', () => {
    const items = resolveAiItems([
      { food_id: 'd:roti', name: 'roti', qty: 3, unit: 'roti', kcal: 999, p: 0, c: 0, f: 0 },
      { food_id: 'none', name: 'Mom’s special curry', qty: 1, unit: 'katori', kcal: 280, p: 12.04, c: 20, f: 15 },
      { food_id: 'd:not-real', name: 'x', qty: 1, unit: '', kcal: 100, p: 1, c: 1, f: 1 },
    ], cat);
    expect(items[0]).toMatchObject({ food: 'd:roti', kcal: 330 });
    expect(items[1]).toEqual({ food: '', name: 'Mom’s special curry', qty: 1, unit: 'katori', g: 0, kcal: 280, p: 12, c: 20, f: 15 });
    expect(items[2]).toMatchObject({ food: '', unit: 'serving', kcal: 100 });
  });
});

describe('offToFood', () => {
  const body = {
    status: 1,
    product: { product_name: 'Amul Taaza Toned Milk', brands: 'Amul, GCMMF', quantity: '500 ml', serving_quantity: 200, nutriments: { 'energy-kcal_100g': 58, proteins_100g: 3.1, carbohydrates_100g: 4.7, fat_100g: 3 } },
  };

  it('reads name, brand, portions and per-100 g macros', () => {
    expect(offToFood('8901262150101', body)).toEqual({
      id: 'b:8901262150101', name: 'Amul Taaza Toned Milk', brand: 'Amul', barcode: '8901262150101', per: 100, kcal: 58, p: 3.1, c: 4.7, f: 3,
      units: [{ n: 'serving', g: 200 }, { n: 'pack', g: 500 }, { n: '100 g', g: 100 }], src: 'barcode',
    });
  });

  it('falls back to kJ, and rejects products without numbers or names', () => {
    const kj = offToFood('1', { product: { product_name: 'X', nutriments: { energy_100g: 1674, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 12 } } });
    expect(kj?.kcal).toBe(400);
    expect(offToFood('1', { status: 0 })).toBeNull();
    expect(offToFood('1', { product: { product_name: 'X', nutriments: {} } })).toBeNull();
    expect(offToFood('1', { product: { nutriments: { 'energy-kcal_100g': 5 } } })).toBeNull();
  });
});

it('saves a meal as a food counted in servings', () => {
  const f = foodFromMeal({ time: '08:00', name: 'Usual breakfast', kcal: 420, p: 30, c: 40, f: 14 }, 'm:abc123');
  expect(validFood(f)).toBe(true);
  expect(itemFor(f, 2)).toMatchObject({ unit: 'serving', g: 0, kcal: 840, p: 60 });
});

describe('search index', () => {
  it('returns exactly what a full scan returns', () => {
    const mine: Food = { id: 'm:x2', name: 'Paneer wrap, office canteen', per: 1, kcal: 420, p: 22, c: 40, f: 18, units: [{ n: 'serving', g: 1 }], src: 'mine', serving: true };
    const lists = [cat, [mine, ...cat], cat.filter(f => f.id !== 'd:roti')];
    for (const foods of lists)
      for (const q of ['roti', 'pa', 'chi', 'dal', 'paneer wrap', 'egg', 'rice cook', 'moong', 'bajra', 'ban', 'curd rice', 'xyz', 'ghee', 'chicken breast', 'masala dosa'])
        expect(searchFoods(q, foods, 8).map(m => m.food.id)).toEqual(searchFoodsLinear(q, foods, 8).map(m => m.food.id));
  });
});
