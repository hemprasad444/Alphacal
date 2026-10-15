// The game layer: XP, ranks and badges, all worked out from what's already logged (meals, sessions,
// weigh-ins), so nothing new has to be tracked and nothing can drift out of sync. Pure and tested.
import type { IconKey } from './icons';
import { badges, type Badge, type DaySummary } from './progress';
import { isoDate, isoWeek, parseIsoDate } from './time';
import type { Meal, Profile, SessionLog, WeighIn } from './types';

export interface GameInput {
  /** Today, yyyy-mm-dd, in the user's zone. */
  today: string;
  profile: Pick<Profile, 'kcal' | 'protein' | 'sessions'>;
  /** Today's meals (past days come from `pastDays`). */
  meals: Meal[];
  sessionDone: boolean;
  pastDays: DaySummary[];
  sessions: SessionLog[];
  weighIns: WeighIn[];
  photos: number;
  memory: number;
  /** When each progress photo was taken and each memory was added (YYYY-MM-DD), to date those badges. */
  photoDates?: string[];
  memoryDates?: string[];
}

export interface DayScore {
  date: string;
  xp: number;
  logged: boolean;
  proteinHit: boolean;
  perfect: boolean;
  sessions: number;
}

export interface Rank {
  id: string;
  name: string;
  /** XP needed to reach it. */
  min: number;
  line: string;
}

/** Eight ranks from first log to REI's own. Named for the path, not any one series. */
export const RANKS: Rank[] = [
  { id: 'rookie', name: 'Rookie', min: 0, line: 'Everyone starts at zero. Most stay there.' },
  { id: 'trainee', name: 'Trainee', min: 400, line: 'You came back. That already beats most people.' },
  { id: 'fighter', name: 'Fighter', min: 1200, line: 'Habits are forming. Protect them.' },
  { id: 'vanguard', name: 'Vanguard', min: 2500, line: 'You lead your own week now.' },
  { id: 'elite', name: 'Elite', min: 4500, line: 'Discipline shows on your body and in your log.' },
  { id: 'master', name: 'Master', min: 7500, line: 'Others ask how you do it. You just do it.' },
  { id: 'legend', name: 'Legend', min: 12000, line: 'Months of proof. Nothing is luck now.' },
  { id: 'zero', name: 'Zero', min: 18000, line: 'Zero excuses. You are what REI was built for.' },
];

export type BadgeTier = 'bronze' | 'silver' | 'gold';

/** A badge as the game screens show it: progress.ts's badges plus the ones below, each with a picture and a tier. */
export interface GameBadge extends Badge {
  icon: IconKey;
  tier: BadgeTier;
}

export interface Stats {
  sessions: number;
  runs5k: number;
  cardioKm: number;
  activeMinutes: number;
  /** Longest run of days with something logged, and the one running now. */
  bestStreak: number;
  streak: number;
  bestProteinStreak: number;
  proteinDays: number;
  perfectDays: number;
  meals: number;
  weighIns: number;
  photos: number;
  memory: number;
  early: boolean;
  late: boolean;
  /** Most sessions in any 7 days in a row. */
  bestWeek: number;
}

/** Badges beyond progress.ts's: rhythm, food and REI. `have` and `need` give the progress bar. */
const EXTRA: { id: string; title: string; desc: string; have: (s: Stats) => number; need: number }[] = [
  { id: 'first-bowl', title: 'First Bowl', desc: 'Log your first meal', have: s => s.meals, need: 1 },
  { id: 'hundred-bowls', title: 'Hundred Bowls', desc: 'Log 100 meals', have: s => s.meals, need: 100 },
  { id: 'protein-3', title: 'Meat on the Bone', desc: 'Hit protein 3 days in a row', have: s => s.bestProteinStreak, need: 3 },
  { id: 'perfect-bowl', title: 'Perfect Bowl', desc: 'Hit protein with calories within 10% of target', have: s => s.perfectDays, need: 1 },
  { id: 'five-in-seven', title: 'Five in Seven', desc: 'Train 5 times in 7 days', have: s => s.bestWeek, need: 5 },
  { id: 'long-road', title: 'The Long Road', desc: 'Cover 42 km running, walking or riding', have: s => s.cardioKm, need: 42 },
  { id: 'dawn-patrol', title: 'Dawn Patrol', desc: 'Train before 8 in the morning', have: s => +s.early, need: 1 },
  { id: 'night-shift', title: 'Night Shift', desc: 'Train after 9 at night', have: s => +s.late, need: 1 },
  { id: 'mirror-check', title: 'Mirror Check', desc: 'Weigh in 4 times', have: s => s.weighIns, need: 4 },
  { id: 'before-arc', title: 'The Before Arc', desc: 'Take your first progress photo', have: s => s.photos, need: 1 },
  { id: 'open-book', title: 'Open Book', desc: 'Let REI remember 10 things about you', have: s => s.memory, need: 10 },
];

/** Picture and tier for every badge id, progress.ts's included. */
const LOOK: Record<string, { icon: IconKey; tier: BadgeTier }> = {
  'sessions-1': { icon: 'train', tier: 'bronze' },
  'sessions-10': { icon: 'strength', tier: 'silver' },
  'sessions-50': { icon: 'rank', tier: 'gold' },
  'sessions-100': { icon: 'rank', tier: 'gold' },
  'pr-1': { icon: 'gym', tier: 'bronze' },
  'pr-10': { icon: 'gym', tier: 'gold' },
  'perfect-week': { icon: 'check', tier: 'silver' },
  'log-7': { icon: 'streak', tier: 'bronze' },
  'log-30': { icon: 'streak', tier: 'gold' },
  'protein-7': { icon: 'protein', tier: 'silver' },
  'run-5k': { icon: 'run', tier: 'bronze' },
  'run-10k': { icon: 'run', tier: 'silver' },
  'down-1': { icon: 'weight', tier: 'bronze' },
  'down-5': { icon: 'weight', tier: 'gold' },
  'first-bowl': { icon: 'fuel', tier: 'bronze' },
  'hundred-bowls': { icon: 'carbs', tier: 'gold' },
  'protein-3': { icon: 'protein', tier: 'bronze' },
  'perfect-bowl': { icon: 'kcal', tier: 'silver' },
  'five-in-seven': { icon: 'gym', tier: 'silver' },
  'long-road': { icon: 'steps', tier: 'silver' },
  'dawn-patrol': { icon: 'today', tier: 'bronze' },
  'night-shift': { icon: 'sleep', tier: 'bronze' },
  'mirror-check': { icon: 'weight', tier: 'bronze' },
  'before-arc': { icon: 'camera', tier: 'bronze' },
  'open-book': { icon: 'memory', tier: 'silver' },
};

const num = (s: string) => parseFloat(s) || 0;

/** XP for one exercise in a gym session: something for showing up to it, more for every set done. */
export const exerciseXp = (doneSets: number) => (doneSets > 0 ? 12 + 3 * doneSets : 0);

/** XP for one logged session: gym sessions by exercises and sets done, cardio and sports by size. */
export function sessionXp(s: SessionLog): number {
  if (s.cardio) return 30 + Math.min(40, Math.round(s.cardio.km * 6));
  if (s.activity) return 20 + Math.min(40, Math.round(s.activity.minutes / 2));
  if (s.sets?.length) return Math.min(150, Math.max(20, s.sets.reduce((a, x) => a + exerciseXp(x.done.filter(Boolean).length), 0)));
  const share = s.total > 0 ? Math.min(1, s.done / s.total) : 1;
  return Math.max(20, Math.round(60 * share));
}

function addDays(iso: string, n: number): string {
  const d = parseIsoDate(iso) ?? new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Every day from the earliest record to today, scored. Oldest first. */
export function scoreDays(x: GameInput): DayScore[] {
  const kcalT = num(x.profile.kcal), protT = num(x.profile.protein);
  const days = new Map<string, DaySummary>();
  for (const d of x.pastDays) if (d.date < x.today) days.set(d.date, d);
  days.set(x.today, {
    date: x.today,
    meals: x.meals.length,
    kcal: Math.round(x.meals.reduce((a, m) => a + m.kcal, 0)),
    protein: Math.round(x.meals.reduce((a, m) => a + m.p, 0)),
    session: x.sessionDone,
  });
  const byDate = new Map<string, SessionLog[]>();
  for (const s of x.sessions) if (s.date <= x.today) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const weighed = new Set(x.weighIns.map(w => w.date));

  const dates = [...days.keys(), ...byDate.keys(), ...weighed].filter(d => d <= x.today).sort();
  if (!dates.length) return [];
  const out: DayScore[] = [];
  let streak = 0;
  for (let d = dates[0]; d <= x.today; d = addDays(d, 1)) {
    const day = days.get(d);
    const sessions = byDate.get(d) ?? [];
    const meals = day?.meals ?? 0;
    const trained = sessions.length > 0 || !!day?.session;
    const logged = meals > 0 || trained || weighed.has(d);
    const proteinHit = protT > 0 && (day?.protein ?? 0) >= protT;
    const perfect = proteinHit && meals >= 2 && kcalT > 0 && Math.abs((day?.kcal ?? 0) - kcalT) <= kcalT * 0.1;
    streak = logged ? streak + 1 : d === x.today ? streak : 0;
    let xp = 0;
    if (logged) xp += 10 + 2 * Math.min(streak, 30);
    if (meals >= 2) xp += 10;
    if (proteinHit) xp += 25;
    if (perfect) xp += 15;
    xp += Math.min(150, sessions.reduce((a, s) => a + sessionXp(s), 0) || (day?.session ? 40 : 0));
    if (weighed.has(d)) xp += 5;
    out.push({ date: d, xp, logged, proteinHit, perfect, sessions: sessions.length || (day?.session ? 1 : 0) });
  }
  return out;
}

export function stats(x: GameInput, days = scoreDays(x)): Stats {
  let best = 0, run = 0, bestP = 0, runP = 0;
  for (const d of days) {
    run = d.logged ? run + 1 : 0;
    best = Math.max(best, run);
    runP = d.proteinHit ? runP + 1 : 0;
    bestP = Math.max(bestP, runP);
  }
  // Today not logged yet doesn't break the streak until the day is over.
  const last = days[days.length - 1];
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].logged) streak++;
    else if (!(i === days.length - 1 && last?.date === x.today)) break;
  }
  const done = x.sessions.filter(s => s.date <= x.today);
  const hour = (s: SessionLog) => (s.createdAt ? new Date(s.createdAt).getHours() : 12);
  let bestWeek = 0;
  for (let i = 0; i < days.length; i++) bestWeek = Math.max(bestWeek, days.slice(i, i + 7).reduce((a, d) => a + Math.min(1, d.sessions), 0));
  return {
    sessions: Math.max(done.length, days.filter(d => d.sessions > 0).length),
    runs5k: done.filter(s => s.cardio?.kind !== 'walk' && s.cardio?.kind !== 'cycle' && (s.cardio?.km ?? 0) >= 5).length,
    cardioKm: Math.round(done.reduce((a, s) => a + (s.cardio?.km ?? 0), 0) * 10) / 10,
    activeMinutes: Math.round(done.reduce((a, s) => a + (s.activity?.minutes ?? (s.cardio ? s.cardio.seconds / 60 : s.seconds / 60)), 0)),
    bestStreak: best,
    streak,
    bestProteinStreak: bestP,
    proteinDays: days.filter(d => d.proteinHit).length,
    perfectDays: days.filter(d => d.perfect).length,
    meals: x.pastDays.filter(d => d.date < x.today).reduce((a, d) => a + d.meals, 0) + x.meals.length,
    weighIns: x.weighIns.length,
    photos: x.photos,
    memory: x.memory,
    early: done.some(s => hour(s) < 8),
    late: done.some(s => hour(s) >= 21),
    bestWeek,
  };
}

export interface GameState {
  xp: number;
  /** XP since Monday, for the weekly leaderboard. */
  weekXp: number;
  today: number;
  rank: Rank;
  next: Rank | null;
  /** 0..1 of the way to the next rank. */
  progress: number;
  stats: Stats;
  earned: GameBadge[];
  locked: GameBadge[];
  days: DayScore[];
}

export function rankFor(xp: number): { rank: Rank; next: Rank | null; progress: number } {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].min) i++;
  const rank = RANKS[i], next = RANKS[i + 1] ?? null;
  return { rank, next, progress: next ? (xp - rank.min) / (next.min - rank.min) : 1 };
}

/** Everything the game screens show. `seen` keeps badges once earned, even after old days roll out of history. */
export function game(x: GameInput, seen: string[] = []): GameState {
  const days = scoreDays(x);
  const s = stats(x, days);
  const xp = days.reduce((a, d) => a + d.xp, 0);
  const week = isoWeek(parseIsoDate(x.today) ?? new Date());
  const weekXp = days.filter(d => isoWeek(parseIsoDate(d.date) ?? new Date()) === week).reduce((a, d) => a + d.xp, 0);
  const all = allBadges(x, s);
  const keep = new Set(seen);
  const earned = all.filter(b => b.earned || keep.has(b.id)).map(b => (b.earned ? b : { ...b, earned: x.today, progress: 1 }));
  return {
    xp,
    weekXp,
    today: days.find(d => d.date === x.today)?.xp ?? 0,
    ...rankFor(xp),
    stats: s,
    earned: earned.sort((a, b) => ((a.earned ?? '') < (b.earned ?? '') ? 1 : -1)),
    locked: all.filter(b => !b.earned && !keep.has(b.id)).sort((a, b) => b.progress - a.progress),
    days,
  };
}

/** The nth date in a list, sorted (when the nth photo or memory came in). */
const nth = (dates: string[] | undefined, n: number) => (dates && dates.length >= n ? [...dates].sort()[n - 1] : null);

/** Everything as it stood at the end of `d`: the day after, empty, so day `d` counts in full. */
function asOf(x: GameInput, d: string): GameInput {
  const next = isoDate(new Date((parseIsoDate(d) ?? new Date()).getTime() + 36 * 3600000));
  return {
    ...x, today: next, meals: [], sessionDone: false,
    pastDays: x.pastDays.filter(p => p.date <= d), sessions: x.sessions.filter(l => l.date <= d), weighIns: x.weighIns.filter(w => w.date <= d),
  };
}

/** The first day an extra badge's count reached its target (today when it can't be told). */
function earnedOn(e: (typeof EXTRA)[number], x: GameInput): string {
  if (e.id === 'open-book') return nth(x.memoryDates, e.need) ?? x.today;
  if (e.id === 'before-arc') return nth(x.photoDates, e.need) ?? x.today;
  const dates = [...new Set([...x.pastDays.map(p => p.date), ...x.sessions.map(l => l.date), ...x.weighIns.map(w => w.date)])].filter(d => d < x.today).sort();
  // Counts only grow with time, so the first day it was reached can be found by halving.
  let lo = 0, hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (e.have(stats(asOf(x, dates[mid]))) >= e.need) hi = mid;
    else lo = mid + 1;
  }
  return dates[lo] ?? x.today;
}

/** progress.ts's badges and the extra ones, each with its picture and tier. */
export function allBadges(x: GameInput, s = stats(x)): GameBadge[] {
  const days = [...x.pastDays.filter(d => d.date < x.today), { date: x.today, meals: x.meals.length, kcal: x.meals.reduce((a, m) => a + m.kcal, 0), protein: x.meals.reduce((a, m) => a + m.p, 0), session: x.sessionDone }];
  const base = badges({ days, sessions: x.sessions, weighIns: x.weighIns, profile: { ...x.profile } as Profile });
  const extra: Badge[] = EXTRA.map(e => {
    const have = e.have(s);
    return { id: e.id, title: e.title, desc: e.desc, earned: have >= e.need ? earnedOn(e, x) : null, progress: Math.min(1, have / e.need) };
  });
  return [...base, ...extra].map(b => ({ ...b, ...(LOOK[b.id] ?? { icon: 'badge' as IconKey, tier: 'bronze' as BadgeTier }) }));
}

/** Badges earned that the user hasn't been shown yet, for the unlock animation. */
export function newBadges(g: GameState, seen: string[]): GameBadge[] {
  const s = new Set(seen);
  return g.earned.filter(b => !s.has(b.id));
}
