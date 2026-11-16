// First-run onboarding (setting up with REI): fourteen short parts in which REI learns who
// the user is, then turns the answers into their profile, targets, settings and lasting memory.
// Screens live in the app (app/src/app/onboarding.tsx); everything that decides numbers is here.
//
// The parts are ordered by what REI needs first: who you are and what you want (name, look, goal),
// the numbers the targets come from (body, target), then what the first week is built on (training,
// kitchen). The voice pick is the breather before the last short forms; the fuel numbers are the
// payoff once everything they depend on is in; the optional extras come last, then the vow.
import { characterOf } from './characters';
import type { IconKey } from './icons';
import { isoDate } from './time';
import type { MemoryKind } from './memory';
import type { Profile, ThemeId, Tone } from './types';

export interface Archetype {
  id: string;
  icon: IconKey;
  name: string;
  ref: string;
  /** Target body fat and lean mass to add (kg) for this look. */
  bf: number;
  gain: number;
  goal: GoalId;
  /** Power, speed, size out of 100, for the card bars. */
  bars: [number, number, number];
  spec: string;
  disc: string[];
  quip: string;
}

export const ARCHETYPES: Archetype[] = [
  { id: 'shinobi', icon: 'kunai', name: 'The Shadow', ref: 'Lean · fast', bf: 11, gain: 0, goal: 'lean', bars: [55, 92, 40], spec: '10–12% body fat · lean · quick', disc: ['Calisthenics', 'Running', 'Hypertrophy'], quip: 'The Shadow. Lean, fast, nothing wasted. That means a real cut and a lot of conditioning. No hiding.' },
  { id: 'swordsman', icon: 'sword', name: 'The Swordsman', ref: 'Broad · dense', bf: 11, gain: 3, goal: 'recomp', bars: [86, 66, 74], spec: '10–12% body fat · broad · dense', disc: ['Hypertrophy', 'Strength'], quip: 'The Swordsman. Broad back, dense shoulders, heavy lifting. Rows and presses become your religion.' },
  { id: 'slayer', icon: 'flame', name: 'The Engine', ref: 'Athletic · tireless', bf: 12, gain: 1, goal: 'lean', bars: [62, 82, 50], spec: '11–13% body fat · athletic', disc: ['Running', 'Calisthenics', 'Hypertrophy'], quip: 'The Engine. A motor that never quits. Expect early runs and breath work. Full focus.' },
  { id: 'sorcerer', icon: 'eye', name: 'The Apex', ref: 'Shredded · powerful', bf: 9, gain: 4, goal: 'recomp', bars: [92, 86, 80], spec: '8–10% body fat · shredded', disc: ['Hypertrophy', 'Strength', 'Calisthenics', 'Running'], quip: 'The Apex. Shredded and powerful. The hardest one on this list. Good. I wanted to see if you would pick it.' },
  { id: 'symbol', icon: 'star', name: 'The Titan', ref: 'Maximum size', bf: 14, gain: 8, goal: 'size', bars: [100, 48, 100], spec: '12–15% body fat · maximum size', disc: ['Hypertrophy', 'Strength'], quip: 'The Titan. Maximum size. That means eating a lot more than you want to, every day. No days off.' },
  { id: 'caped', icon: 'fist', name: 'The Minimalist', ref: 'Simply fit', bf: 13, gain: 0, goal: 'lean', bars: [74, 72, 38], spec: '12–14% body fat · simply fit', disc: ['Calisthenics', 'Running'], quip: 'The Minimalist. Push, pull, squat, run. No machines, no fuss. Simple is the hardest thing to do every single day.' },
];

export type GoalId = 'lean' | 'size' | 'strong' | 'recomp';

export const GOALS: { id: GoalId; icon: IconKey; tag: string; label: string; sub: string; adj: number }[] = [
  { id: 'lean', icon: 'flame', tag: 'Cut', label: 'Get lean', sub: 'Drop fat, keep muscle', adj: -0.18 },
  { id: 'size', icon: 'gym', tag: 'Bulk', label: 'Build size', sub: 'Add muscle, little fat', adj: 0.1 },
  { id: 'strong', icon: 'strength', tag: 'Strength', label: 'Get strong', sub: 'Move bigger numbers', adj: 0.03 },
  { id: 'recomp', icon: 'progress', tag: 'Recomp', label: 'Recomp', sub: 'Lose fat, gain muscle', adj: -0.08 },
];

export const TONES: { id: Tone; icon: IconKey; sub: string }[] = [
  { id: 'Tough love', icon: 'strength', sub: 'Calls you out. No negotiating.' },
  { id: 'Coach', icon: 'train', sub: 'Firm, measured, technical.' },
  { id: 'Bro', icon: 'fist', sub: 'Hype first, truth second.' },
];

export type StepId = 'boot' | 'name' | 'ideal' | 'vow' | 'body' | 'target' | 'train' | 'kitchen' | 'partner' | 'life' | 'fuel' | 'power' | 'weak' | 'tone' | 'pact' | 'done';

/**
 * In order. Parts have an `icon` and a title `t`; the cover and the welcome after the vow don't.
 * The account comes first (sign-in screen), so there is no account step in here.
 *
 * What each part collects, and why it sits where it does:
 * - name: `name`. Everything REI says uses it; the voices are prepared from it.
 * - ideal: `arch` (and through it a starting `goal`, `disc` and target). One tap.
 * - vow: `goal`, `weeks`, `why`. The goal drives calories; the weeks set the deadline.
 * - body: `sex`, `height`, `weight`, `bf`, `age`. Calories, the target and the first program need them.
 * - target: `targetWeight`, `targetBf`. Needs the look and the body; judged against the weeks.
 * - train: `exp`, `disc`, `sessions`, `length`, `time`, `equip`. What the first program is built on.
 * - kitchen: `diet`, `cuisine`, `meals`, `cook`, `alcohol`. What REI plans meals around.
 * - partner: `character`, `theme`. The breather: pick the voice and the world.
 * - life: `job`, `wake`, `bed`, `stress`, `steps`. The job is the last input the calories need.
 * - fuel: `kcalAdj`. The payoff: calories and macros from everything above.
 * - power: `bench`, `squat`, `dead`, `pullups`, `run5k`, `tested`. Optional; skipping is fine.
 * - weak: `quit`, `injuries`, `note`. Optional; lasting memory.
 * - tone: `tone`, `nudge`, `speak`. How REI talks and when.
 * - pact: nothing new. Read it, hold to seal.
 *
 * `waist`, `health` and `photo` are still on the intake (old drafts and saved intakes have them)
 * but no part asks for them: nothing in the app read them. `intensity` is only on the type now.
 */
export const STEPS: { id: StepId; icon?: IconKey; t?: string; cta?: string }[] = [
  { id: 'boot' },
  { id: 'name', icon: 'profile', t: 'Your name', cta: 'That’s me' },
  { id: 'ideal', icon: 'star', t: 'The look', cta: 'This is who I become' },
  { id: 'vow', icon: 'vow', t: 'The goal', cta: 'Set the goal' },
  { id: 'body', icon: 'weight', t: 'Where you stand', cta: 'Those are my numbers' },
  { id: 'target', icon: 'target', t: 'The target', cta: 'Set the target' },
  { id: 'train', icon: 'train', t: 'Training', cta: 'Confirm the week' },
  { id: 'kitchen', icon: 'fuel', t: 'Kitchen', cta: 'That’s how I eat' },
  { id: 'partner', icon: 'rei', t: 'Voice and world', cta: 'Keep this voice' },
  { id: 'life', icon: 'sleep', t: 'Daily life', cta: 'Run my numbers' },
  { id: 'fuel', icon: 'kcal', t: 'Fuel', cta: 'Accept the fuel' },
  { id: 'power', icon: 'strength', t: 'Your bests', cta: 'Log my numbers' },
  { id: 'weak', icon: 'heart', t: 'Weak points', cta: 'Remember this' },
  { id: 'tone', icon: 'voice', t: 'How I talk', cta: 'That’s how you talk to me' },
  { id: 'pact', icon: 'scroll', t: 'Your vow' },
  { id: 'done' },
];

export const CHAPTERS = STEPS.filter(s => s.t).length;

export type TrainTime = 'Morning' | 'Midday' | 'Evening' | 'Night';
const TRAIN_AT: Record<TrainTime, string> = { Morning: '06:30', Midday: '12:30', Evening: '18:30', Night: '21:00' };

export interface Intake {
  name: string;
  /** Archetype id, 'none' for their own reference, null before choosing. */
  arch: string | null;
  goal: GoalId;
  weeks: number;
  why: string;
  sex: 'Male' | 'Female';
  height: number;
  weight: number;
  age: number;
  bf: number;
  waist: number;
  targetWeight: number;
  targetBf: number;
  targetTouched: boolean;
  exp: 'New' | '1–3 yrs' | '3+ yrs';
  bench: number;
  squat: number;
  dead: number;
  pullups: number;
  /** 5K time in seconds. */
  run5k: number;
  /** Which bests they actually set; the rest were skipped. Missing on intakes from before this existed (all count). */
  tested?: Partial<Record<BestKey, boolean>>;
  disc: Record<string, boolean>;
  sessions: number;
  length: number;
  time: TrainTime;
  equip: Record<string, boolean>;
  job: 'Desk' | 'On my feet' | 'Physical';
  /** Minutes after midnight. */
  wake: number;
  bed: number;
  stress: number;
  steps: number;
  diet: string;
  meals: number;
  cook: string;
  alcohol: string;
  cuisine: Record<string, boolean>;
  kcalAdj: number;
  quit: Record<string, boolean>;
  injuries: Record<string, boolean>;
  note: string;
  tone: Tone;
  /** No longer asked, read or written. Old drafts and saved intakes may still carry it. */
  intensity?: number;
  /** Voice character (characters.ts). */
  character: string;
  theme: ThemeId;
  health: boolean;
  nudge: boolean;
  speak: boolean;
  photo: boolean;
}

export type BestKey = 'bench' | 'squat' | 'dead' | 'pullups' | 'run5k';
export const BEST_KEYS: BestKey[] = ['bench', 'squat', 'dead', 'pullups', 'run5k'];

/** Did they give this best? Old intakes (no `tested`) count everything. */
export const gaveBest = (d: Pick<Intake, 'tested'>, k: BestKey) => !d.tested || !!d.tested[k];

/** Where a best starts the first time they set it: typical for their sex and training age. */
export function suggestedBest(k: BestKey, d: Pick<Intake, 'sex' | 'exp'>): number {
  const lvl = d.exp === 'New' ? 0 : d.exp === '3+ yrs' ? 2 : 1;
  const man = d.sex !== 'Female';
  const table: Record<BestKey, [number, number, number][]> = {
    // [new, 1–3 yrs, 3+ yrs] for men, then women.
    bench: [[40, 80, 100], [20, 40, 50]],
    squat: [[60, 100, 140], [35, 60, 80]],
    dead: [[70, 120, 170], [40, 75, 100]],
    pullups: [[2, 8, 14], [0, 2, 6]],
    run5k: [[2100, 1680, 1500], [2340, 1980, 1800]],
  } as never;
  return table[k][man ? 0 : 1][lvl];
}

export const DEFAULT_INTAKE: Intake = {
  name: '', arch: null, goal: 'lean', weeks: 22, why: '', sex: 'Male', height: 178, weight: 81.6, age: 26, bf: 19, waist: 86, targetWeight: 74, targetBf: 12, targetTouched: false,
  exp: '1–3 yrs', bench: 80, squat: 120, dead: 150, pullups: 9, run5k: 1660, tested: {},
  disc: { Hypertrophy: true, Strength: true, Calisthenics: true, Running: true }, sessions: 5, length: 60, time: 'Evening', equip: { 'Full gym': true, 'Pull-up bar': true },
  job: 'Desk', wake: 405, bed: 1395, stress: 3, steps: 10000,
  diet: 'Non-veg', meals: 4, cook: 'Sometimes', alcohol: 'Weekends', cuisine: { Indian: true }, kcalAdj: 0,
  quit: { 'Work gets busy': true, Weekends: true }, injuries: {}, note: '',
  tone: 'Tough love', character: 'rei', theme: 'zero', health: true, nudge: true, speak: true, photo: true,
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const shortDate = (d: Date, year = false) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ''}`;
export const clockOf = (m: number) => {
  m = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
/** The keys switched on in a multi-pick, without "None". */
export const picked = (o: Record<string, boolean> | undefined) => Object.keys(o ?? {}).filter(k => o?.[k] && k !== 'None');

export const nameOf = (d: Intake) => d.name.trim() || 'Operator';
export const archetypeOf = (d: Intake) => ARCHETYPES.find(a => a.id === d.arch) ?? null;
export const goalOf = (d: Intake) => GOALS.find(g => g.id === d.goal) ?? GOALS[0];
export const sleepHours = (d: Intake) => ((((d.wake - d.bed) % 1440) + 1440) % 1440) / 60;
export const trainTime = (d: Intake) => TRAIN_AT[d.time] ?? '18:30';
export const deadlineOf = (d: Intake, now: Date) => {
  const t = new Date(now);
  t.setDate(t.getDate() + d.weeks * 7);
  return t;
};
/** Weight change per week the target asks for (negative = losing). */
export const weeklyRate = (d: Intake) => (d.targetWeight - d.weight) / d.weeks;

/** The target weight and body fat that fit an archetype from where they are now. */
export function suggestedTarget(d: Intake): Pick<Intake, 'targetWeight' | 'targetBf'> | null {
  const a = archetypeOf(d);
  if (!a) return null;
  const lean = d.weight * (1 - d.bf / 100) + a.gain;
  return { targetBf: a.bf, targetWeight: Math.round((lean / (1 - a.bf / 100)) * 2) / 2 };
}

/**
 * Daily calories and macros: Mifflin–St Jeor BMR × an activity factor from their job and
 * training load, adjusted for the goal, plus any manual nudge. Protein 2.2 g/kg on a cut
 * (2.0 otherwise), fat 0.8 g/kg, carbs fill the rest (never under 60 g).
 */
export function fuel(d: Intake) {
  const g = goalOf(d);
  const bmr = 10 * d.weight + 6.25 * d.height - 5 * d.age + (d.sex === 'Male' ? 5 : -161);
  const af = ({ Desk: 1.2, 'On my feet': 1.35, Physical: 1.5 }[d.job] ?? 1.2) + d.sessions * 0.05 * (d.length / 60);
  const kcal = Math.round((bmr * af * (1 + g.adj)) / 50) * 50 + d.kcalAdj;
  const p = Math.round((d.weight * (g.id === 'lean' ? 2.2 : 2.0)) / 5) * 5;
  const f = Math.round((d.weight * 0.8) / 5) * 5;
  const c = Math.max(60, Math.round((kcal - p * 4 - f * 9) / 20) * 5);
  return { bmr: Math.round(bmr), af, adj: g.adj, kcal, p, c, f };
}

/** The vow as one sentence, e.g. "get lean to 74 kg at 12% body fat by 3 MAR 2027." */
export function vowSentence(d: Intake, now: Date): string {
  const date = shortDate(deadlineOf(d, now), true).replace(/^0/, '');
  return {
    lean: `get lean to ${d.targetWeight} kg at ${d.targetBf}% body fat by ${date}.`,
    size: `build to ${d.targetWeight} kg of quality size by ${date}.`,
    strong: `get strong at ${d.targetWeight} kg by ${date}.`,
    recomp: `recomp to ${d.targetBf}% body fat at ${d.targetWeight} kg by ${date}.`,
  }[d.goal];
}

/** What REI says at the top of each part. */
export function reiLine(step: StepId, d: Intake): string {
  const n = nameOf(d), a = archetypeOf(d);
  switch (step) {
    case 'name': return 'First things first. What do I call you? I’ll be using it a lot. Especially when you’re slacking.';
    case 'ideal': return a ? a.quip : d.arch === 'none' ? 'Your own vision. Good. Describe it in your goal and I’ll reverse-engineer the plan from it.' : `Everyone is chasing a shape, ${n}. Pick yours. Or bring your own.`;
    case 'vow': return `Now say it properly, ${n}. Not a wish. A target with a date. And tell me why, because I’ll quote it back to you.`;
    case 'body': return 'Step on the scale. Real numbers. I can’t fix what you round down.';
    case 'target': {
      const r = weeklyRate(d), pct = (Math.abs(r) / d.weight) * 100, x = Math.abs(r).toFixed(2);
      const pre = a && !d.targetTouched ? `Worked back from ${a.name}. ` : '';
      if (Math.abs(r) < 0.05) return pre + 'Holding weight while you change shape. Slow, but it works if you train hard.';
      if (r < 0 && pct > 1) return pre + `${x} kg a week. Aggressive. You’ll hate me by week six. Give it more time.`;
      if (r > 0 && pct > 0.5) return pre + `${x} kg a week up is mostly fat. Slow it down or give it more weeks.`;
      if (pct < 0.25) return pre + `${x} kg a week. Comfortable doesn’t change physiques. Tighten the date.`;
      return pre + `${x} kg a week for ${d.weeks} weeks. Realistic. Which means there’s no excuse.`;
    }
    case 'power': return 'Your bests so far. Recent numbers, so your first targets aren’t from a template. Skip what you don’t know.';
    case 'train': return 'How many days can you actually train? Pick what you’ll do on a bad week, not a good one.';
    case 'life': {
      const h = sleepHours(d);
      return `Your day decides your training. ${h.toFixed(1)} hours of sleep${h < 7 ? ' isn’t enough. We’ll fix that too' : '. Good. Protect it'}.`;
    }
    case 'kitchen': return 'How you actually eat, not how you wish you ate. I plan your meals around this.';
    case 'fuel': return `I ran your numbers. This is your daily fuel, ${n}. Protein first, every single day.`;
    case 'weak': return 'Everyone has a weak point. Tell me yours now. I’ll be waiting for it.';
    case 'tone': return 'How do you want me to talk to you day to day? Choose carefully. I stick to it.';
    case 'partner': {
      const c = characterOf(d.character);
      return c.id === 'rei' ? 'Halfway. Take a breath. Whose voice do you want to hear? Mine, by default. Or pick another. Tap one to hear them.' : `${c.name}. Good pick. They’ll speak for me on calls and replies. Tap anyone else to hear them.`;
    }
    case 'pact': return 'Your vow. Read it. Then hold to seal it. Once it’s sealed, I hold you to every line.';
    default: return '';
  }
}

/** How REI would sound in each voice, for the tone part. */
export function toneSample(tone: Tone, d: Intake): string {
  const n = nameOf(d), t = trainTime(d);
  if (tone === 'Coach') return `Two sessions missed this week, ${n}. Tonight’s push puts you back on plan. ${t}, 52 minutes, top set 82.5 × 6.`;
  if (tone === 'Bro') return `${n}. Two missed. Happens once, not three times. Tonight we lift. ${t}. Let’s go.`;
  return `${n}, you said this mattered. Two sessions missed. Stop negotiating with yourself. Push at ${t}. I already cut it to 52 minutes.`;
}

export function pactRows(d: Intake): [string, string][] {
  const a = archetypeOf(d), c = fuel(d);
  return [
    ['Ideal', a ? `${a.name} · ${a.ref}` : 'My own reference'],
    ['Train', `${d.sessions}× a week · ${d.length} min · ${trainTime(d)}`],
    ['Fuel', `${c.kcal.toLocaleString('en-US')} kcal · ${c.p} g protein`],
    ['Sleep', `${clockOf(d.bed)} → ${clockOf(d.wake)} · ${sleepHours(d).toFixed(1)} h`],
    ['Watch for', picked(d.quit).slice(0, 2).join(', ') || 'Nothing. We will see.'],
    ['Voice', `${characterOf(d.character).name} · ${d.tone}`],
  ];
}

export function bondLine(d: Intake): string {
  const a = archetypeOf(d);
  return `${nameOf(d)}. ${a ? `${a.name} it is.` : 'Your vision, your rules.'} ${d.sessions} sessions a week, first one at ${trainTime(d)}. I’ll be up at ${clockOf(d.wake)}. Don’t make me come looking for you.`;
}

/** The profile REI coaches against, from their answers. */
export function intakeProfile(d: Intake, now: Date): Profile {
  const c = fuel(d), v = vowSentence(d, now);
  return {
    name: d.name.trim(),
    goal: v.charAt(0).toUpperCase() + v.slice(1) + (d.why.trim() ? ` Why: ${d.why.trim()}` : ''),
    deadline: isoDate(deadlineOf(d, now)),
    weight: String(d.weight), targetWeight: String(d.targetWeight), bf: String(d.bf), targetBf: String(d.targetBf),
    height: String(d.height), age: String(d.age),
    kcal: String(c.kcal), protein: String(c.p), carbs: String(c.c), fat: String(c.f),
    steps: String(d.steps), sleep: sleepHours(d).toFixed(1), sessions: String(d.sessions),
    sessionTime: trainTime(d), bedtime: clockOf(d.bed),
  };
}

/** "bests: bench 60 kg, 5K 31:00", only the ones they gave. */
function bestsLine(d: Intake): string {
  const parts = [
    gaveBest(d, 'bench') && `bench ${d.bench} kg`, gaveBest(d, 'squat') && `squat ${d.squat} kg`, gaveBest(d, 'dead') && `deadlift ${d.dead} kg`,
    gaveBest(d, 'pullups') && `${d.pullups} pull-ups`, gaveBest(d, 'run5k') && `5K ${mmss(d.run5k)}`,
  ].filter(Boolean);
  return parts.length ? `bests: ${parts.join(', ')}` : 'no current bests given yet';
}

/** Lasting facts REI should always know, from their answers. */
export function intakeMemory(d: Intake): { kind: MemoryKind; text: string }[] {
  const a = archetypeOf(d);
  const facts: { kind: MemoryKind; text: string }[] = [
    { kind: 'diet', text: `${d.diet}; ${d.meals} meals a day; cooks: ${d.cook.toLowerCase()}; alcohol: ${d.alcohol.toLowerCase()}` },
    ...(picked(d.cuisine).length ? [{ kind: 'diet' as const, text: `Usually eats ${picked(d.cuisine).join(', ')} food` }] : []),
    ...picked(d.injuries).map(t => ({ kind: 'health' as const, text: `${t} injury: plan around it` })),
    ...(picked(d.equip).length ? [{ kind: 'equipment' as const, text: `Trains with: ${picked(d.equip).join(', ')}` }] : []),
    { kind: 'schedule', text: `Trains ${d.time.toLowerCase()} (${trainTime(d)}), ${d.length} min, ${d.sessions}× a week; wakes ${clockOf(d.wake)}, bed ${clockOf(d.bed)}; ${d.job.toLowerCase()} job; stress ${d.stress}/5` },
    { kind: 'preference', text: a ? `Ideal physique: ${a.name} (${a.ref})` : 'Ideal physique: their own reference' },
    { kind: 'life', text: `Training age ${d.exp}; ${bestsLine(d)}` },
    ...(picked(d.quit).length ? [{ kind: 'life' as const, text: `Usually quits when: ${picked(d.quit).join(', ').toLowerCase()}` }] : []),
  ];
  if (d.why.trim()) facts.push({ kind: 'life', text: `Why it matters: ${d.why.trim()}` });
  if (d.note.trim()) facts.push({ kind: 'life', text: d.note.trim() });
  return facts.map(f => ({ ...f, text: f.text.slice(0, 160) }));
}

/** Disciplines switched on, in the app's shape. */
export const intakeDisciplines = (d: Intake): Record<string, boolean> => ({
  Hypertrophy: !!d.disc.Hypertrophy, Strength: !!d.disc.Strength, Calisthenics: !!d.disc.Calisthenics, Running: !!d.disc.Running,
});
