import type { FontKey, ThemeId } from './theme';

export type Role = 'rei' | 'user' | 'sys';

export interface Message {
  role: Role;
  text: string;
  time: string;
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

export interface Nutrition {
  steps: number;
  sleep: number;
  sleepL: string;
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
