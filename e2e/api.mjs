// Talks to the local server the way the app does, for repeatable trials with throwaway users.
import { db, adminAuth, serverClock as setClock, sleep } from './lib.mjs';
/** The server caches the clock for 150 ms: give it time to see the jump. */
const serverClock = async when => { setClock(when); await sleep(400); };
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FN = 'http://127.0.0.1:5001/demo-rei/asia-south1';
const ids = { n: 0 };
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A ready tester with a profile, like one fresh out of onboarding. */
export async function newUser(tag, profile = {}, settings = {}) {
  const email = `${tag}-${Date.now()}-${ids.n++}@trial.test`;
  const r = await (await fetch(`${AUTH}/accounts:signUp?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'trial-pass-1', returnSecureToken: true }) })).json();
  await adminAuth.updateUser(r.localId, { emailVerified: true });
  await adminAuth.setCustomUserClaims(r.localId, { tester: true });
  const s = await (await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'trial-pass-1', returnSecureToken: true }) })).json();
  const uid = r.localId;
  await db.doc(`users/${uid}`).set({
    onboarded: true, timezone: 'Asia/Kolkata', startedOn: '2026-10-01', chatClearedAt: 0,
    profile: { name: 'Hem', goal: 'Get lean to 76.5 kg', deadline: '2027-01-24', weight: '84', targetWeight: '76.5', bf: '19', targetBf: '11', height: '178', age: '26', kcal: '2100', protein: '185', carbs: '195', fat: '65', steps: '10000', sleep: '7.5', sessions: '4', sessionTime: '18:30', bedtime: '23:15', ...profile },
    settings: { tone: 'Bro', theme: 'shinobi', character: 'naruto', ...settings },
  });
  return { uid, email, token: s.idToken };
}

/** The user's message, stored the way the app stores it before asking REI. */
async function say(u, when, text) {
  const id = `m${when.getTime()}${Math.random().toString(36).slice(2, 8)}`;
  await db.doc(`users/${u.uid}/messages/${id}`).set({ role: 'user', text, time: `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`, createdAt: when.getTime() });
  return id;
}

/** One chat turn at `when`: `mode` 'chat' (Talk) or 'meal' (Fuel). Returns REI's reply and notes. */
export async function turn(u, when, text, mode = 'chat', voice = false) {
  await serverClock(when);
  const stored = mode === 'meal' ? `Just ate: ${text}` : text;
  const userMessageId = await say(u, when, stored);
  const res = await fetch(`${FN}/chat`, { method: 'POST', headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, mode, voice, userMessageId, replyId: `r${Date.now()}${Math.random().toString(36).slice(2, 8)}` }) });
  const raw = await res.text();
  const done = raw.split('\n').filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6))).find(e => e.type === 'done' || e.type === 'error');
  return done ?? { type: 'error', message: `HTTP ${res.status} ${raw.slice(0, 200)}` };
}

export async function meals(u, date) {
  return (await db.doc(`users/${u.uid}/days/${date}`).get()).data()?.meals ?? [];
}

/** The live-call session REI would start right now: `greeting` is its first spoken line. */
/** The live actions the current app build handles (it sends them when it asks for a session). */
const TOOLS = ['log_meal', 'remove_meal', 'log_workout', 'update_vow', 'remember', 'forget', 'rebuild_program'];

export async function opener(u, when, engine = 'livekit') {
  await serverClock(when);
  const res = await fetch(`${FN}/voiceSession`, { method: 'POST', headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { engine, tools: TOOLS } }) });
  const j = await res.json();
  if (!j.result) return { error: JSON.stringify(j).slice(0, 300) };
  if (j.result.engine === 'elevenlabs') return { greeting: j.result.firstMessage, engine: 'elevenlabs' };
  const payload = JSON.parse(Buffer.from(j.result.token.split('.')[1], 'base64url').toString());
  const meta = payload.roomConfig?.agents?.[0]?.metadata ?? '';
  const { gunzipSync } = await import('zlib');
  const session = JSON.parse(gunzipSync(Buffer.from(meta.slice(3), 'base64')).toString());
  return { greeting: session.greeting, voice: session.voice, engine: 'livekit', session, token: j.result.token, url: j.result.url };
}

/** Tap-to-talk pieces: speech to text, and REI's voice for a line (`v` like "c:naruto"). */
export async function stt(u, audio, type = 'audio/mp4') {
  const r = await fetch(`${FN}/stt`, { method: 'POST', headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': type }, body: audio });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
}
export async function tts(u, text, v) {
  const r = await fetch(`${FN}/tts?t=${encodeURIComponent(text)}&v=${encodeURIComponent(v)}`, { headers: { Authorization: `Bearer ${u.token}` } });
  return { status: r.status, type: r.headers.get('content-type'), audio: Buffer.from(await r.arrayBuffer()) };
}
