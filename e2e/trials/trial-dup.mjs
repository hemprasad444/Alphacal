// Bug 5 repro: a meal logged on Fuel, then an unrelated chat message. Does REI log the meal again?
import { newUser, turn, meals, iso } from '../api.mjs';
const N = Number(process.argv[2] ?? 6);
const at = (h, m) => new Date(2026, 8, 20, h, m);
let dup = 0;
const results = [];
for (let i = 0; i < N; i++) {
  const u = await newUser('dup');
  await turn(u, at(13, 40), 'chicken biryani from the office canteen and a coke', 'meal');
  const r = await turn(u, at(18, 10), 'Skipping the calisthenics today bro, going to a movie with my friends, Dune 3 at 7. talk later');
  const ms = await meals(u, iso(at(0, 0)));
  if (ms.length > 1) dup++;
  results.push(`${i + 1}: meals=${ms.length} | REI: ${r.text?.slice(0, 110)} ${r.notes?.length ? `[${r.notes.join(' / ')}]` : ''}`);
}
console.log(results.join('\n'));
console.log(`DUPLICATE MEAL in ${dup}/${N} trials`);
