// Does REI know today's totals when a dinner is reported in chat after meals logged on Fuel?
import { newUser, turn, meals, iso } from '../api.mjs';
const at = (h, m) => new Date(2026, 8, 22, h, m);
const prof = { name: 'Priya', weight: '58', targetWeight: '64', kcal: '2150', protein: '115', carbs: '320', fat: '45', sessionTime: '06:30', goal: 'Build to 64 kg' };
let blind = 0;
for (let i = 0; i < 4; i++) {
  const u = await newUser('tot', prof, { tone: 'Coach', character: 'allmight', theme: 'hero' });
  await turn(u, at(8, 15), 'oats with banana and peanut butter', 'meal');
  await turn(u, at(13, 30), '3 roti with chole', 'meal');
  const r = await turn(u, at(21, 0), 'had tofu stir fry with rice for dinner');
  const no = /don.t have|do not have|can.t see|without (your|today)|not sure (what|how much)/i.test(r.text ?? '');
  blind += no;
  console.log(`${i + 1}: ${no ? 'BLIND' : 'ok   '} meals=${(await meals(u, iso(at(0, 0)))).length} | ${r.text}`);
}
console.log(`REI said it lacked today's totals in ${blind}/4`);
