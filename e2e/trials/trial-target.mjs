// In the real chat path: does "change my protein target to 160" change it?
import { newUser, turn } from '../api.mjs';
import { db } from '../lib.mjs';
const asks = ['change my protein target to 160 please', 'set my calories to 2000', 'make my protein 170g'];
let ok = 0, n = 0;
for (const ask of asks) for (let i = 0; i < 3; i++) {
  const u = await newUser('tgt');
  await turn(u, new Date(2026, 8, 28, 9, 0), 'yo morning');
  const r = await turn(u, new Date(2026, 8, 28, 9, 5), ask);
  const p = (await db.doc(`users/${u.uid}`).get()).data().profile;
  const want = (/(\d{3,4})/.exec(ask) ?? [])[1];
  const field = /calorie/.test(ask) ? 'kcal' : 'protein';
  const changed = p[field] === want;
  n++; ok += changed;
  console.log(`${changed ? 'CHANGED  ' : 'NOT SAVED'} "${ask}" -> ${field}=${p[field]} | notes ${JSON.stringify(r.notes)} | ${r.text?.slice(0, 90)}`);
}
console.log(`target actually changed ${ok}/${n}`);
