// Building blocks for the onboarding ("The Pact Arc"): manga panels, speed lines, outlined kanji,
// REI's speech bubble, and the answer controls. Colors come from the theme being chosen, passed
// down as `acc` / `acc2`, so the screens repaint as the user picks a world.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Mask, Pattern, Rect, Stop, Text as SvgText, Circle } from 'react-native-svg';
import { Tap, Txt } from '../ui';
import { alpha, C, fontFamily, mix } from '../../lib/theme';

export const JP = 'ZenKakuGothicNew_500Medium';

/** Fades and lifts its children in after `delay` ms, like the design's obRise. */
export function Rise({ delay = 0, children, style, from = 14 }: { delay?: number; children: ReactNode; style?: StyleProp<ViewStyle>; from?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 550, delay, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>{children}</Animated.View>;
}

/** Big kanji drawn as an outline only. */
export function Outline({ text, size, color, width = 1.2, vertical = false, style }: { text: string; size: number; color: string; width?: number; vertical?: boolean; style?: StyleProp<ViewStyle> }) {
  const chars = vertical ? [...text] : [text];
  const w = vertical ? size * 1.05 : size * [...text].length * 1.02;
  const h = vertical ? size * chars.length * 0.92 : size * 1.12;
  return (
    <View pointerEvents="none" style={style}>
      <Svg width={w} height={h}>
        {chars.map((c, i) => (
          <SvgText
            key={i}
            x={vertical ? w / 2 : 0}
            y={vertical ? size * 0.86 + i * size * 0.92 : size * 0.9}
            textAnchor={vertical ? 'middle' : 'start'}
            fontFamily={JP}
            fontSize={size}
            fill="none"
            stroke={color}
            strokeWidth={width}
          >
            {c}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

/** Manga speed lines radiating from a centre, fading in and out with distance. */
export function SpeedLines({ size, color, inner = 0.14, outer = 0.5, count = 72, opacity = 1 }: { size: number; color: string; inner?: number; outer?: number; count?: number; opacity?: number }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size} style={{ opacity }}>
      {Array.from({ length: count }, (_, i) => {
        const t = (i / count) * Math.PI * 2 + (i % 3) * 0.013;
        const r1 = size * inner * (1 + (i % 5) * 0.06), r2 = size * outer * (0.82 + (i % 7) * 0.03);
        const strong = i % 2 === 1;
        return (
          <Line
            key={i}
            x1={c + r1 * Math.cos(t)} y1={c + r1 * Math.sin(t)} x2={c + r2 * Math.cos(t)} y2={c + r2 * Math.sin(t)}
            stroke={strong ? color : '#FFFFFF'} strokeOpacity={strong ? 0.32 : 0.09} strokeWidth={strong ? 1.4 : 1}
          />
        );
      })}
    </Svg>
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

/** The big pill call to action. */
export function Cta({ label, onPress, acc, disabled, kanji }: { label: string; onPress: () => void; acc: string; disabled?: boolean; kanji?: string }) {
  return (
    <Tap
      onPress={disabled ? undefined : onPress}
      style={{
        height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: disabled ? 'rgba(255,255,255,0.06)' : acc,
        shadowColor: acc, shadowOpacity: disabled ? 0 : 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Txt size={17} w={600} color={disabled ? C.dim : C.ink}>{label}</Txt>
      {kanji ? <Txt face="jp" size={16} color={alpha(C.ink, 0.55)}>{kanji}</Txt> : <Txt size={18} w={600} color={disabled ? C.dim : C.ink}>→</Txt>}
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
    ? { borderColor: acc, backgroundColor: solid(acc, 0.12), ...comic(alpha(acc, 0.55), 3), kStroke: acc, fg: C.text, check: '● 選択' }
    : { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0E0F12', shadowOpacity: 0, kStroke: 'rgba(255,255,255,0.14)', fg: C.body, check: '' };
}

/** A segmented row: one choice. */
export function Seg<T extends string | number>({ value, opts, onPick, acc }: { value: T; opts: [T, string, string?][]; onPick: (v: T) => void; acc: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' }}>
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
        <View key={o.label} style={{ width: '48.6%', flexGrow: 1, paddingTop: 11, paddingBottom: 9, paddingLeft: 13, paddingRight: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' }}>
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
    <View style={{ paddingTop: 12, paddingHorizontal: 14, paddingBottom: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' }}>
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
export function ToggleRow({ k, label, sub, on, onPress, acc }: { k: string; label: string; sub: string; on: boolean; onPress: () => void; acc: string }) {
  return (
    <Tap onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 16, paddingRight: 14, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: on ? alpha(acc, 0.4) : 'rgba(255,255,255,0.1)' }}>
      <Txt face="jp" size={20} color={on ? acc : C.ghost} style={{ width: 24 }}>{k}</Txt>
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
      style={{ height: 50, paddingHorizontal: 16, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', fontFamily: fontFamily('Geist', 400), fontSize: 15.5, color: C.text }}
    />
  );
}
