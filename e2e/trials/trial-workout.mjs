// #25: a workout saved in the app, then told to REI. Logged twice? And the cases that must still log.
import { newUser, turn, iso } from '../api.mjs';
import { db } from '../lib.mjs';
const day = new Date(2026, 8, 29, 19, 45);
const count = async u => (await db.collection(`users/${u.uid}/sessions`).where('date', '==', iso(day)).get()).size;
const saveGym = u => db.collection(`users/${u.uid}/sessions`).add({ date: iso(day), plan: 'PUSH', title: 'Push', done: 16, total: 16, seconds: 2700, sets: [{ exercise: 'Barbell bench press', reps: [6, 6, 6, 6], kg: [82.5, 82.5, 82.5, 82.5], done: [true, true, true, true] }], createdAt: day.getTime() });
const cases = [
  ['saved, then "just smashed push day, benched 85 for 5"', true, 'just smashed push day, benched 85 for 5', 1],
  ['saved, then "also ran 5k after, 26 minutes"', true, 'also ran 5k after, 26 minutes', 2],
  ['saved, then "did a second session tonight, 40 min of arms"', true, 'did a second session tonight, 40 min of arms', 2],
  ['nothing saved, "did push day, 50 minutes"', false, 'did push day, 50 minutes', 1],
];
let ok = 0, n = 0;
for (const [label, saved, msg, want] of cases) for (let i = 0; i < 3; i++) {
  const u = await newUser('wk');
  await turn(u, new Date(2026, 8, 29, 9, 0), 'morning');
  if (saved) await db.doc(`users/${u.uid}/days/${iso(day)}`).set({ sessionDone: true, loggedMin: 45 }, { merge: true }), await saveGym(u);
  const r = await turn(u, new Date(2026, 8, 29, 20, 30), msg);
  const c = await count(u);
  n++; ok += c === want;
  console.log(`${c === want ? 'PASS' : 'FAIL'} ${label} -> sessions ${c} (want ${want}) | ${JSON.stringify(r.notes)} | ${r.text?.slice(0, 80)}`);
}
console.log(`workout cases right ${ok}/${n}`);
