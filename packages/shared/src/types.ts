export type ThemeId = 'zero' | 'shinobi' | 'voyager' | 'hero' | 'cursed' | 'slayer';
export type FontKey = 'Geist' | 'Space Grotesk' | 'IBM Plex' | 'Zen Kaku';

export type Role = 'rei' | 'user' | 'sys';

export interface Message {
  /** Stable id, also the Firestore document id once synced. */
  id?: string;
  role: Role;
  text: string;
  time: string;
  /** Epoch ms; orders messages across devices. */
  createdAt?: number;
  alert?: boolean;
}

export interface Meal {
  time: string;
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export interface Profile {
  goal: string;
  deadline: string;
  weight: string;
  targetWeight: string;
  bf: string;
  targetBf: string;
  height: string;
  age: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  steps: string;
  sleep: string;
  sessions: string;
}

export type ProfileKey = keyof Profile;

export type Scenario = 'Slipping week' | 'Strong week';
export type Tone = 'Tough love' | 'Coach';
export type Avatar = 'Character in chat' | 'Core only';
export type BgStrength = 'Subtle' | 'Medium' | 'Bold';
export type EmblemSize = 'S' | 'M' | 'L';
export type EmblemPos = 'Top' | 'Center' | 'Bottom';

export interface Settings {
  theme: ThemeId;
  accent: string | null;
  font: FontKey;
  textSize: number;
  hud: boolean;
  fx: boolean;
  speak: boolean;
  nudge: boolean;
  tone: Tone;
  avatar: Avatar;
  scenario: Scenario;
  bgStrength: BgStrength;
  emblemSize: EmblemSize;
  emblemPos: EmblemPos;
  bgByTheme: Partial<Record<ThemeId, string | null>>;
}

/** Steps and sleep for today; null until a source (demo story or Apple Health) provides them. */
export interface Activity {
  steps: number | null;
  /** Hours. */
  sleep: number | null;
  sleepL: string;
}

export interface Nutrition extends Activity {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Exercise {
  name: string;
  target: string;
  last: string;
  reps: number[];
}

/** One calendar day, stored at users/{uid}/days/{yyyy-mm-dd}. */
export interface DayDoc {
  meals: Meal[];
  sessionDone: boolean;
  loggedMin: number;
  steps: number | null;
  sleepMin: number | null;
}

export interface WeighIn {
  /** yyyy-mm-dd */
  date: string;
  kg: number;
}

/**
 * Where past days come from: the demo story picked in Settings, or real day records
 * keyed by date (true when that day's session was completed).
 */
export type History = { kind: 'demo'; scenario: Scenario } | { kind: 'real'; startedOn: string; sessions: Record<string, boolean> };
