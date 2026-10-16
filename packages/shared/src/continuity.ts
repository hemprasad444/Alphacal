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
  /** Something they said they were off to do that hasn't been talked about since: ask how it went. */
  plan?: Plan;
}

export interface Plan {
  /** Their words, trimmed. */
  text: string;
  /** Minutes since they said it. */
  minutes: number;
  /** The event in a word or two ("movie", "wedding"), or '' when it isn't clear. */
  topic: string;
}

const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
/** The calendar day of `t` in the user's time zone (the server runs in UTC). */
const dayKey = (t: number, timeZone?: string) => {
  if (!timeZone) return new Date(t).toDateString();
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
  } catch {
    return new Date(t).toDateString();
  }
};

/** Events people leave a chat for, as the word REI would ask about. */
const EVENTS: [RegExp, string][] = [
  [/\b(movie|film|cinema|dune|imax)\b/i, 'movie'], [/\b(wedding|shaadi|sangeet|reception)\b/i, 'wedding'], [/\b(exam|paper|driving test|test)\b/i, 'test'],
  [/\binterview\b/i, 'interview'], [/\b(date night|on a date|a date|my date)\b/i, 'date'], [/\b(party|birthday)\b/i, 'party'], [/\bconcert|gig\b/i, 'concert'],
  [/\b(match|tournament|game)\b/i, 'game'], [/\b(flight|trip|travel\w*|vacation|holiday)\b/i, 'trip'], [/\b(doctor|dentist|appointment|checkup|check-up|hospital)\b/i, 'appointment'],
  [/\b(meeting|presentation|pitch|deadline)\b/i, 'meeting'], [/\b(class|lecture)\b/i, 'class'], [/\b(shift)\b/i, 'shift'],
  [/\b(legs?|chest|push|pull|back|arms?|shoulders?) day\b|\bgym\b|\bworkout\b|\btraining\b|\bsession\b/i, 'session'], [/\b(run|jog|ride|hike|trek|swim)\b/i, 'run'],
];
/** They're off to do something: "going to a movie", "heading to the gym", "got my driving test at 2". */
const LEAVING = /\b(going|goin|gonna go|heading|headed|off to|off for|leaving|on my way|about to|stepping out|got to go|gotta go|have to go|catch you|talk later|ttyl|brb)\b|\b(i'?ve got|i have|i got|got (a|an|my)|have (a|an|my))\b[^.!?]{0,40}\b(at \d|tonight|tomorrow|today|later|this (morning|evening|afternoon))\b/i;
const content = (s: string) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !['going', 'gonna', 'with', 'tonight', 'today', 'later', 'talk', 'have', 'just', 'heading', 'about', 'that', 'this', 'from', 'will', 'back'].includes(w)));

/** The newest thing they said they were off to do in the last 36 hours, if nothing they said since was about it. */
export function openPlan(messages: Message[], now = Date.now()): Plan | undefined {
  const theirs = messages.filter(m => m.role === 'user' && m.createdAt && now - m.createdAt <= 36 * 3600000 && m.text.trim()).sort((a, b) => a.createdAt! - b.createdAt!);
  for (let i = theirs.length - 1; i >= 0; i--) {
    const m = theirs[i];
    const text = m.text.trim();
    const event = EVENTS.find(([re]) => re.test(text));
    if (!LEAVING.test(text) && !(event && /\b(tonight|tomorrow|later|at \d|this (morning|evening|afternoon))\b/i.test(text))) continue;
    // Talked about since ("dune was sick")? Then it's not open any more.
    const words = content(text);
    const since = theirs.slice(i + 1);
    if (since.some(x => [...content(x.text)].some(w => words.has(w)) || (event && event[0].test(x.text)))) return undefined;
    // REI already asked how it went (a message well after the plan that names it): don't ask again.
    const askedAt = m.createdAt! + 30 * 60000;
    if (event && messages.some(x => x.role === 'rei' && x.createdAt && x.createdAt >= askedAt && event[0].test(x.text))) return undefined;
    // "gotta go prep" names nothing; the driving test they mentioned just before does.
    if (!event) {
      for (let j = i - 1; j >= 0 && m.createdAt! - theirs[j].createdAt! <= 60 * 60000; j--) {
        const earlier = EVENTS.find(([re]) => re.test(theirs[j].text));
        if (earlier) return { text: clip(`${theirs[j].text.trim()} … ${text}`, 160), minutes: Math.max(0, Math.round((now - theirs[j].createdAt!) / 60000)), topic: earlier[1] };
      }
    }
    return { text: clip(text, 160), minutes: Math.max(0, Math.round((now - m.createdAt!) / 60000)), topic: event?.[1] ?? '' };
  }
  return undefined;
}

/** Where the conversation stands at `now`. Only messages with a time count. */
export function thread(messages: Message[], now = Date.now(), timeZone?: string): Thread {
  const timed = messages.filter(m => m.createdAt && m.role !== 'sys' && m.text.trim()).sort((a, b) => a.createdAt! - b.createdAt!);
  const last = timed[timed.length - 1];
  if (!last) return { gap: 'first', minutes: Infinity, lastThem: '', lastRei: '', todayCount: 0 };
  const minutes = Math.max(0, Math.round((now - last.createdAt!) / 60000));
  const yesterday = dayKey(now - 86400000, timeZone);
  const gap: Gap = minutes < 180 ? 'now' : dayKey(last.createdAt!, timeZone) === dayKey(now, timeZone) ? 'today' : dayKey(last.createdAt!, timeZone) === yesterday ? 'yesterday' : 'days';
  const them = [...timed].reverse().find(m => m.role === 'user');
  const rei = [...timed].reverse().find(m => m.role === 'rei' && !m.alert);
  return {
    gap,
    minutes,
    lastThem: clip(them?.text.trim() ?? ''),
    lastRei: clip(rei?.text.trim() ?? ''),
    todayCount: timed.filter(m => dayKey(m.createdAt!, timeZone) === dayKey(now, timeZone)).length,
    plan: openPlan(timed, now),
  };
}

const ago = (min: number) =>
  min < 2 ? 'just now' : min < 60 ? `${min} minutes ago` : min < 1440 ? `${Math.round(min / 60)} hour${Math.round(min / 60) === 1 ? '' : 's'} ago` : `${Math.round(min / 1440)} days ago`;

/** One paragraph for REI's prompt: how to pick the conversation up instead of restarting it. */
export function continuityNote(t: Thread): string {
  const base = gapNote(t);
  // Half an hour on, whatever they left for has started or happened: ask about it first.
  if (!t.plan || t.plan.minutes < 30) return base;
  const ask = t.plan.topic ? ` (for example "How was the ${t.plan.topic}?")` : '';
  return `${base}\nOPEN PLAN: ${ago(t.plan.minutes)} they told you "${t.plan.text}". By now it has happened, so don't wish them luck or tell them to enjoy it. Your first sentence asks how it went${ask}, before anything about food, protein or training. If it clearly wasn't a plan, ignore this.`;
}

function gapNote(t: Thread): string {
  const last = [t.lastThem && `they last said "${t.lastThem}"`, t.lastRei && `you last said "${t.lastRei}"`].filter(Boolean).join('; ');
  switch (t.gap) {
    case 'first':
      return 'CONVERSATION: This is your first conversation with them. Introduce yourself in one line (no "first message" talk), then get to them.';
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
  if (t.gap !== 'first' && t.plan?.topic && t.plan.minutes >= 30) {
    const how = t.plan.topic === 'session' ? 'How did the session go' : `How was the ${t.plan.topic}`;
    return pick([`${o.bro ? 'Yo' : 'Hey'}${n}. ${how}?`, `${how}${n}?`, `There you are${n}. ${how}?`]);
  }
  if (t.gap === 'first') return o.bro ? `Yo${n}, I'm REI. Let's get you sorted.` : `I'm REI${n}. Let's get to work.`;
  if (t.gap === 'now') {
    return pick(about ? [`Back already${n}? Where were we, ${about.toLowerCase()}?`, `Missed me${n}? Go on, ${about.toLowerCase()}.`, `Still here. ${open || 'Carry on.'}`.trim()] : [`Still here${n}.${open}`, `Back again${n}?${open}`]);
  }
  if (t.gap === 'today') return pick([`Round two today${n}.${open}`, `Back for more${n}?${open}`, `There you are again${n}.${open}`]);
  if (t.gap === 'yesterday') return pick([`Morning${n}. Yesterday you said ${about.toLowerCase() || 'a lot'}. How did it go?`, `${o.bro ? 'Yo' : 'Hey'}${n}. Picking up from yesterday.${open}`]);
  return o.tough ? pick([`Look who showed up${n}.${open}`, `Days gone${n}. Let's not make that a habit.${open}`]) : pick([`Welcome back${n}. It's been a few days.${open}`, `There you are${n}. Missed you.${open}`]);
}
