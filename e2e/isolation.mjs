// Can one signed-in user reach another's data? Goes through the security rules with Priya's own login.
import { USERS } from './users.mjs';
import { uidOf } from './lib.mjs';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-rei/databases/(default)/documents';
const login = async u => (await (await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: u.password, returnSecureToken: true }) })).json()).idToken;
const hem = await uidOf(USERS.hem.email), priya = await uidOf(USERS.priya.email);
const tok = await login(USERS.priya);
const H = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
const day = '2026-10-05';
const tries = [
  ['read Hem profile', 'GET', `${FS}/users/${hem}`],
  ['read Hem meals', 'GET', `${FS}/users/${hem}/days/${day}`],
  ['list Hem messages', 'GET', `${FS}/users/${hem}/messages`],
  ['list Hem sessions', 'GET', `${FS}/users/${hem}/sessions`],
  ['list Hem memory/weigh-ins', 'GET', `${FS}/users/${hem}/weighIns`],
  ['write a meal into Hem\'s day', 'PATCH', `${FS}/users/${hem}/days/2026-10-20`, { fields: { sessionDone: { booleanValue: true } } }],
  ['give herself the tester flag on the allowlist', 'PATCH', `${FS}/allowlist/someone@else.com`, { fields: { addedAt: { integerValue: '1' } } }],
  ['list all users', 'GET', `${FS}/users`],
  ['read own profile', 'GET', `${FS}/users/${priya}`],
  ['read own meals', 'GET', `${FS}/users/${priya}/days/${day}`],
];
for (const [name, method, url, body] of tries) {
  const r = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const own = name.includes('own');
  const ok = own ? r.status === 200 : r.status === 403;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} -> HTTP ${r.status}${own ? ' (should be allowed)' : ' (should be refused)'}`);
}
