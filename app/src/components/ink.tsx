// Manga Panel drawing parts: screentone, speed lines, the ink panel, the leaning tag, REI's
// avatar and the jagged speech bubble. Everything is plain views or react-native-svg, so it draws
// the same on iOS as on the web (no blend modes, no CSS clip-path, no backdrop filters).
import { useId, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Polygon, Rect } from 'react-native-svg';
import { SkewBox, useSize } from './cut';
import { Icon, type IconKey } from './icons';
import { Tap, Txt } from './ui';
import { F, onColor, SHADOW, STROKE, TILT } from '../lib/theme';

/** A small repeatable random source, so decoration is the same on every render. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const svgId = (raw: string) => 'ink' + raw.replace(/[^a-zA-Z0-9]/g, '');

/** The halftone pattern itself, for use inside your own `<Svg>`: put it in `<Defs>` and fill with `url(#id)`. */
export function HalftoneDef({ id, color = F.chalk, opacity = 0.2, size = 7, dot = 1.1 }: { id: string; color?: string; opacity?: number; size?: number; dot?: number }) {
  return (
    <Pattern id={id} x={0} y={0} width={size} height={size} patternUnits="userSpaceOnUse">
      <Circle cx={size / 2} cy={size / 2} r={dot} fill={color} fillOpacity={opacity} />
    </Pattern>
  );
}

/**
 * Screentone: a field of halftone dots that fills its parent (a panel fill). Decoration only;
 * keep it under 0.25 opacity when text sits on it.
 */
export function Halftone({ color = F.chalk, opacity = 0.16, size = 7, dot = 1.1, style }: { color?: string; opacity?: number; size?: number; dot?: number; style?: StyleProp<ViewStyle> }) {
  const id = svgId(useId());
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <HalftoneDef id={id} color={color} opacity={opacity} size={size} dot={dot} />
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** SVG path of focus lines: thin wedges pointing at (0,0) from `outer`, stopping around `inner`. `spread` scales how wide each wedge opens. */
export function speedPath(count = 30, inner = 40, outer = 170, seed = 7, spread = 1): string {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = ((i + r() * 0.7) / count) * Math.PI * 2, half = ((0.5 + r() * 1.7) * spread * Math.PI) / 180, tip = inner * (0.75 + r() * 0.6);
    const p = (ang: number, rad: number) => `${(Math.cos(ang) * rad).toFixed(1)} ${(Math.sin(ang) * rad).toFixed(1)}`;
    d += `M${p(a - half, outer)}L${p(a + half, outer)}L${p(a, tip)}Z`;
  }
  return d;
}

/**
 * Speed lines behind a hero number: focus lines radiating from a point (`cx`,`cy` as fractions
 * of the box). Fills its parent; the parent should clip (`overflow: 'hidden'`).
 */
export function SpeedLines({ color, opacity = 0.45, count = 30, inner = 0.42, cx = 0.5, cy = 0.5, seed = 7, style }: { color: string; opacity?: number; count?: number; inner?: number; cx?: number; cy?: number; seed?: number; style?: StyleProp<ViewStyle> }) {
  const d = useMemo(() => speedPath(count, inner * 100, 260, seed), [count, inner, seed]);
  const x = -cx * 200, y = -cy * 200;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox={`${x} ${y} 200 200`} preserveAspectRatio="xMidYMid slice">
        <Path d={d} fill={color} fillOpacity={opacity} />
      </Svg>
    </View>
  );
}

export interface InkPanelProps {
  children?: ReactNode;
  /** Screentone behind the content (hero panels). */
  tone?: boolean;
  /** Speed lines behind the content, in this colour. */
  speed?: string;
  /** Hard drop shadow in this colour (hero panels: the accent). */
  shadow?: string;
  /** Tilt in degrees, clamped to ±1. Hero panels only. */
  tilt?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Inner padding (pt). */
  pad?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The ink panel: panel fill inside a 3pt paper stroke. Every block in the app is one of these.
 * A hero panel adds `tone`, an accent `shadow` and a `tilt` of at most 1°.
 */
export function InkPanel({ children, tone, speed, shadow, tilt = 0, fill = F.canvas, stroke = F.chalk, strokeWidth = STROKE, pad = 12, onPress, accessibilityLabel, style }: InkPanelProps) {
  const deg = Math.max(-TILT, Math.min(TILT, tilt));
  const box = (
    <View style={[{ backgroundColor: fill, borderWidth: strokeWidth, borderColor: stroke, padding: pad }, shadow ? { boxShadow: `${SHADOW}px ${SHADOW}px 0px ${shadow}` } : null, deg ? null : style]}>
      {tone || speed ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
          {speed ? <SpeedLines color={speed} cx={0.78} cy={0.3} /> : null}
          {tone ? <Halftone /> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
  // A tilted panel is drawn into one layer with a clear margin around it, so iOS smooths its edges
  // (a rotated border is jagged otherwise). The margin is taken back so the layout doesn't move.
  const m = 1, far = shadow ? SHADOW + m : m;
  const body = deg ? (
    <View style={[style, { marginLeft: -m, marginTop: -m, marginRight: -far, marginBottom: -far }]}>
      <View shouldRasterizeIOS renderToHardwareTextureAndroid style={{ paddingLeft: m, paddingTop: m, paddingRight: far, paddingBottom: far, transform: [{ rotate: `${deg}deg` }] }}>{box}</View>
    </View>
  ) : box;
  return onPress ? <Tap onPress={onPress} accessibilityLabel={accessibilityLabel}>{body}</Tap> : body;
}

/**
 * The leaning accent tag that opens a heading. `text` is a short English word or number; `icon`
 * draws a glyph instead; with neither it is a plain marker.
 */
export function SkewTag({ text, icon, color, size = 'md', style }: { text?: string; icon?: IconKey; color: string; size?: 'lg' | 'md'; style?: StyleProp<ViewStyle> }) {
  const ink = onColor(color), h = size === 'lg' ? 28 : 20;
  return (
    <SkewBox fill={color} style={[{ height: h, minWidth: size === 'lg' ? 36 : 26, paddingHorizontal: text ? 9 : 6, alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* In a View: on the web a bare svg would paint under the tag's own drawing. */}
      {icon ? <View><Icon name={icon} size={size === 'lg' ? 18 : 13} color={ink} tint={0} strokeWidth={2.4} /></View> : null}
      {text && !icon ? <Txt face="display" exact size={size === 'lg' ? 13 : 12} lh={1.25} color={ink} numberOfLines={1}>{text.toUpperCase()}</Txt> : null}
    </SkewBox>
  );
}

/** REI's avatar: a round ink-and-accent face with spiked hair and a hard stare. An original mark, no series' character. */
export function ReiAvatar({ size = 52, accent }: { size?: number; accent: string }) {
  const ink = onColor(accent);
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Circle cx={26} cy={26} r={24.5} fill={accent} stroke={F.chalk} strokeWidth={3} />
      {/* hair */}
      <Path d="M5 16C9 7 17 2.5 26 2.5S43 7 47 16l-1 8-7-8-5 9-7-11-6 10-6-8-8 9z" fill={ink} />
      {/* brows, pulled down */}
      <Path d="M15 30l8 2.4M37 30l-8 2.4" stroke={ink} strokeWidth={3.4} strokeLinecap="round" fill="none" />
      {/* mouth */}
      <Path d="M22 40.5h8" stroke={ink} strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** Points of a jagged burst around a `w`×`h` box, with a tail on the left at `tailY` when given. */
function burstPoints(w: number, h: number, tailY: number | null, seed: number): string {
  const r = rng(seed), out = 2, deep = 11;
  const pts: [number, number][] = [];
  const edge = (len: number, place: (t: number, depth: number) => [number, number]) => {
    const n = Math.max(2, Math.round(len / 30)) * 2;
    for (let i = 0; i < n; i++) {
      // Spikes alternate out and in; each is nudged so the outline looks drawn, not stamped.
      const t = (i + (i ? (r() - 0.5) * 0.5 : 0)) / n;
      pts.push(place(t, i % 2 ? deep - r() * 3 : out + r() * 3));
    }
  };
  edge(w, (t, d) => [t * w, d]);
  edge(h, (t, d) => [w - d, t * h]);
  edge(w, (t, d) => [w - t * w, h - d]);
  const start = pts.length;
  edge(h, (t, d) => [d, h - t * h]);
  if (tailY !== null) {
    // The tail: the left-edge spike nearest `tailY` reaches out toward REI.
    let best = start;
    for (let i = start; i < pts.length; i++) if (Math.abs(pts[i][1] - tailY) < Math.abs(pts[best][1] - tailY)) best = i;
    pts[best] = [-13, pts[best][1] + 2];
  }
  return pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

const BUBBLE_TAIL = 14;

/**
 * REI's speech bubble: a jagged paper burst with an ink outline on a hard accent shadow, its tail
 * pointing left at REI. REI's voice only: nothing else in the app is paper-filled at this size.
 * Children are laid out inside, clear of the spikes; write them in ink (`F.arena`).
 */
export function ShoutBubble({ children, accent, tail = true, tailY = 26, seed = 3, style }: { children?: ReactNode; accent: string; tail?: boolean; tailY?: number; seed?: number; style?: StyleProp<ViewStyle> }) {
  const [size, onLayout] = useSize();
  const points = useMemo(() => (size ? burstPoints(size.w, size.h, tail ? Math.min(tailY, size.h - 16) : null, seed) : ''), [size, tail, tailY, seed]);
  return (
    <View onLayout={onLayout} style={[{ paddingVertical: 20, paddingLeft: 22, paddingRight: 20, minHeight: 64, justifyContent: 'center' }, style]}>
      {size ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: -BUBBLE_TAIL, top: 0, width: size.w + BUBBLE_TAIL + SHADOW + 2, height: size.h + SHADOW + 2 }}>
          <Svg width={size.w + BUBBLE_TAIL + SHADOW + 2} height={size.h + SHADOW + 2} viewBox={`${-BUBBLE_TAIL} 0 ${size.w + BUBBLE_TAIL + SHADOW + 2} ${size.h + SHADOW + 2}`}>
            <Polygon points={points} fill={accent} transform={`translate(${SHADOW + 1} ${SHADOW + 1})`} />
            <Polygon points={points} fill={F.chalk} stroke={F.arena} strokeWidth={2} strokeLinejoin="miter" />
          </Svg>
        </View>
      ) : null}
      {children}
    </View>
  );
}
