import type { ImageSourcePropType } from 'react-native';

export const C = {
  text: '#EDEFF2',
  textSoft: '#E6E9ED',
  body: '#C3C8CF',
  value: '#C9CED4',
  sub: '#9AA1AA',
  muted: '#8A9099',
  label: '#7A818B',
  dim: '#6E757F',
  faint: '#5C636C',
  ghost: '#4A5058',
  ink: '#050608',
  alert: '#FF5A3C',
  alertSoft: '#FF7A5F',
  warn: '#E8C27A',
  carbs: '#E8C27A',
  fat: '#B8A6FF',
  line: 'rgba(255,255,255,0.06)',
  line2: 'rgba(255,255,255,0.07)',
  line3: 'rgba(255,255,255,0.08)',
  card: 'rgba(255,255,255,0.03)',
  card2: 'rgba(255,255,255,0.02)',
};

export type ThemeId = 'zero' | 'shinobi' | 'voyager' | 'hero' | 'cursed' | 'slayer';

export interface Theme {
  id: ThemeId;
  name: string;
  kanji: string;
  vibe: string;
  acc: string;
  acc2: string;
  bg: string;
  motto: string;
}

export const THEMES: Theme[] = [
  { id: 'zero', name: 'REI Zero', kanji: '零', vibe: 'Ice cyan · cobalt', acc: '#9BE7F2', acc2: '#3A6FF2', bg: '#050608', motto: '自己規律プロトコル · 零' },
  { id: 'shinobi', name: 'Naruto', kanji: '忍', vibe: 'Blaze orange · night indigo', acc: '#FF7A1A', acc2: '#2B4CC9', bg: '#07060A', motto: '決して諦めない · 忍の道' },
  { id: 'voyager', name: 'One Piece', kanji: '航', vibe: 'Straw gold · captain red', acc: '#F5C542', acc2: '#D7263D', bg: '#06070A', motto: '自由への航海 · 夢を追え' },
  { id: 'hero', name: 'My Hero Academia', kanji: '英', vibe: 'Hero green · signal red', acc: '#2FE08A', acc2: '#E8463B', bg: '#050807', motto: '限界を超えろ · 英雄の道' },
  { id: 'cursed', name: 'Jujutsu Kaisen', kanji: '呪', vibe: 'Void blue · cursed violet', acc: '#6E8BFF', acc2: '#9B3CF5', bg: '#05040B', motto: '己を超えろ · 呪の領域' },
  { id: 'slayer', name: 'Demon Slayer', kanji: '刃', vibe: 'Water teal · flame crimson', acc: '#2FC4A5', acc2: '#E0303F', bg: '#070506', motto: '刃を研げ · 夜明けまで' },
];

export const ACCENT_EXTRAS = ['#FF6A4D', '#B8A6FF', '#9EF2B5', '#E9E3D3'];

export interface Emblem {
  id: string;
  source: ImageSourcePropType;
}

export const EMBLEMS: Partial<Record<ThemeId, Emblem[]>> = {
  shinobi: [
    { id: 'seed-naruto-1', source: require('../../assets/emblems/emblem-naruto-1.png') },
    { id: 'seed-naruto-2', source: require('../../assets/emblems/emblem-naruto-2.png') },
  ],
};

/** Emblem selected by default for a theme before the user picks one. */
export const DEFAULT_EMBLEM: Partial<Record<ThemeId, string>> = { shinobi: 'seed-naruto-1' };

export type FontKey = 'Geist' | 'Space Grotesk' | 'IBM Plex' | 'Zen Kaku';
export type Weight = 300 | 400 | 500 | 600;

const FAMILY: Record<FontKey | 'mono' | 'jp', Record<Weight, string>> = {
  Geist: { 300: 'Geist_300Light', 400: 'Geist_400Regular', 500: 'Geist_500Medium', 600: 'Geist_600SemiBold' },
  'Space Grotesk': { 300: 'SpaceGrotesk_300Light', 400: 'SpaceGrotesk_400Regular', 500: 'SpaceGrotesk_500Medium', 600: 'SpaceGrotesk_600SemiBold' },
  'IBM Plex': { 300: 'IBMPlexSans_300Light', 400: 'IBMPlexSans_400Regular', 500: 'IBMPlexSans_500Medium', 600: 'IBMPlexSans_600SemiBold' },
  'Zen Kaku': { 300: 'ZenKakuGothicNew_300Light', 400: 'ZenKakuGothicNew_400Regular', 500: 'ZenKakuGothicNew_500Medium', 600: 'ZenKakuGothicNew_500Medium' },
  mono: { 300: 'GeistMono_400Regular', 400: 'GeistMono_400Regular', 500: 'GeistMono_500Medium', 600: 'GeistMono_500Medium' },
  jp: { 300: 'ZenKakuGothicNew_400Regular', 400: 'ZenKakuGothicNew_400Regular', 500: 'ZenKakuGothicNew_500Medium', 600: 'ZenKakuGothicNew_500Medium' },
};

export const FONT_KEYS: FontKey[] = ['Geist', 'Space Grotesk', 'IBM Plex', 'Zen Kaku'];

export function fontFamily(face: FontKey | 'mono' | 'jp', weight: Weight = 400): string {
  return FAMILY[face][weight];
}

/** `#RRGGBB` + alpha (0..1) → `rgba(...)`. Stands in for CSS color-mix with transparent. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Mix `hex` into `base` at weight `w` (0..1). Stands in for CSS color-mix(in oklab, hex w, base). */
export function mix(hex: string, base: string, w: number): string {
  const p = (s: string) => {
    const n = parseInt(s.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = p(hex), b = p(base);
  const c = a.map((v, i) => Math.round(v * w + b[i] * (1 - w)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
