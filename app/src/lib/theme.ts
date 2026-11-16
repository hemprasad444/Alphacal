// Sumi & Hanko: REI's design tokens. Night washi (a charcoal paper ground), sumi cards, dry-brush
// lines and rice-paper text, with one vermilion seal. Headings are set in a Mincho serif, body in
// Zen Kaku Gothic New, numbers in IBM Plex Mono, on a strict 8pt grid with generous space.
// Ground, paper and the seal red stay fixed in every world: the accent is the second colour and
// carries data, REI's verdict line and the active tab. Red belongs to REI and the seals only.
import type { FontKey, IconKey, ThemeId } from '@rei/shared';
import type { ImageSourcePropType, ViewStyle } from 'react-native';

/** The palette. The names are kept from the earlier systems so every screen keeps compiling. */
export const F = {
  /** Night washi: the ground. */
  arena: '#121110',
  /** Sumi: card fill. */
  canvas: '#1B1917',
  /** A card on a card, and pressed rows. */
  canvas2: '#24211E',
  /** Dry brush: tracks and quiet marks. */
  rope: '#35312C',
  /** Ash: second text (6.7:1 on a card). */
  smoke: '#A89F90',
  /** Rice paper: text, and the main button. */
  chalk: '#EDE6D8',
  /** Vermilion ink: red where red is text (5.2:1 on a card). REI and the seals only. */
  rival: '#E8604A',
  /** Vermilion: the seal fill. Never small text. */
  rivalDeep: '#D8432E',
  seal: '#D8432E',
  /** Carved white: the mark cut into a seal. */
  carved: '#F4EEE2',
  /** The border of a card. */
  line: '#2E2A25',
  /** A brush rule, and the border of a secondary control. */
  rule: '#4A443C',
  /** The tab bar. */
  bar: '#161412',
  /** A light sheet of washi (the seal unlock), and ink on it. */
  washi: '#EAE2D1',
  washiInk: '#1B1917',
  washiSub: '#5A5248',
  /** Tier names (text only: a seal is always red). */
  bronze: '#C77B3F',
  silver: '#C9D1D9',
  gold: '#F2C230',
  /** Locked artwork: decoration only, never text. */
  locked: '#3D3832',
  /** Kept for old callers. */
  cornerField: '#1B1917',
  rivalField: '#1F1613',
} as const;

/** Colours by role. */
export const C = {
  ...F,
  text: F.chalk,
  textSoft: '#E4DDCF',
  body: '#D9D2C4',
  value: '#D9D2C4',
  sub: F.smoke,
  muted: F.smoke,
  label: F.smoke,
  // Text greys meet WCAG AA (4.5:1) on the ground and on a card down to faint; ghost is for decoration and large text only.
  dim: '#A0978A',
  faint: '#978E81',
  ghost: '#5A544B',
  ink: F.arena,
  alert: F.rival,
  alertSoft: '#F08A76',
  warn: '#E8C27A',
  carbs: F.chalk,
  fat: F.smoke,
  /** Dividers between rows. */
  line: '#2A2622',
  line2: F.line,
  line3: F.rope,
  card: F.canvas,
  card2: '#161412',
};

/** Kept for old callers: nothing leans in this system. */
export const CUT = 0;
export const LEAN = 0;
/** Kept for old callers: there are no hard shadows. */
export const SHADOW = 0;
/** Smallest touch target (pt). */
export const HIT = 44;
/** The border of a card (pt). */
export const STROKE = 1;
/** The gap between blocks inside a section (pt). */
export const GUTTER = 12;
/** A seal sits a few degrees off square. Kept under this name for old callers. */
export const TILT = 4;

/** Spacing scale (pt): the 8pt grid, with 4 and 12 as half steps. */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32 } as const;
/** Corners: 3 for a tag, 4 for a control, 6 for a card. */
export const RADIUS = { none: 0, tag: 3, sm: 4, card: 6 } as const;

/** Kept for old callers. */
export const cutDx = (height: number, angle = CUT) => height * Math.tan((angle * Math.PI) / 180);

/** Kept for old callers: this system has no drop shadows, so it adds nothing. */
export const hard = (_color: string = F.chalk, _d: number = SHADOW): ViewStyle => ({});

/** A card: sumi fill inside a quiet line, softly rounded. Spread it into a View's style. */
export const panel = (stroke: string = F.line, width: number = STROKE): ViewStyle => ({ backgroundColor: F.canvas, borderWidth: width, borderColor: stroke, borderRadius: RADIUS.card });

export type { FontKey, ThemeId };

/** A world: it sets the accent. Ink, paper and pop never change. */
export interface Theme {
  id: ThemeId;
  name: string;
  /** The world's crest, drawn from REI's icon set. */
  icon: IconKey;
  vibe: string;
  /** The world's accent. */
  acc: string;
  /** A second tone, for the world's swatch and onboarding art only. */
  acc2: string;
  bg: string;
  motto: string;
}

export const THEMES: Theme[] = [
  { id: 'zero', name: 'Zero', icon: 'rei', vibe: 'Ice cyan ink', acc: '#9BE7F2', acc2: '#3A6FF2', bg: F.arena, motto: 'Zero excuses. Every day.' },
  { id: 'shinobi', name: 'Blaze', icon: 'flame', vibe: 'Blaze orange ink', acc: '#FF7A1A', acc2: '#2B4CC9', bg: F.arena, motto: 'Light it. One more day.' },
  { id: 'voyager', name: 'Voyager', icon: 'star', vibe: 'Gold ink', acc: '#F5C542', acc2: '#D7263D', bg: F.arena, motto: 'Long road. Steady pace.' },
  { id: 'hero', name: 'Hero', icon: 'fist', vibe: 'Signal green ink', acc: '#2FE08A', acc2: '#E8463B', bg: F.arena, motto: 'Show up. Do the work.' },
  { id: 'cursed', name: 'Hex', icon: 'eye', vibe: 'Void blue ink', acc: '#6E8BFF', acc2: '#9B3CF5', bg: F.arena, motto: 'Quiet mind. Heavy hands.' },
  { id: 'slayer', name: 'Tide', icon: 'wave', vibe: 'Deep teal ink', acc: '#2FC4A5', acc2: '#E0303F', bg: F.arena, motto: 'Slow breath. Sharp edge.' },
];

export const ACCENT_EXTRAS = ['#FF6A4D', '#B8A6FF', '#9EF2B5', '#E9E3D3'];

export interface Emblem {
  id: string;
  source: ImageSourcePropType;
}

// Original art for each world (generated, then cut out of black): no character, crest or logo from any series.
// Ids are stored in people's settings (settings.bgByTheme): a renamed one needs an entry in EMBLEM_ALIASES.
// (`cursed` and `slayer` are the internal ids of the Hex and Tide worlds.)
export const EMBLEMS: Partial<Record<ThemeId, Emblem[]>> = {
  shinobi: [
    { id: 'seed-blaze-1', source: require('../../assets/emblems/emblem-blaze-1.png') },
    { id: 'seed-blaze-2', source: require('../../assets/emblems/emblem-blaze-2.png') },
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
    { id: 'seed-cursed-1', source: require('../../assets/emblems/emblem-hex-1.png') },
    { id: 'seed-cursed-2', source: require('../../assets/emblems/emblem-hex-2.png') },
  ],
  slayer: [
    { id: 'seed-slayer-1', source: require('../../assets/emblems/emblem-tide-1.png') },
    { id: 'seed-slayer-2', source: require('../../assets/emblems/emblem-tide-2.png') },
  ],
};

/** Emblem selected by default for a theme before the user picks one. */
export const DEFAULT_EMBLEM: Partial<Record<ThemeId, string>> = {
  shinobi: 'seed-blaze-1',
  zero: 'seed-zero-1',
  voyager: 'seed-voyager-1',
  hero: 'seed-hero-1',
  cursed: 'seed-cursed-1',
  slayer: 'seed-slayer-1',
};

/** Ids saved by earlier versions, and the emblem that replaced each. */
const EMBLEM_ALIASES: Record<string, string> = { 'seed-naruto-1': 'seed-blaze-1', 'seed-naruto-2': 'seed-blaze-2' };

/**
 * The id of the emblem a world shows, from what's saved in `settings.bgByTheme`. Nothing saved:
 * the world's default. Saved as null: none (the user turned it off). An id from an earlier
 * version maps to its replacement, and an id nobody knows falls back to the world's default,
 * never to a blank background.
 */
export function emblemIdFor(theme: ThemeId, saved: Partial<Record<string, string | null>> | undefined): string | null {
  const items = EMBLEMS[theme] ?? [];
  const fallback = items.find(e => e.id === DEFAULT_EMBLEM[theme])?.id ?? items[0]?.id ?? null;
  if (!saved || !(theme in saved)) return fallback;
  const id = saved[theme];
  if (id == null) return null;
  const known = (x: string | undefined) => items.find(e => e.id === x)?.id;
  return known(id) ?? known(EMBLEM_ALIASES[id]) ?? fallback;
}

/** The emblem itself (see `emblemIdFor`). */
export function emblemFor(theme: ThemeId, saved: Partial<Record<string, string | null>> | undefined): Emblem | null {
  const id = emblemIdFor(theme, saved);
  return (EMBLEMS[theme] ?? []).find(e => e.id === id) ?? null;
}

/* ───────────────────────────── Colours that must stay apart from the accent ───────────────────────────── */

const lab = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047), y = f(r * 0.2126 + g * 0.7152 + b * 0.0722), z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

/** How different two `#RRGGBB` colours look (CIE76 ΔE): under ~40 they read as the same family side by side. */
export function colorDistance(a: string, b: string): number {
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

const APART = 40;
/** The first of `options` that reads as a different colour from `accent`; if none does, the furthest one. */
function apart(options: readonly string[], accent: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) return options[0];
  return options.find(c => colorDistance(c, accent) >= APART) ?? [...options].sort((a, b) => colorDistance(b, accent) - colorDistance(a, accent))[0];
}

export type MedalTier = 'bronze' | 'silver' | 'gold';
// Each tier's usual colour first, then stand-ins for worlds whose accent sits on top of it
// (bronze beside Blaze orange, gold in the gold Voyager world). All pass 4.5:1 on canvas.
const MEDAL_OPTIONS: Record<MedalTier, readonly string[]> = {
  bronze: [F.bronze, '#B8805C', '#B08D74'],
  silver: [F.silver],
  gold: [F.gold, '#FFE9A3'],
};
const WARN_OPTIONS = ['#E8C27A', '#A9B8C8', '#B8A6FF'] as const;

/** Medal colours for a world: the usual bronze, silver and gold, swapped for a stand-in where the accent would be mistaken for one. */
export const medalColors = (accent: string): Record<MedalTier, string> => ({
  bronze: apart(MEDAL_OPTIONS.bronze, accent),
  silver: apart(MEDAL_OPTIONS.silver, accent),
  gold: apart(MEDAL_OPTIONS.gold, accent),
});

/** The "watch out" colour for a world (sand; slate or lilac where the accent is already sand or gold). Never the seal red. */
export const warnColor = (accent: string): string => apart(WARN_OPTIONS, accent);

export type Weight = 300 | 400 | 500 | 600 | 700;

/**
 * Typefaces:
 * - `display`: Shippori Mincho B1 800. Titles and the big numbers. `heading` is its 700 (section
 *   headings, buttons) and `voice` its 500 (REI's lines).
 * - `body`: Zen Kaku Gothic New 400 to 700. Everything you read.
 * - `label` / `labelItalic`: Zen Kaku Gothic New 500 / 700. Small labels; the bold one for names of things.
 * - `mono` / `num`: IBM Plex Mono 400 / 500. Meta lines and numbers.
 */
export type Face = 'display' | 'heading' | 'voice' | 'label' | 'labelItalic' | 'body' | 'num';

/** Sizes written for the first, condensed display face are drawn at this share in the Mincho. */
export const DISPLAY_SCALE = 0.66;
/** The smallest display text drawn (pt). */
export const DISPLAY_MIN = 15;
/** The smallest body or label text drawn (pt). */
export const TEXT_MIN = 12;
/** Display size in points for a size written in the old scale. */
export const displaySize = (size: number) => Math.max(DISPLAY_MIN, Math.round(size * DISPLAY_SCALE * 10) / 10);

const BODY: Record<Weight, string> = { 300: 'ZenKakuGothicNew_400Regular', 400: 'ZenKakuGothicNew_400Regular', 500: 'ZenKakuGothicNew_500Medium', 600: 'ZenKakuGothicNew_700Bold', 700: 'ZenKakuGothicNew_700Bold' };
const LABEL: Record<Weight, string> = { 300: 'ZenKakuGothicNew_500Medium', 400: 'ZenKakuGothicNew_500Medium', 500: 'ZenKakuGothicNew_500Medium', 600: 'ZenKakuGothicNew_700Bold', 700: 'ZenKakuGothicNew_700Bold' };
const LABEL_HEAVY = 'ZenKakuGothicNew_700Bold';
const MONO: Record<Weight, string> = { 300: 'IBMPlexMono_400Regular', 400: 'IBMPlexMono_400Regular', 500: 'IBMPlexMono_500Medium', 600: 'IBMPlexMono_500Medium', 700: 'IBMPlexMono_500Medium' };
const DISPLAY = 'ShipporiMinchoB1_800ExtraBold';
const HEADING = 'ShipporiMinchoB1_700Bold';
const VOICE = 'ShipporiMinchoB1_500Medium';

/**
 * Font file for a face and weight. The app has one type system, so the old faces still work and
 * land on it: any body font key (`Geist`, ...) and `jp` give Zen Kaku Gothic New, and
 * `labelItalic` is the bold label (nothing is italic).
 */
export function fontFamily(face: FontKey | Face | 'mono' | 'jp', weight: Weight = 400): string {
  if (face === 'display') return DISPLAY;
  if (face === 'heading') return HEADING;
  if (face === 'voice') return weight >= 600 ? HEADING : VOICE;
  if (face === 'label') return LABEL[weight];
  if (face === 'labelItalic') return LABEL_HEAVY;
  if (face === 'mono') return MONO[weight];
  if (face === 'num') return MONO[500];
  return BODY[weight];
}

const KEEP_CAPS = new Set(['REI', 'XP', 'PR', 'PB', 'BMI', 'RPE', 'AM', 'PM', 'ID', 'OK', 'AI', 'KO', 'TDEE', 'BMR', 'FAQ', 'QR', 'DB', 'HIIT', 'RDL', 'OHP', 'UK', 'US', 'I', 'RM', 'PPL', 'BCAA', 'TV', 'GPS', 'PDF', 'URL', 'API', 'BW', 'EMOM', 'AMRAP', 'CSV', 'II', 'III', 'IV', 'VI', 'VII', 'ETA']);
const LOWER_UNITS = new Set(['KCAL', 'KG', 'LB', 'LBS', 'KM', 'MIN', 'MINS', 'G', 'MG', 'ML', 'CM', 'HR', 'HRS', 'SEC', 'REPS', 'SETS']);
const TITLE_WORDS = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']);

/**
 * Quiet a label written in capitals: "HIT LOG" becomes "Hit log", "SUN 15 NOV · 2,100 KCAL"
 * becomes "Sun 15 Nov · 2,100 kcal". Text that already has lower-case letters is left alone, so
 * names and sentences pass through. The system speaks in sentence case; this catches old callers.
 */
export function soften(text: string): string {
  if (!text || /[a-z]/.test(text) || !/[A-Z]{2}/.test(text)) return text;
  let first = true;
  return text.replace(/[A-Z][A-Z']*/g, word => {
    const lead = first;
    first = false;
    if (KEEP_CAPS.has(word)) return word;
    if (LOWER_UNITS.has(word)) return word.toLowerCase();
    if (TITLE_WORDS.has(word) || lead) return word.charAt(0) + word.slice(1).toLowerCase();
    return word.toLowerCase();
  }).replace(/([.!?]\s+)([a-z])/g, (_, gap: string, ch: string) => gap + ch.toUpperCase());
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

/** Ink or rice paper, whichever reads better on `bg` (accent overrides can be pale or dark). */
export const onColor = (bg: string): string => (contrast(F.arena, bg) >= contrast(F.chalk, bg) ? F.arena : F.chalk);
