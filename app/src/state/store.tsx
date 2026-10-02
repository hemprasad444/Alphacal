import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  type Activity, activityFor, activityFromDay, applyUpdate, DEFAULT_DISCIPLINES, DEFAULT_PROFILE, DEFAULT_SETTINGS, fuelLine, type History, hhmm,
  isoDate, longDate, type Meal, mealNote, type Message, nutrition as calcNutrition, offlineReply, parseReply, type Profile, type ProfileKey,
  type ReiContext, seedFor, SESSION_TIME, sessionSummary, type Settings, systemPrompt, todaysPlan, toMeal, toTurns, type WeighIn, week as calcWeek,
  weekdayIndex, weekLine,
} from '@rei/shared';
import { askClaude } from '../lib/claude';
import { firebaseEnabled } from '../lib/firebase';
import { newId, onDays, onMessages, onUser, onWeighIns, write } from '../lib/sync';
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
}

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
  };
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

interface Store extends Persisted {
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
  voiceReply: (turns: Message[]) => Promise<{ text: string; note: string | null }>;
  appendMessages: (ms: Message[]) => void;
  logMeal: (text: string) => Promise<void>;
  removeMeal: (i: number) => void;
  finishSession: (done: number, total: number, seconds: number) => void;
  clearChat: () => void;
  resetDay: () => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
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
  const ref = useRef(p);
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
    AsyncStorage.getItem(storageKey)
      .then(raw => {
        if (!live) return;
        const base = fresh(DEFAULT_SETTINGS, !uid);
        if (!raw) {
          setP(base);
          return;
        }
        const saved = JSON.parse(raw) as Partial<Persisted>;
        const next: Persisted = { ...base, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings }, profile: { ...DEFAULT_PROFILE, ...saved.profile } };
        if (next.day !== isoDate()) Object.assign(next, { day: isoDate(), meals: [], sessionDone: false, loggedMin: 0, activity: null });
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
    const t = setTimeout(() => {
      AsyncStorage.setItem(storageKey, JSON.stringify(ref.current)).catch(e => console.warn('REI: could not save state', e));
    }, 300);
    return () => clearTimeout(t);
  }, [p, ready, storageKey]);

  // A new day on-device: empty food log, no session.
  useEffect(() => {
    if (!ready || ref.current.day === today) return;
    patch({ day: today, meals: [], sessionDone: false, loggedMin: 0, activity: null });
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
        patch(cur => ({
          ...(doc.profile && !dirtyProfile.current ? { profile: { ...DEFAULT_PROFILE, ...doc.profile } } : {}),
          ...(doc.settings ? { settings: { ...DEFAULT_SETTINGS, ...doc.settings } } : {}),
          ...(doc.disc ? { disc: doc.disc } : {}),
          startedOn: doc.startedOn ?? cur.startedOn,
          chatClearedAt: doc.chatClearedAt ?? 0,
        }));
      }),
      onDays(uid, mondayIso(), days => {
        const t = days[today];
        const weekSessions = Object.fromEntries(Object.entries(days).filter(([d]) => d < today).map(([d, v]) => [d, !!v.sessionDone]));
        patch({
          weekSessions,
          day: today,
          meals: t?.meals ?? [],
          sessionDone: !!t?.sessionDone,
          loggedMin: t?.loggedMin ?? 0,
          activity: activityFromDay(t?.steps, t?.sleepMin),
        });
      }),
      onMessages(uid, messages => patch({ messages })),
      onWeighIns(uid, daysAgoIso(120), weighIns => patch({ weighIns })),
    ];
    return () => unsubs.forEach(u => u());
  }, [uid, loadedKey, today, patch, pushMessages, msg]);

  const history = useCallback((s: Persisted) => historyOf(s, !!uidRef.current), []);
  const activityOf = useCallback((s: Persisted, sessionDone = s.sessionDone) => activityIn(s, !!uidRef.current, sessionDone), []);

  /** Snapshot of what REI knows right now, built from the latest state. */
  const context = useCallback((s: Persisted): ReiContext => {
    const plan = todaysPlan();
    return {
      profile: s.profile,
      nutrition: calcNutrition(s.meals, activityOf(s)),
      meals: s.meals,
      tough: s.settings.tone === 'Tough love',
      nudge: s.settings.nudge,
      sessionDone: s.sessionDone,
      todayLine: plan ? `${plan.title} session at ${SESSION_TIME}` : 'Rest day',
      weekLine: weekLine(calcWeek(history(s), s.sessionDone)),
      disciplines: Object.keys(s.disc).filter(k => s.disc[k]),
      now: hhmm(),
      today: longDate(),
    };
  }, [history, activityOf]);

  /** Ask Claude, falling back to the offline reply. `chat` ends with the user's message. */
  const complete = useCallback(async (chat: Message[], s: Persisted) => {
    const x = context(s);
    const raw = await askClaude(systemPrompt(x), toTurns(chat));
    const lastUser = chat[chat.length - 1]?.text ?? '';
    if (raw === null) return { ...parseReply(offlineReply(lastUser, x)), offline: true };
    return { ...parseReply(raw), offline: false };
  }, [context]);

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

  const send = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || thinking) return;
    const s = ref.current;
    const userMsg = msg('user', text);
    const chat = [...visibleMessages(s, cloud), userMsg];
    pushMessages([userMsg]);
    setThinking(true);
    try {
      const r = await complete(chat, s);
      const cur = ref.current;
      const notes: Message[] = [];
      const upd = applyUpdate(cur.profile, r.upd);
      if (upd) notes.push(msg('sys', upd.note));
      let meal: Meal | null = null;
      if (r.meal || (r.offline && /^just ate/i.test(text))) {
        meal = toMeal(r.meal, text.replace(/^just ate:?\s*/i, ''), hhmm());
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
  }, [thinking, cloud, msg, pushMessages, complete, activityOf, saveProfile, saveMeals]);

  const voiceReply = useCallback(async (turns: Message[]) => {
    const s = ref.current;
    const r = await complete([...visibleMessages(s, cloud), ...turns], s);
    const cur = ref.current;
    const upd = applyUpdate(cur.profile, r.upd);
    const lastUser = turns[turns.length - 1]?.text ?? '';
    const meal = r.meal ? toMeal(r.meal, lastUser, hhmm()) : null;
    if (upd) saveProfile(upd.profile, upd.profile.weight !== cur.profile.weight);
    if (meal) saveMeals([...cur.meals, meal]);
    return { text: r.text, note: upd?.note ?? (meal ? mealNote(meal) : null) };
  }, [cloud, complete, saveProfile, saveMeals]);

  const logMeal = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || fuelBusy) return;
    setFuelBusy(true);
    try {
      const s = ref.current;
      const userMsg = msg('user', 'Just ate: ' + text);
      const r = await complete([...visibleMessages(s, cloud), userMsg], s);
      const cur = ref.current;
      const meal = toMeal(r.meal, text, hhmm());
      const meals = [...cur.meals, meal];
      const reply = r.offline ? fuelLine(cur.profile, calcNutrition(meals, activityOf(cur))) : r.text;
      setFuelVerdict(reply);
      saveMeals(meals);
      pushMessages([userMsg, msg('rei', reply), msg('sys', mealNote(meal))]);
    } finally {
      setFuelBusy(false);
    }
  }, [fuelBusy, cloud, msg, complete, activityOf, saveMeals, pushMessages]);

  const finishSession = useCallback((done: number, total: number, seconds: number) => {
    const s = ref.current;
    const min = Math.max(1, Math.round(seconds / 60));
    const nu = calcNutrition(s.meals, activityOf(s, true));
    const left = Math.max(0, (parseFloat(s.profile.protein) || 0) - nu.protein);
    const missed = calcWeek(history(s), false).missed;
    const plan = todaysPlan();
    const sum = sessionSummary(done, total, min, left, plan?.title ?? 'Session', missed);
    patch({ sessionDone: true, loggedMin: min });
    pushMessages([msg('rei', sum.text, { alert: sum.alert })]);
    const u = uidRef.current;
    if (u) {
      write.day(u, s.day, { sessionDone: true, loggedMin: min });
      write.session(u, { date: s.day, plan: plan?.key ?? 'PUSH', done, total, seconds });
    }
  }, [patch, msg, pushMessages, activityOf, history]);

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
      finishSession,
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
  }, [p, ready, account, cloud, thinking, fuelBusy, fuelVerdict, signIn, signUp, resetPassword, signOut, setDemo, setOpt, patch, saveProfile, send, voiceReply, pushMessages, logMeal, saveMeals, finishSession, msg]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { firebaseEnabled };
