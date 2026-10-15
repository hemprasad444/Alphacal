// Bug 14: REI's portions on Fuel (meal mode). Any absurd meal (over 1,500 kcal, or an item over 2 kg)?
import { newUser, turn, meals, iso } from '../api.mjs';
const FOODS = ['oats with banana and peanut butter', 'peanut butter toast and a banana', '2 bananas and a glass of milk', '100 g paneer with 2 roti', 'a bowl of dal and rice'];
const N = Number(process.argv[2] ?? 4);
let bad = 0, total = 0;
for (let r = 0; r < N; r++) {
  const u = await newUser('por');
  for (const [k, food] of FOODS.entries()) {
    const when = new Date(2026, 8, 23, 7 + k * 3, 0);
    await turn(u, when, food, 'meal');
  }
  for (const m of await meals(u, '2026-09-23')) {
    total++;
    const absurd = m.kcal > 1500 || (m.items ?? []).some(i => i.g > 2000);
    bad += absurd;
    console.log(`${absurd ? 'ABSURD' : 'ok    '} ${String(m.kcal).padStart(5)} kcal  ${m.name} | ${(m.items ?? []).map(i => `${i.name} ${i.qty} ${i.unit}${i.g ? ` (${i.g} g)` : ''} ${i.kcal}`).join(', ')}`);
  }
}
console.log(`ABSURD MEALS: ${bad}/${total}`);
