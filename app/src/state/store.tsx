import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { askClaude } from '../lib/claude';
import { DEFAULT_DISCIPLINES, DEFAULT_PROFILE, DEFAULT_SETTINGS, SESSION_TIME, seedFor } from '../lib/data';
import { nutrition as calcNutrition, sessionSummary, todaysPlan, week as calcWeek, weekLine } from '../lib/derive';
import { applyUpdate, fuelLine, mealNote, offlineReply, parseReply, systemPrompt, toMeal, toTurns, type ReiContext } from '../lib/rei';
import { DEFAULT_EMBLEM, EMBLEMS, THEMES, type Emblem, type Theme } from '../lib/theme';
import { hhmm, isoDate, longDate } from '../lib/time';
import type { Meal, Message, Profile, ProfileKey, Settings } from '../lib/types';

const STORAGE_KEY = 'rei-state-v1';

interface Persisted {
  settings: Settings;
  profile: Profile;
  disc: Record<string, boolean>;
  meals: Meal[];
  messages: Message[];
  sessionDone: boolean;
  loggedMin: number;
  startedOn: string;
  day: string;
}

function fresh(settings: Settings = DEFAULT_SETTINGS): Persisted {
  const seed = seedFor(settings.scenario);
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
  };
}

interface Store extends Persisted {
  ready: boolean;
  theme: Theme;
  accent: string;
  emblem: Emblem | null;
  thinking: boolean;
  fuelBusy: boolean;
  fuelVerdict: string;
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
  const [p, setP] = useState<Persisted>(() => fresh());
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [fuelBusy, setFuelBusy] = useState(false);
  const [fuelVerdict, setFuelVerdict] = useState('');
  const ref = useRef(p);
  useEffect(() => {
    ref.current = p;
  }, [p]);

  // Load once; a new calendar day starts with an empty food log and no session.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Persisted>;
        const base = fresh({ ...DEFAULT_SETTINGS, ...saved.settings });
        const next: Persisted = { ...base, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings }, profile: { ...DEFAULT_PROFILE, ...saved.profile } };
        if (next.day !== isoDate()) Object.assign(next, { day: isoDate(), meals: [], sessionDone: false, loggedMin: 0 });
        setP(next);
      })
      .catch(e => console.warn('REI: could not load saved state', e))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p)).catch(e => console.warn('REI: could not save state', e));
    }, 300);
    return () => clearTimeout(t);
  }, [p, ready]);

  const patch = useCallback((x: Partial<Persisted> | ((s: Persisted) => Partial<Persisted>)) => {
    setP(s => ({ ...s, ...(typeof x === 'function' ? x(s) : x) }));
  }, []);

  /** Snapshot of what REI knows right now, built from the latest state. */
  const context = useCallback((s: Persisted): ReiContext => {
    const nu = calcNutrition(s.meals, s.settings.scenario, s.sessionDone);
    const plan = todaysPlan();
    return {
      profile: s.profile,
      nutrition: nu,
      meals: s.meals,
      tough: s.settings.tone === 'Tough love',
      nudge: s.settings.nudge,
      sessionDone: s.sessionDone,
      todayLine: plan ? `${plan.title} session at ${SESSION_TIME}` : 'Rest day',
      weekLine: weekLine(calcWeek(s.settings.scenario, s.sessionDone)),
      disciplines: Object.keys(s.disc).filter(k => s.disc[k]),
      now: hhmm(),
      today: longDate(),
    };
  }, []);

  /** Ask Claude, falling back to the offline reply. `history` ends with the user's message. */
  const complete = useCallback(async (history: Message[], s: Persisted) => {
    const x = context(s);
    const raw = await askClaude(systemPrompt(x), toTurns(history));
    const lastUser = history[history.length - 1]?.text ?? '';
    if (raw === null) return { ...parseReply(offlineReply(lastUser, x)), offline: true };
    return { ...parseReply(raw), offline: false };
  }, [context]);

  const send = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || thinking) return;
    const userMsg: Message = { role: 'user', text, time: hhmm() };
    const s = ref.current;
    const history = [...s.messages, userMsg];
    patch({ messages: history });
    setThinking(true);
    try {
      const r = await complete(history, s);
      const notes: Message[] = [];
      const upd = applyUpdate(ref.current.profile, r.upd);
      if (upd) notes.push({ role: 'sys', text: upd.note, time: hhmm() });
      let meal: Meal | null = null;
      if (r.meal || (r.offline && /^just ate/i.test(text))) {
        meal = toMeal(r.meal, text.replace(/^just ate:?\s*/i, ''), hhmm());
        notes.push({ role: 'sys', text: mealNote(meal), time: hhmm() });
      }
      // Offline answers about food should reflect the meal just logged.
      if (meal && r.offline) {
        const cur = ref.current;
        r.text = fuelLine(cur.profile, calcNutrition([...cur.meals, meal], cur.settings.scenario, cur.sessionDone));
      }
      const strong = ref.current.settings.scenario === 'Strong week';
      const rei: Message = { role: 'rei', text: r.text, time: hhmm(), alert: !strong && /miss|excuse|negotiat|skip|again|stop/i.test(r.text) };
      patch(cur => ({
        messages: [...cur.messages, rei, ...notes],
        ...(upd ? { profile: upd.profile } : {}),
        ...(meal ? { meals: [...cur.meals, meal] } : {}),
      }));
    } finally {
      setThinking(false);
    }
  }, [thinking, patch, complete]);

  const voiceReply = useCallback(async (turns: Message[]) => {
    const s = ref.current;
    const r = await complete([...s.messages, ...turns], s);
    const upd = applyUpdate(s.profile, r.upd);
    const lastUser = turns[turns.length - 1]?.text ?? '';
    const meal = r.meal ? toMeal(r.meal, lastUser, hhmm()) : null;
    patch(cur => ({ ...(upd ? { profile: upd.profile } : {}), ...(meal ? { meals: [...cur.meals, meal] } : {}) }));
    return { text: r.text, note: upd?.note ?? (meal ? mealNote(meal) : null) };
  }, [complete, patch]);

  const logMeal = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || fuelBusy) return;
    setFuelBusy(true);
    try {
      const s = ref.current;
      const userMsg: Message = { role: 'user', text: 'Just ate: ' + text, time: hhmm() };
      const r = await complete([...s.messages, userMsg], s);
      const meal = toMeal(r.meal, text, hhmm());
      const meals = [...ref.current.meals, meal];
      const reply = r.offline ? fuelLine(ref.current.profile, calcNutrition(meals, ref.current.settings.scenario, ref.current.sessionDone)) : r.text;
      setFuelVerdict(reply);
      patch(cur => ({
        meals: [...cur.meals, meal],
        messages: [...cur.messages, userMsg, { role: 'rei', text: reply, time: hhmm() }, { role: 'sys', text: mealNote(meal), time: hhmm() }],
      }));
    } finally {
      setFuelBusy(false);
    }
  }, [fuelBusy, complete, patch]);

  const finishSession = useCallback((done: number, total: number, seconds: number) => {
    const s = ref.current;
    const min = Math.max(1, Math.round(seconds / 60));
    const nu = calcNutrition(s.meals, s.settings.scenario, true);
    const left = Math.max(0, (parseFloat(s.profile.protein) || 0) - nu.protein);
    const missed = calcWeek(s.settings.scenario, false).missed;
    const plan = todaysPlan();
    const sum = sessionSummary(done, total, min, left, plan?.title ?? 'Session', missed);
    patch(cur => ({ sessionDone: true, loggedMin: min, messages: [...cur.messages, { role: 'rei', text: sum.text, time: hhmm(), alert: sum.alert }] }));
  }, [patch]);

  const setOpt = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => {
    patch(cur => {
      const settings = { ...cur.settings, [k]: v };
      // Switching the demo scenario replays that story from the start of the day.
      if (k === 'scenario' && v !== cur.settings.scenario) {
        setFuelVerdict('');
        return { settings, ...seedFor(v as Settings['scenario']), sessionDone: false, loggedMin: 0 };
      }
      return { settings };
    });
  }, [patch]);

  const value = useMemo<Store>(() => {
    const theme = THEMES.find(t => t.id === p.settings.theme) ?? THEMES[0];
    const items = EMBLEMS[theme.id] ?? [];
    const sel = theme.id in p.settings.bgByTheme ? p.settings.bgByTheme[theme.id] : DEFAULT_EMBLEM[theme.id] ?? null;
    return {
      ...p,
      ready,
      theme,
      accent: p.settings.accent ?? theme.acc,
      emblem: items.find(e => e.id === sel) ?? null,
      thinking,
      fuelBusy,
      fuelVerdict,
      setOpt,
      pickTheme: id => patch(cur => ({ settings: { ...cur.settings, theme: id, accent: null } })),
      setEmblem: id => patch(cur => ({ settings: { ...cur.settings, bgByTheme: { ...cur.settings.bgByTheme, [cur.settings.theme]: id } } })),
      setProfileField: (k, v) => patch(cur => ({ profile: { ...cur.profile, [k]: v } })),
      toggleDisc: k => patch(cur => ({ disc: { ...cur.disc, [k]: !cur.disc[k] } })),
      send,
      voiceReply,
      appendMessages: ms => patch(cur => ({ messages: [...cur.messages, ...ms] })),
      logMeal,
      removeMeal: i => {
        setFuelVerdict('');
        patch(cur => ({ meals: cur.meals.filter((_, k) => k !== i) }));
      },
      finishSession,
      clearChat: () => patch({ messages: [{ role: 'rei', text: 'Fresh page. Same goal. What do you need?', time: hhmm() }] }),
      resetDay: () => {
        setFuelVerdict('');
        patch(cur => ({ ...seedFor(cur.settings.scenario), sessionDone: false, loggedMin: 0, day: isoDate() }));
      },
    };
  }, [p, ready, thinking, fuelBusy, fuelVerdict, setOpt, patch, send, voiceReply, logMeal, finishSession]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
