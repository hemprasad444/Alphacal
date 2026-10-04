// Beyond the macros: fibre, the "watch" nutrients (sugar, saturated fat, sodium) and the vitamins
// and minerals. Foods and meals carry these as a sparse map (`n`), per the food's `per` grams.
// Daily targets follow ICMR-NIN 2020 (Indian adults, sedentary); the limits follow WHO.

export type NutrientKey = 'fib' | 'sug' | 'sfa' | 'na' | 'k' | 'ca' | 'fe' | 'mg' | 'zn' | 'va' | 'vc' | 'vd' | 've' | 'b1' | 'b2' | 'b3' | 'b6' | 'fol';
export type Nutrients = Partial<Record<NutrientKey, number>>;
export type NutrientGroup = 'fibre' | 'limit' | 'mineral' | 'vitamin';

export interface NutrientInfo {
  key: NutrientKey;
  name: string;
  unit: 'g' | 'mg' | 'µg';
  group: NutrientGroup;
  /** Decimal places when shown. */
  dp: number;
}

/** In display order. The catalogue files store values in exactly this order. */
export const NUTRIENTS: NutrientInfo[] = [
  { key: 'fib', name: 'Fibre', unit: 'g', group: 'fibre', dp: 0 },
  { key: 'sug', name: 'Sugar', unit: 'g', group: 'limit', dp: 0 },
  { key: 'sfa', name: 'Saturated fat', unit: 'g', group: 'limit', dp: 0 },
  { key: 'na', name: 'Sodium', unit: 'mg', group: 'limit', dp: 0 },
  { key: 'k', name: 'Potassium', unit: 'mg', group: 'mineral', dp: 0 },
  { key: 'ca', name: 'Calcium', unit: 'mg', group: 'mineral', dp: 0 },
  { key: 'fe', name: 'Iron', unit: 'mg', group: 'mineral', dp: 1 },
  { key: 'mg', name: 'Magnesium', unit: 'mg', group: 'mineral', dp: 0 },
  { key: 'zn', name: 'Zinc', unit: 'mg', group: 'mineral', dp: 1 },
  { key: 'va', name: 'Vitamin A', unit: 'µg', group: 'vitamin', dp: 0 },
  { key: 'vc', name: 'Vitamin C', unit: 'mg', group: 'vitamin', dp: 0 },
  { key: 'vd', name: 'Vitamin D', unit: 'µg', group: 'vitamin', dp: 1 },
  { key: 've', name: 'Vitamin E', unit: 'mg', group: 'vitamin', dp: 1 },
  { key: 'b1', name: 'Thiamine (B1)', unit: 'mg', group: 'vitamin', dp: 1 },
  { key: 'b2', name: 'Riboflavin (B2)', unit: 'mg', group: 'vitamin', dp: 1 },
  { key: 'b3', name: 'Niacin (B3)', unit: 'mg', group: 'vitamin', dp: 0 },
  { key: 'b6', name: 'Vitamin B6', unit: 'mg', group: 'vitamin', dp: 1 },
  { key: 'fol', name: 'Folate', unit: 'µg', group: 'vitamin', dp: 0 },
];

export const NUTRIENT_KEYS = NUTRIENTS.map(n => n.key);
export const nutrientInfo = (k: NutrientKey) => NUTRIENTS.find(n => n.key === k)!;

export type Sex = 'Male' | 'Female';

/** Daily target per nutrient: a goal to reach, or (for the limit group) a ceiling to stay under. */
export function dailyTargets(o: { kcal: number; sex?: Sex | null }): Record<NutrientKey, number> {
  const man = o.sex !== 'Female';
  const kcal = o.kcal > 0 ? o.kcal : 2000;
  return {
    // 14 g per 1,000 kcal, at least 25 g.
    fib: Math.max(25, Math.round((kcal / 1000) * 14)),
    // Under 10% of calories each.
    sug: Math.round((kcal * 0.1) / 4),
    sfa: Math.round((kcal * 0.1) / 9),
    na: 2000,
    k: 3500,
    ca: 1000,
    fe: man ? 19 : 29,
    mg: man ? 440 : 370,
    zn: man ? 17 : 13.2,
    va: man ? 1000 : 840,
    vc: man ? 80 : 65,
    vd: 15,
    ve: 10,
    b1: 1.4,
    b2: man ? 2.0 : 1.9,
    b3: man ? 14 : 11,
    b6: 1.9,
    fol: man ? 300 : 220,
  };
}

/** Sum nutrient maps; a key is present when any part had it. */
export function addNutrients(...xs: (Nutrients | undefined)[]): Nutrients {
  const out: Nutrients = {};
  for (const x of xs) {
    if (!x) continue;
    for (const k of NUTRIENT_KEYS) {
      const v = x[k];
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** Scale a nutrient map (e.g. per-100 g values to the grams eaten), keeping a few significant digits. */
export function scaleNutrients(x: Nutrients | undefined, f: number): Nutrients | undefined {
  if (!x) return undefined;
  const out: Nutrients = {};
  for (const k of NUTRIENT_KEYS) {
    const v = x[k];
    if (typeof v === 'number') out[k] = Math.round(v * f * 100) / 100;
  }
  return Object.keys(out).length ? out : undefined;
}

/** A catalogue row's values (in NUTRIENTS order, null for unknown) as a map. */
export function nutrientsFromRow(row: (number | null)[] | undefined): Nutrients | undefined {
  if (!row) return undefined;
  const out: Nutrients = {};
  row.forEach((v, i) => {
    if (v != null && i < NUTRIENT_KEYS.length) out[NUTRIENT_KEYS[i]] = v;
  });
  return Object.keys(out).length ? out : undefined;
}

/** Only known nutrient keys with finite numbers, rounded: safe to store from untrusted input. */
export function cleanNutrients(x: unknown): Nutrients | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const out: Nutrients = {};
  for (const k of NUTRIENT_KEYS) {
    const v = (x as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 100000) out[k] = Math.round(v * 100) / 100;
  }
  return Object.keys(out).length ? out : undefined;
}

export const formatNutrient = (k: NutrientKey, v: number) => {
  const info = nutrientInfo(k);
  return `${v.toFixed(v >= 100 ? 0 : info.dp)} ${info.unit}`;
};
