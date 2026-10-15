import { launch, phone, log, uidOf, db, shot } from './lib.mjs';
import { register, onboard } from './flows.mjs';
import { USERS } from './users.mjs';
const key = process.argv[2];
const u = USERS[key];
const day1 = new Date(Date.now() - 12 * 86400000); day1.setHours(8, 30, 0, 0);
const b = await launch();
const p = await phone(b, day1, key);
try {
  await register(p, u);
  await onboard(p, u);
  const uid = await uidOf(u.email);
  const doc = (await db.doc(`users/${uid}`).get()).data();
  log(key, 'uid', uid);
  log(key, 'fuel shown', u.fuelText?.replace(/\n/g, ' | '));
  log(key, 'partner shown', u.partnerText?.replace(/\n/g, ' | '));
  log(key, 'pact shown', u.pactText?.replace(/\n/g, ' | ').slice(0, 400));
  log(key, 'power shown', u.powerText?.replace(/\n/g, ' | '));
  // Their own week should be built from the answers, without waiting for Sunday.
  let prog = null;
  for (let i = 0; i < 60 && !prog; i++) { const s = await db.collection(`users/${uid}/programs`).get(); if (s.size) prog = s.docs[0]; else await new Promise(r => setTimeout(r, 3000)); }
  log(key, 'program', prog ? `${prog.id}: ${prog.data().days.map((x, i) => `${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]} ${x ? x.title : 'rest'}`).join(', ')} | note: ${prog.data().note}` : 'NONE after 3 min');
  log(key, 'user doc', { onboarded: doc?.onboarded, profile: doc?.profile, settings: { theme: doc?.settings?.theme, tone: doc?.settings?.tone, character: doc?.settings?.character }, intakeSex: doc?.intake?.sex, memory: doc?.memory?.map(m => m.text), tested: doc?.intake?.tested, startedOn: doc?.startedOn, timezone: doc?.timezone });
} catch (e) {
  log(key, 'FAILED', e.message);
  await shot(p, 'zz-failure');
} finally {
  log(key, 'console', p.rei.logs.filter(l => !/deprecated|useNativeDriver/.test(l)).slice(0, 15));
  await b.close();
}
