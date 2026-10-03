// Conversation continuity: REI should feel like one ongoing conversation, not a fresh "hey, how are
// you?" every time the app opens. This works out where the conversation stands (how long since the
// last exchange, what it was about, whether today's hello already happened) and turns it into a
// line for REI's prompt and a fallback opener for calls.
import type { Message } from './types';

export type Gap = 'now' | 'today' | 'yesterday' | 'days' | 'first';

export interface Thread {
  gap: Gap;
  /** Minutes since the last message (Infinity with no history). */
  minutes: number;
  /** Their last message and REI's, trimmed. */
  lastThem: string;
  lastRei: string;
  /** Messages exchanged today before this one. */
  todayCount: number;
}

const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const dayKey = (t: number) => new Date(t).toDateString();

/** Where the conversation stands at `now`. Only messages with a time count. */
export function thread(messages: Message[], now = Date.now()): Thread {
  const timed = messages.filter(m => m.createdAt && m.role !== 'sys' && m.text.trim()).sort((a, b) => a.createdAt! - b.createdAt!);
  const last = timed[timed.length - 1];
  if (!last) return { gap: 'first', minutes: Infinity, lastThem: '', lastRei: '', todayCount: 0 };
  const minutes = Math.max(0, Math.round((now - last.createdAt!) / 60000));
  const yesterday = dayKey(now - 86400000);
  const gap: Gap = minutes < 180 ? 'now' : dayKey(last.createdAt!) === dayKey(now) ? 'today' : dayKey(last.createdAt!) === yesterday ? 'yesterday' : 'days';
  const them = [...timed].reverse().find(m => m.role === 'user');
  const rei = [...timed].reverse().find(m => m.role === 'rei' && !m.alert);
  return {
    gap,
    minutes,
    lastThem: clip(them?.text.trim() ?? ''),
    lastRei: clip(rei?.text.trim() ?? ''),
    todayCount: timed.filter(m => dayKey(m.createdAt!) === dayKey(now)).length,
  };
}

const ago = (min: number) =>
  min < 2 ? 'just now' : min < 60 ? `${min} minutes ago` : min < 1440 ? `${Math.round(min / 60)} hour${Math.round(min / 60) === 1 ? '' : 's'} ago` : `${Math.round(min / 1440)} days ago`;

/** One paragraph for REI's prompt: how to pick the conversation up instead of restarting it. */
export function continuityNote(t: Thread): string {
  const last = [t.lastThem && `they last said "${t.lastThem}"`, t.lastRei && `you last said "${t.lastRei}"`].filter(Boolean).join('; ');
  switch (t.gap) {
    case 'first':
      return 'CONVERSATION: This is your first conversation with them. Introduce yourself in one line, then get to them.';
    case 'now':
      return `CONVERSATION: Same conversation, still going (last message ${ago(t.minutes)}; ${last}). Do not greet them again and never ask "how are you" or "what's up": you already did. Pick up the thread like a friend mid-chat.`;
    case 'today':
      return `CONVERSATION: You already talked today (${t.todayCount} messages, last ${ago(t.minutes)}; ${last}). No fresh greeting and no "how are you"; at most a quick "back again". Follow up on what was open earlier if it matters.`;
    case 'yesterday':
      return `CONVERSATION: You last talked yesterday (${last}). Greet them like a friend who remembers: follow up on what they said or planned, not a generic hello.`;
    default:
      return `CONVERSATION: They've been away ${ago(t.minutes)} (${last}). Welcome them back and notice the gap, warmly or with a jab depending on your personality, then follow up on what was open. No generic "how are you".`;
  }
}

/** A few words of what the last exchange was about, for openers. */
function topic(t: Thread): string {
  const s = t.lastThem.replace(/[“”"]/g, '').split(/[.!?]/)[0].trim();
  return s.split(/\s+/).slice(0, 7).join(' ');
}

/** A spoken first line for a call when the model can't write one. Varies by gap, personality and `seed`. */
export function fallbackOpener(t: Thread, o: { name: string; bro: boolean; tough: boolean; open?: string; seed?: number }): string {
  const n = o.name ? `, ${o.name}` : '';
  const pick = (xs: string[]) => xs[Math.abs(o.seed ?? Date.now()) % xs.length];
  const about = topic(t);
  const open = o.open ? ` ${o.open}` : '';
  if (t.gap === 'first') return o.bro ? `Yo${n}, I'm REI. Let's get you sorted.` : `I'm REI${n}. Let's get to work.`;
  if (t.gap === 'now') {
    return pick(about ? [`Back already${n}? Where were we, ${about.toLowerCase()}?`, `Missed me${n}? Go on, ${about.toLowerCase()}.`, `Still here. ${open || 'Carry on.'}`.trim()] : [`Still here${n}.${open}`, `Back again${n}?${open}`]);
  }
  if (t.gap === 'today') return pick([`Round two today${n}.${open}`, `Back for more${n}?${open}`, `There you are again${n}.${open}`]);
  if (t.gap === 'yesterday') return pick([`Morning${n}. Yesterday you said ${about.toLowerCase() || 'a lot'}. How did it go?`, `${o.bro ? 'Yo' : 'Hey'}${n}. Picking up from yesterday.${open}`]);
  return o.tough ? pick([`Look who showed up${n}.${open}`, `Days gone${n}. Let's not make that a habit.${open}`]) : pick([`Welcome back${n}. It's been a few days.${open}`, `There you are${n}. Missed you.${open}`]);
}
