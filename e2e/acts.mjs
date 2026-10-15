// Everyday actions, each confirmed in the database (not just on screen).
import { APP, db, tap, type, text, shot, sleep, log, uidOf, setTime } from './lib.mjs';
import { see } from './flows.mjs';

export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Day n of the test (1 = Sun 4 Oct 2026), at hh:mm India time. */
export const at = (n, hh, mm = 0) => new Date(2026, 9, 3 + n, hh, mm);

const uids = {};
export const uid = async u => (uids[u.email] ??= await uidOf(u.email));
const dayDoc = async (u, date) => (await db.doc(`users/${await uid(u)}/days/${date}`).get()).data() ?? {};

export async function go(page, path) {
  await page.goto(APP + path);
  await sleep(2500);
}

export async function login(page, u) {
  await page.goto(APP + '/');
  await sleep(3000);
  const t = await text(page);
  if (!t.includes('WELCOME BACK') && !t.includes('Log in')) return;
  await type(page, 'Email', u.email);
  await type(page, 'Password', u.password);
  await page.getByText('Log in', { exact: true }).last().click();
  await see(page, /Good (morning|afternoon|evening)|REI SAYS/i, 30000);
}

export async function signOut(page) {
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    for (const d of dbs) indexedDB.deleteDatabase(d.name);
    localStorage.clear();
  });
}

/** Type a meal on Fuel and wait for it to be stored. Returns the stored meal. */
export async function eat(page, u, when, words) {
  await setTime(page, when);
  await go(page, '/fuel');
  const date = iso(when);
  const before = ((await dayDoc(u, date)).meals ?? []).length;
  await type(page, '2 roti, dal and curd…', words, { enter: true });
  const t0 = Date.now();
  for (;;) {
    const meals = (await dayDoc(u, date)).meals ?? [];
    if (meals.length > before) {
      const m = meals[meals.length - 1];
      log(u.name, date, 'ATE', JSON.stringify(words), '->', `${m.name} | ${m.kcal} kcal P${m.p} C${m.c} F${m.f}${m.n?.fib != null ? ` fib${m.n.fib}` : ''} src=${m.src ?? '-'} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return m;
    }
    if (Date.now() - t0 > 90000) {
      log(u.name, date, 'ATE FAILED', words, (await text(page)).slice(0, 300).replace(/\n/g, ' | '));
      await shot(page, `fail-eat-${date}`);
      return null;
    }
    await sleep(700);
  }
}

/** Send REI a message on Talk; wait for REI's stored reply. */
export async function chat(page, u, when, words) {
  await setTime(page, when);
  await go(page, '/talk');
  const col = db.collection(`users/${await uid(u)}/messages`);
  const since = when.getTime() - 1000;
  await type(page, 'Talk to REI…', words, { enter: true });
  const t0 = Date.now();
  for (;;) {
    const snap = await col.where('createdAt', '>', since).get();
    const msgs = snap.docs.map(d => d.data()).sort((a, b) => a.createdAt - b.createdAt);
    const iUser = msgs.findIndex(m => m.role === 'user' && m.text === words);
    const reply = iUser >= 0 ? msgs.slice(iUser + 1).find(m => m.role === 'rei') : null;
    if (reply) {
      await sleep(1500);
      const all = (await col.where('createdAt', '>', since).get()).docs.map(d => d.data()).sort((a, b) => a.createdAt - b.createdAt);
      const notes = all.filter(m => m.role === 'sys').map(m => m.text);
      log(u.name, iso(when), `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`, 'YOU:', words);
      log(u.name, '            REI:', reply.text, notes.length ? `  [${notes.join(' / ')}]` : '', `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      return { text: reply.text, notes };
    }
    if (Date.now() - t0 > 90000) {
      log(u.name, 'CHAT FAILED', words, (await text(page)).slice(-300).replace(/\n/g, ' | '));
      await shot(page, `fail-chat-${iso(when)}`);
      return null;
    }
    await sleep(700);
  }
}

/** Log a run / walk / ride (km + mm:ss) or a sport (minutes) from the Dojo's log page. */
export async function train(page, u, when, kind, a, b) {
  await setTime(page, when);
  await go(page, `/log-training?kind=${kind}`);
  const before = (await db.collection(`users/${await uid(u)}/sessions`).get()).size;
  if (kind === 'sport') {
    await type(page, 'Football, badminton, yoga, swimming…', a);
    await sleep(800);
    await tap(page, a, { exact: false });
    await type(page, '60', String(b));
  } else {
    await type(page, kind === 'cycle' ? '20' : '5.0', String(a));
    await type(page, kind === 'cycle' ? '45:00' : '28:30', b);
  }
  await sleep(500);
  const btn = page.getByText(/^Save · \+\d+ XP$/);
  const label = await btn.textContent({ timeout: 5000 }).catch(() => null);
  if (!label) {
    log(u.name, iso(when), 'TRAIN FAILED (no save button)', kind, a, b, (await text(page)).slice(0, 300).replace(/\n/g, ' | '));
    await shot(page, `fail-train-${iso(when)}`);
    return null;
  }
  await btn.click();
  await sleep(2500);
  const snap = await db.collection(`users/${await uid(u)}/sessions`).get();
  const s = snap.docs.map(d => d.data()).sort((x, y) => (x.createdAt ?? 0) - (y.createdAt ?? 0)).pop();
  log(u.name, iso(when), 'TRAINED', kind, a, b, '| button', label, '| stored', snap.size > before ? `${s.title} date=${s.date} ${JSON.stringify(s.cardio ?? s.activity)}` : 'NOTHING STORED');
  return s;
}

/** Today's planned gym session, logged after the fact: tick `sets` sets with the given kg on each exercise. */
export async function gym(page, u, when, kgs = []) {
  await setTime(page, when);
  await go(page, '/session');
  const t = await text(page);
  if (t.includes('Use today’s plan')) await tap(page, 'Use today’s plan');
  const head = (await text(page)).split('\n')[0];
  await sleep(800);
  await tap(page, 'Already done? Log it without the timer');
  await sleep(1000);
  // The set ticks, not the check icon inside the Save button at the bottom.
  const ticks = page.locator('path[d="M4.5 12.5l4.6 4.6L19.5 6.6"]');
  const n = (await ticks.count()) - 1;
  for (let i = 0; i < n; i++) await ticks.nth(i).click({ force: true });
  await sleep(800);
  await shot(page, `gym-${iso(when)}`);
  const before = (await db.collection(`users/${await uid(u)}/sessions`).get()).size;
  const save = page.getByText(/^Save workout · \+\d+ XP$/);
  const label = await save.textContent({ timeout: 5000 }).catch(() => null);
  if (!label) {
    log(u.name, iso(when), 'GYM FAILED: no save button', (await text(page)).slice(0, 300).replace(/\n/g, ' | '));
    return null;
  }
  await save.click();
  await sleep(2500);
  const snap = await db.collection(`users/${await uid(u)}/sessions`).get();
  const s = snap.docs.map(d => d.data()).sort((x, y) => (x.createdAt ?? 0) - (y.createdAt ?? 0)).pop();
  log(u.name, iso(when), 'GYM', head, '|', label, '| ticks', n, '| stored', snap.size > before ? `${s.title} date=${s.date} ${s.done}/${s.total} sets` : 'NOTHING STORED');
  return s;
}

/** Edit the Weight field on Vow (the way a weigh-in is entered by hand). */
export async function weigh(page, u, when, kg) {
  await setTime(page, when);
  await go(page, '/vow');
  const inputs = page.locator('input');
  const n = await inputs.count();
  let done = false;
  for (let i = 0; i < n; i++) {
    const near = await inputs.nth(i).evaluate(el => { let x = el, t = ''; for (let k = 0; k < 6 && x; k++) { x = x.parentElement; const s = x?.innerText?.trim(); if (s && s.length < 60) t = s; } return t; });
    if (/^WEIGHT\b/.test(near)) {
      const v = await inputs.nth(i).inputValue();
      await inputs.nth(i).fill(String(kg));
      await inputs.nth(i).blur();
      done = true;
      log(u.name, iso(when), 'WEIGH field was', v, '-> typed', kg);
      break;
    }
  }
  if (!done) log(u.name, iso(when), 'WEIGH: could not find the Weight field');
  await sleep(3000);
  const w = (await db.doc(`users/${await uid(u)}/weighIns/${iso(when)}`).get()).data();
  const prof = (await db.doc(`users/${await uid(u)}`).get()).data()?.profile?.weight;
  log(u.name, iso(when), 'WEIGH stored weighIn', JSON.stringify(w ?? null), 'profile.weight', prof);
  return w;
}

/** What a screen shows, as one line. */
export async function screen(page, path, label, u) {
  await go(page, path);
  await sleep(1000);
  const t = (await text(page)).replace(/\n+/g, ' | ');
  if (label) await shot(page, label);
  return t;
}
