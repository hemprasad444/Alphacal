// REI's tone across every reply in the emulator (run after the story or other trials): no narrating its
// own process ("Logging it.", "isn't on my list") and, in Bro mode, no swearing until the user swears.
import { db } from '../lib.mjs';
// "Tell me what you ate and I'll log it" is an invitation, not narration; the server's own "couldn't log" line isn't REI's.
const NARRATE = /my list|on the list|(?<!from the )food list|let me (log|get|check|grab|pull|work)|\btools?\b|the system|first message|logging (it|that)|eyeball/i;
const SWEAR = /\b(fuck\w*|shit\w*|bullshit)\b/i;
const snap = await db.collectionGroup('messages').get();
const chats = new Map();
for (const d of snap.docs) {
  const k = d.ref.parent.path;
  if (!chats.has(k)) chats.set(k, []);
  chats.get(k).push(d.data());
}
let replies = 0, narrated = 0, unprompted = 0;
for (const ms of chats.values()) {
  ms.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  ms.forEach((m, i) => {
    if (m.role !== 'rei') return;
    replies++;
    const text = (m.text ?? '').replace(/\n/g, ' ');
    if (NARRATE.test(text)) { narrated++; console.log('  narrates:', text.slice(0, 140)); }
    const them = ms.slice(0, i).filter(x => x.role === 'user').map(x => x.text ?? '').join(' ');
    if (SWEAR.test(text) && !/\b(fuck|shit|damn|bitch|ass)\w*/i.test(them)) { unprompted++; console.log('  swears first:', text.slice(0, 140)); }
  });
}
console.log(`REI replies ${replies} | narrate their process ${narrated} | swear before the user does ${unprompted}`);
