// Meals as people actually type and say them, matched to the food list: every number below is the list's.
import { catalog, foodByName, foodCandidates, itemFor, matchMealText, piecesIn, resolveAiItems, splitMealText, unitFor, type AiItem } from '../food';

const cat = catalog();
const byId = (id: string) => cat.find(f => f.id === id)!;
/** "2 roti [d:roti] 220 | …" for what a phrase matched, and what it didn't. */
const read = (text: string) => {
  const m = matchMealText(text, cat);
  return { items: m.items.map(i => `${+i.qty.toFixed(2)} ${i.unit} ${i.food} ${i.kcal}`), kcal: Math.round(m.items.reduce((a, i) => a + i.kcal, 0)), unmatched: m.unmatched };
};

describe('real phrases', () => {
  it.each([
    ['2 roti dal sabzi', ['2 roti d:roti 220', '1 katori d:dal 150', '1 katori d:mixed-veg 150'], 520],
    ['a bowl of curd rice', ['1 katori d:curd-rice 260'], 260],
    ['chicken biryani plate', ['1 plate d:chicken-biryani 500'], 500],
    ['3 idli with sambar and chutney', ['3 idli d:idli 174', '1 katori d:sambar 110', '1 tbsp d:coconut-chutney 60'], 344],
    ['whey shake with milk', ['1 scoop d:whey 120', '1 glass d:milk 145'], 265],
    ['2 rotis and a katori of dal', ['2 roti d:roti 220', '1 katori d:dal 150'], 370],
    ['1 bowl dal 2 roti 1 bowl rice', ['1 katori d:dal 150', '2 roti d:roti 220', '1 katori d:rice 195'], 565],
    ['roti sabzi', ['1 roti d:roti 110', '1 katori d:mixed-veg 150'], 260],
    ['fish curry rice', ['1 katori d:fish-curry 210', '1 katori d:rice 195'], 405],
    ['2 eggs and a banana', ['2 egg d:boiled-egg 156', '1 banana i:E009 112'], 268],
    ['oats with milk and banana', ['1 bowl d:oats 270', '1 banana i:E009 112'], 382],
    ['2 dosa with chutney', ['2 dosa d:dosa 340', '1 tbsp d:coconut-chutney 60'], 400],
    ['2 slices bread with butter', ['2 slice d:bread 134', '1 tbsp d:butter 105'], 239],
    ['whey with water', ['1 scoop d:whey 120', '1 glass d:water 0'], 120],
    ['2 scoops whey with milk', ['2 scoop d:whey 240', '1 glass d:milk 145'], 385],
  ] as const)('%s', (text, items, kcal) => {
    expect(read(text)).toEqual({ items, kcal, unmatched: [] });
  });

  it('reads an amount or a portion that comes after the food', () => {
    expect(read('samosa 2').items).toEqual(['2 samosa d:samosa 520']);
    expect(read('paneer 100g').items).toEqual(['100 g i:L003 258']);
    expect(read('paneer sabzi 1 bowl').items).toEqual(['1 katori d:kadai-paneer 300']);
    expect(read('ghee 1 tsp').items).toEqual(['1 tsp i:T013 45']);
    expect(read('sugar 2 tsp').items).toEqual(['2 tsp d:sugar 38']);
    expect(read('buttermilk glass').items).toEqual(['1 glass d:chaas 40']);
    expect(read('chole bhature 1 plate').items).toEqual(['1 plate d:chole-bhature 700']);
    expect(read('roasted chana handful').items).toEqual(['1 handful d:roasted-chana 115']);
    expect(read('boiled eggs 3').items).toEqual(['3 egg d:boiled-egg 234']);
    expect(read('3 chapati and chicken curry 1 bowl').kcal).toBe(570);
  });

  it('keeps a number or a portion word that belongs to the food\'s name', () => {
    expect(read('chicken 65').items).toEqual(['1 100 g d:chicken-65 245']);
    expect(read('burrito bowl').items).toEqual(['1 bowl d:burrito-bowl 560']);
    expect(read('fruit bowl').items).toEqual(['1 katori d:fruit-bowl 98']);
  });

  it('counts pieces of a portion that is several pieces', () => {
    // The list's portion is "6 puris": six of them is one portion, not six.
    expect(read('pani puri').items).toEqual(['1 6 puris d:pani-puri 200']);
    expect(read('6 pani puri').items).toEqual(['6 piece d:pani-puri 200']);
    expect(read('pani puri 6 pieces').items).toEqual(['6 piece d:pani-puri 200']);
    expect(read('20 almonds').kcal).toBe(140);
    expect(read('2 momos').kcal).toBe(83);
    expect(piecesIn({ n: '6 puris', g: 120 })).toBe(6);
    expect([piecesIn({ n: '100 g', g: 100 }), piecesIn({ n: 'katori', g: 150 }), piecesIn({ n: '6 inch', g: 220 })]).toEqual([0, 0, 0]);
    expect(unitFor(byId('d:pani-puri'), 'piece')).toEqual({ n: 'piece', g: 20 });
    expect(unitFor(byId('d:bread-butter'), 'slice')).toEqual({ n: 'slice', g: 30 });
    // Picking the portion by its own name in the app still means that many portions.
    expect(itemFor(byId('d:pani-puri'), 2, '6 puris').kcal).toBe(400);
  });

  it('understands Hinglish and romanised Telugu', () => {
    expect(read('maine 2 roti aur dal khayi')).toEqual({ items: ['2 roti d:roti 220', '1 katori d:dal 150'], kcal: 370, unmatched: [] });
    expect(read('bhai abhi 3 idli aur sambar khaya')).toEqual({ items: ['3 idli d:idli 174', '1 katori d:sambar 110'], kcal: 284, unmatched: [] });
    expect(read('bhai 2 anda aur 4 bread khaya').kcal).toBe(424);
    expect(read('2 chapati aur dal').kcal).toBe(370);
    expect(read('pappu annam').items).toEqual(['1 plate d:dal-chawal 425']);
    expect(read('perugu annam').items).toEqual(['1 katori d:curd-rice 260']);
    expect(read('kodi kura annam').kcal).toBe(435);
    expect(read('ragi java').items).toEqual(['1 glass d:ragi-malt 176']);
    expect(read('2 guddu').kcal).toBe(156);
  });

  it('means the everyday food by a plain word', () => {
    expect(read('dosa').items).toEqual(['1 dosa d:dosa 170']);
    expect(read('oats').items).toEqual(['1 bowl d:oats 270']);
    expect(read('bowl of oats').items).toEqual(['1 bowl d:oats 270']);
    expect(read('sprouts').items).toEqual(['1 katori d:sprouts 110']);
    expect(read('chicken fry').items).toEqual(['1 katori d:chicken-fry 270']);
    expect(read('one banana').kcal).toBe(112);
    expect(read('mango').items[0]).toMatch(/^1 mango i:E0/);
    expect(read('egg').items).toEqual(['1 egg d:boiled-egg 78']);
  });

  it('never turns words that are not food into food', () => {
    for (const text of ['going to a movie with my friends', 'when is my workout', 'what should i eat', 'i am tired today', 'leg day', 'log my snack please', 'how many days to my deadline', 'chicken', 'aloo']) {
      expect(read(text).items).toEqual([]);
    }
    expect(read('curd rice and pickle')).toEqual({ items: ['1 katori d:curd-rice 260'], kcal: 260, unmatched: ['pickle'] });
    // A stray pair of words isn't split into two foods unless each is a food's own name.
    expect(read('4 idli chutney sambar').items).toEqual(['4 idli d:idli 232', '1 tbsp d:coconut-chutney 60', '1 katori d:sambar 110']);
  });

  it('offers REI the foods a message might mean, including the whole name', () => {
    const ids = (t: string) => foodCandidates(t, cat).map(f => f.id);
    expect(ids('had chicken 65 and 2 roti')).toEqual(expect.arrayContaining(['d:chicken-65', 'd:roti']));
    expect(ids('bhai abhi 3 idli aur sambar khaya')).toEqual(expect.arrayContaining(['d:idli', 'd:sambar']));
    expect(splitMealText('I just had 2 eggs for breakfast').map(p => p.query)).toEqual(['eggs']);
  });
});

describe('composed dishes', () => {
  it('add up from the list\'s own rows', () => {
    const part = (id: string, g: number) => byId(id).kcal * (g / byId(id).per);
    // Ragi malt: 30 g ragi flour + 100 ml toned milk + 5 g jaggery.
    expect(Math.abs(part('i:A010', 30) + part('d:milk', 100) + part('i:I001', 5) - byId('d:ragi-malt').kcal)).toBeLessThan(3);
    // Fruit bowl: 50 g each of banana, apple and papaya.
    expect(Math.abs(part('i:E012', 50) + part('i:E001', 50) + part('i:D059', 50) - byId('d:fruit-bowl').kcal)).toBeLessThan(3);
    // Chicken fry: 100 g cooked chicken breast + 10 g fat, plus about 15 kcal of onion and spices.
    expect(Math.abs(part('d:grilled-chicken', 100) + part('i:T013', 10) + 15 - byId('d:chicken-fry').kcal)).toBeLessThan(3);
    expect(byId('d:water').kcal).toBe(0);
    for (const id of ['d:ragi-malt', 'd:fruit-bowl', 'd:chicken-fry', 'd:sugar']) {
      const f = byId(id);
      // Protein, carbs and fat account for the calories.
      expect(Math.abs(4 * f.p + 4 * f.c + 9 * f.f - f.kcal)).toBeLessThan(f.kcal * 0.12 + 5);
    }
  });
});

describe('foods REI names itself', () => {
  const ai = (name: string, qty: number, unit: string, kcal: number): AiItem => ({ food_id: 'none', name, qty, unit, kcal, p: Math.round(kcal * 0.04), c: Math.round(kcal * 0.12), f: Math.round(kcal * 0.04) });

  it('are looked up by name, and the list\'s numbers used', () => {
    expect(foodByName('roti', cat)?.id).toBe('d:roti');
    expect(foodByName('Paneer butter masala', cat)?.id).toBe('d:paneer-butter-masala');
    expect(foodByName('mom’s special pulao', cat)).toBeNull();
    // The way a model words them: the describing word first, or extra ones that change nothing.
    const named = (n: string) => foodByName(n, cat)?.id;
    expect(['cooked rice', 'steamed rice', 'plain roti', 'whole wheat roti', 'homemade dal', 'a bowl of dal', 'boiled egg', 'grilled chicken breast', 'plain dosa', 'sweet lassi', 'Chapati'].map(named))
      .toEqual(['d:rice', 'd:rice', 'd:roti', 'd:roti', 'd:dal', 'd:dal', 'd:boiled-egg', 'd:grilled-chicken', 'd:dosa', 'd:lassi', 'd:roti']);
    const [roti, dal] = resolveAiItems([ai('Roti', 2, 'piece', 200), ai('dal', 1, 'katori', 180)], cat);
    expect([roti.food, roti.kcal, roti.unit]).toEqual(['d:roti', 220, 'roti']);
    expect([dal.food, dal.kcal]).toEqual(['d:dal', 150]);
  });
  it('stay REI\'s estimate when the list has no such food, or disagrees wildly', () => {
    const [x] = resolveAiItems([ai('Office canteen special', 1, 'serving', 550)], cat);
    expect([x.food, x.kcal]).toEqual(['', 550]);
    // "Idli" at 900 kcal isn't the list's idli (58): REI's number stands and it is marked an estimate (no food id).
    const [odd] = resolveAiItems([ai('idli', 1, 'piece', 900)], cat);
    expect([odd.food, odd.kcal]).toEqual(['', 900]);
  });
  it('read a count of a several-piece portion as pieces', () => {
    const [puri] = resolveAiItems([{ food_id: 'd:pani-puri', name: 'Pani puri', qty: 6, unit: '6 puris', kcal: 200, p: 4, c: 32, f: 6 }], cat);
    expect(puri.kcal).toBe(200);
    // Two plates really is two plates.
    const [two] = resolveAiItems([{ food_id: 'd:pani-puri', name: 'Pani puri', qty: 2, unit: '6 puris', kcal: 400, p: 8, c: 64, f: 12 }], cat);
    expect(two.kcal).toBe(400);
  });
});
