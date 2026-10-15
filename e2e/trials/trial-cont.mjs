// Follow-ups: they mention a plan, leave, come back. Does REI ask about the plan first?
import { newUser, turn, opener } from '../api.mjs';
const N = Number(process.argv[2] ?? 3);
const d = (day, h, m = 0) => new Date(2026, 8, day, h, m);
const S = [
  { name: 'movie, plan is last msg, back 4h later', hook: /movie|dune|film|cinema/i,
    steps: [[d(21, 18, 10), 'Skipping the calisthenics today bro, going to a movie with my friends, Dune 3 at 7. talk later']], back: d(21, 22, 45) },
  { name: 'movie, then "ok bye", back 4h later', hook: /movie|dune|film|cinema/i,
    steps: [[d(21, 18, 10), 'going to watch Dune 3 with the boys at 7'], [d(21, 18, 12), 'ok bye']], back: d(21, 22, 40) },
  { name: 'wedding tonight, back next morning', hook: /wedding|cousin|sangeet|shaadi|party/i,
    steps: [[d(21, 19, 0), 'Off to my cousin’s wedding tonight, gonna be a long one']], back: d(22, 9, 30) },
  { name: 'gym legs, back 2h later', hook: /leg|squat|gym|session|workout/i,
    steps: [[d(21, 17, 0), 'heading to the gym now, legs day']], back: d(21, 19, 15) },
  { name: 'exam at 2, back in the evening', hook: /exam|test|paper/i,
    steps: [[d(21, 9, 0), 'Got my driving test at 2 pm, wish me luck'], [d(21, 9, 2), 'gotta go prep']], back: d(21, 18, 30) },
];
const tally = {};
for (const s of S) {
  for (let i = 0; i < N; i++) {
    const u = await newUser('cont');
    for (const [when, text] of s.steps) await turn(u, when, text);
    const op = await opener(u, s.back);
    const r = await turn(u, new Date(s.back.getTime() + 60000), 'yo im back');
    const okCall = s.hook.test(op.greeting ?? ''), okChat = s.hook.test(r.text ?? '');
    tally[s.name] ??= { call: 0, chat: 0 };
    tally[s.name].call += okCall; tally[s.name].chat += okChat;
    console.log(`[${s.name} #${i + 1}]\n   CALL ${okCall ? 'OK  ' : 'MISS'} ${op.greeting ?? op.error}\n   CHAT ${okChat ? 'OK  ' : 'MISS'} ${r.text ?? r.message}`);
  }
}
console.log('\nFOLLOW-UP ON THE PLAN (out of', N, 'each):');
for (const [k, v] of Object.entries(tally)) console.log(`  ${k.padEnd(42)} call ${v.call}/${N}   chat ${v.chat}/${N}`);
