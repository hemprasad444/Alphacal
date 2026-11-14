// Firestore reads and writes for one signed-in user. Writes are fire-and-forget: the
// store has already updated the screen, and Firestore queues writes while offline.
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, documentId, increment, limit, onSnapshot, orderBy, query, runTransaction, setDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { changeMeals, type DayDoc, type Food, type Meal, type Measurement, type MemoryItem, type Message, type ProgressPhoto, type WeeklyReport, type Profile, type SessionLog, type Settings, type WeekProgram, type WeighIn, type Intake } from '@rei/shared';
import { fb } from './firebase';

/** How a meal edit or delete went (see write.changeMeal). */
export type MealChange = 'saved' | 'gone' | 'queued' | 'failed';

/** A transaction that hasn't finished by then is taken as offline. */
const TRANSACTION_MS = 10000;

function within<T>(ms: number, p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timed out')), ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

export interface UserDoc {
  profile: Profile;
  settings: Settings;
  disc: Record<string, boolean>;
  startedOn: string;
  /** Messages created before this (epoch ms) are hidden from the chat. */
  chatClearedAt: number;
  timezone: string;
  /** What REI remembers about them. */
  memory: MemoryItem[];
  /** Finished first-run onboarding. */
  onboarded: boolean;
  /** Their onboarding answers, kept for later (current bests, intensity, preferences). */
  intake: Intake;
}

const userRef = (uid: string) => doc(fb().db, 'users', uid);
const sub = (uid: string, name: string) => collection(fb().db, 'users', uid, name);

const warn = (what: string) => (e: unknown) => console.warn(`REI sync: ${what} failed`, e);

/** Firestore rejects `undefined` field values. */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function onUser(uid: string, cb: (doc: Partial<UserDoc> | null, pending: boolean) => void): Unsubscribe {
  return onSnapshot(userRef(uid), s => cb(s.exists() ? (s.data() as Partial<UserDoc>) : null, s.metadata.hasPendingWrites), warn('user listener'));
}

/** Day documents from `fromIso` (inclusive) onward, keyed by date. */
export function onDays(uid: string, fromIso: string, cb: (days: Record<string, Partial<DayDoc>>) => void): Unsubscribe {
  const q = query(sub(uid, 'days'), where(documentId(), '>=', fromIso));
  return onSnapshot(q, s => cb(Object.fromEntries(s.docs.map(d => [d.id, d.data() as Partial<DayDoc>]))), warn('days listener'));
}

/** The latest messages, oldest first. */
export function onMessages(uid: string, cb: (messages: Message[]) => void, max = 150): Unsubscribe {
  const q = query(sub(uid, 'messages'), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, s => cb(s.docs.map(d => ({ ...(d.data() as Message), id: d.id })).reverse()), warn('messages listener'));
}

export function onWeighIns(uid: string, fromIso: string, cb: (entries: WeighIn[]) => void): Unsubscribe {
  const q = query(sub(uid, 'weighIns'), where(documentId(), '>=', fromIso));
  return onSnapshot(q, s => cb(s.docs.map(d => ({ date: d.id, kg: Number(d.data().kg) })).filter(x => x.kg > 0)), warn('weigh-ins listener'));
}

export function onProgram(uid: string, week: string, cb: (program: WeekProgram | null) => void): Unsubscribe {
  return onSnapshot(doc(fb().db, 'users', uid, 'programs', week), s => cb(s.exists() ? (s.data() as WeekProgram) : null), warn('program listener'));
}

/** Logged sessions and runs from `fromIso` on. */
export function onSessions(uid: string, fromIso: string, cb: (sessions: SessionLog[]) => void): Unsubscribe {
  const q = query(sub(uid, 'sessions'), where('date', '>=', fromIso));
  return onSnapshot(q, s => cb(s.docs.map(d => ({ ...(d.data() as SessionLog), id: d.id }))), warn('sessions listener'));
}

/** The latest weekly reports, newest first. */
export function onReports(uid: string, cb: (reports: WeeklyReport[]) => void): Unsubscribe {
  const q = query(sub(uid, 'reports'), orderBy('generatedAt', 'desc'), limit(8));
  return onSnapshot(q, s => cb(s.docs.map(d => d.data() as WeeklyReport)), warn('reports listener'));
}

export function onMeasurements(uid: string, cb: (ms: Measurement[]) => void): Unsubscribe {
  return onSnapshot(sub(uid, 'measurements'), s => cb(s.docs.map(d => ({ ...(d.data() as Measurement), date: d.id }))), warn('measurements listener'));
}

export function onPhotos(uid: string, cb: (photos: ProgressPhoto[]) => void): Unsubscribe {
  return onSnapshot(sub(uid, 'photos'), s => cb(s.docs.map(d => ({ ...(d.data() as ProgressPhoto), id: d.id }))), warn('photos listener'));
}

/** The user's own foods. */
export function onFoods(uid: string, cb: (foods: Food[]) => void): Unsubscribe {
  return onSnapshot(sub(uid, 'foods'), s => cb(s.docs.map(d => ({ ...(d.data() as Food), id: d.id }))), warn('foods listener'));
}

export const write = {
  user: (uid: string, data: Partial<UserDoc>) => setDoc(userRef(uid), clean(data), { merge: true }).catch(warn('user write')),
  /** Whole-day fields. Not for meals or minutes, which the server also writes: use the writes below. */
  day: (uid: string, date: string, data: Partial<DayDoc>) => setDoc(doc(sub(uid, 'days'), date), clean(data), { merge: true }).catch(warn('day write')),
  // Meals and minutes are never rewritten from this phone's copy, the same way the server writes them:
  // a meal REI logged that hasn't reached this phone yet survives the phone's next change.
  addMeal: (uid: string, date: string, meal: Meal) => setDoc(doc(sub(uid, 'days'), date), { meals: arrayUnion(meal) }, { merge: true }).catch(warn('meal write')),
  /**
   * Edit one meal (`next`) or delete it (`next` null). A transaction reads the stored day, finds the
   * meal (by id, or the first identical one for older meals without an id) and changes only that one.
   * - 'gone': it was deleted or changed elsewhere; nothing was written.
   * - 'queued': offline, and the meal has an id no other meal shares, so a remove-and-add of exactly
   *   it is queued for when the phone is back online (a copy left by a race is dropped on read; see dayMeals).
   * - 'failed': offline, and the meal has no unique id to change it by safely; nothing was written.
   */
  changeMeal: async (uid: string, date: string, target: Meal, next: Meal | null, uniqueId: boolean): Promise<MealChange> => {
    const ref = doc(sub(uid, 'days'), date);
    try {
      return await within(TRANSACTION_MS, runTransaction(fb().db, async tx => {
        const snap = await tx.get(ref);
        const meals = changeMeals((snap.data()?.meals ?? []) as Meal[], target, next, newId);
        if (!meals) return 'gone' as const;
        tx.set(ref, { meals }, { merge: true });
        return 'saved' as const;
      }));
    } catch (e) {
      warn('meal change')(e);
      if (!target.id || !uniqueId) return 'failed';
      const batch = writeBatch(fb().db);
      batch.set(ref, { meals: arrayRemove(target) }, { merge: true });
      if (next) batch.set(ref, { meals: arrayUnion({ ...next, id: target.id }) }, { merge: true });
      batch.commit().catch(warn('queued meal change'));
      return 'queued';
    }
  },
  /** Training logged on this phone: added to whatever the day already holds. */
  addMinutes: (uid: string, date: string, minutes: number) => setDoc(doc(sub(uid, 'days'), date), { sessionDone: true, loggedMin: increment(minutes) }, { merge: true }).catch(warn('minutes write')),
  message: (uid: string, m: Message) => {
    const { id, ...rest } = m;
    return setDoc(doc(sub(uid, 'messages'), id ?? newId()), clean({ ...rest, createdAt: m.createdAt ?? Date.now() })).catch(warn('message write'));
  },
  session: (uid: string, data: SessionLog) => {
    const { id, ...rest } = data;
    return setDoc(doc(sub(uid, 'sessions'), id ?? newId()), clean({ ...rest, createdAt: data.createdAt ?? Date.now() })).catch(warn('session write'));
  },
  weighIn: (uid: string, date: string, kg: number) => setDoc(doc(sub(uid, 'weighIns'), date), { kg }).catch(warn('weigh-in write')),
  food: (uid: string, f: Food) => {
    const { id, ...rest } = f;
    return setDoc(doc(sub(uid, 'foods'), id), clean(rest)).catch(warn('food write'));
  },
  measurement: (uid: string, m: Measurement) => setDoc(doc(sub(uid, 'measurements'), m.date), clean(m)).catch(warn('measurement write')),
  photo: (uid: string, p: ProgressPhoto) => {
    const { id, ...rest } = p;
    return setDoc(doc(sub(uid, 'photos'), id), clean(rest)).catch(warn('photo write'));
  },
  deletePhoto: (uid: string, id: string) => deleteDoc(doc(sub(uid, 'photos'), id)).catch(warn('photo delete')),
  deleteFood: (uid: string, id: string) => deleteDoc(doc(sub(uid, 'foods'), id)).catch(warn('food delete')),
};

/** One row of the weekly leaderboard: leaderboard/{week}/players/{uid}. */
export interface Player {
  uid: string;
  name: string;
  /** XP earned this week. */
  xp: number;
  /** Rank id (game.ts RANKS). */
  rank: string;
  /** Theme id, for their colour. */
  theme: string;
  updatedAt: number;
}

const players = (week: string) => collection(fb().db, 'leaderboard', week, 'players');

/** Post your week's XP; only your own row, and only when it changed. */
export function postScore(uid: string, week: string, p: Omit<Player, 'uid' | 'updatedAt'>): Promise<void> {
  return setDoc(doc(players(week), uid), { ...p, name: p.name.slice(0, 24) || 'Anonymous', updatedAt: Date.now() }).catch(warn('leaderboard write'));
}

/** Off the board: their row for the week goes. */
export function removeScore(uid: string, week: string): Promise<void> {
  return deleteDoc(doc(players(week), uid)).catch(warn('leaderboard remove'));
}

/** The week's top players, best first. */
export function onBoard(week: string, cb: (rows: Player[]) => void, top = 50): Unsubscribe {
  const q = query(players(week), orderBy('xp', 'desc'), limit(top));
  return onSnapshot(q, s => cb(s.docs.map(d => ({ ...(d.data() as Omit<Player, 'uid'>), uid: d.id }))), warn('leaderboard listener'));
}
