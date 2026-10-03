import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadState, saveSlices } from '../lib/persist';
import { sliceStore } from '../lib/sliceStore';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  type Activity, activityFor, activityFromDay, addMemory, distanceKcal, type Movement, movementKcal, applyUpdate, catalog, forgetMemory, type MemoryItem, readMemory, clock, type DaySummary, daySummary, fallbackReport, type Measurement, mondayOf, newPrs, pace, type ProgressPhoto, type SessionLog, type WeeklyReport, weekStats, DEFAULT_DISCIPLINES, DEFAULT_PROFILE, DEFAULT_SETTINGS, type Food, fuelLine, hhmm, type History, isoDate, isoWeek, matchMealText, type Meal, type MealItem, mealFromItems, mealNote, type Message, nutrition as calcNutrition, offlineReply, parseReply, type Profile, type ProfileKey, reiContext, seedFor, sessionSummary, stripTags, type SetLog, type Settings, todaysPlan, toMeal, week as calcWeek, weekdayIndex, type WeekProgram, type WeighIn,
} from '@rei/shared';
import { type ChatDone, type ChatRequest, streamChat } from '../lib/api';
import { fb, firebaseEnabled } from '../lib/firebase';
import { lookupBarcode } from '../lib/foods';
import { deletePhotoFile, uploadPhoto } from '../lib/photos';
import { newId, onDays, onFoods, onMeasurements, onMessages, onPhotos, onProgram, onReports, onSessions, onUser, onWeighIns, write } from '../lib/sync';
import { httpsCallable } from 'firebase/functions';
import { DEFAULT_EMBLEM, EMBLEMS, THEMES, type Emblem, type Theme } from '../lib/theme';
import { type Account, useAccount } from './account';

const LOCAL_KEY = 'rei-state-v1';
const cloudKey = (uid: string) => `rei-cloud-v1-${uid}`;

interface Persisted {
  settings: Settings;
  profile: Profile;
  disc: Record<string, boolean>;
  meals: Meal[];
  /** In cloud mode: everything the listener returned, including cleared messages. */
  messages: Message[];
  sessionDone: boolean;
  loggedMin: number;
  startedOn: string;
  day: string;
  // Cloud mode only.
  activity: Activity | null;
  /** Past days of this week: date → session completed. */
  weekSessions: Record<string, boolean>;
  weighIns: WeighIn[];
  chatClearedAt: number;
  /** REI's plan for the current week, when one has been written. */
  program: WeekProgram | null;
  /** Your own foods: favourites, scanned products, saved meals. */
  foods: Food[];
  /** Meals from the last two weeks before today, newest first. */
  recentMeals: Meal[];
  /** Sessions and runs from the last six months. */
  sessions: SessionLog[];
  /** Totals for the last 90 days before today, for streaks and badges. */
  pastDays: DaySummary[];
  reports: WeeklyReport[];
  measurements: Measurement[];
  photos: ProgressPhoto[];
  /** Lasting facts REI uses in every answer. */
  memory: MemoryItem[];
}

/** The old format kept everything in one AsyncStorage key per mode; moved over on first load. */
const LEGACY = { get: (k: string) => AsyncStorage.getItem(k), remove: (k: string) => AsyncStorage.removeItem(k) };

function fresh(settings: Settings = DEFAULT_SETTINGS, demo = true): Persisted {
  const seed = demo ? seedFor(settings.scenario) : { meals: [], messages: [] };
  return {
    settings,
    profile: DEFAULT_PROFILE,
    disc: DEFAULT_DISCIPLINES,
    meals: seed.meals,
    messages: seed.messages,
    sessionDone: false,
    loggedMin: 0,
    startedOn: isoDate(),
    day: isoDate(),
    activity: null,
    weekSessions: {},
    weighIns: [],
    chatClearedAt: 0,
    program: null,
    foods: [],
    recentMeals: [],
    sessions: [],
    pastDays: [],
    reports: [],
    measurements: [],
    photos: [],
    memory: [],
  };
}

/** `next` if its contents differ from `cur`, else `cur` itself. */
function same<T>(cur: T, next: T): T {
  return JSON.stringify(cur) === JSON.stringify(next) ? cur : next;
}

/** Each top-level field is saved separately. */
const SLICES = Object.keys(fresh()) as (keyof Persisted)[];

/** Meals worth one-tap repeating: the most often eaten, then the most recent. */
function repeatable(today: Meal[], past: Meal[], max = 8): Meal[] {
  const seen = new Map<string, { meal: Meal; n: number; at: number }>();
  [...[...today].reverse(), ...past].forEach((m, i) => {
    const k = m.name.trim().toLowerCase();
    const cur = seen.get(k);
    if (cur) cur.n++;
    else seen.set(k, { meal: m, n: 1, at: i });
  });
  return [...seen.values()].sort((a, b) => b.n - a.n || a.at - b.at).slice(0, max).map(x => x.meal);
}

/** Your foods first; they replace built-ins with the same id (a favourited dish, say). */
function withCatalog(mine: Food[]): Food[] {
  const ids = new Set(mine.map(f => f.id));
  return [...mine, ...catalog().filter(f => !ids.has(f.id))];
}

/** An item for a piece REI couldn't be asked about: a rough on-device estimate. */
function estimateItem(text: string): MealItem {
  const e = toMeal(null, text, '');
  return { food: '', name: e.name, qty: 1, unit: 'serving', g: 0, kcal: e.kcal, p: e.p, c: e.c, f: e.f };
}

const historyOf = (s: Persisted, cloud: boolean): History =>
  cloud ? { kind: 'real', startedOn: s.startedOn, sessions: s.weekSessions } : { kind: 'demo', scenario: s.settings.scenario };

const activityIn = (s: Persisted, cloud: boolean, sessionDone = s.sessionDone): Activity =>
  cloud ? s.activity ?? activityFromDay(null, null) : activityFor(s.settings.scenario, sessionDone);

const visibleMessages = (s: Persisted, cloud: boolean) => (cloud ? s.messages.filter(m => (m.createdAt ?? 0) > s.chatClearedAt) : s.messages);

function mondayIso(now = new Date()): string {
  const d = new Date(now);
  d.setDate(now.getDate() - weekdayIndex(now));
  return isoDate(d);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

export interface Store extends Persisted {
  ready: boolean;
  account: Account;
  /** Signed in: data lives in Firestore and syncs across devices. */
  cloud: boolean;
  theme: Theme;
  accent: string;
  emblem: Emblem | null;
  history: History;
  activity: Activity;
  /** Undefined in demo mode, where the demo weigh-ins are used. */
  weighInsOrDemo: WeighIn[] | undefined;
  thinking: boolean;
  fuelBusy: boolean;
  fuelVerdict: string;
  /** Your foods, then the built-in list (yours replace built-ins with the same id). */
  allFoods: Food[];
  /** Meals to repeat in one tap. */
  recent: Meal[];
  signIn: (email: string, password: string) => Promise<unknown>;
  signUp: (email: string, password: string) => Promise<unknown>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  setDemo: (on: boolean) => void;
  setOpt: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  pickTheme: (id: Theme['id']) => void;
  setEmblem: (id: string | null) => void;
  setProfileField: (k: ProfileKey, v: string) => void;
  toggleDisc: (k: string) => void;
  send: (text: string) => Promise<void>;
  /** A reply for the voice screen, which keeps its own turns until it closes. */
  voiceReply: (turns: Message[], onDelta?: (text: string) => void) => Promise<{ text: string; note: string | null }>;
  appendMessages: (ms: Message[]) => void;
  logMeal: (text: string) => Promise<void>;
  /** Signed in only: REI reads a meal photo (base64 JPEG) and logs it if sure. */
  logMealPhoto: (jpegBase64: string, note?: string) => Promise<void>;
  removeMeal: (i: number) => void;
  /** Log foods picked from the list: instant, exact, and offline. */
  logItems: (items: MealItem[], src?: Meal['src'], name?: string) => void;
  repeatMeal: (m: Meal) => void;
  updateMeal: (i: number, m: Meal) => void;
  saveFood: (f: Food) => void;
  removeFood: (id: string) => void;
  toggleFav: (f: Food) => void;
  /** Your saved product first, then Open Food Facts. */
  findBarcode: (code: string) => Promise<Food | null>;
  finishSession: (done: number, total: number, seconds: number, sets?: SetLog[], title?: string) => void;
  /** REI's report on the week so far (on the device in demo mode or offline). */
  writeReport: () => Promise<WeeklyReport>;
  saveMeasurement: (m: Measurement) => void;
  /** Tell REI something to remember, or drop a fact. */
  remember: (text: string, kind?: MemoryItem['kind']) => void;
  forget: (id: string) => void;
  /** Store a progress photo: a resized JPEG, as base64 and its local file. */
  addPhoto: (jpegBase64: string, uri: string, pose: ProgressPhoto['pose']) => Promise<void>;
  removePhoto: (p: ProgressPhoto) => void;
  /** A run, walk or ride by distance and time. Counts as today's session. */
  logCardio: (km: number, seconds: number, kind?: 'run' | 'walk' | 'cycle') => void;
  /** A sport or activity by minutes, with its estimated burn. Counts as today's session. */
  logActivity: (m: Movement, minutes: number) => void;
  /** Ask REI to rewrite this week's training. Resolves with REI's note for the week. */
  rebuildProgram: (focus?: string) => Promise<string>;
  clearChat: () => void;
  resetDay: () => void;
}

/**
 * A value components subscribe to directly. Each component re-renders only when what it
 * selects changes, instead of every consumer re-rendering on every change of one context.
 */
interface Source<T> {
  get: () => T;
  set: (v: T) => void;
  emit: () => void;
  /** Emit on the next frame, once, however many times it's called before then. */
  emitSoon: () => void;
  subscribe: (l: () => void) => () => void;
}

function createSource<T>(initial: T): Source<T> {
  let value = initial;
  let pending = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(l => l());
  return {
    get: () => value,
    set: v => {
      value = v;
    },
    emit,
    // Words can arrive faster than the screen redraws: tell listeners at most once a frame.
    emitSoon: () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        emit();
      });
    },
    subscribe: l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const Ctx = createContext<Source<Store | null> | null>(null);
const LiveCtx = createContext<Source<Message | null> | null>(null);

/**
 * The whole store, or one slice of it: `useStore(s => s.settings.font)`. A selector must
 * return a primitive or an object already in the store (not a new one), so unchanged
 * slices compare equal and skip the render.
 */
export function useStore(): Store;
export function useStore<T>(select: (s: Store) => T): T;
export function useStore<T>(select?: (s: Store) => T): Store | T {
  const src = useContext(Ctx);
  if (!src) throw new Error('useStore outside StoreProvider');
  const get = () => {
    const s = src.get()!;
    return select ? select(s) : s;
  };
  return useSyncExternalStore(src.subscribe, get, get);
}

/** REI's reply while it streams in. Only the chat bubble listens, not the whole app. */
export function useLiveReply(): Message | null {
  const src = useContext(LiveCtx);
  if (!src) throw new Error('useLiveReply outside StoreProvider');
  return useSyncExternalStore(src.subscribe, src.get, src.get);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { account, setDemo, signIn, signUp, resetPassword, signOut } = useAccount();
  const uid = account.status === 'signedIn' ? account.uid : null;
  const cloud = !!uid;
  // Which saved state is loaded: the on-device demo, or a signed-in user's cache.
  const storageKey = uid ? cloudKey(uid) : account.status === 'off' || account.demo ? LOCAL_KEY : null;

  const [p, setP] = useState<Persisted>(() => fresh());
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [today, setToday] = useState(isoDate);
  const [thinking, setThinking] = useState(false);
  const [fuelBusy, setFuelBusy] = useState(false);
  const [fuelVerdict, setFuelVerdict] = useState('');
  /** REI's reply while it streams in, until the stored copy arrives from Firestore. */
  const [live] = useState(() => createSource<Message | null>(null));
  const [source] = useState(() => createSource<Store | null>(null));
  const setStreaming = useCallback((next: Message | null | ((cur: Message | null) => Message | null)) => {
    live.set(typeof next === 'function' ? next(live.get()) : next);
    live.emitSoon();
  }, [live]);
  const ref = useRef(p);
  /** What was last written to storage, to find the slices that changed. */
  const savedRef = useRef<Partial<Persisted> | null>(null);
  const uidRef = useRef(uid);
  // Local edits not yet written: the listener must not overwrite them with older values.
  const dirtyProfile = useRef(false);
  const profileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    ref.current = p;
    uidRef.current = uid;
  }, [p, uid]);

  const patch = useCallback((x: Partial<Persisted> | ((s: Persisted) => Partial<Persisted>)) => {
    setP(s => ({ ...s, ...(typeof x === 'function' ? x(s) : x) }));
  }, []);

  // The calendar day, so an open app rolls over at midnight.
  useEffect(() => {
    const t = setInterval(() => setToday(isoDate()), 60000);
    return () => clearInterval(t);
  }, []);

  // Load the saved state for the current mode. It renders immediately; in cloud mode
  // the Firestore listeners below then bring it up to date.
  useEffect(() => {
    if (!storageKey) return;
    let live = true;
    loadState<Persisted>(sliceStore, storageKey, SLICES, LEGACY)
      .then(saved => {
        if (!live) return;
        const base = fresh(DEFAULT_SETTINGS, !uid);
        savedRef.current = saved;
        if (!saved) {
          setP(base);
          return;
        }
        const next: Persisted = { ...base, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings }, profile: { ...DEFAULT_PROFILE, ...saved.profile } };
        if (next.day !== isoDate()) Object.assign(next, { day: isoDate(), meals: [], pastDays: [...next.pastDays, daySummary(next.day, { meals: next.meals, sessionDone: next.sessionDone })].slice(-90), recentMeals: [...[...next.meals].reverse(), ...next.recentMeals].slice(0, 80), sessionDone: false, loggedMin: 0, activity: null });
        setP(next);
      })
      .catch(e => console.warn('REI: could not load saved state', e))
      .finally(() => live && setLoadedKey(storageKey));
    return () => {
      live = false;
    };
  }, [storageKey, uid]);

  const ready = account.status !== 'loading' && (storageKey === null || loadedKey === storageKey);

  useEffect(() => {
    if (!ready || !storageKey) return;
    // Only the slices that changed since the last save are written.
    const t = setTimeout(() => {
      const next = ref.current;
      saveSlices(sliceStore, storageKey, next, savedRef.current, SLICES)
        .then(() => {
          savedRef.current = next;
        })
        .catch(e => console.warn('REI: could not save state', e));
    }, 300);
    return () => clearTimeout(t);
  }, [p, ready, storageKey]);

  // A new day on-device: empty food log, no session.
  useEffect(() => {
    if (!ready || ref.current.day === today) return;
    patch(cur => ({ day: today, meals: [], pastDays: [...cur.pastDays, daySummary(cur.day, { meals: cur.meals, sessionDone: cur.sessionDone })].slice(-90), recentMeals: [...[...cur.meals].reverse(), ...cur.recentMeals].slice(0, 80), sessionDone: false, loggedMin: 0, activity: null }));
  }, [today, ready, patch]);

  const msg = useCallback((role: Message['role'], text: string, extra: Partial<Message> = {}): Message => {
    seq.current = (seq.current + 1) % 1000;
    return { id: newId(), role, text, time: hhmm(), createdAt: Date.now() + seq.current / 1000, ...extra };
  }, []);

  /** Add messages to the chat, and to Firestore when signed in. */
  const pushMessages = useCallback((ms: Message[]) => {
    patch(cur => ({ messages: [...cur.messages, ...ms] }));
    const u = uidRef.current;
    if (u) ms.forEach(m => write.message(u, m));
  }, [patch]);

  const saveMeals = useCallback((meals: Meal[]) => {
    patch({ meals });
    const u = uidRef.current;
    if (u) write.day(u, ref.current.day, { meals });
  }, [patch]);

  // Cloud listeners.
  useEffect(() => {
    if (!uid || loadedKey !== cloudKey(uid)) return;
    const unsubs = [
      onUser(uid, doc => {
        if (!doc) {
          // First sign-in: start the account from what's on this device.
          const s = ref.current;
          const startedOn = isoDate();
          write.user(uid, { profile: s.profile, settings: s.settings, disc: s.disc, startedOn, chatClearedAt: 0, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
          patch({ startedOn });
          pushMessages([msg('rei', 'You’re in. I have your vow. Now we find out if you meant it. What’s first today?')]);
          return;
        }
        // Unchanged values keep their old object, so nothing redraws or re-saves for them.
        patch(cur => ({
          ...(doc.profile && !dirtyProfile.current ? { profile: same(cur.profile, { ...DEFAULT_PROFILE, ...doc.profile }) } : {}),
          ...(doc.settings ? { settings: same(cur.settings, { ...DEFAULT_SETTINGS, ...doc.settings }) } : {}),
          ...(doc.disc ? { disc: same(cur.disc, doc.disc) } : {}),
          startedOn: doc.startedOn ?? cur.startedOn,
          ...(doc.memory ? { memory: same(cur.memory, readMemory(doc.memory)) } : {}),
          chatClearedAt: doc.chatClearedAt ?? 0,
        }));
      }),
      // 90 days back: this week's sessions, two weeks of meals to repeat, and streaks.
      onDays(uid, daysAgoIso(90), days => {
        const t = days[today];
        const monday = mondayIso(), twoWeeks = daysAgoIso(14);
        const past = Object.entries(days).filter(([d]) => d < today).sort(([a], [b]) => (a < b ? -1 : 1));
        const weekSessions = Object.fromEntries(past.filter(([d]) => d >= monday).map(([d, v]) => [d, !!v.sessionDone]));
        const recentMeals = past.filter(([d]) => d >= twoWeeks).reverse().flatMap(([, v]) => [...(v.meals ?? [])].reverse());
        patch({
          weekSessions,
          recentMeals,
          pastDays: past.map(([d, v]) => daySummary(d, v)),
          day: today,
          meals: t?.meals ?? [],
          sessionDone: !!t?.sessionDone,
          loggedMin: t?.loggedMin ?? 0,
          activity: activityFromDay(t?.steps, t?.sleepMin),
        });
      }),
      onMessages(uid, messages => patch({ messages })),
      onWeighIns(uid, daysAgoIso(120), weighIns => patch({ weighIns })),
      onProgram(uid, isoWeek(), program => patch({ program })),
      onFoods(uid, foods => patch({ foods })),
      onSessions(uid, daysAgoIso(183), sessions => patch({ sessions })),
      onReports(uid, reports => patch({ reports })),
      onMeasurements(uid, measurements => patch({ measurements })),
      onPhotos(uid, photos => patch({ photos })),
    ];
    return () => unsubs.forEach(u => u());
  }, [uid, loadedKey, today, patch, pushMessages, msg]);

  const history = useCallback((s: Persisted) => historyOf(s, !!uidRef.current), []);
  const activityOf = useCallback((s: Persisted, sessionDone = s.sessionDone) => activityIn(s, !!uidRef.current, sessionDone), []);

  /** REI's on-device answer, used in demo mode and when the backend can't be reached. */
  const offline = useCallback((text: string, s: Persisted) => {
    const x = reiContext({
      profile: s.profile, disc: s.disc, meals: s.meals, sessionDone: s.sessionDone, history: history(s), activity: activityOf(s),
      tough: s.settings.tone !== 'Coach', bro: s.settings.tone === 'Bro', nudge: s.settings.nudge, now: new Date(), program: s.program, memory: s.memory,
    });
    return parseReply(offlineReply(text, x));
  }, [history, activityOf]);

  /**
   * Signed in: ask the backend, which stores the reply (and any meal or vow change)
   * itself. Returns null when it can't be reached, so the caller falls back to offline.
   */
  const remote = useCallback(async (req: Omit<ChatRequest, 'replyId'>, onDelta?: (text: string) => void): Promise<ChatDone | null> => {
    if (!uidRef.current) return null;
    const replyId = newId();
    let raw = '';
    try {
      return await streamChat({ ...req, replyId }, d => {
        raw += d;
        // A tag can arrive split across deltas, so strip from the whole text so far.
        const text = stripTags(raw);
        setStreaming({ id: replyId, role: 'rei', text, time: hhmm(), createdAt: Date.now() });
        onDelta?.(d);
      });
    } catch (e) {
      console.warn('REI: backend reply failed, answering offline', e);
      setStreaming(null);
      return null;
    }
  }, [setStreaming]);

  const saveProfile = useCallback((profile: Profile, weightChanged: boolean) => {
    patch({ profile });
    const u = uidRef.current;
    if (!u) return;
    dirtyProfile.current = true;
    if (profileTimer.current) clearTimeout(profileTimer.current);
    profileTimer.current = setTimeout(() => {
      const cur = ref.current;
      write.user(u, { profile: cur.profile }).finally(() => {
        dirtyProfile.current = false;
      });
      const kg = parseFloat(cur.profile.weight);
      if (weightChanged && kg > 0) write.weighIn(u, cur.day, kg);
    }, 600);
  }, [patch]);

  /** A typed meal without REI: list matches, plus rough estimates for the rest. */
  const offlineMeal = useCallback((text: string): Meal => {
    const r = matchMealText(text, withCatalog(ref.current.foods));
    const items = [...r.items, ...r.unmatched.map(estimateItem)];
    return items.length ? mealFromItems(items, hhmm(), r.unmatched.length ? undefined : 'food') : toMeal(null, text, hhmm());
  }, []);

  const saveFood = useCallback((f: Food) => {
    patch(cur => ({ foods: [...cur.foods.filter(x => x.id !== f.id), f] }));
    const u = uidRef.current;
    if (u) write.food(u, f);
  }, [patch]);

  const removeFood = useCallback((id: string) => {
    patch(cur => ({ foods: cur.foods.filter(x => x.id !== id) }));
    const u = uidRef.current;
    if (u) write.deleteFood(u, id);
  }, [patch]);

  const addMeal = useCallback((meal: Meal) => {
    const cur = ref.current;
    const meals = [...cur.meals, meal];
    saveMeals(meals);
    setFuelVerdict(fuelLine(cur.profile, calcNutrition(meals, activityOf(cur))));
    // Your foods you use most float up in search.
    const now = Date.now();
    for (const i of meal.items ?? []) {
      const mine = cur.foods.find(f => f.id === i.food);
      if (mine) saveFood({ ...mine, usedAt: now });
    }
  }, [saveMeals, activityOf, saveFood]);

  const logItems = useCallback((items: MealItem[], src: Meal['src'] = 'food', name?: string) => {
    if (items.length) addMeal(mealFromItems(items, hhmm(), src, name));
  }, [addMeal]);

  const send = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || thinking) return;
    const userMsg = msg('user', text);
    pushMessages([userMsg]);
    setThinking(true);
    try {
      const done = await remote({ text, mode: 'chat', userMessageId: userMsg.id });
      if (done) {
        setStreaming(cur => (cur ? { ...cur, text: done.text } : null));
        return;
      }
      const cur = ref.current;
      const r = { ...offline(text, cur), offline: true };
      const notes: Message[] = [];
      const upd = applyUpdate(cur.profile, r.upd);
      if (upd) notes.push(msg('sys', upd.note));
      let meal: Meal | null = null;
      if (r.meal || (r.offline && /^just ate/i.test(text))) {
        meal = r.meal ? toMeal(r.meal, text, hhmm()) : offlineMeal(text.replace(/^just ate:?\s*/i, ''));
        notes.push(msg('sys', mealNote(meal)));
      }
      // Offline answers about food should reflect the meal just logged.
      if (meal && r.offline) r.text = fuelLine(cur.profile, calcNutrition([...cur.meals, meal], activityOf(cur)));
      const strong = !cloud && cur.settings.scenario === 'Strong week';
      const rei = msg('rei', r.text, { alert: !strong && /miss|excuse|negotiat|skip|again|stop/i.test(r.text) });
      pushMessages([rei, ...notes]);
      if (upd) saveProfile(upd.profile, upd.profile.weight !== cur.profile.weight);
      if (meal) saveMeals([...cur.meals, meal]);
    } finally {
      setThinking(false);
    }
  }, [thinking, cloud, msg, pushMessages, remote, offline, offlineMeal, activityOf, saveProfile, saveMeals, setStreaming]);

  const voiceReply = useCallback(async (turns: Message[], onDelta?: (text: string) => void) => {
    const lastTurn = turns[turns.length - 1];
    if (uidRef.current && lastTurn) {
      // Signed in, voice turns are stored as they happen, like chat.
      const userMsg = msg('user', lastTurn.text);
      pushMessages([userMsg]);
      const done = await remote({ text: lastTurn.text, mode: 'chat', userMessageId: userMsg.id, voice: true }, onDelta);
      if (done) return { text: done.text, note: done.notes[0] ?? null };
    }
    const cur = ref.current;
    const r = offline(lastTurn?.text ?? '', cur);
    const upd = applyUpdate(cur.profile, r.upd);
    const lastUser = turns[turns.length - 1]?.text ?? '';
    const meal = r.meal ? toMeal(r.meal, lastUser, hhmm()) : /^just ate/i.test(lastUser) ? offlineMeal(lastUser.replace(/^just ate:?\s*/i, '')) : null;
    if (upd) saveProfile(upd.profile, upd.profile.weight !== cur.profile.weight);
    if (meal) saveMeals([...cur.meals, meal]);
    return { text: r.text, note: upd?.note ?? (meal ? mealNote(meal) : null) };
  }, [msg, pushMessages, remote, offline, offlineMeal, saveProfile, saveMeals]);

  const logMeal = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || fuelBusy) return;
    // Everything found on the food list: log it now with the list's numbers, no round trip.
    const match = matchMealText(text, withCatalog(ref.current.foods));
    if (match.items.length && !match.unmatched.length) {
      logItems(match.items, 'food');
      return;
    }
    setFuelBusy(true);
    try {
      const userMsg = msg('user', 'Just ate: ' + text);
      if (uidRef.current) {
        pushMessages([userMsg]);
        // The backend estimates the macros, stores the meal and writes REI's verdict.
        const done = await remote({ text, mode: 'meal', userMessageId: userMsg.id });
        if (done) {
          setFuelVerdict(done.text);
          return;
        }
      }
      const cur = ref.current;
      const meal = offlineMeal(text);
      const meals = [...cur.meals, meal];
      const reply = fuelLine(cur.profile, calcNutrition(meals, activityOf(cur)));
      setFuelVerdict(reply);
      saveMeals(meals);
      pushMessages([...(uidRef.current ? [] : [userMsg]), msg('rei', reply), msg('sys', mealNote(meal))]);
    } finally {
      setFuelBusy(false);
    }
  }, [fuelBusy, msg, remote, activityOf, saveMeals, pushMessages, logItems, offlineMeal]);

  const finishSession = useCallback((done: number, total: number, seconds: number, sets?: SetLog[], title?: string) => {
    const s = ref.current;
    const min = Math.max(1, Math.round(seconds / 60));
    const nu = calcNutrition(s.meals, activityOf(s, true));
    const left = Math.max(0, (parseFloat(s.profile.protein) || 0) - nu.protein);
    const missed = calcWeek(history(s), false, new Date(), s.program).missed;
    const plan = todaysPlan(new Date(), s.program);
    const log: SessionLog = { id: newId(), date: s.day, plan: plan?.key ?? 'PUSH', title: title ?? plan?.title, done, total, seconds, ...(sets ? { sets } : {}), createdAt: Date.now() };
    const prs = newPrs(log, s.sessions);
    const sum = sessionSummary(done, total, min, left, log.title ?? 'Session', missed);
    const prText = prs.length ? ` New PR${prs.length > 1 ? 's' : ''}: ${prs.slice(0, 2).map(p => p.text).join('; ')}.` : '';
    patch({ sessionDone: true, loggedMin: min, sessions: [...s.sessions, log] });
    pushMessages([msg('rei', sum.text + prText, { alert: sum.alert })]);
    const u = uidRef.current;
    if (u) {
      write.day(u, s.day, { sessionDone: true, loggedMin: min });
      write.session(u, log);
    }
  }, [patch, msg, pushMessages, activityOf, history]);

  const logCardio = useCallback((km: number, seconds: number, kind: 'run' | 'walk' | 'cycle' = 'run') => {
    const s = ref.current;
    const title = kind === 'run' ? 'Run' : kind === 'walk' ? 'Walk' : 'Ride';
    const kg = parseFloat(s.profile.weight) || 0;
    const kcal = distanceKcal(kind, km, seconds, kg);
    const log: SessionLog = { id: newId(), date: s.day, plan: 'RUN', title, done: 1, total: 1, seconds, cardio: { km, seconds, kind, ...(kcal ? { kcal } : {}) }, createdAt: Date.now() };
    const min = Math.max(1, Math.round(seconds / 60));
    patch({ sessionDone: true, loggedMin: s.loggedMin + min, sessions: [...s.sessions, log] });
    pushMessages([msg('rei', `Logged: ${title.toLowerCase()}, ${+km.toFixed(2)} km in ${clock(seconds)}${kind === 'cycle' ? '' : `, ${pace(km, seconds)}`}${kcal ? `, about ${kcal} kcal` : ''}. That counts. Now refuel with protein.`)]);
    const u = uidRef.current;
    if (u) {
      write.day(u, s.day, { sessionDone: true, loggedMin: s.loggedMin + min });
      write.session(u, log);
    }
  }, [patch, msg, pushMessages]);

  const setOpt = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => {
    const cur = ref.current;
    const settings = { ...cur.settings, [k]: v };
    // In demo mode, switching the scenario replays that story from the start of the day.
    if (!uidRef.current && k === 'scenario' && v !== cur.settings.scenario) {
      setFuelVerdict('');
      patch({ settings, ...seedFor(v as Settings['scenario']), sessionDone: false, loggedMin: 0 });
      return;
    }
    patch({ settings });
    if (uidRef.current) write.user(uidRef.current, { settings });
  }, [patch]);

  const value = useMemo<Store>(() => {
    const theme = THEMES.find(t => t.id === p.settings.theme) ?? THEMES[0];
    const items = EMBLEMS[theme.id] ?? [];
    const sel = theme.id in p.settings.bgByTheme ? p.settings.bgByTheme[theme.id] : DEFAULT_EMBLEM[theme.id] ?? null;
    const saveSettings = (settings: Settings) => {
      patch({ settings });
      if (uidRef.current) write.user(uidRef.current, { settings });
    };
    return {
      ...p,
      messages: visibleMessages(p, cloud),
      ready,
      account,
      cloud,
      theme,
      accent: p.settings.accent ?? theme.acc,
      emblem: items.find(e => e.id === sel) ?? null,
      history: historyOf(p, cloud),
      activity: activityIn(p, cloud),
      weighInsOrDemo: cloud ? p.weighIns : undefined,
      thinking,
      fuelBusy,
      fuelVerdict,
      allFoods: withCatalog(p.foods),
      recent: repeatable(p.meals, p.recentMeals),
      signIn,
      signUp,
      resetPassword,
      signOut: async () => {
        await signOut();
        setDemo(false);
      },
      setDemo,
      setOpt,
      pickTheme: id => saveSettings({ ...p.settings, theme: id, accent: null }),
      setEmblem: id => saveSettings({ ...p.settings, bgByTheme: { ...p.settings.bgByTheme, [p.settings.theme]: id } }),
      setProfileField: (k, v) => saveProfile({ ...ref.current.profile, [k]: v }, k === 'weight'),
      toggleDisc: k => {
        const disc = { ...p.disc, [k]: !p.disc[k] };
        patch({ disc });
        if (uidRef.current) write.user(uidRef.current, { disc });
      },
      send,
      voiceReply,
      appendMessages: pushMessages,
      logMeal,
      removeMeal: i => {
        setFuelVerdict('');
        saveMeals(ref.current.meals.filter((_, k) => k !== i));
      },
      logItems,
      repeatMeal: m => addMeal({ ...m, time: hhmm() }),
      updateMeal: (i, m) => {
        setFuelVerdict('');
        saveMeals(ref.current.meals.map((x, k) => (k === i ? m : x)));
      },
      saveFood,
      removeFood,
      toggleFav: f => {
        const mine = ref.current.foods.find(x => x.id === f.id);
        if (!mine) saveFood({ ...f, fav: true });
        // Un-starring a built-in food drops your copy; your own foods stay.
        else if (mine.fav && /^[di]:/.test(mine.id)) removeFood(mine.id);
        else saveFood({ ...mine, fav: !mine.fav });
      },
      findBarcode: async code => ref.current.foods.find(f => f.barcode === code) ?? lookupBarcode(code),
      finishSession,
      logCardio,
      logActivity: (m, minutes) => {
        const s = ref.current;
        const kcal = movementKcal(m.met, parseFloat(s.profile.weight) || 0, minutes);
        const log: SessionLog = { id: newId(), date: s.day, plan: 'ACTIVITY', title: m.name, done: 1, total: 1, seconds: Math.round(minutes * 60), activity: { id: m.id, name: m.name, minutes, kcal }, createdAt: Date.now() };
        patch({ sessionDone: true, loggedMin: s.loggedMin + Math.round(minutes), sessions: [...s.sessions, log] });
        pushMessages([msg('rei', `Logged: ${m.name.toLowerCase()}, ${Math.round(minutes)} min${kcal ? `, about ${kcal} kcal` : ''}. Moving counts. Don't eat it back.`)]);
        const u = uidRef.current;
        if (u) {
          write.day(u, s.day, { sessionDone: true, loggedMin: s.loggedMin + Math.round(minutes) });
          write.session(u, log);
        }
      },
      writeReport: async () => {
        // The plain report from what's on this device, used in demo mode or if REI can't be reached.
        const local = (): WeeklyReport => {
          const cur = ref.current, now = new Date(), today = isoDate(now);
          const days = Object.fromEntries([
            ...cur.pastDays.map(d => [d.date, { meals: d.meals ? [{ time: '', name: '', kcal: d.kcal, p: d.protein, c: 0, f: 0 }] : [], sessionDone: d.session }] as const),
            [today, { meals: cur.meals, sessionDone: cur.sessionDone }] as const,
          ]);
          const stats = weekStats({ week: isoWeek(now), monday: mondayOf(today), upTo: today, days, sessions: cur.sessions, weighIns: cur.weighIns, profile: cur.profile, program: cur.program });
          return { ...fallbackReport(stats), week: stats.week, stats, generatedAt: Date.now(), ai: false };
        };
        if (!uidRef.current) {
          const r = local();
          patch(cur => ({ reports: [r, ...cur.reports.filter(x => x.week !== r.week)] }));
          return r;
        }
        try {
          const res = await httpsCallable<void, WeeklyReport>(fb().functions, 'weeklyReport', { timeout: 120000 })();
          return res.data;
        } catch (e) {
          console.warn('REI: report failed, using the plain one', e);
          return local();
        }
      },
      remember: (text, kind = 'life') => {
        const { list } = addMemory(ref.current.memory, [{ text, kind }], 'you', Date.now(), newId);
        patch({ memory: list });
        if (uidRef.current) write.user(uidRef.current, { memory: list });
      },
      forget: id => {
        const { list } = forgetMemory(ref.current.memory, [id]);
        patch({ memory: list });
        if (uidRef.current) write.user(uidRef.current, { memory: list });
      },
      saveMeasurement: m => {
        patch(cur => ({ measurements: [...cur.measurements.filter(x => x.date !== m.date), m] }));
        if (uidRef.current) write.measurement(uidRef.current, m);
      },
      addPhoto: async (base64, uri, pose) => {
        const id = newId(), u = uidRef.current;
        const photo: ProgressPhoto = { id, date: isoDate(), pose, path: uri, createdAt: Date.now(), ...(parseFloat(ref.current.profile.weight) > 0 ? { kg: parseFloat(ref.current.profile.weight) } : {}) };
        // Shown right away from the local file; the synced copy replaces it.
        patch(cur => ({ photos: [...cur.photos, photo] }));
        if (!u) return;
        const path = `users/${u}/progress/${id}.jpg`;
        await uploadPhoto(path, base64);
        await write.photo(u, { ...photo, path });
      },
      removePhoto: photo => {
        patch(cur => ({ photos: cur.photos.filter(x => x.id !== photo.id) }));
        const u = uidRef.current;
        if (u) {
          write.deletePhoto(u, photo.id);
          deletePhotoFile(photo.path);
        }
      },
      logMealPhoto: async (image, note) => {
        if (!uidRef.current || fuelBusy) return;
        setFuelBusy(true);
        try {
          const res = await httpsCallable<{ image: string; note?: string }, { text: string; logged: boolean }>(fb().functions, 'mealFromPhoto', { timeout: 120000 })({ image, note });
          setFuelVerdict(res.data.text);
        } catch (e) {
          console.warn('REI: photo failed', e);
          setFuelVerdict('Couldn\u2019t read that photo. Describe the meal instead.');
        } finally {
          setFuelBusy(false);
        }
      },
      rebuildProgram: async focus => {
        const res = await httpsCallable<{ focus?: string }, { week: string; note: string }>(fb().functions, 'rebuildProgram', { timeout: 300000 })({ focus });
        return res.data.note;
      },
      clearChat: () => {
        const at = Date.now();
        if (uidRef.current) {
          patch({ chatClearedAt: at });
          write.user(uidRef.current, { chatClearedAt: at });
          pushMessages([msg('rei', 'Fresh page. Same goal. What do you need?', { createdAt: at + 1 })]);
        } else {
          patch({ messages: [msg('rei', 'Fresh page. Same goal. What do you need?')] });
        }
      },
      resetDay: () => {
        setFuelVerdict('');
        const u = uidRef.current;
        if (u) {
          patch({ meals: [], sessionDone: false, loggedMin: 0 });
          write.day(u, ref.current.day, { meals: [], sessionDone: false, loggedMin: 0 });
        } else {
          patch({ ...seedFor(ref.current.settings.scenario), sessionDone: false, loggedMin: 0, day: isoDate() });
        }
      },
    };
  }, [p, ready, account, cloud, thinking, fuelBusy, fuelVerdict, signIn, signUp, resetPassword, signOut, setDemo, setOpt, patch, saveProfile, send, voiceReply, pushMessages, logMeal, saveMeals, finishSession, msg, logItems, addMeal, saveFood, removeFood, logCardio]);

  // Subscribers read the new value during this render pass; those that didn't render (their
  // slice is unchanged, or they sit outside this subtree) are told after commit.
  // `value` holds callbacks that read refs; storing it doesn't read them.
  // eslint-disable-next-line react-hooks/refs
  source.set(value);
  useLayoutEffect(() => source.emit(), [source, value]);

  return (
    <Ctx.Provider value={source}>
      <LiveCtx.Provider value={live}>{children}</LiveCtx.Provider>
    </Ctx.Provider>
  );
}

export { firebaseEnabled };
