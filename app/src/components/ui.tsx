// The basics every screen is built from, in the Sumi & Hanko system (see lib/theme.ts).
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View, type AccessibilityRole, type AccessibilityState, type Insets, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Icon } from './icons';
import { useStore } from '../state/store';
import { alpha, C, displaySize, fontFamily, HIT, onColor, RADIUS, soften, STROKE, TEXT_MIN, type Face as ThemeFace, type Weight } from '../lib/theme';

/**
 * `sans` is body text (Zen Kaku Gothic New). `display` is the Mincho at its heaviest (titles, big
 * numbers), `heading` its bold (section headings, buttons) and `voice` its medium (REI's lines).
 * `label` / `labelItalic` are the medium and the bold small label. `mono` is IBM Plex Mono for
 * meta lines and `num` its medium, for numbers. `jp` is an old name for body.
 */
type Face = 'sans' | 'mono' | 'jp' | ThemeFace;

/** The most letter spacing each kind of face takes (em). */
const MAX_LS = { serif: 0.02, label: 0.06, body: 0.03 } as const;
/** Line height when none is asked for, as a multiple of size. */
const DEFAULT_LH = { display: 1.2, heading: 1.35, voice: 1.5, label: 1.35, labelItalic: 1.35, mono: 1.35, num: 1.3, body: 1.4 } as const;

export interface TxtProps {
  children?: ReactNode;
  size?: number;
  w?: Weight;
  face?: Face;
  color?: string;
  /** Letter spacing in em, like the design's CSS. */
  ls?: number;
  /** Line height as a multiple of size. */
  lh?: number;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onPress?: () => void;
  /** No longer used. Kept so old callers compile. */
  lean?: boolean;
  /** Display face only: `size` is the real point size, not the old condensed-face scale (see `displaySize`). */
  exact?: boolean;
  /** Draw the string exactly as given. Otherwise a label written in capitals is quietened to sentence case (see `soften`). */
  raw?: boolean;
  /** Shrink to fit one line instead of truncating (big display numbers and names). */
  fit?: boolean;
  accessibilityLabel?: string;
}

export function Txt({ children, size = 16, w = 400, face = 'sans', color = C.text, ls, lh, align, style, numberOfLines, onPress, exact, raw, fit, accessibilityLabel }: TxtProps) {
  // Only the setting text depends on, so text doesn't redraw on unrelated changes.
  const textSize = useStore(s => s.settings.textSize);
  const key = face === 'sans' || face === 'jp' ? 'body' : face;
  const display = key === 'display', serif = display || key === 'heading' || key === 'voice';
  // Display sizes across the app were written for a condensed face; the Mincho is wider, so
  // they are drawn smaller unless `exact`. Nothing is drawn under 12pt.
  const fs = (display && !exact ? displaySize(size) : Math.max(TEXT_MIN, size)) * textSize;
  const family = fontFamily(key, w);
  // The system speaks in sentence case. Labels and headings that arrive in capitals are quietened;
  // body text (what people typed, what REI said) is never touched.
  const shown = !raw && key !== 'body' && key !== 'voice' && typeof children === 'string' ? soften(children) : children;
  // Big Mincho sits a touch tighter; everything else takes what it is given, within reason.
  const cap = serif ? MAX_LS.serif : key === 'body' ? MAX_LS.body : MAX_LS.label;
  const spacing = (ls === undefined ? (serif && fs >= 26 ? -0.01 : 0) : Math.min(ls, cap)) * fs;
  // Always explicit, and never under the faces' own line (1.2 em), so iOS never clips or shifts a line.
  const lineHeight = Math.round(Math.max(lh ?? DEFAULT_LH[key], display ? 1.15 : 1.2) * fs);
  return (
    <Text
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      numberOfLines={fit ? 1 : numberOfLines}
      adjustsFontSizeToFit={fit || undefined}
      minimumFontScale={fit ? 0.6 : undefined}
      allowFontScaling={false}
      style={[{ fontFamily: family, fontSize: fs, lineHeight, color, letterSpacing: spacing, textAlign: align }, style]}
    >
      {shown}
    </Text>
  );
}

/** Small meta label (IBM Plex Mono). */
export function Label({ children, color = C.label, size = 12, ls = 0, style }: { children: ReactNode; color?: string; size?: number; ls?: number; style?: StyleProp<TextStyle> }) {
  return <Txt face="mono" size={size} ls={ls} color={color} style={style}>{children}</Txt>;
}

/** Retired: the app is English only, so this draws nothing. Kept so old callers compile. */
export function Jp(_: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return null;
}

export interface TapProps {
  onPress?: () => void;
  onLongPress?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  disabled?: boolean;
  /** What a screen reader says. Give one whenever the content isn't plain text (icons, shapes). */
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityHint?: string;
  /** Extra touch area around a small control, to reach 44pt. */
  hitSlop?: number | Insets;
}

// On the web a "button" role renders a real <button>, and the app nests pressables (a row inside a
// panel), which HTML forbids. So the default role is native only; an explicit role always applies.
const DEFAULT_ROLE: AccessibilityRole | undefined = Platform.OS === 'web' ? undefined : 'button';

/** Anything you can press: a button to screen readers, with a light haptic. */
export function Tap({ onPress, onLongPress, children, style, haptic = true, disabled, accessibilityLabel, accessibilityRole = DEFAULT_ROLE, accessibilityState, accessibilityHint, hitSlop }: TapProps) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      hitSlop={hitSlop}
      onPress={() => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => [style, pressed && !disabled ? { opacity: 0.7 } : null]}
    >
      {children}
    </Pressable>
  );
}

/** A card: sumi fill inside a quiet line, softly rounded. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: C.canvas, borderWidth: STROKE, borderColor: C.line2, borderRadius: RADIUS.card }, style]}>{children}</View>;
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: C.line }, style]} />;
}

/** Plain progress bar that animates its fill. For brush progress, use `Meter` or `MeterBar` from fight.tsx. */
export function Bar({ pct, color, height = 2 }: { pct: number; color: string; glow?: boolean; height?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: Math.max(0, Math.min(1, pct)), duration: 600, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start();
  }, [pct, v]);
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: C.rope, overflow: 'hidden' }}>
      <Animated.View style={{ height: '100%', borderRadius: height / 2, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: color }} />
    </View>
  );
}

const TOGGLE_W = 48, TOGGLE_H = 28, KNOB = 20;

/** The drawn part of a switch: a pill that fills with `acc` when on. Shared with onboarding's rows. */
export function SwitchArt({ on, acc }: { on: boolean; acc: string }) {
  return (
    <View style={{ width: TOGGLE_W, height: TOGGLE_H, borderRadius: TOGGLE_H / 2, backgroundColor: on ? acc : C.canvas, borderWidth: 1, borderColor: on ? acc : C.rule, justifyContent: 'center' }}>
      <View style={{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: on ? onColor(acc) : C.smoke, marginLeft: on ? TOGGLE_W - KNOB - 5 : 3 }} />
    </View>
  );
}

/** A switch: fills with the accent when on. */
export function Toggle({ on, onPress, accessibilityLabel }: { on: boolean; onPress: () => void; accessibilityLabel?: string }) {
  const accent = useStore(s => s.accent);
  return (
    // The switch is drawn 48×28 inside a 44pt-tall target (a real size, not hitSlop: slop is cut off by a tight parent).
    <Tap onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={accessibilityLabel} hitSlop={{ left: 6, right: 6 }} style={{ width: TOGGLE_W, height: HIT, justifyContent: 'center' }}>
      <SwitchArt on={on} acc={accent} />
    </Tap>
  );
}

const SEG_PAD = 4;

/** A row of options, one picked (rice paper). */
export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    // Each option is a 44pt-tall target; the frame and the picked fill are drawn 36pt tall inside it.
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', height: HIT, paddingHorizontal: 3 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: SEG_PAD, bottom: SEG_PAD, borderWidth: 1, borderColor: C.rule, borderRadius: RADIUS.sm, backgroundColor: C.canvas }} />
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Tap key={String(v)} onPress={() => onChange(v)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={label} style={{ height: HIT, minWidth: HIT, paddingVertical: SEG_PAD + 3 }}>
            <View style={{ flex: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.tag, backgroundColor: on ? C.chalk : 'transparent' }}>
              <Txt face="labelItalic" size={13} color={on ? C.ink : C.smoke}>{label}</Txt>
            </View>
          </Tap>
        );
      })}
    </View>
  );
}

/** Settings-style row: title + subtitle on the left, a control on the right. */
export function Row({ title, sub, right, last, onPress }: { title: string; sub?: string; right?: ReactNode; last?: boolean; onPress?: () => void }) {
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 56, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={16} w={500} lh={1.375}>{title}</Txt>
        {sub ? <Txt size={13} color={C.sub} lh={1.4}>{sub}</Txt> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? <Tap onPress={onPress} accessibilityLabel={sub ? `${title}. ${sub}` : title}>{body}</Tap> : body;
}

const GLYPH_NAMES: Record<string, string> = { '‹': 'Back', '✕': 'Close', '✓': 'Done', '+': 'Add' };

const GLYPH_ICONS = { '‹': 'back', '✕': 'close', '✓': 'check', '+': 'plus' } as const;

/** A quiet square icon button. Smaller sizes still get a 44pt touch area. */
export function IconButton({ onPress, children, size = 36, accessibilityLabel }: { onPress: () => void; children: ReactNode; size?: number; accessibilityLabel?: string }) {
  const slop = Math.max(0, (HIT - size) / 2);
  const label = accessibilityLabel ?? (typeof children === 'string' ? GLYPH_NAMES[children] ?? children : undefined);
  const glyph = typeof children === 'string' ? GLYPH_ICONS[children as keyof typeof GLYPH_ICONS] : undefined;
  return (
    <Tap onPress={onPress} accessibilityLabel={label} hitSlop={slop} style={{ width: size, height: size, borderWidth: 1, borderColor: C.rule, borderRadius: RADIUS.sm, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
      {glyph ? <Icon name={glyph} size={size > 36 ? 20 : 18} color={C.chalk} tint={0} strokeWidth={1.6} /> : typeof children === 'string' ? <Txt size={size > 36 ? 20 : 17} w={700} lh={1.25} color={C.chalk}>{children}</Txt> : children}
    </Tap>
  );
}

/** Three pulsing dots: REI is thinking. */
export function Dots() {
  const accent = useStore(s => s.accent);
  const [vs] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.2)));
  useEffect(() => {
    const loops = vs.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.2, duration: 600, useNativeDriver: true }),
          Animated.delay(300 - i * 180 + 360),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [vs]);
  return (
    <View accessibilityLabel="REI is thinking" style={{ flexDirection: 'row', gap: 5 }}>
      {vs.map((v, i) => <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, opacity: v }} />)}
    </View>
  );
}

/** Four thin corner brackets around a block (a camera frame). */
export function Corners({ color }: { color: string; radius?: number }) {
  const s = { position: 'absolute' as const, width: 16, height: 16, borderColor: color };
  return (
    <>
      <View style={[s, { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5 }]} />
      <View style={[s, { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5 }]} />
      <View style={[s, { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5 }]} />
      <View style={[s, { bottom: 0, right: 0, borderBottomWidth: 1.5, borderRightWidth: 1.5 }]} />
    </>
  );
}

export function Blink({ color }: { color: string }) {
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.25, duration: 1200, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [v]);
  return <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: v }} />;
}

/** Four-bar audio glyph used for the voice buttons. */
export function VoiceGlyph({ color, big }: { color: string; big?: boolean }) {
  const hs = big ? [9, 18, 12, 7] : [8, 16, 11, 6];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: big ? 3 : 2 }}>
      {hs.map((h, i) => <View key={i} style={{ width: big ? 3 : 2, height: h, borderRadius: 2, backgroundColor: color }} />)}
    </View>
  );
}

export const accentFill = (acc: string, a = 0.14) => alpha(acc, a);
