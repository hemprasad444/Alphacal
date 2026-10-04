// A day's eating, broken down: totals for the macros and every nutrient, how much of the day each
// nutrient is actually known for (a guessed meal has no iron figure), and which meal led on each.
import { NUTRIENT_KEYS, type NutrientKey } from './nutrients';
import type { Meal } from './types';

export type IntakeKey = 'kcal' | 'p' | 'c' | 'f' | NutrientKey;

export interface DayIntake {
  totals: Record<IntakeKey, number>;
  /** 0..1: share of the day's calories from meals that report this nutrient. */
  coverage: Record<NutrientKey, number>;
  /** Index of the meal with the most of each, or -1 when nothing has it. */
  top: Record<IntakeKey, number>;
}

const value = (m: Meal, k: IntakeKey): number | undefined => (k === 'kcal' || k === 'p' || k === 'c' || k === 'f' ? m[k] : m.n?.[k]);

export function dayIntake(meals: Meal[]): DayIntake {
  const keys: IntakeKey[] = ['kcal', 'p', 'c', 'f', ...NUTRIENT_KEYS];
  const kcal = meals.reduce((a, m) => a + m.kcal, 0);
  const totals = {} as Record<IntakeKey, number>, top = {} as Record<IntakeKey, number>, coverage = {} as Record<NutrientKey, number>;
  for (const k of keys) {
    let sum = 0, best = -1, bestV = 0;
    meals.forEach((m, i) => {
      const v = value(m, k);
      if (typeof v !== 'number') return;
      sum += v;
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    });
    totals[k] = Math.round(sum * 100) / 100;
    top[k] = best;
  }
  for (const k of NUTRIENT_KEYS) coverage[k] = kcal > 0 ? meals.filter(m => typeof m.n?.[k] === 'number').reduce((a, m) => a + m.kcal, 0) / kcal : 0;
  return { totals, coverage, top };
}
