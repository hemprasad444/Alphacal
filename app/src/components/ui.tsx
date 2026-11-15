// The basics every screen is built from, in the Fight Night system (see lib/theme.ts).
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View, type AccessibilityRole, type AccessibilityState, type Insets, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { CutShape } from './cut';
import { useStore } from '../state/store';
import { alpha, C, fontFamily, HIT, LEAN, onColor, type Face as ThemeFace, type Weight } from '../lib/theme';

/**
 * `sans` is body text (Barlow). `display` is Anton, leaning. `label` / `labelItalic` are Barlow
 * Condensed for uppercase labels. `mono` and `jp` are the old names: `mono` is now the label
 * face, `jp` is body.
 */
type Face = 'sans' | 'mono' | 'jp' | ThemeFace;

/** The condensed label face is narrower than the mono it replaced, so old `mono` sizes are nudged up to stay readable. */
const MONO_SCALE = 1.12;

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
  /** Lean the text at the display angle. On by default for `display`; pass false to stand it up. */
  lean?: boolean;
  /** Shrink to fit one line instead of truncating (big display numbers and names). */
  fit?: boolean;
  accessibilityLabel?: string;
}

export function Txt({ children, size = 16, w = 400, face = 'sans', color = C.text, ls = 0, lh, align, style, numberOfLines, onPress, lean, fit, accessibilityLabel }: TxtProps) {
  // Only the setting text depends on, so text doesn't redraw on unrelated changes.
  const textSize = useStore(s => s.settings.textSize);
  const fs = size * textSize * (face === 'mono' ? MONO_SCALE : 1);
  const display = face === 'display';
  const family = fontFamily(face === 'sans' || face === 'jp' ? 'body' : face, w);
  // Anton is tall: without room above the caps it clips on iOS.
  const lineHeight = lh ? lh * fs : display ? 1.2 * fs : undefined;
  return (
    <Text
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      numberOfLines={fit ? 1 : numberOfLines}
      adjustsFontSizeToFit={fit || undefined}
      minimumFontScale={fit ? 0.5 : undefined}
      allowFontScaling={false}
      style={[
        { fontFamily: family, fontSize: fs, color, letterSpacing: ls * fs, textAlign: align },
        lineHeight ? { lineHeight } : null,
        (lean ?? display) ? { transform: [{ skewX: `-${LEAN}deg` }], transformOrigin: align === 'right' ? 'right bottom' : align === 'center' ? 'center' : 'left bottom' } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Small uppercase label: the HUD voice of the design (Barlow Condensed). */
export function Label({ children, color = C.label, size = 11, ls = 0.12, style }: { children: ReactNode; color?: string; size?: number; ls?: number; style?: StyleProp<TextStyle> }) {
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

/** A panel: flat canvas, square corners. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: C.canvas }, style]}>{children}</View>;
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 2, backgroundColor: C.line }, style]} />;
}

/** Plain progress bar that animates its fill. For the fight meter, use `Meter` from fight.tsx. */
export function Bar({ pct, color, height = 2 }: { pct: number; color: string; glow?: boolean; height?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: Math.max(0, Math.min(1, pct)), duration: 600, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start();
  }, [pct, v]);
  return (
    <View style={{ height, backgroundColor: C.rope, overflow: 'hidden' }}>
      <Animated.View style={{ height: '100%', width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: color }} />
    </View>
  );
}

const TOGGLE_W = 52, TOGGLE_H = 28;

/** A cut switch: fills with your corner colour when on. */
export function Toggle({ on, onPress, accessibilityLabel }: { on: boolean; onPress: () => void; accessibilityLabel?: string }) {
  const accent = useStore(s => s.accent);
  return (
    // The switch is drawn 52×28 inside a 44pt-tall target (a real size, not hitSlop: slop is cut off by a tight parent).
    <Tap onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={accessibilityLabel} hitSlop={{ left: 6, right: 6 }} style={{ width: TOGGLE_W, height: HIT, justifyContent: 'center' }}>
      <View style={{ width: TOGGLE_W, height: TOGGLE_H }}>
        <CutShape width={TOGGLE_W} height={TOGGLE_H} fill={on ? accent : C.canvas} stroke={on ? accent : C.rope} />
        <CutShape width={24} height={16} fill={on ? onColor(accent) : C.smoke} style={{ position: 'absolute', top: 6, left: on ? TOGGLE_W - 24 - 7 : 7 }} />
      </View>
    </Tap>
  );
}

const SEG_PAD = 4;

/** A row of options, one picked (chalk). */
export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    // Each option is a 44pt-tall target; the frame and the picked fill are drawn 36pt tall inside it.
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', height: HIT, paddingHorizontal: 2 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: SEG_PAD, bottom: SEG_PAD, borderWidth: 2, borderColor: C.rope, backgroundColor: C.arena }} />
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Tap key={String(v)} onPress={() => onChange(v)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={label} style={{ height: HIT, minWidth: HIT, paddingVertical: SEG_PAD + 2 }}>
            <View style={{ flex: 1, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.chalk : 'transparent' }}>
              <Txt face="label" w={600} size={14} ls={0.06} color={on ? C.ink : C.smoke}>{label.toUpperCase()}</Txt>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, minHeight: HIT, paddingVertical: 12, borderBottomWidth: last ? 0 : 2, borderBottomColor: C.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={16} w={500}>{title}</Txt>
        {sub ? <Txt size={13} color={C.sub} lh={1.35}>{sub}</Txt> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? <Tap onPress={onPress} accessibilityLabel={sub ? `${title}. ${sub}` : title}>{body}</Tap> : body;
}

const GLYPH_NAMES: Record<string, string> = { '‹': 'Back', '✕': 'Close', '✓': 'Done', '+': 'Add' };

/** A square icon button. Smaller sizes still get a 44pt touch area. */
export function IconButton({ onPress, children, size = 36, accessibilityLabel }: { onPress: () => void; children: ReactNode; size?: number; accessibilityLabel?: string }) {
  const slop = Math.max(0, (HIT - size) / 2);
  const label = accessibilityLabel ?? (typeof children === 'string' ? GLYPH_NAMES[children] ?? children : undefined);
  return (
    <Tap onPress={onPress} accessibilityLabel={label} hitSlop={slop} style={{ width: size, height: size, borderWidth: 2, borderColor: C.rope, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
      {typeof children === 'string' ? <Txt size={size > 36 ? 20 : 17} w={600} color={C.chalk}>{children}</Txt> : children}
    </Tap>
  );
}

/** Three pulsing blocks: REI is thinking. */
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
    <View accessibilityLabel="REI is thinking" style={{ flexDirection: 'row', gap: 4 }}>
      {vs.map((v, i) => <Animated.View key={i} style={{ width: 6, height: 6, backgroundColor: accent, opacity: v }} />)}
    </View>
  );
}

/** Four square corner brackets around a panel. */
export function Corners({ color }: { color: string; radius?: number }) {
  const s = { position: 'absolute' as const, width: 16, height: 16, borderColor: color };
  return (
    <>
      <View style={[s, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[s, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }]} />
      <View style={[s, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[s, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }]} />
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
  return <Animated.View style={{ width: 6, height: 6, backgroundColor: color, opacity: v }} />;
}

/** Four-bar audio glyph used for the voice buttons. */
export function VoiceGlyph({ color, big }: { color: string; big?: boolean }) {
  const hs = big ? [9, 18, 12, 7] : [8, 16, 11, 6];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: big ? 3 : 2 }}>
      {hs.map((h, i) => <View key={i} style={{ width: big ? 3 : 2, height: h, backgroundColor: color }} />)}
    </View>
  );
}

export const accentFill = (acc: string, a = 0.14) => alpha(acc, a);
