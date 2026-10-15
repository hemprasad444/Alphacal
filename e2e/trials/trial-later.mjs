// Talking about lunch hours later shouldn't log it again; eating the same food again for dinner should.
import { newUser, turn, meals, iso } from '../api.mjs';
const d = (h, m) => new Date(2026, 8, 30, h, m);
let right = 0, n = 0;
for (let i = 0; i < 3; i++) {
  const u = await newUser('later');
  await turn(u, d(13, 40), 'chicken biryani from the office canteen and a coke', 'meal');
  await turn(u, d(19, 30), 'man that biryani at lunch was so good');
  const a = (await meals(u, iso(d(0, 0)))).length;
  await turn(u, d(21, 0), 'had chicken biryani again for dinner lol');
  const b = (await meals(u, iso(d(0, 0)))).length;
  const ok = a === 1 && b === 2;
  n++; right += ok;
  console.log(`${ok ? 'PASS' : 'FAIL'} after talking about it: ${a} meal(s) (want 1) | after eating it again: ${b} (want 2)`);
}
console.log(`later-mention cases right ${right}/${n}`);
