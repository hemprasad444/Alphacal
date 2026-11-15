// What REI says about a logged meal carries only numbers the app computed.
import { DEFAULT_DISCIPLINES, DEFAULT_PROFILE, type ContextInput, type Meal } from '@rei/shared';
import { groundedReply, looseFigures, mealLine } from '../src/chat/brain';

const known = {
  input: {
    profile: { ...DEFAULT_PROFILE, kcal: '2100', protein: '150' }, disc: DEFAULT_DISCIPLINES, sessionDone: false, history: { kind: 'demo', scenario: 'Strong week' }, activity: { steps: null, sleep: null, sleepL: '' },
    tough: true, nudge: true, now: new Date(2026, 10, 15, 14, 5),
    // Eaten so far: 740 kcal, 32 g protein. Left: 1360 and 118.
    meals: [{ time: '08:10', name: 'Eggs and toast', kcal: 290, p: 17, c: 25, f: 12 }, { time: '13:20', name: 'Rajma chawal', kcal: 450, p: 15, c: 75, f: 9 }],
  } as ContextInput,
};
/** 2 roti and dal from the food list: after it 990 kcal and 103 g protein are left. */
const meal: Meal = { time: '14:05', name: 'Roti and dal', kcal: 370, p: 15, c: 58, f: 10, items: [{ food: 'd:roti', name: 'Roti', qty: 2, unit: 'roti', g: 80, kcal: 220, p: 7, c: 38, f: 5 }, { food: 'd:dal', name: 'Dal, tadka', qty: 1, unit: 'katori', g: 150, kcal: 150, p: 8, c: 20, f: 4.5 }] };
const SYSTEM = 'SUGGESTIONS … 1. 6 pieces of chicken tikka: 270 kcal, 45 g protein, 6 g carbs, 9 g fat';
const loose = (text: string) => looseFigures(text, meal, known, SYSTEM);

describe('figures in a reply about a logged meal', () => {
  it('pass when they are the meal, what it leaves, the day so far, a target or something REI was given', () => {
    for (const ok of [
      'Roti and dal, 370 kcal and 15 g protein. 990 kcal and 103 g protein left.',
      'That puts you at 1110 kcal of 2100, with 47 g protein of 150.',
      'The rotis are 220 kcal, the dal 150 kcal. Next: 6 pieces of chicken tikka, 270 kcal and 45 g protein.',
      'ठीक है, 370 kcal. अब 990 kcal और 103 g प्रोटीन बाकी हैं।',
      'మూడు ఇడ్లీలు బాగుంది. ఇంకా 990 kcal మిగిలాయి.',
      'You had 1,360 kcal left before this; 990 calories now.',
      'Solid. Calisthenics at 18:30, bed by 23:00.',
    ]) expect(loose(ok)).toEqual([]);
  });
  it('are caught when the model worked them out itself', () => {
    expect(loose('About 320 kcal, so roughly 1,040 kcal left.')).toEqual([320, 1040]);
    expect(loose('अब करीब 1,060 kcal और 118 g प्रोटीन बचे हैं')).toEqual([1060]);
    expect(loose('That leaves 1000 calories and 98 g protein.')).toEqual([1000, 98]);
    expect(loose('సుమారు 1,050 kcal మిగిలింది')).toEqual([1050]);
  });
  it('a reply with one is cut down to what is true, plus the plain line', () => {
    expect(groundedReply('Good plate. About 320 kcal, so roughly 1,040 left. Protein next.', meal, known, SYSTEM)).toBe('Good plate. Protein next. 370 kcal, 15 g protein logged. 990 kcal left and 103 g protein to go today.');
    expect(groundedReply('बढ़िया। अब करीब 1,060 kcal बचे हैं।', meal, known, SYSTEM)).toBe('बढ़िया। 370 kcal, 15 g protein logged. 990 kcal left and 103 g protein to go today.');
    expect(groundedReply('Roughly 1,040 kcal left.', meal, known, SYSTEM)).toBe(mealLine(meal, known));
    const fine = 'Good. 370 kcal, 990 kcal left.';
    expect(groundedReply(fine, meal, known, SYSTEM)).toBe(fine);
  });
  it('says over and hit, not negative numbers', () => {
    const feast = { ...meal, kcal: 1500, p: 130 };
    expect(mealLine(feast, known)).toBe('1500 kcal, 130 g protein logged. 140 kcal over the target and the protein target hit today.');
  });
});
