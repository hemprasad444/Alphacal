// Sports and everyday activities with MET values (metabolic equivalents) from the Compendium
// of Physical Activities (Ainsworth et al.). Calories burned ≈ MET × body weight (kg) × hours.
// These are population averages: real burn varies with effort, fitness and body size.

export type MovementGroup = 'cardio' | 'sport' | 'gym' | 'mind' | 'life';

export interface Movement {
  id: string;
  name: string;
  alt: string;
  met: number;
  group: MovementGroup;
}

// [id, name, other names, MET, group]
export const MOVEMENTS: [string, string, string, number, MovementGroup][] = [
  // Walking, running, cycling, swimming
  ['walk-easy', 'Walking, easy', 'walk, stroll, evening walk', 3.0, 'cardio'],
  ['walk', 'Walking, moderate', 'walking 5 km/h, morning walk', 3.5, 'cardio'],
  ['walk-brisk', 'Walking, brisk', 'power walk, fast walk', 5.0, 'cardio'],
  ['walk-uphill', 'Walking uphill', 'incline walk, treadmill incline', 6.0, 'cardio'],
  ['jog', 'Jogging', 'jog, light run', 7.0, 'cardio'],
  ['run-8', 'Running, 8 km/h', 'running 7:30 per km', 8.3, 'cardio'],
  ['run-10', 'Running, 10 km/h', 'running 6:00 per km', 9.8, 'cardio'],
  ['run-12', 'Running, 12 km/h', 'running 5:00 per km', 11.5, 'cardio'],
  ['run-14', 'Running, 14 km/h', 'running 4:15 per km', 12.8, 'cardio'],
  ['sprints', 'Sprints', 'interval sprints, track intervals', 13.0, 'cardio'],
  ['cycle-easy', 'Cycling, leisurely', 'cycling, bike ride', 4.0, 'cardio'],
  ['cycle', 'Cycling, moderate', 'cycling 16-19 km/h, commute by bike', 6.8, 'cardio'],
  ['cycle-fast', 'Cycling, fast', 'cycling 20+ km/h, road cycling', 8.0, 'cardio'],
  ['spin', 'Stationary bike', 'spin class, exercise bike, cycling machine', 7.0, 'cardio'],
  ['swim-easy', 'Swimming, leisurely', 'swimming', 6.0, 'cardio'],
  ['swim-laps', 'Swimming laps, moderate', 'freestyle laps', 7.0, 'cardio'],
  ['swim-fast', 'Swimming laps, fast', 'competitive swimming', 9.8, 'cardio'],
  ['row', 'Rowing machine, moderate', 'rowing, erg', 7.0, 'cardio'],
  ['row-hard', 'Rowing machine, vigorous', '', 8.5, 'cardio'],
  ['elliptical', 'Elliptical trainer', 'cross trainer', 5.0, 'cardio'],
  ['stairs', 'Climbing stairs', 'stair climber, stairmaster, stepper', 8.0, 'cardio'],
  ['skipping', 'Skipping rope', 'jump rope, skipping', 11.8, 'cardio'],
  ['hiking', 'Hiking', 'hike, trek, trekking', 6.0, 'cardio'],
  ['trek-pack', 'Trekking with a backpack', 'mountain trek', 7.8, 'cardio'],
  ['skating', 'Skating', 'roller skating, ice skating', 7.0, 'cardio'],
  // Sports
  ['cricket', 'Cricket', 'batting, bowling, nets', 4.8, 'sport'],
  ['badminton', 'Badminton, social', 'badminton, shuttle', 5.5, 'sport'],
  ['badminton-match', 'Badminton, competitive', 'badminton match', 7.0, 'sport'],
  ['football', 'Football, casual', 'soccer, futsal', 7.0, 'sport'],
  ['football-match', 'Football, match', 'soccer match', 10.0, 'sport'],
  ['basketball', 'Basketball', 'hoops', 6.5, 'sport'],
  ['volleyball', 'Volleyball', '', 4.0, 'sport'],
  ['tennis', 'Tennis, singles', 'tennis', 8.0, 'sport'],
  ['tennis-doubles', 'Tennis, doubles', '', 6.0, 'sport'],
  ['table-tennis', 'Table tennis', 'ping pong, tt', 4.0, 'sport'],
  ['squash', 'Squash', '', 7.3, 'sport'],
  ['pickleball', 'Pickleball', '', 4.5, 'sport'],
  ['hockey', 'Hockey', 'field hockey', 7.8, 'sport'],
  ['kabaddi', 'Kabaddi', 'kho kho', 6.0, 'sport'],
  ['boxing', 'Boxing, sparring', 'boxing', 7.8, 'sport'],
  ['punching-bag', 'Boxing, bag work', 'punching bag, heavy bag', 5.5, 'sport'],
  ['martial-arts', 'Martial arts', 'karate, taekwondo, judo, mma, kickboxing', 10.3, 'sport'],
  ['wrestling', 'Wrestling', 'kushti', 6.0, 'sport'],
  ['golf', 'Golf, walking', 'golf', 4.8, 'sport'],
  ['horse-riding', 'Horse riding', '', 5.5, 'sport'],
  ['climbing', 'Rock climbing', 'bouldering, wall climbing', 7.5, 'sport'],
  // Gym and classes
  ['weights', 'Weight training', 'gym, lifting, strength training', 3.5, 'gym'],
  ['weights-hard', 'Weight training, vigorous', 'powerlifting, heavy lifting', 6.0, 'gym'],
  ['hiit', 'HIIT', 'high intensity interval training, tabata, crossfit', 8.0, 'gym'],
  ['circuit', 'Circuit training', 'bootcamp, functional training', 4.3, 'gym'],
  ['calisthenics', 'Calisthenics, vigorous', 'push ups, pull ups, burpees, bodyweight workout', 8.0, 'gym'],
  ['calisthenics-light', 'Calisthenics, light', 'home workout, bodyweight', 3.8, 'gym'],
  ['aerobics', 'Aerobics', 'zumba, aerobic dance, step aerobics', 7.3, 'gym'],
  ['dance', 'Dancing', 'bhangra, garba, bollywood dance, party', 5.0, 'gym'],
  ['classical-dance', 'Classical dance', 'bharatanatyam, kathak', 5.0, 'gym'],
  // Mind and body
  ['yoga', 'Yoga', 'hatha yoga', 2.5, 'mind'],
  ['power-yoga', 'Power yoga', 'vinyasa, ashtanga', 4.0, 'mind'],
  ['surya-namaskar', 'Surya namaskar', 'sun salutation', 3.3, 'mind'],
  ['pilates', 'Pilates', '', 3.0, 'mind'],
  ['stretching', 'Stretching', 'mobility, warm up, cool down', 2.3, 'mind'],
  ['tai-chi', 'Tai chi', 'qigong', 3.0, 'mind'],
  // Everyday
  ['housework', 'Housework', 'cleaning, sweeping, mopping', 3.3, 'life'],
  ['gardening', 'Gardening', '', 3.8, 'life'],
  ['kids', 'Playing with kids', 'playing', 4.0, 'life'],
  ['dog-walk', 'Walking the dog', '', 3.0, 'life'],
  ['moving', 'Carrying or moving things', 'shifting, lifting boxes', 5.0, 'life'],
];

let built: Movement[] | null = null;
export function movements(): Movement[] {
  built ??= MOVEMENTS.map(([id, name, alt, met, group]) => ({ id, name, alt, met, group }));
  return built;
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

/** Activities matching every word typed, by name first, then other names. */
export function searchMovements(query: string, max = 12): Movement[] {
  const q = words(query);
  if (!q.length) return movements().slice(0, max);
  const scored: [Movement, number][] = [];
  for (const m of movements()) {
    const name = words(m.name), alt = words(m.alt);
    let score = 0, ok = true;
    for (const w of q) {
      const s = name.some(t => t === w) ? 3 : name.some(t => t.startsWith(w)) ? 2 : alt.some(t => t.startsWith(w)) ? 1 : 0;
      if (!s) ok = false;
      score += s;
    }
    if (ok) scored.push([m, score - name.length * 0.1]);
  }
  return scored.sort((a, b) => b[1] - a[1]).slice(0, max).map(([m]) => m);
}

/** Calories for `minutes` of an activity at a body weight. */
export function movementKcal(met: number, kg: number, minutes: number): number {
  if (!(met > 0) || !(kg > 0) || !(minutes > 0)) return 0;
  return Math.round((met * kg * minutes) / 60);
}

/** The running MET for a pace, between the Compendium's speed bands. */
export function runMet(km: number, seconds: number): number {
  const kmh = km / (seconds / 3600);
  const bands: [number, number][] = [[6.4, 6.0], [8, 8.3], [9.7, 9.8], [11.3, 11.0], [12.9, 11.8], [14.5, 12.8], [16.1, 14.5], [17.7, 16.0]];
  if (!(kmh > 0)) return 0;
  if (kmh <= bands[0][0]) return bands[0][1];
  for (let i = 1; i < bands.length; i++) {
    const [s0, m0] = bands[i - 1], [s1, m1] = bands[i];
    if (kmh <= s1) return +(m0 + ((m1 - m0) * (kmh - s0)) / (s1 - s0)).toFixed(1);
  }
  return bands[bands.length - 1][1];
}

/** Calories for a logged run, walk or ride from distance, time and weight. */
export function distanceKcal(kind: 'run' | 'walk' | 'cycle', km: number, seconds: number, kg: number): number {
  const kmh = km / (seconds / 3600);
  const met = kind === 'run' ? runMet(km, seconds) : kind === 'walk' ? (kmh >= 6 ? 5.0 : kmh >= 4.8 ? 3.5 : 3.0) : kmh >= 20 ? 8.0 : kmh >= 16 ? 6.8 : 4.0;
  return movementKcal(met, kg, seconds / 60);
}
