// Same phone, two people: Hem signs out, Priya signs in. Does anything of Hem's show?
import { launch, phone, sleep, shot, text } from './lib.mjs';
import { USERS } from './users.mjs';
import { at, login, go } from './acts.mjs';
const b = await launch();
const p = await phone(b, at(12, 23, 30), 'shared');
await login(p, USERS.hem);
await go(p, '/fuel'); await sleep(1500);
const hemFuel = (await text(p)).replace(/\n+/g, ' | ');
// Sign out at the login level only (the web preview can't show the confirm dialog); Hem's cached app
// data stays on the device on purpose, to see whether it reaches the next person.
const cacheKeys = await p.evaluate(() => Object.keys(localStorage).filter(k => /rei/i.test(k)));
console.log('device cache before Priya:', cacheKeys.join(', '));
await p.evaluate(async () => { await new Promise(r => { const q = indexedDB.deleteDatabase('firebaseLocalStorageDb'); q.onsuccess = q.onerror = q.onblocked = () => r(); }); });
await p.reload(); await sleep(4000);
console.log('after sign-out:', (await text(p)).replace(/\n+/g, ' | ').slice(0, 120));
await login(p, USERS.priya);
const seen = {};
for (const path of ['/', '/fuel', '/talk', '/dojo', '/vow', '/history']) { await go(p, path); await sleep(1500); seen[path] = (await text(p)).replace(/\n+/g, ' | '); }
await shot(p, 'shared-priya-fuel');
const hemOnly = ['Chicken biryani', 'Chicken salad', 'Egg, boiled', 'Hem', 'Dune', '82.6', 'Barbell bench press'];
for (const [path, t] of Object.entries(seen)) {
  const leaks = hemOnly.filter(w => t.includes(w));
  console.log(`${path.padEnd(9)} ${leaks.length ? 'LEAK: ' + leaks.join(', ') : 'clean (only Priya’s data)'} | ${t.slice(0, 110)}`);
}
console.log('Hem fuel had:', hemOnly.filter(w => hemFuel.includes(w)).join(', '));
await b.close();
