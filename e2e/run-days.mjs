// Runs the story for days [from..to] with both users in their own phones, checking each night.
import { launch, phone, log, db, shot, text, sleep, serverClock, E2E, REPO } from './lib.mjs';
import path from 'path';
import { USERS } from './users.mjs';
import { STEPS } from './scenario.mjs';
import { at, iso, login, eat, chat, train, gym, weigh, go, uid } from './acts.mjs';
import { execFileSync } from 'child_process';
const [from, to] = [Number(process.argv[2]), Number(process.argv[3] ?? process.argv[2])];
const steps = STEPS.filter(s => s[0] >= from && s[0] <= to).sort((a, b) => a[0] - b[0] || (a[4] === 'check') - (b[4] === 'check') || a[1] * 60 + a[2] - (b[1] * 60 + b[2]));
const b = await launch();
const pages = {};
for (const k of ['hem', 'priya']) { pages[k] = await phone(b, at(from, 6, 0), k); await login(pages[k], USERS[k]); }
const num = s => (s == null ? null : Number(String(s).replace(/,/g, '')));

async function check(day) {
  const date = iso(at(day, 0));
  for (const k of ['hem', 'priya']) {
    const p = pages[k], u = USERS[k];
    const when = at(day, 23, 10);
    await p.clock.setSystemTime(when); serverClock(when);
    const exp = JSON.parse(execFileSync('npx', ['tsx', path.join(E2E, 'oracle.mts'), u.email, date], { cwd: path.join(REPO, 'functions'), encoding: 'utf8' }).split('\n').filter(l => l.startsWith('{')).pop());
    await go(p, '/'); await sleep(1500);
    const today = (await text(p)).replace(/\n+/g, ' | ');
    await shot(p, `d${day}-today`);
    await go(p, '/fuel'); await sleep(1500);
    const fuel = (await text(p)).replace(/\n+/g, ' | ');
    await shot(p, `d${day}-fuel`);
    await go(p, '/dojo'); await sleep(1500);
    const dojo = (await text(p)).replace(/\n+/g, ' | ');
    await shot(p, `d${day}-dojo`);
    const seen = {
      streak: num(today.match(/(\d+)-day streak/)?.[1] ?? (today.includes('Start a streak') ? 0 : null)),
      xp: num(today.match(/· ([\d,]+) XP/)?.[1]),
      rank: today.match(/\| ([A-Za-z]+) · [\d,]+ XP/)?.[1],
      eaten: num(fuel.match(/([\d,]+) EATEN/)?.[1]),
      protein: num(today.match(/Protein \| ([\d,]+) \/ /)?.[1]),
      dojoXp: num(dojo.match(/\| ([\d,]+) XP \| [\d,]+ TO /)?.[1] ?? dojo.match(/\| ([\d,]+) XP \| MAX RANK/)?.[1]),
      xpToday: num(dojo.match(/\+(\d+) \| XP TODAY/)?.[1]),
      dojoStreak: num(dojo.match(/\| (\d+) \| DAY STREAK/)?.[1]),
    };
    const want = { streak: exp.streak, xp: exp.xp, rank: exp.rank, eaten: exp.kcal, protein: exp.protein, dojoXp: exp.xp, xpToday: exp.today, dojoStreak: exp.streak };
    const bad = Object.keys(want).filter(k2 => String(seen[k2]) !== String(want[k2]));
    log(`CHECK D${day} ${u.name}: ${bad.length ? 'MISMATCH ' + bad.map(k2 => `${k2} screen=${seen[k2]} expected=${want[k2]}`).join('; ') : 'OK'} | xp ${exp.xp} (${exp.rank}) streak ${exp.streak} today+${exp.today} | ${exp.meals} meals ${exp.kcal} kcal P${exp.protein} | sessions today ${exp.sessionsToday} | weight ${exp.weight} | badges: ${exp.earned.join(', ') || '-'}`);
    const goal = today.match(/YOUR GOAL \| ([^|]+) \| ([^|]+) \| [^|]+ \| ([^|]+)/);
    log(`      ${u.name} goal: ${goal ? goal.slice(1).join(' · ') : '?'} | hero: ${today.match(/REI SAYS \| ([^|]+) \| ([^|]+)/)?.slice(1).join(' · ')}`);
  }
}

for (const s of steps) {
  const [day, hh, mm, who, act, ...args] = s;
  try {
    if (act === 'check') { await check(day); continue; }
    if (act === 'program') {
      const when = at(day, hh, mm);
      serverClock(when); await sleep(400);
      for (const k of who === '*' ? ['hem', 'priya'] : [who]) {
        const ref = await db.collection(`users/${await uid(USERS[k])}/jobs`).add({ type: 'program', createdAt: when.getTime() });
        let st;
        for (let i = 0; i < 60 && !st; i++) { await sleep(2000); st = (await ref.get()).data()?.status; }
        log(USERS[k].name, iso(when), 'WEEKLY PROGRAM job ->', st ?? 'no result after 2 min', (await ref.get()).data()?.week ?? '');
      }
      continue;
    }
    const p = pages[who], u = USERS[who], when = at(day, hh, mm);
    if (act === 'eat') await eat(p, u, when, args[0]);
    else if (act === 'chat') await chat(p, u, when, args[0]);
    else if (act === 'train') await train(p, u, when, ...args);
    else if (act === 'gym') await gym(p, u, when);
    else if (act === 'weigh') await weigh(p, u, when, args[0]);
  } catch (e) {
    log('STEP ERROR', JSON.stringify(s), e.message.slice(0, 300));
    await shot(pages[who] ?? pages.hem, `err-d${day}-${act}`).catch(() => {});
  }
}
for (const k of ['hem', 'priya']) log(`${k} console`, pages[k].rei.logs.filter(l => !/deprecated|useNativeDriver|expo-file-system|greeting clip|voice clip/.test(l)).slice(0, 8));
await b.close();
