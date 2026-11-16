// Building blocks for the onboarding and sign-in, in the Sumi & Hanko system: the page behind
// them, the main button and the answer controls. The world is still being chosen here, so its
// colour is passed down as `acc` instead of read from the store.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import { CutButton, SectionHeader } from '../fight';
import { Icon, type IconKey } from '../icons';
import { PaperTexture } from '../ink';
import { SwitchArt, Tap, Txt } from '../ui';
import { C, F, fontFamily, HIT, onColor, RADIUS, SP, STROKE } from '../../lib/theme';
import { useStore } from '../../state/store';

/** Fades and lifts its children in after `delay` ms. */
export function Rise({ delay = 0, children, style, from = 14 }: { delay?: number; children: ReactNode; style?: StyleProp<ViewStyle>; from?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 450, delay, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>{children}</Animated.View>;
}

/** The page behind sign-in and the chapters: night washi, a shade lighter at the top, with its paper fibres. */
export function Atmosphere(_: { acc: string; acc2?: string }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: F.arena }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="washiAtmosphere" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#171513" />
            <Stop offset="0.4" stopColor={F.arena} />
            <Stop offset="1" stopColor="#100F0E" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#washiAtmosphere)" />
      </Svg>
      <PaperTexture />
    </View>
  );
}

/** The screen's one primary action: the rice-paper button. */
export function Cta({ label, onPress, acc, disabled, icon }: { label: string; onPress: () => void; acc: string; disabled?: boolean; icon?: IconKey }) {
  return <CutButton label={label} icon={icon} onPress={onPress} disabled={disabled} accent={acc} />;
}

/** The heading above an answer: boxed tag, Mincho title, a quiet note on the right. */
export function FieldLabel({ label, right, acc }: { label: string; right?: string; acc: string }) {
  if (!label && !right) return null;
  return <SectionHeader title={label} meta={right} accent={acc} style={{ marginBottom: SP.sm }} />;
}

/** A choice tile: a sumi card in a quiet line; chosen, the line takes your colour. */
export const tile = (on: boolean, acc: string): ViewStyle => ({
  borderWidth: on ? 1.5 : 1,
  borderColor: on ? acc : F.line,
  borderRadius: RADIUS.card,
  backgroundColor: on ? F.canvas2 : F.canvas,
});

/** The tick on a chosen tile: a small ring, filled with your colour when picked. */
export function Picked({ on, acc }: { on: boolean; acc: string }) {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? acc : F.rule, backgroundColor: on ? acc : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Icon name="check" size={13} color={onColor(acc)} tint={0} strokeWidth={2.6} /> : null}
    </View>
  );
}

/** A segmented row: one choice, picked in rice paper. */
export function Seg<T extends string | number>({ value, opts, onPick }: { value: T; opts: [T, string, string?][]; onPick: (v: T) => void; acc: string }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', padding: 3, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm, backgroundColor: F.canvas }}>
      {opts.map(([v, label, sub]) => {
        const on = v === value, ink = on ? F.arena : F.smoke;
        return (
          <Tap
            key={String(v)} onPress={() => onPick(v)}
            accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={sub ? `${label}, ${sub}` : label}
            style={{ flex: 1, minHeight: HIT, alignItems: 'center', justifyContent: 'center', paddingVertical: SP.xs, paddingHorizontal: 2, borderRadius: RADIUS.tag, backgroundColor: on ? F.chalk : 'transparent' }}
          >
            <Txt face="labelItalic" size={14} color={ink} numberOfLines={1}>{label}</Txt>
            {sub ? <Txt face="label" w={400} size={12} color={ink} numberOfLines={1}>{sub}</Txt> : null}
          </Tap>
        );
      })}
    </View>
  );
}

/** Wrapping chips: one choice or several, the caller decides. Picked in rice paper. */
export function Chips({ opts, isOn, onPick }: { opts: string[]; isOn: (o: string) => boolean; onPick: (o: string) => void; acc: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
      {opts.map(o => {
        const on = isOn(o);
        return (
          <Tap key={o} onPress={() => onPick(o)} accessibilityLabel={o} accessibilityState={{ selected: on }} style={{ minHeight: HIT, paddingHorizontal: SP.lg, justifyContent: 'center', borderWidth: 1, borderColor: on ? F.chalk : F.rule, borderRadius: RADIUS.sm, backgroundColor: on ? F.chalk : F.canvas }}>
            <Txt size={15} w={on ? 600 : 500} lh={1.35} color={on ? F.arena : C.body}>{o}</Txt>
          </Tap>
        );
      })}
    </View>
  );
}

/** A square − / + button, 44pt. */
function StepButton({ sign, label, onPress, wide }: { sign: '−' | '+'; label: string; onPress: () => void; wide?: boolean }) {
  return (
    <Tap onPress={onPress} accessibilityLabel={`${sign === '+' ? 'Increase' : 'Decrease'} ${label}`} style={{ width: wide ? undefined : HIT, flex: wide ? 1 : undefined, height: HIT, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm, backgroundColor: F.arena, alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={22} w={500} lh={1.2} color={F.chalk}>{sign}</Txt>
    </Tap>
  );
}

/**
 * Number tiles with − / + steppers. One on its own is a row (− value +); several sit two-up, each
 * with its number on top and the two buttons side by side underneath, so the number never squeezes.
 */
export function Nums({ items }: { items: { label: string; unit?: string; value: string; minus: () => void; plus: () => void }[] }) {
  const solo = items.length === 1;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
      {items.map(o => {
        const name = o.label.toLowerCase();
        const value = <Txt face="num" size={solo ? 26 : 24} lh={1.25} color={o.value === '—' ? F.smoke : F.chalk} numberOfLines={1}>{o.value}</Txt>;
        return (
          <View key={o.label} style={{ width: '47%', flexGrow: 1, padding: SP.lg, gap: SP.sm, backgroundColor: F.canvas, borderWidth: STROKE, borderColor: F.line, borderRadius: RADIUS.card }}>
            <Txt face="label" size={12} color={F.smoke} numberOfLines={1}>{o.unit ? `${o.label} · ${o.unit}` : o.label}</Txt>
            {solo ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                <StepButton sign="−" label={name} onPress={o.minus} />
                <View style={{ flex: 1, alignItems: 'center' }}>{value}</View>
                <StepButton sign="+" label={name} onPress={o.plus} />
              </View>
            ) : (
              <>
                {value}
                <View style={{ flexDirection: 'row', gap: SP.sm }}>
                  <StepButton sign="−" label={name} onPress={o.minus} wide />
                  <StepButton sign="+" label={name} onPress={o.plus} wide />
                </View>
              </>
            )}
          </View>
        );
      })}
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
  const W = 320, H = 28, offset = ((value - min) / step) * 8;
  const ticks = [];
  for (let i = -24; i <= 24; i++) {
    const n = Math.round((value - min) / step) + i;
    const x = W / 2 + n * 8 - offset;
    if (x < 0 || x > W || n < 0 || n > Math.round((max - min) / step)) continue;
    ticks.push(<Line key={i} x1={x} x2={x} y1={n % 10 === 0 ? 4 : 12} y2={H} stroke={n % 10 === 0 ? F.smoke : F.rope} strokeWidth={1.5} strokeLinecap="round" />);
  }
  return (
    <View
      accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: `${value.toFixed(dp)} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
      style={{ padding: SP.lg, gap: SP.sm, backgroundColor: F.canvas, borderWidth: STROKE, borderColor: F.line, borderRadius: RADIUS.card }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        <Txt face="label" size={12} color={F.smoke} style={{ flex: 1 }} numberOfLines={2}>{label}</Txt>
        <StepButton sign="−" label={label.toLowerCase()} onPress={() => onChange(clamp(value - step))} />
        <View style={{ minWidth: 96, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5 }}>
          <Txt face="num" size={24} lh={1.25}>{value.toFixed(dp)}</Txt>
          <Txt face="label" w={400} size={13} color={F.smoke}>{unit}</Txt>
        </View>
        <StepButton sign="+" label={label.toLowerCase()} onPress={() => onChange(clamp(value + step))} />
      </View>
      <View {...pan.panHandlers} style={{ height: H, alignItems: 'center', overflow: 'hidden' }}>
        <Svg width={W} height={H}>
          {ticks}
          <Rect x={W / 2 - 1.5} y={0} width={3} height={H} rx={1.5} fill={acc} />
        </Svg>
      </View>
    </View>
  );
}

/** A labelled switch row. */
export function ToggleRow({ icon, label, sub, on, onPress, acc }: { icon: IconKey; label: string; sub: string; on: boolean; onPress: () => void; acc: string }) {
  return (
    <Tap
      onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={`${label}. ${sub}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: HIT, paddingVertical: SP.md, paddingHorizontal: SP.lg, backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card }}
    >
      <Icon name={icon} size={22} color={on ? acc : F.smoke} tint={0} strokeWidth={1.6} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={15} w={600} lh={1.35}>{label}</Txt>
        <Txt size={13} color={C.sub} lh={1.4}>{sub}</Txt>
      </View>
      <SwitchArt on={on} acc={acc} />
    </Tap>
  );
}

/** A single-line answer box. Its border takes your colour while you type. */
export function Field({ value, onChange, placeholder, secure, keyboard, autoCapitalize = 'sentences', maxLength = 160, acc, accessibilityLabel }: { value: string; onChange: (v: string) => void; placeholder: string; secure?: boolean; keyboard?: 'default' | 'email-address'; autoCapitalize?: 'none' | 'sentences' | 'words'; maxLength?: number; acc?: string; accessibilityLabel?: string }) {
  const textSize = useStore(s => s.settings.textSize);
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      placeholder={placeholder}
      placeholderTextColor={C.dim}
      accessibilityLabel={accessibilityLabel ?? placeholder}
      secureTextEntry={secure}
      keyboardType={keyboard}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      maxLength={maxLength}
      keyboardAppearance="dark"
      style={{ minHeight: 52, paddingHorizontal: SP.lg, backgroundColor: F.canvas, borderWidth: 1, borderColor: focus ? acc ?? F.chalk : F.rule, borderRadius: RADIUS.sm, fontFamily: fontFamily('body', 500), fontSize: 16 * textSize, color: F.chalk }}
    />
  );
}
