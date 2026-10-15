// Tap-to-talk, end to end on the server: recorded clip -> speech to text -> REI (spoken mode) -> Naruto's voice -> heard back.
import fs from 'fs';
import { newUser, turn, stt, tts, meals, iso } from '../api.mjs';
const clip = fs.readFileSync(new URL('../voice/clip.m4a', import.meta.url));
const dg = process.env.DEEPGRAM_API_KEY;
for (let i = 0; i < 3; i++) {
  const u = await newUser('voice', {}, { character: 'naruto', tone: 'Bro' });
  const when = new Date(2026, 8, 27, 8, 30);
  const t0 = Date.now();
  const heard = await stt(u, clip);
  const t1 = Date.now();
  const r = await turn(u, when, heard.text ?? '', 'chat', true);
  const t2 = Date.now();
  const spoken = (r.text ?? '').replace(/\[[^\]]*\]/g, '').trim();
  const a = await tts(u, r.text ?? '', 'c:naruto');
  const t3 = Date.now();
  const back = await (await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true', { method: 'POST', headers: { Authorization: `Token ${dg}`, 'Content-Type': 'audio/mpeg' }, body: a.audio })).json();
  const said = back.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  const w = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const sw = new Set(w(said)), rw = w(spoken);
  const match = rw.length ? rw.filter(x => sw.has(x)).length / rw.length : 0;
  const m = (await meals(u, iso(when))).pop();
  console.log(`#${i + 1} STT ${heard.status} (${t1 - t0} ms): "${heard.text}"\n   REI (${t2 - t1} ms): ${r.text}\n   notes: ${JSON.stringify(r.notes)} | meal stored: ${m ? `${m.name} ${m.kcal} kcal` : 'none'}\n   voice: HTTP ${a.status} ${a.type} ${a.audio.length} bytes (${t3 - t2} ms) | heard back "${said}" | words matched ${(match * 100).toFixed(0)}%`);
}
