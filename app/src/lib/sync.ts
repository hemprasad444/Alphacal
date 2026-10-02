// Firestore reads and writes for one signed-in user. Writes are fire-and-forget: the
// store has already updated the screen, and Firestore queues writes while offline.
import { collection, deleteDoc, doc, documentId, limit, onSnapshot, orderBy, query, setDoc, where, type Unsubscribe } from 'firebase/firestore';
import type { DayDoc, Food, Message, Profile, SessionLog, Settings, WeekProgram, WeighIn } from '@rei/shared';
import { fb } from './firebase';

export interface UserDoc {
  profile: Profile;
  settings: Settings;
  disc: Record<string, boolean>;
  startedOn: string;
  /** Messages created before this (epoch ms) are hidden from the chat. */
  chatClearedAt: number;
  timezone: string;
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

/** The user's own foods. */
export function onFoods(uid: string, cb: (foods: Food[]) => void): Unsubscribe {
  return onSnapshot(sub(uid, 'foods'), s => cb(s.docs.map(d => ({ ...(d.data() as Food), id: d.id }))), warn('foods listener'));
}

export const write = {
  user: (uid: string, data: Partial<UserDoc>) => setDoc(userRef(uid), clean(data), { merge: true }).catch(warn('user write')),
  day: (uid: string, date: string, data: Partial<DayDoc>) => setDoc(doc(sub(uid, 'days'), date), clean(data), { merge: true }).catch(warn('day write')),
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
  deleteFood: (uid: string, id: string) => deleteDoc(doc(sub(uid, 'foods'), id)).catch(warn('food delete')),
};
