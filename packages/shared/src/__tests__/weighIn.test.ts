import { saysNumber, weighInFrom } from '../mealGuard';

describe('weighInFrom', () => {
  it.each([
    ['weighed 83.5 this morning', 83.5],
    ['Weighed in at 82.9 today bro', 82.9],
    ['I weigh 84 now', 84],
    ['weigh-in: 83.2', 83.2],
    ['scale says 83.4, finally moving', 83.4],
    ['83.1 on the scale this morning', 83.1],
    ["I'm 82.6 kg today", 82.6],
    ['down to 82.4 kilos!', 82.4],
    ['weighed 83.5 before breakfast', 83.5],
    ['weighed 83.4, will keep pushing', 83.4],
  ])('reads "%s"', (text, kg) => expect(weighInFrom(text, 84)).toBe(kg));

  it.each([
    'I want to weigh 75 by March',
    'I should weigh 80 by the wedding',
    'used to weigh 90',
    'weighed 92 last year',
    'weighed 180 lbs',
    'weighed 150g of rice',
    'up to 85 kg on bench',
    'benched 85 for 5 now',
    "I'm 25",
    'now 85 for 5 on bench',
    'going to a movie at 7',
    'weighed 60 this morning',
  ])('ignores "%s"', text => expect(weighInFrom(text, 84)).toBeNull());

  it('needs no current weight', () => expect(weighInFrom('weighed 70.2 today', 0)).toBe(70.2));
});

describe('saysNumber', () => {
  it('finds the weight they gave', () => {
    expect(saysNumber('weighed 83.5 this morning', 83.5)).toBe(true);
    expect(saysNumber("I'm 82 now", 82)).toBe(true);
    expect(saysNumber('update my weight to 82.0', 82)).toBe(true);
  });
  it('rejects a weight they never said', () => {
    expect(saysNumber('night shift killed me yesterday, didnt log anything', 83.5)).toBe(false);
    expect(saysNumber('benched 85 for 5', 83.5)).toBe(false);
  });
});
