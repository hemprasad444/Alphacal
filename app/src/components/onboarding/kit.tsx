// Building blocks for the onboarding ("The Pact Arc") and sign-in: the page atmosphere, halftones,
// REI's speech bubble, the call to action and the answer controls. Colors come from the theme being chosen, passed
// down as `acc` / `acc2`, so the screens repaint as the user picks a world.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Mask, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Icon, type IconKey } from '../icons';
import { Tap, Txt } from '../ui';
import { alpha, C, fontFamily, mix } from '../../lib/theme';

/** Fades and lifts its children in after `delay` ms, like the design's obRise. */
export function Rise({ delay = 0, children, style, from = 14 }: { delay?: number; children: ReactNode; style?: StyleProp<ViewStyle>; from?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 550, delay, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>{children}</Animated.View>;
}

/** The page behind sign-in and the chapters: a glow from the top, one from the corner, halftone dots. */
export function Atmosphere({ acc, acc2 }: { acc: string; acc2: string }) {
  const { width: W } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="obTop" cx="50%" cy="-12%" rx="110%" ry="55%">
            <Stop offset="0" stopColor={acc} stopOpacity={0.14} />
            <Stop offset="0.62" stopColor={acc} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="obCorner" cx="105%" cy="108%" rx="80%" ry="40%">
            <Stop offset="0" stopColor={acc2} stopOpacity={0.18} />
            <Stop offset="0.7" stopColor={acc2} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#obTop)" />
        <Rect width="100%" height="100%" fill="url(#obCorner)" />
      </Svg>
      <View style={{ position: 'absolute', right: 0, top: 0 }}><Halftone width={Math.min(260, W * 0.65)} height={300} corner="tr" /></View>
      <View style={{ position: 'absolute', left: 0, bottom: 0 }}><Halftone width={240} height={260} color={acc} opacity={0.3} corner="bl" /></View>
    </View>
  );
}

/** A halftone dot field fading towards one corner. */
export function Halftone({ width, height, color = '#FFFFFF', opacity = 0.11, corner = 'tr', step = 6 }: { width: number; height: number; color?: string; opacity?: number; corner?: 'tr' | 'bl'; step?: number }) {
  const id = `ht${corner}${step}`;
  const [x1, y1, x2, y2] = corner === 'tr' ? ['1', '0', '0.45', '0.55'] : ['0', '1', '0.5', '0.5'];
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <Pattern id={`${id}p`} width={step} height={step} patternUnits="userSpaceOnUse">
          <Circle cx={step / 2} cy={step / 2} r={1.1} fill={color} fillOpacity={opacity} />
        </Pattern>
        <LinearGradient id={`${id}g`} x1={x1} y1={y1} x2={x2} y2={y2}>
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <Mask id={`${id}m`}>
          <Rect width={width} height={height} fill={`url(#${id}g)`} />
        </Mask>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${id}p)`} mask={`url(#${id}m)`} />
    </Svg>
  );
}

/**
 * A tint of `acc` over the dark page, as a solid colour. Use it behind `comic()`: iOS draws a shadow of
 * every child of a see-through view, which doubles the text.
 */
export const solid = (acc: string, a: number, base = '#0A0B0E') => mix(acc, base, a);

/** Solid offset "comic" shadow in the accent color (iOS draws it; elsewhere it's just a border). */
export const comic = (acc: string, d = 4): ViewStyle => ({ shadowColor: acc, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: d, height: d } });

/** REI's white speech bubble. */
export function Bubble({ children, acc, tail = 'left', style }: { children: ReactNode; acc: string; tail?: 'left' | 'top'; style?: StyleProp<ViewStyle> }) {
  const r = tail === 'top' ? { borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 20 } : { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 22, borderBottomLeftRadius: 4 };
  return <View style={[{ backgroundColor: C.text, paddingVertical: 13, paddingHorizontal: 16 }, r, comic(acc, tail === 'top' ? 4 : 5), style]}>{children}</View>;
}

/** The big call to action: a solid accent slab with a hard shadow, like the Dojo's buttons. */
export function Cta({ label, onPress, acc, disabled, icon }: { label: string; onPress: () => void; acc: string; disabled?: boolean; icon?: IconKey }) {
  return (
    <Tap
      onPress={disabled ? undefined : onPress}
      style={{
        height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: disabled ? '#15171B' : acc,
        borderWidth: 1.5, borderColor: disabled ? C.line3 : acc,
        ...(disabled ? null : comic(alpha(mix(acc, '#000000', 0.55), 1), 4)),
      }}
    >
      {icon ? <Icon name={icon} size={20} color={disabled ? C.dim : C.ink} tint={0.25} strokeWidth={2} /> : null}
      <Txt size={17} w={600} color={disabled ? C.dim : C.ink}>{label}</Txt>
      {icon ? null : <Icon name="chevron" size={18} color={disabled ? C.dim : C.ink} strokeWidth={2.2} />}
    </Tap>
  );
}

/** Field caption with an optional accent note on the right. */
export function FieldLabel({ label, right, acc }: { label: string; right?: string; acc: string }) {
  if (!label && !right) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
      <Txt face="mono" size={10.5} ls={0.15} color={C.dim}>{label}</Txt>
      {right ? <Txt face="mono" size={10.5} ls={0.15} color={acc} align="right">{right}</Txt> : null}
    </View>
  );
}

/** Selected / unselected look for cards and chips. */
export function pick(on: boolean, acc: string) {
  return on
    ? { borderColor: acc, backgroundColor: solid(acc, 0.12, '#0D0F13'), ...comic(alpha(acc, 0.55), 3), kStroke: acc, fg: C.text }
    : { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0D0F13', shadowOpacity: 0, kStroke: 'rgba(255,255,255,0.14)', fg: C.body };
}

/** The tick in the corner of a chosen card. */
export function Picked({ on, acc }: { on: boolean; acc: string }) {
  if (!on) return <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)' }} />;
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: acc, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="check" size={14} color={C.ink} strokeWidth={2.6} />
    </View>
  );
}

/** A segmented row: one choice. */
export function Seg<T extends string | number>({ value, opts, onPick, acc }: { value: T; opts: [T, string, string?][]; onPick: (v: T) => void; acc: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: '#0D0F13', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' }}>
      {opts.map(([v, label, sub]) => {
        const on = v === value;
        return (
          <Tap key={String(v)} onPress={() => onPick(v)} style={{ flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, backgroundColor: on ? acc : 'transparent' }}>
            <Txt size={13.5} w={600} color={on ? C.ink : C.sub} numberOfLines={1}>{label}</Txt>
            {sub ? <Txt face="mono" size={9.5} color={on ? alpha(C.ink, 0.7) : alpha(C.sub, 0.7)}>{sub}</Txt> : null}
          </Tap>
        );
      })}
    </View>
  );
}

/** Wrapping chips: one choice, or several when `multi`. "None" clears the rest. */
export function Chips({ opts, isOn, onPick, acc }: { opts: string[]; isOn: (o: string) => boolean; onPick: (o: string) => void; acc: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
      {opts.map(o => {
        const s = pick(isOn(o), acc);
        return (
          <Tap key={o} onPress={() => onPick(o)} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, justifyContent: 'center', borderWidth: 1.5, borderColor: s.borderColor, backgroundColor: s.backgroundColor, shadowColor: (s as ViewStyle).shadowColor, shadowOpacity: (s as ViewStyle).shadowOpacity, shadowRadius: 0, shadowOffset: (s as ViewStyle).shadowOffset }}>
            <Txt size={13.5} w={500} color={s.fg}>{o}</Txt>
          </Tap>
        );
      })}
    </View>
  );
}

/** Two-up number tiles with − / + steppers. */
export function Nums({ items }: { items: { label: string; unit?: string; value: string; minus: () => void; plus: () => void }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map(o => (
        <View key={o.label} style={{ width: '48.6%', flexGrow: 1, paddingTop: 11, paddingBottom: 9, paddingLeft: 13, paddingRight: 6, borderRadius: 12, backgroundColor: '#0D0F13', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Txt face="mono" size={9.5} ls={0.15} color={C.dim}>{o.label}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
            <Txt face="mono" size={19} w={500}>{o.value}{o.unit ? <Txt face="mono" size={11} color={C.dim}>{` ${o.unit}`}</Txt> : null}</Txt>
            <View style={{ flexDirection: 'row' }}>
              <Tap onPress={o.minus} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}><Txt size={17} color={C.muted}>−</Txt></Tap>
              <Tap onPress={o.plus} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}><Txt size={17} color={C.muted}>+</Txt></Tap>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** A value on a draggable ruler: drag left or right, or tap − / +. */
export function Scrub({ label, unit, value, step, min, max, dp, onChange, acc }: { label: string; unit: string; value: number; step: number; min: number; max: number; dp: number; onChange: (v: number) => void; acc: string }) {
  const clamp = (x: number) => +Math.min(max, Math.max(min, Math.round(x / step) * step)).toFixed(dp);
  const start = useRef(value);
  const cur = useRef({ value, onChange });
  useEffect(() => {
    cur.current = { value, onChange };
  });
  // The refs are read when the finger moves, not while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = cur.current.value;
      },
      onPanResponderMove: (_, g) => cur.current.onChange(clamp(start.current - (g.dx / 8) * step)),
    }),
  );
  const W = 320, offset = ((value - min) / step) * 8;
  const ticks = [];
  for (let i = -24; i <= 24; i++) {
    const n = Math.round((value - min) / step) + i;
    const x = W / 2 + n * 8 - offset;
    if (x < 0 || x > W) continue;
    ticks.push(<Line key={i} x1={x} x2={x} y1={n % 10 === 0 ? 4 : 10} y2={24} stroke="#FFFFFF" strokeOpacity={n % 10 === 0 ? 0.6 : 0.22} strokeWidth={n % 10 === 0 ? 1.5 : 1} />);
  }
  return (
    <View style={{ paddingTop: 12, paddingHorizontal: 14, paddingBottom: 10, borderRadius: 12, backgroundColor: '#0D0F13', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt face="mono" size={10.5} ls={0.15} color={C.label} style={{ flex: 1 }} numberOfLines={1}>{label}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Tap onPress={() => onChange(clamp(value - step))} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><Txt size={18} color={C.muted}>−</Txt></Tap>
          <Txt face="mono" size={25} w={500} align="center" style={{ minWidth: 96 }}>{value.toFixed(dp)}<Txt face="mono" size={12} color={C.dim}>{` ${unit}`}</Txt></Txt>
          <Tap onPress={() => onChange(clamp(value + step))} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><Txt size={18} color={C.muted}>+</Txt></Tap>
        </View>
      </View>
      <View {...pan.panHandlers} style={{ height: 28, marginTop: 4, alignItems: 'center', overflow: 'hidden' }}>
        <Svg width={W} height={28}>
          <Defs>
            <LinearGradient id="scrubFade" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.22" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="0.78" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            <Mask id="scrubMask"><Rect width={W} height={28} fill="url(#scrubFade)" /></Mask>
          </Defs>
          <Svg mask="url(#scrubMask)">{ticks}</Svg>
          <Rect x={W / 2 - 1} y={0} width={2} height={28} rx={1} fill={acc} />
        </Svg>
      </View>
    </View>
  );
}

/** A labelled switch row (the Link chapter). */
export function ToggleRow({ icon, label, sub, on, onPress, acc }: { icon: IconKey; label: string; sub: string; on: boolean; onPress: () => void; acc: string }) {
  return (
    <Tap onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 16, paddingRight: 14, borderRadius: 12, backgroundColor: '#0D0F13', borderWidth: 1.5, borderColor: on ? alpha(acc, 0.45) : 'rgba(255,255,255,0.1)' }}>
      <Icon name={icon} size={24} color={on ? acc : C.ghost} tint={on ? 0.3 : 0.1} />
      <View style={{ flex: 1 }}>
        <Txt size={15} w={600}>{label}</Txt>
        <Txt size={12.5} color={C.sub} lh={1.35} style={{ marginTop: 2 }}>{sub}</Txt>
      </View>
      <View style={{ width: 51, height: 31, borderRadius: 16, backgroundColor: on ? acc : 'rgba(255,255,255,0.14)' }}>
        <View style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: 14, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } }} />
      </View>
    </Tap>
  );
}

/** A single-line answer box. */
export function Field({ value, onChange, placeholder, secure, keyboard, autoCapitalize = 'sentences', maxLength = 160 }: { value: string; onChange: (v: string) => void; placeholder: string; secure?: boolean; keyboard?: 'default' | 'email-address'; autoCapitalize?: 'none' | 'sentences' | 'words'; maxLength?: number }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={C.dim}
      secureTextEntry={secure}
      keyboardType={keyboard}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      maxLength={maxLength}
      keyboardAppearance="dark"
      style={{ height: 50, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#0D0F13', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', fontFamily: fontFamily('Geist', 400), fontSize: 15.5, color: C.text }}
    />
  );
}
