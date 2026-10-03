import { activityFromDay, type ContextInput, type Food, type MemoryItem, readMemory, DEFAULT_DISCIPLINES, DEFAULT_PROFILE, DEFAULT_SETTINGS, type DayDoc, isoDate, isoWeek, type Message, type Profile, type Settings, type WeekProgram, weekdayIndex, zonedNow } from '@rei/shared';
import { FieldPath } from 'firebase-admin/firestore';
import { db } from '../admin';

/** Past messages sent to the model with each request. */
const HISTORY = 30;
/** Messages a user may send per day. */
export const DAILY_LIMIT = 300;
/** Own foods read per request; plenty for a few testers. */
const MAX_FOODS = 400;

/** Usage counters are per UTC day, so they can be read before the user's zone is known. */
export const usageDay = () => new Date().toISOString().slice(0, 10);

export interface Loaded {
  input: ContextInput;
  settings: Settings;
  /** Visible chat, oldest first. */
  messages: Message[];
  today: string;
  timeZone: string;
  usedToday: number;
  /** Proactive nudges already sent today (see coach.ts). */
  nudgesSent: string[];
  /** The user's own foods: saved meals, barcode products, corrected numbers. */
  foods: Food[];
  memory: MemoryItem[];
}

/**
 * Everything REI needs for one reply, in a single parallel round of reads.
 * Days are fetched from eight days back in UTC so the user's week is covered in any zone.
 */
export async function loadUser(uid: string): Promise<Loaded> {
  const user = db.doc(`users/${uid}`);
  const since = new Date(Date.now() - 8 * 86400000);
  // The user's ISO week depends on their zone; fetch the candidates around now in the same round.
  const weeks = [...new Set([-1, 0, 1].map(d => isoWeek(new Date(Date.now() + d * 86400000))))];
  const [userSnap, daySnaps, msgSnaps, usage, programSnaps, foodSnaps] = await Promise.all([
    user.get(),
    user.collection('days').where(FieldPath.documentId(), '>=', isoDate(since)).get(),
    user.collection('messages').orderBy('createdAt', 'desc').limit(HISTORY + 10).get(),
    user.collection('usage').doc(usageDay()).get(),
    db.getAll(...weeks.map(w => user.collection('programs').doc(w))),
    user.collection('foods').limit(MAX_FOODS).get(),
  ]);
  const u = userSnap.data() ?? {};
  const timeZone: string = typeof u.timezone === 'string' ? u.timezone : 'Asia/Kolkata';
  const now = zonedNow(timeZone);
  const today = isoDate(now);
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekdayIndex(now));

  const days = Object.fromEntries(daySnaps.docs.map(d => [d.id, d.data() as Partial<DayDoc>]));
  const t = days[today] ?? {};
  const sessions = Object.fromEntries(Object.entries(days).filter(([d]) => d >= isoDate(monday) && d < today).map(([d, v]) => [d, !!v.sessionDone]));
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(u.settings as Partial<Settings> | undefined) };
  const clearedAt = typeof u.chatClearedAt === 'number' ? u.chatClearedAt : 0;
  const memory = readMemory(u.memory);
  const messages = msgSnaps.docs
    .map(d => ({ ...(d.data() as Message), id: d.id }))
    .filter(m => (m.createdAt ?? 0) > clearedAt)
    .reverse();

  return {
    input: {
      profile: { ...DEFAULT_PROFILE, ...(u.profile as Partial<Profile> | undefined) },
      disc: (u.disc as Record<string, boolean> | undefined) ?? DEFAULT_DISCIPLINES,
      meals: t.meals ?? [],
      sessionDone: !!t.sessionDone,
      history: { kind: 'real', startedOn: typeof u.startedOn === 'string' ? u.startedOn : today, sessions },
      activity: activityFromDay(t.steps, t.sleepMin),
      // Bro pushes as hard as tough love, in a friend's voice.
      tough: settings.tone !== 'Coach',
      bro: settings.tone === 'Bro',
      nudge: settings.nudge,
      now,
      program: (programSnaps.find(p => p.id === isoWeek(now) && p.exists)?.data() as WeekProgram | undefined) ?? null,
      memory,
    },
    memory,
    settings,
    messages: messages.slice(-HISTORY),
    today,
    timeZone,
    usedToday: Number(usage.data()?.chat ?? 0),
    foods: foodSnaps.docs.map(d => {
      const f = d.data() as Food;
      return { ...f, id: d.id, src: f.src === 'barcode' ? 'barcode' : 'mine' } satisfies Food;
    }),
    nudgesSent: Array.isArray((t as { nudges?: unknown }).nudges) ? ((t as { nudges: string[] }).nudges) : [],
  };
}
