// Talks to the deployed REI chat as a test account and checks what REI actually recorded.
//   REI_TEST_EMAIL=... REI_TEST_PASSWORD=... node scripts/rei-eval.mjs [--voice]
// Use a separate test account (on the allowlist): this logs real meals, weights and workouts to it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const email = process.env.REI_TEST_EMAIL, password = process.env.REI_TEST_PASSWORD;
if (!email || !password) {
  console.error('Set REI_TEST_EMAIL and REI_TEST_PASSWORD (a separate test account on the allowlist).');
  process.exit(1);
}
const voice = process.argv.includes('--voice');
const root = fileURLToPath(new URL('../..', import.meta.url));
const env = Object.fromEntries(readFileSync(join(root, 'app/.env'), 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const apiKey = env.EXPO_PUBLIC_FIREBASE_API_KEY, project = env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const fn = name => `https://asia-south1-${project}.cloudfunctions.net/${name}`;

// What a reply must (or must not) record, judged by the notes REI's backend adds to the chat.
const CASES = [
  { say: 'wassup', none: /LOGGED|UPDATED|REMEMBERED/ },
  { say: 'I just had 2 rotis with a bowl of dal', want: /MEAL LOGGED/ },
  { say: 'lunch was chicken biryani and a coke', want: /MEAL LOGGED/ },
  { say: 'should I eat paneer or chicken tonight?', none: /MEAL LOGGED/ },
  { say: 'I weigh 80.5 kg this morning', want: /VOW UPDATED.*WEIGHT/ },
  { say: 'set my protein target to 160 grams', want: /VOW UPDATED.*PROTEIN/ },
  { say: 'I train at 7 in the morning now', want: /VOW UPDATED.*TRAINING TIME/ },
  { say: "I'm vegetarian but I eat eggs", want: /REMEMBERED/ },
  { say: 'my left knee is injured, no jumping for now', want: /REMEMBERED/ },
  { say: 'just finished leg day, about 45 minutes', want: /WORKOUT LOGGED/ },
  { say: 'went for a 5k run in 28 minutes', want: /WORKOUT LOGGED · RUN · 5 KM/ },
  { say: 'played football for an hour this evening', want: /WORKOUT LOGGED/ },
  { say: "I'm planning to run tomorrow morning", none: /WORKOUT LOGGED/ },
  { say: 'rebuild my week with more running', want: /REBUILDING YOUR WEEK/ },
];

async function signIn() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Sign-in failed: ${j.error?.message ?? r.status}`);
  return j.idToken;
}

async function token() {
  let t = await signIn();
  const claims = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
  if (claims.tester !== true) {
    // First run on this account: get the tester claim, then a token that carries it.
    const r = await fetch(fn('activate'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: '{"data":{}}' });
    if (!r.ok) throw new Error(`Activation failed (${r.status}): is ${email} on the allowlist?`);
    t = await signIn();
  }
  return t;
}

async function ask(idToken, text) {
  const replyId = Math.random().toString(36).slice(2, 12).padEnd(10, 'x');
  const t0 = Date.now();
  const r = await fetch(fn('chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ text, mode: 'chat', replyId, ...(voice ? { voice: true } : {}) }),
  });
  if (!r.ok) return { error: `HTTP ${r.status} ${(await r.text()).slice(0, 120)}` };
  let done = null, error = null;
  for (const block of (await r.text()).split('\n\n')) {
    const line = block.trim();
    if (!line.startsWith('data:')) continue;
    const e = JSON.parse(line.slice(5));
    if (e.type === 'done') done = e;
    if (e.type === 'error') error = e.message;
  }
  return error ? { error } : { ...done, ms: Date.now() - t0 };
}

const idToken = await token();
console.log(`REI eval · ${email} · ${voice ? 'voice' : 'chat'} mode · ${CASES.length} messages\n`);
let passed = 0;
const times = [];
for (const c of CASES) {
  const r = await ask(idToken, c.say);
  const notes = (r.notes ?? []).join(' | ');
  const ok = !r.error && (c.want ? c.want.test(notes) : true) && (c.none ? !c.none.test(notes) : true);
  if (ok) passed++;
  if (r.ms) times.push(r.ms);
  console.log(`${ok ? 'PASS' : 'FAIL'}  "${c.say}"`);
  console.log(`      expected ${c.want ? `notes ~ ${c.want}` : `nothing like ${c.none}`}`);
  console.log(`      got      ${r.error ? `ERROR ${r.error}` : notes || '(no notes)'}${r.ms ? `  · ${r.ms} ms · ${r.model}` : ''}`);
  if (r.text) console.log(`      REI      ${r.text.replace(/\s+/g, ' ').slice(0, 160)}`);
}
const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
console.log(`\n${passed}/${CASES.length} passed · average reply ${avg} ms`);
process.exit(passed === CASES.length ? 0 : 1);
