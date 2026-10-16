// A user who said they were off to the movies four hours ago, then a live-call session for them, at real time.
import fs from 'fs';
import { newUser, opener } from './api.mjs';
import { db } from './lib.mjs';
const out = process.argv[2];
const u = await newUser('call');
const now = Date.now();
const put = (id, role, text, minAgo) => db.doc(`users/${u.uid}/messages/${id}`).set({ role, text, time: '', createdAt: now - minAgo * 60000 });
await put('a00001', 'user', 'going to watch Dune 3 with the boys tonight', 250);
await put('a00002', 'rei', 'Enjoy it. Protein before you go.', 249);
await put('a00003', 'user', 'ok bye', 248);
const s = await opener(u, new Date());
// Their daily targets, so the call's stand-in phone can answer tools with today's totals like the app does.
const { kcal, protein, carbs, fat } = (await db.doc(`users/${u.uid}`).get()).data().profile;
fs.writeFileSync(out, JSON.stringify({ url: s.url, token: s.token, greeting: s.greeting, voice: s.voice, uid: u.uid, targets: { kcal, protein, carbs, fat } }));
console.log('greeting in session:', s.greeting, '| voice', s.voice);
