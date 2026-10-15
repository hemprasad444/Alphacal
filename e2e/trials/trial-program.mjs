// Bug 20: are program loads now from the user's own starting point?
import { newUser } from '../api.mjs';
import { db, serverClock, sleep } from '../lib.mjs';
import { DEFAULT_INTAKE } from '../../packages/shared/src/onboarding.ts';
const FN = 'http://127.0.0.1:5001/demo-rei/asia-south1';
const people = [
  ['beginner woman, no bests', { name: 'Priya', weight: '58', targetWeight: '64', age: '24', height: '162', sessions: '3', goal: 'Build to 64 kg' }, { sex: 'Female', exp: 'New', tested: {} }],
  ['lifter man, bench 85 given', { name: 'Hem', weight: '84', targetWeight: '76.5', age: '26', height: '178', sessions: '4', goal: 'Get lean' }, { sex: 'Male', exp: '1–3 yrs', bench: 85, run5k: 1680, tested: { bench: true, run5k: true } }],
];
const kg = t => Number((/([\d.]+) ?kg/.exec(t ?? '') ?? [])[1] ?? NaN);
for (const [label, profile, intake] of people) {
  for (let i = 0; i < 3; i++) {
    const u = await newUser('prog', profile);
    await db.doc(`users/${u.uid}`).set({ intake: { ...DEFAULT_INTAKE, ...intake } }, { merge: true });
    serverClock(new Date()); await sleep(400);
    const r = await (await fetch(`${FN}/rebuildProgram`, { method: 'POST', headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: {} }) })).json();
    const snap = await db.collection(`users/${u.uid}/programs`).get();
    const days = snap.docs[0]?.data().days ?? [];
    const lifts = days.filter(Boolean).flatMap(d => d.exercises).filter(e => /bench|squat|deadlift|overhead press/i.test(e.name) && !/dumbbell|goblet/i.test(e.name));
    console.log(`${label} #${i + 1}: ${r.result ? 'built' : JSON.stringify(r).slice(0, 120)} | ${lifts.map(e => `${e.name} ${e.target}`).join(' | ')}`);
  }
}
