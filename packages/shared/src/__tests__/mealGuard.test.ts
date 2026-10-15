import { shouldLogMeal } from '../mealGuard';
import type { Meal } from '../types';

const meal = (name: string, kcal: number, time = '13:40', items: string[] = []): Meal => ({ time, name, kcal, p: 30, c: 100, f: 20, items: items.map(n => ({ food: '', name: n, qty: 1, unit: 'serving', kcal: 0, p: 0, c: 0, f: 0 })) as Meal['items'] });
const biryani = meal('Chicken biryani and Coke', 890, '13:40', ['Chicken biryani, office canteen', 'Coke']);

describe('meals REI logs from chat', () => {
  it('refuses a meal the message never talks about (the movie re-logging the lunch)', () => {
    expect(shouldLogMeal('Skipping the calisthenics today bro, going to a movie with my friends, Dune 3 at 7. talk later', biryani, [biryani], '18:10')).toEqual({ ok: false, why: 'not mentioned' });
    expect(shouldLogMeal('ok bye', biryani, [], '18:12').ok).toBe(false);
  });

  it('logs food the message names or says was eaten', () => {
    expect(shouldLogMeal('just had 2 rotis with dal', meal('2 Roti + Dal', 400, '20:00', ['Roti', 'Dal, tadka']), [biryani], '20:00').ok).toBe(true);
    expect(shouldLogMeal('2 eggs and toast', meal('Egg, boiled + Bread', 300, '08:00', ['Egg, boiled', 'Bread, white']), [], '08:00').ok).toBe(true);
    expect(shouldLogMeal('dinner was paneer tikka', meal('Paneer tikka', 350, '21:00'), [], '21:00').ok).toBe(true);
  });

  it('refuses the same meal twice within three hours unless they say it was another one', () => {
    expect(shouldLogMeal('the biryani was so good', meal('Chicken biryani', 760, '14:30'), [biryani], '14:30')).toEqual({ ok: false, why: 'already logged' });
    expect(shouldLogMeal('had another biryani lol', meal('Chicken biryani', 760, '14:30'), [biryani], '14:30').ok).toBe(true);
    expect(shouldLogMeal('biryani again for dinner', meal('Chicken biryani', 760, '21:00'), [biryani], '21:00').ok).toBe(true);
  });

  it('treats a different meal with a shared word as a new meal', () => {
    expect(shouldLogMeal('chicken salad for dinner', meal('Chicken salad', 350, '14:00'), [biryani], '14:00').ok).toBe(true);
  });
});

describe('the final-run cases', () => {
  it('refuses a re-logged meal the model named after the chat ("Movie outing")', () => {
    const relog = meal('Movie outing', 950, '18:10', ['Chicken biryani, canteen serving', 'Coke']);
    expect(shouldLogMeal('Rest day so no gym bro, going to a movie with my friends, Dune 3 at 7. talk later', relog, [biryani], '18:10').ok).toBe(false);
  });
  it('refuses the same food hours later when they only talk about it, logs it when they ate it again', () => {
    expect(shouldLogMeal('that biryani was so good', meal('Chicken biryani', 760, '20:00'), [biryani], '20:00').ok).toBe(false);
    expect(shouldLogMeal('had biryani for dinner', meal('Chicken biryani', 760, '20:30', ['Chicken biryani']), [biryani], '20:30').ok).toBe(true);
  });
});

describe('workouts from chat', () => {
  const { shouldLogWorkout } = jest.requireActual('../mealGuard') as typeof import('../mealGuard');
  const gym = { date: '2026-10-05', plan: 'PUSH', title: 'Push', done: 16, total: 16, seconds: 2700, sets: [] } as never;
  const chatPush = { date: '2026-10-05', plan: 'PUSH', title: 'Push day', done: 1, total: 1, seconds: 2700 } as never;
  const run = { date: '2026-10-05', plan: 'RUN', title: 'Run', done: 1, total: 1, seconds: 1600, cardio: { km: 5, seconds: 1600, kind: 'run' } } as never;
  it('does not log the gym session again after it was saved in the app', () => {
    expect(shouldLogWorkout('just smashed push day, benched 85 for 5', chatPush, [gym])).toEqual({ ok: false, why: 'already logged' });
  });
  it('logs a different kind, or a second one they say is another', () => {
    expect(shouldLogWorkout('also ran 5k after', run, [gym]).ok).toBe(true);
    expect(shouldLogWorkout('did a second session tonight', chatPush, [gym]).ok).toBe(true);
    expect(shouldLogWorkout('did push day', chatPush, []).ok).toBe(true);
  });
});
