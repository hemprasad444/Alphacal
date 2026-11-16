// Sumi & Hanko drawing parts: the paper-fibre texture, tapered brush strokes, the ensō (a brush
// circle that closes as a target is met), the hanko seal, the small boxed tag and REI's own seal.
// Everything is plain views or a few react-native-svg paths, so it draws the same on iOS as on
// the web (no blend modes, no CSS clip-path, no backdrop filters) and stays light.
import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';
import { Icon, type IconKey } from './icons';
import { Tap, Txt } from './ui';
import { F, RADIUS, STROKE } from '../lib/theme';

const svgId = (raw: string) => 'ink' + raw.replace(/[^a-zA-Z0-9]/g, '');

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/* ───────────────────────────── Paper ───────────────────────────── */

/**
 * Washi fibres: two sets of hair-thin lines, a degree or two off true, so faint they are felt
 * more than seen. Fills its parent. `light` is for a light sheet (dark fibres).
 */
export function PaperTexture({ light, strength = 1, style }: { light?: boolean; strength?: number; style?: StyleProp<ViewStyle> }) {
  const id = svgId(useId());
  const fibre = light ? F.washiSub : F.chalk;
  return (
    <View pointerEvents="none" {...HIDDEN} style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={`${id}v`} x={0} y={0} width={6} height={48} patternUnits="userSpaceOnUse" patternTransform="rotate(1)">
            <Rect x={0} y={0} width={1} height={48} fill={fibre} fillOpacity={(light ? 0.05 : 0.018) * strength} />
          </Pattern>
          <Pattern id={`${id}h`} x={0} y={0} width={48} height={13} patternUnits="userSpaceOnUse" patternTransform="rotate(2)">
            <Rect x={0} y={0} width={48} height={1} fill={fibre} fillOpacity={(light ? 0.04 : 0.013) * strength} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id}v)`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id}h)`} />
      </Svg>
    </View>
  );
}

/* ───────────────────────────── Brush strokes ───────────────────────────── */

/** A full stroke: pressed down at the left, lifted at the right (100 × 8). */
const STROKE_PATH = 'M0 4 C10 1.5 30 1 60 1.6 C80 2 92 2.6 100 4 C92 6 80 6.8 60 6.6 C30 6.4 10 6.8 0 4 Z';
/** A rule: one quick tapered line (100 × 6). */
const RULE_PATH = 'M0 3 C20 1.6 50 2.2 100 2.8 C60 3.6 25 4.2 0 3 Z';
/** A longer rule with a slight waver, for under a title (100 × 6). */
const RULE_LONG_PATH = 'M0 3 C14 1.2 40 1.8 62 2.2 C80 2.4 92 2 100 3.2 C86 4.4 60 4.6 38 4.2 C20 4 8 4.6 0 3 Z';

/** One tapered brush stroke stretched across its box. Give the box a width (or `flex: 1`). */
export function BrushStroke({ color, height = 8, style }: { color: string; height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" {...HIDDEN} style={[{ height }, style]}>
      <Svg width="100%" height={height} viewBox="0 0 100 8" preserveAspectRatio="none">
        <Path d={STROKE_PATH} fill={color} />
      </Svg>
    </View>
  );
}

/** The brush rule that closes a heading or divides two blocks. In a row, pass `style={{ flex: 1 }}`. */
export function BrushRule({ color = F.rule, height = 5, long, style }: { color?: string; height?: number; long?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" {...HIDDEN} style={[{ height }, style]}>
      <Svg width="100%" height={height} viewBox="0 0 100 6" preserveAspectRatio="none">
        <Path d={long ? RULE_LONG_PATH : RULE_PATH} fill={color} />
      </Svg>
    </View>
  );
}

/**
 * Brush progress: a dry-brush track with a stroke of `color` laid over it from the left, `pct`
 * (0..1) of the way. `cap` (0..1) marks the far end in `capColor` (how far past a limit).
 */
export function BrushBar({ pct, color, track = F.rope, height = 8, cap = 0, capColor = F.chalk, style }: { pct: number; color: string; track?: string; height?: number; cap?: number; capColor?: string; style?: StyleProp<ViewStyle> }) {
  const p = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
  const c = Math.max(0, Math.min(0.3, cap));
  return (
    <View pointerEvents="none" style={[{ height }, style]}>
      <Svg width="100%" height={height} viewBox="0 0 100 8" preserveAspectRatio="none">
        <Path d={STROKE_PATH} fill={track} />
      </Svg>
      {p > 0.005 ? (
        <View style={{ position: 'absolute', left: 0, top: 0, height, width: `${Math.max(3, p * 100)}%` }}>
          <Svg width="100%" height={height} viewBox="0 0 100 8" preserveAspectRatio="none">
            <Path d={STROKE_PATH} fill={color} />
          </Svg>
        </View>
      ) : null}
      {c > 0 ? (
        <View style={{ position: 'absolute', right: 0, top: 0, height, width: `${Math.max(6, c * 100)}%` }}>
          <Svg width="100%" height={height} viewBox="0 0 100 8" preserveAspectRatio="none">
            <Path d="M0 2.4 C40 2.2 80 2.8 100 4 C80 5.8 40 6.4 0 6.2 Z" fill={capColor} />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

/** A dab of ink: the bullet before a row, a set pip. */
export function InkDot({ size = 8, color = F.chalk, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 8 8">
        <Path d="M4 0.6 C6 0.4 7.5 2 7.4 4 C7.5 6 6 7.5 4 7.4 C2 7.5 0.5 6.1 0.6 4 C0.5 2 2 0.5 4 0.6 Z" fill={color} />
      </Svg>
    </View>
  );
}

/* ───────────────────────────── Ensō ───────────────────────────── */

const ENSO_R = 48, ENSO_C = 2 * Math.PI * ENSO_R, WISP_R = 55, WISP_C = 2 * Math.PI * WISP_R;

/**
 * The ensō: a circle drawn in one brush stroke. It starts at the top and closes as `pct` (0..1)
 * reaches the target; a thin trailing hair and two dry gaps make it a stroke, not a gauge.
 * Children are centred inside it (the number).
 */
export function Enso({ pct, size = 104, color, track = F.line, ground = F.arena, children, style }: { pct: number; size?: number; color: string; track?: string; ground?: string; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
  // The round end adds half the stroke's width; until it is complete the circle stays visibly open.
  const len = p >= 1 ? ENSO_C : Math.min(p * ENSO_C, ENSO_C - 14);
  const wisp = (len / ENSO_C) * 0.74 * WISP_C;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx={60} cy={60} r={ENSO_R} fill="none" stroke={track} strokeWidth={2} />
        {len > 1 ? (
          <>
            <Circle cx={60} cy={60} r={ENSO_R} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${len.toFixed(1)} ${(ENSO_C + 20).toFixed(1)}`} transform="rotate(-90 60 60)" />
            {wisp > 12 ? <Circle cx={60} cy={60} r={WISP_R} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" strokeDasharray={`${wisp.toFixed(1)} ${(WISP_C + 20).toFixed(1)}`} transform="rotate(-84 60 60)" /> : null}
            <Circle cx={60} cy={60} r={46} fill="none" stroke={ground} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="88 289" transform="rotate(-30 60 60)" />
            <Circle cx={60} cy={60} r={50.5} fill="none" stroke={ground} strokeOpacity={0.5} strokeWidth={0.8} strokeDasharray="40 318" transform="rotate(20 60 60)" />
          </>
        ) : null}
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View> : null}
    </View>
  );
}

/* ───────────────────────────── Hanko ───────────────────────────── */

/** A square stamp with soft, slightly uneven edges (64 × 64). */
const SEAL_SQUARE = 'M9 6.5 C20 5 44 5.6 55.5 6.2 C58 6.6 58.6 8.5 58.8 11 C59.6 24 59 42 58.4 53.5 C58.2 56.8 56.6 58.4 53.5 58.6 C40 59.6 22 59.2 10 58.5 C7 58.2 5.6 56.6 5.4 53.5 C4.8 40 5 22 5.6 10.5 C5.8 8 7 6.8 9 6.5 Z';
/** A round stamp, a little off a true circle (64 × 64). */
const SEAL_ROUND = 'M32 4.5 C47 4 59.5 16 59.6 31.5 C59.8 47.5 47.5 59.8 32.2 59.6 C16.5 59.5 4.2 47.6 4.5 32 C4.6 16.5 16.8 4.8 32 4.5 Z';

export type SealShape = 'square' | 'round';

/** Round or square for a badge, always the same for the same name. */
export function sealShapeFor(key: string | undefined): SealShape {
  let h = 0;
  for (const ch of key ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 ? 'round' : 'square';
}

export interface HankoSealProps {
  size?: number;
  shape?: SealShape;
  /** Earned: inked in vermilion. Not earned: a faint embossed outline. */
  earned?: boolean;
  /** The mark cut into the seal: one or two characters (an initial, a number). */
  mark?: string;
  /** Or a simple symbol from REI's icon set. */
  icon?: IconKey;
  /** Degrees off square (a stamp never lands straight). */
  tilt?: number;
  /** The colour behind the seal, for the specks where the ink missed. */
  ground?: string;
  /** The seal's ink. Vermilion unless said otherwise (a darker red on light paper). */
  fill?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A hanko: a red seal with a carved white mark, its edge a little imperfect and a few specks
 * where the ink missed. Locked, it is the dent the stamp will fill: an embossed outline.
 * Marks are original (an initial letter, a number or a simple symbol).
 */
export function HankoSeal({ size = 64, shape = 'square', earned = true, mark, icon, tilt = -5, ground = F.arena, fill = F.seal, style }: HankoSealProps) {
  const d = shape === 'round' ? SEAL_ROUND : SEAL_SQUARE;
  const deg = earned ? tilt : 0;
  const ink = earned ? F.carved : F.rule;
  const glyph = mark && mark.length > 1 ? size * 0.34 : size * 0.5;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <G transform={`rotate(${deg} 32 32)`}>
          {earned ? (
            <>
              <Path d={d} fill={fill} />
              {shape === 'square' ? <Rect x={10.5} y={11} width={43} height={42.5} rx={2} fill="none" stroke={ground} strokeOpacity={0.5} strokeWidth={1} /> : <Circle cx={32} cy={32} r={23} fill="none" stroke={ground} strokeOpacity={0.45} strokeWidth={1} />}
              {size >= 40 ? (
                <>
                  <Circle cx={14} cy={49} r={1.5} fill={ground} />
                  <Circle cx={50} cy={15} r={1} fill={ground} />
                  <Circle cx={47} cy={50} r={0.8} fill={ground} />
                  <Path d="M5.2 30 C6.4 31 6.4 33 5.3 34 Z" fill={ground} />
                </>
              ) : null}
            </>
          ) : (
            <>
              <Path d={d} fill="#171513" stroke={F.locked} strokeWidth={1.5} />
              {shape === 'round'
                ? <Path d="M32 6 C46.5 5.6 58 17 58.2 31.5" fill="none" stroke="#090908" strokeWidth={1.5} />
                : <Path d="M7 10 C7.4 8.6 8.4 8 10 7.8 C24 6.6 44 7 55 7.6" fill="none" stroke="#090908" strokeWidth={1.5} />}
            </>
          )}
        </G>
      </Svg>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${deg}deg` }] }]}>
        {icon ? <Icon name={icon} size={size * 0.5} color={ink} tint={earned ? 0.22 : 0} strokeWidth={earned ? 2 : 1.7} /> : null}
        {mark && !icon ? <Txt face="display" exact raw size={glyph} lh={1.2} color={ink} numberOfLines={1}>{mark}</Txt> : null}
      </View>
    </View>
  );
}

/** REI's own seal: a square vermilion stamp with a carved R. Marks everything REI says. */
export function ReiSeal({ size = 36, ground = F.canvas, style }: { size?: number; ground?: string; style?: StyleProp<ViewStyle> }) {
  return <HankoSeal size={size} shape="square" mark="R" tilt={-4} ground={ground} style={style} />;
}

/**
 * The small boxed tag that opens every heading: a thin vermilion frame around a short English
 * word, an initial, a number or an icon.
 */
export function SealTag({ text, icon, size = 'md', style }: { text?: string; icon?: IconKey; size?: 'lg' | 'md'; style?: StyleProp<ViewStyle> }) {
  const h = size === 'lg' ? 28 : 24;
  return (
    <View style={[{ minWidth: h, height: h, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: F.seal, borderRadius: RADIUS.tag }, style]}>
      {icon ? <View><Icon name={icon} size={size === 'lg' ? 17 : 15} color={F.rival} tint={0} strokeWidth={1.7} /></View> : null}
      {text && !icon ? <Txt face="heading" raw size={size === 'lg' ? 15 : 13} lh={1.25} color={F.rival} numberOfLines={1}>{text}</Txt> : null}
    </View>
  );
}

/* ───────────────────────────── Cards ───────────────────────────── */

export interface InkPanelProps {
  children?: ReactNode;
  /** No longer drawn (screentone). Kept so old callers compile. */
  tone?: boolean;
  /** No longer drawn (speed lines). */
  speed?: string;
  /** No longer drawn (hard shadow). */
  shadow?: string;
  /** No longer used: a card sits square. */
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

/** A card: sumi fill inside a quiet line, softly rounded. Every block that needs a container is one of these. */
export function InkPanel({ children, fill = F.canvas, stroke = F.line, strokeWidth = STROKE, pad = 16, onPress, accessibilityLabel, style }: InkPanelProps) {
  const box = <View style={[{ backgroundColor: fill, borderWidth: strokeWidth, borderColor: stroke, borderRadius: RADIUS.card, padding: pad }, style]}>{children}</View>;
  return onPress ? <Tap onPress={onPress} accessibilityLabel={accessibilityLabel}>{box}</Tap> : box;
}

/* ───────────────────────────── Old names ───────────────────────────── */

/** The boxed tag, under its old name. `color` is not used: the tag is always vermilion. */
export function SkewTag({ text, icon, size = 'md', style }: { text?: string; icon?: IconKey; color?: string; size?: 'lg' | 'md'; style?: StyleProp<ViewStyle> }) {
  return <SealTag text={text} icon={icon} size={size} style={style} />;
}

/** REI's seal, under its old name. `accent` is not used: the seal is always vermilion. */
export function ReiAvatar({ size = 52 }: { size?: number; accent?: string }) {
  return <ReiSeal size={size} />;
}

/** REI's words used to sit in a speech bubble. Now they sit in a quiet card; see `CoachShout` in fight.tsx. */
export function ShoutBubble({ children, style }: { children?: ReactNode; accent?: string; tail?: boolean; tailY?: number; seed?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: F.canvas, borderWidth: STROKE, borderColor: F.line, borderRadius: RADIUS.card, paddingVertical: 12, paddingHorizontal: 16 }, style]}>{children}</View>;
}

/** Retired (screentone): draws the paper texture instead. */
export function Halftone({ style }: { color?: string; opacity?: number; size?: number; dot?: number; style?: StyleProp<ViewStyle> }) {
  return <PaperTexture style={style} />;
}

/** Retired (speed lines): draws nothing. */
export function SpeedLines(_: { color: string; opacity?: number; count?: number; inner?: number; cx?: number; cy?: number; seed?: number; style?: StyleProp<ViewStyle> }) {
  return null;
}

/** Retired (speed lines): an empty path. */
export function speedPath(_count = 30, _inner = 40, _outer = 170, _seed = 7, _spread = 1): string {
  return '';
}

/** Retired (screentone): an empty pattern, so an old `url(#id)` fill still resolves. */
export function HalftoneDef({ id }: { id: string; color?: string; opacity?: number; size?: number; dot?: number }) {
  return (
    <Pattern id={id} x={0} y={0} width={8} height={8} patternUnits="userSpaceOnUse">
      <Rect x={0} y={0} width={8} height={8} fill={F.arena} fillOpacity={0} />
    </Pattern>
  );
}
