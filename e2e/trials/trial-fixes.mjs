// Targeted re-checks: weight told to REI is stored; a plan is asked about once, not again the next day.
import { newUser, turn, iso } from '../api.mjs';
import { db } from '../lib.mjs';
const N = 3;
let weighed = 0, repeated = 0;
for (let i = 0; i < N; i++) {
  const u = await newUser('fix');
  const when = new Date(2026, 8, 24, 7, 0);
  const r = await turn(u, when, 'weighed 83.5 this morning');
  const w = (await db.doc(`users/${u.uid}/weighIns/${iso(when)}`).get()).data();
  if (w?.kg === 83.5) weighed++;
  console.log(`weight #${i + 1}: weighIn=${JSON.stringify(w ?? null)} notes=${JSON.stringify(r.notes)} | ${r.text}`);
}
for (let i = 0; i < N; i++) {
  const u = await newUser('fix2');
  await turn(u, new Date(2026, 8, 25, 18, 10), 'Rest day so no gym bro, going to a movie with my friends, Dune 3 at 7. talk later');
  const back = await turn(u, new Date(2026, 8, 25, 22, 45), 'yo im back');
  const next = await turn(u, new Date(2026, 8, 26, 20, 30), 'just smashed push day, benched 85 for 5');
  const again = /movie|dune/i.test(next.text ?? '');
  repeated += again;
  console.log(`plan #${i + 1}: night -> ${back.text}\n          next day -> ${again ? 'ASKED AGAIN' : 'ok'} | ${next.text}`);
}
console.log(`\nweight stored ${weighed}/${N} | asked about the movie again next day ${repeated}/${N}`);
