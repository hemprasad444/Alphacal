import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useStore } from '../state/store';
import { alpha, C, fontFamily, type Weight } from '../lib/theme';

type Face = 'sans' | 'mono' | 'jp';

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
}

export function Txt({ children, size = 16, w = 400, face = 'sans', color = C.text, ls = 0, lh, align, style, numberOfLines, onPress }: TxtProps) {
  const { settings } = useStore();
  const fs = size * settings.textSize;
  const family = face === 'sans' ? fontFamily(settings.font, w) : fontFamily(face, w);
  return (
    <Text
      onPress={onPress}
      numberOfLines={numberOfLines}
      allowFontScaling={false}
      style={[{ fontFamily: family, fontSize: fs, color, letterSpacing: ls * fs, textAlign: align }, lh ? { lineHeight: lh * fs } : null, style]}
    >
      {children}
    </Text>
  );
}

/** Small uppercase mono label: the HUD voice of the design. */
export function Label({ children, color = C.label, size = 11, ls = 0.16, style }: { children: ReactNode; color?: string; size?: number; ls?: number; style?: StyleProp<TextStyle> }) {
  return <Txt face="mono" size={size} ls={ls} color={color} style={style}>{children}</Txt>;
}

export function Jp({ children, size = 11, color = C.faint, style }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const { settings } = useStore();
  if (!settings.hud) return null;
  return <Txt face="jp" size={size} color={color} style={style}>{children}</Txt>;
}

export function Tap({ onPress, children, style, haptic = true, disabled }: { onPress?: () => void; children?: ReactNode; style?: StyleProp<ViewStyle>; haptic?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [style, pressed && !disabled ? { opacity: 0.7 } : null]}
    >
      {children}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2 }, style]}>{children}</View>;
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: C.line }, style]} />;
}

/** Thin progress bar that animates its fill. */
export function Bar({ pct, color, glow, height = 2 }: { pct: number; color: string; glow?: boolean; height?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: Math.max(0, Math.min(1, pct)), duration: 800, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start();
  }, [pct, v]);
  return (
    <View style={{ height, backgroundColor: C.line, borderRadius: height, overflow: glow ? 'visible' : 'hidden' }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: height,
          width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: color,
          ...(glow ? { shadowColor: color, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } } : null),
        }}
      />
    </View>
  );
}

export function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { accent } = useStore();
  return (
    <Tap onPress={onPress} style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: on ? accent : 'rgba(255,255,255,0.12)', alignItems: on ? 'flex-end' : 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? C.ink : C.body }} />
    </Tap>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.line3 }}>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Tap key={String(v)} onPress={() => onChange(v)} style={{ paddingVertical: 7, paddingHorizontal: 11, borderRadius: 9, backgroundColor: on ? 'rgba(255,255,255,0.12)' : 'transparent' }}>
            <Txt size={13} color={on ? C.text : C.label}>{label}</Txt>
          </Tap>
        );
      })}
    </View>
  );
}

/** Settings-style row: title + subtitle on the left, a control on the right. */
export function Row({ title, sub, right, last, onPress }: { title: string; sub?: string; right?: ReactNode; last?: boolean; onPress?: () => void }) {
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt size={16}>{title}</Txt>
        {sub ? <Txt size={13} color={C.dim} lh={1.35}>{sub}</Txt> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? <Tap onPress={onPress}>{body}</Tap> : body;
}

export function IconButton({ onPress, children, size = 36 }: { onPress: () => void; children: ReactNode; size?: number }) {
  return (
    <Tap onPress={onPress} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
      {typeof children === 'string' ? <Txt size={size > 36 ? 18 : 16} color={C.body}>{children}</Txt> : children}
    </Tap>
  );
}

/** Three pulsing dots: REI is thinking. */
export function Dots() {
  const { accent } = useStore();
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
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {vs.map((v, i) => <Animated.View key={i} style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: accent, opacity: v }} />)}
    </View>
  );
}

/** Four HUD corner brackets around a card. */
export function Corners({ color, radius = 24 }: { color: string; radius?: number }) {
  const s = { position: 'absolute' as const, width: 24, height: 24, borderColor: color, opacity: 0.8 };
  return (
    <>
      <View style={[s, { top: -1, left: -1, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: radius }]} />
      <View style={[s, { top: -1, right: -1, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: radius }]} />
      <View style={[s, { bottom: -1, left: -1, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: radius }]} />
      <View style={[s, { bottom: -1, right: -1, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: radius }]} />
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
  return <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: v, shadowColor: color, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />;
}

/** Four-bar audio glyph used for the voice buttons. */
export function VoiceGlyph({ color, big }: { color: string; big?: boolean }) {
  const hs = big ? [9, 18, 12, 7] : [8, 16, 11, 6];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: big ? 3 : 2 }}>
      {hs.map((h, i) => <View key={i} style={{ width: big ? 2.5 : 2, height: h, borderRadius: 2, backgroundColor: color }} />)}
    </View>
  );
}

export const accentFill = (acc: string, a = 0.14) => alpha(acc, a);
