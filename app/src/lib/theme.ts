// Manga Panel: REI's design tokens. Every block is an ink panel with a paper-coloured stroke on a
// 12pt gutter grid; hero panels get screentone, an accent drop shadow and a tilt of at most 1°.
// Ink, paper and pop stay fixed in every world: the accent is the only colour that changes.
import type { FontKey, IconKey, ThemeId } from '@rei/shared';
import type { ImageSourcePropType, ViewStyle } from 'react-native';

/** The palette. The names are kept from the earlier system so every screen keeps compiling. */
export const F = {
  /** Ink: the ground. */
  arena: '#0E0E10',
  /** Panel fill. */
  canvas: '#17171B',
  /** A panel on a panel, and pressed rows. */
  canvas2: '#222228',
  /** Quiet lines: tracks, dividers inside a panel, the border of a secondary control. */
  rope: '#55535A',
  /** Tone: second text (8.6:1 on canvas). */
  smoke: '#B8B2A7',
  /** Paper: text, and the stroke around every panel. */
  chalk: '#F4F1EA',
  /** Pop: alerts, the rival, the GET! stamp. */
  rival: '#FF4D6D',
  rivalDeep: '#C7244F',
  /** Rarity frames. */
  bronze: '#C77B3F',
  silver: '#C9D1D9',
  gold: '#F2C230',
  /** Locked artwork: decoration only, never text. */
  locked: '#34343C',
  /** The two fields behind a versus split. */
  cornerField: '#17171B',
  rivalField: '#1C0E15',
} as const;

/** Colours by role. */
export const C = {
  ...F,
  text: F.chalk,
  textSoft: '#EDE9E0',
  body: '#DCD7CD',
  value: '#DCD7CD',
  sub: F.smoke,
  muted: F.smoke,
  label: F.smoke,
  // Text greys meet WCAG AA (4.5:1) on ink and panel down to faint; ghost is for decoration and large text only.
  dim: '#A6A095',
  faint: '#9A948A',
  ghost: '#5E5B56',
  ink: F.arena,
  alert: F.rival,
  alertSoft: '#FF7A92',
  warn: '#E8C27A',
  carbs: '#E8C27A',
  fat: '#B8A6FF',
  line: '#2C2C33',
  line2: '#38383F',
  line3: F.rope,
  card: F.canvas,
  card2: '#121215',
};

/** The lean of a tag (degrees): section tags, the current tab, pips. The only slanted edge left. */
export const CUT = 10;
/** Kept for old callers: display type stands upright now. */
export const LEAN = 0;
/** Hard shadow offset (pt), down and to the right, no blur. */
export const SHADOW = 4;
/** Smallest touch target (pt). */
export const HIT = 44;
/** The paper stroke around a panel (pt). Controls inside a panel use 2. */
export const STROKE = 3;
/** The gutter between panels (pt). */
export const GUTTER = 12;
/** The most a hero panel may tilt (degrees). */
export const TILT = 1;

/** Spacing scale (pt). */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32 } as const;
/** Corners are square. `sm` is for the rare soft edge (photos, inputs). */
export const RADIUS = { none: 0, sm: 2 } as const;

/** How far a leaning edge travels sideways over `height` points. */
export const cutDx = (height: number, angle = CUT) => height * Math.tan((angle * Math.PI) / 180);

/** A hard offset shadow for a rectangle: no blur, full colour. */
export const hard = (color: string = F.chalk, d: number = SHADOW): ViewStyle => ({ boxShadow: `${d}px ${d}px 0px ${color}` });

/** An ink panel: panel fill inside a paper stroke. Spread it into a View's style. */
export const panel = (stroke: string = F.chalk, width: number = STROKE): ViewStyle => ({ backgroundColor: F.canvas, borderWidth: width, borderColor: stroke });

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
  { id: 'zero', name: 'Zero', icon: 'rei', vibe: 'Ice cyan ink', acc: '#9BE7F2', acc2: '#3A6FF2', bg: F.arena, motto: 'ZERO EXCUSES · EVERY ROUND' },
  { id: 'shinobi', name: 'Blaze', icon: 'flame', vibe: 'Blaze orange ink', acc: '#FF7A1A', acc2: '#2B4CC9', bg: F.arena, motto: 'LIGHT IT UP · ONE MORE ROUND' },
  { id: 'voyager', name: 'Voyager', icon: 'star', vibe: 'Gold ink', acc: '#F5C542', acc2: '#D7263D', bg: F.arena, motto: 'LONG ROAD · STEADY PACE' },
  { id: 'hero', name: 'Hero', icon: 'fist', vibe: 'Signal green ink', acc: '#2FE08A', acc2: '#E8463B', bg: F.arena, motto: 'SHOW UP · DO THE WORK' },
  { id: 'cursed', name: 'Hex', icon: 'eye', vibe: 'Void blue ink', acc: '#6E8BFF', acc2: '#9B3CF5', bg: F.arena, motto: 'QUIET MIND · HEAVY HANDS' },
  { id: 'slayer', name: 'Tide', icon: 'wave', vibe: 'Deep teal ink', acc: '#2FC4A5', acc2: '#E0303F', bg: F.arena, motto: 'SLOW BREATH · SHARP EDGE' },
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
const WARN_OPTIONS = ['#E8C27A', '#FF9B54', '#B8A6FF'] as const;

/** Medal colours for a world: the usual bronze, silver and gold, swapped for a stand-in where the accent would be mistaken for one. */
export const medalColors = (accent: string): Record<MedalTier, string> => ({
  bronze: apart(MEDAL_OPTIONS.bronze, accent),
  silver: apart(MEDAL_OPTIONS.silver, accent),
  gold: apart(MEDAL_OPTIONS.gold, accent),
});

/** The "watch out" colour for a world (sand; tangerine or lilac where the accent is already sand or gold). Never the rival red. */
export const warnColor = (accent: string): string => apart(WARN_OPTIONS, accent);

export type Weight = 300 | 400 | 500 | 600 | 700;

/**
 * Typefaces:
 * - `display`: Dela Gothic One. Numbers, titles, the primary action. Wide and heavy: `Txt` sets it at
 *   `DISPLAY_SCALE` of the asked size, so sizes written for the old condensed face keep their width.
 * - `label` / `labelItalic`: Zen Maru Gothic 700 / 900. Labels and meta; the heavy one for names of things.
 * - `body`: Zen Maru Gothic 500 to 900. Everything you read.
 */
export type Face = 'display' | 'label' | 'labelItalic' | 'body';

/** Dela Gothic One is about 1.8 times as wide as the condensed display face it replaced. */
export const DISPLAY_SCALE = 0.58;
/** The smallest display text drawn (pt). */
export const DISPLAY_MIN = 13;
/** The smallest body or label text drawn (pt). */
export const TEXT_MIN = 12;
/** Display size in points for a size written in the old scale. */
export const displaySize = (size: number) => Math.max(DISPLAY_MIN, Math.round(size * DISPLAY_SCALE * 10) / 10);

const BODY: Record<Weight, string> = { 300: 'ZenMaruGothic_500Medium', 400: 'ZenMaruGothic_500Medium', 500: 'ZenMaruGothic_700Bold', 600: 'ZenMaruGothic_700Bold', 700: 'ZenMaruGothic_900Black' };
const LABEL: Record<Weight, string> = { 300: 'ZenMaruGothic_700Bold', 400: 'ZenMaruGothic_700Bold', 500: 'ZenMaruGothic_700Bold', 600: 'ZenMaruGothic_700Bold', 700: 'ZenMaruGothic_900Black' };
const LABEL_HEAVY = 'ZenMaruGothic_900Black';
const DISPLAY = 'DelaGothicOne_400Regular';

/**
 * Font file for a face and weight. The app has one type system, so the old faces still work and
 * land on it: any body font key (`Geist`, ...) and `jp` give Zen Maru Gothic (500 is its lightest
 * weight here), `mono` gives the label weight and `labelItalic` the heavy label (nothing is italic).
 */
export function fontFamily(face: FontKey | Face | 'mono' | 'jp', weight: Weight = 400): string {
  if (face === 'display') return DISPLAY;
  if (face === 'label' || face === 'mono') return LABEL[weight];
  if (face === 'labelItalic') return LABEL_HEAVY;
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

/** Ink or paper, whichever reads better on `bg` (accent overrides can be pale or dark). */
export const onColor = (bg: string): string => (contrast(F.arena, bg) >= contrast(F.chalk, bg) ? F.arena : F.chalk);
