// Strength numbers from logged sessions: estimated one-rep max, personal records, history.
import type { SessionLog, SetLog } from './types';

/** Epley estimate of a one-rep max; null for bodyweight or sets above 12 reps (too noisy). */
export function e1rm(kg: number | null, reps: number): number | null {
  if (kg == null || !(kg > 0) || !(reps >= 1) || reps > 12) return null;
  return reps === 1 ? kg : Math.round(kg * (1 + reps / 30) * 10) / 10;
}

export interface BestSet {
  kg: number | null;
  reps: number;
  e1rm: number | null;
  date: string;
}

const keys = new Map<string, string>();
export const liftKey = (name: string): string => {
  let k = keys.get(name);
  if (k === undefined) keys.set(name, (k = name.trim().toLowerCase()));
  return k;
};

function doneSets(x: SetLog): { kg: number | null; reps: number }[] {
  return x.reps.map((reps, i) => ({ kg: x.kg[i] ?? null, reps })).filter((s, i) => x.done[i] && s.reps > 0);
}

// Best and heaviest set of one exercise in one session, worked out once per set list:
// history screens and PR checks ask for them again and again.
const summaries = new WeakMap<SetLog, { date: string; best: BestSet | null; heaviest: BestSet | null }>();
function summary(x: SetLog, date: string) {
  const hit = summaries.get(x);
  if (hit && hit.date === date) return hit;
  let best: BestSet | null = null, heaviest: BestSet | null = null;
  for (let i = 0; i < x.reps.length; i++) {
    const reps = x.reps[i], kg = x.kg[i] ?? null;
    if (!x.done[i] || !(reps > 0)) continue;
    const e = e1rm(kg, reps);
    // Best: highest estimated max, or most reps when bodyweight.
    if (!best || (e != null && (best.e1rm == null || e > best.e1rm)) || (e == null && best.e1rm == null && reps > best.reps)) best = { kg, reps, e1rm: e, date };
    if (kg != null && kg > 0 && (!heaviest || kg > heaviest.kg! || (kg === heaviest.kg && reps > heaviest.reps))) heaviest = { kg, reps, e1rm: e, date };
  }
  const out = { date, best, heaviest };
  summaries.set(x, out);
  return out;
}

const bestOf = (x: SetLog, date: string) => summary(x, date).best;
const heaviestOf = (x: SetLog, date: string) => summary(x, date).heaviest;

export interface LiftRecord {
  name: string;
  best: BestSet;
  heaviest: BestSet | null;
  sessions: number;
  lastDate: string;
}

const strengthLogs = (logs: SessionLog[]) => logs.filter(l => !l.cardio && l.plan !== 'RUN').sort((a, b) => (a.date === b.date ? (a.createdAt ?? 0) - (b.createdAt ?? 0) : a.date < b.date ? -1 : 1));

/** Add one session's sets to a running records map. */
function fold(out: Record<string, LiftRecord>, l: SessionLog): void {
  for (const x of l.sets ?? []) {
    const b = bestOf(x, l.date);
    if (!b) continue;
    const k = liftKey(x.exercise), h = heaviestOf(x, l.date), cur = out[k];
    if (!cur) {
      out[k] = { name: x.exercise, best: b, heaviest: h, sessions: 1, lastDate: l.date };
      continue;
    }
    cur.sessions++;
    cur.lastDate = l.date;
    if (b.e1rm != null ? cur.best.e1rm == null || b.e1rm > cur.best.e1rm : cur.best.e1rm == null && b.reps > cur.best.reps) cur.best = b;
    if (h && (!cur.heaviest || h.kg! > cur.heaviest.kg!)) cur.heaviest = h;
  }
}

/** Personal records per lift, keyed by lowercased name. */
export function records(logs: SessionLog[]): Record<string, LiftRecord> {
  const out: Record<string, LiftRecord> = {};
  for (const l of strengthLogs(logs)) fold(out, l);
  return out;
}

export interface LiftPoint {
  date: string;
  kg: number | null;
  reps: number;
  e1rm: number | null;
  /** kg × reps over the done sets. */
  volume: number;
  sets: string;
}

/** One point per session for a lift, oldest first. */
export function liftHistory(logs: SessionLog[], name: string): LiftPoint[] {
  const k = liftKey(name);
  const out: LiftPoint[] = [];
  for (const l of strengthLogs(logs)) {
    for (const x of l.sets ?? []) {
      if (liftKey(x.exercise) !== k) continue;
      const b = bestOf(x, l.date);
      if (!b) continue;
      const done = doneSets(x);
      out.push({ ...b, volume: Math.round(done.reduce((a, s) => a + (s.kg ?? 0) * s.reps, 0)), sets: done.map(s => (s.kg != null ? `${s.kg}×${s.reps}` : `${s.reps}`)).join(' ') });
    }
  }
  return out;
}

export interface Pr {
  exercise: string;
  kind: 'e1rm' | 'weight' | 'reps';
  text: string;
}

const kgText = (kg: number) => `${+kg.toFixed(1)}`;

/** Records a session beat, judged against the records so far. */
function prsAgainst(session: SessionLog, prior: Record<string, LiftRecord>): Pr[] {
  if (session.cardio || session.plan === 'RUN') return [];
  const out: Pr[] = [];
  for (const x of session.sets ?? []) {
    const p = prior[liftKey(x.exercise)];
    const b = bestOf(x, session.date), h = heaviestOf(x, session.date);
    if (!p || !b) continue;
    if (b.e1rm != null && p.best.e1rm != null && b.e1rm > p.best.e1rm) {
      out.push({ exercise: x.exercise, kind: 'e1rm', text: `${x.exercise} ${kgText(b.kg!)} × ${b.reps}, est. max ${kgText(b.e1rm)} kg, up ${kgText(b.e1rm - p.best.e1rm)}` });
    } else if (h && p.heaviest && h.kg! > p.heaviest.kg!) {
      out.push({ exercise: x.exercise, kind: 'weight', text: `${x.exercise} heaviest yet: ${kgText(h.kg!)} kg` });
    } else if (b.e1rm == null && p.best.e1rm == null && b.kg == null && b.reps > p.best.reps) {
      out.push({ exercise: x.exercise, kind: 'reps', text: `${x.exercise} ${b.reps} reps (was ${p.best.reps})` });
    }
  }
  return out;
}

/** Records this session beat. A lift's first ever session sets the baseline, not a record. */
export function newPrs(session: SessionLog, before: SessionLog[]): Pr[] {
  return prsAgainst(session, records(before));
}

/** Oldest first: by date, then by when it was logged. */
export const sessionOrder = (a: SessionLog, b: SessionLog) => (a.date === b.date ? (a.createdAt ?? 0) - (b.createdAt ?? 0) : a.date < b.date ? -1 : 1);

/**
 * Every session's PRs in one pass over history (O(total sets)), instead of rechecking
 * all earlier sessions for each one. Keyed by the session object.
 */
export function prTimeline(sessions: SessionLog[]): Map<SessionLog, Pr[]> {
  const out = new Map<SessionLog, Pr[]>();
  const running: Record<string, LiftRecord> = {};
  for (const s of [...sessions].sort(sessionOrder)) {
    out.set(s, prsAgainst(s, running));
    if (!s.cardio && s.plan !== 'RUN') fold(running, s);
  }
  return out;
}

export function sessionVolume(s: SessionLog): number {
  return Math.round((s.sets ?? []).reduce((a, x) => a + doneSets(x).reduce((b, d) => b + (d.kg ?? 0) * d.reps, 0), 0));
}

/** "5:32 / km". */
export function pace(km: number, seconds: number): string {
  if (!(km > 0) || !(seconds > 0)) return '';
  const s = Math.round(seconds / km);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} / km`;
}

/** "42:10" or "1:05:30". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** "45:20" or "1:05:30" → seconds; null if unreadable. */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(':').map(p => (/^\d+$/.test(p) ? +p : NaN));
  if (!parts.length || parts.some(Number.isNaN) || parts.length > 3) return null;
  const s = parts.reduce((a, p) => a * 60 + p, 0);
  return s > 0 ? s : null;
}

/** Rest between sets: longer for heavy, low-rep work. */
export function restSeconds(reps: number, kg: number | null): number {
  if (kg == null) return reps <= 8 ? 90 : 60;
  return reps <= 5 ? 180 : reps <= 8 ? 150 : reps <= 12 ? 90 : 60;
}
