// Packaged foods by barcode, from Open Food Facts (free, open data: openfoodfacts.org).
// The phone asks it directly; the result is saved as one of your foods, so a second scan
// is instant and works offline.
import { OFF_FIELDS, offToFood, type Food } from '@rei/shared';

const BASE = process.env.EXPO_PUBLIC_OFF_BASE_URL || 'https://world.openfoodfacts.org';

/** The product for a barcode, or null when Open Food Facts doesn't have its numbers. */
export async function lookupBarcode(code: string): Promise<Food | null> {
  if (!/^\d{6,14}$/.test(code)) return null;
  const res = await fetch(`${BASE}/api/v2/product/${code}.json?fields=${OFF_FIELDS}`, { headers: { 'User-Agent': 'REI/0.5 (github.com/hemprasad444/Alphacal)' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts answered ${res.status}`);
  return offToFood(code, await res.json());
}
