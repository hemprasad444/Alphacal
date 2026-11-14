// Fight Night: REI's design tokens. Every day is a match, you vs. your excuses, so the app is a
// fight HUD. Flat colour, one cut angle, hard offset shadows, two lights (your corner vs. the far corner).
import type { FontKey, IconKey, ThemeId } from '@rei/shared';
import type { ImageSourcePropType, ViewStyle } from 'react-native';

/** The Fight Night palette. Only `corner` (the world accent) changes between worlds. */
export const F = {
  /** Ground. */
  arena: '#0B0C10',
  /** Rows and panels. */
  canvas: '#171A21',
  /** A panel on a panel, and pressed rows. */
  canvas2: '#1F232C',
  /** Lines, tracks and borders. */
  rope: '#3A404D',
  /** Quiet text (7.7:1 on canvas). */
  smoke: '#A7ADBA',
  /** Text, and the hard shadow under your-corner shapes. */
  chalk: '#F4F1EA',
  /** The far corner: Excuses and nothing else. */
  rival: '#FF3B6B',
  rivalDeep: '#C7244F',
  /** Medal tiers. */
  bronze: '#C98A4B',
  silver: '#C9D3DE',
  gold: '#F5C542',
  /** Locked artwork: decoration only, never text. */
  locked: '#4A5160',
  /** The two fields behind a versus split. */
  cornerField: '#141821',
  rivalField: '#1C0E15',
} as const;

/**
 * Colours by role. The original keys are kept (remapped to the Fight Night palette) so every
 * screen keeps compiling; the palette names are here too (`C.chalk`, `C.rope`, …).
 */
export const C = {
  ...F,
  text: F.chalk,
  textSoft: '#E9E6DF',
  body: '#CDD0D7',
  value: '#CDD0D7',
  sub: F.smoke,
  muted: F.smoke,
  label: F.smoke,
  // Text greys meet WCAG AA (4.5:1) on arena and canvas down to faint; ghost is for decoration and large text only.
  dim: '#959CAA',
  faint: '#8B92A0',
  ghost: '#5A6070',
  ink: F.arena,
  alert: F.rival,
  alertSoft: '#FF6B8E',
  warn: '#E8C27A',
  carbs: '#E8C27A',
  fat: '#B8A6FF',
  line: '#262B35',
  line2: '#2E3440',
  line3: F.rope,
  card: F.canvas,
  card2: '#111319',
};

/** The one cut angle, in degrees: every slanted edge in the app leans this much. */
export const CUT = 18;
/** Display type leans this much (degrees). */
export const LEAN = 10;
/** Hard shadow offset (pt), down and to the right, no blur. */
export const SHADOW = 4;
/** Smallest touch target (pt). */
export const HIT = 44;

/** Spacing scale (pt). */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32 } as const;
/** Corners are square. `sm` is for the rare soft edge (photos, inputs). */
export const RADIUS = { none: 0, sm: 2 } as const;

/** How far a cut edge travels sideways over `height` points. */
export const cutDx = (height: number, angle = CUT) => height * Math.tan((angle * Math.PI) / 180);

/** A hard offset shadow for a rectangle: no blur, full colour. (Slanted shapes draw their own; see CutBox.) */
export const hard = (color: string = F.chalk, d: number = SHADOW): ViewStyle => ({ boxShadow: `${d}px ${d}px 0px ${color}` });

export type { FontKey, ThemeId };

/** A world: it sets the corner colour. The far corner (rival) never changes. */
export interface Theme {
  id: ThemeId;
  name: string;
  /** The world's crest, drawn from REI's icon set. */
  icon: IconKey;
  vibe: string;
  /** Your corner. */
  acc: string;
  /** A second tone, for the world's swatch and onboarding art only. */
  acc2: string;
  bg: string;
  motto: string;
}

export const THEMES: Theme[] = [
  { id: 'zero', name: 'Zero', icon: 'rei', vibe: 'Ice cyan corner', acc: '#9BE7F2', acc2: '#3A6FF2', bg: F.arena, motto: 'ZERO EXCUSES · EVERY ROUND' },
  { id: 'shinobi', name: 'Blaze', icon: 'flame', vibe: 'Blaze orange corner', acc: '#FF7A1A', acc2: '#2B4CC9', bg: F.arena, motto: 'NEVER BACK DOWN · ONE MORE ROUND' },
  { id: 'voyager', name: 'Voyager', icon: 'star', vibe: 'Gold corner', acc: '#F5C542', acc2: '#D7263D', bg: F.arena, motto: 'SET SAIL · CHASE THE HORIZON' },
  { id: 'hero', name: 'Hero', icon: 'fist', vibe: 'Signal green corner', acc: '#2FE08A', acc2: '#E8463B', bg: F.arena, motto: 'STAND TALL · GO FURTHER' },
  { id: 'cursed', name: 'Hex', icon: 'eye', vibe: 'Void blue corner', acc: '#6E8BFF', acc2: '#9B3CF5', bg: F.arena, motto: 'SURPASS YOURSELF · BREAK THE LIMIT' },
  { id: 'slayer', name: 'Tide', icon: 'wave', vibe: 'Deep teal corner', acc: '#2FC4A5', acc2: '#E0303F', bg: F.arena, motto: 'SHARPEN UP · UNTIL DAWN' },
];

export const ACCENT_EXTRAS = ['#FF6A4D', '#B8A6FF', '#9EF2B5', '#E9E3D3'];

export interface Emblem {
  id: string;
  source: ImageSourcePropType;
}

// Original art for each world (generated, then cut out of black): no character, crest or logo from any series.
// Ids are stored in people's settings, so they stay as they are.
export const EMBLEMS: Partial<Record<ThemeId, Emblem[]>> = {
  shinobi: [
    { id: 'seed-naruto-1', source: require('../../assets/emblems/emblem-naruto-1.png') },
    { id: 'seed-naruto-2', source: require('../../assets/emblems/emblem-naruto-2.png') },
  ],
  zero: [
    { id: 'seed-zero-1', source: require('../../assets/emblems/emblem-zero-1.png') },
    { id: 'seed-zero-2', source: require('../../assets/emblems/emblem-zero-2.png') },
  ],
  voyager: [
    { id: 'seed-voyager-1', source: require('../../assets/emblems/emblem-voyager-1.png') },
    { id: 'seed-voyager-2', source: require('../../assets/emblems/emblem-voyager-2.png') },
  ],
  hero: [
    { id: 'seed-hero-1', source: require('../../assets/emblems/emblem-hero-1.png') },
    { id: 'seed-hero-2', source: require('../../assets/emblems/emblem-hero-2.png') },
  ],
  cursed: [
    { id: 'seed-cursed-1', source: require('../../assets/emblems/emblem-cursed-1.png') },
    { id: 'seed-cursed-2', source: require('../../assets/emblems/emblem-cursed-2.png') },
  ],
  slayer: [
    { id: 'seed-slayer-1', source: require('../../assets/emblems/emblem-slayer-1.png') },
    { id: 'seed-slayer-2', source: require('../../assets/emblems/emblem-slayer-2.png') },
  ],
};

/** Emblem selected by default for a theme before the user picks one. */
export const DEFAULT_EMBLEM: Partial<Record<ThemeId, string>> = {
  shinobi: 'seed-naruto-1',
  zero: 'seed-zero-1',
  voyager: 'seed-voyager-1',
  hero: 'seed-hero-1',
  cursed: 'seed-cursed-1',
  slayer: 'seed-slayer-1',
};

export type Weight = 300 | 400 | 500 | 600 | 700;

/**
 * Typefaces:
 * - `display`: Anton. HUD numbers, titles, the primary action. Set it leaning (see `LEAN`).
 * - `label` / `labelItalic`: Barlow Condensed 600/700. Uppercase labels and meta; italic for section names.
 * - `body`: Barlow 500–700. Everything you read.
 */
export type Face = 'display' | 'label' | 'labelItalic' | 'body';

const BODY: Record<Weight, string> = { 300: 'Barlow_400Regular', 400: 'Barlow_500Medium', 500: 'Barlow_600SemiBold', 600: 'Barlow_700Bold', 700: 'Barlow_700Bold' };
const LABEL: Record<Weight, string> = { 300: 'BarlowCondensed_600SemiBold', 400: 'BarlowCondensed_600SemiBold', 500: 'BarlowCondensed_700Bold', 600: 'BarlowCondensed_700Bold', 700: 'BarlowCondensed_700Bold' };
const LABEL_ITALIC: Record<Weight, string> = { 300: 'BarlowCondensed_600SemiBold_Italic', 400: 'BarlowCondensed_600SemiBold_Italic', 500: 'BarlowCondensed_700Bold_Italic', 600: 'BarlowCondensed_700Bold_Italic', 700: 'BarlowCondensed_700Bold_Italic' };
const DISPLAY: Record<Weight, string> = { 300: 'Anton_400Regular', 400: 'Anton_400Regular', 500: 'Anton_400Regular', 600: 'Anton_400Regular', 700: 'Anton_400Regular' };

/**
 * Font file for a face and weight. The app has one type system now, so the old faces still work
 * and land on it: any body font key (`Geist`, …) and `jp` give Barlow one step heavier (its
 * 500–700 is the design's body range), and `mono` gives the condensed label face.
 */
export function fontFamily(face: FontKey | Face | 'mono' | 'jp', weight: Weight = 400): string {
  if (face === 'display') return DISPLAY[weight];
  if (face === 'label' || face === 'mono') return LABEL[weight];
  if (face === 'labelItalic') return LABEL_ITALIC[weight];
  return BODY[weight];
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

/** WCAG contrast ratio between two `#RRGGBB` colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Ink or chalk, whichever reads better on `bg` (accent overrides can be pale or dark). */
export const onColor = (bg: string): string => (contrast(F.arena, bg) >= contrast(F.chalk, bg) ? F.arena : F.chalk);
