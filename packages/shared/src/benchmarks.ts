// Strength and running benchmarks for the Vow: where you started (onboarding's "power level"),
// your best logged so far, and a goal set from your start. A logged chest press or bench moves
// the bench line; a 5 km+ run moves the 5K line.
import type { IconKey } from './icons';
import type { Intake } from './onboarding';
import { e1rm } from './strength';
import type { SessionLog } from './types';

export interface Bests {
  bench: number;
  squat: number;
  dead: number;
  pullups: number;
  /** 5K time in seconds. */
  run5k: number;
}

/** Starting numbers when nothing better is known (the demo's). */
export const DEFAULT_BESTS: Bests = { bench: 82.5, squat: 120, dead: 150, pullups: 9, run5k: 1660 };

export const bestsOf = (d: Pick<Intake, 'bench' | 'squat' | 'dead' | 'pullups' | 'run5k'>): Bests => ({ bench: d.bench, squat: d.squat, dead: d.dead, pullups: d.pullups, run5k: d.run5k });

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
    const goal = round(Math.max(start[l.id] * l.mult, start[l.id] + 5), 2.5);
    const now = best > start[l.id] ? round(best, 0.5) : start[l.id];
    return { id: l.id, name: l.name, icon: l.icon, start: `${start[l.id]}`, now: `${now} kg`, goal: `${goal} kg`, pct: Math.min(1, now / goal), logged: best > start[l.id], from: best > start[l.id] ? from : '' };
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
  const pullGoal = start.pullups + 6, pullNow = Math.max(reps, start.pullups);
  out.push({ id: 'pullups', name: 'Pull-ups', icon: 'fist', start: `${start.pullups}`, now: `${pullNow} reps`, goal: `${pullGoal} reps`, pct: Math.min(1, pullNow / pullGoal), logged: reps > start.pullups, from: reps > start.pullups ? pullFrom : '' });

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
  const runGoal = round(start.run5k * 0.88, 5), runNow = Math.min(fastest, start.run5k);
  out.push({ id: 'run5k', name: '5K run', icon: 'run', start: clock(start.run5k), now: clock(runNow), goal: clock(runGoal), pct: Math.min(1, runGoal / runNow), logged: fastest < start.run5k, from: fastest < start.run5k ? runFrom : '' });
  return out;
}
