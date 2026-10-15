// Strength and running benchmarks for the Vow: where you started (onboarding's "power level"),
// your best logged so far, and a goal set from your start. A logged chest press or bench moves
// the bench line; a 5 km+ run moves the 5K line.
import type { IconKey } from './icons';
import { gaveBest, type Intake } from './onboarding';
import { e1rm } from './strength';
import type { SessionLog } from './types';

/** Starting bests; null where they skipped it in onboarding. */
export interface Bests {
  bench: number | null;
  squat: number | null;
  dead: number | null;
  pullups: number | null;
  /** 5K time in seconds. */
  run5k: number | null;
}

/** Starting numbers when nothing better is known (the demo's). */
export const DEFAULT_BESTS: Bests = { bench: 82.5, squat: 120, dead: 150, pullups: 9, run5k: 1660 };

export const bestsOf = (d: Pick<Intake, 'bench' | 'squat' | 'dead' | 'pullups' | 'run5k' | 'tested'>): Bests => ({
  bench: gaveBest(d, 'bench') ? d.bench : null, squat: gaveBest(d, 'squat') ? d.squat : null, dead: gaveBest(d, 'dead') ? d.dead : null,
  pullups: gaveBest(d, 'pullups') ? d.pullups : null, run5k: gaveBest(d, 'run5k') ? d.run5k : null,
});

export interface Benchmark {
  id: keyof Bests;
  name: string;
  icon: IconKey;
  start: string;
  now: string;
  goal: string;
  /** 0..1 from nothing to the goal. */
  pct: number;
  /** `now` comes from something you logged, not your starting number. */
  logged: boolean;
  /** Where the logged best came from, e.g. "Machine chest press · 3 Oct". */
  from: string;
}

const LIFTS: { id: 'bench' | 'squat' | 'dead'; name: string; icon: IconKey; match: RegExp; skip?: RegExp; mult: number }[] = [
  { id: 'bench', name: 'Bench press', icon: 'gym', match: /bench press|chest press/i, mult: 1.25 },
  { id: 'squat', name: 'Back squat', icon: 'train', match: /\bsquat/i, skip: /split|jump|goblet|pistol|bulgarian|sissy|hack/i, mult: 1.2 },
  { id: 'dead', name: 'Deadlift', icon: 'strength', match: /deadlift/i, skip: /romanian|stiff|rdl/i, mult: 1.2 },
];

const round = (v: number, to: number) => Math.round(v / to) * to;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** Every benchmark, from your starting bests and everything you've logged. */
export function benchmarks(sessions: SessionLog[], start: Bests = DEFAULT_BESTS): Benchmark[] {
  const out: Benchmark[] = LIFTS.map(l => {
    let best = 0, from = '';
    for (const s of sessions) {
      for (const x of s.sets ?? []) {
        if (!l.match.test(x.exercise) || l.skip?.test(x.exercise)) continue;
        x.reps.forEach((reps, i) => {
          const est = x.done[i] ? e1rm(x.kg[i] ?? null, reps) : null;
          if (est != null && est > best) {
            best = est;
            from = `${x.exercise} · ${day(s.date)}`;
          }
        });
      }
    }
    // Skipped in onboarding: the first logged lift becomes the starting point.
    const base = start[l.id] ?? (best ? round(best, 0.5) : null);
    if (base == null) return { id: l.id, name: l.name, icon: l.icon, start: '—', now: '—', goal: '—', pct: 0, logged: false, from: '' };
    const goal = round(Math.max(base * l.mult, base + 5), 2.5);
    const logged = best > 0 && (start[l.id] == null || best > start[l.id]!);
    const now = logged ? round(best, 0.5) : base;
    return { id: l.id, name: l.name, icon: l.icon, start: start[l.id] == null ? '—' : `${start[l.id]}`, now: `${now} kg`, goal: `${goal} kg`, pct: Math.min(1, now / goal), logged, from: logged ? from : '' };
  });

  let reps = 0, pullFrom = '';
  for (const s of sessions) {
    for (const x of s.sets ?? []) {
      if (!/pull-?ups?|chin-?ups?/i.test(x.exercise)) continue;
      x.reps.forEach((r, i) => {
        if (x.done[i] && r > reps) {
          reps = r;
          pullFrom = `${x.exercise} · ${day(s.date)}`;
        }
      });
    }
  }
  const pullBase = start.pullups ?? (reps || null);
  if (pullBase == null) out.push({ id: 'pullups', name: 'Pull-ups', icon: 'fist', start: '—', now: '—', goal: '—', pct: 0, logged: false, from: '' });
  else {
    const pullGoal = pullBase + 6, pullNow = Math.max(reps, pullBase), pullLogged = reps > 0 && (start.pullups == null || reps > start.pullups);
    out.push({ id: 'pullups', name: 'Pull-ups', icon: 'fist', start: start.pullups == null ? '—' : `${start.pullups}`, now: `${pullNow} reps`, goal: `${pullGoal} reps`, pct: Math.min(1, pullNow / pullGoal), logged: pullLogged, from: pullLogged ? pullFrom : '' });
  }

  let fastest = Infinity, runFrom = '';
  for (const s of sessions) {
    const c = s.cardio;
    if (!c || c.kind === 'walk' || c.kind === 'cycle' || c.km < 5) continue;
    const t = (c.seconds / c.km) * 5;
    if (t < fastest) {
      fastest = t;
      runFrom = `${c.km} km run · ${day(s.date)}`;
    }
  }
  const runBase = start.run5k ?? (Number.isFinite(fastest) ? fastest : null);
  if (runBase == null) out.push({ id: 'run5k', name: '5K run', icon: 'run', start: '—', now: '—', goal: '—', pct: 0, logged: false, from: '' });
  else {
    const runGoal = round(runBase * 0.88, 5), runNow = Math.min(fastest, runBase), runLogged = Number.isFinite(fastest) && (start.run5k == null || fastest < start.run5k);
    out.push({ id: 'run5k', name: '5K run', icon: 'run', start: start.run5k == null ? '—' : clock(start.run5k), now: clock(runNow), goal: clock(runGoal), pct: Math.min(1, runGoal / runNow), logged: runLogged, from: runLogged ? runFrom : '' });
  }
  return out;
}
