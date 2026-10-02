// The exercise library: 876 exercises with muscles, equipment and photos, for form tips,
// swapping an exercise when a machine is busy, and naming what REI programs.
import { LIBRARY } from './library';

export { LIBRARY } from './library';

export type ExerciseCategory = 'strength' | 'powerlifting' | 'olympic' | 'strongman' | 'plyometrics' | 'cardio' | 'stretching';

export interface LibExercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: string;
  level: string;
  mechanic: string;
  primary: string[];
  secondary: string[];
  images: number;
}

const CATEGORY: Record<string, ExerciseCategory> = { s: 'strength', p: 'powerlifting', o: 'olympic', m: 'strongman', y: 'plyometrics', c: 'cardio', t: 'stretching' };

let built: LibExercise[] | null = null;
let byId: Map<string, LibExercise> | null = null;

export function library(): LibExercise[] {
  built ??= LIBRARY.map(([id, name, cat, equipment, level, mechanic, primary, secondary, images]) => ({
    id, name, category: CATEGORY[cat] ?? 'strength', equipment, level, mechanic,
    primary: primary ? primary.split(',') : [], secondary: secondary ? secondary.split(',') : [], images,
  }));
  return built;
}

export function exerciseById(id: string): LibExercise | undefined {
  byId ??= new Map(library().map(e => [e.id, e]));
  return byId.get(id);
}

/** Photo of the start (0) or end (1) position. */
export const exerciseImage = (id: string, i = 0) => `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${id}/${i}.jpg`;

// Names people (and REI) use, mapped to the library's entry.
export const ALIASES: Record<string, string> = {
  'bench press': 'Barbell_Bench_Press_-_Medium_Grip', bench: 'Barbell_Bench_Press_-_Medium_Grip', 'incline bench press': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'overhead press': 'Standing_Military_Press', ohp: 'Standing_Military_Press', 'military press': 'Standing_Military_Press', 'shoulder press': 'Dumbbell_Shoulder_Press',
  squat: 'Barbell_Full_Squat', 'back squat': 'Barbell_Full_Squat', 'front squat': 'Front_Squat_Clean_Grip', 'goblet squat': 'Goblet_Squat',
  deadlift: 'Barbell_Deadlift', 'romanian deadlift': 'Romanian_Deadlift', rdl: 'Romanian_Deadlift', 'sumo deadlift': 'Sumo_Deadlift',
  'pull ups': 'Pullups', 'pull up': 'Pullups', pullups: 'Pullups', 'weighted pull ups': 'Pullups', 'chin ups': 'Chin-Up', 'chin up': 'Chin-Up',
  dips: 'Dips_-_Triceps_Version', 'weighted dips': 'Dips_-_Triceps_Version', 'push ups': 'Pushups', 'push up': 'Pushups', pushups: 'Pushups',
  'lat pulldown': 'Wide-Grip_Lat_Pulldown', 'barbell row': 'Bent_Over_Barbell_Row', 'bent over row': 'Bent_Over_Barbell_Row', 'dumbbell row': 'One-Arm_Dumbbell_Row',
  'seated cable row': 'Seated_Cable_Rows', 'cable row': 'Seated_Cable_Rows', 't bar row': 'T-Bar_Row_with_Handle',
  'lateral raise': 'Side_Lateral_Raise', 'lateral raises': 'Side_Lateral_Raise', 'face pull': 'Face_Pull', 'face pulls': 'Face_Pull',
  'leg curl': 'Lying_Leg_Curls', 'leg press': 'Leg_Press', 'leg extension': 'Leg_Extensions', 'calf raise': 'Standing_Calf_Raises', 'standing calf raise': 'Standing_Calf_Raises',
  'hip thrust': 'Barbell_Hip_Thrust', plank: 'Plank', 'incline db press': 'Incline_Dumbbell_Press', 'incline dumbbell press': 'Incline_Dumbbell_Press',
  'bulgarian split squat': 'Split_Squat_with_Dumbbells', 'split squat': 'Split_Squat_with_Dumbbells', lunges: 'Dumbbell_Lunges', lunge: 'Dumbbell_Lunges',
  'hanging leg raise': 'Hanging_Leg_Raise', 'rope pushdown': 'Triceps_Pushdown_-_Rope_Attachment', 'triceps pushdown': 'Triceps_Pushdown', pushdown: 'Triceps_Pushdown',
  'incline curl': 'Incline_Dumbbell_Curl', curl: 'Barbell_Curl', 'barbell curl': 'Barbell_Curl', 'bicep curl': 'Dumbbell_Bicep_Curl', 'hammer curl': 'Hammer_Curls',
  'skull crusher': 'EZ-Bar_Skullcrusher', 'pistol squat': 'Kettlebell_Pistol_Squat', 'kettlebell swing': 'One-Arm_Kettlebell_Swings', 'russian twist': 'Russian_Twist',
  'mountain climbers': 'Mountain_Climbers', crunch: 'Crunches', crunches: 'Crunches', 'cable fly': 'Flat_Bench_Cable_Flyes', 'dumbbell fly': 'Dumbbell_Flyes', shrug: 'Barbell_Shrug',
  run: 'Running_Treadmill', running: 'Running_Treadmill', 'warm up jog': 'Jogging_Treadmill', jog: 'Jogging_Treadmill', intervals: 'Running_Treadmill', 'tempo run': 'Running_Treadmill',
  cycling: 'Bicycling', rowing: 'Rowing_Stationary', 'arnold press': 'Arnold_Dumbbell_Press',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\b(db)\b/g, 'dumbbell').replace(/\b(bb)\b/g, 'barbell').replace(/\s+/g, ' ').trim();
const stem = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const words = (s: string) => norm(s).split(' ').filter(Boolean).map(stem);
const wordCache = new WeakMap<LibExercise, string[]>();
const wordsOf = (e: LibExercise) => {
  let w = wordCache.get(e);
  if (!w) wordCache.set(e, (w = words(e.name)));
  return w;
};

/** Split every name into search words ahead of the first search. */
export function warmExerciseSearch(): void {
  for (const e of library()) wordsOf(e);
}

/** Library matches for a search, best first. */
export function searchExercises(query: string, max = 30, pool: LibExercise[] = library()): LibExercise[] {
  const q = words(query);
  if (!q.length) return pool.slice(0, max);
  const scored: [LibExercise, number][] = [];
  for (const e of pool) {
    const w = wordsOf(e);
    let hit = 0;
    for (const x of q) if (w.some(t => t === x || (x.length >= 3 && t.startsWith(x)))) hit++;
    if (hit < q.length) continue;
    // Fewer extra words is closer; strength work and common equipment first.
    const score = 10 - (w.length - hit) * 0.5 + (e.category === 'strength' || e.category === 'powerlifting' ? 1 : 0) + (e.level === 'beginner' || e.level === 'intermediate' ? 0.3 : 0);
    scored.push([e, score]);
  }
  return scored.sort((a, b) => b[1] - a[1]).slice(0, max).map(([e]) => e);
}

/** The library entry for an exercise name from a plan ("Incline DB press", "Weighted pull-ups"). */
export function findExercise(name: string): LibExercise | undefined {
  const n = norm(name).replace(/\b(weighted|heavy|light|paused|tempo|strict|max)\b/g, '').replace(/\s+/g, ' ').trim();
  const alias = ALIASES[n] ?? ALIASES[norm(name)];
  if (alias) return exerciseById(alias);
  return searchExercises(n, 1)[0];
}

/** Exercises that train the same thing, for when the planned one isn't possible today. */
export function alternatives(ex: LibExercise, max = 12): LibExercise[] {
  const main = ex.primary[0];
  if (!main) return [];
  const known = new Set(Object.values(ALIASES));
  const COMMON = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'kettlebells', 'e-z curl bar']);
  const own = new Set(wordsOf(ex));
  const sameKind = (e: LibExercise) => (ex.category === 'stretching' ? e.category === 'stretching' : e.category !== 'stretching');
  return library()
    .filter(e => e.id !== ex.id && e.primary[0] === main && sameKind(e))
    .map(e => {
      // Well-known lifts on common equipment first, moving the same way as the original.
      const score = (known.has(e.id) ? 1.5 : 0) + (COMMON.has(e.equipment) ? 1 : 0) + (e.mechanic === ex.mechanic ? 2 : 0) + (e.category === ex.category ? 1 : 0)
        + (e.level === 'expert' ? -1 : 0) + wordsOf(e).filter(w => own.has(w)).length * 1 + e.secondary.filter(m => ex.secondary.includes(m)).length * 0.3;
      return [e, score] as const;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([e]) => e);
}
