// Exercises to suggest when building a gym workout: the common lifts for each muscle group, by the
// names people use in a gym (the library's long names are found from these for photos and form tips).
import type { IconKey } from './icons';

export interface PickGroup {
  id: string;
  name: string;
  icon: IconKey;
  /** Exercise names, most common first. Bodyweight ones start with no load. */
  lifts: string[];
}

export const PICK_GROUPS: PickGroup[] = [
  { id: 'chest', name: 'Chest', icon: 'gym', lifts: ['Bench press', 'Incline dumbbell press', 'Dumbbell bench press', 'Machine chest press', 'Cable crossover', 'Push ups', 'Dips'] },
  { id: 'back', name: 'Back', icon: 'strength', lifts: ['Pull ups', 'Lat pulldown', 'Barbell row', 'Dumbbell row', 'Seated cable row', 'Deadlift', 'Face pull'] },
  { id: 'legs', name: 'Legs', icon: 'train', lifts: ['Back squat', 'Leg press', 'Romanian deadlift', 'Leg curl', 'Leg extension', 'Walking lunges', 'Hip thrust', 'Calf raise'] },
  { id: 'shoulders', name: 'Shoulders', icon: 'rank', lifts: ['Overhead press', 'Dumbbell shoulder press', 'Lateral raise', 'Rear delt fly', 'Face pull', 'Shrugs'] },
  { id: 'arms', name: 'Arms', icon: 'fist', lifts: ['Barbell curl', 'Dumbbell curl', 'Hammer curl', 'Tricep pushdown', 'Skull crusher', 'Overhead tricep extension'] },
  { id: 'core', name: 'Core', icon: 'kcal', lifts: ['Plank', 'Hanging leg raise', 'Cable crunch', 'Ab rollout', 'Russian twist', 'Crunches'] },
];

const BODYWEIGHT = /push ?ups?|pull ?ups?|chin ?ups?|dips|plank|crunch|leg raise|rollout|lunges|russian twist|sit ?ups?/i;

/** True when an exercise is usually done without added weight. */
export const isBodyweight = (name: string) => BODYWEIGHT.test(name);

/** Default target for a newly added exercise: 3 sets, fewer reps for the big compound lifts. */
export function defaultSets(name: string): number[] {
  if (/plank/i.test(name)) return [30, 30, 30];
  if (/squat|deadlift|bench press|overhead press|barbell row/i.test(name)) return [6, 6, 6];
  return [10, 10, 10];
}
